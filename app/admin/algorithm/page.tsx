import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import AlgorithmConfigClient from './AlgorithmConfigClient'
import { AdminTabs } from '@/components/admin/ui'
import { SETTINGS_TABS } from '@/components/admin/tabGroups'

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

  const [{ data: foodLines }, { data: chronicSeverity }, { data: breeds }] =
    await Promise.all([
      supabase.from('algorithm_food_lines').select('*').order('line'),
      supabase
        .from('algorithm_chronic_severity')
        .select('*')
        .order('condition'),
      supabase
        .from('algorithm_breed_predispose')
        .select('*')
        .order('korean_label'),
    ])

  return (
    <main className="px-5 py-6 max-w-4xl mx-auto">
      {/* 대개편 v2 T6 — 설정 그룹 탭 + 헤더 zinc 통일(serif·킥커 제거) */}
      <AdminTabs tabs={SETTINGS_TABS} active="/admin/algorithm" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
            알고리즘 계수
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1.5 leading-relaxed">
            맞춤 추천이 쓰는 계산 계수를 직접 손보는 고급 설정이에요 — 라인별
            영양 구성·질환 강도 등. 저장하면 다음 계산부터 바로 반영되니
            신중하게 바꿔주세요.
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
        initialBreeds={(breeds ?? []) as BreedRow[]}
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
  /** EPA+DHA 합산 % DM (AAFCO ≥0.1, ACVIM cardiac ≥0.3). */
  omega3_pct_dm: number | null
  /** omega-6 % DM (NRC ω-6:3 비율 5:1~10:1). */
  omega6_pct_dm: number | null
  /** vitamin D IU/100g DM (AAFCO 500-3000 IU/kg DM, large puppy 5000). */
  vitamin_d_iu_per_100g_dm: number | null
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

export type BreedRow = {
  breed_key: string
  korean_label: string
  breed_keywords: string[]
  predispose_conditions: string[]
  cautions: string[]
  citations: string[]
  enabled: boolean
  updated_at: string
}
