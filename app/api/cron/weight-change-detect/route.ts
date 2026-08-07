import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { recordOutcome } from '@/lib/feeding-outcomes'
import { petName } from '@/lib/korean'
import { decideReweigh } from '@/lib/calorie-v2/reweigh'
import { captureBusinessEvent } from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/weight-change-detect
 *
 * Round D1 (2026-05-20): F4-2 변·체중 피드백 cron.
 *
 * # 동작
 *   1. 활성 dog 의 weight_logs 4주 전 ~ 1주 전 1건 (baseline) + 최근 1건 (latest).
 *   2. |latest - baseline| / baseline >= 5% 이면 변화 감지.
 *   3. 감지 시:
 *      a) feeding_outcomes 자동 row insert
 *         source='self_log', weight_kg=latest, comment='4주 ±5% 변화 감지'.
 *      b) [칼로리 v2 M10] 현재 formula.daily_kcal + 최신 BCS 로 decideReweigh
 *         → ±10% 조정 판정 시 reweighs 이력 기록 (14일 1회 페이싱).
 *         청구에 닿는 자동 변경은 없음 — 제안·기록까지 (반영은 보호자 확인 흐름).
 *      c) 14일 이내 같은 push 보낸 적 없으면 사용자 push 알람 — 조정 판정이
 *         있으면 구체 수치(551→496kcal) 제안 문구로 업그레이드.
 *      d) push CTA — /dogs/{dogId}/analysis.
 *   4. ±5% 미만이면 skip.
 *
 * # 일정
 *   매주 월 09:00 KST. weight-reminder 와 같은 슬롯이지만 다른 분기:
 *   reminder = 측정 안 하는 dog / detect = 측정한 dog.
 *
 * # 안전장치
 *   - 14일 spam 차단
 *   - baseline / latest 동일 measured_at 인 경우 skip
 *   - 신뢰도 위해 baseline 은 최소 3주 전 측정만 인정 (너무 가까운 비교 X)
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('weight-change-detect', () => runDetect())
}

