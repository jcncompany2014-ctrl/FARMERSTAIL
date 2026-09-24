/**
 * /link (링크인바이오) 콘텐츠 목록 — 인스타 프로필 링크의 목적지.
 *
 * litt.ly 대신 자사 도메인(farmerstail.kr/link)으로: 브랜드 신뢰 + UTM 이
 * 자사 퍼널(lib/utm.ts 수집)에 그대로 이어져 어떤 게시물이 구독으로 갔는지
 * 보인다. 링크 변경 = 이 파일 수정 + 배포(1분) — 캠페인 config-as-code 와
 * 같은 원칙(비밀 아님·이력 남음·어드민 화면 없이 운영).
 *
 * 2026-09-25 사장님 제보로 개편: 버튼 나열만 있던 것을
 * 버튼(빠른 이동) + 이벤트 카드(이미지) + 앱 다운로드 + 카톡 문의로 확장.
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

/** 이미지가 있는 이벤트 카드 — "지금 진행 중" 섹션. 끝난 이벤트는 여기서 뺀다. */
export type BioEventCard = {
  /** 카드 이미지 위 작은 배지 (예: 모집 / 이벤트). */
  badge: string
  title: string
  sub: string
  /** public/ 경로의 이미지. */
  image: string
  href: string
}

export const BIO_EVENT_CARDS: BioEventCard[] = [
  {
    badge: '모집',
    title: '서포터즈 1기 모집',
    sub: '~9/30 · 게시물 댓글로 지원해 주세요',
    image: '/hero-dog.jpg',
    href: 'https://www.instagram.com/p/DdlgwF8Ej1L/',
  },
  {
    badge: '이벤트',
    title: '오픈 기념 리뷰 이벤트',
    sub: '스마트스토어 리뷰 최대 20% 포인트백',
    image: '/pouch-ft-wide.webp',
    href: 'https://smartstore.naver.com/farmerstail',
  },
]

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
