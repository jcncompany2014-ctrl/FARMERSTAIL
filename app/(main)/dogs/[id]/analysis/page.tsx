'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Analysis = {
  id: string
  mer: number
  rer: number
  factor: number
  stage: string
  bcs_label: string
  protein_pct: number
  protein_g: number
  fat_pct: number
  fat_g: number
  carb_pct: number
  carb_g: number
  fiber_pct: number
  fiber_g: number
  feed_g: number
  ca_p_ratio: number
  supplements: string[]
  created_at: string
}

type Dog = { id: string; name: string }

export default function AnalysisPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const dogId = params.id as string

  const [dog, setDog] = useState<Dog | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: dogData } = await supabase
        .from('dogs').select('id, name').eq('id', dogId).single()
      if (!dogData) { router.push('/dogs'); return }
      setDog(dogData)

      const { data: analysisData } = await supabase
        .from('analyses').select('*').eq('dog_id', dogId)
        .order('created_at', { ascending: false }).limit(1).single()

      if (analysisData) setAnalysis(analysisData)
      setLoading(false)
    }
    load()
  }, [dogId, router, supabase])

  if (loading) return <main className="flex items-center justify-center min-h-[80vh]"><div className="text-[#8A7668]">로딩 중...</div></main>

  if (!analysis || !dog) {
    return (
      <main className="px-6 py-10 max-w-md mx-auto">
        <Link href={`/dogs/${dogId}`} className="text-sm text-[#8A7668]">← 돌아가기</Link>
        <div className="mt-8 text-center bg-white rounded-2xl border-2 border-dashed border-[#D8CCBA] p-10">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="font-bold text-[#3D2B1F] mb-2">분석 결과가 없어요</h3>
          <Link href={`/dogs/${dogId}/survey`} className="inline-block mt-4 px-6 py-3 bg-[#A0452E] text-white rounded-xl font-bold border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118]">
            설문 시작하기
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="px-6 py-6">
      <div className="max-w-md mx-auto">
        <Link href={`/dogs/${dogId}`} className="text-sm text-[#8A7668]">← {dog.name}</Link>

        {/* Hero */}
        <div className="text-center mt-6 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6B7F3A] text-white text-[10px] font-bold tracking-wider uppercase mb-3">
            ✅ AAFCO 2024 기준 충족
          </div>
          <h1 className="text-2xl font-black text-[#3D2B1F] tracking-tight leading-tight">
            {dog.name} 맞춤 영양 분석
          </h1>
        </div>

        {/* Energy card */}
        <div className="bg-white rounded-2xl border-2 border-[#2A2118] p-6 shadow-[4px_4px_0_#8BA05A] mb-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-bold text-[#8A7668] uppercase tracking-wider">일일 에너지 (MER)</div>
              <div className="text-4xl font-black text-[#A0452E] tracking-tight leading-none mt-1">
                {analysis.mer.toLocaleString()}
                <span className="text-sm text-[#8A7668] ml-1">kcal</span>
              </div>
            </div>
            <div className="text-right text-[9px] text-[#6B7F3A] font-semibold leading-tight">
              RER {analysis.rer}<br />× {analysis.factor}<br />
              <span className="text-[8px]">NRC 2006</span>
            </div>
          </div>
          <hr className="my-4 border-t border-dashed border-[#D8CCBA]" />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="급여량/일" value={`${analysis.feed_g}g`} />
            <Stat label="끼니당" value={`${Math.round(analysis.mer / 2)} kcal`} />
            <Stat label="체형" value={analysis.bcs_label} />
            <Stat label="생애주기" value={analysis.stage} />
          </div>
        </div>

        {/* 영양 비율 */}
        <div className="bg-white rounded-2xl border-2 border-[#2A2118] p-6 shadow-[4px_4px_0_#D4B872] mb-3">
          <div className="text-xs font-black text-[#3D2B1F] mb-1">🧪 영양소 구성</div>
          <div className="text-[10px] text-[#6B7F3A] font-semibold mb-4">AAFCO 프로파일 기준</div>
          <Bar label="🍖 단백질" pct={analysis.protein_pct} g={analysis.protein_g} color="from-[#A0452E] to-[#C0654E]" />
          <Bar label="🥑 지방" pct={analysis.fat_pct} g={analysis.fat_g} color="from-[#D4B872] to-[#E0C88A]" />
          <Bar label="🌾 탄수화물" pct={analysis.carb_pct} g={analysis.carb_g} color="from-[#6B7F3A] to-[#8BA05A]" />
          <Bar label="🥦 식이섬유" pct={analysis.fiber_pct * 3} g={analysis.fiber_g} color="from-[#8A7668] to-[#A89888]" realPct={analysis.fiber_pct} />
        </div>

        {/* 보충제 */}
        {analysis.supplements && analysis.supplements.length > 0 && (
          <div className="bg-[rgba(107,127,58,0.04)] rounded-2xl border-2 border-[#6B7F3A] p-5 mb-3">
            <div className="text-xs font-black text-[#6B7F3A] mb-3">💊 {dog.name} 맞춤 보충제</div>
            <ul className="space-y-1.5">
              {analysis.supplements.map((s, i) => (
                <li key={i} className="text-xs text-[#5C4A3A]">• <strong className="text-[#3D2B1F]">{s}</strong></li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="mt-6 space-y-2">
          <Link href="/products" className="block w-full py-4 text-center rounded-xl bg-[#A0452E] text-white font-bold border-2 border-[#2A2118] shadow-[4px_4px_0_#2A2118] hover:-translate-y-0.5 transition-all">
            {dog.name} 맞춤 체험팩 주문하기 →
          </Link>
          <Link href={`/dogs/${dogId}/survey`} className="block w-full py-3 text-center rounded-xl bg-transparent text-[#8A7668] font-bold text-sm border-2 border-[#D8CCBA] hover:border-[#3D2B1F]">
            다시 분석하기
          </Link>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-[#8A7668] font-bold uppercase tracking-wide">{label}</div>
      <div className="text-sm font-black text-[#3D2B1F] mt-0.5">{value}</div>
    </div>
  )
}

function Bar({ label, pct, g, color, realPct }: { label: string; pct: number; g: number; color: string; realPct?: number }) {
  const displayPct = realPct ?? pct
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold text-[#3D2B1F]">{label}</span>
        <span className="text-xs font-black text-[#A0452E]">{displayPct}%</span>
      </div>
      <div className="h-2 bg-[#EDE6D8] rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="text-[9px] text-[#8A7668] mt-1">{g}g/일</div>
    </div>
  )
}