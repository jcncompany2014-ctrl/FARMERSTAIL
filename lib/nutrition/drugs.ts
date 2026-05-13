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
  // 당뇨 — canine DM 표준은 인슐린만. 사람용 metformin/glipizide/exenatide 는
  // canine 표준 아님 (audit 권고에 따라 제거 — 보호자가 본인 약 잘못 입력 시
  // 잘못된 자동 진단 방지).
  {
    keywords: [
      '인슐린',
      'insulin',
      'caninsulin',
      '카니인슐린',
      'vetsulin',
      '벳슐린',
      'prozinc',
      '프로진크',
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
  // IBD — 면역억제. atopica 는 atopic dermatitis 1차 적응증이지만 IBD off-label
  // 사용 가능 — 키워드 'atopica + 장' 특이도 약하므로 azathioprine 만 strong.
  {
    keywords: [
      '시클로스포린',
      'cyclosporine',
      '아자티오프린',
      'azathioprine',
    ],
    condition: 'ibd',
    label: '염증성 장질환 (IBD)',
  },
  // EPI (Exocrine Pancreatic Insufficiency) — 효소 보충제. 췌장염과 다른 질환.
  // audit 보강 — pancreatin/viokase 는 췌장염 약물이 아닌 EPI 효소.
  {
    keywords: [
      '판크레아틴',
      'pancreatin',
      'viokase',
      '비오카제',
      'creon',
      '크레온',
      'pancrease',
      '판크리즈',
    ],
    condition: 'epi',
    label: '외분비 췌장 부전 (EPI)',
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
  // v1.6 — 한국 시장 / audit 보강 약물

  // 알레르기성 피부염 — 한국 시판 핵심 약물 (atopy 1차 진단 신호)
  {
    keywords: [
      'apoquel',
      '아포퀠',
      '아포켈',
      'oclacitinib',
      '오클라시티닙',
      'cytopoint',
      '사이토포인트',
      'lokivetmab',
      '로키베트맙',
      'atopica',
      '아토피카',
    ],
    condition: 'allergy_skin',
    label: '알레르기성 피부염 (Atopy)',
  },
  // 갑상선저하증 — 한국 동물병원 흔한 호르몬 처방
  {
    keywords: [
      '레보티록신',
      'levothyroxine',
      '솔록신',
      'soloxine',
      '신트로이드',
      'synthroid',
      'thyrosyn',
      '치로신',
    ],
    condition: 'hypothyroid',
    label: '갑상선저하증',
  },
  // Cushing's (부신피질항진증) — 한국 흔한 노령견 진단
  {
    keywords: [
      '트릴로스탄',
      'trilostane',
      'vetoryl',
      '베토릴',
      'mitotane',
      '미토탄',
      'lysodren',
      '리소드렌',
    ],
    condition: 'cushings',
    label: '부신피질항진증 (Cushing\'s)',
  },
  // 만성 통증 / 관절염 보조 — gabapentin/tramadol 장기 처방
  {
    keywords: [
      '가바펜틴',
      'gabapentin',
      '트라마돌',
      'tramadol',
      'amantadine',
      '아만타딘',
    ],
    condition: 'arthritis',
    label: '관절염 (만성 통증)',
  },
  // GI ulcer / GERD — omeprazole 장기 + sucralfate
  {
    keywords: [
      'omeprazole',
      '오메프라졸',
      'pantoprazole',
      '판토프라졸',
      'sucralfate',
      '수크랄페이트',
    ],
    condition: 'ibd',
    label: 'GI 만성 (위장 보호)',
  },
  // CKD adjunct — 한국 흔한 처방
  {
    keywords: [
      'azodyl',
      '아조딜',
      'kremezin',
      '크레메진',
      'renalzin',
      '리날진',
      'fortekor',
      '포르테코',
    ],
    condition: 'kidney',
    label: 'CKD 보조',
  },

  // ── 한국 시장 처방식 (prescription diet) 키워드 ────────────────────────
  // Hill's Prescription Diet / Royal Canin Veterinary Diet — 한국 동물병원
  // 1순위 처방. 약물 다음으로 영양 진단의 가장 강력한 신호. 보호자가
  // medications 칸에 처방식을 함께 적는 케이스 다수 (audit 보강).

  // Hill's k/d (Renal) + Royal Canin Renal — 신장
  {
    keywords: [
      "k/d",
      'kd 처방식',
      'k-d',
      'kd canine',
      "hill's k/d",
      '힐스 k/d',
      'royal canin renal',
      '로얄캐닌 신장',
      '로얄캐닌 renal',
      '로얄캐닌 레날',
      'renal canine',
      '신장 처방식',
      '신장처방식',
    ],
    condition: 'kidney',
    label: 'CKD (처방식 신장)',
  },
  // Hill's u/d (Urinary stones) + Royal Canin Urinary — 요결석
  // [B3 fix] ChronicConditionKey 에 urinary_stone 키 존재 — kidney → urinary_stone.
  {
    keywords: [
      "u/d",
      'ud 처방식',
      "hill's u/d",
      '힐스 u/d',
      'royal canin urinary',
      '로얄캐닌 urinary',
      '로얄캐닌 요로',
      '요결석 처방식',
      's/o',
      'royal canin so',
    ],
    condition: 'urinary_stone',
    label: '요결석/요로 (처방식)',
  },
  // Hill's i/d (GI) + Royal Canin Gastrointestinal — 만성 위장
  {
    keywords: [
      'i/d',
      'id 처방식',
      "hill's i/d",
      '힐스 i/d',
      'gastrointestinal',
      'royal canin gastrointestinal',
      '로얄캐닌 gastrointestinal',
      '로얄캐닌 소화기',
      '소화기 처방식',
    ],
    condition: 'ibd',
    label: 'GI 만성 (처방식 소화기)',
  },
  // Hill's z/d (Hypoallergenic) + Royal Canin Hypoallergenic / Hydrolyzed
  // — 식이 알레르기 / 만성 피부
  {
    keywords: [
      'z/d',
      'zd 처방식',
      "hill's z/d",
      '힐스 z/d',
      'hypoallergenic',
      'royal canin hypoallergenic',
      '로얄캐닌 hypoallergenic',
      '로얄캐닌 하이포',
      'hydrolyzed protein',
      'hp 처방식',
      'royal canin hp',
    ],
    condition: 'allergy_skin',
    label: '식이 알레르기 (처방식 가수분해)',
  },
  // Hill's w/d (Weight) + Royal Canin Satiety / Obesity
  // [B3 fix] ChronicConditionKey 에 obesity 키 신규 추가 — arthritis → obesity.
  // 체중 감량 처방식 사용자 → 비만 진단 직접 적용.
  {
    keywords: [
      'w/d',
      'wd 처방식',
      "hill's w/d",
      '힐스 w/d',
      'royal canin satiety',
      '로얄캐닌 새티어티',
      'royal canin obesity',
      '로얄캐닌 오베시티',
      '체중 처방식',
      'metabolic',
      'royal canin metabolic',
    ],
    condition: 'obesity',
    label: '비만 관리 (처방식 체중)',
  },
  // Hill's r/d (Weight reduction — 강한 감량) — w/d 보다 강한 감량용.
  // 동일 매핑.
  {
    keywords: [
      'r/d',
      'rd 처방식',
      "hill's r/d",
      '힐스 r/d',
    ],
    condition: 'obesity',
    label: '비만 감량 (처방식 r/d)',
  },
  // Hill's j/d (Joint Mobility) + Royal Canin Mobility
  {
    keywords: [
      'j/d',
      'jd 처방식',
      "hill's j/d",
      '힐스 j/d',
      'royal canin mobility',
      '로얄캐닌 mobility',
      '로얄캐닌 모빌리티',
      '관절 처방식',
    ],
    condition: 'arthritis',
    label: '관절 처방식',
  },
  // Hill's l/d (Liver) + Royal Canin Hepatic — 간
  {
    keywords: [
      'l/d',
      'ld 처방식',
      "hill's l/d",
      '힐스 l/d',
      'royal canin hepatic',
      '로얄캐닌 hepatic',
      '로얄캐닌 헤파틱',
      '간 처방식',
    ],
    condition: 'liver',
    label: '간 처방식',
  },
  // Hill's h/d 또는 Royal Canin Cardiac
  {
    keywords: [
      'h/d',
      'hd 처방식',
      "hill's h/d",
      '힐스 h/d',
      'royal canin cardiac',
      '로얄캐닌 cardiac',
      '로얄캐닌 카디악',
      '심장 처방식',
    ],
    condition: 'cardiac',
    label: '심장 처방식',
  },
  // Hill's b/d (Brain Aging) — 인지저하증 보조
  {
    keywords: [
      'b/d',
      'bd 처방식',
      "hill's b/d",
      '힐스 b/d',
      '인지 처방식',
    ],
    condition: 'cognitive_decline',
    label: '인지저하 처방식',
  },
  // Royal Canin Diabetic
  {
    keywords: [
      'royal canin diabetic',
      '로얄캐닌 diabetic',
      '로얄캐닌 당뇨',
      '당뇨 처방식',
    ],
    condition: 'diabetes',
    label: '당뇨 처방식',
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
