import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { decideNextBox } from '@/lib/personalization/nextBox'
import { treatCalorieFraction } from '@/lib/nutrition'
import {
  deriveAvailableLines,
  deriveAvailableToppers,
  gateAvailability,
  LINE_TO_SLUG,
  TOPPER_TO_SLUG,
} from '@/lib/personalization/skuMap'
import { SKU_MODEL, LEGACY_LINE_TO_PROTEIN } from '@/lib/personalization/skuModel'
import { ALL_LINES } from '@/lib/personalization/lines'
import type { AlgorithmInput, Checkin, Formula } from '@/lib/personalization/types'
import { recipeName } from '@/lib/personalization/format'
import { petName } from '@/lib/korean'
import { diffFormulas } from '@/lib/personalization/diff'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { pushToUser } from '@/lib/push'
import { notifyPersonalizationCycle } from '@/lib/email'
import { subscriptionState, type SubLike } from '@/lib/subscription-state'
import { priceForFormula, type BoxProduct } from '@/lib/personalization/boxPricing'
import {
  CYCLE_COVER_DAYS,
  MIN_DAYS_BEFORE_DUE,
  isCycleDue,
} from '@/lib/personalization/cycle'
import { getAutomationSettings } from '@/lib/automation-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/personalization-progression
 *
 * 매일 오전 (KST 10:10) 실행. cycle 만료된 강아지의 다음 처방 생성.
 *
 * # 실행 조건 (2026-07-17 — 날짜 → **배송 회차** 기준으로 전환)
 * 강아지의 가장 최신 dog_formulas 가 적용된 뒤 **박스가 BOXES_PER_CYCLE(3)개 나갔고**,
 * **그 강아지의 구독이 active** 일 때만 다음 cycle 처방 생성.
 * (박스 = **결제된** orders row — `payment_status in (paid, partially_refunded)`
 *  이면서 취소·만료가 아닌 것. 청구 크론이 토스를 긁기 전에 pending 행을 먼저
 *  만들고 실패해도 지우지 않으므로, 필터 없이 세면 결제 실패·취소분까지
 *  "나간 박스"가 된다 — 2026-07-31 수정. 자세한 근거는 아래 카운트 지점 주석.)
 *
 * ⚠️ **subscription-charge 다음에 돌아야 한다** (charge=KST 09:10 / 이 크론=KST 10:10).
 * 같은 시각이면 3번째 박스의 order 를 못 보고 한 주기를 통째로 미룬다.
 * (2026-07-30 둘을 함께 옮겼다 — 1시간 간격과 순서는 그대로 유지.)
 *
 * # 사장님 규칙 (2026-07-17)
 *  1. **구독 중인 사람에게만 제안** — 이전엔 구독 확인이 아예 없어서 구독도
 *     카드도 없는 사람에게 "다음 박스 확인이 필요해요" 를 보냈다. 판정은 정본
 *     헬퍼 `subscriptionState()` 로만(status 컬럼 직접 비교는 '유령 활성'을 못 거름).
 *     ⚠️ 게이트는 MAX_PER_RUN 슬라이스 **전에** — 뒤에 두면 비구독 강아지가
 *     슬롯을 차지해 진짜 구독자가 조용히 밀린다.
 *  2. **변경될 이유가 없으면 냅둔다** — diff 가 meaningful/forced 둘 다 아니면
 *     푸시·이메일을 보내지 않는다(이전엔 변화 0에도 매 cycle "준비됐어요" 발송).
 *     처방 row 자체는 계속 insert — cycle 카운터·체크인·이력이 거기 묶여 있다.
 *     침묵시키는 건 **바깥으로 나가는 알림**뿐.
 *  3. **주기 = 박스 3개마다** (= 4주). 사장님이 처음 말한 "3주(21일)" 는 admin
 *     조정이 없다는 전제의 어림값이었고, 확인 결과 21일이면 **4주차 종합 체크인이
 *     영영 발생하지 않아**(체크인은 적용 후 14일·28일에 물려 있고 종합 만족도는
 *     4주차에서만 수집) 알고리즘이 반쪽이 된다 → 3개(4주)로 확정.
 *     보호자 체감: 1·2·3번째 박스는 같은 화식 → 3번째 박스 즈음 "바꾸실래요?" →
 *     승인하면 4번째 박스부터 새 화식.
 *
 * # 흐름
 * 1) 만료된 cycle 식별 → **구독 active 만 남김** (배치 100건 / run)
 * 2) 각 강아지에 대해:
 *    - 가장 최신 survey + analysis (영양 input)
 *    - 현재 cycle 의 checkins (week_2 / week_4)
 *    - [칼로리 v2 M10 3b] 이번 cycle 중 재측정 조정(reweighs)이 있으면
 *      다음 cycle 기준 kcal 을 조정값(new_der)으로 — ±10% 변화는
 *      diffFormulas KCAL_DELTA(10%)에 걸려 pending_approval → 보호자 승인
 *      후에만 청구 반영 (자동 청구 변경 없음 보장)
 *    - decideNextBox 호출
 *    - 새 dog_formulas row insert (cycle_number + 1)
 * 3) 푸시 알림 / 이메일 발송은 별개 cron 이 dog_formulas 새 row 감지해 처리.
 *
 * # 가드레일
 * - MAX_PER_RUN = 100 (대량 큐 폭주 방지, 다음 cron 에서 계속)
 * - 각 강아지 처리 사이 50ms (DB 부하 분산)
 * - 한 강아지 실패해도 나머지 진행 (best-effort)
 *
 * # 보안
 * CRON_SECRET bearer.
 */

const MAX_PER_RUN = 100

