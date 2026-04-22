import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RemindersClient, { type Reminder } from './RemindersClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '리마인더',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

export default async function RemindersPage({ params }: { params: Params }) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/reminders`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) notFound()

  const { data: reminders } = await supabase
    .from('dog_reminders')
    .select(
      'id, type, title, notes, next_date, recur_interval_days, last_done_date, enabled, created_at'
    )
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('next_date', { ascending: true })

  return (
    <RemindersClient
      dogId={dog.id}
      dogName={dog.name}
      initial={(reminders ?? []) as Reminder[]}
    />
  )
}
