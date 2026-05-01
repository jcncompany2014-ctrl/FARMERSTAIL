/**
 * Farmer's Tail — Toss Payments v1 REST client.
 *
 * v2 SDK는 브라우저에서 payment window 를 띄울 때만 쓰고, 서버 측 승인/취소/
 * 조회는 v1 REST API 를 쓰는 게 Toss의 권장 패턴. 이 모듈은 그 서버측 호출을
 * 한 곳에 모아 두고 Basic auth, base URL, Idempotency-Key 생성 로직을 공유한다.
 *
 * 왜 Idempotency-Key 를 쓰나:
 *   - 승인(confirm)과 취소(cancel)는 같은 요청을 여러 번 보내면 "이미 처리됨"
 *     400 에러가 나서 UX가 꼬인다. Toss는 `Idempotency-Key` 헤더를 받아 같은
 *     키로 들어온 반복 요청에는 동일한 200 결과를 돌려준다.
 *   - 승인 키는 `${orderId}:${paymentKey}` 로 잡는다 — 두 값 모두 동일 트랜잭션
 *     에서만 조합되므로 재시도 시 자동으로 같은 키가 나온다.
 *   - 취소 키는 `cancel:${paymentKey}:${cancelReason}` — 이유가 바뀌면 다른
 *     요청으로 간주. 부분 취소는 이 모듈에서 다루지 않음 (관리자 대시보드 작업).
 *
 * 호출처:
 *   - app/api/payments/confirm/route.ts   → confirmPayment
 *   - app/api/orders/[id]/cancel/route.ts → cancelPayment
 *   - app/api/payments/webhook/route.ts   → fetchPayment (진실의 원천 재조회)
 */

const TOSS_API_BASE = 'https://api.tosspayments.com/v1'

export type TossPaymentStatus =
  | 'READY'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_DEPOSIT'
  | 'DONE'
  | 'CANCELED'
  | 'PARTIAL_CANCELED'
  | 'ABORTED'
  | 'EXPIRED'

/**
 * Toss Payment 응답 (v1). 필요한 필드만 좁게 타입화 — 전체 스키마는 매우 넓음.
 * 예상 못한 필드는 `unknown`으로 둬서 호출처가 방어하도록.
 */
export interface TossPayment {
  paymentKey: string
  orderId: string
  status: TossPaymentStatus
  totalAmount: number
  balanceAmount?: number
  method?: string
  approvedAt?: string
  requestedAt?: string
  /** 카드 결제일 때만 채워짐. */
  card?: {
    company?: string
    number?: string
    installmentPlanMonths?: number
    isInterestFree?: boolean
    cardType?: string
    ownerType?: string
  }
  /** 가상계좌일 때만 채워짐. bankCode는 한국은행 표준 숫자 코드. */
  virtualAccount?: {
    accountNumber?: string
    bankCode?: string
    customerName?: string
    dueDate?: string
    refundStatus?: string
    expired?: boolean
  }
  /** 현금영수증 요청 결과. */
  cashReceipt?: { type?: string; receiptKey?: string; issueNumber?: string }
  receipt?: { url?: string }
  failure?: { code?: string; message?: string }
}

export interface TossError {
  code: string
  message: string
}

export type TossResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: TossError }

function requireSecretKey(): string {
  const k = process.env.TOSS_SECRET_KEY
  if (!k) throw new Error('TOSS_SECRET_KEY is not configured')
  return k
}

function authHeader(): string {
  const k = requireSecretKey()
  // Toss v1 은 Basic auth with "secretKey:" (빈 password).
  return `Basic ${Buffer.from(`${k}:`).toString('base64')}`
}

async function tossFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<TossResult<T>> {
  const { idempotencyKey, headers, ...rest } = init
  const res = await fetch(`${TOSS_API_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...headers,
    },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: {
        code: (body?.code as string) ?? 'TOSS_ERROR',
        message: (body?.message as string) ?? '결제 오류가 발생했어요',
      },
    }
  }
  return { ok: true, data: body as T }
}

/**
 * 결제 승인. 클라이언트가 successUrl 로 리다이렉트된 직후 호출.
 * Idempotency 키: `${orderId}:${paymentKey}` — 동일 주문/결제키 조합은 1회만 유효.
 */
export async function confirmPayment(input: {
  paymentKey: string
  orderId: string
  amount: number
}): Promise<TossResult<TossPayment>> {
  return tossFetch<TossPayment>('/payments/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
    idempotencyKey: `confirm:${input.orderId}:${input.paymentKey}`,
  })
}

/**
 * 전체 취소(환불). 부분 취소는 cancelAmount 파라미터를 추가해야 하지만
 * 현재 D2C 플로우에서는 전체 취소만 지원.
 */
export async function cancelPayment(input: {
  paymentKey: string
  cancelReason: string
}): Promise<TossResult<TossPayment>> {
  const reasonShort = input.cancelReason.trim().slice(0, 200) || '고객 요청'
  return tossFetch<TossPayment>(
    `/payments/${encodeURIComponent(input.paymentKey)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ cancelReason: reasonShort }),
      idempotencyKey: `cancel:${input.paymentKey}:${reasonShort}`,
    },
  )
}

