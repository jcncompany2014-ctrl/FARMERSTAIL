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
export const RISK_FLAG_INFO: Record<string, RiskFlagInfo> = {
  REFEEDING_RISK: {
    label: '응급 · 심하게 마른 상태',
    term: '재급여증후군 주의',
    desc: '너무 마른 상태라 갑자기 많이 주면 위험해요. 조금씩 단계적으로 늘리고, 반드시 수의사와 함께 진행하세요.',
    severity: 'critical',
  },
  SEVERE_UNDERWEIGHT: {
    label: '많이 말랐어요',
    desc: '단백질과 열량을 보강했어요. 숨은 질환이 없는지 수의사 진료를 권해요.',
    severity: 'critical',
  },
  UNDERWEIGHT: {
    label: '조금 말랐어요',
    term: '저체중',
    desc: '단백질과 열량을 더했어요. 6주 뒤에 체형을 다시 확인해요.',
    severity: 'info',
  },
  OVERWEIGHT: {
    label: '조금 통통해요',
    term: '과체중',
    desc: '천천히 감량해요. 단백질은 유지하고 지방·탄수화물만 줄여요.',
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
    label: '발작 케어 · 지방 위주 식단',
    term: '뇌전증 · 케토제닉 식이',
    desc: '지방 위주 식단으로 관리해요. 발작약을 바꿀 때는 수의사와 바로 상담하세요.',
    severity: 'high',
  },
  CKD_DIET_REQUIRED: {
    label: '신장 케어 · 미네랄 조절',
    term: '만성 신장질환 · CKD',
    desc: '신장 부담을 줄이려고 인(미네랄)을 낮추고 오메가-3를 더했어요. 신장은 상태 단계마다 관리가 달라서, 수의사와 단계를 꼭 확인하세요.',
    severity: 'high',
  },
  DIABETIC_DIET_REQUIRED: {
    label: '당뇨 · 맞춤 식단',
    term: '당뇨',
    desc: '혈당이 천천히 오르도록 탄수화물을 줄이고 식이섬유를 늘렸어요. 인슐린을 바꿀 때는 수의사와 함께하세요.',
    severity: 'high',
  },
  CARDIAC_LOW_SODIUM: {
    label: '심장 케어 · 나트륨 낮춤',
    term: '심장질환',
    desc: '심장 부담을 줄이려고 나트륨을 낮추고 심장에 좋은 영양(타우린·오메가-3)을 더했어요. 심장 상태에 맞춰 조절해요.',
    severity: 'high',
  },
  LOW_FAT_REQUIRED: {
    label: '췌장 케어 · 저지방',
    term: '췌장염',
    desc: '췌장 부담을 줄이려고 지방을 크게 낮췄어요. 장 건강을 돕는 유산균도 함께 넣었어요.',
    severity: 'high',
  },
  HEPATIC_SUPPORT: {
    label: '간 케어 · 단백질 균형',
    term: '간질환',
    desc: '간을 돕도록 단백질을 적정 수준으로 맞췄어요(너무 줄이면 근육이 빠져요). 수의사 진료를 권해요.',
    severity: 'high',
  },
  JOINT_SUPPORT: {
    label: '관절 케어',
    desc: '관절에 좋은 영양(글루코사민·오메가-3)을 더했어요. 체중을 줄이면 관절 부담이 크게 줄어요.',
    severity: 'info',
  },
  HYPOTHYROID_WEIGHT: {
    label: '갑상선 · 체중 관리',
    term: '갑상선 기능저하',
    desc: '갑상선 문제로 살이 잘 쪄서, 지방을 낮추고 식이섬유를 늘렸어요.',
    severity: 'high',
  },
  CUSHINGS_DIET: {
    label: '쿠싱 · 식이 관리',
    term: '쿠싱증후군',
    desc: '살이 잘 찌고 근육이 빠지기 쉬워요. 단백질은 유지하고 지방을 낮췄어요.',
    severity: 'high',
  },
  STEROID_SIDE_EFFECTS: {
    label: '스테로이드 · 식이 보강',
    desc: '스테로이드 복용 중엔 칼슘이 빠지고 식욕이 늘어요. 칼슘·오메가-3·식이섬유를 보강했어요.',
    severity: 'high',
  },
  EPI_ENZYME_REQUIRED: {
    label: '소화 효소 부족',
    term: '외분비 췌장 부전 · EPI',
    desc: '소화 효소가 부족한 상태예요. 효소·비타민 보충이 꾸준히 필요하고 식단만으로는 부족해요 — 수의사와 상의하세요.',
    severity: 'high',
  },
  COGNITIVE_SUPPORT: {
    label: '노령 인지 케어',
    term: '인지기능 저하 · CDS',
    desc: '뇌 건강에 좋은 영양(오메가·코코넛오일)과 항산화 성분을 더했어요.',
    severity: 'info',
  },
  WEIGHT_LOSS_DIET: {
    label: '체중 관리',
    desc: '단백질은 유지하고 지방·탄수화물을 줄였어요. 너무 빨리 빠지면 수의사와 점검해요.',
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
    desc: '한 종류 단백질과 부드러운 식이섬유로 장을 편하게 해요. 유산균도 함께요.',
    severity: 'high',
  },
  TRACHEAL_WEIGHT: {
    label: '기관 케어 · 체중 관리',
    term: '기관 허탈',
    desc: '살이 찌면 기도가 더 눌려요. 지방을 낮추고 천천히 감량해요.',
    severity: 'high',
  },
  IVDD_WEIGHT: {
    label: '디스크 케어 · 체중 관리',
    term: '추간판 질환 · IVDD',
    desc: '체중이 디스크를 눌러요. 관절에 좋은 영양을 더했고, 점프·계단은 피해주세요.',
    severity: 'high',
  },
  LOW_OXALATE_DIET: {
    label: '요로결석 · 맞춤 식단',
    term: '저옥살산 식이',
    desc: '물을 충분히 주고, 결석이 잘 안 생기도록 미네랄을 조절했어요. 결석 종류에 따라 관리가 달라서 수의사와 확인하세요.',
    severity: 'high',
  },
  PREGNANT: {
    label: '임신 중',
    desc: '임신 시기에 맞춰 열량을 올렸어요. 정기 검진을 받고, 4주 뒤 사진도 남겨주세요.',
    severity: 'high',
  },
  LACTATING: {
    label: '수유 중',
    desc: '새끼 수에 맞춰 열량을 크게 올렸어요. 언제든 먹을 수 있게 자율 급여를 권하고, 수의사와 상담해요.',
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
    desc: '단백질을 보강하고 가벼운 운동을 권해요. 계속 빠지면 숨은 질환이 없는지 수의사와 확인하세요.',
    severity: 'high',
  },
  CHRONIC_CONFLICT: {
    label: '복합 질환 · 권장 충돌',
    desc: '두 질환의 식이 방향이 서로 반대예요 (예: 한쪽은 단백질을 줄여야 하고, 다른 쪽은 늘려야 해요). 자동 비율은 절충안이라, 꼭 수의사와 우선순위를 정하세요.',
    severity: 'high',
  },
  SKIN_BARRIER_COMPROMISED: {
    label: '피부 장벽 케어',
    desc: '피부에 좋은 오메가-3·아연을 보강했어요. 가려움이나 상처가 계속되면 수의사 진료를 권해요.',
    severity: 'high',
  },
  CONSTIPATION: {
    label: '변비 신호',
    desc: '물과 식이섬유를 늘려요. 계속되면 수의사와 점검해요.',
    severity: 'info',
  },
  LOOSE_STOOL: {
    label: '무른 변',
    desc: '부드러운 식이섬유와 유산균을 더했어요. 천천히 바꿔주세요.',
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
