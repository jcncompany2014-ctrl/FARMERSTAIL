/**
 * 프로모션 — 오프라인·인스타 이벤트용 한시 할인. (사장님 확정 2026-07-16)
 *
 * # 무엇인가
 * 사장님이 admin 에서 이벤트를 하나 만들면 **주소 하나**가 나온다:
 *   `farmerstail.kr/start?p=busan1102`
 * 오프라인은 그 주소의 QR 을 배너에 인쇄하고, 인스타는 프로필 링크에 건다.
 * 고객은 **코드를 본 적도 입력한 적도 없다** — 링크를 타고 들어와 설문하면 끝이고,
 * 가입하는 순간 그 코드가 계정에 박혀 첫 결제에 자동 적용된다.
 *
 * # ⚠️ 왜 lib/discount.ts 에 안 섞나
 * 섞는 순간 "첫주문이 우선인가 등급이 우선인가 · 생일이랑 겹치면 · 슬롯은…" 같은
 * 규칙이 다시 자란다 — 2026-07-16 에 150줄에서 80줄로 걷어낸 게 정확히 그것이다.
 * 프로모션은 **등급과 무관한 별도 축**이라 따로 계산하고, 마지막에 `pickBetter` 로
 * **더 큰 쪽 하나**만 고른다. 규칙이 두 파일에 하나씩 있으면 각각 읽기 쉽다.
 *
 * # 계정당 1회
 * 첫 주문 할인이라 계정당 한 번이다. 링크를 여러 개 타고 들어와도 **가장 먼저 박힌
 * 것 하나**만 남는다(DB unique(user_id) 가 강제).
 *
 * # 숫자는 규칙으로
 * 여기 있는 건 전부 순수 함수다. "지금 열려 있나 · 상한 넘었나 · 얼마 깎나" 를
 * DB/시간 없이 판정할 수 있어야 테스트가 되고, 돈이 걸린 판단을 재현할 수 있다.
 */

/** 프로모션 1건 — 판정에 필요한 최소 모양 (DB `promotions` 행의 부분집합). */
export type PromotionLike = {
  /** URL 에 실리는 코드. 예: 'busan1102'. */
  code: string
  /** 할인율 0~1. 예: 0.5 = 50%. */
  discount_rate: number
  /** 시작 (ISO). */
  starts_at: string
  /** 종료 (ISO). 이 시각을 **지나면 닫힌다**. */
  ends_at: string
  /** 가입 인원 상한. null = 무제한. */
  max_signups: number | null
  /** 사장님이 손으로 끈 경우. */
  active: boolean
}

export type PromotionGate =
  | { open: true }
  | { open: false; reason: 'inactive' | 'not_started' | 'ended' | 'full' }

/**
 * 이 프로모션을 **지금 새로 받을 수 있나**.
 *
 * 순서가 의미를 만든다 — 손으로 끈 게 먼저고(사장님 의도가 최우선), 그 다음 시간,
 * 마지막이 상한. "왜 안 되나" 를 admin 에 그대로 보여줄 수 있게 사유를 돌려준다.
 *
 * @param claimedCount 이미 이 프로모션으로 가입한 인원 수
 */
export function promotionGate(
  p: PromotionLike,
  now: Date,
  claimedCount: number,
): PromotionGate {
  if (!p.active) return { open: false, reason: 'inactive' }

  const t = now.getTime()
  if (t < new Date(p.starts_at).getTime()) return { open: false, reason: 'not_started' }
  // 종료 시각 '이후'는 닫힘 — 경계(정확히 ends_at)는 아직 열려 있다.
  if (t > new Date(p.ends_at).getTime()) return { open: false, reason: 'ended' }

  if (p.max_signups != null && claimedCount >= p.max_signups) {
    return { open: false, reason: 'full' }
  }
  return { open: true }
}

/** 사람이 읽는 사유 — admin 목록에 그대로 쓴다. */
export const PROMOTION_GATE_LABEL: Record<
  Exclude<PromotionGate, { open: true }>['reason'],
  string
> = {
  inactive: '꺼둠',
  not_started: '시작 전',
  ended: '종료됨',
  full: '인원 마감',
}

/** 할인율 정규화 — 0~1 로 자른다. 잘못된 값이 결제에 흘러가지 않게. */
export function promotionRate(p: PromotionLike): number {
  if (!Number.isFinite(p.discount_rate)) return 0
  return Math.max(0, Math.min(1, p.discount_rate))
}

export type DiscountPick = {
  rate: number
  reason: 'tier' | 'promotion' | 'none'
  label: string
}

/**
 * 등급 할인 vs 프로모션 — **더 큰 쪽 하나**만. 절대 더하지 않는다.
 *
 * 첫 주문이면 스탬프가 0개라 등급 할인이 애초에 없어서 부딪힐 일이 거의 없다.
 * 그래도 규칙을 명시해 둔다 — 없으면 나중에 누가 "둘 다 주면 되지 않나" 를 한다.
 * 같으면 등급을 택한다(우리 것이 아니라 **고객이 쌓아 온 것**이 먼저 보이는 게 맞다).
 */
export function pickBetterDiscount(
  tier: { rate: number; label: string },
  promo: { rate: number; label: string } | null,
): DiscountPick {
  const t = Math.max(0, tier.rate)
  const p = promo ? Math.max(0, promo.rate) : 0

  if (t <= 0 && p <= 0) return { rate: 0, reason: 'none', label: '' }
  if (p > t) return { rate: p, reason: 'promotion', label: promo!.label }
  return { rate: t, reason: 'tier', label: tier.label }
}

/**
 * URL 파라미터 → 코드 정규화.
 *
 * 링크는 사람이 손으로 옮겨 적기도 하고(포스터·구두 전달) 대소문자가 섞인다.
 * 소문자·trim 으로 통일하고, 말도 안 되는 길이/문자는 **없는 것으로** 취급한다
 * (DB 조회에 이상한 값을 흘리지 않는다).
 */
export function normalizePromoCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (s.length < 2 || s.length > 40) return null
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(s)) return null
  return s
}
