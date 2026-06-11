'use client'

/**
 * App-mode chrome: sticky top header w/ cart, bottom tab bar, InstallPrompt,
 * SiteFooter. This is the "installed PWA" shell — dense, mobile-first,
 * task-oriented.
 *
 * Extracted from app/(main)/layout.tsx so the same chrome can wrap pages
 * that live OUTSIDE the (main) auth group but still serve authenticated
 * users — notably /products, which must also be accessible to unauth
 * browsers (editorial mode handled by PublicPageShell). Route-level auth
 * gating remains the caller's responsibility; AppChrome itself assumes the
 * user is signed in and renders accordingly.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  Dog,
  Store,
  ShoppingCart,
  User,
  ChevronDown,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import InstallPrompt from '@/components/InstallPrompt'
import MiniCartToast from '@/components/products/MiniCartToast'
import { WishlistProvider } from '@/components/products/WishlistContext'

type Tab = {
  href: string
  label: string
  Icon: LucideIcon
}

const TABS: Tab[] = [
  { href: '/dashboard', label: '홈', Icon: Home },
  { href: '/dogs', label: '강아지', Icon: Dog },
  { href: '/products', label: '제품', Icon: Store },
  { href: '/cart', label: '장바구니', Icon: ShoppingCart },
  { href: '/mypage', label: '내 정보', Icon: User },
]

/**
 * 액션 집중 라우트 — 상단 header / 하단 nav 모두 hide. 설문 / 체크인 /
 * 처방 승인 같은 step-by-step 흐름에서 시각 부담 ↓. 사용자 피드백 반영.
 */
const FOCUS_PATHS = ['/survey', '/checkin', '/approve']

/**
 * R-feel: 화면별 헤더.
 * 탭 루트(홈/강아지/제품/장바구니/내정보)는 로고+강아지 칩 기본 헤더.
 * 그 외 "깊은 화면"은 ← 뒤로 + 화면 제목 으로 — '앱 같다'의 핵심.
 *
 * screenTitleForPath: null → 탭 루트(기본 헤더). 문자열 → 깊은 화면 제목
 * (빈 문자열이면 ← 만, 제목 없음).
 */
const TAB_ROOTS = new Set([
  '/dashboard',
  '/dogs',
  '/products',
  '/cart',
  '/mypage',
])

const DEEP_TITLES: Record<string, string> = {
  '/dogs/new': '강아지 등록',
  '/dogs/:id': '우리 아이',
  '/dogs/:id/edit': '정보 수정',
  '/dogs/:id/medications': '복약 관리',
  '/dogs/:id/health': '건강 기록',
  '/dogs/:id/diary': '일기',
  '/dogs/:id/analysis': '영양 분석',
  '/dogs/:id/reminders': '알림 · 일정',
  '/dogs/:id/order': '주문하기',
  '/dogs/:id/walks': '산책 기록',
  '/dogs/:id/year-in-review': '연말 결산',
  '/dogs/:id/share': '수의사 공유',
  '/mypage/orders': '주문 내역',
  '/mypage/subscriptions': '정기배송',
  '/mypage/points': '적립금',
  '/mypage/coupons': '내 쿠폰',
  '/mypage/wishlist': '찜한 상품',
  '/mypage/reviews': '내 리뷰',
  '/mypage/addresses': '배송지 관리',
  '/mypage/membership': '멤버십',
  '/mypage/referral': '친구 초대',
  '/mypage/notifications': '알림 설정',
  '/mypage/consent': '광고 수신 설정',
  '/mypage/privacy': '내 데이터',
  '/mypage/delete': '회원 탈퇴',
  '/notifications': '받은 알림',
  '/search': '검색',
  '/chat': 'AI 영양사 상담',
}

function screenTitleForPath(pathname: string): string | null {
  if (TAB_ROOTS.has(pathname)) return null
  // 동적 [id] (uuid) 정규화 → :id
  const p = pathname.replace(
    /\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    '/:id',
  )
  if (DEEP_TITLES[p]) return DEEP_TITLES[p]
  // prefix fallback (동적 하위 화면)
  if (p.startsWith('/products/')) return '상품'
  if (p.startsWith('/mypage/orders/')) return '주문 상세'
  if (p.startsWith('/mypage/certificate')) return '인증서'
  if (p.startsWith('/dogs/:id/')) return '강아지'
  if (p.startsWith('/mypage/')) return '내 정보'
  // 알 수 없는 깊은 화면 — ← 만(제목 없음).
  return ''
}

