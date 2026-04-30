/**
 * Next.js 16 Proxy (이전 이름: Middleware).
 *
 * 하는 일
 * --------
 * 요청이 실제 route handler / React Server Component에 닿기 전에, 비용이 큰/
 * 민감한 엔드포인트에 **IP 기반 레이트 리밋**을 걸어 무차별 대입, 카드 테스팅,
 * 푸시 스팸, 어드민 브루트 같은 공격을 얕게라도 막는다.
 *
 * 전체 /api/* 에 때리지 않는 이유
 * -------------------------------
 * - 결제 webhook 같은 엔드포인트는 토스가 리트라이를 퍼부으므로 우리가 429를
 *   주면 오히려 사고. 그런 건 제외.
 * - 비용이 낮은 GET (/api/tracking 같이) 까지 막으면 정상 사용자가 스로틀에
 *   걸려 PDP가 느려지는 역효과.
 *
 * 그래서 **허용 목록 방식(opt-in)**으로 간다. 새 엔드포인트가 생기면 아래 RULES에
 * 추가. 추가 안 했다고 뚫리는 건 아니고, 단지 얕은 1차 방어막이 없는 상태일 뿐.
 *
 * 스토어
 * ------
 * lib/rate-limit.ts가 Edge isolate 로컬 Map을 쓴다. 인스턴스가 여럿이면 실효
 * 한도 = quota × 인스턴스 수. 트래픽이 커지면 Upstash 같은 외부 스토어로 교체.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

type Rule = {
  /** 경로 prefix. 정확 매칭이 아니라 startsWith. */
  path: string
  /** HTTP method 필터. 생략하면 모든 메서드. */
  methods?: readonly ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[]
  /** rate limit bucket 이름 — 로그/디버깅 라벨. */
  bucket: string
  /** 윈도우당 허용 횟수. */
  limit: number
  /** 윈도우 길이 (ms). */
  windowMs: number
}

/**
 * 엔드포인트별 정책. 상단 = 더 구체적인 규칙. 첫 매치가 이김.
 *
 * 숫자 튜닝 근거
 * --------------
 * - auth (로그인/회원가입 관련): 60초 10회 — 정상 사용자가 비밀번호 3회쯤 틀리고
 *   재시도하는 패턴까진 허용, 그 이상은 스크립트 의심.
 * - payment confirm: 60초 5회 — 한 결제 세션에 confirm이 여러 번 실행될 일 없음.
 *   카드 테스팅 공격은 수십~수백 시도/초라 이 한도면 확실히 막힘.
 * - admin 쓰기 (upload/status/duplicate/partial-cancel): 60초 30회 — 관리자 1명이
 *   초당 0.5 request는 정상 상한. 그 이상이면 스크립트거나 실수.
 * - push subscribe / unsubscribe / test: 60초 10회 — PWA 설치 흐름에서 자연스러운 횟수.
 * - account delete: 60초 3회 — 한 번에 해결되는 액션. 반복 호출은 의심스러움.
 * - orders cancel / tracking / analysis commentary: 60초 20회 — 정상 사용자 상한.
 *
 * 모든 숫자는 가설이다. Sentry나 로그로 false positive가 보이면 즉시 완화.
 */
const RULES: readonly Rule[] = [
  // 결제 webhook은 제외 — Toss 서버가 리트라이 폭주시킬 수 있어 429 주면 안 됨.
  // `/api/payments/webhook`은 아래 매처에 일부러 포함 안 함.

  // 결제 confirm은 가장 위험 — 카드 테스팅 타겟.
  {
    path: '/api/payments/confirm',
    methods: ['POST'],
    bucket: 'payments-confirm',
    limit: 5,
    windowMs: 60_000,
  },
  // Admin write 엔드포인트들 — FORBIDDEN이 계속 나오면 공격 의심.
  {
    path: '/api/admin/',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    bucket: 'admin-write',
    limit: 30,
    windowMs: 60_000,
  },
  // 계정 삭제 — 연속 호출 의미 없음.
  {
    path: '/api/account/delete',
    methods: ['POST', 'DELETE'],
    bucket: 'account-delete',
    limit: 3,
    windowMs: 60_000,
  },
  // Web Push — 스팸 채널로 악용될 수 있음.
  {
    path: '/api/push/',
    methods: ['POST', 'DELETE'],
    bucket: 'push',
    limit: 10,
    windowMs: 60_000,
  },
  // 주문 취소 — 중복 호출 방지 + 스크립트 공격 완화.
  {
    path: '/api/orders/',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    bucket: 'orders',
    limit: 20,
    windowMs: 60_000,
  },
  // 외부 API 호출 → Anthropic commentary — 비용/quota 보호 차원.
  {
    path: '/api/analysis/commentary',
    methods: ['POST'],
    bucket: 'analysis-commentary',
    limit: 20,
    windowMs: 60_000,
  },
  // 배송 추적 조회 — GET이라 부담 적지만 크롤러가 긁으면 외부 API 비용.
  {
    path: '/api/tracking',
    methods: ['GET', 'POST'],
    bucket: 'tracking',
    limit: 30,
    windowMs: 60_000,
  },
]

