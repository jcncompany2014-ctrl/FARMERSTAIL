/**
 * 가게 후기 정본 (2026-10-15 시작, 규칙286·288·294) — 후기 쓰기 기능은 아직 없다(2026-07-16 폐기). 이 목록이 정본이다.
 * 레시피에 후기가 없으면 상품 화면은 '모으는 중' 안내를 보인다.
 *
 * 두 갈래로 옮긴다.
 * - 인스타그램(source 'instagram') — 손님이 보내 준 후기를 **게시 동의를 받아** 옮긴다. 줄여 옮길 땐 그렇다고 밝힌다(note).
 *   강아지 이름으로 'OO 보호자님'이라 부른다.
 * - 네이버 스마트스토어(source 'smartstore') — 사장님 2026-10-17 "네이버 스마트스토어 후기라는 거 달아 놓고, 아이디도 저 ***** 그대로".
 *   **출처 딱지 + 네이버에 보이는 가린 아이디 그대로 + 별점·날짜**를 같이 보인다. 글은 맞춤법까지 그대로 옮긴다(손대지 않는다) —
 *   예외 하나: 다른 회사 제품 이름은 가린다(○○, note 에 밝힘). 다른 회사 제품이 크게 나온 사진도 쓰지 않는다(note 에 밝힘).
 *
 * - 상품 페이지에 올린 후기는 우리 광고라서 질병 이름·치료 효과로 읽히는 문장은 옮기지 않는다(사료 표시·광고 — 규칙286).
 *   사정을 살릴 땐 병명 없이 쓴다(예: '치료 중이라' — 사장님 10/15 선택).
 * - 사진은 **정사각형으로 미리 잘라 둔다**(규칙288) — 화면은 1:1 칸에 그대로 담는다. 영상도 정사각형(소리 없음, 포스터 그림 같이).
 *   스마트스토어 사진·영상은 사장님이 보낸 후기 화면 캡처에서 사진 칸만 잘라 냈다(원본 파일이 아니라 해상도가 낮다 — 530~700px).
 * - 손님이 우리 레시피에 없는 토핑·간식을 올린 사진은 caption 으로 그렇다고 밝힌다(재료 오해 방지).
 * - recipe 가 null = 웹 가게에 아직 상세가 없는 상품(큐브·케이크) 후기. 데이터로만 넣어 두고 화면에는 안 뜬다 — 그 상품 상세가 생기면
 *   productKey 로 붙인다(사장님 10/17 "일단 리뷰로 만들어 놓고 슬슬 화식 말고 다른 제품도 집어넣자, 지금은 상세페이지가 없음").
 */
import type { StoreRecipe } from './catalog.ts'

export type ReviewSource = 'instagram' | 'smartstore'

/** 웹에 아직 상세가 없는 상품 — 스마트스토어 상품 이름에서. */
export type OtherProductKey = 'cube-duck-spinach' | 'cake-garden-summer'

export type ReviewPhoto = { src: string; alt: string; caption?: string }

export type StoreReview = {
  id: string
  /** 웹 가게 화식 레시피 — 그 상품 상세 후기 칸과 홈에 뜬다. null 이면 화면에 안 뜬다(productKey 상품). */
  recipe: StoreRecipe | null
  productKey?: OtherProductKey
  /** 산 상품(스마트스토어 옵션을 짧게). 예: '닭고기 500g' */
  product: string
  source: ReviewSource
  /** 스마트스토어 = 네이버에 보이는 가린 아이디 그대로(예: 'hatc******'). 인스타 = null. */
  reviewerId: string | null
  /** 강아지 이름 — 인스타 후기는 'OO 보호자님'으로 부른다. 스마트스토어는 이름이 없다(null). */
  dogName: string | null
  breed: string | null
  /** 네이버 유저정보의 나이(예: '3세'). */
  age: string | null
  /** 스마트스토어 별점(1~5). 인스타 후기엔 없다. */
  rating: number | null
  /** 남긴 날(YYYY-MM-DD) — 스마트스토어 후기에만. */
  date: string | null
  /** 후기에서 고른 한 줄(따옴표 안에 크게) — 인스타 후기만. 스마트스토어 후기는 글을 그대로 보이고 따로 고르지 않는다(null). */
  title: string | null
  body: string
  /** 정사각형 파일. 인스타 후기는 첫 장이 크게, 스마트스토어 후기는 한 줄로 작게. */
  photos: readonly ReviewPhoto[]
  /** 정사각형 영상(소리 없음) + 포스터 그림 — 화면에 보이면 저절로 돈다(저전력 모드면 포스터 + 재생 버튼). */
  video?: { src: string; poster: string; alt: string }
  /** 어디서 받았고 어떻게 옮겼는지(줄였으면 줄였다고, 가렸으면 가렸다고). */
  note: string
}

