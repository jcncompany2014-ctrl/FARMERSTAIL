// audit #101 — /dogs/[id]/analyses/[analysisId] server wrapper. 이전 client
// useParams() 만 쓰던 thin wrapper → server params Promise 로. fetch 는 여전히
// AnalysisView client (analysis/[id] 페이지와 같은 패턴 — audit #100).
import AnalysisView from '../../analysis/AnalysisView'

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string; analysisId: string }>
}) {
  const { id: dogId, analysisId } = await params
  return <AnalysisView dogId={dogId} analysisId={analysisId} />
}
