import AuthAwareShell from '@/components/AuthAwareShell'

/**
 * /collections — 큐레이션 컬렉션 라우트.
 * 카탈로그와 같이 WebChrome 으로 감싼다 (앱 컨텍스트에서도 동일 chrome).
 */
export default function CollectionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
