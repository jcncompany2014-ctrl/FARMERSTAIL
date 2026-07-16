import Link from 'next/link'
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
import { subscriptionState, type SubState } from '@/lib/subscription-state'

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
const STATE_META: Record<
  SubState,
  { label: string; badge: string }
> = {
  needs_card: { label: '시작 전', badge: 'bg-terracotta/15 text-terracotta' },
  active: { label: '진행중', badge: 'bg-moss/15 text-moss' },
  paused: { label: '일시정지', badge: 'bg-muted/15 text-muted' },
  card_failed: { label: '카드 재등록 필요', badge: 'bg-sale/15 text-sale' },
  cancelled: { label: '해지됨', badge: 'bg-muted/15 text-muted' },
}
export default function SubscriptionCard({
  subscriptions,
  dogName,
  dogId,
  hasFormula,
}: {
  subscriptions: ActiveSubscription[]
  dogName: string
  dogId: string
  hasFormula: boolean
}) {
  if (subscriptions.length === 0 && !hasFormula) return null

  // D-day 는 KST 자정 기준. 서버(UTC) 자정으로 세면 홈 ActiveDogCard(KST 기준)와
  // 같은 배송인데 하루 어긋난다(2026-07-17 정합). next_delivery_date 는 KST 달력 날짜.
  // eslint-disable-next-line react-hooks/purity
  const nowKstMs = Date.now() + 9 * 3600 * 1000
  const todayKstStart = new Date(
    new Date(nowKstMs).toISOString().slice(0, 10) + 'T00:00:00+09:00',
  ).getTime()

  return (
    <section className="px-5 mt-3">
      <div className="bg-bg-3 rounded border border-rule p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Repeat className="w-3.5 h-3.5 text-moss" strokeWidth={2} />
            <span className="kicker">Subscription</span>
          </div>
          {subscriptions.length > 0 && (
            <Link
              href="/account/subscriptions"
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
              const dDay = s.next_delivery_date
                ? Math.round(
                    (new Date(
                      `${s.next_delivery_date}T00:00:00+09:00`,
                    ).getTime() -
                      todayKstStart) /
                      86_400_000,
                  )
                : null
              // 날짜 라벨 — KST date 문자열에서 직접 뽑는다(Date 로 파싱해 서버 tz 로
              // 포맷하면 KST 자정이 전날로 밀려 '하루 전'을 표시한다).
              const nextLabel = s.next_delivery_date
                ? `${Number(s.next_delivery_date.slice(5, 7))}월 ${Number(s.next_delivery_date.slice(8, 10))}일`
                : ''
              const state = subscriptionState(s)
              const meta = STATE_META[state]
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
                      긴 가격 (1,234,567원/월) 시 라벨이 잘리되 layout 안 깨짐. */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span
                        className={`shrink-0 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[12px] font-bold text-text truncate">
                        {recipe || freshTierLabel(s.fresh_ratio)}
                      </span>
                    </div>
                    <span className="shrink-0 text-[12px] font-bold text-text font-mono whitespace-nowrap tabular-nums">
                      {s.total_amount.toLocaleString()}원/2주
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
                        ? '카드 등록 후 첫 배송일이 잡혀요'
                        : state === 'paused'
                          ? '재개 시 재계산'
                          : s.next_delivery_date && dDay !== null
                            ? dDay <= 0
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
                        ? '카드 다시 등록하기'
                        : '카드 등록하고 시작하기'}
                      <ArrowRight className="w-3 h-3" strokeWidth={2.4} />
                    </Link>
                  )}
                  {state === 'paused' && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-muted mt-0.5">
                      <PauseCircle className="w-2.5 h-2.5" strokeWidth={2.4} />
                      마이페이지에서 언제든 재개 가능
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
