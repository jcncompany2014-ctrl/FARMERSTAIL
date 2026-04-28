import AuthAwareShell from '@/components/AuthAwareShell'

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
