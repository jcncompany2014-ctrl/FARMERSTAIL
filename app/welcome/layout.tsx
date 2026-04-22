import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '환영합니다',
  // Onboarding is a first-launch intercept, not discoverable content — keep
  // crawlers out so nobody lands here from a search result out of context.
  robots: { index: false, follow: false },
}

/**
 * Minimal shell for the onboarding slides.
 *
 * Deliberately omits the marketing header, bottom tab bar, and auth guard —
 * the onboarding is pre-auth and consumes the full viewport. Centered mobile
 * column on desktop matches the rest of the app's layout grammar.
 */
export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#2a241b',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          // Hard 100svh (small-viewport) so the onboarding carousel has a
          // fixed scroll-snap container even when the mobile URL bar is
          // visible. `svh` matches the iOS safe-area the design was drawn
          // against; plain `vh` would jump as the URL bar collapses.
          height: '100svh',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
