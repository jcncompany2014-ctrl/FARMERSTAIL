import { redirect } from 'next/navigation'
import { isAppContextServer } from '@/lib/app-context'

/**
 * 웹 가게(/store/*) — 웹 전용. 앱은 단품을 팔지 않는다(웹 리뉴얼 기획서 §2 · 웹/앱 절대 분리):
 * 앱 안에서 상점 주소가 열리면(알림·외부 링크 등) 앱 홈으로 보낸다. /app 화면과 같은 처리.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  if (await isAppContextServer()) redirect('/dashboard')
  return children
}
