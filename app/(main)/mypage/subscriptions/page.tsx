import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, CreditCard, AlertTriangle, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { V3, V3Radius } from '@/lib/design/tokens'
import {
  subscriptionState,
  isSubscriptionVisibleToUser,
  type SubState,
} from '@/lib/subscription-state'
import { billingMethodSummary } from '@/lib/payments/billing-methods'
import { weekdayKo } from '@/lib/shipping-schedule'
import { freshTierLabel } from '@/lib/subscription/freshTier'
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

const STATE_CHIP: Record<SubState, { label: string; color: string }> = {
  needs_card: { label: '시작 전', color: V3.yellow },
  active: { label: '구독 중', color: V3.sage },
  paused: { label: '일시정지', color: V3.inkMute },
  card_failed: { label: '결제 문제', color: V3.sale },
  cancelled: { label: '해지됨', color: V3.inkFaint },
}

export default async function AppSubscriptionsSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; focus?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/subscriptions')

  const { data } = await supabase
    .from('subscriptions')
    .select('*, subscription_items(*), dogs(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  const all = (data ?? []) as Subscription[]

  // 보여줄 것 = 사장님 확정 규칙(lib/subscription-state) — 카드도 안 걸고 만든
  // '유령' 구독은 숨긴다. 숨겨진 게 있으면 빈 화면에서 안내만 해준다.
  const visible = all.filter(isSubscriptionVisibleToUser)
  const hiddenNotStarted = all.filter(
    (s) => !isSubscriptionVisibleToUser(s) && subscriptionState(s) === 'needs_card',
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

  // ── 다음 결제 = 카드가 걸린 구독 중 가장 가까운 날짜, 금액은 그 날짜 합계.
  //    (강아지가 여러 마리면 같은 날 함께 빠져나가므로 합계가 맞다.)
  const chargeable = visible.filter(
    (s) => s.billing_key && s.next_delivery_date && subscriptionState(s) === 'active',
  )
  const nextDate = chargeable
    .map((s) => s.next_delivery_date!)
    .sort()
    .at(0)
  const nextAmount = nextDate
    ? chargeable
        .filter((s) => s.next_delivery_date === nextDate)
        .reduce((sum, s) => sum + (s.total_amount ?? 0), 0)
    : 0

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
    const { data: pendingRows } = await supabase
      .from('dog_formulas')
      .select('dog_id, cycle_number, formula, reasoning')
      .eq('user_id', user.id)
      .eq('approval_status', 'pending_approval')
      .order('created_at', { ascending: false })
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

  const card: React.CSSProperties = {
    background: V3.paperHi,
    border: `1px solid ${V3.rule}`,
    borderRadius: V3Radius.sm,
  }

  return (
    <main className="px-5 pt-4 pb-10" style={{ background: V3.paper }}>
      {sp.new === '1' && (
        <p
          className="mb-3 px-4 py-3 text-[12.5px] font-bold"
          style={{
            ...card,
            background: V3.paperHi,
            color: V3.sage,
            borderColor: V3.sage,
          }}
        >
          정기배송이 시작됐어요. 다음 결제일에 자동으로 결제돼요.
        </p>
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
          const href = s.dog_id
            ? `/dogs/${s.dog_id}/subscription`
            : '/mypage/subscriptions'
          return (
            <Link
              key={`alert-${s.id}`}
              href={href}
              className="flex items-start gap-2.5 mb-3 px-4 py-3.5 active:opacity-70"
              style={{ ...card, borderColor: V3.sale }}
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-px"
                strokeWidth={2.4}
                style={{ color: V3.sale }}
              />
              <span className="flex-1 min-w-0">
                <span
                  className="block text-[13px] font-bold"
                  style={{ color: V3.ink }}
                >
                  {st === 'needs_card'
                    ? `${dog} 정기배송은 아직 시작 전이에요`
                    : `${dog} 결제가 되지 않았어요`}
                </span>
                <span
                  className="block text-[11.5px] mt-0.5 leading-relaxed"
                  style={{ color: V3.inkMute }}
                >
                  {st === 'needs_card'
                    ? '결제수단을 등록하면 첫 배송일이 잡혀요.'
                    : '결제수단을 다시 등록하면 정기배송이 이어져요.'}
                </span>
              </span>
              <ChevronRight
                className="w-4 h-4 shrink-0 mt-px"
                strokeWidth={2.4}
                style={{ color: V3.inkFaint }}
              />
            </Link>
          )
        })}

      {/* ── 주인공: 결제 정보 ── */}
      {nextDate ? (
        <section className="px-5 py-5" style={card}>
          <p
            className="text-[10.5px] font-bold"
            style={{ color: V3.inkMute, letterSpacing: '0.16em' }}
          >
            NEXT PAYMENT
          </p>
          <p
            className="mt-2 text-[22px] font-black leading-snug"
            style={{ color: V3.ink, letterSpacing: '-0.02em' }}
          >
            {dateLabel(nextDate)}
          </p>
          <p
            className="mt-1 text-[16px] font-bold"
            style={{ color: V3.ink, fontVariantNumeric: 'tabular-nums' }}
          >
            {krw(nextAmount)}
          </p>

          <div
            className="mt-4 pt-4 flex items-center gap-2"
            style={{ borderTop: `1px solid ${V3.ruleSoft}` }}
          >
            <CreditCard
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={2.4}
              style={{ color: V3.inkMute }}
            />
            <span className="text-[12px]" style={{ color: V3.inkMute }}>
              결제수단
            </span>
            <span
              className="flex-1 text-right text-[12.5px] font-bold"
              style={{ color: V3.ink }}
            >
              {oneMethod ?? '구독별로 달라요'}
            </span>
          </div>
          <p
            className="mt-2.5 text-[11px] leading-relaxed"
            style={{ color: V3.inkMute }}
          >
            결제수단 변경·건너뛰기·해지는 아래에서 강아지를 선택하면 할 수 있어요.
          </p>
        </section>
      ) : (
        <section className="px-5 py-6 text-center" style={card}>
          <p className="text-[13px] font-bold" style={{ color: V3.ink }}>
            {hiddenNotStarted.length > 0
              ? '아직 시작한 정기배송이 없어요'
              : '진행 중인 정기배송이 없어요'}
          </p>
          <p
            className="mt-1.5 text-[11.5px] leading-relaxed"
            style={{ color: V3.inkMute }}
          >
            {hiddenNotStarted.length > 0
              ? '강아지 화면에서 결제수단을 등록하면 첫 배송일이 잡혀요.'
              : '강아지 화면에서 정기배송을 시작할 수 있어요.'}
          </p>
          {hiddenNotStarted[0]?.dog_id && (
            <Link
              href={`/dogs/${hiddenNotStarted[0].dog_id}/subscription`}
              className="inline-block mt-4 px-5 py-2.5 text-[12.5px] font-bold"
              style={{
                background: V3.ink,
                color: V3.paper,
                borderRadius: V3Radius.pill,
              }}
            >
              등록하러 가기
            </Link>
          )}
        </section>
      )}

      {/* ── 구독별 한 줄 — 관리는 강아지 화면에서 ── */}
      {rows.length > 0 && (
        <>
          <p
            className="mt-7 mb-2 px-1 text-[10.5px] font-bold"
            style={{ color: V3.inkMute, letterSpacing: '0.16em' }}
          >
            SUBSCRIPTIONS · {rows.length}건
          </p>
          <ul className="overflow-hidden" style={card}>
            {rows.map((s, i) => {
              const st = subscriptionState(s)
              const chip = STATE_CHIP[st]
              const focused = sp.focus === s.id
              const method = billingMethodSummary({
                registered: !!s.billing_key,
                brand: s.billing_card_brand,
                last4: s.billing_card_last4,
              })
              return (
                <li
                  key={s.id}
                  style={{
                    borderTop: i === 0 ? undefined : `1px solid ${V3.ruleSoft}`,
                    // 푸시·메일이 ?focus=<id> 로 보낸 그 구독을 눈에 띄게.
                    boxShadow: focused ? `inset 3px 0 0 ${V3.accent}` : undefined,
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
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span
                          className="text-[13.5px] font-bold truncate"
                          style={{ color: V3.ink }}
                        >
                          {s.dogs?.name ?? '정기배송'}
                        </span>
                        <span
                          className="shrink-0 text-[10px] font-bold px-1.5 py-0.5"
                          style={{
                            color: chip.color,
                            border: `1px solid ${chip.color}`,
                            borderRadius: V3Radius.xs,
                          }}
                        >
                          {chip.label}
                        </span>
                      </span>
                      <span
                        className="block mt-1 text-[11.5px] truncate"
                        style={{ color: V3.inkMute }}
                      >
                        {krw(s.total_amount)}
                        {s.fresh_ratio ? ` · ${freshTierLabel(s.fresh_ratio)}` : ''}
                        {s.next_delivery_date
                          ? ` · ${dateLabel(s.next_delivery_date)}`
                          : ''}
                        {!oneMethod && method ? ` · ${method}` : ''}
                      </span>
                    </span>
                    <ChevronRight
                      className="w-4 h-4 shrink-0"
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
          className="w-4 h-4 shrink-0"
          strokeWidth={2.4}
          style={{ color: V3.inkMute }}
        />
        <span className="flex-1 text-[13px] font-bold" style={{ color: V3.ink }}>
          결제·주문 내역
        </span>
        <ChevronRight
          className="w-4 h-4 shrink-0"
          strokeWidth={2.4}
          style={{ color: V3.inkFaint }}
        />
      </Link>

      {/* 동의 모달은 웹 FD 토큰을 쓰므로 앱 톤으로 스코프 스왑해 감싼다
          (/account/subscriptions/page.tsx 와 같은 방식). 로직은 손대지 않는다. */}
      {priceProposal && (
        <div
          style={
            {
              '--fd-pine': V3.ink,
              '--fd-muted': V3.inkMute,
              '--fd-line': V3.rule,
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
