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

/** 커버 사진 — 페이지 맨 위 풀블리드. ⛔실물 스냅만(사장님 2026-09-25 엑스표 4장). */
export const BIO_COVER = '/pouch-freezer-43.jpg'

/**
 * 이벤트 배너 카드 — "알려드려요" 섹션. 번호 공지줄(notice) + 큰 타이포 배너가
 * 한 쌍으로 그려진다(킥고잉 링크인바이오 문법). 끝난 이벤트는 여기서 뺀다.
 */
type BioEventCardBase = {
  /** 번호 공지줄 한 문장 (배너 위에 ① ② 로 붙는다). */
  notice: string
  /** 배너 이미지 위 작은 배지 (예: 모집 / 이벤트). */
  badge: string
  title: string
  sub: string
  href: string
}

export type BioEventCard = BioEventCardBase &
  (
    | {
        /**
         * photo = 사진 위 어두운 스크림 + 크림 글자.
         * paper = 밝은 이미지(여백이 왼쪽) 위 잉크 글자 — 이미지는 오른쪽으로 민다.
         */
        variant: 'photo' | 'paper'
        /** public/ 경로의 이미지. */
        image: string
      }
    | {
        /**
         * products = 글자는 위 흰 띠, 제품 사진은 아래 한 줄 — 글자와 사진이
         * 겹치지 않는다(사장님 2026-09-26 "정보가 많은 사진 위에 폰트 올리면
         * 헷갈리려나" → 안 올린다). 스마트스토어와 같은 실제 패키지 컷.
         */
        variant: 'products'
        /** public/ 경로의 정사각 제품 컷 3~4장. */
        images: string[]
        /** 목적지 브랜드 포인트 컬러 — naver = 스마트스토어 초록(#03C75A) 라인·배지·민트 배경. */
        accent?: 'naver'
      }
  )

export const BIO_EVENT_CARDS: BioEventCard[] = [
  {
    notice: '서포터즈 1기를 모집하고 있어요 (~9/30)',
    badge: '모집',
    title: '서포터즈 1기 모집',
    sub: '게시물 댓글로 지원해 주세요',
    image: '/hero-dog.jpg',
    variant: 'photo',
    href: 'https://www.instagram.com/p/DdlgwF8Ej1L/',
  },
  {
    notice: '스마트스토어 오픈 기념 리뷰 이벤트가 진행 중이에요',
    badge: '이벤트',
    title: '리뷰 최대 20% 포인트백',
    sub: '네이버 스마트스토어 오픈 기념 · 화식 4종',
    // 홈·레시피 페이지와 같은 실제 패키지 컷(스마트스토어 대표 이미지와 동일).
    images: ['/pouch-hanwoo.webp', '/pouch-blackpork.webp', '/pouch-duck.webp', '/pouch-chicken.webp'],
    variant: 'products',
    accent: 'naver',
    href: 'https://smartstore.naver.com/farmerstail',
  },
]

/** 사진 가로 스트립 — 실물 스냅만. ⛔review-owner-dog·bowl-fresh 기각(2026-09-25). */
export const BIO_MOMENTS: string[] = [
  '/pouch-freezer-45.jpg',
  '/bowl-eating.jpg',
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
