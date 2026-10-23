import type { Metadata } from 'next'
import WebNotFound from '@/components/store/WebNotFound'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: { index: false, follow: false },
}

/**
 * /store 아래 없는 주소(예: /store/xyz) — 2026-10-22 하얀 빈 화면이던 것(루트 not-found 가 미리 만든 상품 페이지 안에서 요청 머리를 읽다 실패).
 * 앱은 store/layout 이 먼저 '가게는 웹에서 열려요'로 걸러 내므로 여기는 웹 화면만 그린다 — 요청 머리를 읽지 않는다.
 */
export default function StoreNotFound() {
  return <WebNotFound />
}