async function runDetect(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  /**
   * ★ `dogs` 에는 **deleted_at 컬럼이 없다** (2026-07-31 프로덕션 실측).
   * 이 필터 때문에 쿼리가 통째로 실패했고, error 를 안 받아 **매번 0마리 처리 후
   * '성공'** 으로 집계됐다 — 체중 급변 경보가 한 번도 나가지 않았다는 뜻이다.
   * 강아지 삭제는 hard delete 다(soft delete 컬럼 자체가 없다).
   *
   * ★keyset 순회 (2026-08-07 성능 감사). 예전엔 무정렬 `.limit(500)` 단발이라
   * 강아지가 500마리를 넘는 순간 **잘린 강아지들은 영원히 검사되지 않았다** —
   * 성능이 아니라 정확성 문제다. id 오름차순 keyset 으로 전부 수집한다.
   * PAGE=200 인 이유: 아래 weight_logs 일괄 조회가 `.in(dog_id, ids)` 를
   * 쓰는데, UUID 200개 ≈ 7KB 로 URL 길이 한도 안에서 여유가 있다.
   */
  const PAGE = 200
  const dogList: Array<{ id: string; user_id: string; name: string }> = []
  let lastId: string | null = null
  for (;;) {
    let pageQuery = admin
      .from('dogs')
      .select('id, user_id, name')
      .order('id', { ascending: true })
      .limit(PAGE)
    if (lastId) pageQuery = pageQuery.gt('id', lastId)
    const { data: dogs, error: dogsErr } = await pageQuery
    if (dogsErr) {
      captureBusinessEvent('error', 'cron.weight_change.dogs_query_failed', {
        dbError: dogsErr.message,
      })
      break
    }
    const page = (dogs ?? []) as Array<{
      id: string
      user_id: string
      name: string
    }>
    const tail = page[page.length - 1]
    if (!tail) break
    dogList.push(...page)
    lastId = tail.id
    if (page.length < PAGE) break
  }

  const now = Date.now()
  const sevenDaysAgoMs = now - 7 * 86_400_000
  const twentyOneDaysAgoMs = now - 21 * 86_400_000
  const thirtyFiveDaysAgo = new Date(now - 35 * 86_400_000).toISOString()
  const fourteenDaysAgo = new Date(now - 14 * 86_400_000).toISOString()

  /**
   * ★N+1 제거 (2026-08-07 성능 감사) — 예전엔 강아지마다 weight_logs 2쿼리
   * (최근 7일 + 21~35일 기준선)라 500마리면 1,000쿼리였다. 35일치 기록을
   * 200마리 단위로 일괄 조회해 메모리에서 가른다. 판정은 동일하다:
   * latest = 7일 내 최신 1건, baseline = 21~35일 창의 가장 이른 1건.
   * 일괄 조회가 실패한 배치의 강아지는 Map 에 안 실려 skippedNoData 로
   * 떨어진다 — 예전의 "조회 실패 → 건너뜀"과 같은 결과이며, 오류는 남긴다.
   */
  const logsByDog = new Map<
    string,
    Array<{ weight: number; measured_at: string }>
  >()
  for (let i = 0; i < dogList.length; i += PAGE) {
    const ids = dogList.slice(i, i + PAGE).map((d) => d.id)
    /**
     * ★배치 안에서도 페이지를 돈다 (2026-08-08 재검증 2차 #3).
     * PostgREST max-rows(기본 1000)는 limit 을 안 줘도 조용히 자르는데,
     * **오름차순이라 최신 로그부터 잘린다** — latest 가 7일 밖으로 보여
     * 경보가 조용히 사라진다. 이 리팩터가 잡았다던 "조용한 누락"과 같은
     * 종류를 스스로 재도입한 셈이었다. 1000행 단위 range 로 끝까지 받는다.
     * (measured_at 동률 대비 id 2차 정렬 — 페이지 경계 중복/누락 방지.)
     */
    const LOG_PAGE = 1000
    let from = 0
    let batchFailed = false
    for (;;) {
      const { data: logsRaw, error: logsErr } = await admin
        .from('weight_logs')
        .select('dog_id, weight, measured_at')
        .in('dog_id', ids)
        .gte('measured_at', thirtyFiveDaysAgo)
        .order('measured_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + LOG_PAGE - 1)
      if (logsErr) {
        console.error(
          '[weight-change-detect] 체중 기록 일괄 조회 실패 — 해당 배치는 건너뜀:',
          logsErr.message,
        )
        batchFailed = true
        break
      }
      const rows = (logsRaw ?? []) as Array<{
        dog_id: string
        weight: number
        measured_at: string
      }>
      for (const row of rows) {
        const arr = logsByDog.get(row.dog_id)
        if (arr) arr.push(row)
        else logsByDog.set(row.dog_id, [row])
      }
      if (rows.length < LOG_PAGE) break
      from += LOG_PAGE
    }
    if (batchFailed) {
      // 반쪽 데이터로 판정하면 "최신 로그 없음"으로 오독한다 — 배치 전체 무효화.
      for (const id of ids) logsByDog.delete(id)
    }
  }

  let detected = 0
  let pushed = 0
  let adjusted = 0
  let skippedNoData = 0
  let skippedSmall = 0
  let skippedSpam = 0

  for (const dog of dogList) {
    // 일괄 조회 결과에서 이 강아지의 기록(35일치, 오름차순)을 꺼낸다.
    const logs = logsByDog.get(dog.id) ?? []

    // 최근 weight — 지난 7일 이내 측정만(너무 오래되면 의미 없음).
    // 오름차순이므로 마지막 원소가 최신이고, 그게 7일 밖이면 7일 내 기록은 없다.
    const last = logs.length > 0 ? logs[logs.length - 1] : undefined
    const latest =
      last && Date.parse(last.measured_at) >= sevenDaysAgoMs ? last : null
    if (!latest) {
      skippedNoData += 1
      continue
    }

    // baseline — 21~35일 전 창의 가장 이른 측정 1건.
    // (조회 자체가 35일 하한이라 상한만 확인하면 된다.)
    const baseline =
      logs.find((l) => Date.parse(l.measured_at) <= twentyOneDaysAgoMs) ?? null
    if (!baseline) {
      skippedNoData += 1
      continue
    }

    // 변화율 계산
    const pct = ((latest.weight - baseline.weight) / baseline.weight) * 100
    const absPct = Math.abs(pct)
    if (absPct < 5) {
      skippedSmall += 1
      continue
    }
    detected += 1

    // outcome row insert — silent fail
    try {
      await recordOutcome(supabase, {
        dog_id: dog.id,
        user_id: dog.user_id,
        source: 'self_log',
        weight_kg: latest.weight,
        comment: `4주 ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% 변화 감지 (${baseline.weight} → ${latest.weight}kg)`,
      })
    } catch {
      /* 기록 실패 silent */
    }

    // ── 칼로리 v2 M10 — 재측정 피드백 판정·기록 ──
    // 현재 DER = 최신 cycle formula.daily_kcal. 목표 = 최신 분석 BCS.
    let reweighProposal: { prevDer: number; newDer: number } | null = null
    try {
      const [{ data: formulaRow }, { data: analysisRow }, { count: recentReweigh }] =
        await Promise.all([
          admin
            .from('dog_formulas')
            .select('daily_kcal')
            .eq('dog_id', dog.id)
            // ★created_at 정렬 — 회차 번호가 큰 것이 최신이 아니다(2026-07-30 감사).
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          admin
            .from('analyses')
            .select('bcs_score')
            .eq('dog_id', dog.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          admin
            .from('reweighs')
            .select('id', { count: 'exact', head: true })
            .eq('dog_id', dog.id)
            .gt('created_at', fourteenDaysAgo),
        ])
      const prevDer = (formulaRow as { daily_kcal: number } | null)?.daily_kcal
      const bcsScore = (analysisRow as { bcs_score: number | null } | null)?.bcs_score
      const days = Math.round(
        (Date.parse(latest.measured_at) - Date.parse(baseline.measured_at)) /
          86_400_000,
      )
      if (prevDer && (recentReweigh ?? 0) === 0) {
        const decision = decideReweigh({
          prevDer,
          baselineWeightKg: baseline.weight,
          latestWeightKg: latest.weight,
          days,
          bcsScore,
        })
        if (decision.action === 'adjust') {
          const { error: rwErr } = await admin.from('reweighs').insert({
            dog_id: dog.id,
            user_id: dog.user_id,
            weight_kg: latest.weight,
            baseline_weight_kg: baseline.weight,
            bcs: bcsScore ?? null,
            goal: decision.goal,
            weight_delta_pct: decision.weightDeltaPct,
            prev_der: prevDer,
            new_der: decision.newDer,
            adjust_note: decision.note,
            measured_at: latest.measured_at,
          })
          if (!rwErr) {
            adjusted += 1
            reweighProposal = { prevDer, newDer: decision.newDer }
          }
        }
      }
    } catch {
      /* M10 판정 실패 — 기존 감지·푸시 흐름은 계속 (silent) */
    }

    // 14일 이내 같은 push 보낸 적 있으면 skip.
    // ⚠️ dedup은 body 고정문구로 — push_log.category 는 pushToUser 의 PushCategory
    // ('order' 재사용)로 기록되므로 'reminder-weight-change' 로 조회하면 영구
    // 미스매치라 dedup이 무력화됐었다(#77 weight-reminder 와 동일 버그). title은
    // 방향(증가/감소)으로 가변 + "체중"이 weight-reminder 와 충돌하므로, 이 cron
    // 고유·불변인 body 문구로 dedup.
    const { count: recentPush, error: recentPushErr } = await admin
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', dog.user_id)
      .ilike('body', '%4주 만에 변화가 있었네요%')
      .gt('sent_at', fourteenDaysAgo)
    // ★실패를 "안 보냈음"으로 읽으면 14일 가드가 열려 같은 알림이 또 간다.
    if (recentPushErr) {
      console.error('[weight-change-detect] 재발송 가드 조회 실패, 건너뜀:', recentPushErr.message)
      skippedSpam += 1
      continue
    }
    if ((recentPush ?? 0) > 0) {
      skippedSpam += 1
      continue
    }

    // push
    const direction = pct >= 0 ? '증가' : '감소'
    const sign = pct >= 0 ? '+' : ''
    try {
      const pushResult = await pushToUser(
        dog.user_id,
        {
          title: `${petName(dog.name)}가 체중 ${sign}${pct.toFixed(1)}% ${direction}`,
          // dedup 앵커 문구('4주 만에 변화가 있었네요') 유지 — M10 조정 판정이
          // 있으면 구체 수치 제안으로 업그레이드.
          body: reweighProposal
            ? `4주 만에 변화가 있었네요. 하루 급여 열량을 ${reweighProposal.prevDer}→${reweighProposal.newDer}kcal로 조정을 제안드려요 — 분석에서 확인해 주세요.`
            : `4주 만에 변화가 있었네요. 다음 박스 사이즈를 다시 추천드릴까요?`,
          url: `/dogs/${dog.id}/analysis`,
          tag: `weight-change-${dog.id}`,
        },
        // 경보 — nudge 아님. 잔소리 상한에 밀려 잘리면 안 된다.
        { category: 'health' },
      )
      // ★실제로 나간 것만 센다 (2026-08-08 크론 감사).
      //  pushToUser 는 실패해도 throw 하지 않고 { ok:false, sent:0 } 을
      //  돌려준다 — VAPID 키 미설정이면 한 건도 안 나가는데 지표는
      //  "sent: N" 초록이었다(규칙8 과 같은 실패 모양).
      if ((pushResult?.sent ?? 0) > 0) pushed += 1
    } catch {
      /* push 실패 silent */
    }
  }

  return NextResponse.json({
    ok: true,
    total: dogList.length,
    detected,
    adjusted,
    pushed,
    skipped: {
      no_data: skippedNoData,
      small_change: skippedSmall,
      spam_window: skippedSpam,
    },
  })
}
