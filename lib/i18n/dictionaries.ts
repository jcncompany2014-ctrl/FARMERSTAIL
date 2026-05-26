/**
 * XL-12 (#50) — i18n 기반 사전.
 *
 * 본 모듈은 *foundation* — 풀 i18n 적용은 PMF 후 (해외 진출 시점)
 * 단계적 진행. 지금은:
 *   1) 사전 구조 + locale 검출 + helper 함수 정의
 *   2) 첫 적용 surface 결정 (analytics / settings 등 app-only)
 *
 * # 설계 결정 — next-intl 미사용 이유
 *   - Next.js 16 + Turbopack 환경에서 next-intl middleware 가 layout/route
 *     resolver 와 충돌 케이스 보고. 솔로 운영자 안정성 우선.
 *   - 본 자체 lib 는 ~80 LOC, edge case 적고 maintenance 가 단순.
 *   - 추후 next-intl 전환 필요 시 dictionary 구조는 호환.
 *
 * # 지원 locale
 *   - ko (default, 한국어)
 *   - en (글로벌 진출 시 활성화)
 *
 * # 추가 방법
 *   1. `dict.ko` 에 키-값 추가
 *   2. `dict.en` 에 동일 키-값 추가 (번역)
 *   3. 컴포넌트에서 `t(locale, 'key')` 호출
 */

export type Locale = 'ko' | 'en'

export const DEFAULT_LOCALE: Locale = 'ko'
export const SUPPORTED_LOCALES: Locale[] = ['ko', 'en']

export interface Dictionary {
  // 일반 액션
  'action.save': string
  'action.cancel': string
  'action.delete': string
  'action.confirm': string
  'action.share': string
  'action.print': string
  // 강아지 메타
  'dog.weight': string
  'dog.breed': string
  'dog.age': string
  'dog.gender': string
  'dog.neutered': string
  // 알림 / 상태
  'status.loading': string
  'status.error': string
  'status.empty': string
  'status.success': string
  // 영양 / 분석
  'nutrition.protein': string
  'nutrition.fat': string
  'nutrition.carb': string
  'nutrition.fiber': string
  'nutrition.bcs': string
  'nutrition.mer': string
  // 권한
  'role.owner': string
  'role.member': string
  'role.viewer': string
}

export const dict: Record<Locale, Dictionary> = {
  ko: {
    'action.save': '저장',
    'action.cancel': '취소',
    'action.delete': '삭제',
    'action.confirm': '확인',
    'action.share': '공유',
    'action.print': '인쇄',
    'dog.weight': '체중',
    'dog.breed': '견종',
    'dog.age': '나이',
    'dog.gender': '성별',
    'dog.neutered': '중성화',
    'status.loading': '불러오는 중',
    'status.error': '오류',
    'status.empty': '없음',
    'status.success': '완료',
    'nutrition.protein': '단백질',
    'nutrition.fat': '지방',
    'nutrition.carb': '탄수화물',
    'nutrition.fiber': '섬유',
    'nutrition.bcs': '체형 점수',
    'nutrition.mer': '일일 권장 칼로리',
    'role.owner': '보호자',
    'role.member': '공동 케어자',
    'role.viewer': '뷰어',
  },
  en: {
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.confirm': 'Confirm',
    'action.share': 'Share',
    'action.print': 'Print',
    'dog.weight': 'Weight',
    'dog.breed': 'Breed',
    'dog.age': 'Age',
    'dog.gender': 'Sex',
    'dog.neutered': 'Neutered',
    'status.loading': 'Loading',
    'status.error': 'Error',
    'status.empty': 'None',
    'status.success': 'Done',
    'nutrition.protein': 'Protein',
    'nutrition.fat': 'Fat',
    'nutrition.carb': 'Carbs',
    'nutrition.fiber': 'Fiber',
    'nutrition.bcs': 'Body Condition Score',
    'nutrition.mer': 'Daily Energy Requirement',
    'role.owner': 'Owner',
    'role.member': 'Caregiver',
    'role.viewer': 'Viewer',
  },
}

/**
 * 번역 lookup. 키 누락 시 fallback 으로 default locale, 그것도 없으면 key 자체 반환.
 */
export function t(locale: Locale, key: keyof Dictionary): string {
  return dict[locale]?.[key] ?? dict[DEFAULT_LOCALE]?.[key] ?? String(key)
}

/**
 * Accept-Language 헤더 또는 navigator.language 에서 supported locale 추출.
 */
export function detectLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE
  const lower = input.toLowerCase()
  for (const loc of SUPPORTED_LOCALES) {
    if (lower.startsWith(loc)) return loc
  }
  return DEFAULT_LOCALE
}
