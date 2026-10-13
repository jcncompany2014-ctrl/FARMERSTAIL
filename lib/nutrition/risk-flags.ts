/**
 * lib/nutrition/risk-flags.ts — 영양 분석 risk flag 한국어 라벨 + 응급도 매핑.
 *
 * # 배경
 * nutrition.ts 의 calculateNutrition 이 riskFlags: string[] 을 emit. 이전엔
 * UI 가 raw enum (예: "REFEEDING_RISK") 을 그대로 표시 → 사용자가 의미 못 함.
 *
 * 본 모듈은 SSOT — 한국어 라벨 + 짧은 설명 + severity (응급도) 매핑.
 *
 * # 카피 규칙 (2026-07-24 사장님)
 *  - label·desc 는 보호자가 아는 쉬운 말. 임상 약어(BCS/DM/EPA/IRIS 등)·수치식·
 *    치료제명은 쓰지 않는다. 원래 임상 용어는 term 에 넣어 화면에 "작게 병기".
 *
 * # severity
 *  - critical : 즉시 수의사 진료 — refeeding / severe obesity
 *  - high     : 수의사 상담 권장 — 만성질환 식이 등
 *  - info     : 안내성 — 거대견 metabolism / 비만 위험군 등
 */

export type RiskSeverity = 'critical' | 'high' | 'info'

export type RiskFlagInfo = {
  label: string
  /** 작게 병기하는 임상 용어 (예: '만성 신장질환 · CKD'). 없으면 미표시. */
  term?: string
  desc: string
  severity: RiskSeverity
}

/**
 * 알려진 risk flag 매핑. 미커버 flag 는 호출처에서 raw 그대로 fallback.
 *
 * 새 flag 추가 시 nutrition.ts / firstBox.ts / guidelines.ts 의 riskFlags
 * push 와 동시에 여기에 등록.
 */
