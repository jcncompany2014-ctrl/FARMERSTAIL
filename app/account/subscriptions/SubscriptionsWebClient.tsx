'use client'

/**
 * SubscriptionsWebClient — /account/subscriptions 의 인터랙티브 본체 (FD 톤).
 *
 * 비즈니스 로직은 app 의 SubscriptionsClient(audit #101) 와 **동일** — 모든 액션은
 * RLS 보호 subscriptions 테이블 update + 카드재등록만 /subscribe/billing-auth
 * redirect. 위험한 KST 날짜 로직은 공용 헬퍼(lib/datetime-kst) 재사용이라 중복 0.
 * app client(폰프레임 v3) 는 손대지 않고, 웹 전용 FD UI 만 여기 별도로 둔다.
 */

import { useEffect, useRef, useState } from 'react'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Pause,
  Play,
  Bell,
  BellOff,
  AlertTriangle,
  CreditCard,
  Soup,
  X,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { nextShipDate, nextCycleDate } from '@/lib/shipping-schedule'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import {
  trackSubscriptionPaused,
  trackSubscriptionResumed,
  trackSubscriptionCancelled,
} from '@/lib/analytics'
import {
  formatRetryAt,
  generateFallbackCustomerKey,
} from '@/lib/v3-helpers/subscriptions'
import type { Subscription } from './types'
import {
  subscriptionState,
  isSubscriptionVisibleToUser,
  SUB_STATE_LABEL,
  type SubState,
} from '@/lib/subscription-state'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import FreshRatioSheet from '@/components/subscription/FreshRatioSheet'
import PriceChangeConsentModal, {
  type PriceChangeProposal,
} from './PriceChangeConsentModal'

type Props = {
  initialSubs: Subscription[]
  focusSubId: string | null
  priceProposal: PriceChangeProposal | null
  /**
   * 앱(PWA/Capacitor) 컨텍스트 여부 — **서버가 계산해 내려준다.**
   * 클라이언트 훅(useIsAppContext)은 SSR·하이드레이션 시 null 이라, 첫 렌더에
   * 잘못된 링크가 잠깐 보였다가 바뀐다. 링크 목적지가 갈리는 값이라 그러면 안 된다.
   */
  isApp: boolean
}

// ★ status 컬럼이 아니라 subscriptionState() 로 판정 — '유령 활성'(카드 없이
//   status=active)을 '구독 중'으로 오표시하던 버그(사장님 2026-07-16) 차단.
//
// ★라벨은 lib/subscription-state 정본을 쓴다 (2026-08-07). 여기만 자체 맵을
//   갖고 있어서, 결제가 깨진 고객이 메일→웹("결제수단 재등록 필요")을 보고
//   앱을 열면("결제 확인 필요") 다른 문제인 줄 알았다. 결제 실패 메일의 CTA 가
//   규칙16 때문에 **의도적으로 웹**이라, 이 둘은 실제로 연달아 보인다.
//   색만 FD 톤으로 여기서 고른다.
const STATE_COLOR_FD: Record<SubState, string> = {
  needs_card: 'var(--fd-coral)',
  active: 'var(--fd-green)',
  paused: '#C28A2B',
  card_failed: 'var(--fd-coral)',
  cancelled: 'var(--fd-muted)',
}


