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
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import BottomTabBar from '@/components/app/BottomTabBar'

// 홈 허브형(2026-06-17) + 구독전환(2026-06-27): 장바구니 탭·카트 아이콘·
// 하단 탭바 전부 폐기. TABS 배열 폐기.
// 내비 = 로고(→/dashboard) + 헤더 좌측 계정(→/mypage) + 홈 카드/강아지 칩 + ← 뒤로.

/**
 * 액션 집중 라우트 — 상단 header / 하단 nav 모두 hide. 설문 / 체크인 /
 * 처방 승인 같은 step-by-step 흐름에서 시각 부담 ↓. 사용자 피드백 반영.
 */
// '/first-checkin' 은 '/checkin' 을 포함하지 않는다('-checkin') — 첫 박스 체크인(시안 S27·S28 — 윗줄·아래 탭 없음)도 몰입 화면으로
// 따로 적는다(2026-10-09). 예전엔 "< 강아지" + 아래 탭 + 강아지 위 탭이 붙었다.
const FOCUS_PATHS = ['/survey', '/checkin', '/first-checkin', '/approve']

/**
 * 결제 퍼널(레시피 고르기 /plan → 주문·결제 /order)은 자체 **하단 고정 바**(플랜 담기 /
 * 결제)를 쓴다. 2026-09-21 하단 탭이 돌아오면서 그 바가 탭 아래 깔려 "플랜 담기·결제"
 * 버튼이 통째로 가려졌다(2026-09-23 에뮬레이터 실측 — 첫 결제에서 돈이 새는 자리).
 * 헤더(← 뒤로)는 남기고 탭만 숨긴다. 규칙88.
 */
const CHECKOUT_RE = /\/dogs\/[^/]+\/(plan|order)(\/|$)/

/**
 * 주문 영수증(시안 M09) — 종이 한 장과 '이미지로 저장' 버튼으로 끝나는 문서 화면이라 아래 탭이 없다(2026-10-09).
 * 헤더(← 주문 상세)는 그대로. 탭이 없으니 아래 여백도 몰입 화면처럼 safe-area 만.
 */
const RECEIPT_RE = /^\/mypage\/orders\/[^/]+\/receipt\/?$/

/**
 * R-feel: 화면별 헤더.
 * 탭 루트(홈/강아지/내정보)는 로고+강아지 칩 기본 헤더.
 * 그 외 "깊은 화면"은 ← 뒤로 + 화면 제목 으로 — '앱 같다'의 핵심.
 *
 * screenTitleForPath: null → 탭 루트(기본 헤더). 문자열 → 깊은 화면 제목
 * (빈 문자열이면 ← 만, 제목 없음).
 */
// 구독전환: /cart·/products 폐지(redirect). 탭 루트 = 홈·강아지·내정보만.
// 2026-09-21 하단 탭 복귀: 정기배송(/mypage/subscriptions)도 탭 루트 — ← 없이 기본 헤더.
const TAB_ROOTS = new Set(['/dashboard', '/dogs', '/mypage', '/mypage/subscriptions'])

/** 탭 화면 윗줄 제목(앱 새 디자인 2026-10-09 — 탭 화면은 화면 이름만). 홈은 제목 대신 로고. */
const TAB_TITLES: Record<string, string> = {
  '/dogs': '우리 아이',
  '/mypage/subscriptions': '정기배송',
  '/mypage': '내 정보',
}

/**
 * 앱을 켰을 때 처음 떨어지는 화면. public/manifest.json 의 `start_url` 과
 * **반드시 같아야 한다** — 관리자 모드 자동 복귀가 "시작 화면일 때만" 동작하는
 * 판정에 쓰인다(딥링크로 들어온 걸 가로채지 않기 위해).
 * manifest 를 바꾸면 여기도 같이 바꿀 것.
 */
