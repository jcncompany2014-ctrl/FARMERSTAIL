import AuthAwareShell from '@/components/AuthAwareShell'

export default function PartnersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
