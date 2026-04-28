import AuthAwareShell from '@/components/AuthAwareShell'

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
