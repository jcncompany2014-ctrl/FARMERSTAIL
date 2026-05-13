/**
 * 일반 강아지 약품 자동완성 데이터 (B-14).
 *
 * MedicalRecordForm 의 약 이름 input 에서 typeahead. 한국 동물병원에서
 * 흔히 처방되는 약품 (피부/소화/심장/관절/감염/기생충 등).
 *
 * # 출처 / 디스클레임
 * 동물약품 정보 안내 목적 — 의료 행위 X. 실 처방·용량은 수의사 판단.
 *
 * # 카테고리
 *  · skin     — 피부 / 알러지 (아토피, 옴, 진균 등)
 *  · gi       — 소화기 (설사, 구토, IBD)
 *  · cardio   — 심장
 *  · joint    — 관절 / 정형외과
 *  · infect   — 감염 (항생제)
 *  · parasite — 기생충
 *  · pain     — 진통·소염제
 *  · other    — 기타
 */

export type MedicationCategory =
  | 'skin'
  | 'gi'
  | 'cardio'
  | 'joint'
  | 'infect'
  | 'parasite'
  | 'pain'
  | 'other'

export type MedicationEntry = {
  name: string
  /** 일반명 (성분) 또는 영문 */
  generic?: string
  category: MedicationCategory
  /** 흔한 용도 한 줄 (UI 보조 표시) */
  use?: string
}

export const MEDICATIONS: MedicationEntry[] = [
  // 피부 / 알러지
  { name: '아포퀠', generic: 'Apoquel (oclacitinib)', category: 'skin', use: '아토피·가려움증' },
  { name: '사이토포인트', generic: 'Cytopoint (lokivetmab)', category: 'skin', use: '아토피 가려움 주사' },
  { name: '아토피카', generic: 'Atopica (cyclosporine)', category: 'skin', use: '아토피 면역조절' },
  { name: '프레드니솔론', generic: 'Prednisolone', category: 'skin', use: '소염·면역억제' },
  { name: '말라세브 샴푸', generic: 'Malaseb', category: 'skin', use: '진균/세균 샴푸' },
  { name: '버터제이트', generic: 'Mometasone', category: 'skin', use: '국소 스테로이드' },

  // 소화기
  { name: '메트로니다졸', generic: 'Metronidazole', category: 'gi', use: '설사·장염' },
  { name: '슈크랄페이트', generic: 'Sucralfate', category: 'gi', use: '위염·위궤양 보호' },
  { name: '오메프라졸', generic: 'Omeprazole', category: 'gi', use: '위산 억제' },
  { name: '세레니아', generic: 'Cerenia (maropitant)', category: 'gi', use: '구토·멀미' },
  { name: '프로바이오틱', generic: 'Probiotic', category: 'gi', use: '장 건강' },

  // 심장
  { name: '베트메딘', generic: 'Vetmedin (pimobendan)', category: 'cardio', use: '심부전' },
  { name: '에날라프릴', generic: 'Enalapril', category: 'cardio', use: '심장 ACE 억제' },
  { name: '푸로세미드', generic: 'Furosemide', category: 'cardio', use: '폐수종 이뇨' },

  // 관절 / 정형
  { name: '리브렐라', generic: 'Librela (bedinvetmab)', category: 'joint', use: '골관절염 통증' },
  { name: '메로카비', generic: 'Meloxicam', category: 'joint', use: 'NSAID 진통' },
  { name: '카프로벳', generic: 'Carprofen', category: 'joint', use: 'NSAID 진통' },
  { name: '그루코사민', generic: 'Glucosamine', category: 'joint', use: '관절 보조제' },

  // 감염 (항생제)
  { name: '아목시실린', generic: 'Amoxicillin', category: 'infect', use: '광범위 항생제' },
  { name: '클라불라네이트', generic: 'Amoxicillin-Clavulanate', category: 'infect', use: '광범위 항생제' },
  { name: '엔로플록사신', generic: 'Enrofloxacin', category: 'infect', use: '광범위 항생제' },
  { name: '독시사이클린', generic: 'Doxycycline', category: 'infect', use: '진드기·호흡기' },
  { name: '세파렉신', generic: 'Cephalexin', category: 'infect', use: '피부 감염' },

  // 기생충
  { name: '넥스가드', generic: 'Nexgard (afoxolaner)', category: 'parasite', use: '진드기·벼룩' },
  { name: '브라벡토', generic: 'Bravecto (fluralaner)', category: 'parasite', use: '진드기·벼룩 3개월' },
  { name: '심파리카', generic: 'Simparica', category: 'parasite', use: '진드기·벼룩' },
  { name: '하트가드', generic: 'Heartgard (ivermectin)', category: 'parasite', use: '심장사상충 예방' },
  { name: '드론탈', generic: 'Drontal', category: 'parasite', use: '내부 기생충' },

  // 진통·소염
  { name: '트라마돌', generic: 'Tramadol', category: 'pain', use: '진통' },
  { name: '가바펜틴', generic: 'Gabapentin', category: 'pain', use: '신경통' },
  { name: '리도카인', generic: 'Lidocaine', category: 'pain', use: '국소 마취' },

  // 기타
  { name: '디에트릴', generic: 'Diethylcarbamazine', category: 'other', use: '심장사상충' },
  { name: '레보록신', generic: 'Levothyroxine', category: 'other', use: '갑상선' },
  { name: '인슐린', generic: 'Insulin', category: 'other', use: '당뇨' },
]

/**
 * typeahead 검색 — 한글 name + 영문 generic 모두 매칭.
 */
export function searchMedications(
  query: string,
  limit: number = 8,
): MedicationEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return MEDICATIONS.filter((m) => {
    return (
      m.name.toLowerCase().includes(q) ||
      m.generic?.toLowerCase().includes(q) ||
      false
    )
  }).slice(0, limit)
}

/**
 * [B13] OCR 출력 약명 → registry entry 매칭.
 *
 * 진료 영수증 OCR 가 "Apoquel 5.4mg" / "프레드니솔론 정 5mg" 같은 mixed
 * 출력. 용량·단위 제거 + 부분 매칭.
 */
export function matchMedicationFromOcr(
  ocrText: string,
): MedicationEntry | null {
  if (!ocrText) return null
  const cleaned = ocrText
    .toLowerCase()
    .replace(/\d+(\.\d+)?\s*(mg|ml|kg|lbs?|iu|단위)/gi, '')
    .replace(/\d+\s*(회|일|표|정|캡슐|알)/g, '')
    .replace(/\/[a-z]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  for (const m of MEDICATIONS) {
    if (
      cleaned.includes(m.name.toLowerCase()) ||
      (m.generic && cleaned.includes(m.generic.toLowerCase().split(' ')[0]))
    ) {
      return m
    }
  }
  const tokens = cleaned.split(/[\s,()/]+/).filter((t) => t.length >= 2)
  for (const tok of tokens) {
    const found = MEDICATIONS.find(
      (m) =>
        m.name.toLowerCase().startsWith(tok) ||
        m.generic?.toLowerCase().startsWith(tok),
    )
    if (found) return found
  }
  return null
}