/**
 * 결제 상태 재조회. 웹훅 수신 시 "토스에서 직접 읽어온 상태"를 신뢰하기 위함.
 */
export async function fetchPayment(
  paymentKey: string,
): Promise<TossResult<TossPayment>> {
  return tossFetch<TossPayment>(
    `/payments/${encodeURIComponent(paymentKey)}`,
    { method: 'GET' },
  )
}

// --- 표시용 라벨 매핑 ------------------------------------------------------

/**
 * Toss가 반환하는 payment method 문자열을 한국어로 통일.
 * Toss는 "카드", "가상계좌", "간편결제" 같은 이미 한국어인 값을 보내기도 하고
 * 구버전 응답에서는 영문 코드("CARD")가 올 수도 있어 양쪽 커버.
 */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '알 수 없음'
  const MAP: Record<string, string> = {
    카드: '신용·체크카드',
    CARD: '신용·체크카드',
    가상계좌: '가상계좌',
    VIRTUAL_ACCOUNT: '가상계좌',
    계좌이체: '계좌이체',
    TRANSFER: '계좌이체',
    휴대폰: '휴대폰 결제',
    MOBILE_PHONE: '휴대폰 결제',
    상품권: '문화상품권',
    GIFT_CERTIFICATE: '문화상품권',
    간편결제: '간편결제',
    EASY_PAY: '간편결제',
    토스페이: '토스페이',
    TOSSPAY: '토스페이',
  }
  return MAP[method] ?? method
}

/**
 * 한국은행 표준 금융기관 코드 → 은행명. 가상계좌 응답의 bankCode용.
 * 자주 쓰이는 주요 은행만 커버. 미매칭 코드는 원문 반환.
 */
export function bankCodeLabel(code: string | null | undefined): string {
  if (!code) return ''
  const MAP: Record<string, string> = {
    '39': '경남은행',
    '34': '광주은행',
    '12': '단위농협(회원조합)',
    '32': '부산은행',
    '45': '새마을금고',
    '64': '산림조합',
    '88': '신한은행',
    '48': '신협',
    '27': '씨티은행',
    '20': '우리은행',
    '71': '우체국예금보험',
    '50': '상호저축은행',
    '37': '전북은행',
    '35': '제주은행',
    '90': '카카오뱅크',
    '89': '케이뱅크',
    '92': '토스뱅크',
    '81': '하나은행',
    '54': '홍콩상하이은행',
    '03': 'IBK기업은행',
    '06': 'KB국민은행',
    '31': 'DGB대구은행',
    '02': 'KDB산업은행',
    '11': 'NH농협은행',
    '23': 'SC제일은행',
    '07': '수협은행',
  }
  return MAP[code] ?? code
}

/**
 * 가상계좌 입금 만료일(ISO) 을 한국어로 짧게 포맷.
 *   ex) "2026-04-25T00:00:00+09:00" → "4월 25일 23:59"
 * Toss는 자정까지로 dueDate를 잡기 때문에 "23:59" 로 표기해 주면 실제 입금
 * 마감 순간과 어긋나지 않는다.
 */