// ★고객에게 보이는 설명에 **박스에 없는 성분**을 '넣었어요·더했어요'라고 쓰지 않는다
//   (2026-09-25 출시 전 점검 4차). 유산균·글루코사민·코코넛오일은 판매 레시피 4종 어디에도
//   없는데 분석 화면이 넣었다고 말했다 — 실제 고객이 봤다(표시광고법 거짓 표시·보조제 중단 위험).
//   성분은 products.ingredients 에 있는 것만. 보조제는 '수의사와 상의' 권유로만. 규칙104.
// ★하지 않은 조정도 '했어요'라고 쓰지 않는다(2026-10-13 점검 E7). 레시피 4종은 고정이라 인·나트륨·지방·탄수화물·
//   식이섬유를 아이마다 바꾸지 않는다 — 실제로 하는 건 열량(하루 양)과 레시피 고르기뿐이다. 라벨도 질환 '케어' 같은
//   효능 대신 상태와 '수의사와 함께'로 쓴다(E10 사장님 결정).
export const RISK_FLAG_INFO: Record<string, RiskFlagInfo> = {
  REFEEDING_RISK: {
    label: '응급 · 심하게 마른 상태',
    term: '재급여증후군 주의',
    desc: '너무 마른 상태라 갑자기 많이 주면 위험해요. 조금씩 단계적으로 늘리고, 반드시 수의사와 함께 진행하세요.',
    severity: 'critical',
  },
  SEVERE_UNDERWEIGHT: {
    label: '많이 말랐어요',
    desc: '열량을 조금 더했어요. 숨은 질환이 없는지 수의사 진료를 권해요.',
    severity: 'critical',
  },
  UNDERWEIGHT: {
    label: '조금 말랐어요',
    term: '저체중',
    desc: '열량을 조금 더했어요. 6주 뒤에 체형을 다시 확인해요.',
    severity: 'info',
  },
  OVERWEIGHT: {
    label: '조금 통통해요',
    term: '과체중',
    desc: '천천히 감량해요. 하루 양을 지키고 간식은 줄여 주세요.',
    severity: 'info',
  },
  SEVERE_OBESITY: {
    label: '비만 · 수의사 상담 권장',
    term: '고도 비만',
    desc: '너무 빠른 감량은 오히려 위험해요. 정기적으로 몸무게를 재고 수의사와 식단을 함께 정하세요.',
    severity: 'critical',
  },
  GIANT_BREED: {
    label: '대형견 (50kg 이상)',
    term: '거대 품종',
    desc: '대형견은 표준 공식보다 필요 열량이 낮을 수 있어요. 활동량을 정확히 입력하고 수의사와 상담해요.',
    severity: 'info',
  },
  KETOGENIC_DIET: {
    label: '발작(뇌전증) · 수의사와 함께',
    term: '뇌전증 · 케토제닉 식이',
    desc: '이 화식은 지방 위주(케토제닉) 식단이 아니에요. 발작 관리 식단과 약은 수의사와 정해 주세요.',
    severity: 'high',
  },
  CKD_DIET_REQUIRED: {
    label: '신장 질환 · 수의사와 함께',
    term: '만성 신장질환 · CKD',
    desc: '이 화식은 저단백·저인 식단이 아니에요. 신장은 단계마다 식단이 달라서, 식단은 수의사와 정해 주세요.',
    severity: 'high',
  },
  DIABETIC_DIET_REQUIRED: {
    label: '당뇨 · 수의사와 함께',
    term: '당뇨',
    desc: '하루 열량에 맞춰 양을 정했어요. 인슐린과 식사 시간은 수의사와 함께 맞춰 주세요.',
    severity: 'high',
  },
  CARDIAC_LOW_SODIUM: {
    label: '심장 질환 · 수의사와 함께',
    term: '심장질환',
    desc: '레시피는 그대로예요. 짠 간식은 피하고, 심장 검진은 수의사와 정기적으로 해 주세요.',
    severity: 'high',
  },
  LOW_FAT_REQUIRED: {
    label: '췌장염 · 지방이 적은 레시피',
    term: '췌장염',
    desc: '첫 박스는 지방이 적은 레시피를 먼저 골라요. 지방이 아주 적은 식단은 아니라서, 상태에 맞는 식단은 수의사와 꼭 확인하세요.',
    severity: 'high',
  },
  HEPATIC_SUPPORT: {
    label: '간 질환 · 수의사와 함께',
    term: '간질환',
    desc: '한우 레시피는 빼고 골라요. 식단은 수의사와 꼭 상의해 주세요.',
    severity: 'high',
  },
  JOINT_SUPPORT: {
    label: '관절 · 체중 관리가 중요해요',
    desc: '체중을 줄이면 관절 부담이 크게 줄어요. 모든 레시피에 오메가-3(연어유)가 들어 있고, 관절 보조제는 수의사와 상의해 주세요.',
    severity: 'info',
  },
  HYPOTHYROID_WEIGHT: {
    label: '갑상선 · 체중 관리',
    term: '갑상선 기능저하',
    desc: '살이 잘 찌는 편이라 하루 열량에 맞춰 양을 정했어요. 약과 검사는 수의사와 함께해 주세요.',
    severity: 'high',
  },
  CUSHINGS_DIET: {
    label: '쿠싱 · 수의사와 함께',
    term: '쿠싱증후군',
    desc: '살이 잘 찌고 근육이 빠지기 쉬워요. 약과 검사는 수의사와 함께해 주세요.',
    severity: 'high',
  },
  STEROID_SIDE_EFFECTS: {
    label: '스테로이드 복용 중',
    desc: '스테로이드 복용 중엔 식욕이 늘고 칼슘이 빠지기 쉬워요. 체형과 혈당을 정기적으로 확인해 주세요.',
    severity: 'high',
  },
  EPI_ENZYME_REQUIRED: {
    label: '소화 효소 부족',
    term: '외분비 췌장 부전 · EPI',
    desc: '소화 효소가 부족한 상태예요. 효소·비타민 보충이 꾸준히 필요하고 식단만으로는 부족해요 — 수의사와 상의하세요.',
    severity: 'high',
  },
  COGNITIVE_SUPPORT: {
    label: '노령 · 인지 변화 살피기',
    term: '인지기능 저하 · CDS',
    desc: '오메가-3(연어유)와 채소가 들어간 레시피예요. 밤에 헤매거나 낯설어하면 수의사와 상의해 주세요.',
    severity: 'info',
  },
  WEIGHT_LOSS_DIET: {
    label: '체중 관리',
    desc: '하루 열량에 맞춰 양을 정했어요. 너무 빨리 빠지면 수의사와 점검해요.',
    severity: 'info',
  },
  HYPOALLERGENIC_DIET: {
    label: '알레르기 · 한 가지 단백질',
    term: '저알러지 식이',
    desc: '흔히 안 먹던 새 단백질 한 가지로 8~12주 시도해봐요.',
    severity: 'info',
  },
  SINGLE_PROTEIN_REQUIRED: {
    label: '예민한 장 · 한 가지 단백질',
    term: '염증성 장질환 · IBD',
    desc: '한 가지 단백질로 시작해요. 증상이 계속되면 수의사와 상의해 주세요.',
    severity: 'high',
  },
  TRACHEAL_WEIGHT: {
    label: '기관 허탈 · 체중 관리',
    term: '기관 허탈',
    desc: '살이 찌면 기도가 더 눌려요. 체중을 꾸준히 확인하고 천천히 감량해요.',
    severity: 'high',
  },
  IVDD_WEIGHT: {
    label: '디스크 · 체중 관리',
    term: '추간판 질환 · IVDD',
    desc: '체중이 디스크를 눌러요. 천천히 감량하고, 점프·계단은 피해주세요.',
    severity: 'high',
  },
  LOW_OXALATE_DIET: {
    label: '요로결석 · 수의사와 함께',
    term: '저옥살산 식이',
    desc: '한우 레시피는 빼고 골라요. 물을 충분히 주시고, 결석 종류에 맞는 식단은 수의사와 확인하세요.',
    severity: 'high',
  },
  PREGNANT: {
    label: '임신 중',
    desc: '임신 시기에 맞춰 열량을 올렸어요. 정기 검진을 받고, 4주 뒤 사진도 남겨주세요.',
    severity: 'high',
  },
  LACTATING: {
    label: '수유 중',
    desc: '새끼 수에 맞춰 열량을 크게 올렸어요. 자주 나눠 주시고, 식단은 수의사와 상담해요.',
    severity: 'high',
  },
  FACTOR_CAPPED_HIGH: {
    label: '계산 상한 도달',
    desc: '입력하신 조합(체형·임신·활동량)이 계산 한계를 넘어 최대치로 맞췄어요. 입력값을 한 번 더 확인해주세요.',
    severity: 'info',
  },
  FACTOR_CAPPED_LOW: {
    label: '계산 하한 도달',
    desc: '감량 계산의 최저치로 맞췄어요. 정상 범위지만 수의사 점검을 권해요.',
    severity: 'info',
  },
  MUSCLE_LOSS: {
    label: '근육이 줄고 있어요',
    term: '근육량 감소 · MCS',
    desc: '가벼운 운동을 권해요. 계속 빠지면 숨은 질환이 없는지 수의사와 확인하세요.',
    severity: 'high',
  },
  CHRONIC_CONFLICT: {
    label: '복합 질환 · 권장 충돌',
    desc: '두 질환의 식이 방향이 서로 반대예요 (예: 한쪽은 단백질을 줄여야 하고, 다른 쪽은 늘려야 해요). 자동 비율은 절충안이라, 꼭 수의사와 우선순위를 정하세요.',
    severity: 'high',
  },
  SKIN_BARRIER_COMPROMISED: {
    label: '피부가 예민해요',
    desc: '모든 레시피에 오메가-3(연어유)가 들어 있어요. 가려움이나 상처가 계속되면 수의사 진료를 권해요.',
    severity: 'high',
  },
  CONSTIPATION: {
    label: '변비 신호',
    desc: '물과 식이섬유를 늘려요. 계속되면 수의사와 점검해요.',
    severity: 'info',
  },
  LOOSE_STOOL: {
    label: '무른 변',
    desc: '고구마·단호박처럼 부드러운 식이섬유가 든 레시피예요. 새 음식은 천천히 바꿔주세요.',
    severity: 'info',
  },
  DIARRHEA: {
    label: '설사',
    desc: '탈수에 주의하세요. 24시간 이상 지속되거나 피가 섞이면 바로 수의사 진료를 받으세요.',
    severity: 'high',
  },
  TREAT_LOAD_DAILY: {
    label: '매일 간식 · 비만 주의',
    desc: '간식 열량만큼 밥을 줄였어요. 간식은 하루 열량의 10% 이내로 유지하세요.',
    severity: 'info',
  },
  RELIABILITY_SAFETY_ADJUST: {
    label: '보수적 계산 적용',
    desc: '체중 측정 정밀도가 낮아 안전하게 보수적으로 계산했어요. 동물병원 체중계로 재면 더 정확해져요.',
    severity: 'info',
  },
}

/**
 * raw flag → 한국어 라벨. 미커버 flag 는 raw 그대로 fallback (운영자가 새 flag
 * 추가 시 한 차례 사용자 노출되지만 시스템 깨지진 않음).
 */
export function riskFlagLabel(flag: string): string {
  return RISK_FLAG_INFO[flag]?.label ?? flag
}

/**
 * raw flag → 작게 병기할 임상 용어. 없으면 빈 문자열.
 */
export function riskFlagTerm(flag: string): string {
  return RISK_FLAG_INFO[flag]?.term ?? ''
}

/**
 * raw flag → severity. 미커버 flag 는 'info' fallback.
 */
export function riskFlagSeverity(flag: string): RiskSeverity {
  return RISK_FLAG_INFO[flag]?.severity ?? 'info'
}

/**
 * raw flag → 짧은 설명. 미커버 flag 는 빈 문자열.
 */
export function riskFlagDesc(flag: string): string {
  return RISK_FLAG_INFO[flag]?.desc ?? ''
}
