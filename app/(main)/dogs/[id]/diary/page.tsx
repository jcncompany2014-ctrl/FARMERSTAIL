import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DiaryClient from './DiaryClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '사진 일기',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

/**
 * /dogs/[id]/diary — 사진 일기 list + 새 entry.
 *
 * 매일 들르는 행동을 만드는 surface — 사진 1-5장 + 짧은 메모.
 * RLS 가 user_id 매칭으로 자기 일기만 조회.
 */
export default async function DiaryPage({ params }: { params: Params }) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/diary`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) notFound()

  const { data: entries } = await supabase
    .from('dog_diary')
    .select('id, photo_urls, note, mood, created_at')
    .eq('dog_id', dogId)
    .order('created_at', { ascending: false })
    .limit(60)

  type Entry = {
    id: string
    photo_urls: string[]
    note: string | null
    mood: number | null
    created_at: string
  }

  return (
    <DiaryClient
      dogId={dog.id}
      dogName={dog.name}
      initialEntries={(entries ?? []) as Entry[]}
    />
  )
}