/**
 * R36b — 'fromSurvey' query 검사 hook. useSearchParams() 는 Next 15+ 에서
 * Suspense boundary 필수라 layout 에서 wrap 시 모든 prerender 페이지에
 * 영향. useSyncExternalStore 로 SSR-safe (server snapshot = false) +
 * hydration-safe (client snapshot = window.location 검사) 구현.
 */
function useFromSurveyQuery(): boolean {
  return useSyncExternalStore(
    // Subscribe — popstate 만 listening. router.push 시 발생하는 pathname
    // 변경은 AppChrome 의 usePathname() 이 별도로 트리거 (re-render).
    (cb) => {
      window.addEventListener('popstate', cb)
      return () => window.removeEventListener('popstate', cb)
    },
    // Client snapshot — 매 re-render 마다 query 재검사.
    () => new URLSearchParams(window.location.search).get('fromSurvey') === '1',
    // Server snapshot — prerender 시 false (hydration mismatch 회피).
    () => false,
  )
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // R36 — 분석 결과 페이지 (/analysis) 첫 진입 (= 설문 직후) 은 focusMode 로
  // 자연스러운 연속 흐름. 사용자가 추후 직접 진입 (query 없음) 시는 정상
  // 노출. SurveyClient 의 router.push 가 ?fromSurvey=1 부착.
  const fromSurvey = useFromSurveyQuery()
  const supabase = createClient()
  const focusMode =
    FOCUS_PATHS.some((p) => pathname.includes(p)) ||
    (pathname.includes('/analysis') && fromSurvey)

  const [cartCount, setCartCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  // R-feel: 상단 우측에 '활성 강아지 칩' — 알림/장바구니 대신.
  const [dogs, setDogs] = useState<
    { id: string; name: string; photoUrl: string | null }[]
  >([])
  const [activeDogId, setActiveDogId] = useState<string | null>(null)

  // audit #99: 이전엔 pathname 변경마다 cart count fetch → 모든 라우트 이동 시
  // Supabase RTT 추가. cart 는 사용자 액션 (add-to-cart) 에서만 변함 — visibility
  // 복귀 + 'ft:cart:add' event 만 refetch.
  useEffect(() => {
    let mounted = true

    async function fetchCount() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!mounted || !user) return
      const { data: items } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', user.id)
      const total = ((items ?? []) as { quantity: number }[]).reduce(
        (sum: number, it) => sum + it.quantity,
        0,
      )
      if (mounted) setCartCount(total)
    }

    void fetchCount()

    const onCartAdd = () => void fetchCount()
    // 다른 탭/디바이스에서 변경 가능 → visibility 복귀 시 invalidate.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchCount()
    }
    window.addEventListener('ft:cart:add', onCartAdd)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted = false
      window.removeEventListener('ft:cart:add', onCartAdd)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // pathname 의도적 제외 — cart count 는 라우트 변경과 무관.
  }, [supabase])

  // R-feel: 활성 강아지 칩 데이터 — 사용자의 강아지(id/이름/사진) fetch.
  // cart 와 동일 패턴: 마운트 1회 + visibility 복귀 시 invalidate (라우트 전환 무관).
  // 비로그인 / 실패는 조용히 빈 목록 — 헤더가 깨지면 안 됨.
  useEffect(() => {
    let mounted = true
    async function fetchDogs() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!mounted || !user) return
      const { data } = await supabase
        .from('dogs')
        .select('id, name, photo_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (!mounted) return
      const list = (
        (data ?? []) as { id: string; name: string; photo_url: string | null }[]
      ).map((d) => ({ id: d.id, name: d.name, photoUrl: d.photo_url }))
      setDogs(list)
      const stored =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('ft_active_dog')
          : null
      const active = list.find((d) => d.id === stored) ?? list[0] ?? null
      setActiveDogId(active?.id ?? null)
    }
    void fetchDogs()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchDogs()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [supabase])

  // Top header gets a hairline + shadow once the user scrolls past the
  // viewport top — subtle separation from content without a heavy border
  // when the page is at rest.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // R-feel: 헤더 우측 강아지 칩 — 활성 강아지 + 이동 경로(없으면 등록).
  const activeDog = dogs.find((d) => d.id === activeDogId) ?? dogs[0] ?? null
  const dogChipHref = dogs.length === 0 ? '/dogs/new' : '/dogs'

  // R-feel: 화면별 헤더 — 깊은 화면이면 ← 뒤로 + 제목(탭 루트면 null).
  const router = useRouter()
  const screenTitle = screenTitleForPath(pathname)
  const isDeep = screenTitle !== null

  return (
    // `phone-frame`: 데스크톱/태블릿(≥md)에서 이 래퍼를 "책상 위 폰"으로
    // 센터 정렬 + 그림자 부양 시킨다. 모바일(<md)에서는 규칙 전부 무시되어
    // 기존 full-bleed 경험 그대로. 상세 근거는 globals.css의 @media 블록
    // 주석 참고. 바깥 body도 --bg-2로 어두워져 "프레임 밖" 느낌이 산다.
    <WishlistProvider>
    <div className="phone-frame min-h-screen bg-bg" data-ft-chrome="app">
      {/* 상단 헤더 v3 — Mono ticker + 기존 logo.png + ChromeStamp + bell/cart icons.
          focus mode (설문/체크인 등) 에서는 hide.
          [2026-05-22] 사용자 요청: BrandWordmark 워드마크 → 원래 logo.png 복구.
          ChromeStamp 도 같이 살아남 (좌측 1px terracotta hairline + 날짜). */}
      {!focusMode && (
      <header
        className="sticky top-0 z-40 transition-all duration-200"
        style={{
          // R-feel: 항상 살짝 블러 + 떠 있는 그림자(스크롤 시 진해짐). 하단 헤어라인
          // 제거 — 선 대신 그림자로 본문과 분리해 '앱 헤더가 떠 있는' 느낌.
          background: scrolled
            ? 'color-mix(in srgb, var(--paper) 84%, transparent)'
            : 'var(--paper)',
          backdropFilter: 'blur(14px) saturate(150%)',
          WebkitBackdropFilter: 'blur(14px) saturate(150%)',
          boxShadow: scrolled
            ? '0 6px 22px -10px rgba(22,20,15,0.30), 0 1px 1px rgba(22,20,15,0.04)'
            : '0 2px 14px -12px rgba(22,20,15,0.22)',
          transition: 'box-shadow 220ms ease, background 220ms ease',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="max-w-md mx-auto" style={{ paddingLeft: 20, paddingRight: 20 }}>
          {/* ── Main row — wordmark + bell/cart
              (R-clean: 상단 'THU 21 MAY · SEOUL·KST' ticker 제거 — 폰 상태바와 중복.) */}
          <div
            className="flex items-center justify-between"
            style={{ paddingTop: 12, paddingBottom: 12 }}
          >
            {/* R-feel: 깊은 화면 = ← 뒤로 + 제목 / 탭 루트 = 로고(장식). */}
            {isDeep ? (
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="뒤로"
                className="flex items-center shrink-0 transition active:scale-95"
                style={{
                  gap: 4,
                  marginLeft: -8,
                  padding: '4px 6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft
                  style={{ width: 23, height: 23, color: 'var(--ink)' }}
                  strokeWidth={2}
                />
                {screenTitle && (
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 17,
                      fontWeight: 700,
                      color: 'var(--ink)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {screenTitle}
                  </span>
                )}
              </button>
            ) : (
              <span className="flex items-center shrink-0" style={{ marginLeft: -4 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Farmer's Tail"
                  className="h-10 w-auto"
                  // LCP 후보 — 헤더 로고가 첫 viewport 가장 큰 가시 요소.
                  fetchPriority="high"
                  style={{ filter: 'var(--logo-filter, brightness(0))' }}
                />
              </span>
            )}

            {/* R-feel: 우측 = 활성 강아지 칩 — 탭 루트 한정. 깊은 화면에선 숨김.
                장바구니는 하단 탭, 알림은 마이페이지에서 진입. */}
            {!isDeep && (
            <Link
              href={dogChipHref}
              aria-label={activeDog ? `${activeDog.name} — 강아지 선택` : '강아지 등록'}
              className="flex items-center shrink-0 transition active:scale-95"
              style={{ gap: 7, marginRight: -2, padding: '4px 8px 4px 4px', borderRadius: 999 }}
            >
              <span
                className="overflow-hidden flex items-center justify-center shrink-0"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: 'var(--paper-hi)',
                  border: '1px solid var(--ink-rule, rgba(22,20,15,0.14))',
                }}
              >
                {activeDog?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeDog.photoUrl}
                    alt={activeDog.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Dog
                    style={{ width: 17, height: 17, color: 'var(--ink-mute)' }}
                    strokeWidth={1.5}
                  />
                )}
              </span>
              {activeDog && (
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    maxWidth: 84,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {activeDog.name}
                </span>
              )}
              <ChevronDown
                style={{ width: 15, height: 15, color: 'var(--ink-mute)', marginLeft: -2, flexShrink: 0 }}
                strokeWidth={2}
              />
            </Link>
            )}
          </div>
        </div>

      </header>
      )}

      {/* 페이지 컨텐츠 — main padding-bottom 도 nav 키운 만큼 같이 키워야
          마지막 컨텐츠가 nav 에 가려지지 않음. nav 내부 = 8px tap padding +
          88px tab content + 12px home-bar gap.
          focus mode (설문 등) 에선 nav 가 없으니 padding 줄임. */}
      <main
        id="main"
        className={`max-w-md mx-auto ${
          focusMode
            ? 'pb-[env(safe-area-inset-bottom)]'
            : 'pb-[calc(100px+env(safe-area-inset-bottom))]'
        }`}
      >
        {children}
        {/* 앱 컨텍스트는 SiteFooter 숨김 — 사업자 정보 / 약관 / 환불정책 등은
            마이페이지 메뉴에서 진입. 매 페이지 하단에 노출되면 한국 앱 사용자
            UX 와 어긋남 (다른 앱들도 노출 안 함). 법적 표기는 /business,
            /legal/* 페이지 + 마이페이지 메뉴로 충분히 reachable. */}
      </main>

      {/* PWA 설치 프롬프트 — 스마트하게 한 번만 노출 */}
      <InstallPrompt />

      {/* 하단 탭 네비게이션 v3 — paperHi bg + 1px ink top hairline + 직각 모서리.
          활성 탭: 아이콘 ink (비활성 inkMute) + 라벨 bold + 16x2 accent 막대.
          focus mode (설문/체크인 등) 에서는 hide.

          data-cart-bottom-nav: globals.css 의 body.cart-cta-active 규칙이 이
          nav 만 translateY(100%) 로 밀어내 CartStickyCTA 와 swap. */}
      {!focusMode && (
      <nav
        data-cart-bottom-nav
        className="fixed bottom-0 left-0 right-0 z-40 md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2"
        style={{
          background: 'var(--paper-hi)',
          borderTop: '1px solid var(--ink)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          paddingTop: 10,
          transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="max-w-md mx-auto grid grid-cols-5" style={{ paddingLeft: 8, paddingRight: 8 }}>
          {TABS.map(({ href, label, Icon }) => {
            const active =
              pathname === href || pathname.startsWith(href + '/')
            const isCart = href === '/cart'

            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center transition active:scale-95"
                style={{ paddingTop: 4, paddingBottom: 2 }}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    style={{
                      width: 22,
                      height: 22,
                      color: active ? 'var(--ink)' : 'var(--ink-mute)',
                      transition: 'color 200ms',
                    }}
                    strokeWidth={active ? 2 : 1.6}
                  />
                  {/* 카트 뱃지 v3 — 직사각형 Mono badge, accent bg + paperHi fg */}
                  {isCart && cartCount > 0 && (
                    <span
                      className="absolute flex items-center justify-center"
                      style={{
                        top: -4,
                        right: -7,
                        minWidth: 14,
                        height: 14,
                        padding: '0 3px',
                        borderRadius: 7,
                        background: 'var(--accent)',
                        color: 'var(--paper-hi)',
                        fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: 0,
                        lineHeight: 1,
                      }}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </div>

                <span
                  style={{
                    marginTop: 4,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    letterSpacing: '-0.005em',
                    color: active ? 'var(--ink)' : 'var(--ink-mute)',
                    transition: 'color 200ms',
                  }}
                >
                  {label}
                </span>

                {/* 활성 탭 — 16x2 accent 막대. 핸드오프의 시그니처 디테일. */}
                {active && (
                  <span
                    aria-hidden
                    style={{
                      width: 16,
                      height: 2,
                      marginTop: 3,
                      background: 'var(--accent)',
                    }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
      )}

      {/* 전역 미니 카트 토스트 — 'ft:cart:add' 이벤트 listen */}
      <MiniCartToast />
    </div>
    </WishlistProvider>
  )
}
