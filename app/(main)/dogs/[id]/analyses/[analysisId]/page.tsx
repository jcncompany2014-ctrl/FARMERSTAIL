'use client'

import { useParams } from 'next/navigation'
import AnalysisView from '../../analysis/AnalysisView'

export default function AnalysisDetailPage() {
  const params = useParams()
  const dogId = params.id as string
  const analysisId = params.analysisId as string
  return <AnalysisView dogId={dogId} analysisId={analysisId} />
}
