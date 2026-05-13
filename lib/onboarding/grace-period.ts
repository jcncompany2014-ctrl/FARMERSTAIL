/**
 * 첫 4주 보호 (grace period) — docs/voice-guidelines.md §6 정책.
 *
 * D2C 정기구독 첫 4주 이탈률이 전체 60%. 이 기간엔 시스템 정확도보다
 * 사용자 안전감 우선. 신뢰도 점수 노출 / 부정 정보 / 강한 권유 모두 보류.
 *
 * 단계
 * ────
 *   week 1 (0~7일)   : silent — 신뢰도 점수 비표시, 능동 개입 비활성
 *   week 2 (8~14일)  : check-in 1회 ("어땠어요?")
 *   week 3 (15~21일) : 옵션 권유만 ("더 정확하게 케어하고 싶다면...")
 *   week 4+ (22일~)  : 정상 노출 + 첫 추천 조정 (단 conservative -5% 안전)
 *
 * 사용
 * ────
 *   const phase = onboardingPhase(profile.created_at)
 *   if (phase === 'silent') return null  // 신뢰도 점수 숨김
 *   if (phase === 'conservative') applyAdjustment(-0.05)  // 안전 보정
 */

export type OnboardingPhase =
  | 'silent' // 0~7일 — 시스템이 아무 요구 안 함
  | 'gentle_checkin' // 8~14일 — 짧은 체크인 1회
  | 'optional_nudge' // 15~21일 — 옵션 권유만
  | 'conservative' // 22~28일 — 첫 조정 (안전 방향)
  | 'normal' // 29일+ — 정상 노출

/**
 * 가입 후 경과 일수에 따른 phase. KST 기준 days = floor((now - created) / 86400).
 */
export function onboardingPhase(
  createdAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
): OnboardingPhase {
  if (!createdAt) return 'normal' // 알 수 없으면 정상 노출 (보수적 X)
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  const days = Math.floor((nowMs - created.getTime()) / 86_400_000)
  if (days < 7) return 'silent'
  if (days < 14) return 'gentle_checkin'
  if (days < 21) return 'optional_nudge'
  if (days < 28) return 'conservative'
  return 'normal'
}

/**
 * 시스템 점수 (신뢰도 / 맞춤도) 를 사용자에게 노출할지.
 * silent / gentle_checkin 에선 숨김 — 4주차부터 노출.
 */
export function shouldShowAccuracyScore(phase: OnboardingPhase): boolean {
  return phase === 'normal' || phase === 'conservative'
}

/**
 * 첫 추천 조정 시 안전 보정 배수 (conservative 단계).
 * conservative 단계는 첫 조정이라 신뢰 정착이 우선 — -5% 만 줄임.
 * normal 단계는 시스템 권장값 그대로.
 */
export function recommendationSafetyFactor(phase: OnboardingPhase): number {
  return phase === 'conservative' ? 0.95 : 1.0
}

/**
 * 능동 개입 (push / NextActionCard) 활성 여부.
 * silent 단계에선 시스템이 견주에게 아무것도 요구 X.
 */
export function shouldShowProactiveNudge(phase: OnboardingPhase): boolean {
  return phase !== 'silent'
}