const SS_NOTE = '네이버 스마트스토어 후기를 그대로 옮겼어요'
const P = '/store/reviews/'

export const STORE_REVIEWS: readonly StoreReview[] = [
  // ── 치킨 레시피 ──
  {
    id: 'roa-2026-10',
    recipe: 'chicken',
    product: '닭고기 화식',
    source: 'instagram',
    reviewerId: null,
    dogName: '로아',
    breed: '프렌치 불도그',
    age: null,
    rating: null,
    date: null,
    title: '다른 건 다 뱉는데 이것만 골라 먹어요',
    body: '치료 중이라 로아 식욕이 많이 떨어져서 걱정이 많았는데 정말 잘 먹어요. 다른 건 다 뱉어 내는데 파머스테일 화식만 골라 먹어요. 아이스팩을 넉넉히 넣어 주셔서 녹지 않고 잘 도착했어요. 좋아하는 모습 보니 저도 너무 좋네요!',
    photos: [
      { src: '/store/review-roa-eat.webp', alt: '흰 그릇에 담긴 닭고기 화식을 먹는 프렌치 불도그 로아' },
      { src: '/store/review-roa-packs.webp', alt: '닭고기 화식 팩들 앞에 앉은 로아' },
      {
        src: '/store/review-roa-bowl.webp',
        alt: '보호자님이 토핑을 올려 차린 닭고기 화식 한 그릇',
        caption: '토핑은 보호자님이 올리셨어요',
      },
    ],
    note: '인스타그램으로 남겨 주신 후기를 줄여 옮겼어요',
  },
  {
    id: 'ss-hatc-1017-chicken',
    recipe: 'chicken',
    product: '닭고기 500g',
    source: 'smartstore',
    reviewerId: 'hatc******',
    dogName: null,
    breed: '닥스훈트',
    age: '3세',
    rating: 5,
    date: '2026-10-17',
    title: null,
    body: '잘먹어서 두번째 구매입니다!',
    photos: [],
    video: { src: `${P}ss-hatc-1017-chicken.mp4`, poster: `${P}ss-hatc-1017-chicken.webp`, alt: '닥스훈트 두 마리가 치킨 레시피 팩 냄새를 맡는 영상' },
    note: SS_NOTE,
  },
  {
    id: 'ss-hatc-1003-chicken',
    recipe: 'chicken',
    product: '닭고기 500g',
    source: 'smartstore',
    reviewerId: 'hatc******',
    dogName: null,
    breed: '닥스훈트',
    age: '3세',
    rating: 5,
    date: '2026-10-03',
    title: null,
    body: '세살 닥스에요. 입이 너무 짧아서 유명하고 기호도 좋다는 무슨 사료를 사줘도 안먹고 애걸복걸 먹이려고 해도 고개를 홱홱 돌리는데, 망설임없이 이렇게 잘 먹는 사료는 처음이에요. 화식사료도 유명브랜드 많이 시도해봤고 직접 만들어도 봤거든요. 리뷰 잘 쓰려고 사진이랑 동영상찍으려 들이대기 무섭게 다 먹어버리네요. 너무 감사합니다. 🙏',
    photos: [{ src: `${P}ss-hatc-1003-chicken-1.webp`, alt: '닭고기 화식을 거의 다 먹고 조금 남은 하늘색 그릇' }],
    note: SS_NOTE,
  },
  {
    id: 'ss-dalg-1008-chicken',
    recipe: 'chicken',
    product: '닭고기 500g',
    source: 'smartstore',
    reviewerId: 'dalg****',
    dogName: null,
    breed: null,
    age: '3세',
    rating: 5,
    date: '2026-10-08',
    title: null,
    body: '종류별로 사서 치킨먼저 먹어봤어요. 박스포장 뜯자마자 냄새맡으며 관심보이는게 너무 귀엽더라고요! 평소에 식단은 한끼는 ○○사료도 먹고 한끼는 생식이나 수비드로도 먹이고 있어서 특식으로 사봤어요. 기호도가 좋아서 슬로우식기에 꾹꾹 눌러줘도 끝까지 잘 먹어요! 활동량 많은날 특식이나 산책량 적을때 슬로우식기에 해줄 예정이에요!',
    photos: [{ src: `${P}ss-dalg-1008-chicken-1.webp`, alt: '초록 슬로우 식기에 꾹꾹 눌러 담은 닭고기 화식과 치킨 레시피 팩' }],
    note: `${SS_NOTE} · 다른 회사 사료 이름은 가렸어요`,
  },
  {
    id: 'ss-zira-1009-chicken',
    recipe: 'chicken',
    product: '닭고기 500g',
    source: 'smartstore',
    reviewerId: 'zira********',
    dogName: null,
    breed: null,
    age: null,
    rating: 5,
    date: '2026-10-09',
    title: null,
    body: '정말 너무 맛있게 잘 먹어요 ㅎㅎ',
    photos: [{ src: `${P}ss-zira-1009-chicken-1.webp`, alt: '노란 그릇에 담긴 화식을 올려다보는 흰 강아지', caption: '토핑·간식은 보호자님이 올리셨어요' }],
    note: SS_NOTE,
  },
  {
    id: 'ss-94-1008-chicken',
    recipe: 'chicken',
    product: '닭고기 500g',
    source: 'smartstore',
    reviewerId: '94****',
    dogName: null,
    breed: '골든 리트리버',
    age: '1세',
    rating: 5,
    date: '2026-10-08',
    title: null,
    body: '기호성이 너무 좋고 잘 먹어요. 재료가 국내산이라 좋습니다.',
    photos: [{ src: `${P}ss-94-1008-chicken-1.webp`, alt: '클로버 무늬 접시에 담은 닭고기 화식', caption: '쿠키·막대 간식은 보호자님이 올리셨어요' }],
    note: SS_NOTE,
  },

  // ── 오리 레시피 ──
  {
    id: 'ss-dalg-1009-duck',
    recipe: 'duck',
    product: '오리고기 500g',
    source: 'smartstore',
    reviewerId: 'dalg****',
    dogName: null,
    breed: null,
    age: '3세',
    rating: 5,
    date: '2026-10-09',
    title: null,
    body: '저희집 강아지는 8kg 진도믹스에요. 급여할 때 슬로우식기에 주는걸 선호하는 편이에요! 산책은 하루에 2~3번하지만 혹시나 활동량 부족한 날에는 특히 기호도좋은 간식이나 식사를 어려운 슬로우식기에 해주려고 하고 있어요. 기호도가 너무 좋아서 난이도가 높은 그릇에 해줘도 좋을 것 같아요. 너무 잘먹어요! 주식은 생식도 먹고 있어서 추가로 살지 고민을 조금 했는데 너무 잘 먹어서 종종 사줘야 할 것 같아요. 지금 치킨, 흑돼지, 오리 요렇게 3끼급여해봤는데 3끼모두 포장 뜯기전부터 기대하고 기다려요.',
    photos: [
      { src: `${P}ss-dalg-1009-duck-1.webp`, alt: '화식을 채운 주황 슬로우 식기 앞에 엎드린 강아지' },
      { src: `${P}ss-dalg-1009-duck-2.webp`, alt: '주황 슬로우 식기를 핥아 먹는 강아지' },
    ],
    note: SS_NOTE,
  },
  {
    id: 'ss-zira-1009-duck',
    recipe: 'duck',
    product: '오리고기 500g',
    source: 'smartstore',
    reviewerId: 'zira********',
    dogName: null,
    breed: null,
    age: null,
    rating: 5,
    date: '2026-10-09',
    title: null,
    body: '너무 잘먹구,,, 진짜 최고에요ㅠㅠ 50g도 출시했으면 저켓오요!!!!',
    photos: [
      { src: `${P}ss-zira-1009-chicken-1.webp`, alt: '노란 그릇에 담긴 화식을 올려다보는 흰 강아지', caption: '토핑·간식은 보호자님이 올리셨어요' },
      { src: `${P}ss-zira-1009-duck-2.webp`, alt: '손에 든 화식 팩들', caption: '사진 속 팩은 치킨 레시피예요' },
    ],
    note: SS_NOTE,
  },
  {
    id: 'ss-94-1008-duck',
    recipe: 'duck',
    product: '오리고기 500g',
    source: 'smartstore',
    reviewerId: '94****',
    dogName: null,
    breed: '골든 리트리버',
    age: '1세',
    rating: 5,
    date: '2026-10-08',
    title: null,
    body: '기호성이 너무 좋고 잘 먹어요. 재료가 국내산이라 좋습니다.',
    photos: [{ src: `${P}ss-94-1008-duck-1.webp`, alt: '대리석 바닥에 늘어놓은 오리·치킨·흑돼지 레시피 팩과 화식 큐브 두 통' }],
    note: SS_NOTE,
  },

  // ── 흑돼지 레시피 ──
  {
    id: 'ss-mjy1-1011-pork',
    recipe: 'pork',
    product: '흑돼지 500g',
    source: 'smartstore',
    reviewerId: 'mjy1***',
    dogName: null,
    breed: '진돗개',
    age: '2세',
    rating: 5,
    date: '2026-10-11',
    title: null,
    body: '하루 전 해동시켜서 한봉지로 아침에 반 저녁에 반 줬어요. 잘 먹어요. 안 섞어주면 화식만 먼저 먹고 건사료는 남겨놨다가 밤에 먹길래 섞어서 주기 시작했어요. 첨가물 냄새가 안 나고 사람음식 같아요. 원산지랑 들어간 재료, 성분량이 자세히 적혀있어요.',
    photos: [{ src: `${P}ss-mjy1-1011-pork-1.webp`, alt: '보라 슬로우 식기의 화식을 먹는 진돗개', caption: '건사료·채소는 보호자님이 섞어 주셨어요' }],
    note: `${SS_NOTE} · 다른 회사 사료가 크게 나온 사진은 뺐어요`,
  },
  {
    id: 'ss-dalg-1008-pork',
    recipe: 'pork',
    product: '흑돼지 500g',
    source: 'smartstore',
    reviewerId: 'dalg****',
    dogName: null,
    breed: null,
    age: '3세',
    rating: 5,
    date: '2026-10-08',
    title: null,
    body: '먹고있는 약이 있어 섞어줬는데도 잘 먹어요. 포장 뜯기도 전부터 관심보이는데 기호도가 넘 좋네요.',
    photos: [{ src: `${P}ss-dalg-1008-pork-1.webp`, alt: '분홍 꽃 모양 슬로우 식기의 화식을 먹는 강아지' }],
    note: SS_NOTE,
  },
  {
    id: 'ss-94-1008-pork',
    recipe: 'pork',
    product: '흑돼지 500g',
    source: 'smartstore',
    reviewerId: '94****',
    dogName: null,
    breed: '골든 리트리버',
    age: '1세',
    rating: 5,
    date: '2026-10-08',
    title: null,
    body: '기호성이 너무 좋고 일단 국내산 재료라 너무 좋아요',
    photos: [{ src: `${P}ss-94-1008-pork-1.webp`, alt: '보호자님이 든 접시의 화식을 내려다보는 골든 리트리버', caption: '채소·간식은 보호자님이 올리셨어요' }],
    note: SS_NOTE,
  },

  // ── 웹에 아직 상세가 없는 상품(화면에 안 뜬다) ──
  {
    id: 'ss-mjy1-1011-cube',
    recipe: null,
    productKey: 'cube-duck-spinach',
    product: '화식 큐브 오리+시금치 240g',
    source: 'smartstore',
    reviewerId: 'mjy1***',
    dogName: null,
    breed: '진돗개',
    age: '2세',
    rating: 5,
    date: '2026-10-11',
    title: null,
    body: '일단 아주 귀엽고 시금치 가루로 감싸져 있는게 먹이면 건강해질 것 같아서 기분 좋아요. 으깨서 사료 위에 토핑처럼 줬더니 골라먹네요. 야채 비율이 높은데 기호성어 좋네요! 토퍼로 맘에 들어요~ 원재료 및 원산지도 잘 써져있고 재료가 정말 맘에 들어요!',
    photos: [
      { src: `${P}ss-mjy1-1011-cube-3.webp`, alt: '그릇에 담긴 시금치 가루를 입힌 화식 큐브 하나' },
      { src: `${P}ss-mjy1-1011-cube-2.webp`, alt: '사료 위에 으깬 화식 큐브를 올린 보라 그릇을 먹는 진돗개' },
      { src: `${P}ss-mjy1-1011-cube-1.webp`, alt: '보라 그릇에 고개를 묻고 먹는 진돗개' },
    ],
    note: SS_NOTE,
  },
  {
    id: 'ss-94-1008-cube',
    recipe: null,
    productKey: 'cube-duck-spinach',
    product: '화식 큐브 오리+시금치 240g',
    source: 'smartstore',
    reviewerId: '94****',
    dogName: null,
    breed: '골든 리트리버',
    age: '1세',
    rating: 5,
    date: '2026-10-08',
    title: null,
    body: '기호성이 너무 좋고 잘 먹어요. 재료가 국내산이라 좋습니다.',
    // 큰 사진이 겉봉투(FARMER'S TAIL RECIPE)라 쓰지 않았다(겉봉투 사진 금지). 다른 사진은 캡처가 없다.
    photos: [],
    note: SS_NOTE,
  },
  {
    id: 'ss-navv-0927-cake',
    recipe: null,
    productKey: 'cake-garden-summer',
    product: '가든 레이어 케이크 여름',
    source: 'smartstore',
    reviewerId: 'navv*****',
    dogName: null,
    breed: null,
    age: '3세',
    rating: 5,
    date: '2026-09-27',
    title: null,
    body: '한강 회크닉 가서 인간들만 맛있는거 먹기 좀 그래서 간식 + 인스타용으로 준비했는데 완전 대성공 했어요 ㅎㅎ !!! 일단 디자인도 너무 예뻐서 사진 찍기에 최고에용 자기가 먹던건 잘 안먹는 애인데도 너무 잘먹어서 다음 피크닉 때도 꼭 재구매하려구요🥺🥺',
    photos: [
      { src: `${P}ss-navv-0927-cake-1.webp`, alt: '피크닉 돗자리 위의 가든 레이어 케이크 여름·겨울 상자' },
      { src: `${P}ss-navv-0927-cake-2.webp`, alt: '손에 든 얼린 가든 레이어 케이크 통' },
    ],
    note: SS_NOTE,
  },
]

