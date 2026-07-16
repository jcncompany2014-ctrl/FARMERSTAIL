/**
 * Farmer's Tail — 사용자 노출 카피 라이브러리 (Tier S, 2026-05-20)
 *
 * 모든 사용자에게 보여지는 멘트를 한 곳에서 관리.
 * - A/B 테스트 시 한 파일만 수정
 * - 다국어 (일본·홍콩 수출) 시 i18n 즉시 적용
 * - 마케터·디자이너가 코드 모르고도 카피 수정 가능
 * - 카피 일관성 100% (개발자가 임의 표현 작성 X)
 *
 * # 톤 10원칙 (모든 멘트에 일관 적용)
 *  1. 견 이름 인격화 — "○○이" (등록한 견 이름)
 *  2. 완화 어휘 — "한 번 보세요", "조금 시도해 보세요"
 *  3. 권한 위임 — "수의사 선생님과 한 번 상의해 주세요"
 *  4. 자율감 부여 — "원치 않으시면 ▼에서 바꿀 수 있어요"
 *  5. 명령형 회피 — "한 박스 보내드릴게요"
 *  6. 일상 비교 anchor — "스타벅스 음료 1잔", "김밥 한 줄"
 *  7. 숫자 분할 — "한 끼 약 3,250원" (월 30만원 X)
 *  8. 의료 표현 회피 — "도움 될 수 있어요"
 *  9. 친근 종결 — "~네요", "~예요", "~까요?"
 * 10. 이모지 절제 — 메시지 1개당 1개 (🐾 / 💚 / 🥗)
 *
 * # 블랙리스트 (절대 사용 금지)
 *  - "당신의 강아지", "필수입니다", "치료/예방/완치",
 *    "AI가 추천", "위험합니다", "프리미엄", "구매 권유",
 *    "Buy Now", "Order", 이모지 3개 이상 연속
 */

// node:test 직접 로드 호환(확장자 필수 — feeding-plan.test 체인).
import { petName } from './korean.ts'

// ──────────────────────────────────────────────────────────────────────
// 비교 anchor (예산별 일상 비교)
// ──────────────────────────────────────────────────────────────────────
export const PRICE_ANCHOR = {
  under_5000: '김밥 한 줄 미만',
  '5000_10000': '스타벅스 음료 1잔',
  '10000_15000': '파스타 한 그릇',
  no_limit: '카페 라떼 2잔',
} as const

export type BudgetTier = keyof typeof PRICE_ANCHOR

// ──────────────────────────────────────────────────────────────────────
// 설문 카피 (Survey)
// ──────────────────────────────────────────────────────────────────────
export const SURVEY_COPY = {
  budget: {
    question:
      '○○이의 건강을 위해 매일 부담 없이 쓸 수 있는 식비는 어느 정도이신가요?',
    subtitle:
      '직접적인 가격 안내가 아니라, ○○이에게 맞는 맞춤 영양을 추천해 드리기 위한 기준이에요.',
    options: [
      {
        value: 'under_5000' as BudgetTier,
        label: '하루 5,000원 이하',
        sub: '부담 없이 영양 보강',
      },
      {
        value: '5000_10000' as BudgetTier,
        label: '하루 5,000~10,000원',
        sub: '화식과 사료 균형 있게',
      },
      {
        value: '10000_15000' as BudgetTier,
        label: '하루 10,000~15,000원',
        sub: '화식 위주로 풍성하게',
      },
      {
        value: 'no_limit' as BudgetTier,
        label: '예산은 크게 신경 쓰지 않아요',
        sub: '프리미엄 영양 우선',
      },
    ],
    footer: '💚 어떤 답을 하셔도 ○○이에게 맞춰 드려요',
  },
  bcs: {
    question: '사진을 보고 ○○이와 가장 비슷한 모습을 골라주세요.',
    footer: '정답은 없어요. 더 정확한 분량을 안내해 드리려고요 🐾',
  },
  medications: {
    question: '○○이가 평소 드시는 약이나 영양제가 있나요? (선택)',
    subtitle:
      '일부 영양 성분이 약과 함께 드시면 영향을 줄 수 있어 미리 알면 더 안전한 처방을 안내해 드릴 수 있어요.',
  },
} as const

