import { redirect } from 'next/navigation'

// 2026-07-16 — /health-care 통합(사장님). 리마인더 탭으로 리다이렉트만.
// 목록/추가/markDone UI 는 RemindersClient(재사용) → HealthCareClient 가 렌더
// (initial 리마인더는 health-care/page.tsx 가 prefetch).
export default async function RemindersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dogs/${id}/health-care?tab=reminders`)
}
