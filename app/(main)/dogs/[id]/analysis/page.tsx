// audit #100: 이전엔 page.tsx 가 client component + useParams() 후 자식
// AnalysisView 로 dogId 전달. server 에서 params 만 받아 props drill — JS hydration
// 비용 ~5KB 절감 + useParams hook 제거.
//
// 데이터 fetch (dog/analysis/history) 는 여전히 AnalysisView client 에서 처리.
// 완전한 RSC 전환 (서버 prefetch + Suspense) 은 별도 sprint — AnalysisView 가
// useState/useToast/useEffect 등 client 의존 많음.
import AnalysisView from './AnalysisView'

export default async function AnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; days?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  // R80-P1: survey 페이지에서 30일 가드로 redirect 된 경우 안내 메시지 prop.
  const surveyBlockedDays =
    sp.from === 'survey_blocked' && sp.days
      ? Number.isFinite(Number(sp.days))
        ? Math.max(1, Math.min(30, Number(sp.days)))
        : null
      : null
  return <AnalysisView dogId={id} surveyBlockedDays={surveyBlockedDays} />
}
