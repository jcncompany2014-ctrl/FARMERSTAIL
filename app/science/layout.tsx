import AuthAwareShell from '@/components/AuthAwareShell'

// /science 는 형제 에디토리얼 페이지(/brand·/about·/partners 등)와 달리 layout
// 이 없어 헤더/카테고리 네비/푸터(사업자정보) 없이 floating 컬럼으로 렌더됐다.
// /brand/layout 과 동일하게 WebChrome 으로 감싸 전역 chrome 을 복원한다.
export default function ScienceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
