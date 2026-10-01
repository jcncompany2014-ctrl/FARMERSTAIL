import Link from 'next/link'
import { trialPricing, type TrialState } from '@/lib/payments/trial'
import {
  Repeat,
  CalendarDays,
  Truck,
  ArrowRight,
  Bell,
  PauseCircle,
} from 'lucide-react'
import type { ActiveSubscription } from './types'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import {
  subscriptionState,
  SUB_STATE_LABEL,
  type SubState,
} from '@/lib/subscription-state'
import {
  describeUpcomingBox,
  shipTimingLabel,
  weekdayKo,
  type ChargeTiming,
} from '@/lib/shipping-schedule'

/**
 * 페이지(dogs/[id]/page.tsx)가 구독 행에 덧붙여 내려주는 '지금 말할 박스' 재료(2026-10-01 일정 변경).
 * DogDetailClient 를 거쳐 행 그대로 온다. 없으면(다른 호출처) 결제 시점 모름·결제된 박스 없음으로 본다.
 *  · charge_timing — 일반 = 발송 3일 전 토요일(조리 직전), 서포터즈 체험 구간 = 발송일. null = 조회 실패.
 *  · has_paid_preparing_order — 결제됐고 아직 안 나간 박스(결제됨 + 발송 대기 주문)가 있다.
 *  · paid_preparing_at — 그 박스의 결제 시각. 이번 박스 발송일 정본(paidBoxShipIso)의 재료 — 결제 뒤 미루기에도 맞다.
 */
export type UpcomingBoxHints = {
  charge_timing?: ChargeTiming | null
  has_paid_preparing_order?: boolean
  paid_preparing_at?: string | null
}

