/**
 * /link (링크인바이오) 고정 콘텐츠 — 인스타 프로필 링크의 목적지.
 *
 * litt.ly 대신 자사 도메인(farmerstail.kr/link)으로: 브랜드 신뢰 + UTM 이
 * 자사 퍼널(lib/utm.ts 수집)에 그대로 이어져 어떤 게시물이 구독으로 갔는지
 * 보인다.
 *
 * 2026-09-26 부터 **커버 사진·이벤트/모집 배너(기간)·'파머스테일의 하루' 사진은
 * 어드민(/admin/link → link_page_settings·link_banners)** 에서 관리한다.
 * 여기 남는 건 배포 없이 바뀔 일이 없는 것 — 빠른 이동 버튼, 스마트스토어
 * 카드(제품 4종 컷), 앱 스토어, 인스타 주소, 그리고 DB 를 못 읽을 때의 폴백.
 */
import { SUBSCRIPTION_DISCOUNT_PCT } from './pricing.ts'

export type BioLink = {
  label: string
  sub?: string
  href: string
  /** 강조 버튼(맨 위 1개 권장). */
  primary?: boolean
}

const UTM = 'utm_source=instagram&utm_medium=bio'

/**
 * 스마트스토어 — 사장님이 준 네이버 마케팅 링크(2026-09-30). 뒤의 NaPm 은 네이버 쪽
 * 유입 집계용 값이라 지우거나 줄이면 안 된다. DB 배너(link_banners.href)도 같은 주소.
 */
export const SMARTSTORE_URL =
  'https://smartstore.naver.com/farmerstail?NaPm=ct%3D1k3pc0air%7Cci%3Dshopn%7Ctr%3Dmktlnk%7Chk%3Da8be6386e76ece0ea39773e5ef80b98b699a375f%7Ctrx%3Dundefined'

/**
 * ★첫 버튼 = 앱 소개 전용 화면(/app) — 2026-10-09 사장님 지시.
 * 토스 일반결제 심사 전이라 자사몰은 팔 수 없지만 심사 때문에 막을 수도 없다. 그래서 인스타로
 * 오는 손님은 본 사이트(/start 설문 등)를 거치지 않고 /app 으로만 가게 한다(/app 엔 본 사이트로
 * 나가는 길이 없다). 심사가 끝나 상점을 열면 이 버튼을 상점으로 되돌린다. 규칙165.
 * (되돌릴 때 = 웹 시안 C12 순서: ① '레시피 고르기 · 공식몰 · 500g 24,000원부터'(/store, 강조) ② 이 앱 줄(강조 해제) ③ 스마트스토어.)
 * 문구는 웹 시안 C12(2026-10-10 웹 리뉴얼).
 */
export const BIO_LINKS: BioLink[] = [
  {
    label: '앱에서 맞춤 정기배송',
    sub: `우리 아이 몫만큼 · ${SUBSCRIPTION_DISCOUNT_PCT}% 할인`,
    href: `/app?${UTM}&utm_campaign=linkinbio`,
    primary: true,
  },
  {
    label: '스마트스토어에서 구매하기',
    sub: '네이버에서 간편하게',
    href: SMARTSTORE_URL,
  },
]

/** DB 폴백용 커버 — 어드민 저장값이 정본(lib/link-content/load.ts). ⛔실물 스냅만. */
export const BIO_COVER = '/pouch-freezer-43.jpg'

/** DB 폴백용 '파머스테일의 하루' — 어드민 저장값이 정본. */
export const BIO_MOMENTS: string[] = ['/pouch-freezer-45.jpg', '/bowl-eating.jpg']

/**
 * 스마트스토어 카드 — 글자는 위 흰 띠, 실제 패키지 컷 4장은 아래 한 줄(겹치지
 * 않음, 사장님 2026-09-26). 네이버 초록 포인트. 노출 여부만 어드민(show_store_card).
 */
export const STORE_CARD = {
  notice: '스마트스토어 오픈 기념 리뷰 이벤트가 진행 중이에요',
  badge: '이벤트',
  /** 배지 옆 작은 회색 조건 — 비면 표시 안 함. 선착순 문구는 뺐다(사장님 2026-09-30). */
  condition: '',
  title: '리뷰 최대 20% 포인트백',
  sub: '네이버 스마트스토어 오픈 기념 · 화식 4종',
  // 레시피 팩 스튜디오 사진(웹 가게와 같은 컷 — 웹 시안 C12, 2026-10-10). 순서 = 한우·흑돼지·오리·닭.
  images: ['/store/studio-beef.webp', '/store/studio-pork.webp', '/store/studio-duck.webp', '/store/studio-chicken.webp'],
  href: SMARTSTORE_URL,
} as const

/**
 * 앱 스토어 — env 가 있으면 우선(스테이징 덮어쓰기 여지), 없으면 출시된
 * 실제 주소로 폴백. 예전엔 env 없으면 버튼을 안 그렸는데, 프로덕션에
 * NEXT_PUBLIC_IOS_APP_URL 이 없어 App Store 버튼만 계속 빠져 있었다
 * (app/app-required 와 같은 문제·같은 해법 — 출시된 앱 주소는 안 바뀐다).
 */
export const APP_STORE_LINKS = {
  android:
    process.env.NEXT_PUBLIC_ANDROID_APP_URL ??
    'https://play.google.com/store/apps/details?id=com.farmerstail.app',
  ios:
    process.env.NEXT_PUBLIC_IOS_APP_URL ??
    'https://apps.apple.com/kr/app/id6807279982',
}

/** 인스타 프로필 — 푸터 소셜 아이콘. */
export const INSTAGRAM_URL = 'https://www.instagram.com/farmerstail'
