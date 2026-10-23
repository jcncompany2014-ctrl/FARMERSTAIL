import type { Metadata } from 'next'
import WebNotFound from '@/components/store/WebNotFound'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: { index: false, follow: false },
}

/**
 * /blog 아래 없는 글(예: /blog/xyz) — 2026-10-22 하얀 빈 화면이던 것. 매거진은 웹 화면이라 요청 머리를 읽지 않고 웹 안내를 그린다
 * (루트 not-found 의 앱/웹 판별이 미리 만든 글 페이지 안에서 실패해 본문 없는 오류 껍데기가 나갔다).
 */
export default function BlogNotFound() {
  return <WebNotFound />
}
