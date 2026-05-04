/**
 * 약물 키워드 → 만성질환 자동 매칭.
 *
 * 보호자가 medications 텍스트에 입력한 약물 이름에서 chronic_conditions 를
 * 자동 추론. 누락된 진단 입력 보완. 사용자에게 chip 으로 제안 — 자동 추가
 * 안 함 (사용자가 명시 confirm).
 *
 * # 키워드 매칭 — 한국어 + 영문 + 일반명 (generic).
 *  · 사례: "프레드니솔론 5mg/kg q24h" 입력 → long_term_steroid 제안
 *  · "인슐린 + 메트포민" → diabetes 제안
 *  · "에날라프릴 + 피모벤단" → cardiac 제안
 *
 * # 출처
 *  · Plumb's Veterinary Drug Handbook 9e
 *  · BSAVA Small Animal Formulary 9e
 */

import type { ChronicConditionKey } from './guidelines'

type DrugRule = {
  /** 매칭할 키워드 (한국어/영문/generic). 대소문자 무관. */
  keywords: string[]
  /** 매칭 시 제안할 chronic 키. */
  condition: ChronicConditionKey
  /** chip 라벨 (한국어). */
  label: string
}

export const DRUG_RULES: DrugRule[] = [
  // 만성 스테로이드 — corticosteroid 장기 복용
  {
    keywords: [
      '프레드니솔론',
      'prednisolone',
      '프레드니',
      '프레드솔',
      '메드롤',
      'medrol',
      'methylprednisolone',
      '메칠프레드니솔론',
      '덱사메타손',
      'dexamethasone',
    ],
    condition: 'long_term_steroid',
    label: '장기 스테로이드',
  },
  // 당뇨 — 인슐린 / 경구 혈당 강하제
  {
    keywords: [
      '인슐린',
      'insulin',
      '바이에타',
      '메트포민',
      'metformin',
      'glipizide',
      '글리피지드',
      'caninsulin',
      '카니인슐린',
      'vetsulin',
    ],
    condition: 'diabetes',
    label: '당뇨',
  },
  // 심장병 — ACE 억제제 / pimobendan / 이뇨제
  {
    keywords: [
      '에날라프릴',
      'enalapril',
      '베나제프릴',
      'benazepril',
      '피모벤단',
      'pimobendan',
      'vetmedin',
      '벳메딘',
      '푸로세미드',
      'furosemide',
      'spironolactone',
      '스피로노락톤',
    ],
    condition: 'cardiac',
    label: '심장병/DCM',
  },
  // CKD — 인 binder / ACE 억제제 (renal 처방식 키워드 포함)
  {
    keywords: [
      'aluminum hydroxide',
      '알루미늄 하이드록사이드',
      'lanthanum',
      '란타넘',
      'sevelamer',
      '세벨라머',
      'renal rf',
      '신장 처방식',
      '레날',
    ],
    condition: 'kidney',
    label: '만성 신장질환',
  },
  // 관절염 — NSAID / 영양제는 chronic 진단 신호 약함, NSAID 만 매칭
  {
    keywords: [
      'meloxicam',
      '멜록시캄',
      'carprofen',
      '카프로펜',
      'rimadyl',
      '리마딜',
      'firocoxib',
      '피로콕시브',
      'galliprant',
      '갈리프란트',
    ],
    condition: 'arthritis',
    label: '관절염',
  },
  // IBD — 면역억제 / metronidazole 장기 복용
  {
    keywords: [
      '시클로스포린',
      'cyclosporine',
      'atopica',
      '아토피카',
      '아자티오프린',
      'azathioprine',
      'metronidazole 장기',
      '플래질 장기',
    ],
    condition: 'ibd',
    label: '염증성 장질환 (IBD)',
  },
  // 췌장염 — 효소 보충 / 진통제 (chronic 진단 후 사용)
  {
    keywords: [
      '판크레아틴',
      'pancreatin',
      'viokase',
      '비오카제',
    ],
    condition: 'pancreatitis',
    label: '췌장염',
  },
  // 간질환 — UDCA / SAMe / silymarin 장기 복용
  {
    keywords: [
      'ursodeoxycholic',
      'ursodiol',
      '우르소데옥시콜',
      '우르소디올',
      'same',
      's-adenosylmethionine',
      '실리마린',
      'silymarin',
      'denamarin',
      '데나마린',
    ],
    condition: 'liver',
    label: '간질환',
  },
  // 간질 — 항경련제
  {
    keywords: [
      '페노바르비탈',
      'phenobarbital',
      '레비티라세탐',
      'levetiracetam',
      'keppra',
      '케프라',
      'zonisamide',
      '조니사미드',
      '브롬화칼륨',
      'potassium bromide',
    ],
    condition: 'epilepsy',
    label: '간질',
  },
  // 인지저하증 — selegiline / propentofylline / SAMe 장기
  {
    keywords: [
      'selegiline',
      '셀레길린',
      'anipryl',
      '아니프릴',
      'propentofylline',
      '프로펜토필린',
    ],
    condition: 'cognitive_decline',
    label: '인지저하증',
  },
]

export type DrugMatch = {
  condition: ChronicConditionKey
  label: string
  keyword: string
}

/**
 * 입력 텍스트에서 키워드 매칭. 같은 condition 은 한 번만 (가장 첫 매칭).
 */
export function detectChronicFromMedications(text: string): DrugMatch[] {
  if (!text || text.trim().length === 0) return []
  const lower = text.toLowerCase()
  const seen = new Set<ChronicConditionKey>()
  const results: DrugMatch[] = []
  for (const rule of DRUG_RULES) {
    if (seen.has(rule.condition)) continue
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        results.push({
          condition: rule.condition,
          label: rule.label,
          keyword: kw,
        })
        seen.add(rule.condition)
        break
      }
    }
  }
  return results
}
