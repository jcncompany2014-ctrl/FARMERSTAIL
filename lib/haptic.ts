/**
 * haptic.ts — 짧은 진동 피드백.
 *
 * 모바일에서 사용자 액션 (저장 / 응답 / 선택) 에 미세한 진동으로 즉각
 * 피드백. Web Vibration API (navigator.vibrate) 사용 — Android Chrome 지원.
 * iOS Safari 는 Web 에서 진동 API 미지원 → noop, 정상 흐름 유지.
 *
 * # 강도
 *  - tap: 10ms — chip 선택, 작은 토글
 *  - tick: 25ms — 단계 전환, 슬라이더 step 단위
 *  - confirm: 50ms — 저장 / 동의 / 응답 완료
 *  - warn: [60, 40, 60] 패턴 — 에러 / 차단
 *
 * # 사용
 *  ```typescript
 *  import { haptic } from '@/lib/haptic'
 *  haptic('confirm') // 저장 완료
 *  haptic('warn')    // 알레르기 라인 차단 시도
 *  ```
 */

export type HapticKind = 'tap' | 'tick' | 'confirm' | 'warn'

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  tick: 25,
  confirm: 50,
  warn: [60, 40, 60],
}

export function haptic(kind: HapticKind = 'tap'): void {
  if (typeof window === 'undefined') return
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(PATTERNS[kind])
  } catch {
    // 일부 환경 (미디어 오토플레이 정책 등) 에서 throw — 조용히 무시.
  }
}
