/**
 * 가게 상품 상세의 후기 (2026-10-15, 규칙286) — 손님이 인스타그램 등으로 보내 준 후기를 **게시 동의를 받아** 옮긴다.
 *
 * - 후기 쓰기 기능은 아직 없다(2026-07-16 폐기) — 이 목록이 정본이다. 레시피에 후기가 없으면 상품 화면은 '모으는 중' 안내를 보인다.
 * - 줄여 옮길 땐 그렇다고 밝힌다(note). 상품 페이지에 올린 후기는 우리 광고라서 질병 이름·치료 효과로 읽히는 문장은 옮기지 않는다
 *   (사료 표시·광고 — 규칙286 이 지킨다). 사정을 살릴 땐 병명 없이 쓴다(예: '치료 중이라' — 사장님 10/15 선택).
 * - 사진은 public/store/review-*.webp. 손님 사진에 우리 레시피에 없는 토핑이 올라가 있으면 쓰지 않는다(재료 오해).
 */
import type { StoreRecipe } from './catalog.ts'

export type StoreReview = {
  id: string
  recipe: StoreRecipe
  /** 강아지 이름 — 보호자 이름 대신 'OO 보호자님'으로 쓴다. */
  dogName: string
  breed: string | null
  /** 후기에서 고른 한 줄(따옴표 안에 보인다). */
  title: string
  body: string
  photos: ReadonlyArray<{ src: string; alt: string }>
  /** 어디서 받았고 어떻게 옮겼는지(줄였으면 줄였다고). */
  note: string
}

export const STORE_REVIEWS: readonly StoreReview[] = [
  {
    id: 'roa-2026-10',
    recipe: 'chicken',
    dogName: '로아',
    breed: '프렌치 불도그',
    title: '다른 건 다 뱉는데 이것만 골라 먹어요',
    body: '치료 중이라 로아 식욕이 많이 떨어져서 걱정이 많았는데 정말 잘 먹어요. 다른 건 다 뱉어 내는데 파머스테일 화식만 골라 먹어요. 아이스팩을 넉넉히 넣어 주셔서 녹지 않고 잘 도착했어요. 좋아하는 모습 보니 저도 너무 좋네요!',
    photos: [
      { src: '/store/review-roa-eat.webp', alt: '흰 그릇에 담긴 닭고기 화식을 먹는 프렌치 불도그 로아' },
      { src: '/store/review-roa-packs.webp', alt: '닭고기 화식 팩들 앞에 앉은 로아' },
    ],
    note: '인스타그램으로 남겨 주신 후기를 줄여 옮겼어요',
  },
]

export function reviewsFor(recipe: StoreRecipe): StoreReview[] {
  return STORE_REVIEWS.filter((r) => r.recipe === recipe)
}
