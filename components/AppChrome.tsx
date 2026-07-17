'use client'

/**
 * App-mode chrome: sticky top header (logo + 강아지 칩) + SiteFooter.
 * This is the "installed PWA" shell — dense, mobile-first,
 * task-oriented.
 *
 * Extracted from app/(main)/layout.tsx so the same chrome can wrap pages
 * that live OUTSIDE the (main) auth group but still serve authenticated
 * users. Route-level auth gating remains the caller's responsibility;
 * AppChrome itself assumes the user is signed in and renders accordingly.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  ChevronDown,
  ArrowLeft,
  Check,
  Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PawFab } from '@/components/v3'

// 홈 허브형(2026-06-17) + 구독전환(2026-06-27): 장바구니 탭·카트 아이콘·
// 하단 탭바 전부 폐기. TABS 배열 폐기.
// 내비 = 로고(→/dashboard) + 헤더 좌측 계정(→/mypage) + 홈 카드/강아지 칩 + ← 뒤로.

/**
 * 액션 집중 라우트 — 상단 header / 하단 nav 모두 hide. 설문 / 체크인 /
 * 처방 승인 같은 step-by-step 흐름에서 시각 부담 ↓. 사용자 피드백 반영.
 */
const FOCUS_PATHS = ['/survey', '/checkin', '/approve']

/**
 * R-feel: 화면별 헤더.
 * 탭 루트(홈/강아지/내정보)는 로고+강아지 칩 기본 헤더.
 * 그 외 "깊은 화면"은 ← 뒤로 + 화면 제목 으로 — '앱 같다'의 핵심.
 *
 * screenTitleForPath: null → 탭 루트(기본 헤더). 문자열 → 깊은 화면 제목
 * (빈 문자열이면 ← 만, 제목 없음).
 */
// 구독전환: /cart·/products 폐지(redirect). 탭 루트 = 홈·강아지·내정보만.
const TAB_ROOTS = new Set(['/dashboard', '/dogs', '/mypage'])

const DEEP_TITLES: Record<string, string> = {
  '/dogs/new': '강아지 등록',
  '/dogs/:id': '우리 아이',
  '/dogs/:id/edit': '정보 수정',
  '/dogs/:id/health-care': '건강 관리',
  '/dogs/:id/medications': '건강 관리',
  '/dogs/:id/vaccinations': '건강 관리',
  '/dogs/:id/health': '건강 기록',
  '/dogs/:id/diary': '일기',
  '/dogs/:id/analysis': '영양 분석',
  '/dogs/:id/reminders': '건강 관리',
  '/dogs/:id/order': '주문하기',
  '/dogs/:id/walks': '산책 기록',
  '/dogs/:id/year-in-review': '연말 결산',
  '/faq': '자주 묻는 질문',
  '/help': '고객센터',
  '/mypage/orders': '주문 내역',
  '/mypage/subscriptions': '정기배송',
  '/account/subscriptions': '정기배송',
  '/mypage/reviews': '내 리뷰',
  '/mypage/addresses': '배송지 관리',
  '/mypage/membership': '멤버십',
  '/mypage/accuracy': '분석 맞춤도',
  '/mypage/integrations': '연동',
  '/mypage/cs': '1:1 문의',
  '/mypage/notifications': '알림',
  '/mypage/consent': '알림',
  '/mypage/privacy': '내 데이터',
  '/mypage/delete': '회원 탈퇴',
  '/reports': '건강 리포트',
  '/notifications': '알림',
  '/search': '검색',
  '/chat': 'AI 영양 상담',
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
  if (p.startsWith('/mypage/orders/')) return '주문 상세'
  if (p.startsWith('/mypage/certificate')) return '인증서'
  if (p.startsWith('/dogs/:id/')) return '강아지'
  if (p.startsWith('/mypage/')) return '내 정보'
  // 알 수 없는 깊은 화면 — ← 만(제목 없음).
  return ''
}

