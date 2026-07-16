import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { petName } from '@/lib/korean'
import HealthCareClient from './HealthCareClient'
import { type Reminder } from '../reminders/RemindersClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '건강 관리',
  robots: { index: false, follow: false },
}

/**
 * 건강 관리 통합 페이지 — 복약 · 예방접종 · 리마인더 (2026-07-16).
 * 헤더는 여기서 한 번만 렌더하고, 세 기능은 HealthCareClient 의 탭이 담당한다.
 * ?tab= 로 딥링크(옛 /medications·/vaccinations·/reminders 가 여기로 리다이렉트).
 */
export default async function HealthCarePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id: dogId } = await params
  const { tab } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/health-care`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) notFound()

  // 리마인더는 server prefetch (RemindersClient 가 initial 을 받음). 복약·예방접종은
  // 각 클라이언트가 mount 시 자체 fetch(가벼움).
  const { data: reminders } = await supabase
    .from('dog_reminders')
    .select(
      'id, type, title, notes, next_date, recur_interval_days, last_done_date, enabled, created_at',
    )
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('next_date', { ascending: true })

  return (
    <>
      <section className="px-5 pt-6 pb-1">
        <span className="kicker mt-3 block">Health Care</span>
        <h1
          className="font-sans mt-1.5"
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          건강 관리
        </h1>
        <p className="text-[10.5px] text-muted mt-1">
          {petName(dog.name)}의 복약·예방접종·리마인더를 한곳에서
        </p>
      </section>

      <HealthCareClient
        dogId={dog.id}
        dogName={dog.name}
        initialReminders={(reminders ?? []) as Reminder[]}
        initialTab={tab}
      />
    </>
  )
}
