import AuthAwareShell from '@/components/AuthAwareShell'

/**
 * /products is the one route that legitimately serves both audiences:
 *   - Unauth visitors browsing the catalog as marketing content
 *   - Signed-in users shopping inside the installed PWA
 *
 * The AuthAwareShell picks the right wrapper on the server. Content pages
 * below stay audience-agnostic — add-to-cart / wishlist logic inside
 * ProductDetailClient already handles the unauth case by redirecting to
 * /login, so we don't need separate views yet.
 *
 * When marketing copy + photography lands per product, the unauth view
 * can graduate to a magazine-style editorial layout; for now, both
 * audiences see the same grid / detail, just framed by different chrome.
 */
export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
