import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { nextCycleDateAligned } from '@/lib/shipping-schedule'
import { chargeBillingKey, cancelPayment } from '@/lib/payments/toss'
import { keyMode } from '@/lib/payments/key-mode'
import {
  classifyBillingError,
  describeBillingError,
  chargeRetrySuffix,
  isDefinitiveDecline,
  RETRY_COOLDOWN_MS,
  MAX_FAILED_CHARGES,
} from '@/lib/payments/billing-error-classify'
import { notifySubscriptionChargeFailed, notifyOrderPlaced } from '@/lib/email'
import { pushToUser } from '@/lib/push'
import { traceBusiness, captureBusinessEvent } from '@/lib/sentry/trace'
import { trackCron } from '@/lib/cron-tracking'
// 할인 계산은 lib/payments/auto-discount 하나 — 화면 미리보기가 같은 함수를
// 쓴다(2026-07-30). 크론에만 있던 탓에 화면 금액이 실제 청구액과 달랐다.
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import {
  priceForFormula,
  type BoxProduct,
} from '@/lib/personalization/boxPricing'
import {
  LINE_TO_SLUG as PRICE_LINE_TO_SLUG,
  TOPPER_TO_SLUG as PRICE_TOPPER_TO_SLUG,
} from '@/lib/personalization/skuMap'
import { checkChargeAmount } from '@/lib/payments/charge-amount-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/subscription-charge
 *
 * 매일 오전 (KST 09:10) 실행. 다음 조건의 구독을 자동 결제:
 *   - status = 'active'
 *   - next_delivery_date **≤ 오늘** (KST) — `=` 이 아니다(2026-07-31 주석 정정).
 *     실제 코드는 `.lte(...)` 다. 크론이 하루 걸러도 다음 실행이 **따라잡는다**;
 *     `=` 였다면 놓친 구독은 영영 청구되지 않는다. 아래 "시간대" 절 참조.
 *   - billing_key IS NOT NULL
 *
 * # 멱등은 **두 층**이다 (2026-07-31 주석 정정 — 예전엔 한 층만 적혀 있었다)
 *   ① 같은 날 두 번: `subscription_charges` 에 `(subscription_id, scheduled_for=today)`
 *      로 insert. UNIQUE 충돌이면 skip → 한 날에 두 번 안 긁는다.
 *   ② 날짜를 건너뛴 재시도: 토스 `idempotencyKey` 가 **주기(next_delivery_date)
 *      기준**이다 — 실행일이 아니다. ①의 키가 `today` 라서 다음 날 재시도는
 *      우리 쪽 UNIQUE 를 그냥 통과한다. 그때 이중청구를 막는 건 토스 키다.
 *   ⚠️ 그러므로 ①의 `scheduled_for` 를 next_delivery_date 로 "통일" 하면 안 된다 —
 *      확정 거절 뒤 재시도 경로(:r{today} 접미사)가 같이 막힌다. 자세한 근거는
 *      idempotencyKey 를 만드는 지점의 주석에.
 *
 * 처리 흐름:
 *   1) 대상 구독 select
 *   2) 각 구독에 대해 charge attempt:
 *      a. subscription_charges row insert (status='pending', UNIQUE 충돌 시 skip)
 *      b. orders row insert (`order_status='pending'` · `payment_status='pending'`)
 *         ★ **청구보다 먼저** 만들어지고, 실패해도 지우지 않는다 — `cancelled` /
 *           `failed` 로 표시만 한다(e). 즉 **orders 행이 있다고 돈이 오간 것이
 *           아니다.** 재제안 크론이 이걸 반대로 알고("결제가 성공해야 row 가
 *           생긴다") 상태 필터 없이 세는 바람에, 카드가 세 번 거절당한 강아지가
 *           "박스 3개 먹었다"로 집계돼 새 처방을 제안받았다(2026-07-31 수정).
 *           orders 를 세는 코드는 반드시 payment_status 로 거른다 — 규칙17.
 *      c. Toss billingKey 청구
 *      d. 성공 → orders/charge update + subscriptions.next_delivery_date 갱신
 *      e. 실패 → failed_charge_count += 1, MAX_FAILED(3) 누적 시 status='paused'
 *         (orders 는 `order_status='cancelled'` · `payment_status='failed'` 로 표시)
 *   3) 결과 집계 반환
 *
 * 보안: CRON_SECRET bearer.
 *
 * # 시간대 — 왜 새벽이 아니라 업무 시작 시각인가 (2026-07-30 이동)
 * vercel.json cron 은 UTC. KST 09:10 = UTC 00:10 → "10 0 * * *"
 * (이전: KST 04:00 = "0 19 * * *")
 *
 * 새벽 4시를 쓸 이유가 없었다. 청구는 우리가 부르는 시점에 토스가 처리하므로
 * (빌링키는 가맹점이 호출하는 방식 — 토스에 예약 기능이 없다) 시각은 순수하게
 * **우리 운영 편의**의 문제다. 새벽에 두면 두 가지가 나빴다:
 *  · 실패했을 때 아무도 안 깨어 있다. 카드 한도 초과·해지 카드는 사람이 손을
 *    써야 하는데, 발견이 5~6시간 늦어지고 그만큼 화요일 발송에 가까워진다.
 *  · 고객도 새벽에 결제 실패 알림을 받는다. 조용시간(기본 22–08)을 켠 고객에게는
 *    **아예 안 나갔다** — 돈은 빠지고 통지는 없는 조합.
 *
 * 09:10 은 조용시간 밖이고(08시 종료), 포장 시작 전이며, 실패를 당일 안에 처리할
 * 시간이 남는다. 대상 조회는 `lte(next_delivery_date, today)` 라 놓친 건은 다음
 * 실행에서 따라잡는다 — 시각 이동으로 건너뛰는 구독은 없다.
 *
 * # 가드레일
 * - 한 번에 100건 까지만 처리 (대량 큐 폭주 방지). 다음 cron 에서 계속.
 * - 결제 호출 사이에 100ms 딜레이 (Toss QPS 한도 보호).
 */

type SubscriptionRow = {
  id: string
  user_id: string
  next_delivery_date: string
  total_amount: number
  billing_key: string
  billing_customer_key: string
  failed_charge_count: number
  // audit launch-fix: subscriptions 테이블에 recipient_name/zip/address/
  // address_detail 컬럼이 없음 (recipient_phone 만 존재). 신청 시 snapshot
  // 안 잡혀 있어 cron 이 매번 select 실패하던 버그 → 그 컬럼들 제거.
  // 주소는 addresses.is_default=true row 또는 profiles.* fallback 으로
  // 매 결제 시점에 가져옴.
  recipient_phone: string | null
  interval_weeks: number
  coverage_weeks: number | null
  dog_id: string | null
  total_deliveries: number
  next_retry_at: string | null
  last_failed_charge_code: string | null
  fresh_ratio: number | null
  requires_billing_key_renewal: boolean | null
}

type ShippingTarget = {
  name: string
  phone: string
  zip: string
  address: string
  addressDetail: string | null
}

/**
 * 정기배송 결제 시점의 배송 주소 결정.
 *
 * 우선순위:
 *   1) addresses 테이블의 is_default=true row (사용자가 명시 선택)
 *   2) profiles 테이블 (legacy / 가입 시 기본값)
 *   3) 둘 다 없거나 필수 값 누락이면 null → cron 이 그 결제 skip + 알림
 *
 * audit launch-fix: 정기배송 신청 시 subscriptions 에 주소 snapshot 안
 * 잡힘. 출시 후 첫 정기구독 가입자 결제 100% 실패 사태를 막기 위해 매
 * 결제 시점에 lookup. 장기 개선: subscribe 라우트가 신청 시 address_id
 * 를 subscriptions 에 저장하게 (이사 등으로 자동 따라가는 문제 방지).
 */
/**
 * @returns 배송지 · `null`(진짜 미등록) · `'lookup-failed'`(조회 자체가 실패).
 *   셋을 구분하는 것이 핵심이다 — 미등록과 조회 실패는 고객에게 할 말도,
 *   사장님이 볼 곳도, 재시도 여부도 완전히 다르다.
 */
