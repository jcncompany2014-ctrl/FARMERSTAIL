/**
 * 견종 레지스트리 — 50종+ (한국 견종 포함).
 *
 * 발명 모듈 C 의 기반 데이터. NRC 산출, 클러스터 거리, 사료 라인 매칭에
 * 모두 활용. 견종 lookup 은 PCT 무관 (공개 데이터) — flag 가드 X.
 *
 * # 데이터 출처
 *  · 평균 체중·수명: AKC + 한국 동물 등록 통계 (대략적 mid-point)
 *  · 활동 baseline: 운동 요구도 카테고리 1~5
 *  · 크기 카테고리: AKC 분류 (toy/small/medium/large/giant)
 *
 * # 사용자 친화 라벨
 * registerBreed.label 가 사용자에게 노출되는 한글 표기. AKC 영문명은 alias.
 */

export type DogSize = 'toy' | 'small' | 'medium' | 'large' | 'giant'

export type BreedInfo = {
  /** 코드 (영문 slug). DB key. */
  code: string
  /** 사용자 친화 한글명 */
  label: string
  /** AKC / 영문 alias */
  alias?: string
  size: DogSize
  /** 평균 체중 kg (성견 mid-point) */
  avgWeight: number
  /** 평균 수명 (년) */
  avgLifespan: number
  /** 활동 baseline 1~5 (1=very_low, 5=very_high) */
  activityBaseline: 1 | 2 | 3 | 4 | 5
  /** 한국 견종 여부 */
  korean?: boolean
}

