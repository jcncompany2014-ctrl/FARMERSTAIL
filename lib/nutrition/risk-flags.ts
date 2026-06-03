/**
 * lib/nutrition/risk-flags.ts — 영양 분석 risk flag 한국어 라벨 + 응급도 매핑.
 *
 * # 배경
 * nutrition.ts 의 calculateNutrition 이 riskFlags: string[] 을 emit. 이전엔
 * UI 가 raw enum (예: "REFEEDING_RISK") 을 그대로 표시 → 사용자가 의미 못 함.
 *
 * 본 모듈은 SSOT — 한국어 라벨 + 짧은 설명 + severity (응급도) 매핑.
 *
 * # severity
 *  - critical : 즉시 수의사 진료 — refeeding / severe obesity
 *  - high     : 수의사 상담 권장 — 만성질환 식이 등
 *  - info     : 안내성 — 거대견 metabolism / 비만 위험군 등
 */

export type RiskSeverity = 'critical' | 'high' | 'info'

export type RiskFlagInfo = {
  label: string
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
    label: '응급 — 심한 저체중',
    desc: '단계적 증량 (1~3일 25%, 4~7일 50%, 8일+ 100%) + 수의사 동행 필수. 전해질 모니터링 권장.',
    severity: 'critical',
  },
  SEVERE_UNDERWEIGHT: {
    label: '심한 저체중',
    desc: '수의사 진료 권장 — 기저질환 검진 + 식이 plan 동행.',
    severity: 'critical',
  },
  UNDERWEIGHT: {
    label: '저체중',
    desc: '단백질·열량 보강. 6주 후 BCS 재평가.',
    severity: 'info',
  },
  OVERWEIGHT: {
    label: '과체중',
    desc: '천천히 (-1%/주) 감량. 단백질은 유지하고 지방·탄수만 ↓.',
    severity: 'info',
  },
  SEVERE_OBESITY: {
    label: '비만 — 수의사 plan',
    desc: '월 -1kg 이상 감량 시 위험. 정기 체중 측정 + 수의사 식이 처방 권장.',
    severity: 'critical',
  },
  GIANT_BREED: {
    label: '거대견 (50kg+)',
    desc: '대형견 metabolism 표준 공식보다 낮을 수 있음. 활동량 입력 정확도 ↑ + 수의사 상담 권장.',
    severity: 'info',
  },
  KETOGENIC_DIET: {
    label: '간질 — 케토제닉',
    desc: 'MCT (중쇄지방산) 위주. 항경련제 변경 시 수의사 즉시 상담.',
    severity: 'high',
  },
  CKD_DIET_REQUIRED: {
    label: '만성신장 — 인 제한',
    desc: '인 0.6× 제한 + EPA 보충. IRIS 가이드라인 — 수의사 단계 (Stage 1~4) 확인 필수.',
    severity: 'high',
  },
  DIABETIC_DIET_REQUIRED: {
    label: '당뇨 — 식이 처방',
    desc: '저탄수 + 고섬유. 인슐린 변경 시 수의사 동행.',
    severity: 'high',
  },
  CARDIAC_LOW_SODIUM: {
    label: '심장 — 저나트륨',
    desc: '나트륨 0.5× 제한 + 타우린 / EPA 보충 (ACVIM Stage 별 차등).',
    severity: 'high',
  },
  LOW_FAT_REQUIRED: {
    label: '췌장염 — 저지방',
    desc: '지방 ≤10% DM. 췌장 부담 ↓ + 프로바이오틱스.',
    severity: 'high',
  },
  HEPATIC_SUPPORT: {
    label: '간질환 — 단백질 적정',
    desc: 'SAMe / 실리마린 + 단백질 줄이면 근손실. 균형 plan — 수의사 진료 권장.',
    severity: 'high',
  },
  JOINT_SUPPORT: {
    label: '관절 케어',
    desc: '글루코사민·콘드로이틴 + EPA. 체중 감량 시 디스크 부담 ↓.',
    severity: 'info',
  },
  HYPOTHYROID_WEIGHT: {
    label: '갑상선 — 체중 ↑ 예방',
    desc: '의인성 체중 증가 흔함. 저지방 + 고섬유.',
    severity: 'high',
  },
  CUSHINGS_DIET: {
    label: '쿠싱 — 식이',
    desc: '의인성 비만 + 근감소. 단백질은 유지, 지방 ↓.',
    severity: 'high',
  },
  STEROID_SIDE_EFFECTS: {
    label: '스테로이드 부작용',
    desc: 'Ca 손실 + 식욕 ↑. Ca/오메가-3 + 식이섬유 보강.',
    severity: 'high',
  },
  EPI_ENZYME_REQUIRED: {
    label: '외분비 췌장 부전',
    desc: 'Pancreatin 효소 보충 평생 + B12 보충. 식이만으로 부족.',
    severity: 'high',
  },
  COGNITIVE_SUPPORT: {
    label: '인지저하 — DHA / MCT',
    desc: 'DHA + MCT 오일. 항산화제 (E·셀레늄) 보강.',
    severity: 'info',
  },
  WEIGHT_LOSS_DIET: {
    label: '체중 관리',
    desc: '단백질 유지 + 지방 / 탄수 ↓. 월 1kg 이상 감량 시 수의사 점검.',
    severity: 'info',
  },
  HYPOALLERGENIC_DIET: {
    label: '알레르기 — 단일 단백',
    desc: '신규 단백질 (가수분해 또는 single-source) 8~12주 시도.',
    severity: 'info',
  },
  SINGLE_PROTEIN_REQUIRED: {
    label: 'IBD — 단일 단백',
    desc: '한 종류 단백 + 가용성 섬유. 프로바이오틱스 + L-글루타민.',
    severity: 'high',
  },
  TRACHEAL_WEIGHT: {
    label: '기관 허탈 — 체중 ↓',
    desc: '비만은 기관 압박 악화. 저지방 + 고섬유로 천천히 감량.',
    severity: 'high',
  },
  IVDD_WEIGHT: {
    label: '디스크 — 체중 ↓',
    desc: '체중 부담 → 디스크 압박. EPA + 글루코사민. 점프 / 계단 회피.',
    severity: 'high',
  },
  LOW_OXALATE_DIET: {
    label: '요결석 — 저옥살산',
    desc: '수분 보충 + 크랜베리. Ca 0.9× 약간 제한 — 결석 종류별 처방 다름.',
    severity: 'high',
  },
  // nutrition.ts 의 임신 / 수유 / factor cap 분기에서 emit.
  PREGNANT: {
    label: '임신 중',
    desc: 'NRC 2006 임신 RER multiplier 적용. 수의사 정기 검진 + 4주 후 wk 4 사진 권장.',
    severity: 'high',
  },
  LACTATING: {
    label: '수유 중',
    desc: '리터 크기에 따라 RER×2.2~5.0 적용. 24/7 자율 급여 권장 — 수의사 상담 동행.',
    severity: 'high',
  },
  FACTOR_CAPPED_HIGH: {
    label: '계산 상한 도달',
    desc: '입력값 (BCS / 임신 / 활동량) 조합이 NRC 한계 초과 — 5.0× 로 clamp 됨. 입력 재확인 권장.',
    severity: 'info',
  },
  FACTOR_CAPPED_LOW: {
    label: '계산 하한 도달',
    desc: '감량 protocol 하한 (0.5×) 으로 clamp 됨. 정상 범위지만 수의사 점검 권장.',
    severity: 'info',
  },
  // 매크로/체형/소화 신호 — calculateNutrition 이 emit (이전엔 라벨 누락 → raw 노출).
  MUSCLE_LOSS: {
    label: '근육 감소 (MCS)',
    desc: '단백질 보강 + 저항 운동. 진행성이면 기저질환 검진 — 수의사 상담 권장.',
    severity: 'high',
  },
  CHRONIC_CONFLICT: {
    label: '복합 질환 — 권장 충돌',
    desc: '두 질환의 식이 방향이 상충해요 (예: 신장 단백↓ vs 근손실 단백↑). 자동 비율은 절충안 — 반드시 수의사와 우선순위를 정하세요.',
    severity: 'high',
  },
  SKIN_BARRIER_COMPROMISED: {
    label: '피부 장벽 손상',
    desc: '오메가-3·아연 보강. 가려움/병변 지속 시 알레르기·감염 감별 — 수의사 진료 권장.',
    severity: 'high',
  },
  CONSTIPATION: {
    label: '변비 신호',
    desc: '수분·불용성 섬유 ↑. 지속 시 수의사 점검.',
    severity: 'info',
  },
  LOOSE_STOOL: {
    label: '무른 변',
    desc: '가용성 섬유 + 프로바이오틱스. 점진 전환 권장.',
    severity: 'info',
  },
  DIARRHEA: {
    label: '설사',
    desc: '탈수 주의 — 24시간 지속 또는 혈변이면 즉시 수의사 진료.',
    severity: 'high',
  },
  // 급여 안전·신뢰도 (v2.1) — 간식 차감 / 신뢰도 보수 보정.
  TREAT_LOAD_DAILY: {
    label: '매일 간식 — 비만 주의',
    desc: '간식 칼로리만큼 밥을 줄였어요. 간식은 하루 칼로리의 10% 이내로 유지하세요.',
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