async function resolveShippingTarget(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<ShippingTarget | null | 'lookup-failed'> {
  const { data: addr, error: addrErr } = await supabase
    .from('addresses')
    .select('recipient_name, phone, zip, address, address_detail')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()
  // ★조회 실패를 "주소 없음" 으로 읽지 않는다(AGENTS 규칙1, 2026-08-02 검수).
  //   예전엔 error 를 안 꺼내서 DB 가 흔들리면 addr 이 null 이 됐고, 호출부는
  //   그걸 배송지 미등록으로 처리해 **고객에게 "배송지가 등록되지 않아 결제를
  //   진행할 수 없어요" 를 보냈다** — 주소는 멀쩡히 있는데. 사장님에게 가는
  //   경보도 no_shipping_address 라 엉뚱한 곳을 보게 된다. 박스는 걸러진다.
  if (addrErr) return 'lookup-failed'

  if (addr && addr.zip && addr.address && addr.recipient_name && addr.phone) {
    return {
      name: addr.recipient_name,
      phone: addr.phone,
      zip: addr.zip,
      address: addr.address,
      addressDetail: addr.address_detail ?? null,
    }
  }

  // fallback to profiles
  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('name, phone, zip, address, address_detail')
    .eq('id', userId)
    .maybeSingle()
  if (profErr) return 'lookup-failed'

  if (prof && prof.zip && prof.address && prof.name && prof.phone) {
    return {
      name: prof.name,
      phone: prof.phone,
      zip: prof.zip,
      address: prof.address,
      addressDetail: prof.address_detail ?? null,
    }
  }

  return null
}

/**
 * ★청구액 서버 재계산 (2026-07-29 결제 감사 critical).
 *
 * `subscriptions.total_amount` 는 고객이 REST 로 직접 쓸 수 있다(RLS 가 소유자
 * UPDATE 를 컬럼 제한 없이 허용 + authenticated 에 UPDATE 권한 실측). 그래서
 * 청구 전에 **신뢰할 수 있는 원천**으로 다시 계산해 대조한다.
 * `subscription_items.unit_price` 도 고객이 쓸 수 있으므로 items 합은 근거가
 * 못 되고, 관리자만 쓰는 `products` 만 신뢰한다 — 승인 라우트(priceForApproved)
 * 와 정확히 같은 경로(처방 + products → priceForFormula).
 *
 * 계산 근거가 없으면 null — 호출부가 검사를 건너뛴다(돈을 추측하지 않는다).
 */
async function recomputeChargeBase(
  supabase: ReturnType<typeof createAdminClient>,
  sub: SubscriptionRow,
  guardProducts: Record<string, BoxProduct> | null,
): Promise<number | null> {
  if (!sub.dog_id || sub.fresh_ratio == null || !(sub.fresh_ratio > 0)) return null

  // 현재 적용 중인 처방 — 대조 기준. 없으면 대조 불가.
  //
  // ★ 정렬을 `cycle_number DESC` → `created_at DESC` 로 고쳤다 (2026-07-30 감사).
  //   회차 번호가 큰 것이 항상 최신이 아니다 — 프로덕션 실측:
  //     cycle 2 = 2026-07-10 생성 (관절 0.8 + 체중 0.2, 568kcal)
  //     cycle 1 = 2026-07-15 생성 (프리미엄 1.0, 745kcal)  ← 이게 최신
  //   회차 번호로 고르면 **5일 오래된 처방**을 집어 8/4 청구가 153,100원 대신
  //   90,900원(−40.6%)이 될 예정이었다.
  //
  //   그리고 금액을 만든 주문 화면은 **cycle 1 고정**이다. 그 파일 주석이 이유를
  //   적어놨다 — "여기만 최신 cycle 을 읽어서 진행 cron 이 만든 옛 cycle 2 를
  //   보여줬다 → 같은 강아지인데 화면마다 레시피가 달랐다"(사장님 제보).
  //   즉 그 화면이 일부러 피한 함정을 돈 경로가 다시 밟고 있었다.
  //   `created_at` 기준이면 정상 케이스(회차가 시간순)와 이 이상 케이스가 모두
  //   "가장 최근에 적용된 처방"으로 일치한다.
  const { data: fRow, error: fErr } = await supabase
    .from('dog_formulas')
    .select('formula, daily_kcal, approval_status, cycle_number')
    .eq('dog_id', sub.dog_id)
    .neq('approval_status', 'pending_approval')
    .neq('approval_status', 'declined')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  // ★대조 기준을 "못 구했다" 와 "조회가 실패했다" 를 가른다(2026-08-02 검수).
  //   이 함수가 null 을 주면 호출부는 금액 대조를 **건너뛴다**. 그 자체는 옳다
  //   (돈을 추측하지 않는다 — AGENTS 규칙5). 문제는 조회 실패로 null 이 될 때
  //   **아무도 모른 채 검문소가 꺼진다**는 것이다. 방어를 만들면 탈출구를
  //   열거하라는 규칙2 가 정확히 이 경우다. 동작은 그대로 두고 신호만 남긴다.
  if (fErr) {
    captureBusinessEvent('warning', 'subscription.charge_guard_skipped', {
      subscriptionId: sub.id,
      reason: 'dog_formulas_lookup_failed',
    })
    return null
  }
  const formulaRow = fRow as unknown as {
    formula: { lineRatios: Record<string, number>; toppers: Record<string, number> }
    daily_kcal: number
  } | null
  if (!formulaRow?.formula || !(formulaRow.daily_kcal > 0)) return null

  // ★products 는 호출부가 루프 앞에서 1회 조회해 주입한다 (2026-08-08 성능
  //  감사). 예전엔 이 함수가 매 구독마다 **완전히 같은 쿼리**(같은 slug 목록,
  //  같은 결과)를 반복했다 — 100건 청구면 같은 조회 100번. 조회 실패(null)의
  //  의미는 예전과 같다: 대조 기준을 못 구했으니 검문을 건너뛰되 신호를 남긴다.
  if (guardProducts == null) {
    captureBusinessEvent('warning', 'subscription.charge_guard_skipped', {
      subscriptionId: sub.id,
      reason: 'products_lookup_failed',
    })
    return null
  }
  const products = guardProducts
  if (Object.keys(products).length === 0) return null

  const { total } = priceForFormula({
    formula: {
      lineRatios: formulaRow.formula.lineRatios as never,
      toppers: formulaRow.formula.toppers as never,
      dailyKcal: formulaRow.daily_kcal,
    },
    freshRatio: sub.fresh_ratio,
    products,
  })
  // ★유한성까지 본다 — 토퍼 kcal 0 이면 Infinity 가 나오고 `> 0` 을 통과한다.
  //  그러면 charge-amount-guard 가 매일 오탐 알림을 낸다(2026-08-08 금액 감사).
  return Number.isFinite(total) && total > 0 ? total : null
}


const MAX_PER_RUN = 100
// 3-strike 상수는 lib/payments/billing-error-classify 정본 — 카드 재등록 시
// 자동 재개 판정(isPausedByBillingFailure)이 같은 숫자를 봐야 한다.
const MAX_FAILED = MAX_FAILED_CHARGES

function todayKstIsoDate(): string {
  // KST = UTC+9. 단순 계산: 현재 UTC 에 9h 더해서 date 부분만.
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/**
 * 다음 배송일 — **2주(14일) 뒤, 언제나**.
 *
 * 2026-07-16: 예전엔 3갈래였다 — 박스 2주 / 레거시 4주치는 캘린더 월 / 단일 SKU
 * /subscribe 흐름은 interval_weeks(1·2·4)주. 그런데 배송 주기는 2주 하나로
 * 고정됐고(사장님 2026-07-13, 박스가 14일치라 다른 주기는 물리적으로 성립 안 함),
 * /subscribe 흐름은 도달 불가라 삭제했다. 분기가 남아 있으면 옛 데이터나 손으로
 * 넣은 값이 다른 주기를 되살린다.
 *
 * ★최종감사 #3 (2026-07-29): 예전엔 `nextCycleDate(today)` — "청구일은 항상
 * 화요일"이라는 전제였다. 그런데 대상 조회는 `.lte('next_delivery_date', today)`
 * 로 **밀린 날 따라잡기**를 허용하고, cron_health 실측상 크론이 화요일에 안 돈
 * 날이 실제로 있었다(07-07 화 미실행 → 07-09 목 실행). 그 순간 목요일 청구가
 * next_delivery_date 를 목요일로 박고, 이후 +14 씩만 밀려 **화요일 정렬이 영구
 * 이탈**했다 — 피킹 리스트는 화요일만 조회하므로 그 고객의 박스는 리스트에서
 * 영영 사라진다(결제만 되고 박스는 안 나감).
 *
 * 해법: 실행일이 아니라 **원래 예정일(dueIso — 귀납적으로 항상 화요일)** 에서
 * +14 를 앵커한다. 늦게 청구돼도 주기는 화요일에 남는다. 여기에 두 겹 자가치유:
 *   ① 과거 데이터·수동 입력으로 앵커가 이탈했어도 다음 화요일로 스냅
 *   ② 여러 주 밀렸어도 결과가 반드시 미래가 되도록 전진 (과거로 잡히면
 *      다음날 크론이 곧바로 또 청구한다)
 */
function nextDeliveryDate(dueIso: string, todayIso: string): string {
  return nextCycleDateAligned(dueIso, todayIso)
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('subscription-charge', () => runSubscriptionCharge())
}

async function runSubscriptionCharge(): Promise<Response> {
  // ★프리플라이트 — 서버 설정 오류를 '고객 결제 실패'로 오분류하지 않는다
  //   (2026-08-19 5라운드 감사).
  //
  // TOSS_SECRET_KEY 가 없거나 **오타**(선행 공백·접두사 잘림 등)면 청구가
  // 인증 거부되는데, 그 에러코드는 classifyBillingError 의 permanent/transient
  // 목록에 없어 **'unknown'** 으로 분류돼 3-strike 를 탄다 → 카드에 아무 문제
  // 없는 고객의 failed_charge_count 가 오르고 3일이면 전원 일시정지된다.
  // 출시일 운영키 교체(TOSS_GO_LIVE.md) 때 키를 한 글자 흘리는 사고가 정확히
  // 이 경로다 — 되돌리기 어렵다.
  //
  // keyMode 로 판정해 **부재(missing)뿐 아니라 형식 오류(unknown)까지** 한
  // 명이라도 건드리기 전에 끊는다(test_/live_ 정상 키는 통과). 500 을 반환하면
  // trackCron 이 error 로 집계(크론 빨간불 + Sentry)해 사장님이 즉시 본다.
  // 고객 데이터는 무손상 — 다음 실행에서 키가 정상이면 그대로 청구된다.
  const secretMode = keyMode(process.env.TOSS_SECRET_KEY)
  if (secretMode === 'missing' || secretMode === 'unknown') {
    return NextResponse.json(
      {
        ok: false,
        reason: secretMode === 'missing' ? 'toss_secret_missing' : 'toss_secret_malformed',
        errors: 1,
        note: 'TOSS_SECRET_KEY 부재 또는 형식 오류(test_/live_ 접두사 아님) — 청구를 시작하지 않고 중단. 환경변수 확인 필요.',
      },
      { status: 500 },
    )
  }

  const supabase = createAdminClient()
  const today = todayKstIsoDate()

  // 1) 오늘 결제 대상 구독 fetch.
  //    제외 조건:
  //      - status != active
  //      - billing_key NULL (등록 안 됨)
  //      - requires_billing_key_renewal=true (영구 거절 — 사용자가 카드 다시
  //        등록할 때까지 대기)
  //      - next_retry_at > NOW() (transient 실패 후 24h 쿨다운 중)
  const nowIso = new Date().toISOString()
  const { data: subs, error: fetchErr } = await supabase
    .from('subscriptions')
    .select(
      `id, user_id, next_delivery_date, total_amount,
       billing_key, billing_customer_key, failed_charge_count,
       recipient_phone, interval_weeks, coverage_weeks, dog_id,
       total_deliveries, next_retry_at, requires_billing_key_renewal,
       last_failed_charge_code, fresh_ratio`,
    )
    .eq('status', 'active')
    .eq('requires_billing_key_renewal', false)
    .not('billing_key', 'is', null)
    .lte('next_delivery_date', today)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  // audit #79: SubscriptionRow 가 generated types schema 와 다름 (recipient_zip 등).
  const targets = ((subs ?? []) as unknown) as SubscriptionRow[]

  // 청구액 대조용 products — 모든 구독이 같은 목록을 쓰므로 루프 앞에서 1회.
  // 실패하면 null 로 두고, recomputeChargeBase 가 구독별로 skip 신호를 남긴다
  // (검문소가 꺼진 것을 아무도 모르는 상태를 만들지 않는다 — 규칙2).
  const guardSlugs = [
    ...Object.values(PRICE_LINE_TO_SLUG).filter((x): x is string => x !== null),
    ...Object.values(PRICE_TOPPER_TO_SLUG),
  ]
  const { data: guardProdList, error: guardProdErr } = await supabase
    .from('products')
    .select('slug, price, sale_price, stock, is_subscribable, nutrition_facts')
    .in('slug', guardSlugs)
    .eq('is_active', true)
  let guardProducts: Record<string, BoxProduct> | null = null
  if (!guardProdErr) {
    guardProducts = {}
    for (const pr of ((guardProdList ?? []) as unknown) as BoxProduct[]) {
      guardProducts[pr.slug] = pr
    }
  }
  let succeeded = 0
  let failed = 0
  /**
   * ★고객 사유(카드 거절·주소 미비)는 '우리 쪽 실패'가 아니다 (2026-08-12 4라운드 감사).
   *
   * 어제 크론 부분실패 판정(failureCountOf)을 넣으면서 이 크론의 `failed` 를 그대로
   * 실패로 세게 했는데, 여기 `failed` 에는 **정상 운영 이벤트인 카드 거절**이 섞여
   * 있었다. 잔액부족 고객 한 명이 매일 재청구→매일 거절→**매일 크론 빨간불**이 되고,
   * 사장님이 그 알림을 무시하기 시작하면 진짜 실패(메일 전멸·주문 생성 실패)까지 같이
   * 묻힌다 — 그 커밋이 스스로 주석에 적어 둔 실패 방식을 그 커밋이 만들었다.
   * 고객 사유는 declined 로 따로 센다(지표로는 보이되 빨간불은 아니다).
   */
  let declined = 0
  let skipped = 0
  // 결제완료 메일 — 0 이면 '돈은 받았는데 아무 연락 안 감'이라 지표로 낸다.
  let mailSent = 0
  let mailFailed = 0
  // 보낼 수 없는 상태(수신거부·미설정·수신자 없음) — 실패가 아니라 별도 지표.
  let mailSkippedCount = 0

  for (const sub of targets) {
    // 2-0) 이중청구 가드(점검 high): 이미 Toss 청구됐으나 후속 update 실패로
    //      미확정(status='pending' + payment_key 존재)인 charge 가 있으면 새 청구를
    //      하지 않는다. 재청구 가드가 next_delivery_date 한 곳에만 의존하면, 후속
    //      update 실패로 날짜가 안 밀릴 때 다음날 cron 이 다른 scheduled_for/
    //      idempotencyKey 로 카드를 2회 청구하는 사고가 난다.
    //      ★이 조회의 error 를 반드시 본다(2026-08-05 병렬 감사). 예전 캐스트
    //      타입에는 `error` 필드가 아예 없어서 **구조적으로 오류를 볼 수 없었고**,
    //      조회가 실패하면 pendingCharges 가 null → `?? []` → find 가 undefined
    //      → **가드가 조용히 통과**했다. DB 불안정은 뭉쳐서 오므로, 후속 update 가
    //      실패한 바로 그 상황에서 이 조회도 실패할 확률이 높다 — 즉 가드가 가장
    //      필요한 순간에 열린다. 규칙32 정규식도 `await (` 형태는 못 잡는다.
    const { data: pendingCharges, error: pendingErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, v: string) => {
              eq: (col2: string, v2: string) => {
                limit: (n: number) => Promise<{
                  data: Array<{ id: string; payment_key: string | null }> | null
                  error: { message: string } | null
                }>
              }
            }
          }
        }
      }
    )
      .from('subscription_charges')
      .select('id, payment_key')
      .eq('subscription_id', sub.id)
      .eq('status', 'pending')
      .limit(5)
    // 조회 실패 = 미확정 청구가 있는지 **모른다**. 모르면 긁지 않는다 —
    // 이 구독은 건너뛰고 다음 실행에 맡긴다(하루 늦는 것 < 이중청구).
    if (pendingErr) {
      captureBusinessEvent('error', 'subscription.charge.guard_lookup_failed', {
        subscriptionId: sub.id,
        note: '미확정 청구 조회 실패 — 이중청구 방지를 위해 이번 회차 건너뜀',
      })
      skipped++
      continue
    }
    const unresolved = (pendingCharges ?? []).find((c) => c.payment_key)
    if (unresolved) {
      // 돈은 청구됐는데 주문/구독 미확정 → 재청구 금지 + 알림(수동/reconcile 처리).
      captureBusinessEvent('error', 'subscription.charge.unresolved_skip', {
        subscriptionId: sub.id,
        chargeId: unresolved.id,
      })
      skipped++
      continue
    }

    // 2-0b) 자동 할인 계산 — subtotal(구독 단가)에서 할인 차감한 실제 청구액 결정.
    //       쿠폰 없음(lib/discount). 첫주문/등급(슬롯)/생일 자동 판정. charge·order·
    //       billing 전부 이 chargeAmount 로 일관 기록(subtotal 은 정가 유지).
    // ★청구액 대조 (2026-07-30 재설계) — **항상 저장된 금액으로 청구**하고,
    //   서버 재계산과 어긋나면 알린다. 청구를 막지도, 금액을 낮추지도 않는다.
    //
    //   왜 자동 차단·자동 하향을 뺐나 (최종감사):
    //    · 하향(min)이 실제로 저청구를 만들었다 — 8/4 건 153,100 → 90,900원
    //    · 차단(refuse)은 정상 고객을 막았다 — 품절 중 주문 후 재입고하면
    //      재계산이 커져 "조작"으로 분류되고, 박스는 계속 나가면서 청구만 멈춘다
    //    · 재계산이 정당하게 어긋나는 경우(재고 변동·플랜화면 레시피 선택 미저장·
    //      회차 기준)의 크기가 조작과 구분되지 않는다(실측 40%)
    //   조작 자체는 이제 **DB 권한**으로 막는다 —
    //   20260730000000_subscriptions_lock_money_columns.sql 이 고객의
    //   total_amount·fresh_ratio·billing_key UPDATE 권한을 회수했다.
    //   (남은 경로는 구독 생성 시점 뿐이고, 그건 서버 라우트 이관이 정답 — 후속.)
    const recomputed = await recomputeChargeBase(supabase, sub, guardProducts)
    const amountCheck = checkChargeAmount(sub.total_amount, recomputed)
    if (amountCheck.mismatch) {
      captureBusinessEvent('warning', 'subscription.charge.amount_mismatch', {
        subscriptionId: sub.id,
        userId: sub.user_id,
        storedAmount: sub.total_amount,
        recomputedAmount: String(amountCheck.recomputed),
        direction: String(amountCheck.direction),
        note: '저장 금액으로 청구했다. 재고 변동·처방 회차 차이면 정상, 아니면 확인 필요.',
      })
    }
    // 청구 기준은 **항상** 저장 금액 = 고객이 동의하고 모든 화면이 보여주는 값.
    const trustedSubtotal = amountCheck.chargeBase

    const { reason: discountReason, discountAmount, chargeAmount, promoClaimed } =
      await resolveAutoDiscount({ userId: sub.user_id, subtotal: trustedSubtotal })

    // ★결제 감사 #7 (2026-07-29): 0원 이하 청구 금지. 100% 프로모션이 허용돼
    //   있어(pct <= 100) chargeAmount 가 0 이 될 수 있는데, 카드 결제는 최소
    //   금액 미달로 **거절**된다 → unknown 분류로 3-strike 카운트가 쌓여 구독이
    //   정지되고 프로모션까지 소진된다. "첫 박스 무료"는 0원 청구가 아니라 별도
    //   기획으로 풀어야 하는 일이므로, 여기서는 청구를 건너뛰고 알린다.
    if (!(chargeAmount > 0)) {
      captureBusinessEvent('error', 'subscription.charge.zero_amount', {
        subscriptionId: sub.id,
        subtotal: trustedSubtotal,
        discountAmount,
        discountReason,
      })
      skipped += 1
      continue
    }

    // 2-a) charge row insert. UNIQUE (subscription_id, scheduled_for) 충돌 시
    //      이미 처리됨 — skip.
    // audit #79: subscription_charges schema-drift cast.
    const { data: chargeRow, error: chargeErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (r: Record<string, unknown>) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: { id: string } | null
                error: { code?: string; message?: string } | null
              }>
            }
          }
        }
      }
    )
      .from('subscription_charges')
      .insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        scheduled_for: today,
        status: 'pending',
        amount: chargeAmount,
      })
      .select('id')
      .single()

    if (chargeErr) {
      // 23505 = unique violation = 이미 같은 날 시도함. 정상 skip.
      if (
        (chargeErr as unknown as { code?: string }).code === '23505'
      ) {
        skipped += 1
        continue
      }
      failed += 1
      continue
    }

    // 2-b) order row 먼저 만든다 (payment_status='pending'). orderId 가 Toss
    //      청구 요청에 필요. user 가 직접 결제한 주문과 구분되도록 source 컬럼
    //      이 있다면 'subscription' 마킹 권장 (없으면 일반 주문과 동일 처리).
    const orderName = `Farmer's Tail 정기배송 #${sub.total_deliveries + 1}`

    // audit launch-fix: 배송 주소를 addresses/profiles 에서 lookup. 신청
    // 시점 snapshot 이 없으면 매번 lookup. 둘 다 없으면 결제 자체 skip.
    const ship = await resolveShippingTarget(supabase, sub.user_id)
    // ★조회 실패와 미등록을 갈라서 처리한다(2026-08-02 검수).
    //   둘을 합쳐 두면 DB 가 잠깐 흔들린 것뿐인데 고객은 "배송지를 등록해
    //   주세요" 를 읽고, 사장님 경보도 주소 문제로 뜬다. 고칠 곳을 못 찾는다.
    if (ship === 'lookup-failed') {
      await supabase
        .from('subscription_charges')
        .update({
          status: 'failed',
          error_code: 'ADDRESS_LOOKUP_FAILED',
          error_message:
            '일시적인 오류로 이번 결제를 진행하지 못했어요. 곧 다시 시도할게요.',
        })
        .eq('id', chargeRow!.id)
      // error 로 올린다 — 고객 잘못이 아니라 우리 쪽 장애이고, 재시도 대상이다.
      captureBusinessEvent('error', 'subscription.address_lookup_failed', {
        subscriptionId: sub.id,
        userId: sub.user_id,
      })
      failed += 1
      continue
    }
    if (!ship) {
      await supabase
        .from('subscription_charges')
        .update({
          status: 'failed',
          error_code: 'NO_SHIPPING_ADDRESS',
          error_message:
            '배송지가 등록되지 않아 결제를 진행할 수 없어요. 마이페이지에서 기본 배송지를 추가해 주세요.',
        })
        .eq('id', chargeRow!.id)
      // 운영자 알림 — 정기구독이 무한 정지되는 것을 막기 위해.
      captureBusinessEvent('warning', 'subscription.no_shipping_address', {
        subscriptionId: sub.id,
        userId: sub.user_id,
      })
      // 고객이 주소를 안 넣은 것 — 크론 고장이 아니다(위 declined 주석).
      declined += 1
      continue
    }

    // orders 의 실제 컬럼명은 zip / address / address_detail (recipient_ 접두사 X).
    // recipient_name 과 recipient_phone 만 recipient_ prefix 사용.
    // 데이터정합 감사(CRITICAL): orders.order_number / subtotal 은 NOT NULL +
    // DB 기본값 없음(prod 확인). 누락 시 정기결제가 주문 생성 단계에서 NOT NULL
    // 위반으로 전부 실패한다(체크아웃·admin 경로는 둘 다 채워서 베타에 안 드러남).
    // order_number 는 CheckoutForm.generateOrderNumber 와 동일 포맷(FT-YYYYMMDD-RAND),
    // subtotal 은 구독 total_amount(구독 단가에 배송비 포함, 별도 분리 없음).
    const orderNow = new Date()
    const orderNumber = `FT-${orderNow.getFullYear()}${String(
      orderNow.getMonth() + 1,
    ).padStart(2, '0')}${String(orderNow.getDate()).padStart(2, '0')}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`
    const orderInsertPayload: Record<string, unknown> = {
      user_id: sub.user_id,
      // ★최종감사 #1 (2026-07-29, critical): 이 한 줄이 빠져 있었다.
      //   orders.subscription_id 를 전제하는 소비자가 둘인데 —
      //   ① 재제안 크론의 배송 회차 카운트(.eq('subscription_id', subId))가
      //      항상 0 → isCycleDue 영원히 false → cycle 2+ 재제안·체크인·
      //      알레르기 게이트 전체가 한 번도 실행되지 못함
      //   ② 도장판 트리거 tg_orders_stamp 가 subscription_id null 이면
      //      즉시 return → 결제를 아무리 해도 도장 0개
      //   컬럼은 DB·types.ts 에 이미 존재. 채우기만 하면 둘 다 살아난다.
      subscription_id: sub.id,
      order_number: orderNumber,
      order_status: 'pending',
      payment_status: 'pending',
      // 검문소를 통과한 신뢰 금액 — 조작된 total_amount 가 주문에 남지 않게.
      subtotal: trustedSubtotal,
      total_amount: chargeAmount,
      discount_amount: discountAmount,
      discount_reason: discountReason,
      recipient_name: ship.name,
      recipient_phone: sub.recipient_phone ?? ship.phone,
      zip: ship.zip,
      address: ship.address,
      address_detail: ship.addressDetail,
    }
    const { data: orderRow, error: orderErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (r: Record<string, unknown>) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: { id: string; order_number: string } | null
                error: { message?: string } | null
              }>
            }
          }
        }
      }
    )
      .from('orders')
      .insert(orderInsertPayload)
      .select('id, order_number')
      .single()

    if (orderErr || !orderRow) {
      await supabase
        .from('subscription_charges')
        .update({
          status: 'failed',
          error_code: 'ORDER_INSERT_FAILED',
          error_message: orderErr?.message ?? 'unknown',
          completed_at: new Date().toISOString(),
        })
        .eq('id', chargeRow!.id)
      failed += 1
      continue
    }

    // 2-b-2) subscription_items → order_items 복사 (audit fix).
    // 이전: order row 만 만들고 items 누락 → 사용자/admin 이 주문 상세에서
    // 상품 안 보임 + 발송 운영 시 어떤 상품 보낼지 모름.
    const { data: subItems, error: subItemsErr } = await supabase
      .from('subscription_items')
      .select('product_id, product_name, product_image_url, quantity, unit_price')
      .eq('subscription_id', sub.id)
    // 조회 실패를 "품목 없음"으로 읽으면 아래 insert 를 통째로 건너뛰어
    // **품목 없는 주문**이 남는다 — 바로 이 블록이 고치려던 그 상태다.
    if (subItemsErr) {
      captureBusinessEvent('error', 'subscription.charge.items_query_failed', {
        subscriptionId: sub.id,
        orderId: orderRow!.id,
        dbError: subItemsErr.message,
      })
    }
    const subItemsArr = (subItems ?? []) as Array<{
      product_id: string | null
      product_name: string
      product_image_url: string | null
      quantity: number
      unit_price: number
    }>
    // 데이터정합 감사: order_items.product_id 는 NOT NULL. subItemsArr 타입은
    // product_id: string|null(캐스트로 추론 완화)이라 null 이 섞이면 insert 가
    // NOT NULL 위반 → 품목 없는 orphan 주문. null product_id 는 skip.
    const validItems = subItemsArr.filter((it) => it.product_id != null)
    if (validItems.length > 0) {
      // audit #79: order_items insert payload cast (product_id nullable 등 추론 차이).
      const { error: itemsInsErr } = await (supabase as unknown as {
        from: (t: string) => {
          insert: (
            r: Record<string, unknown>[],
          ) => Promise<{ error: { message: string } | null }>
        }
      })
        .from('order_items')
        .insert(
          validItems.map((it) => ({
            order_id: orderRow!.id,
            product_id: it.product_id,
            product_name: it.product_name,
            product_image_url: it.product_image_url,
            quantity: it.quantity,
            unit_price: it.unit_price,
            line_total: it.unit_price * it.quantity,
          })),
        )
      // 결제는 이미 됐다(청구 아래). 품목이 안 들어가면 고객 주문내역이 비고
      // 발송 운영이 무엇을 담을지 모른다 → 사람이 봐야 한다. 흐름은 계속한다:
      // 여기서 멈추면 결제만 되고 주문이 없는 더 나쁜 상태가 된다.
      if (itemsInsErr) {
        captureBusinessEvent('error', 'subscription.charge.order_items_failed', {
          subscriptionId: sub.id,
          orderId: orderRow!.id,
          itemCount: validItems.length,
          dbError: itemsInsErr.message,
        })
      }
    }

    // ★청구 윈도우 원자적 선점 (2026-07-30 — 주석만 있고 구현이 없던 것을 실제로 구현)
    //
    //   이전 코드는 여기서 `select('status')` 로 **읽기만** 했다. 그런데 위 주석은
    //   "UPDATE-with-RETURNING 으로 atomically 진입 (last_charge_lock_at 마킹)" 이라고
    //   적혀 있었고, 그 컬럼 이름은 저장소 전체에서 **그 주석 한 줄이 유일한 등장**
    //   이었다. 없는 방어를 있다고 믿게 만드는 주석이었다(최종감사 critical).
    //
    //   읽기만으로는 배치 조회(:346~) 시점과 여기 사이의 변화만 잡고, 여러 run 이
    //   겹쳤을 때 둘 다 통과할 수 있다. UPDATE 는 행 잠금을 잡으므로 하나만 통과한다.
    //   0행 = 그 사이 status 가 바뀌었거나 다른 run 이 선점 → 청구하지 않는다.
    const { data: claimed, error: claimErr } = await supabase
      .from('subscriptions')
      .update({ last_charge_lock_at: new Date().toISOString() })
      .eq('id', sub.id)
      .eq('status', 'active')
      .select('id')
    if (claimErr || !claimed || claimed.length === 0) {
      skipped++
      continue
    }

    // 멱등키 — **주기(next_delivery_date) 기준**, 실행일(today) 아님(2026-07-24 점검).
    //   왜: transient 실패(PAY_PROCESS_TIMEOUT 등 — Toss가 카드는 긁었는데 응답이
    //   유실된 경우 포함)는 24h 뒤 재시도된다. 키가 `{today}` 면 재시도날 키가
    //   바뀌어 Toss가 새 청구로 처리 → **이중청구**. next_delivery_date 는 성공
    //   전까지 안 밀리므로 같은 주기의 모든 재시도가 같은 키를 공유 → Toss가
    //   원결제 결과를 그대로 돌려줘 재청구가 없다(캡처된 결제는 자동 회복).
    //   confirm/cancel 키가 트랜잭션 기반으로 안정적인 것과 같은 원리.
    // ★최종감사 #2 (2026-07-29): 주기 고정 키의 부작용 보정.
    //   토스는 멱등키 응답을 15일간 저장·재생한다. 첫 시도가 **잔액부족 같은
    //   확정 거절**(돈이 절대 안 나간 게 보장되는 코드)이었으면, 고객이 잔액을
    //   채워도 같은 키의 재시도는 저장된 거절만 돌려받아 결제가 15일간 멈춘다.
    //   직전 실패가 확정 거절일 때만 날짜를 붙여 새 키로 — 돈이 안 나갔음이
    //   보장되므로 이중청구 위험 0. 타임아웃·네트워크류(결과 불명)는 종전대로
    //   같은 키 유지(원결제 결과 재생 = 이중청구 방지가 우선).
    // ★2026-08-05 — 접미사 앵커를 `today` 에서 `failed_charge_count` 로.
    //   날짜를 쓰면 **키가 되돌아간다**:
    //     1일차  키 A            → 잔액부족(확정거절)
    //     2일차  키 A:r08-06     → 타임아웃(토스는 카드를 긁었는데 응답 유실).
    //                              실패로 기록되고 last_code 는 비확정이 된다.
    //     3일차  접미사 없음 → **키 A 로 복귀**. 2일차 캡처와 대조가 안 되고
    //                              토스는 1일차 거절을 재생.
    //     4일차  다시 확정거절 → :r08-08 새 키 → **두 번째로 카드가 긁힌다.**
    //   `failed_charge_count` 는 확정거절·unknown 에만 오르고 **transient(타임아웃
    //   류)에는 안 오른다**(아래 실패 분기). 그래서 "돈이 안 나갔음이 보장된
    //   거절 때만 키를 갈아탄다"는 원래 의도를 정확히 표현하면서, 결과 불명인
    //   재시도는 같은 키를 유지해 원결제 결과를 재생받는다 — 되돌아가지 않는다.
    const retrySuffix = chargeRetrySuffix(
      sub.last_failed_charge_code,
      sub.failed_charge_count,
    )
    const idempotencyKey = `sub-charge:${sub.id}:${sub.next_delivery_date}${retrySuffix}`

    // 2-c) Toss 청구. 비즈니스 span 으로 wrap — Sentry 트랜잭션에서 실패율 +
    //      latency 추적.
    const result = await traceBusiness(
      'subscription.charge',
      {
        'subscription.id': sub.id,
        'subscription.amount': chargeAmount,
        'subscription.failed_count': sub.failed_charge_count,
        'subscription.scheduled_for': today,
      },
      () =>
        chargeBillingKey({
          billingKey: sub.billing_key,
          customerKey: sub.billing_customer_key,
          // ★결제 감사 #2 (2026-07-29): 토스에 보내는 orderId 는 **주문번호**여야
          //   한다. 예전엔 orders.id(UUID)를 보내서 ① 웹훅이 order_number 로
          //   조회하므로 **모든 정기결제 웹훅이 주문을 못 찾고 조용히 버려졌다**
          //   (토스 대시보드 환불이 우리 DB 에 반영 안 됨 → 환불한 고객에게 박스
          //   발송) ② 토스 대시보드 주문번호가 UUID 로 찍혀 CS 대조가 불가능했다.
          orderId: orderRow.order_number,
          orderName,
          amount: chargeAmount,
          idempotencyKey,
        }),
    )

    if (result.ok) {
      // ★결제 감사 #3 (2026-07-29): 프로모션 소진을 **청구 성공 후로** 옮겼다.
      //   예전엔 주문 row 생성 직후 소진 표시를 했는데, 그 뒤 청구가 실패하면
      //   주문은 취소되지만 claim 은 그 취소된 주문에 묶인 채 남았다.
      //   pending_promotion_rate 는 redeemed_order_id IS NULL 만 보므로 재시도는
      //   **정가 청구** — 50% 이벤트로 가입한 고객이 잔액부족 한 번에 할인을
      //   영구히 잃고 다음날 100% 결제되는 경로였다. '썼다'는 실제로 그 할인으로
      //   결제가 됐을 때만 참이다.
      if (promoClaimed) {
        try {
          await (
            supabase as unknown as {
              from: (t: string) => {
                update: (r: Record<string, unknown>) => {
                  eq: (c: string, v: string) => {
                    is: (c: string, v: null) => Promise<unknown>
                  }
                }
              }
            }
          )
            .from('promotion_claims')
            .update({
              redeemed_order_id: orderRow!.id,
              redeemed_at: new Date().toISOString(),
            })
            .eq('user_id', sub.user_id)
            .is('redeemed_order_id', null)
        } catch {
          /* 소진 표시 실패 — 결제는 이미 성공. admin 보정 대상. */
        }
      }

      // 2-d) 성공 → orders / charge / subscription 업데이트.
      // 성공하면 모든 retry/renewal 플래그를 0/false 로 reset (이전에 실패해서
      // 카드 재등록 받은 후 정상화 케이스 포함).
      const successIso = new Date().toISOString()
      const nextDate = nextDeliveryDate(sub.next_delivery_date, today)

      // R61 — 결제 원장 event (정기구독 자동 결제).
      {
        const { recordPaymentEvent } = await import('@/lib/payment-events')
        await recordPaymentEvent(supabase, {
          orderId: orderRow.id,
          paymentKey: result.paymentKey,
          eventType: 'paid',
          amount: chargeAmount,
          prevStatus: 'pending',
          newStatus: 'paid',
          source: 'cron_subscription_charge',
          metadata: {
            subscriptionId: sub.id,
            idempotencyKey,
          },
        })
      }

      // ★청구 후 상태 재확인 (2026-07-30 최종감사) — 토스 응답을 최대 30초
      //   기다리는 사이에 고객이 해지·정지했을 수 있다. 선점(위 last_charge_lock_at)은
      //   "긁기 시작할 때 active 였음"만 보장하고, 긁는 **동안**의 해지는 못 막는다.
      //
      //   그때 일어나는 일: 돈은 나갔는데 피킹 리스트는 구독 status='active' 만
      //   뽑으므로(admin/personalization/picking-list) 박스가 자동 발송 목록에서
      //   빠진다 → **고객은 결제만 되고 아무것도 못 받는다.** 게다가 주문이
      //   'preparing' 으로 남아 관리자 주문 목록에 뜨니 사람이 보고 보낼 수도 있다.
      //
      //   그래서 해지가 감지되면 ① 주문을 발송 대기로 올리지 않고 ② 즉시 환불하고
      //   ③ 실패하면 환불 큐에 넣는다(confirm 라우트의 race 처리와 같은 패턴).
      const { data: afterCharge, error: afterErr } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('id', sub.id)
        .maybeSingle()
      // ★조회 실패를 "해지됨" 으로 읽으면 안 된다(AGENTS 규칙1, 2026-08-02 검수).
      //   예전엔 error 를 안 꺼내서, DB 가 잠깐 흔들리면 afterCharge 가 null 이
      //   되고 stillActive 가 false 가 됐다. 그 분기는 **방금 성공한 카드 결제를
      //   환불하고 주문을 발송 대기로 올리지 않는다.** 즉 멀쩡한 고객의 돈을
      //   되돌리고 박스를 거른다 — 되돌리기 가장 어려운 방향의 오작동이다.
      //   모르면 추측하지 않는다: 결제는 이미 성공했으므로 정상 경로를 유지하고
      //   사람에게 알린다(사장님이 구독 상태만 눈으로 확인하면 되는 상황).
      if (afterErr) {
        captureBusinessEvent('error', 'subscription.charge.status_recheck_failed', {
          subscriptionId: sub.id,
          userId: sub.user_id,
          orderId: orderRow.id,
          note: '청구 직후 구독 상태 재조회 실패. 결제는 성공했으므로 환불하지 않고 정상 진행했다. 해지 중이었는지 수동 확인 필요.',
        })
      }
      const stillActiveAfterCharge =
        afterErr || (afterCharge as { status?: string } | null)?.status === 'active'

      if (!stillActiveAfterCharge) {
        captureBusinessEvent('error', 'subscription.charge.cancelled_mid_charge', {
          subscriptionId: sub.id,
          userId: sub.user_id,
          orderId: orderRow.id,
          paymentKey: String(result.paymentKey),
          amount: chargeAmount,
          statusAfter: String((afterCharge as { status?: string } | null)?.status),
          note: '카드 청구 도중 고객이 해지·정지했다. 환불 시도 후 주문은 발송 대기로 올리지 않는다.',
        })
        const refund = await cancelPayment({
          paymentKey: result.paymentKey!,
          cancelReason: '청구 도중 고객 해지 — 자동 환불',
        })
        if (!refund.ok) {
          // 즉시 환불 실패 → 큐로. refund-retry 크론이 이어받는다.
          const queued = await (supabase as unknown as {
            from: (t: string) => {
              insert: (
                r: Record<string, unknown>,
              ) => Promise<{ error: { message?: string; code?: string } | null }>
            }
          })
            .from('payment_refund_queue')
            .insert({
              order_id: orderRow.id,
              payment_key: result.paymentKey,
              amount: chargeAmount,
              reason: 'cancelled_mid_charge',
            })
          // ★규칙1 — 큐 insert 가 실패하면 이 환불은 어떤 크론도 이어받지 못한다
          //   (돈은 빠졌는데 환불 경로 0). 무음으로 두면 영영 모르므로 fatal 로
          //   남긴다: 운영자가 payment_refund_queue 에 수동 insert 하면 복구된다.
          if (queued.error) {
            captureBusinessEvent('error', 'subscription.charge.refund_queue_insert_failed', {
              subscriptionId: sub.id,
              orderId: orderRow.id,
              paymentKey: String(result.paymentKey),
              amount: chargeAmount,
              dbError: String(queued.error.message ?? queued.error.code ?? 'unknown'),
              note:
                '환불 큐 적재 실패 — refund-retry 가 이어받지 못한다. payment_refund_queue 수동 insert 로 복구.',
            })
          }
        }
        if (refund.ok) {
          // ★즉시 환불 성공 — 원장과 refunded_amount 를 **반드시 함께** 남긴다
          //   (2026-08-20 6라운드 감사). 예전엔 payment_status='cancelled' 만 쓰고
          //   refunded_amount 도 -chargeAmount 원장도 안 남겨서, 앞서 :883 에서
          //   기록한 paid(+X)만 원장에 남고 refunded_amount=0 이 됐다. 그러면
          //   원장 SUM=+X≠0 이라 reconcile 의 특례(cancelled && ledger===0 → net 0)
          //   가 안 걸려 **전액 환불된 주문이 'X원 보유'로 장부에 남고 아무도
          //   못 잡는다**(토스는 취소, 우리는 보유 — 영구 불일치·무알림). 정본인
          //   refund-retry settleRefunded 와 동일하게 처리한다.
          const { error: ordErr } = await supabase
            .from('orders')
            .update({
              payment_status: 'cancelled',
              order_status: 'cancelled',
              payment_key: result.paymentKey,
              paid_at: successIso,
              refunded_amount: chargeAmount,
              cancel_reason: '청구 도중 고객 해지 — 자동 환불',
            })
            .eq('id', orderRow.id)
          if (ordErr) {
            // 환불은 이미 됐다 — 되돌릴 수 없으니 사람에게 알린다(규칙1).
            captureBusinessEvent('error', 'subscription.charge.refund_order_update_failed', {
              subscriptionId: sub.id,
              orderId: orderRow.id,
              amount: chargeAmount,
              dbError: String(ordErr.message ?? 'unknown'),
              note: '토스 환불은 성공했는데 orders 갱신 실패 — 수동 정정 필요',
            })
          }
          const { recordPaymentEvent } = await import('@/lib/payment-events')
          const ev = await recordPaymentEvent(supabase, {
            orderId: orderRow.id,
            paymentKey: result.paymentKey!,
            eventType: 'refunded',
            amount: -chargeAmount, // 음수 = 환불. 앞의 +X paid 와 상쇄해 SUM=0.
            prevStatus: 'paid',
            newStatus: 'cancelled',
            source: 'cron_subscription_charge',
            metadata: { subscriptionId: sub.id, reason: 'cancelled_mid_charge' },
          })
          if (!ev.ok) {
            captureBusinessEvent('error', 'subscription.charge.refund_ledger_write_failed', {
              subscriptionId: sub.id,
              orderId: orderRow.id,
              amount: chargeAmount,
              reason: ev.reason ?? 'unknown',
            })
          }
        } else {
          // 즉시 환불 실패 → payment_status='paid' 로 두고(위에서 큐 적재),
          //   refund-retry 크론이 이어받아 settleRefunded 로 정합화한다.
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              payment_key: result.paymentKey,
              paid_at: successIso,
            })
            .eq('id', orderRow.id)
        }
        skipped += 1
        continue
      }

      // 2-d) orders / subscription 업데이트 — 결과(error)를 검사한다. 돈은 이미
      //   Toss 에서 청구(capture)됐으므로 후속 update 실패를 silent 통과시키면
      //   '결제됐는데 payment_status=pending' 불일치가 남는다(점검 high). 실패 시
      //   charge 를 'succeeded' 로 마킹하지 않고 즉시 알림 → 수동/cron 재정산.
      const ordersUpd = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          order_status: 'preparing',
          payment_key: result.paymentKey,
          paid_at: successIso,
        })
        .eq('id', orderRow.id)
      const subUpd = await supabase
        .from('subscriptions')
        .update({
          next_delivery_date: nextDate,
          last_charged_at: successIso,
          failed_charge_count: 0,
          next_retry_at: null,
          last_failed_charge_at: null,
          last_failed_charge_reason: null,
          last_failed_charge_code: null,
          requires_billing_key_renewal: false,
          total_deliveries: sub.total_deliveries + 1,
        })
        .eq('id', sub.id)
      const postOk = !ordersUpd.error && !subUpd.error
      // audit #79: subscription_charges schema-drift cast.
      await (supabase as unknown as {
        from: (t: string) => {
          update: (r: Record<string, unknown>) => {
            eq: (c: string, v: string) => Promise<unknown>
          }
        }
      })
        .from('subscription_charges')
        .update({
          // 후속 update 실패 시 'succeeded' 금지 → 'pending' 유지(payment_key 존재 =
          // '청구됐으나 미확정' reconcile 신호). payment_events 엔 이미 paid 기록.
          status: postOk ? 'succeeded' : 'pending',
          payment_key: result.paymentKey,
          order_id: orderRow!.id,
          completed_at: postOk ? successIso : null,
        })
        .eq('id', chargeRow!.id)
      if (postOk) {
        captureBusinessEvent('info', 'subscription.charge.succeeded', {
          subscriptionId: sub.id,
          amount: chargeAmount,
          attemptCount: sub.failed_charge_count + 1,
        })

        /**
         * ★결제 완료를 고객에게 알린다 (2026-08-12 3라운드 감사).
         *
         * 예전엔 이 크론이 **실패 알림만** 보냈다(notifySubscriptionChargeFailed).
         * 즉 결제가 성공하면 메일도 푸시도 0통 — 돈은 빠져나가는데 아무 연락이
         * 없었다. 첫 고객 입장에선 "돈만 가져가고 연락 없는 회사"이고,
         * 전자상거래법 제13조(계약내용 확인 통지) 관점에서도 위험하다.
         *
         * 크론이라 fire-and-forget 을 쓰지 않는다 — 이 함수(그리고 아래 실패
         * 알림)가 이미 await 를 쓰는 이유와 같다: 응답이 끝나면 서버리스
         * 인스턴스가 죽어 미완료 promise 가 사라진다.
         */
        /**
         * ★반환값으로 판정한다 (2026-08-12 4라운드 감사).
         * 이 함수는 실패해도 throw 하지 않으므로 try/catch 로는 아무것도 못 센다
         * (mailFailed 가 구조적으로 0 이었다). ok 를 직접 본다.
         *
         * 단 `skipped`(수신거부 suppression·RESEND_API_KEY 미설정)는 **실패로 세지
         * 않는다** — 프리뷰 환경이나 하드바운스 고객 때문에 크론이 영구 빨간불이
         * 되면 규칙이 꺼진다(cron-failure-count 의 skipped 금기와 같은 이유).
         */
        const mailRes = await notifyOrderPlaced(supabase, {
          orderId: orderRow!.id,
          userId: sub.user_id,
          orderNumber: orderRow!.order_number,
          // subscriptions 에 recipient_name 컬럼이 없다(위 SubRow 주석) —
          // null 을 주면 resolveRecipient 가 프로필에서 이름을 찾는다.
          recipientName: null,
          totalAmount: chargeAmount,
          shippingFee: 0, // 배송비는 구독료에 포함(별도 청구 없음)
          paymentMethod: '카드',
        }).catch((e) => ({
          ok: false as const,
          skipped: false as const,
          status: 0,
          error: e instanceof Error ? e.message : 'unknown',
        }))
        const mailSkipped =
          'skipped' in mailRes && mailRes.skipped === true
        if (mailRes.ok === true) {
          mailSent += 1
        } else if (mailSkipped) {
          // 보낼 수 없는 상태(수신거부·미설정·수신자 없음) — 지표에는 남기고
          // 크론 실패로는 세지 않는다. 원인은 email.* Sentry 이벤트에 있다.
          mailSkippedCount += 1
        } else {
          mailFailed += 1
          captureBusinessEvent('error', 'subscription.charge.mail_failed', {
            subscriptionId: sub.id,
            orderId: orderRow!.id,
            reason: String(
              ('error' in mailRes && mailRes.error) || 'unknown',
            ).slice(0, 200),
            note: '결제는 성공했는데 결제완료 메일 발송이 실패했다.',
          })
        }
        // 푸시는 있으면 좋은 것 — 실패해도 흐름을 막지 않는다(VAPID 미등록이면
        // ensureConfigured 가 no-op 으로 돌려준다).
        await pushToUser(
          sub.user_id,
          {
            title: '결제가 완료됐어요',
            body: `${chargeAmount.toLocaleString()}원 · 곧 박스를 준비할게요`,
            url: `/mypage/orders/${orderRow!.id}`,
          },
          { category: 'order' },
        ).catch(() => {})
      } else {
        // 돈은 청구됐는데 주문/구독 갱신 실패 → 즉시 알림(수동 재정산 필요).
        captureBusinessEvent('error', 'subscription.charge.post_update_failed', {
          subscriptionId: sub.id,
          orderId: orderRow!.id,
          paymentKey: result.paymentKey,
          ordersError: ordersUpd.error?.message ?? null,
          subError: subUpd.error?.message ?? null,
        })
      }
      succeeded += 1
    } else {
      // 2-e) 실패 → 에러 코드 분류해서 분기.
      //
      // permanent (카드 만료/유효 X): 즉시 paused + requires_billing_key_renewal.
      //   재시도 의미 없음. 사용자가 카드 다시 등록할 때까지 대기.
      // transient (잔액부족/네트워크): count 증가 안 함, next_retry_at +24h.
      //   같은 카드로 시간 지나면 풀릴 가능성.
      // unknown: 기존 3-strike 정책 — count++, 3회면 paused.
      const errorCode = result.error?.code ?? null
      const errorClass = classifyBillingError(errorCode)
      const nowIso2 = new Date().toISOString()

      let shouldPause = false
      let shouldMarkRenewal = false
      let nextFailedCount = sub.failed_charge_count
      let nextRetryAt: string | null = null
      const reasonShort = describeBillingError(errorCode).short

      if (errorClass === 'permanent') {
        shouldPause = true
        shouldMarkRenewal = true
        // permanent 는 count 증가 의미 없음 — 1회 카운트만 찍어 history 보전.
        nextFailedCount = sub.failed_charge_count + 1
      } else if (errorClass === 'transient') {
        nextRetryAt = new Date(Date.now() + RETRY_COOLDOWN_MS).toISOString()
        if (isDefinitiveDecline(errorCode)) {
          // ★확정 거절(잔액부족류)은 count 를 올린다 — chargeRetrySuffix 가 이
          //   값을 앵커로 다음 재시도에 새 멱등키를 쓰기 때문. 안 올리면 접미사가
          //   :r0 에 고정돼 2회째 거절부터 토스가 저장된 거절을 15일간 재생 —
          //   고객이 잔액을 채워도 결제가 계속 실패했다(2026-08-11 go-live 감사).
          //   일시정지는 안 한다(3-strike 는 unknown 전용) — 회복 가능한 거절이다.
          nextFailedCount = sub.failed_charge_count + 1
        }
        // 그 외 transient(타임아웃류)는 count 유지 — 같은 멱등키 재사용이 맞다
        // (결과 불명 재시도가 새 청구가 되면 이중청구).
      } else {
        // unknown: 기존 3-strike.
        nextFailedCount = sub.failed_charge_count + 1
        shouldPause = nextFailedCount >= MAX_FAILED
      }

      const subUpdate: Record<string, unknown> = {
        failed_charge_count: nextFailedCount,
        last_failed_charge_at: nowIso2,
        last_failed_charge_code: errorCode,
        last_failed_charge_reason: result.error?.message ?? reasonShort,
        next_retry_at: nextRetryAt,
      }
      if (shouldPause) subUpdate.status = 'paused'
      if (shouldMarkRenewal) subUpdate.requires_billing_key_renewal = true

      // audit #79: orders/subscriptions/subscription_charges schema-drift cast.
      const untyped = supabase as unknown as {
        from: (t: string) => {
          update: (r: Record<string, unknown>) => {
            eq: (c: string, v: string) => Promise<unknown>
          }
        }
      }
      await Promise.all([
        untyped
          .from('orders')
          .update({
            payment_status: 'failed',
            order_status: 'cancelled',
            cancel_reason: result.error?.message ?? '결제 실패',
            cancelled_at: nowIso2,
          })
          .eq('id', orderRow!.id),
        untyped
          .from('subscription_charges')
          .update({
            status: 'failed',
            error_code: errorCode,
            error_message: result.error?.message,
            completed_at: nowIso2,
          })
          .eq('id', chargeRow!.id),
        untyped.from('subscriptions').update(subUpdate).eq('id', sub.id),
      ])

      // 매출 영향 이벤트 — Sentry breadcrumb 분류 가능하게 errorClass 같이 기록.
      captureBusinessEvent(
        shouldPause ? 'warning' : 'info',
        shouldMarkRenewal
          ? 'subscription.charge.renewal_required'
          : shouldPause
            ? 'subscription.charge.paused'
            : errorClass === 'transient'
              ? 'subscription.charge.transient'
              : 'subscription.charge.failed',
        {
          subscriptionId: sub.id,
          amount: chargeAmount,
          attemptCount: nextFailedCount,
          errorCode,
          errorClass,
        },
      )
      // 확정 거절(잔액부족·한도초과)·카드 만료 = 고객 사유. 토스 장애/타임아웃 같은
      // 결과 불명(unknown)만 우리 쪽 실패로 센다.
      if (errorClass === 'permanent' || isDefinitiveDecline(errorCode)) {
        declined += 1
      } else {
        failed += 1
      }

      // 푸시 알림 — order 카테고리 (push_preferences + quiet hours 자동 검사).
      // 이메일과 별개로 push ON 사용자에게도 닿게. permanent / transient /
      // unknown 별로 톤 다르게.
      const pushTitle = shouldMarkRenewal
        ? '카드 정보를 다시 등록해 주세요 💳'
        : shouldPause
          ? '정기배송이 일시중단됐어요'
          : errorClass === 'transient'
            ? '결제가 잠시 실패 — 내일 다시 시도할게요'
            : '정기배송 결제 실패'
      const pushBody = shouldMarkRenewal
        ? `${reasonShort} · 마이페이지에서 새 카드 등록`
        : shouldPause
          ? '연속 3회 실패. 마이페이지에서 카드 확인'
          : reasonShort
      // R83-6: 이전엔 `.catch(() => {})` + `void (async () => ...)` 로 fire-and-forget.
      // Vercel function 은 handler return 시 background promise 를 절단하므로 push/email
      // 이 실제로 발송 안 될 가능성 존재. cron 은 사용자 응답 latency 압박 없음 →
      // 안전하게 await. push/email 실패가 결제 전체를 막진 않게 try/catch 로 격리.
      try {
        await pushToUser(
          sub.user_id,
          {
            title: pushTitle,
            body: pushBody,
            url: '/mypage/subscriptions',
            tag: `sub-charge-failed-${sub.id}-${today}`,
            requireInteraction: shouldMarkRenewal,
          },
          { category: 'order' },
        )
      } catch {
        /* push 실패 — 다음 cycle 에 retry 됨 */
      }

      // 사용자에게 결제 실패 이메일 발송.
      try {
        // 실패 알림 수신자 조회. error 를 꺼내는 이유는 흐름을 바꾸려는 게
        // 아니라, **"메일 주소가 없어서 안 보냄" 과 "조회가 실패해서 못 보냄"이
        // 지표에서 똑같이 보이는 것**을 막기 위해서다(AGENTS 규칙8 의 교훈 —
        // 0행을 "받는 사람 없음"으로 읽어 모든 크론이 초록이던 사건).
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('id', sub.user_id)
          .maybeSingle()
        if (profileErr) {
          captureBusinessEvent('warning', 'subscription.charge_failed_notice_skipped', {
            subscriptionId: sub.id,
            reason: 'profiles_lookup_failed',
          })
        }
        if (profile?.email) {
          const { data: items, error: itemsErr } = await supabase
            .from('subscription_items')
            .select('product_name, quantity')
            .eq('subscription_id', sub.id)
            .limit(2)
          // 품목명은 알림 문구 장식이라 없으면 기본 라벨로 간다. 다만 조회
          // 실패였는지는 남긴다 — 계속 뜨면 권한/스키마 문제 신호다.
          if (itemsErr) {
            captureBusinessEvent('warning', 'subscription.charge_failed_notice_label_fallback', {
              subscriptionId: sub.id,
            })
          }
          const itemsArr = (items ?? []) as { product_name: string; quantity: number }[]
          const productLabel =
            itemsArr.length === 0
              ? '정기배송 상품'
              : itemsArr.length === 1
                ? itemsArr[0]!.product_name
                : `${itemsArr[0]!.product_name} 외 ${itemsArr.length - 1}개`
          await notifySubscriptionChargeFailed({
            email: profile.email,
            name: profile.name ?? null,
            subscriptionId: sub.id,
            productLabel,
            amount: chargeAmount,
            attemptCount: nextFailedCount,
            paused: shouldPause,
            reason: result.error?.message ?? reasonShort,
            scheduledFor: today,
            errorClass,
            nextRetryAt,
          })
        }
      } catch {
        /* email 발송 실패 — 다음 cron 시 재발송 idempotencyKey 가 차단 */
      }
    }

    // QPS 보호 — Toss 분당 제한 안 넘게 100ms 간격.
    await new Promise((r) => setTimeout(r, 100))
  }

  return NextResponse.json({
    ok: true,
    today,
    checked: targets.length,
    succeeded,
    declined,
    mailSent,
    mailFailed,
    mailSkipped: mailSkippedCount,
    failed,
    skipped,
  })
}
