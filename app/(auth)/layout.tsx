import type { Metadata } from 'next'

/**
 * /login · /signup 등 pre-auth 화면의 공통 메타데이터.
 *
 * 이 그룹은 크롤러가 직접 색인할 필요가 없다 — robots.txt 로도 막고 있지만
 * 악성 크롤러 / 스크래퍼가 robots 를 무시하는 경우에 대비해 inline noindex 를
 * 겹쳐 둔다. 페이지별 title 은 각 page.tsx 에서 `export const metadata` 로
 * 추가 세팅 가능 (아래 template 이 자동으로 " | 파머스테일" 을 붙인다).
 *
 * 단, login / signup 은 client component 라 page 단에서 metadata 를 달 수
 * 없다 — default title 을 여기서 합리적 값으로 잡아 둠.
 */
export const metadata: Metadata = {
  title: {
    default: '로그인 · 회원가입',
    template: '%s | 파머스테일',
  },
  robots: { index: false, follow: true, nocache: true },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
