/**
 * /link (링크인바이오) 버튼 목록 — 인스타 프로필 링크의 목적지.
 *
 * litt.ly 대신 자사 도메인(farmerstail.kr/link)으로: 브랜드 신뢰 + UTM 이
 * 자사 퍼널(lib/utm.ts 수집)에 그대로 이어져 어떤 게시물이 구독으로 갔는지
 * 보인다. 링크 변경 = 이 파일 수정 + 배포(1분) — 캠페인 config-as-code 와
 * 같은 원칙(비밀 아님·이력 남음·어드민 화면 없이 운영).
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
    sub: '오픈 기념 리뷰 최대 20% 포인트백',
    href: 'https://smartstore.naver.com/farmerstail',
  },
  {
    label: '서포터즈 1기 모집 보러 가기',
    sub: '~9/30 · 댓글로 지원',
    href: 'https://www.instagram.com/p/DdlgwF8Ej1L/',
  },
]

/** 앱 스토어 — env 에 있으면 쓰고 없으면 버튼을 안 그린다. */
export const APP_STORE_LINKS = {
  android: process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? null,
  ios: process.env.NEXT_PUBLIC_IOS_APP_URL ?? null,
}
