import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { pushToUser } from '@/lib/push'
import { dbError } from '@/lib/api/errors'
import { petName } from '@/lib/korean'
import { deriveAgeFromBirth } from '@/lib/dog-age'
import { nowKstMs, todayKstIsoDate } from '@/lib/datetime-kst'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/dog-age-update
 *
 * 매일 1회. dogs.birth_date 가 있는 row 의 age_value / age_unit 을 오늘 기준으로
 * 재계산. 영양 분석은 나이 기반이라 자동 갱신이 매년 정확한 식단으로 이어짐.
 *
 * # 부수 효과
 * 강아지 생일 (오늘 이 dog 의 birth_date 와 month-day 일치) 인 dogs 의 보호자
 * 에게 푸시 알림 1회 — 생일 축하 + 영양 재분석 권유.
 *
 * # 처리 규칙
 *  - birth_date 가 NULL → 건드리지 않음 (수동 입력만 신뢰).
 *  - birth_date 미래 → 잘못된 데이터 — 무시.
 *  - 나이는 정본 deriveAgeFromBirth(달력 기준, KST 오늘) — 가입·수정 화면과 같은 값.
 *    ★예전엔 days/365.25 내림이라 두 번째 생일(730.4일/365.25=1.9997)에
 *    "1살이 됐어요" 푸시가 갔다(2026-09-26 출시 전 점검 6차).
 *  - 1000마리 넘으면 페이지로 끝까지 읽는다(예전엔 limit 1000·정렬 없음 → 넘친 강아지는 영영 안 셈).
 *
 * # 보안
 * CRON_SECRET bearer.
 */

const PAGE = 1000

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('dog-age-update', async () => {
    const supabase = createAdminClient()

  type DogRow = {
    id: string
    user_id: string
    name: string
    birth_date: string // ISO date
    age_value: number | null
    age_unit: string | null
  }
  // birth_date 가 있는 dogs — id 순 페이지로 끝까지.
  const list: DogRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data: dogs, error } = await supabase
      .from('dogs')
      .select('id, user_id, name, birth_date, age_value, age_unit')
      .not('birth_date', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      return dbError(error, 'cron_dog_age_update', '강아지 나이 업데이트 실패')
    }
    list.push(...((dogs ?? []) as DogRow[]))
    if ((dogs ?? []).length < PAGE) break
  }

  let updated = 0
  let unchanged = 0
  let invalid = 0
  let birthdays = 0
  let failed = 0

  // KST 오늘 (month, day). deriveAgeFromBirth 는 UTC getter 라 KST 로 민 ms 를 넘긴다.
  const todayIso = todayKstIsoDate()
  const [, todayMonthStr, todayDayStr] = todayIso.split('-')
  const todayMonth = Number(todayMonthStr)
  const todayDay = Number(todayDayStr)
  const kstNow = nowKstMs()

  for (const dog of list) {
    const birthIso = dog.birth_date.slice(0, 10)
    const age = deriveAgeFromBirth(birthIso, kstNow)
    if (!age || !/^\d{4}-\d{2}-\d{2}$/.test(birthIso) || birthIso > todayIso) {
      invalid += 1
      continue
    }
    const nextValue = age.value
    const nextUnit = age.unit

    if (dog.age_value !== nextValue || dog.age_unit !== nextUnit) {
      const { error: upErr } = await supabase
        .from('dogs')
        .update({ age_value: nextValue, age_unit: nextUnit })
        .eq('id', dog.id)
      if (upErr) failed += 1
      else updated += 1
    } else {
      unchanged += 1
    }

    // 강아지 생일 — 보호자에게 푸시 알림. 한 강아지당 하루 1회.
    // (dog_id, today) 기반 idempotency 는 push tag 로 충분 — 같은 날 같은 tag
    // 두 번 보내도 OS 가 dedupe.
    // R98-A (D7): birth.getMonth()/getDate() 는 서버 UTC 기준이라 KST 자정의
    // 절대시각(birth)을 전날 15:00 으로 읽어 생일 푸시가 하루 전 발송됐음.
    // birth_date 문자열(YYYY-MM-DD)을 직접 split 해 KST month/day 와 비교.
    const [, bMonthStr, bDayStr] = dog.birth_date.split('-')
    const birthMonth = Number(bMonthStr)
    const birthDay = Number(bDayStr)
    if (
      birthMonth === todayMonth &&
      birthDay === todayDay &&
      nextUnit === 'years' // 월·일이 같으면 만 1살 이상 — 오늘 태어난 강아지(0개월)는 빼고
    ) {
      // ★await 필수 (2026-08-08 크론 감사). fire-and-forget 이면 라우트가
      //  응답한 뒤 Vercel 이 람다를 얼려 **발송과 push_log 기록이 유실**되고
      //  dedup 도 무력화된다 — 같은 실수를 subscription-charge·
      //  subscription-reminders 에서 이미 고쳤는데 여기만 남아 있었다.
      //  그리고 실제로 나간 것만 센다(pushToUser 는 실패해도 throw 하지 않는다).
      const pushResult = await pushToUser(dog.user_id, {
        title: `🎂 ${petName(dog.name)} 생일 축하해요!`,
        body: `${petName(dog.name)}가 ${nextValue}${nextUnit === 'years' ? '살' : '개월'}이 됐어요. 새 영양 분석을 받아 보세요.`,
        url: `/dogs/${dog.id}`,
        tag: `dog-birthday-${dog.id}-${todayMonth}-${todayDay}`,
      }).catch(() => null)
      if ((pushResult?.sent ?? 0) > 0) birthdays += 1
    }
  }

    return NextResponse.json({
      ok: true,
      checked: list.length,
      updated,
      unchanged,
      invalid,
      failed,
      birthdays,
    })
  })
}
