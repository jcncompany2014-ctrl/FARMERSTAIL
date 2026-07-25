/**
 * 자동작업(cron) 경로 → 사람이 읽는 이름.
 *
 * # 왜 (2026-07-26 사장님 지적)
 * 자동작업 상태 화면이 `/api/cron/subscription-charge` 같은 **경로를 그대로**
 * 찍고 있었다. 사장님은 이걸 보고 무슨 작업이 실패했는지 알 수 없다.
 * "cron", "path" 같은 개발자 용어를 어드민 화면에 그대로 내보내지 않는다는
 * 규칙(MASTER_WORK_PLAN §0-4)의 일부다.
 *
 * # 규칙
 * 새 크론을 추가하면 **여기에도 한 줄 추가**할 것. 없으면 화면이 경로를
 * 그대로 보여주므로 빠뜨린 게 눈에 띈다(조용히 깨지지 않는다).
 */

/** 경로 끝 세그먼트(= 크론 이름) → 한국어 이름. */
const CRON_LABEL: Record<string, string> = {
  // 돈 — 제일 중요
  'subscription-charge': '정기배송 자동결제',
  'refund-retry': '환불 재시도',
  'payment-ledger-reconcile': '결제 장부 대조',
  'order-expire': '미결제 주문 자동 만료',

  // 배송·구독
  'subscription-reminders': '배송 전 안내 알림',
  'subscription-cleanup': '구독 정리',
  'tracking-poll': '배송 추적 조회',

  // 맞춤 추천
  'personalization-progression': '다음 박스 레시피 재제안',
  'personalization-approval-timeout': '레시피 승인 기한 마감',
  'reanalyze-trigger': '재분석 시작',
  'reanalysis-reminder-6m': '6개월 재분석 안내',
  'protein-rotation': '단백질 로테이션 점검',
  'meta-weights': '추천 가중치 학습',
  'sensitivity-snapshots': '민감도 기록 저장',

  // 강아지 건강
  'dog-age-update': '강아지 나이 갱신',
  'weight-reminder': '체중 기록 안내',
  'weight-change-detect': '체중 변화 감지',
  'dcm-screening-reminder': '심장 관련 정기 안내',
  'quality-check-reminder': '급여 상태 확인 안내',
  'first-box-checkin': '첫 박스 후기 요청',
  'intervention-alerts': '이상 징후 알림',

  // 운영·리포트
  'daily-briefing': '아침 운영 브리핑',
  'ops-digest': '운영 요약 메일',
  'quarterly-report': '분기 리포트',
  'inventory-forecast': '재고 예측',
  'onboarding-funnel': '가입 퍼널 집계',

  // 회원·리워드
  'account-purge': '탈퇴 계정 정리',
  'stamps-expire': '도장 만료 처리',
  'push-lifecycle': '알림 발송 주기 관리',
}

/**
 * `/api/cron/subscription-charge` · `subscription-charge` 둘 다 받는다.
 * 모르는 값이면 **원본을 그대로 돌려준다** — 빠진 걸 화면에서 바로 알아채라고.
 */
export function cronLabel(path: string | null | undefined): string {
  if (!path) return '(이름 없음)'
  const key = path.replace(/\/+$/, '').split('/').pop() ?? path
  return CRON_LABEL[key] ?? path
}

/** 라벨이 등록돼 있는지 — 등록 안 된 건 화면에서 경로를 그대로 보여준다. */
export function hasCronLabel(path: string | null | undefined): boolean {
  if (!path) return false
  const key = path.replace(/\/+$/, '').split('/').pop() ?? path
  return key in CRON_LABEL
}
