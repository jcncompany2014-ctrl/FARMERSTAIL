import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { diaryPhotoPath } from '@/lib/storage/diary-photo'
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

  // ★사진 URL 은 **조회 시점에 재서명**한다 (2026-08-19 5라운드 감사).
  //   DB 엔 스토리지 경로만 있고(신규) 또는 만료될 옛 signed URL 이 있는데
  //   (레거시), 둘 다 diaryPhotoPath 로 경로를 뽑아 짧은 TTL(1시간) signed URL 을
  //   새로 발급한다. 이래야 1년 뒤 사진이 통째로 깨지지 않는다(체크인 사진과 같은
  //   패턴). private 버킷이라 signed URL 이 없으면 애초에 못 연다.
  const rawEntries = (entries ?? []) as Entry[]
  const allPaths = Array.from(
    new Set(
      rawEntries.flatMap((e) => (e.photo_urls ?? []).map(diaryPhotoPath)),
    ),
  )
  const signedByPath = new Map<string, string>()
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('dog-diary-photos')
      .createSignedUrls(allPaths, 60 * 60)
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl)
    }
  }
  const initialEntries: Entry[] = rawEntries.map((e) => ({
    ...e,
    photo_urls: (e.photo_urls ?? []).map(
      (u) => signedByPath.get(diaryPhotoPath(u)) ?? u,
    ),
  }))

  return (
    <DiaryClient
      dogId={dog.id}
      dogName={dog.name}
      initialEntries={initialEntries}
    />
  )
}