/** yyyy-mm-dd → '10월 13일 (화)'. KST 날짜 문자열에서 직접 뽑는다(Date 로 파싱해 서버 tz 로 포맷하면 하루 밀린다). */
function dateLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일 (${weekdayKo(iso)})`
}

/**
 * 진행중 정기배송 카드 — 강아지 단위.
 *
 * 케이스
 *  · 활성/일시정지 구독 1개 이상 → 상태 + 다음 배송일 + 결제 + 현재 레시피
 *  · 구독 없고 처방 있음 → "정기배송 시작" CTA
 *  · 구독 없고 처방 없음 → 카드 자체 숨김 (분석 카드가 이미 onboarding 안내)
 *
 * # 상태 표기 (2026-07-16 수정)
 * status 컬럼만 보면 거짓말한다 — 카드 미등록(billing_key NULL)인 '시작 전'을
 * paused 로 오표시했다. lib/subscription-state.subscriptionState() 로 판정한다.
 *
 * # 현재 레시피 (2026-07-16)
 * dog_formulas(추천 알고리즘)가 아니라 subscription_items(실제 배송 박스)를 보여준다.
 * 예전엔 CurrentFormulaCard 가 옛 추천 비율을 '현재 박스'라 잘못 표기했다.
 */
// 라벨은 lib/subscription-state 정본. 여기선 배지 색만 고른다.
// (예전엔 여기만 '진행중'·'결제수단 재등록 필요' 라고 달리 불렀다 — 같은
//  구독이 강아지 카드·구독 탭·마이페이지에서 세 이름으로 보였다.)
const STATE_BADGE: Record<SubState, string> = {
  needs_card: 'bg-terracotta/15 text-terracotta',
  active: 'bg-moss/15 text-moss',
  paused: 'bg-muted/15 text-muted',
  card_failed: 'bg-sale/15 text-sale',
  cancelled: 'bg-muted/15 text-muted',
}
export default function SubscriptionCard({
  subscriptions,
  dogName,
  dogId,
  hasFormula,
  trial = null,
  chargePreview,
}: {
  subscriptions: ActiveSubscription[]
  dogName: string
  dogId: string
  hasFormula: boolean
  /** 체험단 가격표 — 있으면 금액이 체험가로 표시된다(청구와 같은 판정) */
  trial?: TrialState | null
  /** 구독별 다음 결제액(청구와 같은 resolveAutoDiscount) — 있으면 이것이 우선 */
  chargePreview?: Record<string, number>
}) {
  if (subscriptions.length === 0 && !hasFormula) return null

  // D-day 는 KST 자정 기준. 서버(UTC) 자정으로 세면 홈 ActiveDogCard(KST 기준)와
  // 같은 배송인데 하루 어긋난다(2026-07-17 정합). next_delivery_date 는 KST 달력 날짜.
  // eslint-disable-next-line react-hooks/purity
  const nowKstMs = Date.now() + 9 * 3600 * 1000
  const todayKstIso = new Date(nowKstMs).toISOString().slice(0, 10)
  const todayKstStart = new Date(todayKstIso + 'T00:00:00+09:00').getTime()
  /** KST 날짜까지 남은 날(오늘 = 0). */
  const daysUntil = (iso: string) =>
    Math.round((new Date(`${iso}T00:00:00+09:00`).getTime() - todayKstStart) / 86_400_000)

  return (
    <section className="px-5 mt-3">
      <div className="bg-bg-3 rounded border border-rule p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Repeat className="w-3.5 h-3.5 text-moss" strokeWidth={2} />
            <span className="kicker">정기배송</span>
          </div>
          {subscriptions.length > 0 && (
            <Link
              href="/mypage/subscriptions"
              className="text-[10.5px] text-muted hover:text-text"
            >
              전체 관리
            </Link>
          )}
        </div>

        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-start gap-2.5 py-1">
            <p className="text-[12px] text-text leading-relaxed">
              {/* '매월' 은 옛 4주 모델 문구 — 지금은 2주마다다(2026-07-16). */}
              {dogName} 맞춤 박스를 2주마다 받아보세요. 분석 결과 그대로 g 단위까지
              계산해 보내드려요.
            </p>
            {/* 레시피 고르는 단계(/plan)부터 — /order 직행은 레시피 선택을
                건너뛰어 주문 화면이 알고리즘 원본을 보여준다(2026-07-15). */}
            <Link
              href={`/dogs/${dogId}/plan`}
              className="inline-flex items-center gap-1 mt-1 px-3.5 py-2 rounded-full bg-terracotta text-white text-[12px] font-bold hover:bg-terracotta/90 transition"
            >
              <Truck className="w-3 h-3" strokeWidth={2.4} />
              정기배송 시작
              <ArrowRight className="w-3 h-3" strokeWidth={2.4} />
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {subscriptions.map((s) => {
              /**
               * ★지금 말할 박스 — lib/shipping-schedule describeUpcomingBox 정본(2026-10-01).
               * 일반 고객은 발송 3일 전 토요일에 결제되고, 청구 크론이 곧바로 next_delivery_date 를 다음
               * 주기(+14)로 민다. 그대로 세면 사흘 뒤 나갈 박스를 두고 "17일 후"라고 말한다.
               *  · in_progress — 결제된 박스가 그 화요일에 나간다(D-N 은 그 발송일 기준).
               *  · charge_check — 결제일이 지났는데 결제 증거가 없다 → 날짜를 약속하지 않는다.
               *  · upcoming — 예전 그대로(next_delivery_date = 발송일 기준 D-N).
               */
              const hints = s as ActiveSubscription & UpcomingBoxHints
              const box = describeUpcomingBox({
                nextDeliveryDate: s.next_delivery_date,
                timing: hints.charge_timing ?? null,
                hasPaidPreparingOrder: hints.has_paid_preparing_order === true,
                paidAt: hints.paid_preparing_at ?? null,
                today: todayKstIso,
              })
              const dDay = box ? daysUntil(box.shipIso) : null
              // 날짜 라벨 — 요일까지. 발송은 화요일 고정이라 요일이 곧 "언제 오는지"의
              // 핵심 정보다. 구독 탭·마이페이지는 이미 요일을 보여주는데 여기만
              // 빠져 있었다(2026-08-07 감사).
              const nextLabel = box ? dateLabel(box.shipIso) : ''
              const state = subscriptionState(s)
              const meta = {
                label: SUB_STATE_LABEL[state],
                badge: STATE_BADGE[state],
              }
              const needsCard = state === 'needs_card' || state === 'card_failed'
              // 카드 등록 링크 — billing-auth 는 customerKey 가 필수라, 안 실으면
              // '잘못된 접근이에요' 막다른 길이 된다(2026-07-17 수정). 구독 생성 시
              // billing_customer_key 가 저장되므로 그대로 싣고, 없는 레거시면 구독탭
              // (client goCard 가 fallback 키 생성)으로 우회.
              const cardHref = s.billing_customer_key
                ? `/subscribe/billing-auth?subscriptionId=${encodeURIComponent(s.id)}&customerKey=${encodeURIComponent(s.billing_customer_key)}`
                : `/dogs/${dogId}/subscription`
              // 실제 배송 레시피(정본). 없으면(레거시) 화식 티어 라벨로 폴백.
              const recipe = (s.subscription_items ?? [])
                .map((i) => i.product_name)
                .filter(Boolean)
                .join(' · ')
              return (
                <li
                  key={s.id}
                  className="rounded border border-rule px-4 py-3 flex flex-col gap-1.5 bg-bg-2/30"
                >
                  {/* UI audit H2: 좌측 (badge + recipe) flex-1 min-w-0 + truncate.
                      긴 가격 (1,234,567원/2주) 시 라벨이 잘리되 layout 안 깨짐. */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span
                        className={`shrink-0 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[12px] font-bold text-text leading-snug">
                        {recipe || freshTierLabel(s.fresh_ratio)}
                      </span>
                    </div>
                    <span className="shrink-0 text-[12px] font-bold text-text font-mono whitespace-nowrap tabular-nums">
                      {(chargePreview?.[s.id] ?? trialPricing(trial, s.total_amount)?.chargeAmount ?? s.total_amount).toLocaleString()}원/2주
                    </span>
                  </div>
                  {/* 레시피를 위에 이름으로 보여줬으면, 화식 비율 티어는 보조로 한 줄 더. */}
                  {recipe && (
                    <div className="text-[10.5px] text-muted">
                      {freshTierLabel(s.fresh_ratio)}
                    </div>
                  )}
                  {/* UI audit M4: meta row flex-wrap — 좁은 카드 + 긴 d-day 라벨 시
                      가로 overflow 대신 자연 줄바뀜. */}
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[10.5px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-2.5 h-2.5" strokeWidth={2.4} />
                      {state === 'needs_card'
                        ? '결제수단을 등록하면 첫 배송일이 잡혀요'
                        : box?.kind === 'in_progress' && dDay !== null
                          ? // 결제된 박스는 정지 중이어도 나간다 — 상태와 무관하게 그 발송일을 말한다.
                            dDay > 0
                            ? `결제 완료 · ${nextLabel} 발송 (${shipTimingLabel(dDay).dLabel})`
                            : dDay === 0
                              ? `결제 완료 · ${shipTimingLabel(0).dLabel}`
                              : '결제 완료 · 발송 준비 중'
                          : state === 'paused'
                            ? '재개 시 재계산'
                            : box?.kind === 'charge_check'
                              ? '결제를 확인하고 있어요'
                              : box && dDay !== null
                                ? // ★예정일이 지난 경우를 '오늘' 로 뭉뚱그리지 않는다
                                  //  (2026-08-07). 결제가 미끄러지면 이 날짜가 과거로
                                  //  흘러가는데 매일 "오늘 발송 예정" 이라고 말했다.
                                  dDay < 0
                                  ? '확인 중'
                                  : dDay === 0
                                    ? '오늘 발송 예정'
                                    : `${dDay}일 후 (${nextLabel})`
                                : '-'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Truck className="w-2.5 h-2.5" strokeWidth={2.4} />
                      {s.total_deliveries}회 받음
                    </span>
                  </div>
                  {needsCard && (
                    <Link
                      href={cardHref}
                      className="inline-flex items-center gap-1 mt-1 text-[10.5px] font-bold text-terracotta"
                    >
                      <Bell className="w-3 h-3" strokeWidth={2.4} />
                      {state === 'card_failed'
                        ? '결제수단 다시 등록하기'
                        : '결제수단 등록하고 시작하기'}
                      <ArrowRight className="w-3 h-3" strokeWidth={2.4} />
                    </Link>
                  )}
                  {state === 'paused' && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-muted mt-0.5">
                      <PauseCircle className="w-2.5 h-2.5" strokeWidth={2.4} />
                      정기배송 화면에서 다시 시작할 수 있어요
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
