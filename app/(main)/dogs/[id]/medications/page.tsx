import { redirect } from 'next/navigation'

// 2026-07-16 — 복약·예방접종·리마인더를 /health-care 한 페이지로 통합(사장님).
// 이 경로는 해당 탭으로 리다이렉트만. 목록/추가 UI 는 MedicationsClient(재사용)에 있고
// HealthCareClient 가 렌더한다.
export default async function MedicationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dogs/${id}/health-care?tab=medications`)
}
