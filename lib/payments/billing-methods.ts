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
 * # 플래그 — 지금은 **꺼짐**. 토스 쪽 설정이 아직 안 됐다.
 * 2026-07-30 실기기 시도에서 토스가 이렇게 답했다:
 *   **"토스페이 자동결제 결제수단 설정이 없습니다"**
 * 계약·신청과 별개로 **상점 설정에 토스페이 자동결제 수단이 등록되어야** 창이
 * 열린다. 그 전엔 고객이 토스페이를 누르는 순간 실패한다 — 그래서 옵트인으로
 * 되돌렸다. 토스가 설정을 켜주면 Vercel 환경변수에
 * `NEXT_PUBLIC_TOSSPAY_BILLING=on` 을 넣고 재배포하면 된다(코드 수정 불필요).
 *
 * 꺼져 있으면 수단이 카드 하나 → 선택 화면 없이 카드 등록창이 바로 열린다.
 *
 * (기본 켜짐으로 뒀던 이유는 "환경변수 한 줄을 잊으면 만든 게 조용히 사라진다"
 *  였는데, **작동하지 않는 걸 노출하는 쪽이 훨씬 나쁘다**. 켜기 전 확인은
 *  PAYMENT_REHEARSAL.md §1-B 에.)
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
  /** 주문 화면 선택기용 **짧은** 문구. 2칸 그리드라 길면 줄이 쪼개진다. */
  pickerHint: string
  /** 등록 완료 화면 제목 */
  doneTitle: string
  /**
   * 그 수단의 브랜드 색. 선택 UI 에서 **눈에 띄게 구분**하는 데 쓴다
   * (사장님 2026-07-30 "신용카드 등록이랑 토스페이랑 너무 똑같애").
   * 카드는 우리 앱 색을 쓰므로 null. 로고 이미지는 브랜드 자산이라 임의로
   * 만들지 않는다 — 색과 이름만. 두 화면(주문·등록)이 이 값을 함께 읽어
   * 색이 서로 어긋나지 않게 한다.
   */
  brandColor: string | null
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
  pickerHint: '카드번호 입력',
  doneTitle: '카드 등록 완료',
  brandColor: null,
  fallbackBrand: null,
  params: { method: 'CARD' },
}

const TOSSPAY: BillingMethodDef = {
  id: 'tosspay',
  label: '토스페이',
  hint: '토스에 등록된 결제수단에서 고르면 돼요',
  pickerHint: '토스에서 선택',
  doneTitle: '토스페이 연결 완료',
  // 토스 브랜드 블루.
  brandColor: '#3182F6',
  fallbackBrand: '토스페이',
  // flowMode: 'DIRECT' = 통합 카드창이 아니라 토스페이 자체창을 연다.
  // easyPay 는 DIRECT 일 때만 유효하다(SDK 주석).
  params: { method: 'CARD', flowMode: 'DIRECT', easyPay: 'TOSSPAY' },
}

/** 노출 순서 = 이 순서. 카드가 늘 첫 번째(어떤 고객이든 쓸 수 있는 길). */
const ALL: BillingMethodDef[] = [CARD, TOSSPAY]

export type BillingMethodFlags = { tosspay: boolean }

/**
 * 빌드 시점 플래그 읽기. **기본 꺼짐** — `'on'` 을 명시할 때만 켠다.
 * 토스 상점 설정이 확인된 뒤에 켠다(위 docstring 의 '플래그' 절 참조).
 */
export function billingMethodFlags(): BillingMethodFlags {
  return { tosspay: process.env.NEXT_PUBLIC_TOSSPAY_BILLING === 'on' }
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
