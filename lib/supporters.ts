/**
 * 서포터즈 링크 — 다섯 아이 (사장님 2026-10-19 "서포터즈 다섯 명용 링크 페이지 … 따로 주소 만들어서 누가 잘 팔았는지도 분석").
 *
 * 주소 두 개가 한 코드로 묶인다:
 *   /link/<code> — 링크 모음 + 맨 위 이 아이 사진·영상 + 이벤트 단추(서포터즈가 인스타 프로필·스토리에 건다)
 *   /p/<code>    — 이벤트 화면(약국 봉투와 같은 흐름), 맨 위가 이 아이
 * code = promotions.code 다. 그 코드로 가입(promotion_claims)·첫 결제(redeemed_order_id)가 그대로 이 아이 몫으로 집계된다
 * (어드민 이벤트 할인 화면의 가입·결제 수). 할인율·최대 할인 금액·기간은 **행사표(DB)가 정본** — 여기엔 사진과 이름만 둔다.
 *
 * 공개 화면이라 보호자 이름은 쓰지 않는다(아이 이름만). 사진은 보호자가 찍어 보낸 실사진(사장님 10/19 전달) —
 * 룽지 사진의 그릇 테두리 다른 회사 이름은 흐리게 지웠다.
 */

export type DogMedia =
  /** 가로로 잘라 쓴 사진 — 칸을 꽉 채운다. position = object-position(폭 480 에서 위아래가 잘릴 때 남길 곳). */
  | { kind: 'photo'; fit: 'cover'; src: string; position?: string }
  /** 세로 사진 통째로(보호자가 글을 얹은 사진 등) — 같은 그림을 흐리게 깔고 가운데에. w·h = 원본 비율. */
  | { kind: 'photo'; fit: 'contain'; src: string; w: number; h: number }
  /** 세로 영상 — 소리 없이 반복. 저전력 모드 아이폰은 재생을 거절한다 → poster 가 그대로 보인다. */
  | { kind: 'video'; src: string; poster: string; w: number; h: number }

export type HeroDog = {
  name: string
  alt: string
  media: DogMedia
}

export type Supporter = HeroDog & { code: string }

export const SUPPORTERS: readonly Supporter[] = [
  {
    code: 'rungji',
    name: '룽지',
    alt: '치킨 레시피 팩과 화식 그릇 앞에 앉은 말티푸 룽지',
    media: { kind: 'photo', fit: 'cover', src: '/event/supporters/rungji.webp', position: 'center 30%' },
  },
  {
    code: 'kkingkong',
    name: '낑콩',
    alt: '오리 레시피 팩 뒤에 앉은 말티푸 낑콩',
    media: { kind: 'photo', fit: 'cover', src: '/event/supporters/kkingkong.webp', position: 'center 0%' },
  },
  {
    code: 'punch',
    name: '펀치',
    alt: '흑돼지 레시피 팩 사이에 엎드린 웨스티 펀치',
    media: { kind: 'photo', fit: 'cover', src: '/event/supporters/punch.webp', position: 'center 40%' },
  },
  {
    code: 'holbi',
    name: '홀비',
    alt: '그릇에 담긴 화식을 먹는 골든 리트리버 홀비',
    media: { kind: 'video', src: '/event/supporters/holbi.mp4', poster: '/event/supporters/holbi-poster.webp', w: 336, h: 720 },
  },
  {
    code: 'pika',
    name: '피카',
    alt: '다 먹은 빈 그릇 옆에 앉은 피카',
    media: { kind: 'photo', fit: 'contain', src: '/event/supporters/pika.webp', w: 749, h: 900 },
  },
]

/** 서포터즈 코드가 아닌 이벤트(약국 봉투 등)의 맨 위 사진 — 식탁 앞 셸티 땅콩(가게 첫 화면과 같은 컷, 시안 A). */
export const DEFAULT_HERO_DOG: HeroDog = {
  name: '땅콩',
  alt: '식탁 앞에서 밥을 기다리는 셸티 땅콩',
  media: { kind: 'photo', fit: 'cover', src: '/store/hero-sheltie-table.webp', position: 'center 30%' },
}

export function supporterByCode(code: string | null | undefined): Supporter | null {
  if (!code) return null
  return SUPPORTERS.find((s) => s.code === code) ?? null
}
