import { redirect } from 'next/navigation'

// 2026-07-16 — 알림 3종을 /notifications 한 페이지(탭)로 통합(사장님). '광고 수신' 탭으로.
// 동의 UI 는 ConsentSettingsClient(재사용) → AlertsClient 가 렌더.
export default async function ConsentRedirect() {
  redirect('/notifications?tab=consent')
}
