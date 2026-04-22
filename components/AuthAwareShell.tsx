import { createClient } from '@/lib/supabase/server'
import AppChrome from '@/components/AppChrome'
import PublicPageShell from '@/components/PublicPageShell'

/**
 * Picks the right chrome based on whether the visitor is signed in.
 *
 * - Signed in → <AppChrome>: sticky header + cart badge + bottom tab bar +
 *   InstallPrompt. The dense, task-oriented "installed PWA" feel.
 * - Anonymous → <PublicPageShell>: back-link + SiteFooter only. The thin
 *   editorial wrapper we already use for /legal, /business, /blog — keeps
 *   marketing pages feeling like web content rather than app screens.
 *
 * Server component on purpose: auth state is read off the session cookie
 * before the page streams, which keeps the user from seeing the wrong
 * chrome flash on first paint. Use this for any route that genuinely
 * serves both audiences (e.g. /products). Routes that are always
 * auth-gated should stay under app/(main)/; routes that are always public
 * should use PublicPageShell directly.
 */
export default async function AuthAwareShell({
  children,
  publicBackHref = '/',
  publicBackLabel = '홈',
}: {
  children: React.ReactNode
  /** Back-link target when rendered in public/editorial mode. */
  publicBackHref?: string
  /** Back-link label when rendered in public/editorial mode. */
  publicBackLabel?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return <AppChrome>{children}</AppChrome>
  }

  return (
    <PublicPageShell backHref={publicBackHref} backLabel={publicBackLabel}>
      {children}
    </PublicPageShell>
  )
}
