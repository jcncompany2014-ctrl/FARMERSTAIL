// B11 — 견별 지출 트래커 (app-only).
// 사료/병원/용품 카테고리별 합계 + 월별 추이.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/expenses`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) redirect('/dogs')

  return (
    <main className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <Link
          href={`/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          {dog.name as string}
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">Expenses</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            지출 트래커
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            {dog.name as string}와 함께 쓰는 비용을 기록하고 흐름을 봐요
          </p>
        </div>
      </div>
      <ExpensesClient dogId={dogId} />
    </main>
  )
}
