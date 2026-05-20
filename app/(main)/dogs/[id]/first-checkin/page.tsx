// Phase 2 (2026-05-20): 첫 박스 7일 후 1문항 체크인 페이지.
// 기존 /checkin (personalization cycle) 과 분리해 명확한 entrypoint.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FirstCheckinClient from './FirstCheckinClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '첫 박스 한 주 어땠나요?',
  robots: { index: false, follow: false },
}

export default async function FirstCheckinPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dogs/${dogId}/first-checkin`)}`)
  }

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) redirect('/dogs')

  return <FirstCheckinClient dogId={dog.id} dogName={dog.name} userId={user.id} />
}
