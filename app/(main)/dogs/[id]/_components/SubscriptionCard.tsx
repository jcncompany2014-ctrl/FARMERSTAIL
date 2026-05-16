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

/**
 * 진행중 정기배송 카드 — 강아지 단위.
 *
 * 케이스
 *  · 활성/일시정지 구독 1개 이상 → 상태 + 다음 배송일 + 결제 + portion
 *  · 카드 미등록 (billing_key NULL) → "카드 등록 필요" 강조 link
 *  · 구독 없고 처방 있음 → "정기배송 시작" CTA
 *  · 구독 없고 처방 없음 → 카드 자체 숨김 (분석 카드가 이미 onboarding 안내)
 */
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <section className="px-5 mt-3">
      <div className="bg-white rounded-2xl border border-rule p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Repeat className="w-3.5 h-3.5 text-moss" strokeWidth={2} />
            <span className="kicker">Subscription · 정기배송</span>
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
              {dogName} 맞춤 박스를 매월 자동으로 받아보세요. 분석된 라인 비율
              그대로 g 단위까지 정확히 계산해 드려요.
            </p>
            <Link
              href={`/dogs/${dogId}/order`}
              className="inline-flex items-center gap-1 mt-1 px-3.5 py-2 rounded-full bg-terracotta text-white text-[11.5px] font-bold hover:bg-terracotta/90 transition"
            >
              <Truck className="w-3 h-3" strokeWidth={2.4} />
              정기배송 시작
              <ArrowRight className="w-3 h-3" strokeWidth={2.4} />
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {subscriptions.map((s) => {
              const next = s.next_delivery_date ? new Date(s.next_delivery_date) : null
              const dDay =
                next !== null
                  ? Math.ceil(
                      (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    )
                  : null
              const paused = s.status === 'paused'
              const noBilling = !s.billing_key
              return (
                <li
                  key={s.id}
                  className="rounded-xl border border-rule px-4 py-3 flex flex-col gap-1.5 bg-bg-2/30"
                >
                  {/* UI audit H2: 좌측 (badge + plan) flex-1 min-w-0 + truncate.
                      긴 가격 (1,234,567원/월) 시 plan 라벨이 잘리되 layout 안 깨짐. */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span
                        className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          paused
                            ? 'bg-muted/15 text-muted'
                            : noBilling
                              ? 'bg-terracotta/15 text-terracotta'
                              : 'bg-moss/15 text-moss'
                        }`}
                      >
                        {paused
                          ? '일시정지'
                          : noBilling
                            ? '카드 등록 필요'
                            : '진행중'}
                      </span>
                      <span className="text-[11.5px] font-bold text-text truncate">
                        {s.coverage_weeks === 2 ? '2주치 · 하이브리드' : '4주치 · 풀 화식'}
                      </span>
                    </div>
                    <span className="shrink-0 text-[12px] font-bold text-text font-mono whitespace-nowrap tabular-nums">
                      {s.total_amount.toLocaleString()}원/월
                    </span>
                  </div>
                  {/* UI audit M4: meta row flex-wrap — 좁은 카드 + 긴 d-day 라벨 시
                      가로 overflow 대신 자연 줄바뀜. */}
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[10.5px] text-muted">
                    {next && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays
                          className="w-2.5 h-2.5"
                          strokeWidth={2.4}
                        />
                        {paused
                          ? '재개 시 재계산'
                          : dDay !== null
                            ? dDay <= 0
                              ? '오늘 발송 예정'
                              : `${dDay}일 후 (${next.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })})`
                            : '-'}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Truck className="w-2.5 h-2.5" strokeWidth={2.4} />
                      {s.total_deliveries}회 받음
                    </span>
                  </div>
                  {noBilling && !paused && (
                    <Link
                      href={`/subscribe/billing-auth?subscriptionId=${s.id}`}
                      className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-terracotta hover:underline"
                    >
                      <Bell className="w-3 h-3" strokeWidth={2.4} />
                      카드 등록 마무리하기
                      <ArrowRight className="w-3 h-3" strokeWidth={2.4} />
                    </Link>
                  )}
                  {paused && (
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
