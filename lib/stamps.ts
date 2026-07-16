/**
 * 스탬프 — 구독 결제 1회 = 스탬프 1개. (사장님 확정 2026-07-16)
 *
 * # 왜 만드나
 * 포인트를 전면 폐기(2026-07-16)하면서 **쌓이는 게 눈에 보이는 장치**가 사라졌다.
 * 등급은 있지만 추상적이고(내부 숫자), 자동할인은 결제할 때만 잠깐 보인다.
 * 커피 스탬프 카드는 설명이 필요 없는 관용구다 — 몇 칸 남았는지 한눈에 보이고 손맛이 있다.
 *
 * # 등급의 축을 금액 → 횟수로 바꾼다
 * 기존 등급은 `profiles.cumulative_spend`(누적 결제액) 기준이었다. 그런데 우리 박스는
 * **강아지 덩치에 비례해 값이 다르다** — 같은 기간 함께해도 대형견 보호자가 자동으로
 * 높은 등급을 먹는다. 등급 이름이 씨앗→새싹→꽃→열매→나무 라는 **함께한 시간 서사**인데
 * 정작 기준은 돈이었던 셈. 스탬프(횟수)는 덩치와 무관해서 서사와 기준이 일치한다.
 *
 * # 스탬프는 소진하지 않는다 ★
 * 커피 스탬프 카드는 10잔 채우면 판을 내고 리셋한다. 우리는 **등급이 스탬프 개수에 걸려
 * 있어서** 소진하면 10개 채울 때마다 등급이 씨앗으로 떨어진다. 그래서 스탬프는 계속
 * 누적되고, **10칸 카드가 이어진다**(1장·2장·3장…). 한 장을 채울 때마다(10·20·30…)
 * 특별보상이 나가고, 화면엔 현재 카드의 10칸만 보인다.
 *
 * # 2년 만료 → 등급 강등이 가능해진다 (의도된 것)
 * 스탬프는 적립 시점부터 2년 유효. 배송이 2주 고정이라 **활성 구독자는 만료를 겪을 수
 * 없다**(10개 모으는 데 ~4.6개월, 2년이면 52개가 쌓인다). 만료가 실제로 걸리는 건
 * 오래 쉬다 돌아온 분뿐이다. 즉 등급이 "예전에 많이 썼던 사람"이 아니라 **"지금 함께하는
 * 사람"** 을 가리키게 된다. 누적금액은 절대 안 줄었으므로 이건 동작 변경이다.
 *
 * # 특별보상은 아직 미정 (사장님)
 * 무엇을 줄지는 마진이 걸린 결정이라 정해지지 않았다. 여기선 **마일스톤 도달만** 계산하고
 * 문구는 '특별보상'으로 둔다. 정해지면 `STAMP_REWARD_LABEL` 과 지급 로직만 붙이면 된다.
 */

/** 카드 한 장 = 10칸. 채우면 특별보상 1회. */
export const STAMP_CARD_SIZE = 10

/** 적립 시점부터 유효 기간 (년). */
export const STAMP_VALIDITY_YEARS = 2

/** 보상 이름 — 내용 미정(사장님 결정 전). 정해지면 여기만 바꾼다. */
export const STAMP_REWARD_LABEL = '특별보상'

/** 스탬프 1개 — DB `stamps` 행의 계산에 필요한 최소 모양. */
export type StampLike = {
  /** 적립 시각 (ISO). */
  stamped_at: string
  /** 만료 시각 (ISO). 적립 + 2년. */
  expires_at: string
}

/**
 * 만료 시각 — 적립 시점부터 2년.
 *
 * 윤년/월말을 Date 가 알아서 처리하게 둔다(예: 2/29 적립 → 2년 뒤 3/1 로 정규화).
 * 하루 차이로 다투는 성질의 값이 아니다.
 */
export function stampExpiryFrom(stampedAt: Date): Date {
  const d = new Date(stampedAt.getTime())
  d.setFullYear(d.getFullYear() + STAMP_VALIDITY_YEARS)
  return d
}

/** 아직 살아 있는 스탬프만 (만료 시각이 지나지 않은 것). */
export function activeStamps<T extends StampLike>(stamps: T[], now: Date): T[] {
  const t = now.getTime()
  return stamps.filter((s) => new Date(s.expires_at).getTime() > t)
}

export type CardProgress = {
  /** 살아 있는 스탬프 총 개수. 등급의 기준. */
  total: number
  /** 지금 채우는 중인 카드가 몇 장째인가 (1부터). 10개면 이미 1장 완성 → 2장째. */
  cardNumber: number
  /** 현재 카드에 찍힌 칸 수 (0~9). 10 이 되는 순간 다음 카드로 넘어간다. */
  filled: number
  /** 이번 카드 완성까지 남은 칸 수 (1~10). */
  remaining: number
  /** 지금까지 완성한 카드 수 = 받은(받을) 특별보상 횟수. */
  completedCards: number
}

/**
 * 스탬프 카드 진행 상황.
 *
 * 경계 주의: 스탬프 10개는 "1장 완성 + 2장째 0칸"이다. "1장째 10칸"으로 보여주면
 * 보상을 받고도 칸이 꽉 찬 판이 남아 있어 사용자가 또 받는 줄 안다.
 */
export function cardProgress(totalActive: number): CardProgress {
  const total = Math.max(0, Math.trunc(totalActive))
  const completedCards = Math.floor(total / STAMP_CARD_SIZE)
  const filled = total % STAMP_CARD_SIZE
  return {
    total,
    cardNumber: completedCards + 1,
    filled,
    remaining: STAMP_CARD_SIZE - filled,
    completedCards,
  }
}

/**
 * 이번 적립으로 카드를 **막 채웠는가** — 보상 발급 트리거.
 *
 * @param before 적립 전 개수
 * @param after  적립 후 개수
 * @returns 이번에 완성된 카드 번호들 (보통 [n] 하나. 보정 적립 등으로 여러 장이
 *   한 번에 넘어갈 수 있어 배열).
 */
export function milestonesCrossed(before: number, after: number): number[] {
  const from = Math.floor(Math.max(0, before) / STAMP_CARD_SIZE)
  const to = Math.floor(Math.max(0, after) / STAMP_CARD_SIZE)
  const out: number[] = []
  for (let i = from + 1; i <= to; i++) out.push(i)
  return out
}
