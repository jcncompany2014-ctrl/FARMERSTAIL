import { redirect } from 'next/navigation'

// 2026-07-16 — /health-care 통합(사장님). 예방접종 탭으로 리다이렉트만.
// 목록/추가 UI 는 VaccinationsClient(재사용) → HealthCareClient 가 렌더.
export default async function VaccinationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dogs/${id}/health-care?tab=vaccinations`)
}
