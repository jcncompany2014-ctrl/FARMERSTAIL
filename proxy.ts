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

export function proxy(request: NextRequest) {
  const rule = findRule(request.nextUrl.pathname, request.method)
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
 * 매처. 위 RULES의 path들을 커버하되, 정적 파일/Next 내부 경로는 제외.
 *
 * 주의: 매처에서 한 번 걸러도 proxy() 함수 안에서 findRule로 다시 검증하므로,
 * 여기선 "rate limit 대상이 될 수 있는 모든 경로" 상위집합이면 충분.
 * `/api/:path*`만 써도 의미상 동일 — 정적 에셋은 이미 /api/* 에 매칭 안 됨.
 */
export const config = {
  matcher: ['/api/:path*'],
}
