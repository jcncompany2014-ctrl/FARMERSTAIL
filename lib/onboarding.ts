/**
 * Onboarding state — persisted in localStorage so the PWA's first-launch
 * slideshow plays exactly once per device.
 *
 * Consumed by:
 *   - components/OnboardingGate.tsx (reads the flag to decide whether to redirect)
 *   - app/welcome/page.tsx           (writes the flag on complete / skip)
 *
 * Clearing site data wipes the flag, which is the intended "reset" UX.
 */

export const ONBOARDING_FLAG = 'ft_onboarded'

/**
 * True when the user has completed or skipped onboarding on this device.
 *
 * Fails safe to `true` on the server and when localStorage is unavailable
 * (private mode, storage quota blown): we would rather a user miss onboarding
 * than get trapped in a redirect loop.
 */
export function hasSeenOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return Boolean(window.localStorage.getItem(ONBOARDING_FLAG))
  } catch {
    return true
  }
}

export function markOnboarded() {
  if (typeof window === 'undefined') return
  try {
    // Store the timestamp so we could reset old onboardings later if the flow
    // gets a major redesign. A plain "1" would work but is less forgiving.
    window.localStorage.setItem(ONBOARDING_FLAG, String(Date.now()))
  } catch {
    /* noop — private mode. Proceed without persistence. */
  }
}
