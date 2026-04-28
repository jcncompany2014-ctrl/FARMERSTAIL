'use client'

// ---------------------------------------------------------------------------
// EventClaimBlock — 이벤트 상세 페이지의 primary CTA 블록.
//
// 한 컴포넌트에서 3가지 모드를 handle:
//   1) ctaVariant='coupon-claim'  → "쿠폰 받기" 버튼 + 코드 복사 + localStorage
//                                   마킹 ("받기 완료" 상태 유지)
//   2) ctaVariant='benefit-auto' & kind='welcome' & userCreatedAt 있음
//                                → 3시간 카운트다운 + "지금 장보러 가기" CTA
//                                   (만료되면 "시간이 지났어요" 상태)
//   3) ctaVariant='benefit-auto' 그 외 → "자동 적용돼요" 안내 + href CTA
//
// 왜 한 컴포넌트로 묶었나
// ─────────────────────
// 상세 페이지에서 이 블록의 시각 footprint (border, padding, typography 리듬)
// 가 동일해야 에디토리얼 리듬이 깨지지 않는다. 3갈래 분기 + 공유된 시각 frame
// 은 한 컴포넌트 안에서 관리하는 게 한 번에 보기 쉽다.
// ---------------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import type { EventItem } from '@/lib/events/data'

// "우리는 이미 hydrate 되었나?" 를 useEffect + setState 없이 표현.
// SSR 패스에선 getServer 가 false 를 주고, client mount 후 getClient 가 true 로
// 전환된다 — 한 번의 커밋으로 끝나 cascading render 가 없다.
const EMPTY_SUBSCRIBE = () => () => {}
function useHasMounted(): boolean {
  const getClient = useCallback(() => true, [])
  const getServer = useCallback(() => false, [])
  return useSyncExternalStore<boolean>(EMPTY_SUBSCRIBE, getClient, getServer)
}

const WELCOME_WINDOW_MS = 3 * 60 * 60 * 1000 // 3시간

// 쿠폰 받기 완료 상태를 기록하는 localStorage key.
// 브라우저 하나에서만 유효 (여러 기기에서 공유 X) — MVP 수준의 UX 마커.
// 서비스화 시 user_coupons 테이블로 이관.
const CLAIMED_KEY = (code: string) => `ft_event_claimed:${code}`

