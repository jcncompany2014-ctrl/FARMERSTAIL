import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { pushToUser } from '@/lib/push'

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
 *  - age 1세 미만 → unit='months', value = 개월 수.
 *  - age 1세 이상 → unit='years', value = 만 나이 (정수 floor).
 *
 * # 보안
 * CRON_SECRET bearer.
 */

const MAX_PER_RUN = 1000

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const supabase = createAdminClient()

  // birth_date 가 있는 dogs.
  const { data: dogs, error } = await supabase
    .from('dogs')
    .select('id, user_id, name, birth_date, age_value, age_unit')
    .not('birth_date', 'is', null)
    .limit(MAX_PER_RUN)

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }

  type DogRow = {
    id: string
    user_id: string
    name: string
    birth_date: string // ISO date
    age_value: number | null
    age_unit: string | null
  }
  const list = (dogs ?? []) as DogRow[]

  let updated = 0
  let unchanged = 0
  let invalid = 0
  let birthdays = 0

  // KST today (month, day).
  const todayKst = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
  )
  const todayMonth = todayKst.getMonth() + 1
  const todayDay = todayKst.getDate()

  for (const dog of list) {
    const birth = new Date(dog.birth_date + 'T00:00:00+09:00')
    if (Number.isNaN(birth.getTime())) {
      invalid += 1
      continue
    }
    if (birth.getTime() > Date.now()) {
      invalid += 1
      continue
    }

    const ms = Date.now() - birth.getTime()
    const days = ms / (24 * 60 * 60 * 1000)
    const years = days / 365.25
    let nextValue: number
    let nextUnit: 'months' | 'years'
    if (years < 1) {
      nextValue = Math.max(1, Math.floor(days / 30))
      nextUnit = 'months'
    } else {
      nextValue = Math.floor(years)
      nextUnit = 'years'
    }

    if (dog.age_value !== nextValue || dog.age_unit !== nextUnit) {
      await supabase
        .from('dogs')
        .update({ age_value: nextValue, age_unit: nextUnit })
        .eq('id', dog.id)
      updated += 1
    } else {
      unchanged += 1
    }

    // 강아지 생일 — 보호자에게 푸시 알림. 한 강아지당 하루 1회.
    // (dog_id, today) 기반 idempotency 는 push tag 로 충분 — 같은 날 같은 tag
    // 두 번 보내도 OS 가 dedupe.
    if (
      birth.getMonth() + 1 === todayMonth &&
      birth.getDate() === todayDay &&
      years >= 0.083 // 약 1개월 이상 — 너무 어린 강아지 첫 입력 직후 생일 알림 회피
    ) {
      pushToUser(dog.user_id, {
        title: `🎂 ${dog.name} 생일 축하해요!`,
        body: `${dog.name} 가 ${nextValue}${nextUnit === 'years' ? '살' : '개월'} 이 됐어요. 새 영양 분석을 받아 보세요.`,
        url: `/dogs/${dog.id}`,
        tag: `dog-birthday-${dog.id}-${todayMonth}-${todayDay}`,
      }).catch(() => {})
      birthdays += 1
    }
  }

  return NextResponse.json({
    ok: true,
    checked: list.length,
    updated,
    unchanged,
    invalid,
    birthdays,
  })
}