const APP_START_PATH = '/dashboard'

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
  // 2026-10-09 앱 새 디자인 — 아래 셋은 '강아지'(접두 폴백)로 떴다(앱시안 결정 3번 "진료 보고서 윗줄 제목 누락").
  '/dogs/:id/vet-report': '진료 보고서',
  // 식단(맞춤 박스) 기록 — 예전 '강아지'(앱시안 결정 16번: 윗줄 이름 "강아지" → "맞춤 박스").
  '/dogs/:id/formulas': '맞춤 박스',
  '/dogs/:id/analyses': '분석 기록',
  '/dogs/:id/analyses/:id': '지난 분석',
  '/dogs/:id/reminders': '건강 관리',
  '/dogs/:id/order': '주문하기',
  '/dogs/:id/plan': '레시피 고르기',
  // 구독 탭이 상단에서 빠지고(2026-09-21) 하단 '정기배송' 탭이 대신한다 — 제목도 맞춘다.
  '/dogs/:id/subscription': '정기배송',
  '/dogs/:id/year-in-review': '연말 결산',
  '/faq': '자주 묻는 질문',
  '/help': '고객센터',
  '/mypage/orders': '주문 내역',
  // 주문 상세 아래 두 화면(시안 M09·M10) — 예전엔 접두사 규칙에 걸려 둘 다 '주문 상세'로 떴다(2026-10-09).
  '/mypage/orders/:id/receipt': '주문 영수증',
  '/mypage/orders/:id/track': '운송장 조회',
  // 마이페이지 메뉴에서 '주문 내역' 과 합쳐진 화면이라 제목도 같이 간다
  // (2026-07-30). 메뉴 라벨과 헤더가 다르면 잘못 들어온 것처럼 느껴진다.
  '/account/subscriptions': '정기배송',
  '/mypage/addresses': '배송지 관리',
  // 2026-10-09 앱 새 디자인 묶음④(시안 M01~M03·M20~M22) — 예전엔 제목이 비거나 '내 정보'로 떴다.
  '/account/profile': '내 프로필',
  '/mypage/addresses/new': '새 배송지',
  '/mypage/addresses/:id/edit': '배송지 수정',
  '/business': '사업자 정보',
  '/legal': '약관 · 정책',
  '/legal/terms': '이용약관',
  '/legal/privacy': '개인정보처리방침',
  '/legal/refund': '환불 정책',
  '/mypage/membership': '멤버십',
  '/mypage/accuracy': '분석 맞춤도',
  '/mypage/cs': '1:1 문의',
  '/mypage/notifications': '알림',
  '/mypage/consent': '알림',
  '/mypage/privacy': '내 데이터',
  '/mypage/delete': '회원 탈퇴',
  '/reports': '건강 리포트',
  '/notifications': '알림',
  '/chat': 'AI 영양 상담',
  // 앱 전용 4종 비교(app/compare — (main) 밖이라 AuthAwareShell 로 이 chrome 을 쓴다).
  '/compare': '4종 비교',
  // 앱 새 디자인 바탕 공사 점검 화면(미리보기·로컬 전용, 실제 사이트 404).
  '/design-check': '디자인 점검',
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