/** 그 레시피 상품 상세에 뜨는 후기 — 목록 순서 그대로(인스타 동의 후기 → 스마트스토어). */
export function reviewsFor(recipe: StoreRecipe): StoreReview[] {
  return STORE_REVIEWS.filter((r) => r.recipe === recipe)
}

/** 홈 '먹어 본 아이 이야기' — 크게 한 편(인스타) + 아래 작은 카드(레시피마다 다른 스마트스토어 후기). 화면에 뜨는 후기만 고른다. */
export const HOME_FEATURED_REVIEW = 'roa-2026-10'
export const HOME_MORE_REVIEWS = ['ss-hatc-1003-chicken', 'ss-dalg-1009-duck', 'ss-mjy1-1011-pork'] as const

/** 우리 음식·브랜드 이야기 '후기 모아 보기' — 홈과 겹치지 않게 다른 세 편(레시피마다 하나). */
export const DIGEST_REVIEWS = ['ss-hatc-1017-chicken', 'ss-94-1008-duck', 'ss-dalg-1008-pork'] as const

export function reviewsByIds(ids: readonly string[]): StoreReview[] {
  return ids.map(reviewById).filter((r) => r !== null)
}

export function reviewById(id: string): StoreReview | null {
  const r = STORE_REVIEWS.find((x) => x.id === id)
  return r && r.recipe ? r : null
}

