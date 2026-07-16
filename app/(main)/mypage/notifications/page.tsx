import { redirect } from 'next/navigation'

// 2026-07-16 — 알림 3종을 /notifications 한 페이지(탭)로 통합(사장님). '알림 설정' 탭으로.
// 설정 UI 는 NotificationSettingsClient(재사용) → AlertsClient 가 렌더.
export default async function NotificationSettingsRedirect() {
  redirect('/notifications?tab=push')
}
