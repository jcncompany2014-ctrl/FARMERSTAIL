import Onboarding from '@/components/Onboarding'

/**
 * First-launch onboarding. The standalone-mode PWA gate
 * (`components/OnboardingGate.tsx`) redirects installed-app visitors here
 * once; after the final slide's CTA fires, we mark
 * `localStorage['ft_onboarded']` and navigate to /signup or /login.
 *
 * The actual slideshow is a client component — this page is intentionally
 * thin so the route stays a server component and Next can prerender the
 * shell. The completion wiring (markOnboarded + router.replace) lives
 * inside <Onboarding /> so all state transitions are co-located with the
 * slide that triggers them.
 */
export default function WelcomePage() {
  return <Onboarding />
}
