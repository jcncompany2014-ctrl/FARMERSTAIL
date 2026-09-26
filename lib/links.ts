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

export type BioLink = {
  label: string
  sub?: string
  href: string
  /** 강조 버튼(맨 위 1개 권장). */
  primary?: boolean
}

const UTM = 'utm_source=instagram&utm_medium=bio'

export const BIO_LINKS: BioLink[] = [
  {
    label: '2분 설문으로 맞춤 식단 받기',
    sub: '우리 아이 몸에 맞춘 신선 화식',
    href: `/start?${UTM}&utm_campaign=linkinbio`,
    primary: true,
  },
  {
    label: '스마트스토어에서 구매하기',
    sub: '네이버에서 간편하게',
    href: 'https://smartstore.naver.com/farmerstail',
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
  title: '리뷰 최대 20% 포인트백',
  sub: '네이버 스마트스토어 오픈 기념 · 화식 4종',
  // 홈·레시피 페이지와 같은 실제 패키지 컷(스마트스토어 대표 이미지와 동일).
  images: ['/pouch-hanwoo.webp', '/pouch-blackpork.webp', '/pouch-duck.webp', '/pouch-chicken.webp'],
  href: 'https://smartstore.naver.com/farmerstail',
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
