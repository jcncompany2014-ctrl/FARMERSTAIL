import { isAppContextServer } from '@/lib/app-context'
import LinkInAppNotice from './LinkInAppNotice'

/**
 * 링크 모음(/link) — 인스타 프로필 링크라 웹 전용이다. 앱 안에서 이 주소가 열리면(안드로이드 14 이하 앱 링크 — 매니페스트 제외는
 * 15 부터, 규칙204) 웹 화면 대신 "링크 모음은 웹에서 열려요" 안내를 띄우고 폰 브라우저로 넘긴다(2026-10-14, 규칙235).
 * 가게(app/store/layout, 규칙205)와 같은 모양. 웹은 그대로 화면을 그린다.
 */
export default async function LinkLayout({ children }: { children: React.ReactNode }) {
  if (await isAppContextServer()) return <LinkInAppNotice />
  return children
}
