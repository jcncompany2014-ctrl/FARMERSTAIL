import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { ChevronRight, AlertTriangle, Receipt, CheckCircle2, CreditCard } from 'lucide-react'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import { V3, V3FontSize, V3Radius } from '@/lib/design/tokens'
import {
  subscriptionState,
  isSubscriptionVisibleToUser,
  SUB_STATE_LABEL,
  type SubState,
} from '@/lib/subscription-state'
import { billingMethodSummary } from '@/lib/payments/billing-methods'
import { billingAuthFallbackHref } from '@/lib/payments/billing-urls'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { getTrialState } from '@/lib/payments/trial-state'
import { chargeDateFor, weekdayKo } from '@/lib/shipping-schedule'
import { getChargeTimings } from '@/lib/payments/charge-timing'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import { DELIVERY_INTERVAL_DAYS } from '@/lib/personalization/cycle'
import { petName } from '@/lib/korean'
import { recipeName, friendlyChangeReason } from '@/lib/personalization/format'
import type { Formula } from '@/lib/personalization/types'
import type { Subscription } from '@/app/account/subscriptions/types'
import PriceChangeConsentModal, {
  type PriceChangeProposal,
} from '@/app/account/subscriptions/PriceChangeConsentModal'

/**
 * /mypage/subscriptions — 앱 전용 정기배송 **요약** 화면 (2026-07-30 신설).
 *
 * # 왜 새로 만들었나 (사장님 지적)
 * 이 라우트는 `/account/subscriptions`(웹 화면)로 **리다이렉트**하고 있었다.
 * 그래서 앱에서 마이페이지 → 정기배송을 누르면 웹 화면이 CSS 토큰만 앱 색으로
 * 바뀐 채 떴다. 강아지 안의 구독 탭(앱 네이티브)과 **두 벌**이 되어 "따로 노는
 * 느낌"이 났다.
 *
 * # 역할 분담 (사장님 확정 2026-07-30)
 *  · **강아지 > 구독 탭** = 제대로 된 관리·수정 (건너뛰기·일시정지·해지·
 *    화식비율·결제수단 등록). 정본이다.
 *  · **여기(마이페이지)** = 지금 진행 중인 것만, **결제 정보 중심**으로 한눈에.
 *    바꾸는 버튼은 두지 않는다 — 누르면 그 강아지 화면으로 보낸다.
 *  · `/account/subscriptions` = **웹 전용**으로 남긴다(손대지 않음).
 *
 * # 클라이언트 코드가 없는 이유
 * 목록이 짧고 액션이 없다. `?focus=`(푸시·메일이 보냄) 강조와 `?new=1`(카드
 * 등록 직후) 안내는 서버 렌더로 충분하다 — JS 를 안 실어 첫 화면이 빠르다.
 *
 * # ★ 금액 변경 동의 모달을 여기서도 띄운다
 * 이 게이트는 원래 `/account/subscriptions` 에만 있었다. 앱을 리다이렉트에서
 * 떼어내면 **앱 사용자에게 동의 절차가 사라진다** — 금액이 바뀌는데 동의를
 * 못 받는 상태가 된다. 그래서 같은 컴포넌트를 그대로 재사용한다(로직 복제
 * 금지). 그 모달은 웹 FD 토큰(`--fd-*`)을 쓰므로 앱 톤으로 스코프 스왑해서
 * 감싼다 — `/account/subscriptions/page.tsx` 가 쓰는 것과 같은 방식이다.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '정기배송',
  robots: { index: false, follow: false },
}

/** yyyy-mm-dd → "8월 4일 (화)". */
function dateLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일 (${weekdayKo(iso)})`
}

function krw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/**
 * 히어로 금액 — 숫자와 단위('원')를 나눠 그린다.
 *
 * `tabular-nums` 를 **쓰지 않는다**: 그건 숫자를 열로 정렬할 때 쓰는 것이고,
 * 큰 금액 하나에 쓰면 좁은 '1' 이 '0' 만큼 자리를 먹어 "153,100" 앞이 벌어진다
 * (사장님 2026-07-30 "숫자부분이 좀 어색"). '원' 은 단위라 작고 가볍게 —
 * 같은 크기면 숫자와 경쟁한다.
 */
function HeroAmount({ value }: { value: number }) {
  return (
    <span>
      {value.toLocaleString('ko-KR')}
      <span
        style={{ fontSize: '0.58em', fontWeight: 700, marginLeft: 2 }}
      >
        원
      </span>
    </span>
  )
}

// 라벨은 lib/subscription-state 정본. 여기선 색만 고른다.
// yellow(마커 배경색)를 글자색으로 쓰면 1.69:1 로 사실상 안 보인다 →
// yellowInk(4.64:1). 강아지 구독 탭의 '시작 전'과 **같은 값**이다(2026-07-30).
// ★cancelled 에 inkFaint(1.9:1) 를 쓰던 것도 고쳤다 — AGENTS.md 가 "텍스트
//  금지"라 못 박은 색이고, 10px 칩이 배경에 그대로 녹았다(2026-08-07).
const STATE_COLOR: Record<SubState, string> = {
  needs_card: V3.yellowInk,
  active: V3.sage,
  paused: V3.inkMute,
  card_failed: V3.sale,
  cancelled: V3.inkMute,
}

export default async function AppSubscriptionsSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; focus?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  // getSafeUser — 쿠키의 refresh token 이 만료면 getUser() 는 **throw** 한다
  // (에러 반환이 아니라 예외). 그대로 두면 로그인 화면 대신 500 이 뜬다.
  const user = await getSafeUser(supabase)
  if (!user) redirect('/login?next=/mypage/subscriptions')

  const { data, error: subsErr } = await supabase
    .from('subscriptions')
    // ★`select('*')` 금지 (2026-08-08 보안 재감사) — 빌링키·서버 전용 칸이
    //  통째로 브라우저로 갔다. 카드 등록 여부는 has_billing_key 계산
    //  컬럼(20260808000100)으로 받는다.
    .select(
      'id, dog_id, status, interval_weeks, coverage_weeks, fresh_ratio, ' +
        'next_delivery_date, total_deliveries, ' +
        'total_amount, subtotal, shipping_fee, created_at, ' +
        'has_billing_key, billing_customer_key, billing_card_brand, ' +
        'billing_card_last4, failed_charge_count, next_retry_at, ' +
        'last_failed_charge_reason, requires_billing_key_renewal, ' +
        'subscription_items(*), dogs(id, name, photo_url)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // ★하단 탭 "정기배송" 의 첫 화면(2026-09-21). 구독이 없는 강아지에게는 여기서
  //   바로 시작 버튼을 준다 — 예전엔 "강아지 화면에서 시작할 수 있어요" 라고만
  //   말해서 어르신은 그 화면을 못 찾았다. 분석(승인된 맞춤 식단)이 없으면
  //   설문부터 — /plan 은 식단이 있어야 레시피를 고를 수 있다.
  const [{ data: myDogs }, { data: formulaDogs }] = await Promise.all([
    supabase.from('dogs').select('id, name').eq('user_id', user.id).order('created_at'),
    supabase.from('dog_formulas').select('dog_id').eq('user_id', user.id),
  ])
  const dogsWithFormula = new Set((formulaDogs ?? []).map((f) => f.dog_id))

  /**
   * ★ 조회 실패를 "구독 없음"으로 그리지 않는다 (2026-07-30).
   *
   * `error` 를 안 받으면 실패와 빈 결과가 같은 모양(`data === null`)이 된다.
   * 그러면 **결제가 걸려 매주 돈이 빠져나가는 고객에게** "진행 중인 정기배송이
   * 없어요 · 강아지 화면에서 시작할 수 있어요" 가 뜬다 — 이미 하고 있는 걸
   * 시작하라고 권하는 화면이다. 중복 신청까지 유도할 수 있다.
   * 이 화면은 상태를 보는 곳이므로, 못 읽었으면 **못 읽었다고 말한다.**
   */
  if (subsErr) {
    return (
      <main className="px-5 pt-4 pb-10" style={{ background: V3.paper }}>
        <section
          className="px-5 py-6"
          style={{
            background: V3.paperHi,
            border: `1px solid ${V3.sale}`,
            borderRadius: V3Radius.sm,
          }}
        >
          <p className="text-[13px] font-bold" style={{ color: V3.ink }}>
            정기배송 정보를 불러오지 못했어요
          </p>
          <p
            className="mt-1.5 text-[12px] leading-relaxed"
            style={{ color: V3.inkMute }}
          >
            잠시 뒤에 다시 열어봐 주세요. 계속 이러면 알려주세요 — 진행 중인
            정기배송은 그대로 있어요.
          </p>
          <Link
            href="/mypage/orders"
            className="inline-block mt-4 px-4 py-2.5 text-[12.5px] font-bold"
            style={{
              background: V3.ink,
              color: V3.paper,
              borderRadius: V3Radius.sm,
            }}
          >
            결제·주문 내역 보기
          </Link>
        </section>
      </main>
    )
  }

  // ★`as unknown as` — has_billing_key 는 PostgREST **계산 컬럼**(20260808000100)
  //  이라 lib/supabase/types.ts(테이블 스키마 생성물)에 없다. 생성 타입과
  //  도메인 타입이 겹치지 않으므로 한 단계 경유한다.
  const all = (data ?? []) as unknown as Subscription[]

  /**
   * 보여줄 구독.
   *
   * # ★ '시작 전'(needs_card)도 보여준다 (사장님 제보 2026-07-30)
   * 처음엔 `isSubscriptionVisibleToUser` 하나로 걸렀는데, 그 규칙은 needs_card 를
   * 숨긴다. 그래서 결제수단만 안 넣은 구독이 있는 사람에게 **화면이 통째로 비어**
   * "아직 시작한 정기배송이 없어요" 가 떴다 — 정작 153,100원짜리 구독이 결제만
   * 기다리고 있는데. 게다가 위 경고 배너는 바로 그 needs_card 를 알려주려고 만든
   * 것이라, 필터가 배너까지 같이 죽였다. 빈 화면에 '등록하러 가기' 버튼 하나만
   * 남아서 한 번 더 눌러 강아지 화면으로 건너가야 했다("너무 비효율적이지 않냐").
   *
   * 원래 규칙이 막으려던 건 **'유령'** 이다 — 결제 한 번 없이 해지된 것
   * (cancelled + 0회). 그건 계속 숨긴다. 살아 있는 needs_card 는 고객이 **조치할
   * 게 있는** 상태라 반드시 보여야 한다.
   */
  const visible = all.filter(
    (s) => isSubscriptionVisibleToUser(s) || subscriptionState(s) === 'needs_card',
  )

  // 문제 있는 것 먼저 — 조치가 필요한 걸 스크롤 없이 보게.
  const order: Record<SubState, number> = {
    card_failed: 0,
    needs_card: 1,
    active: 2,
    paused: 3,
    cancelled: 4,
  }
  const rows = [...visible].sort(
    (a, b) => order[subscriptionState(a)] - order[subscriptionState(b)],
  )

  // ── 다음 결제 = 카드가 걸린 구독 중 결제일이 가장 가까운 것, 금액은 그 날 합계.
  //    (강아지가 여러 마리면 같은 날 함께 빠져나가므로 합계가 맞다.)
  //
  // ★next_delivery_date 는 **발송일**이다(2026-10-01 일정 변경). 결제일은 결제 시점으로 정한다 —
  //   일반 = 발송 3일 전 토요일(조리 직전), 서포터즈 체험 구간 = 발송일(chargeDateFor). 예전엔 발송일을 그대로
  //   '다음 결제'라 불렀다. 결제 시점을 조회하지 못하면(null) 결제일을 지어내지 않는다 — 그때는 '어느 발송분의
  //   결제인지'만 말한다(서포터즈에게 토요일 결제를 보이면 안 된다 — 사장님).
  const chargeTimings = await getChargeTimings([user.id])
  const chargeTiming = chargeTimings ? (chargeTimings.get(user.id) ?? null) : null
  /** 이 구독의 다음 결제일 — 결제 시점을 모르면 null. */
  const chargeIsoOf = (s: Subscription): string | null =>
    s.next_delivery_date && chargeTiming ? chargeDateFor(s.next_delivery_date, chargeTiming) : null
  const chargeable = visible.filter(
    (s) =>
      s.has_billing_key &&
      s.next_delivery_date &&
      subscriptionState(s) === 'active',
  )
  // 결제 시점은 사용자 단위라 모든 구독에 같다 — 발송일 순서 = 결제일 순서. 묶음도 발송일로 한다.
  const nextDate = chargeable
    .map((s) => s.next_delivery_date!)
    .sort()
    .at(0)
  const dueNext = nextDate
    ? chargeable.filter((s) => s.next_delivery_date === nextDate)
    : []
  /** 히어로가 말할 결제일 — 모르면 null(발송분으로만 말한다). */
  const nextChargeIso = dueNext[0] ? chargeIsoOf(dueNext[0]) : null
  const nextSubtotal = dueNext.reduce((sum, s) => sum + (s.total_amount ?? 0), 0)

  /**
   * ★ 실제로 빠져나갈 금액 — 자동 할인까지 적용한 값 (2026-07-30).
   *
   * `subscriptions.total_amount` 는 할인 **전** 금액이고, 등급·이벤트 할인은
   * 카드를 긁는 순간에만 적용됐다. 그래서 나무 등급 고객은 이 화면에서
   * "153,100원" 을 보고 실제로는 137,790원이 나갔다 — **화면에 적힌 금액이 실제
   * 청구액이 아니었다.** 등급 화면이 약속한 혜택을 확인할 방법도 영수증뿐이었다.
   *
   * 청구 크론이 쓰는 `resolveAutoDiscount` 를 그대로 부른다 — 미리보기와 실제가
   * 같은 함수에서 나와야 갈라지지 않는다.
   *
   * **구독별로** 계산해서 더한다. 청구도 구독 1건씩 따로 하므로, 합계에 할인을
   * 한 번 적용하면 원 단위 반올림이 어긋난다.
   */
  const [discounts, trial] = await Promise.all([
    Promise.all(
      dueNext.map((s) =>
        resolveAutoDiscount({ userId: user.id, subtotal: s.total_amount ?? 0, subscriptionId: s.id }),
      ),
    ),
    getTrialState(user.id),
  ])
  const nextDiscount = discounts.reduce((sum, d) => sum + d.discountAmount, 0)
  const nextAmount = discounts.reduce((sum, d) => sum + d.chargeAmount, 0)
  // 같은 사용자라 할인 사유는 하나다. 이름은 첫 항목에서 가져온다.
  const discountLabel = discounts.find((d) => d.label)?.label ?? null

  // ── 결제수단: 살아있는 구독들이 같은 수단이면 한 줄로, 다르면 줄마다 보여준다.
  const methods = new Set(
    chargeable.map((s) =>
      billingMethodSummary({
        registered: true,
        brand: s.billing_card_brand,
        last4: s.billing_card_last4,
      }) ?? '등록됨',
    ),
  )
  const oneMethod = methods.size === 1 ? [...methods][0] : null

  // ── 금액 변경 동의 게이트 (웹 페이지와 동일 로직 — 앱에서 사라지면 안 된다).
  let priceProposal: PriceChangeProposal | null = null
  {
    const { data: pendingRows, error: pendingErr } = await supabase
      .from('dog_formulas')
      .select('dog_id, cycle_number, formula, reasoning')
      .eq('user_id', user.id)
      .eq('approval_status', 'pending_approval')
      .order('created_at', { ascending: false })
    // 이 조회가 실패하면 **금액 변경 동의 모달이 조용히 사라진다** — 동의 없이
    // 금액이 바뀔 수 있는 상태다. 화면은 계속 그리되(구독 정보는 봐야 한다)
    // 사람이 알 수 있게 올린다. 동의 게이트 자체는 청구 쪽에서 3일 타임아웃으로
    // 다시 걸리므로 여기서 화면을 막지는 않는다.
    if (pendingErr) {
      captureBusinessEvent('error', 'subscription.price_consent.query_failed', {
        userId: user.id,
        dbError: pendingErr.message,
      })
    }
    type PendingRow = {
      dog_id: string
      cycle_number: number
      formula: {
        lineRatios: Formula['lineRatios']
        toppers: Formula['toppers']
        priceChange?: { from: number; to: number; forced: boolean }
      }
      reasoning: Array<{ ruleId: string }> | null
    }
    const hit = ((pendingRows ?? []) as unknown as PendingRow[]).find(
      (r) => r.formula?.priceChange,
    )
    if (hit?.formula.priceChange) {
      const { data: dogRow } = await supabase
        .from('dogs')
        .select('name')
        .eq('id', hit.dog_id)
        .maybeSingle()
      const dogName = (dogRow as { name?: string } | null)?.name ?? '우리 아이'
      priceProposal = {
        dogId: hit.dog_id,
        dogName,
        cycleNumber: hit.cycle_number,
        recipeLabel: recipeName(hit.formula as unknown as Formula),
        reason: friendlyChangeReason(
          hit.reasoning ?? [],
          hit.formula.priceChange.forced,
        ),
        forced: hit.formula.priceChange.forced,
        priceFrom: hit.formula.priceChange.from,
        priceTo: hit.formula.priceChange.to,
      }
    }
  }

  // ── 2026-10-01 사장님 B안: 이 화면 카드는 전부 둥글게(12). 바로 앞 분석·플랜 화면이 둥근
  //    카드라 각진 카드면 결제 직후 다른 앱 같았다. 앱 전체 모서리 통일은 결정 목록.
  const card: React.CSSProperties = {
    background: V3.paperHi,
    border: `1px solid ${V3.rule}`,
    borderRadius: V3Radius.md,
  }
  // 머리말 — 한글·13px·굵게(AGENTS 규칙85).
  const kicker: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: V3.inkMute,
  }
  // 알약 표시(상태·할인·날짜) — 글자색과 같은 계열 옅은 바탕.
  const pill = (color: string): React.CSSProperties => ({
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    borderRadius: V3Radius.pill,
    padding: '2px 9px',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  })

  // ── 서포터즈 혜택 — 회차가 아니라 **기간·총액**으로(사장님 2026-10-01 "56일치 밥이 총 400원").
  //    숫자는 청구와 같은 판정(lib/payments/trial — 100원 구간 먼저, 단가 최소 100원).
  const trialLive = !!trial && (trial.cheap_remaining > 0 || trial.half_remaining > 0)
  const trialBlock = trialLive && trial ? (() => {
    const cheap = trial.cheap_remaining
    const half = trial.half_remaining
    const price = Math.max(100, Math.trunc(trial.cheap_price))
    const segs = [
      ...Array.from({ length: cheap }, () => 'cheap' as const),
      ...Array.from({ length: half }, () => 'half' as const),
    ]
    return (
      <div>
        <p style={kicker}>서포터즈 혜택</p>
        <p
          className="mt-1 font-bold"
          style={{ fontSize: V3FontSize.base, color: V3.ink, lineHeight: 1.4, wordBreak: 'keep-all' }}
        >
          {cheap > 0
            ? `남은 ${cheap * DELIVERY_INTERVAL_DAYS}일치 밥이 총 ${(cheap * price).toLocaleString('ko-KR')}원이에요`
            : `남은 ${half * DELIVERY_INTERVAL_DAYS}일치 밥은 반값이에요`}
        </p>
        {/* 남은 박스(2주치) 하나 = 막대 한 칸. 첫 칸 = 다음 결제. */}
        <div className="mt-2.5 flex items-center" style={{ gap: 3 }} aria-hidden>
          {segs.map((ph, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: 8,
                borderRadius: V3Radius.pill,
                marginLeft: i === cheap && cheap > 0 ? 6 : 0,
                background:
                  i === 0
                    ? V3.accent
                    : ph === 'cheap' || cheap === 0
                      ? `color-mix(in srgb, ${V3.accent} 35%, transparent)`
                      : V3.paperDeep,
              }}
            />
          ))}
        </div>
        <div
          className="mt-1.5 flex justify-between gap-2"
          style={{ fontSize: V3FontSize.xs, color: V3.inkMute, wordBreak: 'keep-all' }}
        >
          {cheap > 0 && <span>{price.toLocaleString('ko-KR')}원 · {cheap * DELIVERY_INTERVAL_DAYS}일</span>}
          {half > 0 && <span>반값 · {half * DELIVERY_INTERVAL_DAYS}일</span>}
          <span>그다음 정상가</span>
        </div>
        <p className="mt-2" style={{ fontSize: V3FontSize.sm, color: V3.inkMute }}>
          가격이 바뀌기 전에 미리 알려드릴게요
        </p>
      </div>
    )
  })() : null

  return (
    <main className="px-5 pt-4 pb-10" style={{ background: V3.paper }}>
      {sp.new === '1' && (
        <div
          className="mb-3 flex items-center gap-2.5 px-4 py-3"
          style={{
            background: `color-mix(in srgb, ${V3.sage} 12%, transparent)`,
            borderRadius: V3Radius.md,
          }}
        >
          <CheckCircle2 className="shrink-0" size={22} strokeWidth={2.2} style={{ color: V3.sage }} aria-hidden />
          <span>
            <span className="block font-bold" style={{ fontSize: V3FontSize.base, color: V3.sage }}>
              정기배송이 시작됐어요
            </span>
            <span className="block" style={{ fontSize: V3FontSize.sm, color: V3.sage }}>
              다음 결제일에 자동으로 결제돼요
            </span>
          </span>
        </div>
      )}

      {/* ── 조치가 필요한 것 — 어느 강아지인지 이름을 붙여 바로 보낸다 ── */}
      {rows
        .filter((s) => {
          const st = subscriptionState(s)
          return st === 'card_failed' || st === 'needs_card'
        })
        .map((s) => {
          const st = subscriptionState(s)
          const dog = s.dogs?.name ? petName(s.dogs.name) : '우리 아이'
          // ★ 강아지 화면을 거치지 않고 **바로 등록 화면**으로 보낸다
          //   (사장님 2026-07-30 "등록하기 누르면 또 넘어가 너무 비효율적").
          //   customerKey 가 없으면 등록 화면이 '잘못된 접근' 으로 막히므로
          //   그때만 강아지 화면(키를 새로 발급해 주는 곳)으로 우회한다.
          const href = s.billing_customer_key
            ? billingAuthFallbackHref({
                subscriptionId: s.id,
                customerKey: s.billing_customer_key,
              })
            : s.dog_id
              ? `/dogs/${s.dog_id}/subscription`
              : '/mypage/orders'
          return (
            <Link
              key={`alert-${s.id}`}
              href={href}
              className="flex items-start gap-2.5 mb-3 px-4 py-3.5 active:opacity-70"
              style={{ ...card, borderColor: V3.sale }}
            >
              <AlertTriangle
                className="w-5 h-5 shrink-0 mt-px"
                strokeWidth={2.4}
                style={{ color: V3.sale }}
              />
              <span className="flex-1 min-w-0">
                <span
                  className="block font-bold"
                  style={{ fontSize: V3FontSize.base, color: V3.ink }}
                >
                  {st === 'needs_card'
                    ? `${dog} 정기배송은 아직 시작 전이에요`
                    : `${dog} 결제가 되지 않았어요`}
                </span>
                <span
                  className="block mt-0.5 leading-relaxed"
                  style={{ fontSize: V3FontSize.sm, color: V3.inkMute }}
                >
                  {st === 'needs_card'
                    ? '결제수단을 등록하면 첫 배송일이 잡혀요.'
                    : '결제수단을 다시 등록하면 정기배송이 이어져요.'}
                </span>
              </span>
              <ChevronRight
                className="w-5 h-5 shrink-0 mt-px"
                strokeWidth={2.4}
                style={{ color: V3.inkFaint }}
              />
            </Link>
          )
        })}

      {/* ── 주인공: 결제 정보 (+ 서포터즈 혜택을 같은 카드 안에) ──
          예전엔 서포터즈 카드와 결제 카드가 간격 없이 붙어 테두리가 겹쳐 보였다(사장님 캡처). */}
      {nextDate ? (
        <section className="px-4 py-5" style={card}>
          <div className="flex items-center justify-between gap-2">
            <span style={kicker}>다음 결제</span>
            {/* ★지난 날짜를 "다음 결제" 로 보여주지 않는다 (2026-08-07).
                결제가 미끄러지면 next_delivery_date 가 갱신되지 않는다.
                ★결제일 = chargeDateFor(발송일, 결제 시점)(2026-10-01). 결제 시점을 모르면 결제 요일을
                단정하지 않고 "M월 D일 (화) 발송분" — 다음 결제가 어느 박스 몫인지만 말한다. */}
            <span style={pill(V3.ink)}>
              {nextChargeIso
                ? nextChargeIso < todayKstIsoDate()
                  ? `${dateLabel(nextChargeIso)} 예정이었어요 · 확인 중`
                  : dateLabel(nextChargeIso)
                : nextDate < todayKstIsoDate()
                  ? `${dateLabel(nextDate)} 발송분 · 확인 중`
                  : `${dateLabel(nextDate)} 발송분`}
            </span>
          </div>
          <p
            className="mt-1.5 font-black"
            style={{ fontSize: 34, color: V3.ink, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            <HeroAmount value={nextAmount} />
          </p>
          {/* 할인이 있으면 무엇이 빠졌는지 한 줄. 원래 금액은 취소선으로 —
              비율(%)은 쓰지 않는다(사장님 브랜드 보이스 규칙). */}
          {nextDiscount > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                style={{
                  fontSize: V3FontSize.sm,
                  color: V3.inkMute,
                  textDecoration: 'line-through',
                }}
              >
                {krw(nextSubtotal)}
              </span>
              <span style={pill(V3.sage)}>
                {discountLabel ?? '할인'} −{krw(nextDiscount)}
              </span>
            </div>
          )}
          <p
            className="mt-3 flex items-center gap-1.5"
            style={{ fontSize: V3FontSize.sm, color: V3.inkSoft }}
          >
            <CreditCard className="w-[18px] h-[18px] shrink-0" strokeWidth={2} style={{ color: V3.inkMute }} aria-hidden />
            {oneMethod ?? '구독별로 결제수단이 달라요'}
          </p>
          {trialBlock && (
            <>
              <div className="my-4" style={{ borderTop: `1px dashed ${V3.rule}` }} />
              {trialBlock}
            </>
          )}
        </section>
      ) : (
        /* 결제 예정이 없을 때. '시작 전' 구독이 아래 목록에 뜨고 위에 조치
           배너도 있으므로 여기서는 짧게만 말한다 — 예전엔 이 자리가 통째로
           빈 화면이 되어 버튼 하나만 남았다(사장님 제보). */
        <>
          <section className="px-5 py-6" style={card}>
            <p className="font-bold" style={{ fontSize: V3FontSize.base, color: V3.ink }}>
              {rows.length > 0 ? '아직 결제 예정이 없어요' : '진행 중인 정기배송이 없어요'}
            </p>
            <p className="mt-1.5" style={{ fontSize: V3FontSize.sm, color: V3.inkMute }}>
              {rows.length > 0
                ? '결제수단을 등록하면 첫 결제일이 정해져요.'
                : '아래 버튼으로 바로 시작할 수 있어요.'}
            </p>
          </section>
          {/* 서포터즈인데 아직 카드 등록 전 — 혜택이 기다리고 있다는 걸 먼저 보여 준다. */}
          {trialBlock && (
            <section className="mt-3 px-4 py-5" style={card}>
              {trialBlock}
            </section>
          )}
        </>
      )}

      {/* ── 구독 없는 강아지 — 큰 시작 버튼 (하단 탭 "정기배송" 의 핵심) ── */}
      {(() => {
        const liveDogIds = new Set(rows.map((r) => r.dog_id).filter(Boolean))
        const startable = (myDogs ?? []).filter((d) => !liveDogIds.has(d.id))
        if (startable.length === 0) return null
        return (
          <section className="mt-4 px-5 py-5" style={card}>
            <p className="font-bold" style={{ fontSize: V3FontSize.md, color: V3.ink }}>
              정기배송 시작하기
            </p>
            <p className="mt-1 leading-relaxed" style={{ fontSize: V3FontSize.base, color: V3.inkMute }}>
              분석 결과에 맞춘 레시피로 2주마다 보내드려요. 다음 결제 전까지 미루거나
              그만둘 수 있어요.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {startable.map((d) => {
                const ready = dogsWithFormula.has(d.id)
                return (
                  <Link
                    key={d.id}
                    href={ready ? `/dogs/${d.id}/plan` : `/dogs/${d.id}/survey`}
                    className="flex items-center justify-between px-5"
                    style={{
                      borderRadius: V3Radius.md,
                      minHeight: 56,
                      background: ready ? V3.accent : V3.paperDeep,
                      color: ready ? V3.paper : V3.ink,
                      border: ready ? 'none' : `1px solid ${V3.rule}`,
                      fontSize: V3FontSize.md,
                      fontWeight: 800,
                    }}
                  >
                    <span>
                      {ready
                        ? `${petName(d.name)} 정기배송 시작하기`
                        : `${petName(d.name)} 설문하고 시작하기`}
                    </span>
                    <ChevronRight size={22} strokeWidth={2.4} aria-hidden />
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })()}

      {/* ── 구독별 한 장 — 관리는 강아지 화면에서 ── */}
      {rows.length > 0 && (
        <>
          <p className="mt-7 mb-2 px-1" style={kicker}>
            정기배송 {rows.length}건
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((s) => {
              const st = subscriptionState(s)
              const chipColor = STATE_COLOR[st]
              const focused = sp.focus === s.id
              const method = billingMethodSummary({
                registered: !!s.has_billing_key,
                brand: s.billing_card_brand,
                last4: s.billing_card_last4,
              })
              const dogName = s.dogs?.name ?? '정기배송'
              const photo = (s.dogs as { photo_url?: string | null } | null)?.photo_url ?? null
              return (
                <li
                  key={s.id}
                  style={{
                    ...card,
                    // 푸시·메일이 ?focus=<id> 로 보낸 그 구독을 눈에 띄게.
                    boxShadow: focused ? `0 0 0 2px ${V3.accent}` : undefined,
                  }}
                >
                  <Link
                    href={
                      s.dog_id
                        ? `/dogs/${s.dog_id}/subscription`
                        : '/mypage/orders'
                    }
                    className="flex items-center gap-3 px-4 py-3.5 active:opacity-70"
                  >
                    <span
                      className="relative shrink-0 flex items-center justify-center overflow-hidden font-bold"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: V3.paperDeep,
                        color: V3.inkMute,
                        fontSize: V3FontSize.base,
                      }}
                      aria-hidden
                    >
                      {photo ? (
                        <Image src={photo} alt="" fill sizes="44px" className="object-cover" unoptimized />
                      ) : (
                        dogName.slice(0, 1)
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span
                          className="font-bold truncate"
                          style={{ fontSize: V3FontSize.base, color: V3.ink }}
                        >
                          {dogName}
                        </span>
                        <span className="shrink-0" style={pill(chipColor)}>
                          {SUB_STATE_LABEL[st]}
                        </span>
                      </span>
                      <span
                        className="block mt-1 leading-snug"
                        style={{ fontSize: V3FontSize.sm, color: V3.inkMute, wordBreak: 'keep-all' }}
                      >
                        {krw(s.total_amount)}
                        {s.fresh_ratio ? ` · ${freshTierLabel(s.fresh_ratio)}` : ''}
                        {/* 다음 일정 — 진행 중인 구독만(정지 중이면 그 날짜는 다시 시작할 때의 기준일일 뿐).
                            결제일을 알면 "M월 D일 (토) 결제", 모르면 결제 요일을 단정하지 않고 발송일만. */}
                        {st === 'active' && s.next_delivery_date
                          ? (() => {
                              const c = chargeIsoOf(s)
                              const today = todayKstIsoDate()
                              if (c) return c < today ? ' · 결제 확인 중' : ` · ${dateLabel(c)} 결제`
                              return s.next_delivery_date < today
                                ? ' · 확인 중'
                                : ` · ${dateLabel(s.next_delivery_date)} 발송`
                            })()
                          : ''}
                        {!oneMethod && method ? ` · ${method}` : ''}
                      </span>
                    </span>
                    <ChevronRight
                      className="w-5 h-5 shrink-0"
                      strokeWidth={2.4}
                      style={{ color: V3.inkFaint }}
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Link
        href="/mypage/orders"
        className="flex items-center gap-2.5 mt-3 px-4 py-3.5 active:opacity-70"
        style={card}
      >
        <Receipt
          className="w-5 h-5 shrink-0"
          strokeWidth={2.2}
          style={{ color: V3.inkMute }}
        />
        <span className="flex-1 font-bold" style={{ fontSize: V3FontSize.base, color: V3.ink }}>
          결제·주문 내역
        </span>
        <ChevronRight
          className="w-5 h-5 shrink-0"
          strokeWidth={2.4}
          style={{ color: V3.inkFaint }}
        />
      </Link>

      {/* 동의 모달은 웹 FD 토큰을 쓰므로 앱 톤으로 스코프 스왑해 감싼다
          (/account/subscriptions/page.tsx 와 같은 방식). 로직은 손대지 않는다.

          ★ radius 토큰을 **빠짐없이** 준다 (2026-07-30 수정).
          색 토큰(--fd-coral·--fd-cream·--fd-coral-ink)은 globals.css 의 :root 에
          있어 앱에서도 해석되지만, **radius 4종은 :root 에 없다** — 웹 페이지가
          자기 래퍼 div 에서 선언한다. 처음엔 --fd-r-sheet 하나만 줘서 모달 안의
          행(row)이 `border-radius: var(--fd-r-row)` → 정의 없음으로 떨어졌다.
          앱은 radius 4 가 서명값이므로(AGENTS.md 'sm signature') 전부 4 로. */}
      {priceProposal && (
        <div
          style={
            {
              '--fd-pine': V3.ink,
              '--fd-muted': V3.inkMute,
              '--fd-line': V3.rule,
              '--fd-r-card': '4px',
              '--fd-r-row': '4px',
              '--fd-r-thumb': '4px',
              '--fd-r-sheet': '12px',
            } as React.CSSProperties
          }
        >
          <PriceChangeConsentModal proposal={priceProposal} />
        </div>
      )}
    </main>
  )
}