/**
 * R-feel (2026-06-19, 사장님 "뒤로가기가 웹스타일 — 직전 화면으로 되돌아감") —
 * 네이티브식 계층 '위로(up)' 내비. router.back()(브라우저 히스토리 되감기)
 * 대신 각 깊은 화면의 **구조상 부모**로 이동한다. 폼 작성 중 이탈→복귀해도
 * 히스토리를 되짚지 않고 항상 같은 상위 화면으로 — 앱다운 예측 가능한 동선.
 *
 *   /dogs/:id/<sub>         → /dogs/:id        (강아지 하위 화면 → 강아지 상세=개요)
 *   /dogs/:id/<a>/<b>       → /dogs/:id/<a>     (중첩은 한 단계만 위로)
 *   /dogs/:id               → /dashboard        (강아지 상세 → 홈 허브)
 *   /mypage/orders/:id      → /mypage/orders
 *   /mypage/<sub>           → /mypage
 *   그 외(강아지 등록·검색·알림·상담 등) → /dashboard
 */
const UUID_RE =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

function parentForPath(pathname: string): string {
  const dogMatch = pathname.match(new RegExp(`^/dogs/(${UUID_RE})(/.+)?$`))
  if (dogMatch) {
    const dogBase = `/dogs/${dogMatch[1]}`
    const sub = dogMatch[2]
    if (!sub) return '/dashboard'
    const segs = sub.split('/').filter(Boolean)
    if (segs.length >= 2) return `${dogBase}/${segs.slice(0, -1).join('/')}`
    return dogBase
  }
  if (pathname.startsWith('/mypage/orders/')) return '/mypage/orders'
  if (pathname.startsWith('/mypage/')) return '/mypage'
  // 고객센터 허브에서 펼쳐지는 화면들 → 허브로(홈으로 튀지 않게, 2026-07-16).
  if (pathname === '/faq' || pathname === '/business' || pathname === '/contact')
    return '/help'
  // 마이페이지에서 진입하는 계정·알림·도움 화면들 → 마이페이지로.
  //  (path 기반이라 개요 '전체 관리' 처럼 다른 진입점에선 완벽하진 않지만,
  //   전부 홈으로 튀던 것보다 예측 가능하다.)
  if (
    pathname === '/help' ||
    pathname === '/notifications' ||
    pathname === '/reports' ||
    pathname.startsWith('/account')
  )
    return '/mypage'
  return '/dashboard'
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
  // 강아지 상세(우리 아이) 화면 — /dogs/{uuid}... 진입 시 발바닥 FAB 숨김
  // (사장님 2026-07-13). 목록 /dogs 는 해당 없음.
  const onDogDetail = new RegExp(`^/dogs/${UUID_RE}(/|$)`).test(pathname)

  const [scrolled, setScrolled] = useState(false)
  // R-feel: 상단 우측에 '활성 강아지 칩' — 알림/장바구니 대신.
  const [dogs, setDogs] = useState<
    { id: string; name: string; photoUrl: string | null }[]
  >([])
  const [activeDogId, setActiveDogId] = useState<string | null>(null)
  // 강아지 전환 드롭다운 — 헤더 칩을 누르면 작게 펼쳐지는 빠른 전환 목록.
  const [dogMenuOpen, setDogMenuOpen] = useState(false)
  // fetch 완료 전 '강아지 등록' 칩이 잘못 깜빡이지 않게 — 로드 후에만 렌더.
  const [dogsLoaded, setDogsLoaded] = useState(false)
  const dogMenuRef = useRef<HTMLDivElement | null>(null)

  // R-feel: 활성 강아지 칩 데이터 — 사용자의 강아지(id/이름/사진) fetch.
  // 마운트 1회 + visibility 복귀 시 invalidate (라우트 전환 무관).
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
      setDogsLoaded(true)
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

  // 뒤로/앞으로(POP) 내비 감지. POP 은 브라우저가 이전 스크롤 위치를 복원하므로
  // 아래 강제 top 을 스킵한다 — 안 그러면 복원 위치→0 으로 튀어 '깜빡'인다
  // (사장님 리포트 2026-07-12). PUSH(링크·상위 이동)만 top 확정.
  const isPopNavRef = useRef(false)
  useEffect(() => {
    const onPop = () => {
      isPopNavRef.current = true
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // 라우트 전환(PUSH) 시 화면 최상단에서 시작 — 네이티브 앱 관용구.
  // 배경: 전역 smooth-scroll 제거(globals.css)로 96px 상시 밀림은 잡혔지만,
  // Next App Router 의 scroll-to-top 이 늦게 도착하는 레이아웃 시프트(데이터·
  // 이미지 로드, iOS safe-area)와 레이스가 나 '가끔' 내려간 채 로드되던 잔여
  // 케이스가 있었다. pathname 바뀔 때 즉시 + 다음 프레임 2회로 top 재확정(늦은
  // 시프트 흡수). window 스크롤만 만져 채팅/시트 등 내부 컨테이너엔 무영향.
  useEffect(() => {
    if (isPopNavRef.current) {
      // POP(뒤로/앞으로): 브라우저 스크롤 복원 유지 — 강제 top 금지(깜빡임 원인).
      isPopNavRef.current = false
      return
    }
    window.scrollTo(0, 0)
    const raf = requestAnimationFrame(() => window.scrollTo(0, 0))
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  // R-feel: 헤더 우측 강아지 칩 — 활성 강아지 이름 + 전환 드롭다운(없으면 등록).
  const activeDog = dogs.find((d) => d.id === activeDogId) ?? dogs[0] ?? null

  // R-feel: 화면별 헤더 — 깊은 화면이면 ← 뒤로 + 제목(탭 루트면 null).
  const router = useRouter()
  const screenTitle = screenTitleForPath(pathname)
  const isDeep = screenTitle !== null


  // 강아지 드롭다운 — 라우트 이동 시 자동 닫힘 (뒤로가기 등 외부 내비 포함).
  // effect 대신 render 중 보정 — react.dev 'Adjusting state when a prop changes' 패턴.
  const [menuPathname, setMenuPathname] = useState(pathname)
  if (menuPathname !== pathname) {
    setMenuPathname(pathname)
    setDogMenuOpen(false)
  }

  // 강아지 드롭다운 — 바깥 탭/Escape 로 닫기 (열려 있을 때만 listen).
  useEffect(() => {
    if (!dogMenuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (!dogMenuRef.current?.contains(e.target as Node)) setDogMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDogMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dogMenuOpen])

  // 드롭다운에서 강아지 선택 — 활성 강아지로 기억 + 홈(대시보드)의 표시
  // 정보를 그 아이로 전환. 강아지 상세로 이동하는 게 아니라, 홈 spotlight
  // (인사·활성카드·이번주·맞춤 추천 등 firstDog 기반 섹션)가 선택한 아이로 바뀐다.
  // 홈은 서버 컴포넌트라 localStorage 를 못 읽음 → 쿠키에도 기록해 서버가 읽게 함.
  function selectDog(id: string) {
    setActiveDogId(id)
    try {
      window.localStorage.setItem('ft_active_dog', id)
      // path=/ 전역, 1년 보존, lax — 홈 서버 컴포넌트가 활성 강아지 식별.
      // eslint-disable-next-line react-hooks/immutability -- document.cookie 쓰기는 정당한 부수효과(오탐)
      document.cookie = `ft_active_dog=${id}; path=/; max-age=31536000; samesite=lax`
    } catch {
      /* storage/cookie 불가 환경 — 칩 표시만 전환 */
    }
    setDogMenuOpen(false)
    // 홈으로 이동 + 서버 재렌더(refresh)로 선택한 아이 정보 반영.
    router.push('/dashboard')
    router.refresh()
  }

  return (
    // `phone-frame`: 데스크톱/태블릿(≥md)에서 이 래퍼를 "책상 위 폰"으로
    // 센터 정렬 + 그림자 부양 시킨다. 모바일(<md)에서는 규칙 전부 무시되어
    // 기존 full-bleed 경험 그대로. 상세 근거는 globals.css의 @media 블록
    // 주석 참고. 바깥 body도 --bg-2로 어두워져 "프레임 밖" 느낌이 산다.
    <div
      className="phone-frame min-h-screen bg-bg"
      data-ft-chrome="app"
      // focus 흐름(설문/체크인/승인 + 설문 직후 분석 결과)에서 헤더뿐 아니라
      // 강아지 탭 nav 도 CSS 로 확실히 숨기기 위한 신호(globals.css). 하이드레이션
      // 타이밍 무관 — nav 가 속한 하위 레이아웃이 늦게 뜨거나 실패해도 숨겨짐.
      data-focus={focusMode ? 'true' : undefined}
    >
      {/* 상단 헤더 v3 — 3-zone grid (좌 내정보/← · 중앙 logo.png · 우 강아지 칩).
          focus mode (설문/체크인 등) 에서는 hide. */}
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
          {/* ── Main row — 좌 내정보/← · 중앙 logo · 우 강아지 칩 (3-zone grid) ── */}
          <div
            className="grid items-center"
            // A5: minHeight 64 고정 — 값은 globals.css 의 --ft-header-h(64px) 와 동기.
            // Phase P (FD 헤더): 3-zone grid (좌 1fr · 중앙 auto · 우 1fr) —
            // 로고를 센터에. 로고 40→48px(h-12) 키우면서 padding 12→8 로 64 유지.
            style={{
              gridTemplateColumns: '1fr auto 1fr',
              paddingTop: 8,
              paddingBottom: 8,
              minHeight: 64,
              boxSizing: 'border-box',
            }}
          >
            {/* ── 좌측 zone — 깊은화면 ←(+제목) / 그 외 = 내 정보 진입 ── */}
            <div className="flex items-center justify-start min-w-0">
              {isDeep ? (
                <button
                  type="button"
                  onClick={() => router.push(parentForPath(pathname))}
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
                /* 홈 허브형: 탭루트(홈·우리아이·내정보)에서 좌측 = 내 정보 진입. */
                <Link
                  href="/mypage"
                  aria-label="내 정보"
                  className="flex items-center justify-center transition active:scale-95"
                  style={{ marginLeft: -8, padding: 8 }}
                >
                  <User
                    style={{ width: 22, height: 22, color: 'var(--ink)' }}
                    strokeWidth={1.8}
                  />
                </Link>
              )}
            </div>

            {/* ── 중앙 zone — 탭루트 로고(센터) / 깊은화면 빈칸 ── */}
            {isDeep ? (
              <span aria-hidden />
            ) : (
              <Link
                href="/dashboard"
                aria-label="홈"
                className="flex items-center justify-center transition active:scale-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-ink.png"
                  alt="Farmer's Tail"
                  className="h-8 w-auto"
                  fetchPriority="high"
                />
              </Link>
            )}

            {/* ── 우측 zone — 탭루트 = 활성 강아지 칩(없으면 등록). 깊은 화면 숨김. ── */}
            <div className="flex items-center justify-end min-w-0">
            {!isDeep && dogsLoaded && (
              dogs.length === 0 ? (
                <Link
                  href="/dogs/new"
                  aria-label="강아지 등록"
                  className="flex items-center shrink-0 transition active:scale-95"
                  style={{ gap: 4, marginRight: -8, padding: '6px 8px', borderRadius: 999 }}
                >
                  <Plus
                    style={{ width: 15, height: 15, color: 'var(--ink-mute)' }}
                    strokeWidth={2}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    강아지 등록
                  </span>
                </Link>
              ) : (
                <div ref={dogMenuRef} className="relative flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setDogMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={dogMenuOpen}
                    aria-label={activeDog ? `${activeDog.name} — 강아지 전환` : '강아지 전환'}
                    className="flex items-center transition active:scale-95"
                    style={{
                      gap: 3,
                      marginRight: -8,
                      padding: '6px 8px',
                      borderRadius: 999,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        maxWidth: 110,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {activeDog?.name}
                    </span>
                    <ChevronDown
                      style={{
                        width: 15,
                        height: 15,
                        color: 'var(--ink-mute)',
                        flexShrink: 0,
                        transform: dogMenuOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 200ms ease',
                      }}
                      strokeWidth={2}
                    />
                  </button>

                  {dogMenuOpen && (
                    <div
                      role="menu"
                      aria-label="내 강아지 목록"
                      className="ft-dropdown-pop absolute"
                      style={{
                        top: 'calc(100% + 6px)',
                        right: 0,
                        minWidth: 188,
                        maxHeight: '55vh',
                        overflowY: 'auto',
                        padding: 6,
                        borderRadius: 12,
                        background: 'var(--paper-hi)',
                        border: '1px solid var(--ink-rule, rgba(22,20,15,0.14))',
                        boxShadow:
                          '0 18px 44px -16px rgba(22,20,15,0.35), 0 2px 8px rgba(22,20,15,0.08)',
                      }}
                    >
                      {dogs.map((d) => {
                        const isActive = d.id === activeDog?.id
                        return (
                          <button
                            key={d.id}
                            type="button"
                            role="menuitem"
                            onClick={() => selectDog(d.id)}
                            className="flex items-center w-full text-left"
                            style={{
                              gap: 8,
                              padding: '11px 12px',
                              borderRadius: 4,
                              background: isActive
                                ? 'color-mix(in srgb, var(--accent) 7%, transparent)'
                                : 'none',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 14,
                                fontWeight: isActive ? 700 : 500,
                                color: 'var(--ink)',
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {d.name}
                            </span>
                            {isActive && (
                              <Check
                                className="shrink-0"
                                style={{
                                  width: 15,
                                  height: 15,
                                  color: 'var(--accent)',
                                  marginLeft: 'auto',
                                }}
                                strokeWidth={2.5}
                              />
                            )}
                          </button>
                        )
                      })}
                      <div
                        aria-hidden
                        style={{
                          height: 1,
                          margin: '4px 8px',
                          background: 'var(--ink-rule, rgba(22,20,15,0.10))',
                        }}
                      />
                      <Link
                        href="/dogs/new"
                        role="menuitem"
                        onClick={() => setDogMenuOpen(false)}
                        className="flex items-center"
                        style={{ gap: 7, padding: '11px 12px', borderRadius: 4 }}
                      >
                        <Plus
                          style={{ width: 15, height: 15, color: 'var(--ink-mute)', flexShrink: 0 }}
                          strokeWidth={2}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 13.5,
                            fontWeight: 500,
                            color: 'var(--ink-mute)',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          강아지 추가
                        </span>
                      </Link>
                    </div>
                  )}
                </div>
              )
            )}
            </div>
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
            : 'pb-[calc(40px+env(safe-area-inset-bottom))]'
        }`}
      >
        {children}
        {/* 앱 컨텍스트는 SiteFooter 숨김 — 사업자 정보 / 약관 / 환불정책 등은
            마이페이지 메뉴에서 진입. 매 페이지 하단에 노출되면 한국 앱 사용자
            UX 와 어긋남 (다른 앱들도 노출 안 함). 법적 표기는 /business,
            /legal/* 페이지 + 마이페이지 메뉴로 충분히 reachable. */}
      </main>

      {/* 빠른 기입 — 하단 중앙 발바닥 FAB(홈 허브형에서 자주 기입 진입 대체).
          활성 강아지 기준 라우팅, 몰입 화면(설문/체크인)에선 숨김. */}
      <PawFab activeDogId={activeDog?.id ?? null} hidden={focusMode || onDogDetail} />

      {/* 홈 허브형(2026-06-17): 하단 탭바 제거 — 내비 = 로고(→홈) +
          헤더 좌측 계정 아이콘(→내정보) + 홈 카드/강아지 칩. 깊은 화면은 ← 뒤로. */}

    </div>
  )
}
