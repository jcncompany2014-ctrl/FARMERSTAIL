import { isAppContextServer } from '@/lib/app-context'
import StoreInAppNotice from './StoreInAppNotice'

/**
 * 웹 가게(/store/*) — 웹 전용. 앱은 단품을 팔지 않는다(웹 리뉴얼 기획서 §2 · 웹/앱 절대 분리).
 *
 * 앱 안에서 상점 주소가 열리면(알림·외부 링크·앱 링크) 가게 화면 대신 "가게는 웹에서 열려요" 안내를 띄우고 폰 브라우저로
 * 넘긴다(2026-10-13, 규칙205). 예전엔 앱 홈(/dashboard)으로 바로 돌려보냈는데, 안드로이드 14 이하는 앱 링크 제외
 * (매니페스트 uri-relative-filter-group — 안드로이드 15 부터, 규칙204)가 안 먹어 앱이 깔린 폰에서 가게 링크를 누른 손님이
 * 가게로 갈 길이 없었다. 안내 화면도 앱 모양이다 — 웹 가게 화면이 앱에 보이지 않는다.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  if (await isAppContextServer()) return <StoreInAppNotice />
  return children
}
