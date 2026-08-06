/**
 * 구독의 '진짜 상태' 판정 — status 컬럼 하나로는 부족하다.
 *
 * # 왜 필요한가 (2026-07-16)
 * DB 의 status 는 active/paused/cancelled 뿐인데, **카드 등록 여부**라는 축이 따로
 * 있다. 이 둘을 안 합치면 화면이 거짓말을 한다:
 *  · status='active' 인데 카드가 없으면 → 청구 크론이 `.not('billing_key','is',null)`
 *    로 건너뛰므로 **영원히 아무 일도 안 일어나는 '유령 활성'**이다. 그런데 화면엔
 *    '구독 중'으로 떴다.
 *  · 시작도 안 한 그 구독에 일시정지·건너뛰기 버튼을 줬다. 그래서 사장님 계정에
 *    카드 없이 paused + 목요일 배송일을 가진 행이 생겼다(2026-07-15 실측).
 *
 * 그래서 화면이 읽어야 할 상태를 여기서 한 번에 판정한다. 액션 노출도 이걸 따른다.
 *
 * # 우선순위 (겹칠 때)
 *  1. cancelled  — 끝난 건 끝난 거다.
 *  2. card_failed — 결제가 깨졌으면 다른 무엇보다 이걸 알려야 배송이 이어진다.
 *  3. needs_card  — 카드가 없으면 시작 자체가 안 됐다(paused 여도 마찬가지 —
 *                   시작도 안 한 걸 '멈춤'이라 부르면 안 된다).
 *  4. paused / active
 */

export type SubState =
  /** 카드 미등록 — 시작 전. 할 수 있는 건 카드 등록뿐. */
  | 'needs_card'
  /** 정상 구독 중. */
  | 'active'
  /** 사용자가 멈춤. */
  | 'paused'
  /** 카드 결제 실패 — 재등록 필요. */
  | 'card_failed'
  /** 해지됨. */
  | 'cancelled'

export type SubLike = {
  status: 'active' | 'paused' | 'cancelled'
  billing_key: string | null
  next_delivery_date: string | null
  failed_charge_count: number
  requires_billing_key_renewal: boolean
}

export function subscriptionState(sub: SubLike): SubState {
  if (sub.status === 'cancelled') return 'cancelled'
  // 카드 재등록 요구 플래그가 켜졌거나, 실패가 쌓였는데 아직 카드가 남아 있는 상태.
  if (sub.requires_billing_key_renewal) return 'card_failed'
  if (!sub.billing_key) return 'needs_card'
  if (sub.failed_charge_count > 0) return 'card_failed'
  if (sub.status === 'paused') return 'paused'
  return 'active'
}

// isLiveSubscription 제거 (2026-07-16) — "나중에 홈에서 쓸까" 하고 미리 export 했는데
// 소비처가 0이다. 필요해지면 subscriptionState(sub) === 'active' 한 줄이면 된다.
// 안 쓰는 걸 미리 만들어 두는 게 곧 잔재가 된다.

/**
 * 사용자에게 보여줄 구독인가 — "결제 완료·진행중인 것만"(사장님 2026-07-22).
 *
 * # 왜
 * 카드도 안 걸고 만들었다 해지한 '유령' 구독이 "0회 배송 후 해지"로 이력에
 * 떠서 혼란을 줬다(사장님 반복 불만). 진짜 구독(진행중이거나 배송 이력이 있는
 * 것)만 노출한다.
 *
 * 표시:  · 배송 이력 있음(total_deliveries > 0) — 실제 결제된 과거/현재 구독
 *        · active / paused / card_failed — 현재 진행 중(또는 결제문제로 조치 필요)
 * 숨김:  · needs_card(카드 미등록·0회) — 시작조차 안 함
 *        · cancelled·0회 — 결제 한 번도 없이 해지된 유령
 */
export function isSubscriptionVisibleToUser(
  sub: SubLike & { total_deliveries?: number | null },
): boolean {
  if ((sub.total_deliveries ?? 0) > 0) return true
  const st = subscriptionState(sub)
  return st === 'active' || st === 'paused' || st === 'card_failed'
}

/**
 * 상태의 **이름** — 판정과 같은 곳에 둔다 (2026-08-07 앱 화면 감사).
 *
 * # 왜
 * `subscriptionState()` 로 판정은 한 곳에 모았는데 **라벨은 화면마다 따로**
 * 적혀 있었다. 같은 구독이 화면을 옮기면 이름이 바뀌었다:
 *
 *   상태          강아지 카드        구독 탭        마이페이지
 *   active        진행중             구독 중        구독 중
 *   card_failed   결제수단 재등록 필요  결제 실패      결제 문제
 *
 * 결제가 깨진 고객은 한 번에 세 이름을 볼 수 있었다(강아지 카드 → 구독 탭 →
 * 마이페이지). 무엇을 해야 하는지가 화면마다 다르게 들린다.
 *
 * 표기 원칙(브랜드 보이스):
 *  · '실패' 는 고객 잘못처럼 들린다 → 무슨 일인지 + 무엇을 하면 되는지.
 *  · '진행중' 은 배송 진행과 헷갈린다 → 구독 상태는 '구독 중'.
 */
export const SUB_STATE_LABEL: Record<SubState, string> = {
  needs_card: '시작 전',
  active: '구독 중',
  paused: '일시정지',
  card_failed: '결제 확인 필요',
  cancelled: '해지됨',
}

/**
 * 상태 톤 — 색을 화면마다 다르게 고르지 않게.
 *
 * 'wait'  시작 전·일시정지 (기다림, 나쁘지 않음)
 * 'on'    구독 중
 * 'bad'   조치가 필요함
 * 'off'   끝남
 */
export type SubStateTone = 'wait' | 'on' | 'bad' | 'off'

export const SUB_STATE_TONE: Record<SubState, SubStateTone> = {
  needs_card: 'wait',
  active: 'on',
  paused: 'wait',
  card_failed: 'bad',
  cancelled: 'off',
}
