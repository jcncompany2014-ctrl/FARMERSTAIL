import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import AlgorithmConfigClient from './AlgorithmConfigClient'

export const dynamic = 'force-dynamic'

/**
 * /admin/algorithm — 알고리즘 데이터 admin GUI.
 *
 * 5종 화식 라인의 영양 단면 (kcal / protein / fat / Ca / P / Na) 과 만성질환별
 * 진단 강도를 GUI 로 편집. lines.ts 의 hardcoded 값을 DB-backed override 로
 * 옮긴 시스템.
 *
 * # 배경
 * v1.3 까지는 batch 영양 분석 결과가 바뀌면 코드 push 필요. v1.4+ 부터는
 * 운영자가 GUI 로 즉시 갱신 → 다음 cycle compute 부터 자동 반영.
 *
 * # 안전망
 * algorithm_food_lines 가 비어있으면 알고리즘은 lines.ts 기본값으로 fallback.
 * 즉 이 페이지에서 실수로 row 삭제해도 zero-downtime.
 */
export default async function AdminAlgorithmPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/algorithm')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const [{ data: foodLines }, { data: chronicSeverity }] = await Promise.all([
    supabase
      .from('algorithm_food_lines')
      .select('*')
      .order('line'),
    supabase
      .from('algorithm_chronic_severity')
      .select('*')
      .order('condition'),
  ])

  return (
    <main className="px-5 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span
            className="text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: 'var(--terracotta)' }}
          >
            Admin · Algorithm Config
          </span>
          <h1
            className="font-serif mt-1"
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            알고리즘 데이터 편집
          </h1>
          <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
            라인별 영양 단면과 만성질환 진단 강도를 GUI 로 편집해요. 저장
            즉시 다음 cycle compute 부터 반영돼요.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 items-end">
          <Link
            href="/admin/personalization"
            className="text-[11px] text-muted hover:text-terracotta"
          >
            ← Simulator
          </Link>
          <Link href="/admin" className="text-[11px] text-muted hover:text-text">
            Admin home
          </Link>
        </div>
      </div>

      <AlgorithmConfigClient
        initialFoodLines={(foodLines ?? []) as FoodLineRow[]}
        initialChronic={(chronicSeverity ?? []) as ChronicRow[]}
      />
    </main>
  )
}

export type FoodLineRow = {
  line: 'basic' | 'weight' | 'skin' | 'premium' | 'joint'
  kcal_per_100g: number
  protein_pct_dm: number
  fat_pct_dm: number
  calcium_pct_dm: number | null
  phosphorus_pct_dm: number | null
  sodium_pct_dm: number | null
  subtitle_override: string | null
  benefit_override: string | null
  updated_at: string
}

export type ChronicRow = {
  condition: string
  korean_label: string
  default_severity: 'mild' | 'moderate' | 'severe'
  protein_factor: number
  fat_factor: number
  notes: string | null
  updated_at: string
}