function findRule(pathname: string, method: string): Rule | undefined {
  for (const r of RULES) {
    if (!pathname.startsWith(r.path)) continue
    if (r.methods && !r.methods.includes(method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')) {
      continue
    }
    return r
  }
  return undefined
}

// =============================================================================
// 앱 전용 라우트 보호 (Web/App 분리 모델)
// =============================================================================
//
// 본 서비스는 Web (브라우저, 마케팅·판매) 와 App (PWA / Capacitor 네이티브,
// 강아지 케어 다이어리) 를 분리한다. 일부 라우트는 앱 전용이며 웹 사용자가
// 직접 URL 입력 / 외부 링크로 진입하면 `/app-required` 다운로드 페이지로
// 보낸다.
//
// 감지: `ft_app=1` 쿠키 — `components/AppContextCookieSync.tsx` 가 client
// 에서 PWA standalone / Capacitor 네이티브 감지 시 자동 set.
//
// 첫 진입은 쿠키가 아직 없을 수 있어 client-side hook 가 한 번 더 검증.
// 본 proxy 의 redirect 는 명시적으로 ft_app 쿠키가 없는 케이스만 잡음.
//
// 라우트 분류는 README / LAUNCH_CHECKLIST 와 SSOT 로 동기화:
//   • Web/Both:  /, /products, /blog, /events, /about, /business,
//                /legal/*, /login, /signup, /cart, /checkout,
//                /mypage/orders/*, /api/*, /admin/*, /auth/*
//   • App only:  /dashboard, /dogs/*, /welcome,
//                /mypage/{addresses,subscriptions,reviews,points,coupons,
//                         wishlist,notifications,consent,delete,referral}/*

const APP_ONLY_PREFIXES: readonly string[] = [
  '/dashboard',
  '/dogs',
  '/welcome',
  // /mypage 자체는 web 사용자도 진입 시 chrome 분기되지만, /mypage 의
  // sub-route 중 web 으로 노출 가능한 건 /mypage/orders 뿐. 나머지는 app 전용.
  '/mypage/addresses',
  '/mypage/subscriptions',
  '/mypage/reviews',
  '/mypage/points',
  '/mypage/coupons',
  '/mypage/wishlist',
  '/mypage/notifications',
  '/mypage/consent',
  '/mypage/delete',
  '/mypage/referral',
]

/** Web 가 진입 가능한 mypage exception — 정확 매치 (prefix 아님). */
const MYPAGE_WEB_ALLOWED = new Set([
  '/mypage/orders',
])
function isWebAllowedMypage(pathname: string): boolean {
  if (MYPAGE_WEB_ALLOWED.has(pathname)) return true
  // /mypage/orders/[id], /mypage/orders/[id]/track 등 sub-route 도 허용
  if (pathname.startsWith('/mypage/orders/')) return true
  return false
}

function isAppOnlyPath(pathname: string): boolean {
  return APP_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/**
 * `/admin` 진입 시 Supabase JWT app_metadata.role === 'admin' 검증.
 *
 * 라우트별 isAdmin() 가드(lib/auth/admin.ts) 는 이미 application-level 에서
 * 작동하지만, proxy 한 줄이 forgot-to-guard 사고 (새 admin route 만들 때 가드
 * 빼먹는 케이스) 를 막는 보험. JWT 만 검사 — DB 라운드트립 없음. profiles.role
 * fallback 은 라우트 핸들러의 isAdmin() 에 위임 (defense in depth).
 *
 * 비-admin 진입 시 봇 스캐너에 admin 라우트 존재 단서를 노출하지 않도록
 * 그냥 root 로 redirect (404/403 같은 코드 없이).
 */
async function checkAdminAccess(request: NextRequest): Promise<NextResponse | null> {
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const c of toSet) {
            res.cookies.set(c.name, c.value, c.options)
          }
        },
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  const role = (user.app_metadata as { role?: string } | null | undefined)?.role
  if (role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  return null // 통과 — 계속 진행
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 0) Admin 가드 — application-level isAdmin() 의 보조 방어선.
  if (pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    const blocked = await checkAdminAccess(request)
    if (blocked) return blocked
  }

  // 1) 앱 전용 라우트 보호 — rate limit 보다 먼저. 웹 사용자에겐 곧장
  // /app-required 로 redirect.
  if (isAppOnlyPath(pathname)) {
    const appCookie = request.cookies.get('ft_app')?.value
    if (appCookie !== '1') {
      const url = request.nextUrl.clone()
      url.pathname = '/app-required'
      url.search = `?from=${encodeURIComponent(pathname + request.nextUrl.search)}`
      return NextResponse.redirect(url)
    }
  }

  // 1-a) /mypage 자체 (= 케어 다이어리 hub) — 웹 사용자가 들어오면 web 호환
  // 페이지 (/mypage/orders) 로 보낸다. 이는 (main) 의 auth-gated AppChrome 이
  // 웹 컨텍스트에서 발현하지 않게 막아주는 추가 안전망.
  if (
    (pathname === '/mypage' || pathname.startsWith('/mypage/')) &&
    !isWebAllowedMypage(pathname) &&
    !isAppOnlyPath(pathname) // 위에서 이미 처리됨
  ) {
    const appCookie = request.cookies.get('ft_app')?.value
    if (appCookie !== '1' && pathname === '/mypage') {
      const url = request.nextUrl.clone()
      url.pathname = '/mypage/orders'
      return NextResponse.redirect(url)
    }
  }

  // 1-b) App 사용자가 marketing 랜딩 ("/") 으로 진입하면 dashboard 로.
  // 랜딩은 풀와이드 마케팅 페이지라 phone-frame 안에 들어가면 어색하고,
  // 앱의 정체성 (= 케어 다이어리) 와도 맞지 않다.
  if (pathname === '/') {
    const appCookie = request.cookies.get('ft_app')?.value
    if (appCookie === '1') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // 2) Rate limit — /api/* 만 (RULES 가 정의된 곳).
  const rule = findRule(pathname, request.method)
  if (!rule) return NextResponse.next()

  const ip = ipFromRequest(request)
  const r = rateLimit({
    bucket: rule.bucket,
    key: ip,
    limit: rule.limit,
    windowMs: rule.windowMs,
  })

  // 정상 응답에는 informational 헤더만 덧붙임 (안 달아도 무방, 디버깅용).
  if (r.ok) {
    const res = NextResponse.next()
    r.headers.forEach((v, k) => res.headers.set(k, v))
    return res
  }

  // 429 — JSON body로 코드/메시지 주는 편이 route handler 응답 스타일과 일치.
  return NextResponse.json(
    {
      code: 'RATE_LIMITED',
      message: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
      retryAfter: r.retryAfter,
    },
    { status: 429, headers: r.headers }
  )
}

/**
 * 매처. 세 가지 책임:
 *   1) `/api/*`              — rate-limit RULES 적용
 *   2) `/dashboard`, `/dogs/*`, `/mypage/*`, `/welcome` — 앱 전용 가드
 *   3) `/admin/*`            — JWT 기반 admin 검증
 *
 * 정적 자산 / Next.js 내부 / favicon / icons / fonts 같은 안 막아야 할 경로는
 * 매처가 1차 필터. proxy() 함수 안에서 isAppOnlyPath / findRule 가 2차 정확
 * 매치.
 */
export const config = {
  matcher: [
    '/',
    '/api/:path*',
    '/admin',
    '/admin/:path*',
    '/dashboard/:path*',
    '/dashboard',
    '/dogs/:path*',
    '/dogs',
    '/welcome',
    '/mypage/:path*',
  ],
}