function parentForPath(pathname: string, search = ''): string {
  // /compare(4종 비교) — 유일한 입구가 강아지 분석 화면의 '4종 라인 비교' 카드다
  // (app/compare/page.tsx 규칙). 경로에 강아지가 없으니 그 카드가 ?dog=<id> 를
  // 실어 보내고, ← 는 그 분석 화면으로 올라간다(2026-10-02 사장님 "뒤로가기
  // 없음"). id 가 없거나 형식이 틀리면 다른 모르는 화면처럼 홈으로.
  if (pathname === '/compare') {
    const dog = new URLSearchParams(search).get('dog')
    if (dog && new RegExp(`^${UUID_RE}$`).test(dog)) return `/dogs/${dog}/analysis`
    return '/dashboard'
  }
  const dogMatch = pathname.match(new RegExp(`^/dogs/(${UUID_RE})(/.+)?$`))
  if (dogMatch) {
    const dogBase = `/dogs/${dogMatch[1]}`
    const sub = dogMatch[2]
    if (!sub) return '/dashboard'
    const segs = sub.split('/').filter(Boolean)
    if (segs.length >= 2) return `${dogBase}/${segs.slice(0, -1).join('/')}`
    return dogBase
  }
  // 영수증·운송장 조회 → 그 주문 상세(시안 M09·M10 의 ←). 예전엔 주문 내역 목록까지 두 단계를 건너뛰었다.
  const orderSub = pathname.match(/^\/mypage\/orders\/([^/]+)\/(receipt|track)\/?$/)
  if (orderSub) return `/mypage/orders/${orderSub[1]}`
  if (pathname.startsWith('/mypage/orders/')) return '/mypage/orders'
  // 배송지 새로·수정 → 내 프로필(배송지 묶음이 있는 곳, 시안 M02·M03). 앱시안 결정 3번 '동작': 예전엔 내 정보 첫
  //   화면으로 튀었다. 아래 '/mypage/' 규칙보다 앞에 있어야 한다.
  if (/^\/mypage\/addresses\/(new|[^/]+\/edit)\/?$/.test(pathname)) return '/account/profile'
  // 강아지 등록증 → 멤버십(나무 등급에서 들어가는 곳, 시안 M05·M06).
  if (pathname.startsWith('/mypage/certificate/')) return '/mypage/membership'
  if (pathname.startsWith('/mypage/')) return '/mypage'
  // 고객센터 허브에서 펼쳐지는 화면들 → 허브로(홈으로 튀지 않게, 2026-07-16).
  if (pathname === '/faq' || pathname === '/business' || pathname === '/contact')
    return '/help'
  // 약관·정책 — 허브(/legal)는 내 정보 메뉴에서, 각 문서는 허브에서 들어간다(시안 M21·M22).
  if (pathname === '/legal') return '/mypage'
  if (pathname.startsWith('/legal/')) return '/legal'
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
  // 탭바만 숨기는 화면(결제 퍼널) — 헤더는 그대로.
  const checkout = CHECKOUT_RE.test(pathname)
  const receipt = RECEIPT_RE.test(pathname)
  const tabBarHidden = focusMode || checkout || receipt

  // 내 강아지 목록 — 가운데 기록 버튼이 누구로 기록할지(활성 강아지). 2026-10-09 앱 새 디자인으로 윗줄 칩은 뺐고
  // 고르기는 홈 탭(HomeDogTabs)이 한다 — 여기선 목록과 활성 아이만 들고 있는다.
  const [dogs, setDogs] = useState<
    { id: string; name: string; photoUrl: string | null }[]
  >([])
  const [activeDogId, setActiveDogId] = useState<string | null>(null)
  // 홈 알림 종의 빨간 점 — 안 읽은 받은 알림(push_log.read_at 없음)이 있으면(시안 AppHome).
  const [hasUnread, setHasUnread] = useState(false)
  // 관리자 모드 스위치는 '내 정보'(components/app/AdminModeRow)로 옮겼다(2026-10-09). 여기엔 '앱 켤 때 한 번
  // 관리자 화면으로 복귀'만 남는다 — 판정은 DB is_admin() RPC, 선택은 localStorage ft_admin_mode.
  // ↓ 아래 fetchDogs 효과가 관리자 모드 복귀에 쓰므로 **효과보다 위**에서 선언.
  // (앱 실행당 1회 복귀 판정은 ref 가 아니라 sessionStorage 로 한다 — 효과 안 참고)
  const router = useRouter()

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

      // 관리자 여부 — 실패하면 조용히 false(헤더가 깨지면 안 됨).
      //
      // ★최종감사 #23 (2026-07-29): boot 플래그 소진을 RPC **앞**으로 옮겼다.
      //   예전엔 adminFlag===true 블록 안에서만 플래그를 찍어서, 콜드 스타트에
      //   RPC 가 일시 실패하면 플래그가 안 찍힌 채 넘어갔다 — 그러면 나중에
      //   백그라운드 복귀(visibilitychange)로 fetchDogs 가 재실행돼 RPC 가
      //   성공하는 순간, **세션 한중간에** /admin 으로 끌려갈 수 있었다.
      //   "앱 켠 직후 딱 한 번"이라는 계약은 시도 1회를 뜻한다 — 그 시도가
      //   실패하면 이번 세션의 자동 복귀는 포기한다(사장님이 토글로 가면 됨).
      let bootHandled = false
      try {
        bootHandled = window.sessionStorage.getItem('ft_admin_boot') === '1'
        window.sessionStorage.setItem('ft_admin_boot', '1')
      } catch {
        /* 저장소 접근 불가 — 복귀 시도 안 함(강제 이동이 더 위험) */
        bootHandled = true
      }
      try {
        const { data: adminFlag } = await supabase.rpc('is_admin')
        if (mounted && adminFlag === true) {
          let storedOn = false
          try {
            storedOn = window.localStorage.getItem('ft_admin_mode') === '1'
          } catch {
            /* 저장소 접근 불가 — 기본 꺼짐 */
          }

          // ── 앱을 껐다 켜면 관리자 모드가 풀리던 버그 (2026-07-26 사장님 제보)
          // 앱 시작 경로는 manifest start_url = '/dashboard' 로 **고정**이다.
          // 그래서 콜드 스타트하면 늘 일반 화면에 떨어지는데, 위에서
          // localStorage 를 읽어 스위치만 ON 으로 켜졌다. 결과: "토글은 켜져
          // 있는데 화면은 일반" → 껐다 켜야 관리자로 넘어감.
          //
          // 켜둔 상태였으면 **앱을 켠 직후 딱 한 번만** /admin 으로 넘긴다.
          //
          // ★버그 수정(2026-07-26 사장님 제보): 예전엔 useRef 로 "1회"를 셌는데,
          //   /admin(AdminShell) ↔ /dashboard(AppChrome) 를 오갈 때마다 AppChrome
          //   이 **새로 마운트**되며 ref 가 false 로 리셋됐다. 그래서 관리자 화면
          //   에서 일반 화면으로 돌아가면 곧바로 fetchDogs 가 다시 돌아 /admin 으로
          //   강제로 끌고 왔다("돌아가기 해도 다시 관리자로 돌아옴").
          //
          //   sessionStorage 는 이 웹뷰 세션 전체에서 유지되고 **앱을 완전히
          //   종료할 때만** 지워진다(백그라운드 복귀·앱 내 이동에는 유지). 그래서:
          //     · 앱 켠 직후(콜드 스타트) → 플래그 없음 → 1회 복귀
          //     · 그 뒤 대시보드로 이동 → 플래그 있음 → **그대로 머문다**
          //     · 앱 완전 종료 후 재시작 → 플래그 지워짐 → 다시 관리자로
          //   = 사장님이 원한 "종료 후 재시작하면 관리자, 그 외엔 내가 정한 화면".
          // (플래그 읽기·소진은 위 — RPC 실패와 무관하게 세션당 1회만 시도)
          // 시작 화면일 때만 — 알림 딥링크로 특정 화면에 들어온 걸 가로채지 않게.
          // replace 로 — 뒤로가기가 /dashboard 로 되돌아가지 않게.
          if (
            !bootHandled &&
            storedOn &&
            window.location.pathname === APP_START_PATH
          ) {
            router.replace('/admin')
          }
        }
      } catch {
        /* 일반 사용자거나 조회 실패 — 스위치 미노출 */
      }
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
    // router 는 App Router 에서 안정 참조라 재구독을 유발하지 않는다.
  }, [supabase, router])

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

  // 활성 강아지 — 가운데 기록 버튼(BottomTabBar)이 이 아이로 기록한다.
  const activeDog = dogs.find((d) => d.id === activeDogId) ?? dogs[0] ?? null

  // R-feel: 화면별 헤더 — 깊은 화면이면 ← 뒤로 + 제목(탭 루트면 null).
  const screenTitle = screenTitleForPath(pathname)
  const isDeep = screenTitle !== null


  // 홈 탭(HomeDogTabs)에서 아이를 고르면 기록 대상도 바로 바뀐다 — 저장소(localStorage·쿠키)는 탭이 쓴다.
  useEffect(() => {
    function onPick(e: Event) {
      const id = (e as CustomEvent<string>).detail
      if (typeof id === 'string') setActiveDogId(id)
    }
    window.addEventListener('ft-active-dog', onPick)
    return () => window.removeEventListener('ft-active-dog', onPick)
  }, [])

  // 홈에 올 때마다 안 읽은 알림이 있는지 본다(알림 화면에서 읽고 돌아오면 점이 사라진다).
  // 조회 실패는 점 없음 — 있는 척하지 않는다. 개수만(head) 받아 가볍게.
  useEffect(() => {
    if (pathname !== '/dashboard') return
    let alive = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!alive || !uid) return
      const { count, error } = await supabase
        .from('push_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .is('read_at', null)
      if (!alive || error) return
      setHasUnread((count ?? 0) > 0)
    })()
    return () => {
      alive = false
    }
  }, [pathname, supabase])

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
      {/* 상단 헤더 — 앱 새 디자인('A 포스터', 2026-10-09). 홈 = 왼쪽 작은 로고 + 오른쪽 알림 종 /
          탭 화면 = 화면 이름 / 깊은 화면 = ← + 이름. 사람 아이콘·가운데 큰 로고는 뺐다(아래 탭 '내 정보'와 겹침 — 시안 결정).
          ★2026-10-10 토스식(사장님이 세 안 중 고름): 아래 선을 없애고 높이 64 → 56. 토스 윗줄은 높이가 우리와 거의 같은데
          선이 없고 바탕과 같은 색이라 띠로 안 읽혔다(캡처 실측).
          focus mode (설문/체크인 등) 에서는 hide. */}
      {!focusMode && (
      <header
        className="sticky top-0 z-40"
        style={{
          // 상태바 구간 색(--ft-native-bg)과 같은 색 — 새 셸은 흰색(= --paper). 옛 셸은 로딩 동안 네이티브가 상태바를
          // 그 셸 색으로 칠하므로 윗줄도 그 색이고, 로딩이 걷히며 상태바를 흰색으로 바꾸는 데 성공하면 같이 흰색이 된다
          // (html.ft-sb-white — 규칙166).
          background: 'var(--ft-native-bg)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div
          className="max-w-md mx-auto"
          // 오른쪽 여백 — 우리 아이 목록은 '+ 추가' 버튼이 있어 12(시안 T07), 그 밖엔 48px 아이콘 칸이라 8.
          style={{ paddingLeft: isDeep ? 6 : 20, paddingRight: pathname === '/dogs' ? 12 : 8 }}
        >
          {/* A5: minHeight 고정 — 값은 globals.css 의 --ft-header-h(56px) 와 동기(2026-10-10 토스식 64 → 56). */}
          <div
            className="flex items-center justify-between"
            style={{ minHeight: 56, gap: 8, boxSizing: 'border-box' }}
          >
            {/* ── 왼쪽 — 깊은 화면 ← + 이름 / 홈 로고 / 탭 화면 이름 ── */}
            <div className="flex items-center justify-start min-w-0" style={{ gap: 4 }}>
              {isDeep ? (
                <>
                  <button
                    type="button"
                    // 쿼리는 누르는 순간에 읽는다 — 렌더에서 읽으면 SSR/하이드레이션이 갈린다.
                    onClick={() => router.push(parentForPath(pathname, window.location.search))}
                    aria-label="뒤로"
                    className="flex items-center justify-center shrink-0 transition active:scale-95"
                    style={{ width: 48, height: 48, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {/* 꺾쇠(<) — 시안의 모든 깊은 화면 뒤로 가기(26px, 선 2). */}
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      style={{ color: 'var(--ink)' }}
                    >
                      <path d="M15 5l-7 7 7 7" />
                    </svg>
                  </button>
                  {screenTitle && (
                    <span
                      className="ft-poster truncate"
                      style={{ fontSize: 22, lineHeight: 1.2, color: 'var(--ink)' }}
                    >
                      {screenTitle}
                    </span>
                  )}
                </>
              ) : pathname === '/dashboard' ? (
                <Link
                  href="/dashboard"
                  aria-label="파머스테일 홈"
                  className="flex items-center transition active:scale-95"
                  style={{ height: 48 }}
                >
                  {/* 2026-10-10 사장님 "로고가 너무 작고 위쪽에 있는 느낌" — 시안 17px → 24px. 그림 아래 23% 가 작은
                      'FARM·TO·TAIL' 줄이라 그림을 가운데 두면 글자(위 77%)가 3px 위로 떠 보인다 → 3px 내려 글자를 가운데로. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo-ink.png"
                    alt="파머스테일"
                    style={{ height: 24, width: 'auto', display: 'block', position: 'relative', top: 3 }}
                    fetchPriority="high"
                  />
                </Link>
              ) : (
                <span className="ft-poster truncate" style={{ fontSize: 26, lineHeight: 1.15, color: 'var(--ink)' }}>
                  {TAB_TITLES[pathname] ?? ''}
                </span>
              )}
            </div>

            {/* ── 오른쪽 — 홈 = 알림 종(안 읽은 알림이 있으면 빨간 점) · 우리 아이 목록 = '+ 추가'. 그 밖엔 비운다(시안). ── */}
            <div className="flex items-center justify-end shrink-0">
            {/* 우리 아이 목록(시안 T07·T08) — 아이를 더 등록하는 입구. 목록 안의 옛 '추가' 버튼은 시안대로 뺐으므로
                이 버튼이 없으면 이미 아이가 있는 보호자는 목록에서 등록할 길이 없다(홈 여러 마리 탭의 '+' 하나뿐). */}
            {pathname === '/dogs' && (
              <Link
                href="/dogs/new"
                className="flex items-center transition active:scale-95"
                style={{
                  height: 44,
                  padding: '0 16px 0 12px',
                  borderRadius: 4,
                  background: 'var(--ink)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: 16,
                  fontWeight: 800,
                  gap: 6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                추가
              </Link>
            )}
            {pathname === '/dashboard' && (
              <Link
                href="/notifications"
                aria-label={hasUnread ? '받은 알림, 새 알림이 있어요' : '받은 알림'}
                className="relative flex items-center justify-center transition active:scale-95"
                style={{ width: 48, height: 48, color: 'var(--ink)' }}
              >
                <Bell style={{ width: 26, height: 26 }} strokeWidth={2} />
                {hasUnread && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 9,
                      height: 9,
                      borderRadius: 6,
                      background: 'var(--sale)',
                      border: '2px solid var(--ft-native-bg)',
                      boxSizing: 'content-box',
                    }}
                  />
                )}
              </Link>
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
        // overflow-x-clip = 가로 오버플로우 전역 가드(2026-07-19 사장님 폰: 강아지
        // 등록 화면이 가로로 밀려 "확대/축소 잠금이 풀린" 것처럼 보였다). 어떤
        // 페이지의 자식이 뷰포트보다 넓어도 여기서 잘라 페이지 가로 팬/줌아웃을
        // 막는다. clip 은 scroll 컨테이너를 안 만들어 내부 sticky(설문 CTA 등)를
        // 안 깨뜨림. min-w-0 = flex/grid 자식이 컨텐츠로 뷰포트를 밀어내는 것 차단.
        // 하단 탭(--ft-tabbar-h) 위로 마지막 컨텐츠가 올라오게 — 탭이 없는
        // 몰입 화면에선 safe-area 만.
        // 결제 퍼널은 탭 대신 자기 결제 바(플랜 담기/결제, ~74px)가 하단에 떠 있다 —
        // 탭 여백을 0으로 하면 마지막 줄이 그 바 밑에 가려진다(2026-09-23 에뮬레이터
        // 실측: 주문 화면 "정기배송가" 줄 59px 가려짐). 바 높이 변수(--ft-paybar-h)만큼 준다.
        className={`max-w-md mx-auto min-w-0 overflow-x-clip ${
          focusMode || receipt
            ? 'pb-[env(safe-area-inset-bottom)]'
            : checkout
              ? 'pb-[calc(var(--ft-paybar-h,80px)+16px+env(safe-area-inset-bottom))]'
              : 'pb-[calc(var(--ft-tabbar-h,68px)+20px+env(safe-area-inset-bottom))]'
        }`}
      >
        {children}
        {/* 앱 컨텍스트는 SiteFooter 숨김 — 사업자 정보 / 약관 / 환불정책 등은
            마이페이지 메뉴에서 진입. 매 페이지 하단에 노출되면 한국 앱 사용자
            UX 와 어긋남 (다른 앱들도 노출 안 함). 법적 표기는 /business,
            /legal/* 페이지 + 마이페이지 메뉴로 충분히 reachable. */}
      </main>

      {/* 하단 탭 5칸(홈·우리 아이·기록·정기배송·내 정보) — 2026-09-21 시니어
          사용성 기획으로 복귀. 2026-06-17 에 뺐던 탭바를 되살린 것이고, 우하단
          발바닥 FAB 는 가운데 "기록" 탭으로 흡수했다. 앱 전용·몰입 화면 숨김은
          컴포넌트 안에서 처리. */}
      <BottomTabBar
        activeDogId={activeDog?.id ?? null}
        activeDogName={activeDog?.name ?? null}
        hidden={tabBarHidden}
      />

    </div>
  )
}
