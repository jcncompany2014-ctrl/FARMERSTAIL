/**
 * 자동결제(구독) 등록 수단 정본 — 카드 · 토스페이 (2026-07-30).
 *
 * # 왜 수단이 두 개뿐인가
 * 설치된 토스 SDK(`@tosspayments/tosspayments-sdk` v2.6) 의 타입이 자동결제
 * 등록 요청을 딱 이렇게 못 박아놨다:
 *   · `method: 'CARD'`   — 카드 등록창 (`flowMode` 기본 `DEFAULT`)
 *   · `method: 'CARD'` + `flowMode: 'DIRECT'` + `easyPay` — 간편결제 자체창.
 *     빌링 지원 간편결제사는 **토스페이 · 네이버페이 둘뿐**(SDK 주석 명시).
 *   · `method: 'TRANSFER'` — 계좌 자동이체
 * 카카오페이 자동결제는 애초에 없다. 네이버페이는 사장님 지시로 이번엔 제외
 * (2026-07-30) — 추가는 아래 목록에 한 줄 넣으면 끝나게 해뒀다.
 *
 * # 카드사 선택(현대/삼성/…) 구조를 왜 못 쓰나
 * 카드사 지정(`cardCompany`)은 **일반결제(requestPayment)에만** 있는 옵션이고
 * 자동결제 등록에는 존재하지 않는다. 이유는 배민 결제창이 직접 적어놨다 —
 * "카드 일반결제 시 카드 정보가 저장되지 않아요". 카드사만 골라 앱으로 넘기는
 * 방식은 그 자리에서 1회 승인하고 끝이라 저장할 토큰이 없다. 우리는 2주마다
 * 고객이 없는 상태로 청구해야 하므로 **저장(빌링키)** 이 필수 → 카드번호가
 * 필요하다. 카드번호 입력을 없애는 유일한 길이 간편결제(토스페이)다.
 *
 * # 플래그 — 기본 켜짐, 끄는 스위치만 남겼다
 * 토스페이 자동결제는 **사장님이 토스에 계약을 확인해 켜기로 확정했다
 * (2026-07-30)**. 그래서 기본값이 켜짐이고, 문제가 생겼을 때 끌 수 있는
 * 비상 스위치만 남겼다: `NEXT_PUBLIC_TOSSPAY_BILLING=off`.
 *
 * 리포의 다른 플래그(`NEXT_PUBLIC_INVENTION_*`)는 `=== 'on'` 옵트인이지만
 * 이건 **반대로** 뒀다 — 그쪽은 실험이고 이건 이미 출시한 기능이다. 옵트인으로
 * 두면 Vercel 환경변수 한 줄을 잊는 순간 운영에서 조용히 사라지고, 사장님은
 * "만든 게 안 보인다"고 겪게 된다.
 *
 * 끄면 수단이 카드 하나 → 선택 화면 없이 카드 등록창이 바로 열린다(옛 흐름).
 *
 * 끌 상황: ① 토스페이 등록이 실제로 실패하기 시작 ② 네이티브 앱 웹뷰에서
 * 토스 앱 열기가 막히는 게 확인됨(NATIVE_APP_SETUP.md 참조).
 */

export type BillingMethodId = 'card' | 'tosspay'

/** Toss SDK `requestBillingAuth()` 에 그대로 펼쳐 넣는 파라미터. */
export type BillingAuthParams = {
  method: 'CARD'
  flowMode?: 'DIRECT'
  easyPay?: 'TOSSPAY'
}

export type BillingMethodDef = {
  id: BillingMethodId
  /** 선택 화면 버튼 제목 */
  label: string
  /** 선택 화면 한 줄 설명 — 무엇이 다른지만 말한다 */
  hint: string
  /** 등록 완료 화면 제목 */
  doneTitle: string
  /**
   * 토스가 카드사명을 안 돌려줄 때 화면에 쓸 이름.
   * 카드는 null(= 토스가 늘 카드사를 준다), 토스페이는 '토스페이'.
   */
  fallbackBrand: string | null
  params: BillingAuthParams
}