// ──────────────────────────────────────────────────────────────────────
// 분석 결과 카피 (Analysis)
// ──────────────────────────────────────────────────────────────────────
export const ANALYSIS_COPY = {
  mer_summary: (name: string, kcal: number) =>
    `${petName(name)}의 하루 권장 칼로리는 ${kcal} kcal 정도예요.\n` +
    `평균적인 활동량 기준이고, 산책 시간이나 활동량에 따라 조금 달라질 수 있어요.`,

  price_framing: (perMealKrw: number, comparison: string) =>
    `한 끼 약 ${perMealKrw.toLocaleString()}원 (${comparison}보다 적어요)`,

  daily_total: (dailyKrw: number, monthlyKrw: number) =>
    `하루 약 ${dailyKrw.toLocaleString()}원 · 한 달 약 ${Math.round(monthlyKrw / 10000)}만원`,

  // Mix 비율 default 카피 (예산 응답별)
  mix_default: {
    topper: (name: string) =>
      `${petName(name)}를 위한 부담 없는 영양 보강\n` +
      `🥗 화식 30% (토퍼) + 평소 사료 70%\n\n` +
      `한 끼 영양 보강용으로 가볍게. ${petName(name)}가 더 좋아하는 한 끼가 돼요.`,

    mix50: (name: string) =>
      `${petName(name)}를 위한 균형 잡힌 방식\n` +
      `🥗 화식 50% + 평소 드시는 사료 50%\n\n` +
      `화식의 좋은 점은 그대로 받고, 평소 사료와 자연스럽게 어울려요.`,

    mix70: (name: string) =>
      `${petName(name)}를 위한 풍성한 영양\n` +
      `🥗 화식 70% + 평소 사료 30%\n\n` +
      `화식 위주로 드시면서 평소 사료로 가볍게 보완해요.`,

    full: (name: string) =>
      `${petName(name)}를 위한 프리미엄 맞춤 영양\n` +
      `🥗 화식 100% 단독 급여\n\n` +
      `프리미엄 영양·자연 단백·EPA/DHA 풍부.`,
  },

  slider_label: '다른 비율도 한 번 보세요 ▼',
  slider_options: {
    30: '화식 30% · 토퍼처럼 가볍게',
    50: '화식 50% · 균형',
    70: '화식 70% · 화식 위주',
    100: '화식 100% · 단독 급여',
  },

  // First box discount
  first_box_offer: (originalPerMeal: number, discountedPerMeal: number) =>
    `처음 한 박스만 한 끼 ${discountedPerMeal.toLocaleString()}원\n\n` +
    `(원래 한 끼 ${originalPerMeal.toLocaleString()}원 · 50% 할인)\n` +
    `○○이가 좋아할지 부담 없이 시험해 보세요. ` +
    `입맛에 맞지 않으면 환불해 드려요.`,

  // Over-budget (사용자 예산이 권장량 비현실적일 때)
  over_budget: (name: string, recommendedKrw: number) =>
    `💡 ${petName(name)}의 일일 권장량으로는 하루 ${recommendedKrw.toLocaleString()}원 정도면 충분해요!\n\n` +
    `남는 예산으로 다양한 단백질을 더 자주 즐기실 수도 있어요. ` +
    `닭·오리·돼지·한우 골고루 rotation 추천드려요 🐾`,

  // Social proof (친구 평균 비교)
  social_proof: (avgKrw: number, userKrw: number, name: string) =>
    `💬 비슷한 체중의 다른 ${petName(name)}들은 평균 하루 ${avgKrw.toLocaleString()}원 정도 사용하고 계세요.\n\n` +
    (userKrw > avgKrw
      ? `${petName(name)}는 ${userKrw.toLocaleString()}원 응답이라 평균 이상 케어 의지가 있으시네요.`
      : `${petName(name)}의 예산도 충분히 합리적이에요.`),

  // 38영양소 가시화 헤더
  nutrition_overview: (name: string) =>
    `${petName(name)}의 하루 영양 38가지 한눈에 보기 🐾\n\n` +
    `모두 균형이 맞춰져 있어요. 빠지는 영양소 없이 한 끼에 다 채워져요.`,

  prebiotic_callout:
    '🥗 모든 화식에 자연 식이섬유 1g/팩이 들어 있어요. ○○이 장 환경에 도움이 되는 천연 성분이에요.',
} as const

// ──────────────────────────────────────────────────────────────────────
// 카피 헬퍼 — ○○이 placeholder 자동 치환
// ──────────────────────────────────────────────────────────────────────
export function withDogName(template: string, dogName: string): string {
  // 2026-06-19: "○○이" placeholder = 이름 친근형. 받침 따라 정확히 — 나우→"나우",
  // 푸린→"푸린이". 뒤 조사(의/에게/와/가)는 친근형이 모음끝이라 그대로 맞음.
  // 남은 bare ○○ 는 원형 이름으로 치환(안전망).
  return template.replace(/○○이/g, petName(dogName)).replace(/○○/g, dogName)
}