/**
 * 홈 증거 칸 — 화식 상세에 옮겨 둔 스마트스토어 후기의 별점 평균(소수 한 자리)·편 수·가장 최근 후기 날('10월 17일').
 * 손으로 적은 숫자는 후기가 하나 더 오면 바로 틀린다(10/17 '10건' → 그날 11건).
 */
export function smartstoreSummary(): { stars: string; reviews: number; asOf: string } {
  const list = STORE_REVIEWS.filter((r) => r.source === 'smartstore' && r.recipe !== null && r.rating !== null && r.date !== null)
  if (list.length === 0) throw new Error('스마트스토어 후기가 없다 — 홈 별점 칸을 그릴 수 없다')
  const avg = list.reduce((s, r) => s + (r.rating ?? 0), 0) / list.length
  const latest = list.map((r) => r.date as string).sort()[list.length - 1]!
  return { stars: (Math.floor(avg * 10) / 10).toFixed(1), reviews: list.length, asOf: `${Number(latest.slice(5, 7))}월 ${Number(latest.slice(8, 10))}일` }
}

/** '2026-10-17' → '2026.10.17'(네이버 표기와 같게). */
export function reviewDate(iso: string | null): string {
  return iso ? iso.split('-').join('.') : ''
}

/** 누구 후기인지 — 스마트스토어 = 가린 아이디 그대로, 인스타 = 'OO 보호자님'. */
export function reviewerLabel(r: StoreReview): string {
  if (r.source === 'smartstore') return r.reviewerId ?? '스마트스토어 구매자'
  return r.dogName ? `${r.dogName} 보호자님` : '보호자님'
}

/** 강아지 정보 한 줄 — '닥스훈트 · 3세'. 없으면 ''. */
export function reviewDogLine(r: StoreReview): string {
  return [r.breed, r.age].filter(Boolean).join(' · ')
}
