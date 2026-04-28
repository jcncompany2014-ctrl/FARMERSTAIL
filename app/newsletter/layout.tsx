import AuthAwareShell from '@/components/AuthAwareShell'

export default function NewsletterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
