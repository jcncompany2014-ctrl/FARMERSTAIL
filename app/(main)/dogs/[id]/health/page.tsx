import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HealthLogClient, { type HealthLog } from './HealthLogClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '건강 일지',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

export default async function HealthLogPage({ params }: { params: Params }) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/health`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) notFound()

  // last 30 days
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString().slice(0, 10)
  const { data: logs } = await supabase
    .from('health_logs')
    .select(
      'id, logged_at, poop_quality, poop_count, activity_level, mood, appetite, note, created_at'
    )
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .gte('logged_at', sinceIso)
    .order('logged_at', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <HealthLogClient
      dogId={dog.id}
      dogName={dog.name}
      initialLogs={(logs ?? []) as HealthLog[]}
    />
  )
}
