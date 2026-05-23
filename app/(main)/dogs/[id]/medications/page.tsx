// B10 — 복약 관리 페이지 (app-only).
// 시간 / 주기 / 리마인더 기록. localStorage 기반 시작 후 DB migration.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import MedicationsClient from './MedicationsClient'

export default async function MedicationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/medications`)

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
          <span className="kicker inline-block">Medications</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            복약 관리
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            {dog.name as string}의 약물·영양제 시간과 복용 기록
          </p>
        </div>
      </div>
      <MedicationsClient dogId={dogId} />
    </main>
  )
}
