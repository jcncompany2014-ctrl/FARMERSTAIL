import type { Metadata } from 'next'

/**
 * 새 비밀번호 설정 — 화면(page.tsx)이 클라이언트 부품이라 제목은 여기서 단다. 예전엔 묶음 기본값 '로그인 · 회원가입'으로 떴다
 * (2026-10-10 웹 리뉴얼 점검). 색인 막기는 (auth) 묶음 틀이 이미 한다.
 */
export const metadata: Metadata = { title: '새 비밀번호 설정' }

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