export const BREEDS: BreedInfo[] = [
  // ── Toy (≤4kg)
  { code: 'pomeranian', label: '포메라니안', alias: 'Pomeranian', size: 'toy', avgWeight: 2.5, avgLifespan: 14, activityBaseline: 3 },
  { code: 'maltese', label: '말티즈', alias: 'Maltese', size: 'toy', avgWeight: 3, avgLifespan: 14, activityBaseline: 2 },
  { code: 'chihuahua', label: '치와와', alias: 'Chihuahua', size: 'toy', avgWeight: 2, avgLifespan: 15, activityBaseline: 3 },
  { code: 'toy_poodle', label: '토이 푸들', alias: 'Toy Poodle', size: 'toy', avgWeight: 3, avgLifespan: 14, activityBaseline: 3 },
  { code: 'yorkie', label: '요크셔 테리어', alias: 'Yorkshire Terrier', size: 'toy', avgWeight: 3, avgLifespan: 14, activityBaseline: 3 },
  { code: 'papillon', label: '파피용', alias: 'Papillon', size: 'toy', avgWeight: 3.5, avgLifespan: 15, activityBaseline: 4 },
  { code: 'shih_tzu', label: '시츄', alias: 'Shih Tzu', size: 'toy', avgWeight: 5, avgLifespan: 12, activityBaseline: 2 },

  // ── Small (4~10kg)
  { code: 'bichon', label: '비숑 프리제', alias: 'Bichon Frisé', size: 'small', avgWeight: 6, avgLifespan: 14, activityBaseline: 3 },
  { code: 'mini_poodle', label: '미니 푸들', alias: 'Miniature Poodle', size: 'small', avgWeight: 7, avgLifespan: 14, activityBaseline: 4 },
  { code: 'dachshund', label: '닥스훈트', alias: 'Dachshund', size: 'small', avgWeight: 8, avgLifespan: 14, activityBaseline: 3 },
  { code: 'pug', label: '퍼그', alias: 'Pug', size: 'small', avgWeight: 7, avgLifespan: 13, activityBaseline: 2 },
  { code: 'jack_russell', label: '잭 러셀 테리어', alias: 'Jack Russell', size: 'small', avgWeight: 7, avgLifespan: 14, activityBaseline: 5 },
  { code: 'schnauzer_mini', label: '미니어처 슈나우저', alias: 'Mini Schnauzer', size: 'small', avgWeight: 7, avgLifespan: 13, activityBaseline: 3 },
  { code: 'cocker', label: '코커 스패니얼', alias: 'Cocker Spaniel', size: 'small', avgWeight: 12, avgLifespan: 13, activityBaseline: 4 },

  // ── Medium (10~25kg)
  { code: 'beagle', label: '비글', alias: 'Beagle', size: 'medium', avgWeight: 11, avgLifespan: 13, activityBaseline: 4 },
  { code: 'corgi', label: '웰시코기', alias: 'Welsh Corgi', size: 'medium', avgWeight: 13, avgLifespan: 13, activityBaseline: 4 },
  { code: 'shiba', label: '시바이누', alias: 'Shiba Inu', size: 'medium', avgWeight: 10, avgLifespan: 14, activityBaseline: 4 },
  { code: 'french_bulldog', label: '프렌치 불독', alias: 'French Bulldog', size: 'medium', avgWeight: 11, avgLifespan: 11, activityBaseline: 2 },
  { code: 'jindo', label: '진돗개', alias: 'Jindo', size: 'medium', avgWeight: 18, avgLifespan: 14, activityBaseline: 4, korean: true },
  { code: 'pungsan', label: '풍산개', alias: 'Pungsan', size: 'large', avgWeight: 25, avgLifespan: 13, activityBaseline: 4, korean: true },
  { code: 'sapsali', label: '삽살개', alias: 'Sapsali', size: 'medium', avgWeight: 23, avgLifespan: 13, activityBaseline: 3, korean: true },
  { code: 'border_collie', label: '보더콜리', alias: 'Border Collie', size: 'medium', avgWeight: 17, avgLifespan: 13, activityBaseline: 5 },
  { code: 'samoyed', label: '사모예드', alias: 'Samoyed', size: 'medium', avgWeight: 23, avgLifespan: 13, activityBaseline: 4 },
  { code: 'husky', label: '시베리안 허스키', alias: 'Husky', size: 'large', avgWeight: 23, avgLifespan: 12, activityBaseline: 5 },
  { code: 'australian_shepherd', label: '오스트레일리안 셰퍼드', alias: 'Aussie', size: 'medium', avgWeight: 22, avgLifespan: 13, activityBaseline: 5 },

  // ── Large (25~45kg)
  { code: 'golden_retriever', label: '골든 리트리버', alias: 'Golden Retriever', size: 'large', avgWeight: 30, avgLifespan: 11, activityBaseline: 4 },
  { code: 'labrador', label: '래브라도 리트리버', alias: 'Labrador', size: 'large', avgWeight: 30, avgLifespan: 11, activityBaseline: 4 },
  { code: 'german_shepherd', label: '저먼 셰퍼드', alias: 'German Shepherd', size: 'large', avgWeight: 30, avgLifespan: 11, activityBaseline: 4 },
  { code: 'dalmatian', label: '달마시안', alias: 'Dalmatian', size: 'large', avgWeight: 25, avgLifespan: 12, activityBaseline: 5 },
  { code: 'bulldog', label: '불독', alias: 'Bulldog', size: 'large', avgWeight: 23, avgLifespan: 9, activityBaseline: 1 },
  { code: 'rottweiler', label: '로트와일러', alias: 'Rottweiler', size: 'large', avgWeight: 45, avgLifespan: 9, activityBaseline: 3 },
  { code: 'doberman', label: '도베르만', alias: 'Doberman', size: 'large', avgWeight: 35, avgLifespan: 11, activityBaseline: 4 },
  { code: 'boxer', label: '복서', alias: 'Boxer', size: 'large', avgWeight: 30, avgLifespan: 10, activityBaseline: 4 },

  // ── Giant (45kg+)
  { code: 'great_dane', label: '그레이트 데인', alias: 'Great Dane', size: 'giant', avgWeight: 60, avgLifespan: 8, activityBaseline: 3 },
  { code: 'mastiff', label: '마스티프', alias: 'Mastiff', size: 'giant', avgWeight: 75, avgLifespan: 9, activityBaseline: 2 },
  { code: 'saint_bernard', label: '세인트 버나드', alias: 'Saint Bernard', size: 'giant', avgWeight: 75, avgLifespan: 9, activityBaseline: 2 },
  { code: 'newfoundland', label: '뉴펀들랜드', alias: 'Newfoundland', size: 'giant', avgWeight: 60, avgLifespan: 10, activityBaseline: 3 },

  // ── 한국 인기 추가 / Mix
  { code: 'maltipoo', label: '말티푸', alias: 'Maltipoo', size: 'toy', avgWeight: 4, avgLifespan: 13, activityBaseline: 3 },
  { code: 'cavapoo', label: '카바푸', alias: 'Cavapoo', size: 'small', avgWeight: 7, avgLifespan: 13, activityBaseline: 3 },
  { code: 'cavalier', label: '카발리에', alias: 'Cavalier King Charles', size: 'small', avgWeight: 7, avgLifespan: 11, activityBaseline: 3 },
  { code: 'mix', label: '믹스', alias: 'Mix', size: 'medium', avgWeight: 10, avgLifespan: 13, activityBaseline: 3 },
]

export function findBreed(code: string): BreedInfo | undefined {
  return BREEDS.find((b) => b.code === code)
}

export function findBreedByLabel(label: string): BreedInfo | undefined {
  return BREEDS.find((b) => b.label === label)
}

/**
 * 견종 size 카테고리 (B-40). dog.weight 가 정확하면 weight 우선, 없으면
 * 견종 baseline.
 */
export function sizeFromBreedOrWeight(
  breedCode: string | null | undefined,
  weightKg: number | null | undefined,
): DogSize {
  if (weightKg != null && weightKg > 0) {
    if (weightKg < 4) return 'toy'
    if (weightKg < 10) return 'small'
    if (weightKg < 25) return 'medium'
    if (weightKg < 45) return 'large'
    return 'giant'
  }
  const b = breedCode ? findBreed(breedCode) : null
  return b?.size ?? 'medium'
}