/**
 * 사이클 상수는 전부 정본 `lib/personalization/cycle` 에서 온다 — 재제안 주기·
 * 체크인 시점·커버 기간·후보 게이트가 서로 물려 있어 한 곳에 있어야 조용히
 * 갈라지지 않는다 (근거·모델 설명은 그 파일 docstring 참조).
 */

function todayKstIsoDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('personalization-progression', async () => {
    const supabase = createAdminClient()

    // kill switch — 문제 생기면 admin 에서 OFF (automation_settings). 행 없으면 ON.
    // 재제안 전체를 멈춘다: 새 처방 생성·승인 요청·알림 전부. 이미 적용된 처방은 그대로.
    const settings = await getAutomationSettings(supabase)
    if (!settings.represcriptionEnabled) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'REPRESCRIPTION_DISABLED' })
    }

    const today = todayKstIsoDate()
    const prefilterBefore = addDaysIso(today, -MIN_DAYS_BEFORE_DUE)

  // 1) 후보 = "박스를 3개쯤 받았을 만큼 오래된" 최신 처방. 여기선 **날짜로 대충
  //    자르기만** 하고(쿼리 바운딩), 만기 판정은 아래에서 **실제 배송 회차**로 한다.
  //    박스가 2주마다 나가므로 3개는 최소 28일 — 21일로 자르면 진짜 만기를 놓칠 일이
  //    없으면서(보수적) 후보 수가 묶인다.
  //    dog 별 max(cycle_number) 만 봐야 옛 cycle 까지 진행시키지 않는다.
  type FormulaRow = {
    id: string
    dog_id: string
    user_id: string
    cycle_number: number
    formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
    transition_strategy: Formula['transitionStrategy']
    daily_kcal: number
    daily_grams: number
    algorithm_version: string
    user_adjusted: boolean
    reasoning: Formula['reasoning']
    applied_from: string | null
    applied_until: string | null
    created_at: string
  }

  const { data: candidates, error: fetchErr } = await supabase
    .from('dog_formulas')
    .select(
      'id, dog_id, user_id, cycle_number, formula, transition_strategy, ' +
        'daily_kcal, daily_grams, algorithm_version, user_adjusted, reasoning, ' +
        'applied_from, applied_until, created_at',
    )
    // 적용 시작(applied_from)이 21일 이전 — cycle 1 은 applied_from 이 null 이라
    // created_at 으로 본다. (승인 대기 중인 row 도 applied_from=null 이지만,
    // 아래 nextExists 가드가 같은 dog 의 중복 진행을 막는다.)
    .or(
      `applied_from.lte.${prefilterBefore},and(applied_from.is.null,created_at.lt.${prefilterBefore}T00:00:00Z)`,
    )
    // ★여기만 cycle_number 정렬을 유지한다 (2026-07-30 감사 예외).
    //   다른 곳(청구·피킹·홈·강아지 상세)은 created_at 으로 바꿨다 — 회차 번호가
    //   큰 것이 최신이 아니어서(실측: cycle 2 가 cycle 1 보다 5일 먼저 생성) 서로
    //   다른 처방을 가리켰기 때문이다.
    //   그런데 이 라우트는 아래에서 **`cur.cycle_number + 1` 로 다음 회차 번호를
    //   만든다**(:266, :572). created_at 으로 고르면 cycle 1 을 집고 next=2 가 되어
    //   이미 있는 cycle 2 와 **번호가 충돌**한다. 그래서 번호 산술의 기준은 회차여야
    //   한다. 근본 해결은 회차 번호가 시간순이 되도록 데이터를 정리하는 것 — 후속.
    .order('cycle_number', { ascending: false })
    .limit(MAX_PER_RUN * 3) // dedup 위해 여유롭게

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  // dog 별 max cycle 만 남김.
  const latestByDog = new Map<string, FormulaRow>()
  for (const row of (candidates ?? []) as unknown as FormulaRow[]) {
    const existing = latestByDog.get(row.dog_id)
    if (!existing || row.cycle_number > existing.cycle_number) {
      latestByDog.set(row.dog_id, row)
    }
  }

  // ── 구독 게이트 (사장님 2026-07-17: "구독을 진행 중인 사람한테만 제안해") ──
  //
  // 이전엔 구독 확인이 **아예 없어서**, 구독도 안 하고 카드도 없는 사람에게까지
  // 다음 박스 처방을 만들고 "확인이 필요해요" 푸시를 보냈다(살 수도 없는 사람에게).
  //
  // ⚠️ MAX_PER_RUN **슬라이스 전에** 거른다. 뒤에서 거르면 비구독 강아지가
  //    100개 슬롯을 차지해 진짜 구독자가 밀려난다(조용한 미처리).
  //
  // 상태 판정은 정본 헬퍼 `subscriptionState` 만 사용 — status 컬럼 직접 비교
  // 금지(카드 미등록 '유령 활성' 을 못 걸러낸다. lib/subscription-state 참조).
  const allDogIds = Array.from(latestByDog.keys())
  const activeDogIds = new Set<string>()
  /** dog_id → 구독 정보 (배송 회차 카운트 + 금액 재산정용). active 구독만. */
  const billingByDog = new Map<
    string,
    { subId: string; freshRatio: number | null; currentTotal: number }
  >()
  if (allDogIds.length > 0) {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select(
        'id, dog_id, status, billing_key, next_delivery_date, ' +
          'failed_charge_count, requires_billing_key_renewal, ' +
          'fresh_ratio, total_amount',
      )
      .in('dog_id', allDogIds)
    for (const s of (subs ?? []) as unknown as Array<
      SubLike & {
        id: string
        dog_id: string | null
        fresh_ratio: number | null
        total_amount: number
      }
    >) {
      if (s.dog_id && subscriptionState(s) === 'active') {
        activeDogIds.add(s.dog_id)
        billingByDog.set(s.dog_id, {
          subId: s.id,
          freshRatio: s.fresh_ratio,
          currentTotal: s.total_amount,
        })
      }
    }
  }
  const subscribedDogIds = allDogIds.filter((id) => activeDogIds.has(id))
  const skippedNoSubscription = allDogIds.length - subscribedDogIds.length

  // ── 만기 판정 = **배송 회차** (사장님 2026-07-17: "박스 3개마다") ──
  //
  // 이 처방이 적용된 뒤 실제로 나간 박스를 센다. orders.subscription_id +
  // created_at 으로 세므로 **DB 마이그레이션이 필요 없다**.
  //
  // ⚠️ 예전 주석은 "결제가 성공해야 orders row 가 생기므로 실제로 나간 박스와
  //    일치한다" 고 적혀 있었는데 **정반대였다**(2026-07-31 수정). 청구 크론은
  //    토스를 긁기 **전에** `order_status:'pending' / payment_status:'pending'`
  //    으로 행을 먼저 만들고(subscription-charge :504), 결제가 실패하면 그 행을
  //    지우지 않고 `cancelled/failed` 로 **표시만** 한다(:914). 고객 셀프 취소·
  //    order-expire 크론도 마찬가지로 행을 남긴다.
  //    → 필터가 없으면 **카드가 세 번 거절당한 강아지도 "박스 3개 먹었다"** 가
  //      되어 새 처방을 제안한다. 그 제안이 금액을 바꾸면 동의 모달까지 뜬다 —
  //      한 박스도 못 받은 사람에게.
  //    저장소의 다른 "받은 주문" 집계는 전부 payment_status='paid' 로 거른다
  //    (lib/feeding-outcomes · analysis/structured · daily-briefing). 여기만
  //    빠져 있었다.
  //
  // ⚠️ 그래서 이 크론은 **subscription-charge 다음에** 돌아야 한다. 같은 시각이면
  //    3번째 박스의 order 를 못 보고 지나쳐 한 주기를 통째로 미룬다(조용한 지연).
  //    → vercel.json 에서 charge=KST 09:10 / 이 크론=KST 10:10 로 분리했다.
  const dogIds = subscribedDogIds.slice(0, MAX_PER_RUN)
  const targets: FormulaRow[] = []
  let notEnoughBoxes = 0
  // 박스 수를 못 센 건(조회 실패) 별도로 센다 — 0박스와 섞으면 조용한 정지가 된다.
  let countFailed = 0
  for (const dogId of dogIds) {
    const cur = latestByDog.get(dogId)!
    const billing = billingByDog.get(dogId)
    if (!billing) continue

    // 이 처방이 적용된 시점 — cycle 1 은 applied_from 이 null 이라 created_at.
    const since = cur.applied_from
      ? `${cur.applied_from}T00:00:00+09:00`
      : cur.created_at
    const { count: boxesShipped, error: boxesErr } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_id', billing.subId)
      .gte('created_at', since)
      // 결제가 실제로 된 것만. 부분환불은 박스가 나간 뒤 일부를 돌려준 것이라
      // 센다. 전액환불('refunded')은 박스를 회수·취소한 경우라 빼는 쪽이 안전하다.
      .in('payment_status', ['paid', 'partially_refunded'])
      // paid 인데 뒤늦게 취소·만료된 것도 뺀다(이중 안전망).
      .not('order_status', 'in', '("cancelled","expired")')

    /**
     * ★ 조회 실패를 0박스로 읽지 않는다 (규칙1).
     *
     * `count ?? 0` 이면 실패가 "아직 박스가 모자람"이 되어 **영원히 조용히
     * 건너뛴다** — 크론은 매일 성공으로 집계되는데 그 강아지만 재제안이 멈춘다.
     * 셀 수 없으면 이번 회차는 건드리지 않고 사람이 볼 수 있게 올린다.
     */
    if (boxesErr) {
      captureBusinessEvent('error', 'personalization.progression.count_failed', {
        dogId,
        subscriptionId: billing.subId,
        dbError: boxesErr.message,
      })
      countFailed += 1
      continue
    }

    if (!isCycleDue(boxesShipped ?? 0)) {
      notEnoughBoxes += 1
      continue
    }

    // 다음 cycle 이 이미 존재하는 강아지 제외 — race / 수동 진행 방지.
    const { data: nextExists } = await supabase
      .from('dog_formulas')
      .select('id')
      .eq('dog_id', dogId)
      .eq('cycle_number', cur.cycle_number + 1)
      .maybeSingle()
    if (!nextExists) targets.push(cur)
  }

  // admin override — 모든 강아지에 동일 (한 batch). 한 번만 fetch.
  const [{ data: foodLineRows }, { data: breedRows }] = await Promise.all([
    supabase
      .from('algorithm_food_lines')
      .select(
        'line, kcal_per_100g, protein_pct_dm, fat_pct_dm, calcium_pct_dm, ' +
          'phosphorus_pct_dm, sodium_pct_dm, omega3_pct_dm, omega6_pct_dm, ' +
          'vitamin_d_iu_per_100g_dm, subtitle_override, benefit_override',
      ),
    supabase
      .from('algorithm_breed_predispose')
      .select(
        'breed_key, korean_label, breed_keywords, predispose_conditions, cautions',
      )
      .eq('enabled', true),
  ])
  const breedPredisposeMap = ((breedRows ?? []) as unknown as Array<{
    breed_key: string
    korean_label: string
    breed_keywords: string[]
    predispose_conditions: string[]
    cautions: string[]
  }>).map((r) => ({
    breedKey: r.breed_key,
    koreanLabel: r.korean_label,
    breedKeywords: r.breed_keywords,
    predisposeConditions: r.predispose_conditions,
    cautions: r.cautions,
  }))
  const foodLineMetaOverride: AlgorithmInput['foodLineMetaOverride'] = {}
  // typegen 미적용 — unknown 캐스팅.
  for (const r of ((foodLineRows ?? []) as unknown) as Array<{
    line: 'basic' | 'weight' | 'skin' | 'premium' | 'joint'
    kcal_per_100g: number
    protein_pct_dm: number
    fat_pct_dm: number
    calcium_pct_dm: number | null
    phosphorus_pct_dm: number | null
    sodium_pct_dm: number | null
    omega3_pct_dm: number | null
    omega6_pct_dm: number | null
    vitamin_d_iu_per_100g_dm: number | null
    subtitle_override: string | null
    benefit_override: string | null
  }>) {
    foodLineMetaOverride[r.line] = {
      kcalPer100g: r.kcal_per_100g,
      proteinPctDM: r.protein_pct_dm,
      fatPctDM: r.fat_pct_dm,
      calciumPctDM: r.calcium_pct_dm,
      phosphorusPctDM: r.phosphorus_pct_dm,
      sodiumPctDM: r.sodium_pct_dm,
      omega3PctDM: r.omega3_pct_dm,
      omega6PctDM: r.omega6_pct_dm,
      vitaminDIuPer100gDM: r.vitamin_d_iu_per_100g_dm,
      subtitle: r.subtitle_override,
      benefit: r.benefit_override,
    }
  }

  // 가용성 — 활성 제품 있는 라인/토퍼 (전 강아지 공통, skuMap 게이트 입력).
  const boxSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  // 가용성 게이트용 slug + 금액 재산정용 가격 필드를 한 번에 가져온다.
  // (금액은 `boxPricing` 정본이 계산 — 주문 화면·승인 화면과 같은 함수.)
  const { data: activeProd } = await supabase
    .from('products')
    .select('slug, price, sale_price, stock, is_subscribable, nutrition_facts')
    .eq('is_active', true)
    .in('slug', boxSlugs)
  const activeProducts: Record<string, BoxProduct> = {}
  for (const p of ((activeProd ?? []) as unknown) as BoxProduct[]) {
    activeProducts[p.slug] = p
  }
  const activeSlugs = Object.keys(activeProducts)
  const availableLines = deriveAvailableLines(activeSlugs)
  const availableToppers = deriveAvailableToppers(activeSlugs)

  let succeeded = 0
  let failed = 0
  let skipped = 0
  /** 변화가 없어 알림을 보내지 않은 cycle 수 (처방 row 는 생성됨). */
  let silentNoChange = 0

  for (const cur of targets) {
    try {
      // 강아지 + 최신 survey + analysis + 현재 cycle checkins 조회.
      const [
        { data: dog },
        { data: survey },
        { data: analysis },
        { data: checkinsRaw },
        { data: reweighRow },
      ] = await Promise.all([
        supabase
          .from('dogs')
          .select(
            'id, name, weight, age_value, age_unit, neutered, activity_level, breed',
          )
          .eq('id', cur.dog_id)
          .maybeSingle(),
        supabase
          .from('surveys')
          .select(
            'answers, chronic_conditions, pregnancy_status, care_goal, ' +
              'home_cooking_experience, current_diet_satisfaction, weight_trend_6mo, ' +
              'gi_sensitivity, preferred_proteins, indoor_activity, daily_walk_minutes, ' +
              'pregnancy_week, litter_size, expected_adult_weight_kg, iris_stage',
          )
          .eq('dog_id', cur.dog_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('analyses')
          .select('mer, feed_g')
          .eq('dog_id', cur.dog_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('dog_checkins')
          .select(
            'cycle_number, checkpoint, stool_score, coat_score, ' +
              'appetite_score, overall_satisfaction, responded_at',
          )
          .eq('dog_id', cur.dog_id)
          .eq('cycle_number', cur.cycle_number),
        // 칼로리 v2 M10 3b — 이번 cycle 기간의 최신 재측정 조정.
        // reweighs 는 신규 테이블이라 generated types 미반영 → cast
        // (refund_order_points 신규 RPC 선례와 동일 패턴).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('reweighs')
          .select('new_der, weight_delta_pct, created_at')
          .eq('dog_id', cur.dog_id)
          .gt('created_at', cur.created_at)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle() as Promise<{ data: { new_der: number } | null }>,
      ])

      if (!dog || !survey || !analysis) {
        skipped += 1
        continue
      }

      const dogTyped = dog as unknown as {
        id: string
        name: string
        weight: number
        age_value: number
        age_unit: 'years' | 'months'
        neutered: boolean
        activity_level: 'low' | 'medium' | 'high'
        breed?: string | null
      }
      const surveyTyped = survey as unknown as {
        answers: {
          bcsExact?: number
          allergies?: string[]
          snackFreq?: string
          diagnosedSeverity?: Record<string, 'mild' | 'moderate' | 'severe'>
        }
        chronic_conditions: string[] | null
        pregnancy_status: string | null
        care_goal: string | null
        home_cooking_experience: string | null
        current_diet_satisfaction: number | null
        weight_trend_6mo: string | null
        gi_sensitivity: string | null
        preferred_proteins: string[] | null
        indoor_activity: string | null
        daily_walk_minutes: number | null
        // v1.3 임상 정밀화 (마이그레이션 20260504000000)
        pregnancy_week: number | null
        litter_size: number | null
        expected_adult_weight_kg: number | null
        iris_stage: number | null
      }
      const analysisTyped = analysis as unknown as {
        mer: number
        feed_g: number
      }

      // 칼로리 v2 M10 3b — 재측정 조정이 있으면 다음 cycle 기준 kcal 을
      // 조정값으로 (grams 는 비례 스케일). ±10% 변화는 diffFormulas
      // KCAL_DELTA(10%)에 걸려 pending_approval → 승인 후에만 청구 반영.
      const reweighDer =
        (reweighRow as { new_der: number } | null)?.new_der ?? 0
      const baseKcal = analysisTyped.mer
      const useReweigh = reweighDer > 0 && baseKcal > 0
      const effectiveKcal = useReweigh ? reweighDer : baseKcal
      const effectiveGrams = useReweigh
        ? Math.round(analysisTyped.feed_g * (reweighDer / baseKcal))
        : analysisTyped.feed_g

      const ageMonths =
        dogTyped.age_unit === 'years'
          ? dogTyped.age_value * 12
          : dogTyped.age_value

      const surveyInput: AlgorithmInput = {
        dogId: dogTyped.id,
        dogName: dogTyped.name,
        ageMonths,
        weightKg: dogTyped.weight,
        neutered: dogTyped.neutered,
        activityLevel: dogTyped.activity_level,
        bcs:
          typeof surveyTyped.answers?.bcsExact === 'number' &&
          surveyTyped.answers.bcsExact >= 1 &&
          surveyTyped.answers.bcsExact <= 9
            ? (surveyTyped.answers.bcsExact as AlgorithmInput['bcs'])
            : null,
        allergies: Array.isArray(surveyTyped.answers?.allergies)
          ? surveyTyped.answers.allergies
          : [],
        chronicConditions: Array.isArray(surveyTyped.chronic_conditions)
          ? surveyTyped.chronic_conditions
          : [],
        // [H1] 임신/수유 게이트 — 중성화견은 임신 불가 (nutrition.ts 일관).
        pregnancy: dogTyped.neutered
          ? null
          : ((surveyTyped.pregnancy_status as AlgorithmInput['pregnancy']) ??
            null),
        careGoal: (surveyTyped.care_goal as AlgorithmInput['careGoal']) ?? null,
        homeCookingExperience:
          (surveyTyped.home_cooking_experience as AlgorithmInput['homeCookingExperience']) ??
          null,
        currentDietSatisfaction:
          (surveyTyped.current_diet_satisfaction as AlgorithmInput['currentDietSatisfaction']) ??
          null,
        weightTrend6mo:
          (surveyTyped.weight_trend_6mo as AlgorithmInput['weightTrend6mo']) ??
          null,
        giSensitivity:
          (surveyTyped.gi_sensitivity as AlgorithmInput['giSensitivity']) ??
          null,
        preferredProteins: Array.isArray(surveyTyped.preferred_proteins)
          ? surveyTyped.preferred_proteins
          : [],
        indoorActivity:
          (surveyTyped.indoor_activity as AlgorithmInput['indoorActivity']) ??
          null,
        dailyWalkMinutes: surveyTyped.daily_walk_minutes ?? null,
        pregnancyWeek: surveyTyped.pregnancy_week ?? null,
        litterSize: surveyTyped.litter_size ?? null,
        expectedAdultWeightKg: surveyTyped.expected_adult_weight_kg ?? null,
        irisStage:
          (surveyTyped.iris_stage as AlgorithmInput['irisStage']) ?? null,
        breed: dogTyped.breed ?? null,
        breedPredisposeMap,
        foodLineMetaOverride: Object.keys(foodLineMetaOverride).length
          ? foodLineMetaOverride
          : undefined,
        dailyKcal: effectiveKcal,
        dailyGrams: effectiveGrams,
        availableLines,
        availableToppers,
        treatReductionPct: treatCalorieFraction(surveyTyped.answers?.snackFreq),
        diagnosedSeverity: surveyTyped.answers?.diagnosedSeverity,
      }

      const checkins: Checkin[] = ((checkinsRaw ?? []) as unknown as Array<{
        cycle_number: number
        checkpoint: 'week_2' | 'week_4'
        stool_score: number | null
        coat_score: number | null
        appetite_score: number | null
        overall_satisfaction: number | null
        responded_at: string
      }>).map((c) => ({
        cycleNumber: c.cycle_number,
        checkpoint: c.checkpoint,
        stoolScore: c.stool_score as Checkin['stoolScore'],
        coatScore: c.coat_score as Checkin['coatScore'],
        appetiteScore: c.appetite_score as Checkin['appetiteScore'],
        overallSatisfaction:
          c.overall_satisfaction as Checkin['overallSatisfaction'],
        respondedAt: c.responded_at,
      }))

      const previousFormula: Formula = {
        lineRatios: cur.formula.lineRatios,
        toppers: cur.formula.toppers,
        reasoning: cur.reasoning,
        transitionStrategy: cur.transition_strategy,
        dailyKcal: cur.daily_kcal,
        dailyGrams: cur.daily_grams,
        cycleNumber: cur.cycle_number,
        algorithmVersion: cur.algorithm_version,
        userAdjusted: cur.user_adjusted,
      }

      const next = decideNextBox({
        previousFormula,
        checkins,
        surveyInput,
        cycleNumber: cur.cycle_number + 1,
      })

      // ── cycle 2+ 안전 게이트 (계획 §F-2, 2026-07-25) ──────────────────
      // compute route 의 5.5a·5.5c 가 cycle 1 에만 있어서 cycle 2+ 는 무방비였다.
      // 여기서 대칭으로 맞춘다.
      //
      // (1) 판매중 제품으로 게이트 — decideNextBox 결과에 연어(deferred·미판매)가
      //     남으면 저장·표시되는 처방과 실제 박스가 어긋난다(cycle 1 에서 겪은
      //     "분석은 연어 100%, 박스는 오리" 버그). 저장 전에 한 번 돌린다.
      //     activeSlugs 가 비어 있으면(제품 조회 실패 등) 게이트가 "판매중인 게
      //     하나도 없다"로 읽어 처방을 통째로 뭉갤 수 있다. 무인 크론이라 그
      //     경우엔 건드리지 않고 넘어가는 편이 안전하다.
      if (activeSlugs.length > 0) {
        const gated = gateAvailability(next.lineRatios, next.toppers, {
          availableLines: deriveAvailableLines(activeSlugs),
          availableToppers: deriveAvailableToppers(activeSlugs),
          reasoning: next.reasoning,
        })
        next.lineRatios = gated.lineRatios
        next.toppers = gated.toppers
      }

      // (2) 알레르기 누출 감지 — nextBox.ts 는 차단 라인을 0% 로 만들지만,
      //     **전부 0이 되면 정규화 fallback 이 차단된 라인 하나를 100% 로 강제**
      //     한다(nextBox.ts 271줄 주석에 명시). cycle 1 에서 퍼저가 잡은 것과
      //     같은 경로다. 원인 불문 "출고 라인의 차단성분 ∩ 선언 알레르기" 로 판정.
      const shippedAllergenLeak = ALL_LINES.some(
        (l) =>
          (next.lineRatios[l] ?? 0) > 0 &&
          SKU_MODEL[LEGACY_LINE_TO_PROTEIN[l]].blockingAllergies.some((b) =>
            surveyInput.allergies.includes(b),
          ),
      )
      if (shippedAllergenLeak) {
        // ★최종감사 #5 (2026-07-29): 아래 푸시가 "결제는 잠시 멈춰둘게요"라고
        //   **약속**하는데, 실제로 멈추는 코드가 없었다 — 다음 화요일에 이전
        //   처방(모든 라인 차단 케이스에선 그것도 알레르겐 포함)이 그대로
        //   결제·배송됐다. 구독을 일시정지해 약속과 행동을 일치시킨다.
        //   청구 크론은 status='active' 만 집으므로 pause = 결제 정지.
        //   (해지가 아니라 정지 — 상담 후 사장님/고객이 언제든 재개 가능.
        //    next_delivery_date 는 남겨둔다: 재개 시 기준점이 되고, 고객 홈
        //    구독 카드는 paused 상태를 먼저 읽어 배송일을 표시하지 않는다.)
        const billingForPause = billingByDog.get(cur.dog_id)
        if (billingForPause) {
          const { error: pauseErr } = await supabase
            .from('subscriptions')
            .update({ status: 'paused' })
            .eq('id', billingForPause.subId)
            .eq('status', 'active')
          if (pauseErr) {
            captureBusinessEvent(
              'error',
              'personalization.leak_pause_failed',
              {
                dogId: cur.dog_id,
                subscriptionId: billingForPause.subId,
                dbError: pauseErr.message,
              },
            )
          }
        }
        // 조용히 넘어가면 안 되는 종류의 사건 — 알림부터 띄운다.
        captureBusinessEvent(
          'error',
          'personalization.next_box_allergen_leak',
          {
            dogId: cur.dog_id,
            userId: cur.user_id,
            cycleNumber: next.cycleNumber,
            allergies: surveyInput.allergies.join(','),
            lineRatios: JSON.stringify(next.lineRatios),
          },
        )
      }

      // Option A — 의미 있는 변화 vs 미세 조정 판정.
      // 미세 조정 → auto_applied 즉시 적용 (기존 동작).
      // 의미 있는 변화 → pending_approval, push 별도 카피, 결제 안 됨.
      // 강제 변화 (알레르기 / 만성질환 추가) → auto_applied 강제, "변경됨" push.
      // 금액 변동 판정 — 처방의 '모양' 임계값(비율 10%·토퍼 5%·kcal 10%)을
      // 밑돌아도 청구액은 바뀔 수 있다(예: kcal +9% → 1팩 170g→190g).
      // 그 경로로 동의 없이 더 청구되면 §13의2 위반이라 금액은 별도로 본다.
      //
      // 비교 기준 = **지금 실제로 내는 금액(subscriptions.total_amount)** vs
      // 새 처방의 금액. 승인 화면이 보여주는 쌍과 정확히 같아야 "화면엔 금액이
      // 바뀐다는데 승인 요청은 안 온다" 같은 어긋남이 안 생긴다.
      const billing = billingByDog.get(cur.dog_id)
      const price =
        billing &&
        billing.freshRatio != null &&
        billing.freshRatio > 0 &&
        billing.currentTotal > 0 &&
        activeSlugs.length > 0
          ? (() => {
              const nextTotal = priceForFormula({
                formula: next,
                freshRatio: billing.freshRatio,
                products: activeProducts,
              }).total
              return nextTotal > 0
                ? { prevTotal: billing.currentTotal, nextTotal }
                : undefined
            })()
          : undefined

      const diff = diffFormulas(previousFormula, next, { price })
      // 강제 변경(알레르기·건강)도 **금액이 오르면** 동의 게이트로 — 자동적용 X.
      // (사장님 2026-07-23: "동의받고 결제 / 거부하면 이전 유지". §13의2 정합.)
      // 금액 변동 없는 강제(무료 안전 조정)만 종전대로 자동적용.
      // 알레르기 누출이면 **절대 자동 적용하지 않는다** — 오늘까지는 그대로
      // auto_applied 로 나가 알레르기 성분이 배송될 수 있었다. 승인 대기로
      // 돌리면 최소한 자동 배송은 멈추고 보호자에게 통지가 간다.
      // ⚠️ 남은 판단(사장님): 모든 라인이 차단된 경우엔 **이전 처방도 안전하지
      //    않다**. 그때 구독을 자동 일시정지할지, 상담 후 수동 처리할지는 운영
      //    정책 결정이라 여기서 임의로 정하지 않았다.
      const requiresApproval =
        shippedAllergenLeak ||
        (diff.meaningful && (!diff.forced || diff.priceChanged))

      // 실제로 바뀐 게 있나 (사장님 2026-07-17: "굳이 레시피나 칼로리가
      // 변경될 이유가 없다면 냅둬"). 이전엔 변화가 0이어도 매 cycle
      // "다음 박스 준비됐어요 🐾" 푸시가 나갔다 — 알림 피로 + nudge 예산 낭비.
      //   · meaningful → 보호자 승인 필요한 변화
      //   · forced     → 알레르기·만성질환 등 강제 변경(승인 없이 적용하되 반드시 통지)
      //   · 둘 다 아님 → 임계값 미만 미세 조정 = 사실상 그대로 → **조용히**
      // row 는 그대로 insert 한다(cycle 카운터·체크인·이력이 여기 묶여 있음).
      // 침묵시키는 건 **바깥으로 나가는 알림**뿐.
      const changed = diff.meaningful || diff.forced

      // applied_until = 이 처방이 **먹이는 기간의 끝**. 재제안 트리거와는 이제
      // 별개다(트리거는 배송 회차). 박스 3개 × 14일치 = 42일 — 3번째 박스를 다
      // 먹을 때까지 커버해야 picking(applied_from≤날짜≤applied_until)이 그 사이
      // 배송에서 처방을 못 찾는 **공백**이 안 생긴다.
      // (이전 CYCLE_DAYS=30 은 3번째 박스가 나가는 날[28일]에서 이틀 뒤 끝나
      //  승인이 늦으면 그 구간에 활성 처방이 없는 공백이 났다.)
      const appliedFrom = requiresApproval ? null : today
      const appliedUntil = requiresApproval
        ? null
        : addDaysIso(today, CYCLE_COVER_DAYS)
      const approvalStatus = requiresApproval ? 'pending_approval' : 'auto_applied'
      const proposedAt = requiresApproval ? new Date().toISOString() : null
      const approvedAt = requiresApproval ? null : new Date().toISOString()

      const { error: insErr } = await supabase.from('dog_formulas').insert({
        dog_id: cur.dog_id,
        user_id: cur.user_id,
        cycle_number: next.cycleNumber,
        formula: {
          lineRatios: next.lineRatios,
          toppers: next.toppers,
          // cycle 1(compute route)과 같은 필드·같은 의미 — 분석·플랜·주문이
          // 이걸 읽어 결제를 막는다. cycle 2+ 에도 같은 계약을 쓴다.
          ...(shippedAllergenLeak
            ? {
                needsConsultation: true,
                consultationReason:
                  '입력하신 알레르기로 지금 판매하는 레시피가 모두 제외됐어요. 맞춤 상담을 도와드릴게요.',
              }
            : {}),
          // 금액이 바뀌는 제안(몸무게·알레르기·건강 무엇이든) 동의 대기 표식 —
          // 구독페이지 모달·3일 타임아웃이 이걸로 일반(무금액) 승인과 구분한다.
          // forced=알레르기·건강(안전 프레이밍+거부 경고), false=몸무게 등(담백).
          ...(requiresApproval && diff.priceChanged && price
            ? {
                priceChange: {
                  from: price.prevTotal,
                  to: price.nextTotal,
                  forced: diff.forced,
                },
              }
            : {}),
        },
        reasoning: next.reasoning,
        transition_strategy: next.transitionStrategy,
        algorithm_version: next.algorithmVersion,
        user_adjusted: false,
        daily_kcal: next.dailyKcal,
        daily_grams: next.dailyGrams,
        applied_from: appliedFrom,
        applied_until: appliedUntil,
        approval_status: approvalStatus,
        proposed_at: proposedAt,
        approved_at: approvedAt,
      })

      if (insErr) {
        // UNIQUE 충돌 = race (다른 trigger 가 먼저). 정상 skip.
        if ((insErr as unknown as { code?: string }).code === '23505') {
          skipped += 1
        } else {
          failed += 1
          captureBusinessEvent('warning', 'personalization.progression.failed', {
            dogId: cur.dog_id,
            cycleNumber: next.cycleNumber,
            error: insErr.message,
          })
        }
        continue
      }

      succeeded += 1
      captureBusinessEvent('info', 'personalization.progression.succeeded', {
        dogId: cur.dog_id,
        cycleNumber: next.cycleNumber,
      })

      // 금액 변경은 이제 전부 동의 게이트로 간다 — diff.priceChanged 는 항상
      // meaningful(=requiresApproval)을 세운다(diff.ts: 1원이라도 다르면 동의 대상).
      // 예전 '강제=자동적용+통지' 경로(여기서 total_amount 를 미리 갱신하던
      // forcedPriceApplied 블록)는 도달 불가라 제거했다(사장님 2026-07-23).
      // 청구액 갱신은 동의 시 approve API 만 수행 → 동의 없이 청구액이 바뀌는
      // 일이 구조적으로 없다.

      // 변화가 없으면 여기서 끝 — 처방 row 는 남기되 보호자는 안 건드린다.
      // ("굳이 변경될 이유가 없다면 냅둬" — 사장님 2026-07-17)
      if (!changed) {
        silentNoChange += 1
        await new Promise((r) => setTimeout(r, 50))
        continue
      }

      // 보호자에게 푸시 알림 — 흐름 3분기:
      //   pending_approval        → "확인이 필요해요" + approval URL
      //   auto_applied(강제)+금액변동 → ★"금액이 바뀌어요" 강조 + 해지/정지 경로
      //   auto_applied(그 외)      → "준비됐어요" + analysis URL
      //
      // 강제 변경은 승인 없이 금액까지 바뀐다. 그 경우 "준비됐어요 🐾" 로 흘리면
      // 보호자가 청구 변경을 **모르고 지나친다** → 통지-후-해지 모델이 성립 안 함
      // ("취소 안 하면 고객 책임" 은 **알렸을 때만** 성립한다). 그래서 금액을
      // 제목에 박고 본문 첫 문장으로 올린다 (사장님 2026-07-17 "강조멘트").
      const won = (n: number) => n.toLocaleString('ko-KR')

      let pushTitle: string
      let pushBody: string
      let pushUrl: string
      if (shippedAllergenLeak) {
        // ★이 분기가 없으면 아래 일반 승인 문구("이번 박스 구성이 바뀔 수 있어요
        //   — 확인해 주세요")가 나가서, **알레르기가 든 박스를 승인하라고
        //   권하는 꼴**이 된다. 승인 화면이 아니라 분석 화면으로 보낸다 —
        //   거기가 needsConsultation 을 읽어 상담 안내를 띄우는 곳이다.
        //   문구는 브랜드 보이스대로: 처방·전문용어 없이, 사장님이 뭘 할지 명확히.
        pushTitle = `[중요] ${petName(dogTyped.name)} 다음 박스는 상담이 필요해요`
        pushBody =
          '알려주신 알레르기로 지금 준비할 수 있는 레시피가 없어요. 결제는 잠시 멈춰둘게요 — 확인 후 함께 방법을 찾아요.'
        pushUrl = `/dogs/${cur.dog_id}/analysis`
      } else if (requiresApproval && diff.priceChanged && price) {
        // 금액이 바뀌는 제안(몸무게·알레르기·건강) → 구독페이지 동의 모달.
        // 3일 안에 동의/거부, 무반응=거부. 모달은 pending 상태를 감지해 뜬다.
        if (diff.forced) {
          pushTitle = `[중요] ${petName(dogTyped.name)} 다음 박스 확인이 필요해요`
          pushBody = `안전을 위해 레시피를 바꿔야 해서 2주 결제가 ${won(price.prevTotal)} → ${won(price.nextTotal)}원이 돼요. 3일 안에 동의 또는 이전 유지를 골라주세요.`
        } else {
          pushTitle = `${petName(dogTyped.name)} 다음 박스 확인이 필요해요`
          pushBody = `몸무게 변화를 반영하면 2주 결제가 ${won(price.prevTotal)} → ${won(price.nextTotal)}원이 돼요. 3일 안에 동의 또는 이전 유지를 골라주세요.`
        }
        // 푸시는 앱으로 간다 → 앱 전용 정기배송 화면. 이 화면이 금액변경
        // 동의 모달을 띄운다(2026-07-30 신설, 웹 화면에만 있던 게이트를 이관).
        pushUrl = `/mypage/subscriptions`
      } else if (requiresApproval) {
        // 금액 변동 없는 제안 → 기존 승인 화면(/approve) 유지.
        pushTitle = `${petName(dogTyped.name)} 다음 박스 확인이 필요해요`
        pushBody = `이번 박스 구성이 바뀔 수 있어요 — ${recipeName(next)} 제안. 5일 안에 확인해 주세요.`
        pushUrl = `/dogs/${cur.dog_id}/approve?cycle=${next.cycleNumber}`
      } else {
        pushTitle = `${petName(dogTyped.name)} 다음 박스 준비됐어요 🐾`
        pushBody = `이번 박스는 ${recipeName(next)}예요. 자세히 보기 →`
        pushUrl = `/dogs/${cur.dog_id}/analysis`
      }

      // ★최종감사 #32: fire-and-forget 이면 배치 마지막 순번의 푸시가 함수
      //   반환과 경합해 간헐 유실된다(subscription-charge R83-6 과 동일 이유).
      await pushToUser(
        cur.user_id,
        {
          title: pushTitle,
          body: pushBody,
          url: pushUrl,
          tag: `formula-cycle-${cur.dog_id}-${next.cycleNumber}`,
        },
        // 'order' 카테고리 — 정기배송 박스 안내라 order 흐름과 연동.
        { category: 'order' },
      ).catch(() => {
        /* 푸시 실패는 무시 — Sentry 가 push 자체에서 잡음 */
      })

      // 이메일 발송 — push OFF 사용자도 받게. profile 의 email + name 조회.
      // best-effort. agree_email=false 인 사용자는 sendEmail 이 알아서 차단.
      // 단 금액변경 동의 대기(모달 처리)는 아직 확정이 아니라 "준비됐어요"
      // 메일을 보내지 않는다 — 푸시가 "확인 필요"를 이미 전달.
      // 알레르기 누출 건도 메일 제외 — notifyPersonalizationCycle 은 "다음 박스"
      // 안내 템플릿이라 방금 보낸 "상담이 필요해요" 푸시와 정면으로 모순된다.
      if (!(requiresApproval && diff.priceChanged) && !shippedAllergenLeak)
        await (async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', cur.user_id)
            .maybeSingle()
          if (!profile?.email) return
          await notifyPersonalizationCycle({
            email: profile.email,
            recipientName: profile.name ?? '',
            dogName: dogTyped.name,
            dogId: cur.dog_id,
            cycleNumber: next.cycleNumber,
            recipeLabel: recipeName(next),
            reasoningLabels: next.reasoning
              .slice(0, 4)
              .map((r) => r.chipLabel),
          })
        } catch {
          /* 이메일 실패는 cron 흐름 안 막음 */
        }
      })()

      // DB 부하 분산.
      await new Promise((r) => setTimeout(r, 50))
    } catch (err) {
      failed += 1
      captureBusinessEvent('warning', 'personalization.progression.failed', {
        dogId: cur.dog_id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

    return NextResponse.json({
      ok: true,
      today,
      candidates: targets.length,
      succeeded,
      failed,
      skipped,
      /** 구독 중이 아니라 제외된 강아지 수 (사장님 규칙 — 구독자만 제안). */
      skippedNoSubscription,
      /** 아직 박스가 3개 안 나가 만기가 아닌 수 (정상 — 대기 중). */
      notEnoughBoxes,
      countFailed,
      /** 변화가 없어 알림을 보내지 않은 수 (row 는 생성됨). */
      silentNoChange,
    })
  })
}
