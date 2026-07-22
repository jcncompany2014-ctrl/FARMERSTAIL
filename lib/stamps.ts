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
 * # 1년 만료 — 단, 등급을 만든 스탬프는 잠겨서 안 사라진다 (사장님 모델 2026-07-22)
 * 스탬프는 적립 시점부터 **1년** 유효(기존 2년). 그런데 **판(10개)을 채워 등급이 오르면
 * 그 10개는 영구 잠금**(DB: expires_at='infinity')돼 만료되지 않는다 — "10개 모아 씨앗이
 * 됐으면 그 1~10번은 안 사라진다"(사장님). 만료(1년)는 아직 판을 못 채운 **현재 판의
 * '느슨한' 스탬프(11번째~)에만** 걸린다.
 *   · 꾸준한 구독자: 판(2주×10=~4.6개월)을 만료(1년) 전에 채워 계속 잠그며 나무(50)까지.
 *   · 오래 쉬면: 현재 판의 느슨한 스탬프만 만료 → **카드가 0칸까지 비고 등급은 유지**.
 * stamp_count = 잠긴 것 + 살아있는 느슨한 것. 등급 배지 정본은 `profiles.tier`(잠금 덕에
 * 강등 안 됨), 현재 판은 stamp_count 를 등급 floor 위로 얹어 계산(cardProgressFloored).
 * 느슨한 스탬프 만료 반영은 매일 도는 크론(fn_expire_stamps).
 *
 * # 특별보상은 아직 미정 (사장님)
 * 무엇을 줄지는 마진이 걸린 결정이라 정해지지 않았다. 여기선 **마일스톤 도달만** 계산하고
 * 문구는 '특별보상'으로 둔다. 정해지면 `STAMP_REWARD_LABEL` 과 지급 로직만 붙이면 된다.
 */

/** 카드 한 장 = 10칸. 채우면 특별보상 1회. */
export const STAMP_CARD_SIZE = 10

/** 적립 시점부터 유효 기간 (년). 2026-07-22 사장님: 2년 → 1년. */
export const STAMP_VALIDITY_YEARS = 1

/** 보상 이름 — 내용 미정(사장님 결정 전). 정해지면 여기만 바꾼다. */
export const STAMP_REWARD_LABEL = '특별보상'

/** 스탬프 1개 — DB `stamps` 행의 계산에 필요한 최소 모양. */
export type StampLike = {
  /** 적립 시각 (ISO). */
  stamped_at: string
  /** 만료 시각 (ISO). 적립 + 1년. */
  expires_at: string
}

/**
 * 만료 시각 — 적립 시점부터 1년.
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
 * 등급 floor 를 반영한 카드 진행도 — **강등 없음 모델**(사장님 2026-07-22).
 *
 * 등급(profiles.tier)은 한번 도달하면 안 내려간다. 그런데 살아있는 스탬프는 1년 만료로
 * 줄 수 있다. 그래서 현재 판은 **등급이 잠근 완성 카드(floor) 위에 얹힌 부분만** 보여주고,
 * 만료로 살아있는 개수가 floor 밑으로 내려가도 **현재 판이 0칸까지만** 빈다(그 아래 등급
 * 판으로는 안 내려간다). 예: 새싹(floor 20) + 살아있음 24 → 판3 4칸. 만료로 18 →
 * 판3 0칸(씨앗 판으로 회귀 안 함). 등급 배지는 여전히 새싹.
 *
 * @param activeCount 살아있는(미만료) 스탬프 개수 = profiles.stamp_count
 * @param floorStamps 도달 등급의 임계값(씨앗10·새싹20…나무50, 등급 없으면 0)
 */
export function cardProgressFloored(
  activeCount: number,
  floorStamps: number,
): CardProgress {
  const active = Math.max(0, Math.trunc(activeCount))
  const floor = Math.max(0, Math.trunc(floorStamps))
  const floorCards = Math.floor(floor / STAMP_CARD_SIZE) // 등급이 잠근 완성 카드 수
  const above = Math.max(0, active - floor) // 등급 위 살아있는 스탬프(0까지 빈다)
  const extra = Math.floor(above / STAMP_CARD_SIZE) // 최상위(나무) 순환분, 보통 0
  const filled = above % STAMP_CARD_SIZE
  const completedCards = floorCards + extra
  return {
    total: active,
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
