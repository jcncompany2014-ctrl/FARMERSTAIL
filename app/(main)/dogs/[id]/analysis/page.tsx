'use client'

import { useParams } from 'next/navigation'
import AnalysisView from './AnalysisView'

export default function AnalysisPage() {
  const params = useParams()
  const dogId = params.id as string
  return <AnalysisView dogId={dogId} />
}
