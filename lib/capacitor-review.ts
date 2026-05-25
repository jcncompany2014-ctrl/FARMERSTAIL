/**
 * Capacitor in-app review (R17-E43).
 *
 * native (iOS/Android) 에서 앱스토어 평가 prompt 호출. Web 에선 no-op.
 *
 * 도입 필요 패키지:
 *   @capacitor-community/in-app-review
 *
 * # 호출 정책
 *
 * Apple HIG / Google Play 권장:
 *   - 사용자의 가장 긍정적인 순간에 1회 (마일스톤 도달 / streak 7+ / 정기배송 만족 응답 후)
 *   - 자체 cool-down 으로 N개월 안 재호출 (시스템도 자체 제한 있음)
 *
 * # 사용
 *
 *   if (canPromptReview()) {
 *     await requestReview()
 *     markReviewPrompted()
 *   }
 */

import { isNativeApp } from './capacitor'

const isCapacitorNative = isNativeApp

const STORAGE_KEY = 'ft:review-prompted'
const COOLDOWN_DAYS = 90

export function canPromptReview(): boolean {
  if (!isCapacitorNative()) return false
  if (typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return true
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return true
    return Date.now() - ts > COOLDOWN_DAYS * 24 * 3600 * 1000
  } catch {
    return false
  }
}

export function markReviewPrompted(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    /* noop */
  }
}

export async function requestReview(): Promise<boolean> {
  if (!isCapacitorNative()) return false
  try {
    // dynamic require — 미설치 패키지 typed import 우회.
    const mod = (await import(
      /* webpackIgnore: true */ '@capacitor-community/in-app-review' as string
    ).catch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => null,
    )) as { InAppReview?: { requestReview: () => Promise<void> } } | null
    if (!mod?.InAppReview) return false
    await mod.InAppReview.requestReview()
    return true
  } catch (e) {
    console.error('in-app review', e)
    return false
  }
}
