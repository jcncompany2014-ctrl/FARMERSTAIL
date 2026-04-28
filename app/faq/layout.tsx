import AuthAwareShell from '@/components/AuthAwareShell'

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