function formatKRW(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export default function SubscriptionsWebClient({
  initialSubs,
  focusSubId,
  priceProposal,
  isApp,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [subs, setSubs] = useState<Subscription[]>(initialSubs)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cancelSubId, setCancelSubId] = useState<string | null>(null)
  // 화식 비율 변경 시트 (2026-07-31 신설) — 열려 있는 구독 id.
  const [ratioSubId, setRatioSubId] = useState<string | null>(null)

  // focus=id 진입 시 해당 카드로 스크롤 + 잠깐 하이라이트
  useEffect(() => {
    if (!focusSubId) return
    const el = document.getElementById(`sub-${focusSubId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const prev = el.style.boxShadow
    el.style.transition = 'box-shadow 0.25s ease-out'
    el.style.boxShadow = '0 0 0 2px var(--fd-coral), 0 0 0 5px var(--fd-offwhite)'
    const t = setTimeout(() => {
      el.style.boxShadow = prev
    }, 1800)
    return () => clearTimeout(t)
  }, [focusSubId])

  async function reload() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    // ★error 를 꺼낸다(규칙1) — 실패를 무시하면 액션 후 화면이 낡은 상태로
    //  남는데 사용자는 반영된 줄 안다(2026-08-08 diff 재검증).
    const { data, error: reloadErr } = await supabase
      .from('subscriptions')
      // ★`select('*')` 금지 (2026-08-08 보안 재감사) — 빌링키·서버 전용 칸이
      //  통째로 브라우저로 갔다. 카드 등록 여부는 has_billing_key 계산
      //  컬럼(20260808000100)으로 받는다.
      .select(
        'id, dog_id, status, interval_weeks, coverage_weeks, fresh_ratio, ' +
            'next_delivery_date, last_delivery_date, total_deliveries, ' +
            'total_amount, subtotal, shipping_fee, created_at, ' +
            'has_billing_key, billing_customer_key, billing_card_brand, ' +
            'billing_card_last4, failed_charge_count, next_retry_at, ' +
            'last_failed_charge_reason, requires_billing_key_renewal, reminder_enabled, ' +
            'subscription_items(*), dogs(id, name)',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    // has_billing_key 는 계산 컬럼이라 생성 타입에 없다(20260808000100).
    if (reloadErr) {
      toast.error('최신 상태를 불러오지 못했어요. 새로고침해 주세요.')
      return
    }
    if (data) setSubs(data as unknown as Subscription[])
  }

  async function requireUid(): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return null
    }
    return user.id
  }

  async function handlePause(subId: string, weeks?: 1 | 2 | 4) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    const update: Record<string, unknown> = weeks
      ? (() => {
          const sub = subs.find((s) => s.id === subId)
          // 선택한 주(週)만큼 미루기 — 화요일 보존(주 단위라 요일 불변). 기준이
          // 없으면 다음 화요일부터. weeks 를 nextCycleDate 에 반드시 넘긴다(안 넘기면
          // 항상 2주 폴백). 2026-07-18: 건너뛰기=**2주**로 앱과 통일(사장님) — 이전엔
          // 웹만 4주라 앱(2주)과 달랐고, 박스가 14일치라 4주 미루면 2주 굶었다.
          const baseIso = sub?.next_delivery_date ?? nextShipDate()
          return { next_delivery_date: nextCycleDate(baseIso, weeks) }
        })()
      : { status: 'paused' }
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ error: unknown }>
          }
        }
      }
    })
      .from('subscriptions')
      .update(update)
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) {
      toast.error('변경하지 못했어요. 잠시 후 다시 시도해 주세요')
      setActionLoading(null)
      return
    }
    if (!weeks) {
      trackSubscriptionPaused({ subscriptionId: subId, reason: 'user_action' })
    } else {
      toast.success(
        `다음 배송을 ${weeks}주 미뤘어요. 정기배송 관리에서 되돌릴 수 있어요.`,
      )
    }
    await reload()
    setActionLoading(null)
  }

  async function handleResume(subId: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    const sub = subs.find((s) => s.id === subId)
    if (!sub) {
      setActionLoading(null)
      return
    }
    if (sub.requires_billing_key_renewal) {
      toast.info(
        '결제수단 재등록이 필요해요. 다시 등록하면 자동으로 다시 시작돼요.',
      )
      setActionLoading(null)
      return
    }
    // 등록 여부는 **billing_key** 로 본다. 카드번호(last4)로 판정하면 토스페이로
    // 등록한 고객은 카드번호가 없어서 영원히 '미등록'이 되고, 재개를 누를 때마다
    // 등록 화면으로 돌려보내진다 (2026-07-30 토스페이 추가 시 발견).
    if (!sub.has_billing_key) {
      toast.info('결제수단 등록이 필요해요. 등록하면 정기배송이 시작돼요.')
      const customerKey = sub.billing_customer_key ?? generateFallbackCustomerKey()
      router.push(
        `/subscribe/billing-auth?subscriptionId=${sub.id}&customerKey=${encodeURIComponent(customerKey)}`,
      )
      setActionLoading(null)
      return
    }
    // 재개하면 **다음 화요일**부터 (2026-07-16). 주기는 2주 하나로 고정 —
    // 박스가 14일치라 다른 주기는 성립하지 않는다.
    const nextIso = nextShipDate()
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'active', next_delivery_date: nextIso })
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) {
      toast.error('다시 시작하지 못했어요. 잠시 후 다시 시도해 주세요')
      setActionLoading(null)
      return
    }
    trackSubscriptionResumed({ subscriptionId: subId })
    await reload()
    setActionLoading(null)
  }

  async function performCancel(subId: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    const sub = subs.find((s) => s.id === subId)
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ error: unknown }>
          }
        }
      }
    })
      .from('subscriptions')
      .update({ status: 'cancelled', next_delivery_date: null })
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) {
      toast.error('해지하지 못했어요. 잠시 후 다시 시도해 주세요')
      setActionLoading(null)
      return
    }
    trackSubscriptionCancelled({
      subscriptionId: subId,
      totalDeliveries: sub?.total_deliveries ?? 0,
    })
    setCancelSubId(null)
    await reload()
    setActionLoading(null)
  }

  async function handleToggleReminder(subId: string, enabled: boolean) {
    const uid = await requireUid()
    if (!uid) return
    const { error } = await supabase
      .from('subscriptions')
      .update({ reminder_enabled: enabled })
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) toast.error('알림 설정을 변경하지 못했어요')
    await reload()
  }

  function handleReRegisterCard(sub: Subscription) {
    const customerKey = sub.billing_customer_key ?? generateFallbackCustomerKey()
    router.push(
      `/subscribe/billing-auth?subscriptionId=${encodeURIComponent(
        sub.id,
      )}&customerKey=${encodeURIComponent(customerKey)}`,
    )
  }

  // '결제 완료·진행중인 것만' 노출 — 카드도 안 걸고 해지된 유령 구독("0회 배송
  // 후 해지")은 숨긴다(사장님 2026-07-22). 판정은 subscription-state 정본.
  //
  // ★needs_card 는 숨기지 않는다(2026-08-05). 앱 화면은 2026-07-30 에 사장님
  //   제보로 이미 고쳤는데 **웹만 그대로였다** — 같은 규칙이 두 곳에 따로 있으면
  //   갈라진다는 이 저장소의 고질병이 또 나왔다.
  //   웹에서 생기던 일: 신청 후 토스 창을 닫으면 구독 행은 needs_card 로 남는데,
  //   /account/dogs 는 그걸 "구독 중"으로 세어 카드 링크를 "정기배송 관리"로
  //   바꾼다(신청 링크는 사라진다). 그런데 그 관리 화면이 needs_card 를 숨겨
  //   "아직 정기배송이 없어요" → 유일한 CTA 가 다시 /account/dogs.
  //   **완전한 순환**이고, 아래 '결제수단 등록하고 시작하기' 버튼은 정작 그게
  //   필요한 사람에게만 안 보이는 죽은 코드였다. 탈출구는 하루 1회 도는 정리
  //   크론뿐이라 최대 ~24시간 갇혔다.
  //   숨겨야 할 건 '유령'(cancelled + 0회)이지, 고객이 조치할 게 남은 구독이 아니다.
  const visibleSubs = subs.filter(
    (x) => isSubscriptionVisibleToUser(x) || subscriptionState(x) === 'needs_card',
  )

  if (visibleSubs.length === 0) {
    return (
      <div
        className="rounded-[var(--fd-r-card)] px-6 py-10 md:px-10 md:py-12 text-center"
        style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
      >
        <span
          className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-4"
          style={{ background: 'var(--fd-cream)' }}
        >
          <Soup className="w-6 h-6" strokeWidth={1.75} style={{ color: 'var(--fd-pine)' }} />
        </span>
        <div
          className="text-[17px] md:text-[19px]"
          style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}
        >
          아직 정기배송이 없어요
        </div>
        <p
          className="mt-3 text-[12.5px] md:text-[14px] leading-relaxed"
          style={{ color: 'var(--fd-muted)', maxWidth: 420, marginInline: 'auto' }}
        >
          우리 아이 맞춤 식단을 설계하고 정기배송을 시작해 보세요.
        </p>
        {/*
          ★로그인 상태(이 페이지는 auth 필수)라 비로그인 설문 퍼널 /start(→가입)로
          보내면 안 됨(사장님 2026-07-23). 우리 아이 허브 /dogs 로 — 강아지가 있으면
          골라서 플랜, 없으면 등록으로 자연 분기.

          ★단, `/dogs` 는 **앱 전용**이다(proxy APP_ONLY_PREFIXES, R84-2).
          웹에서 "우리 아이 식단 시작하기" 를 누르면 식단이 아니라 앱 설치
          안내로 튕겼다 — 버튼이 거짓말을 하고 있었다(2026-07-31).
          그때는 목적지를 그대로 두고 **문구를 사실대로** 바꿨다("앱에서 …").

          ★2026-08-03 검수 — 이제 반대로 고친다. 그 뒤 웹 구독 경로가 생겼기
          때문이다(/account/dogs → /account/subscribe/[dogId] → 결제까지 웹에서
          끝난다). 여기가 **웹 정기배송 관리 화면**인데 유일한 CTA 가 앱 설치
          벽으로 보내는 건, 할 수 있는 일을 못 한다고 말하는 것이다.
          문구를 사실에 맞추는 게 아니라 **목적지를 웹 허브로** 돌린다.
        */}
        <Link
          href={isApp ? '/dogs' : '/account/dogs'}
          className="mt-6 inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13px] font-bold transition hover:brightness-[0.94] active:scale-[0.98]"
          style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
        >
          우리 아이 식단 시작하기
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {priceProposal && <PriceChangeConsentModal proposal={priceProposal} />}
      {visibleSubs.map((sub) => {
        const state = subscriptionState(sub)
        const status = {
          label: SUB_STATE_LABEL[state],
          color: STATE_COLOR_FD[state],
        }
        const isActive = state === 'active'
        const isPaused = state === 'paused'
        const isCancelled = state === 'cancelled'
        const needsCard = state === 'needs_card'
        const needsRenewal = sub.requires_billing_key_renewal === true
        const hasFailureSignal =
          !isCancelled &&
          (needsRenewal || (sub.failed_charge_count ?? 0) > 0 || !!sub.next_retry_at)
        const isLoading = actionLoading === sub.id

        return (
          <div
            key={sub.id}
            id={`sub-${sub.id}`}
            className="rounded-[var(--fd-r-card)] overflow-hidden"
            style={{
              background: '#FFFFFF',
              boxShadow: `inset 0 0 0 1px ${needsRenewal ? 'var(--fd-coral)' : 'var(--fd-line)'}`,
              opacity: isCancelled ? 0.6 : 1,
            }}
          >
            {/* 상태 헤더 */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--fd-line)', background: 'var(--fd-offwhite)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: status.color }}
                />
                <span
                  className="text-[11px] font-bold uppercase tracking-wider shrink-0"
                  style={{ color: status.color }}
                >
                  {status.label}
                </span>
                {sub.dogs && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: 'var(--fd-cream)', color: 'var(--fd-pine)', fontWeight: 700 }}
                  >
                    🐶 {sub.dogs.name}
                  </span>
                )}
                {sub.coverage_weeks && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full shrink-0 truncate"
                    style={{ background: 'var(--fd-cream)', color: 'var(--fd-pine)', fontWeight: 700 }}
                  >
                    {freshTierLabel(sub.fresh_ratio)}
                  </span>
                )}
              </div>
              {sub.next_delivery_date && !isCancelled && (
                <span
                  className="text-[11px] font-mono shrink-0"
                  style={{ color: 'var(--fd-muted)', letterSpacing: '0.04em' }}
                >
                  {new Date(sub.next_delivery_date).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  {/* 지난 날짜를 "배송" 이라 단정하지 않는다(2026-08-07). */}
                  {sub.next_delivery_date < todayKstIsoDate() ? '예정 · 확인 중' : '배송'}
                </span>
              )}
            </div>

            {/* 결제 실패 / 카드 재등록 배너 */}
            {hasFailureSignal && (
              <div
                className="px-5 py-3.5"
                style={{
                  borderBottom: '1px solid var(--fd-line)',
                  background: 'color-mix(in srgb, var(--fd-coral) 7%, transparent)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="w-4 h-4 shrink-0 mt-0.5"
                    strokeWidth={2.2}
                    style={{ color: 'var(--fd-coral)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-bold" style={{ color: 'var(--fd-coral-text)' }}>
                      {needsRenewal
                        ? '결제수단을 다시 등록해 주세요'
                        : sub.next_retry_at
                          ? '결제가 일시 실패했어요'
                          : `결제 ${sub.failed_charge_count}회 실패`}
                    </div>
                    {sub.last_failed_charge_reason && (
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-muted)' }}>
                        {sub.last_failed_charge_reason}
                      </div>
                    )}
                    {sub.next_retry_at && !needsRenewal && (
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-muted)' }}>
                        {formatRetryAt(sub.next_retry_at)} 재시도 예정
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleReRegisterCard(sub)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition hover:brightness-[0.94] active:scale-[0.98]"
                      style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
                    >
                      <CreditCard className="w-3.5 h-3.5" strokeWidth={2.2} />
                      결제 카드 재등록
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 상품 라인 */}
            <div className="px-5 py-4 flex flex-col gap-3">
              {sub.subscription_items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span
                    className="relative w-11 h-11 rounded-[var(--fd-r-thumb)] overflow-hidden shrink-0"
                    style={{ background: 'var(--fd-cream)' }}
                  >
                    {it.product_image_url ? (
                      <Image
                        src={it.product_image_url}
                        alt={it.product_name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Soup className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--fd-muted)' }} />
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold truncate" style={{ color: 'var(--fd-pine)' }}>
                      {it.product_name}
                    </div>
                    <div className="text-[11.5px]" style={{ color: 'var(--fd-muted)' }}>
                      {formatKRW(it.unit_price)} · {it.quantity}개
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 메타 — 주기 / 금액 */}
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--fd-line)', background: 'var(--fd-offwhite)' }}
            >
              <span className="text-[12px]" style={{ color: 'var(--fd-muted)' }}>
                배송 주기{' '}
                <b style={{ color: 'var(--fd-pine)' }}>
                  2주마다
                </b>
              </span>
              <span className="text-[13px] font-extrabold" style={{ color: 'var(--fd-pine)' }}>
                {formatKRW(sub.total_amount)}
              </span>
            </div>

            {/* 배송 주기 변경 패널 제거 (2026-07-16) — 박스는 14일치 고정이라
                매주로 바꾸면 음식이 두 배로 오고, 4주로 바꾸면 2주 뒤에 굶는다.
                옛 낱개 커머스 모델의 잔재. */}
            {/* 배송 알림 토글 */}
            {!isCancelled && (
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--fd-line)' }}
              >
                <div className="flex items-center gap-2">
                  {sub.reminder_enabled ? (
                    <Bell className="w-3.5 h-3.5" strokeWidth={2} style={{ color: 'var(--fd-pine)' }} />
                  ) : (
                    <BellOff className="w-3.5 h-3.5" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
                  )}
                  <span className="text-[12px]" style={{ color: 'var(--fd-pine)' }}>
                    배송 전 알림
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sub.reminder_enabled}
                  onClick={() => handleToggleReminder(sub.id, !sub.reminder_enabled)}
                  className="relative w-10 h-6 rounded-full transition"
                  style={{ background: sub.reminder_enabled ? 'var(--fd-green)' : 'var(--fd-line)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{ left: 2, transform: sub.reminder_enabled ? 'translateX(16px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            )}

            {/* 액션 버튼들 */}
            {!isCancelled && (
              <div className="px-5 py-3.5 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--fd-line)' }}>
                {needsCard && (
                  <button
                    type="button"
                    onClick={() => handleReRegisterCard(sub)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98]"
                    style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
                  >
                    결제수단 등록하고 시작하기
                  </button>
                )}
                {isActive && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handlePause(sub.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                    style={{ color: 'var(--fd-pine)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                  >
                    <Pause className="w-3.5 h-3.5" strokeWidth={2} />
                    일시정지
                  </button>
                )}
                {/* ★ 정상 구독에도 결제수단 교체 (2026-07-30). 예전엔 카드 미등록·
                    실패 상태에서만 이 버튼이 떴다 — **카드가 잘 걸린 사람은 카드를
                    바꿀 방법이 없었다.** FAQ 는 교체가 된다고 안내하고 있었고,
                    이동 로직(handleReRegisterCard)도 이미 있어서 진입점만 없었다.
                    시각은 위 '일시정지' 버튼과 **같은 클래스·같은 토큰** — 웹 톤 보존. */}
                {isActive && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleReRegisterCard(sub)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                    style={{ color: 'var(--fd-pine)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                  >
                    <CreditCard className="w-3.5 h-3.5" strokeWidth={2} />
                    결제수단 바꾸기
                  </button>
                )}
                {isPaused && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleResume(sub.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'var(--fd-green)', color: '#FFFFFF' }}
                  >
                    <Play className="w-3.5 h-3.5" strokeWidth={2} />
                    다시 시작
                  </button>
                )}
                {/* 화식 비율 변경 (2026-07-31 신설) — 예전엔 신청할 때 고른 값을
                    영영 못 바꿔서, 올리고 싶은 사람도 낮추고 싶은 사람도
                    '해지 후 재신청' 말고는 길이 없었다(실제로는 그냥 해지로 끝난다). */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setRatioSubId(sub.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                  style={{
                    color: 'var(--fd-pine)',
                    boxShadow: 'inset 0 0 0 1px var(--fd-line)',
                  }}
                >
                  화식 비율
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setCancelSubId(sub.id)}
                  className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  해지
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* 화식 비율 변경 — 금액이 함께 바뀌므로 시트가 세 티어 금액을 다 보여준다.
          계산·저장은 전부 서버(/api/subscriptions/[id]/fresh-ratio). */}
      {ratioSubId && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-4 md:pb-0"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setRatioSubId(null)}
        >
          <div
            className="w-full max-w-md rounded-[var(--fd-r-sheet,18px)] p-5"
            style={{ background: '#FFFFFF' }}
            onClick={(e) => e.stopPropagation()}
          >
            <FreshRatioSheet
              subscriptionId={ratioSubId}
              onClose={() => setRatioSubId(null)}
              onChanged={() => {
                toast.success('화식 비율을 바꿨어요')
                void reload()
              }}
            />
          </div>
        </div>
      )}

      {/* 해지 확인 모달 */}
      {cancelSubId && (
        <CancelModal
          loading={actionLoading === cancelSubId}
          onClose={() => setCancelSubId(null)}
          onConfirm={() => void performCancel(cancelSubId)}
          onPauseInstead={() => {
            const id = cancelSubId
            setCancelSubId(null)
            void handlePause(id)
          }}
          onSkipInstead={() => {
            const id = cancelSubId
            setCancelSubId(null)
            void handlePause(id, 2)
          }}
        />
      )}
    </div>
  )
}

function CancelModal({
  loading,
  onClose,
  onConfirm,
  onPauseInstead,
  onSkipInstead,
}: {
  loading: boolean
  onClose: () => void
  onConfirm: () => void
  onPauseInstead: () => void
  onSkipInstead: () => void
}) {
  // 파괴적 다이얼로그 a11y — Esc·포커스 트랩·스크롤 락·포커스 복귀(2026-07-17).
  const panelRef = useRef<HTMLDivElement>(null)
  useModalA11y({ open: true, onClose, containerRef: panelRef })
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="정기배송 해지"
      style={{ background: 'rgba(22,20,15,0.4)' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full md:max-w-md rounded-t-[var(--fd-r-sheet)] md:rounded-[var(--fd-r-sheet)] p-6"
        style={{ background: '#FFFFFF' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div
            className="text-[18px]"
            style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}
          >
            정기배송을 해지할까요?
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 -m-1">
            <X className="w-5 h-5" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
          </button>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--fd-muted)' }}>
          해지하면 다음 배송이 진행되지 않아요. 잠시 쉬어가는 거라면 일시정지나
          2주 미루기를 추천드려요.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSkipInstead}
            disabled={loading}
            className="flex items-center justify-between px-4 py-3 rounded-[var(--fd-r-row)] text-left transition active:scale-[0.99] disabled:opacity-50"
            style={{ boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
          >
            <span>
              <span className="block text-[13.5px] font-bold" style={{ color: 'var(--fd-pine)' }}>
                {/* 앱은 '2주 미루기' 였다 — 같은 동작을 두 이름으로 부르고 있어
                    FAQ 도 어느 쪽을 따라야 할지 갈렸다(2026-07-30 통일). */}
                2주 미루기
              </span>
              <span className="block text-[11.5px]" style={{ color: 'var(--fd-muted)' }}>
                다음 배송만 미루고 정기배송은 유지
              </span>
            </span>
            <ChevronRight className="w-4 h-4" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
          </button>
          <button
            type="button"
            onClick={onPauseInstead}
            disabled={loading}
            className="flex items-center justify-between px-4 py-3 rounded-[var(--fd-r-row)] text-left transition active:scale-[0.99] disabled:opacity-50"
            style={{ boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
          >
            <span>
              <span className="block text-[13.5px] font-bold" style={{ color: 'var(--fd-pine)' }}>
                일시정지
              </span>
              <span className="block text-[11.5px]" style={{ color: 'var(--fd-muted)' }}>
                언제든 다시 시작할 수 있어요
              </span>
            </span>
            <ChevronRight className="w-4 h-4" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
          </button>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="mt-4 w-full py-3 rounded-full text-[13px] font-bold transition active:scale-[0.99] disabled:opacity-50"
          style={{ color: 'var(--fd-coral-text)', boxShadow: 'inset 0 0 0 1px var(--fd-coral)' }}
        >
          {loading ? '해지하는 중…' : '네, 해지할게요'}
        </button>
      </div>
    </div>
  )
}