export default function EventClaimBlock({
  event,
  userCreatedAt,
  /** dark panel (terracotta/ink/moss 배경) 위에서 쓰일 때 true. 버튼/텍스트
   *  색감을 반전해서 대비를 유지. */
  onDarkBg = false,
}: {
  event: EventItem
  userCreatedAt: string | null
  onDarkBg?: boolean
}) {
  if (event.ctaVariant === 'coupon-claim') {
    return <CouponClaimBlock event={event} onDarkBg={onDarkBg} />
  }
  if (event.kind === 'welcome') {
    // Split auth'd vs anonymous at this level so each subcomponent's hooks
    // are called unconditionally (rules of hooks).
    if (userCreatedAt) {
      return (
        <WelcomeBenefitBlock
          event={event}
          userCreatedAt={userCreatedAt}
          onDarkBg={onDarkBg}
        />
      )
    }
    return <AnonymousWelcomeBlock event={event} onDarkBg={onDarkBg} />
  }
  return <AutoBenefitBlock event={event} onDarkBg={onDarkBg} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Coupon Claim — 쿠폰 받기 버튼 + 복사 + 받기 완료 상태 유지
// ─────────────────────────────────────────────────────────────────────────────
function CouponClaimBlock({
  event,
  onDarkBg,
}: {
  event: EventItem
  onDarkBg: boolean
}) {
  const toast = useToast()
  const mounted = useHasMounted()
  // "같은 탭 내에서 방금 클릭해 받은 상태" 는 로컬 state 로 즉시 반영.
  const [justClaimed, setJustClaimed] = useState(false)
  // "localStorage 에 이미 저장된 상태" 는 외부 상태라 useSyncExternalStore 로
  // 구독. storage 이벤트(다른 탭에서 받은 경우)에 반응해서 자동 갱신된다.
  const code = event.couponCode ?? null
  const storageSubscribe = useCallback((cb: () => void) => {
    if (typeof window === 'undefined') return () => {}
    const handler = (e: StorageEvent) => {
      // 우리 키와 무관한 이벤트는 무시
      if (!e.key || !e.key.startsWith('ft_event_claimed:')) return
      cb()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
  const storageGetClient = useCallback(() => {
    if (!code) return false
    try {
      return !!window.localStorage.getItem(CLAIMED_KEY(code))
    } catch {
      return false
    }
  }, [code])
  const storageGetServer = useCallback(() => false, [])
  const storageClaimed = useSyncExternalStore<boolean>(
    storageSubscribe,
    storageGetClient,
    storageGetServer,
  )
  const claimed = justClaimed || storageClaimed

  // 빈 문자열 fallback — 아래 핸들러들이 "코드 있을 때만" 으로 가드해서
  // 빈 문자열 UI 노출될 일은 없음. (코드 없으면 페이지 자체에 쿠폰 CTA 가 없음.)
  const codeStr = code ?? ''

  async function handleClaim() {
    if (!codeStr) return
    // 1) 클립보드 복사 시도. 권한 없는 환경이면 toast 만 띄우고 끝.
    let copied = false
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeStr)
        copied = true
      }
    } catch {
      copied = false
    }
    // 2) 로컬 마킹
    try {
      window.localStorage.setItem(CLAIMED_KEY(codeStr), String(Date.now()))
    } catch {
      // ignore
    }
    setJustClaimed(true)
    // 3) 유저 피드백
    toast.success(
      copied
        ? '쿠폰 코드가 클립보드에 복사됐어요'
        : '쿠폰이 발급됐어요',
      {
        description: `결제 시 ${codeStr} 를 입력하면 자동 할인됩니다.`,
      }
    )
  }

  async function handleCopyAgain() {
    if (!codeStr) return
    try {
      await navigator.clipboard.writeText(codeStr)
      toast.info('쿠폰 코드가 다시 복사됐어요', { description: codeStr })
    } catch {
      toast.error('복사에 실패했어요', { description: `코드: ${codeStr}` })
    }
  }

  const btnFg = onDarkBg ? 'var(--terracotta)' : 'var(--bg)'
  const btnBg = onDarkBg ? 'var(--bg)' : 'var(--ink)'
  const subtleText = onDarkBg ? 'rgba(245,240,230,0.78)' : 'var(--muted)'
  const codeBg = onDarkBg ? 'rgba(245,240,230,0.14)' : 'var(--bg-2)'
  const codeFg = onDarkBg ? 'var(--bg)' : 'var(--ink)'

  // mount 전 / after — SSR/hydration mismatch 방지 위해 버튼 label 은
  // claimed 여부를 mount 이후에만 반영.
  const showClaimedUI = mounted && claimed

  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase mb-2"
        style={{ color: subtleText, letterSpacing: '0.2em' }}
      >
        쿠폰 코드
      </div>
      <div
        className="font-mono tabular-nums text-center py-3 rounded-xl mb-4"
        style={{
          background: codeBg,
          color: codeFg,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.25em',
        }}
        aria-label="쿠폰 코드"
      >
        {codeStr || '—'}
      </div>

      {showClaimedUI ? (
        <div className="flex items-center gap-2">
          <div
            className="flex-1 rounded-full py-3.5 text-[13px] font-semibold text-center"
            style={{
              background: onDarkBg
                ? 'rgba(245,240,230,0.16)'
                : 'var(--bg-2)',
              color: onDarkBg ? 'var(--bg)' : 'var(--muted)',
              letterSpacing: '-0.01em',
              border: onDarkBg
                ? '1px solid rgba(245,240,230,0.22)'
                : '1px solid var(--rule)',
            }}
          >
            받기 완료
          </div>
          <button
            type="button"
            onClick={handleCopyAgain}
            className="rounded-full px-4 py-3.5 text-[13px] font-semibold"
            style={{
              background: btnBg,
              color: btnFg,
              letterSpacing: '-0.01em',
            }}
          >
            다시 복사
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClaim}
          className="w-full rounded-full py-3.5 text-[13px] font-semibold"
          style={{
            background: btnBg,
            color: btnFg,
            letterSpacing: '-0.01em',
          }}
        >
          쿠폰 받기
        </button>
      )}

      {event.ctaSecondary && (
        <Link
          href={event.ctaSecondary.href}
          className="block w-full mt-3 text-center text-[12px] font-semibold underline underline-offset-4"
          style={{ color: subtleText }}
        >
          {event.ctaSecondary.label} →
        </Link>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Welcome Benefit — 첫 가입 혜택. 3시간 카운트다운 / 만료 / 비로그인 분기.
// ─────────────────────────────────────────────────────────────────────────────
function WelcomeBenefitBlock({
  event,
  userCreatedAt,
  onDarkBg,
}: {
  event: EventItem
  userCreatedAt: string // non-null — 상위에서 분기 후 전달
  onDarkBg: boolean
}) {
  const expiresAtMs = new Date(userCreatedAt).getTime() + WELCOME_WINDOW_MS
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remaining = Math.max(0, expiresAtMs - now)
  const expired = remaining === 0
  const hh = Math.floor(remaining / 3600000)
  const mm = Math.floor((remaining % 3600000) / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')

  const btnFg = onDarkBg ? 'var(--terracotta)' : 'var(--bg)'
  const btnBg = onDarkBg ? 'var(--bg)' : 'var(--ink)'
  const subtleText = onDarkBg ? 'rgba(245,240,230,0.78)' : 'var(--muted)'
  const dividerColor = onDarkBg
    ? 'rgba(245,240,230,0.28)'
    : 'var(--rule-2)'

  if (expired) {
    return (
      <div>
        <div
          className="text-[10px] font-semibold uppercase mb-2"
          style={{ color: subtleText, letterSpacing: '0.2em' }}
        >
          Status
        </div>
        <p
          className="mb-4"
          style={{
            fontSize: 13,
            color: onDarkBg ? 'rgba(245,240,230,0.88)' : 'var(--text)',
            lineHeight: 1.6,
          }}
        >
          아쉽지만 가입 후 <strong>3시간</strong> 이 지나 혜택이 만료됐어요.
          다음 이벤트는 홈에서 계속 전해드릴게요.
        </p>
        <Link
          href="/dashboard"
          className="block w-full rounded-full py-3.5 text-[13px] font-semibold text-center"
          style={{
            background: btnBg,
            color: btnFg,
            letterSpacing: '-0.01em',
          }}
        >
          홈으로
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase mb-2"
        style={{ color: subtleText, letterSpacing: '0.2em' }}
      >
        남은 시간
      </div>
      <div
        className="flex items-baseline justify-between pb-3 mb-4"
        style={{ borderBottom: `1px dashed ${dividerColor}` }}
      >
        <span
          className="font-serif italic"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: subtleText,
            letterSpacing: '-0.01em',
          }}
        >
          3시간 이내 사용
        </span>
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: onDarkBg ? 'var(--bg)' : 'var(--ink)',
            letterSpacing: '0.02em',
          }}
          aria-live="polite"
        >
          {pad(hh)}:{pad(mm)}:{pad(ss)}
        </span>
      </div>
      <Link
        href={event.ctaSecondary?.href ?? '/products?welcome=1'}
        className="block w-full rounded-full py-3.5 text-[13px] font-semibold text-center"
        style={{
          background: btnBg,
          color: btnFg,
          letterSpacing: '-0.01em',
        }}
      >
        지금 장보러 가기
      </Link>
    </div>
  )
}

function AnonymousWelcomeBlock({
  event,
  onDarkBg,
}: {
  event: EventItem
  onDarkBg: boolean
}) {
  const btnFg = onDarkBg ? 'var(--terracotta)' : 'var(--bg)'
  const btnBg = onDarkBg ? 'var(--bg)' : 'var(--ink)'
  const subtleText = onDarkBg ? 'rgba(245,240,230,0.78)' : 'var(--muted)'
  return (
    <div>
      <p
        className="mb-4"
        style={{
          fontSize: 13,
          color: onDarkBg ? 'rgba(245,240,230,0.88)' : 'var(--text)',
          lineHeight: 1.6,
        }}
      >
        첫 주문 혜택은 <strong>가입 직후 3시간 이내</strong>에 자동 적용돼요.
        지금 가입하시면 카운트다운이 바로 시작됩니다.
      </p>
      <Link
        href={event.href}
        className="block w-full rounded-full py-3.5 text-[13px] font-semibold text-center"
        style={{
          background: btnBg,
          color: btnFg,
          letterSpacing: '-0.01em',
        }}
      >
        가입하고 혜택 받기
      </Link>
      <Link
        href="/login"
        className="block w-full mt-3 text-center text-[12px] font-semibold underline underline-offset-4"
        style={{ color: subtleText }}
      >
        이미 가입하셨나요? 로그인 →
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto Benefit — kind 가 welcome 이 아닌 자동 적용 혜택. 현재는 fallback.
// ─────────────────────────────────────────────────────────────────────────────
function AutoBenefitBlock({
  event,
  onDarkBg,
}: {
  event: EventItem
  onDarkBg: boolean
}) {
  const btnFg = onDarkBg ? 'var(--terracotta)' : 'var(--bg)'
  const btnBg = onDarkBg ? 'var(--bg)' : 'var(--ink)'
  return (
    <div>
      <p
        className="mb-4"
        style={{
          fontSize: 13,
          color: onDarkBg ? 'rgba(245,240,230,0.88)' : 'var(--text)',
          lineHeight: 1.6,
        }}
      >
        해당 조건에 맞게 주문하시면 <strong>자동으로 적용</strong>돼요.
      </p>
      {event.ctaSecondary && (
        <Link
          href={event.ctaSecondary.href}
          className="block w-full rounded-full py-3.5 text-[13px] font-semibold text-center"
          style={{
            background: btnBg,
            color: btnFg,
            letterSpacing: '-0.01em',
          }}
        >
          {event.ctaSecondary.label}
        </Link>
      )}
    </div>
  )
}