const CARD: BillingMethodDef = {
  id: 'card',
  label: '신용·체크카드',
  hint: '카드번호를 입력해 등록해요',
  doneTitle: '카드 등록 완료',
  fallbackBrand: null,
  params: { method: 'CARD' },
}

const TOSSPAY: BillingMethodDef = {
  id: 'tosspay',
  label: '토스페이',
  hint: '토스에 등록된 결제수단에서 고르면 돼요',
  doneTitle: '토스페이 연결 완료',
  fallbackBrand: '토스페이',
  // flowMode: 'DIRECT' = 통합 카드창이 아니라 토스페이 자체창을 연다.
  // easyPay 는 DIRECT 일 때만 유효하다(SDK 주석).
  params: { method: 'CARD', flowMode: 'DIRECT', easyPay: 'TOSSPAY' },
}

/** 노출 순서 = 이 순서. 카드가 늘 첫 번째(어떤 고객이든 쓸 수 있는 길). */
const ALL: BillingMethodDef[] = [CARD, TOSSPAY]

export type BillingMethodFlags = { tosspay: boolean }

/**
 * 빌드 시점 플래그 읽기. 기본 켜짐 — `'off'` 를 명시할 때만 끈다.
 * (환경변수를 안 넣는 것이 정상 상태다. 위 docstring 의 '플래그' 절 참조.)
 */
export function billingMethodFlags(): BillingMethodFlags {
  return { tosspay: process.env.NEXT_PUBLIC_TOSSPAY_BILLING !== 'off' }
}

/** 지금 고객에게 보여줄 수단들. 카드는 항상 포함된다. */
export function availableBillingMethods(
  flags: BillingMethodFlags,
): BillingMethodDef[] {
  return ALL.filter((m) => m.id === 'card' || flags[m.id])
}

export function billingMethod(id: BillingMethodId): BillingMethodDef {
  return id === 'tosspay' ? TOSSPAY : CARD
}

/**
 * URL 쿼리(`?method=`)나 요청 body 의 값을 실제 쓸 수단으로 확정한다.
 *
 * 모르는 값·빈 값·꺼진 수단은 **모두 카드로 낙하**한다:
 *  · 기존 진입점 5곳은 `method` 를 안 싣는다 → 카드로 떨어져야 무손상.
 *  · 플래그가 꺼진 상태에서 `?method=tosspay` 를 손으로 붙여도 열리면 안 된다
 *    (계약 전 노출 = 고객이 실패를 만난다).
 */
export function resolveBillingMethod(
  raw: string | null | undefined,
  flags: BillingMethodFlags,
): BillingMethodDef {
  const found = ALL.find((m) => m.id === raw)
  if (!found) return CARD
  return availableBillingMethods(flags).includes(found) ? found : CARD
}

/**
 * 화면에 보여줄 결제수단 이름.
 *
 * 토스페이로 등록하면 토스가 카드사명·마스킹 카드번호를 안 줄 수 있다(간편결제
 * 안에서 고객이 고른 수단이 카드가 아닐 수도 있다 — 토스페이머니 등).
 * 그때 이름이 비면 화면에 아무것도 안 뜨므로 수단 이름으로 대체한다.
 */
export function billingBrandLabel(
  id: BillingMethodId,
  cardCompanyFromToss: string | null | undefined,
): string | null {
  const fromToss = cardCompanyFromToss?.trim()
  if (fromToss) return fromToss
  return billingMethod(id).fallbackBrand
}

/**
 * "현대 ····1234" / "토스페이" / null.
 *
 * @param registered 빌링키가 실제로 발급됐는지. **카드번호(last4) 유무로
 *   판정하면 안 된다** — 토스페이는 last4 가 없어서 '등록 전' 으로 오판된다.
 */
export function billingMethodSummary(input: {
  registered: boolean
  brand: string | null
  last4: string | null
}): string | null {
  if (!input.registered) return null
  const brand = input.brand?.trim() || null
  if (input.last4) return `${brand ?? '카드'} ····${input.last4}`
  return brand
}