export function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}월 ${day}일 23:59까지`
}

// ──────────────────────────────────────────────────────────────────────────
// Billing — 정기결제 (재청구).
//
// Toss billingKey 흐름:
//   1) 사용자가 정기배송 신청 시 카드 등록 페이지(/api/payments/billing-confirm
//      에서 callback) 에서 Toss SDK requestBillingAuth('카드') 호출
//      → Toss 가 user.id 기반 customerKey 와 함께 billingKey 발급.
//   2) billingKey 를 subscriptions.billing_key 컬럼에 저장.
//   3) cron 이 매일 새벽 next_delivery_date == today 인 active 구독 스캔 →
//      이 함수 chargeBillingKey() 호출로 자동 청구.
//
// 보안: billing_key 는 카드 정보 자체가 아닌 Toss 서버측 토큰. 노출되어도 우리
// secret 으로만 청구 가능하므로 비교적 안전. 그래도 RLS 로 사용자가 자기
// 키만 read 가능하게 제한.
// ──────────────────────────────────────────────────────────────────────────

export interface BillingChargeResult {
  ok: boolean
  paymentKey?: string
  status?: TossPaymentStatus
  error?: { code?: string; message?: string }
}

export interface BillingIssueResult {
  ok: boolean
  billingKey?: string
  cardCompany?: string
  cardNumber?: string
  error?: { code?: string; message?: string }
}

/**
 * Toss billing authKey → 영구 billingKey 교환.
 *
 * 흐름:
 *   1) 클라이언트가 SDK `requestBillingAuth({customerKey})` 호출 → 카드 등록
 *   2) Toss 가 `?authKey=xxx&customerKey=xxx` 로 successUrl redirect
 *   3) 우리 서버가 이 함수로 authKey 를 영구 billingKey 로 교환
 *   4) billingKey 를 subscriptions.billing_key 에 저장 (한 번 받으면 영구)
 *
 * customerKey 는 Toss 측 사용자 식별자. user.id 그대로 쓰면 외부 노출이 위험해
 * 별개의 random UUID 권장 — 재발급도 가능.
 */
export async function issueBillingKey(input: {
  authKey: string
  customerKey: string
}): Promise<BillingIssueResult> {
  const secret = process.env.TOSS_SECRET_KEY
  if (!secret) {
    return {
      ok: false,
      error: {
        code: 'TOSS_SECRET_MISSING',
        message: 'Toss 시크릿 키가 설정되지 않았어요',
      },
    }
  }

  const auth = Buffer.from(`${secret}:`).toString('base64')

  try {
    const res = await fetch(
      `${TOSS_API_BASE}/billing/authorizations/issue`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authKey: input.authKey,
          customerKey: input.customerKey,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    )

    type IssueResponse = {
      billingKey?: string
      cardCompany?: string
      cardNumber?: string // masked, e.g. "536160******1234"
      code?: string
      message?: string
    }
    const data = (await res.json()) as IssueResponse

    if (!res.ok || !data.billingKey) {
      return {
        ok: false,
        error: {
          code: data.code,
          message: data.message ?? 'billingKey 발급 실패',
        },
      }
    }

    return {
      ok: true,
      billingKey: data.billingKey,
      cardCompany: data.cardCompany,
      cardNumber: data.cardNumber,
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'unknown',
      },
    }
  }
}

/**
 * billingKey + customerKey 로 정해진 금액을 청구.
 *
 * @param input.billingKey — Toss billing key (issueBillingAuthByCustomerKey 결과)
 * @param input.customerKey — 우리가 발급한 UUID. user_id 그대로 쓰면 안 됨
 *   (Toss 측에 노출). 별도 발급한 random UUID 권장.
 * @param input.orderId — 새로 만들 주문 식별자. order_status='pending' row 를
 *   먼저 만들고 그 id 를 그대로 사용.
 * @param input.orderName — 결제 내역 표시용. "Farmer's Tail 정기배송 #N"
 * @param input.amount — 원 단위 정수
 * @param input.idempotencyKey — `sub-charge:{subscription_id}:{date}` 권장
 */
export async function chargeBillingKey(input: {
  billingKey: string
  customerKey: string
  orderId: string
  orderName: string
  amount: number
  idempotencyKey: string
}): Promise<BillingChargeResult> {
  const secret = process.env.TOSS_SECRET_KEY
  if (!secret) {
    return { ok: false, error: { code: 'TOSS_SECRET_MISSING', message: 'Toss 시크릿 키가 설정되지 않았어요' } }
  }

  const auth = Buffer.from(`${secret}:`).toString('base64')

  try {
    const res = await fetch(
      `${TOSS_API_BASE}/billing/${encodeURIComponent(input.billingKey)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          customerKey: input.customerKey,
          orderId: input.orderId,
          orderName: input.orderName,
          amount: input.amount,
        }),
        // 결제 실패 / 타임아웃 → 30초.
        signal: AbortSignal.timeout(30_000),
      },
    )

    const data = (await res.json()) as Partial<TossPayment> & {
      code?: string
      message?: string
    }

    if (!res.ok) {
      return {
        ok: false,
        error: { code: data.code, message: data.message },
      }
    }

    return {
      ok: true,
      paymentKey: data.paymentKey,
      status: data.status,
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'unknown',
      },
    }
  }
}
