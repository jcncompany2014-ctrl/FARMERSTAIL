// B-66 / P20 — 시계열 진행 사진 갤러리 + 업로드 페이지.
//
// dog detail 패턴 그대로: server prefetch (auth + dog ownership + 최근 photos)
// 후 client 에 prop drill. 갤러리 그리드 + 업로드는 client interaction 필요.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signProgressPhotoUrl } from '@/lib/storage/progress-photos'
import PhotosClient from './PhotosClient'

export const dynamic = 'force-dynamic'

export type ProgressPhotoRow = {
  id: string
  photo_url: string
  taken_at: string | null
  view: 'side' | 'front' | 'top' | null
  note: string | null
  created_at: string
  signed_url: string | null
}

export default async function DogPhotosPage({
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
    redirect(`/login?next=/dogs/${dogId}/photos`)
  }

  // dog 소유 검증 + 이름 (페이지 헤더용).
  const { data: dogRow } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!dogRow) {
    redirect('/dogs')
  }
  const dog = dogRow as { id: string; name: string | null }

  // 최근 100건. taken_at 내림차순 (없으면 created_at 기준).
  const { data: photoRows } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            c: string,
            v: string,
          ) => {
            eq: (
              c: string,
              v: string,
            ) => {
              order: (
                c: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data:
                    | Array<{
                        id: string
                        photo_url: string
                        taken_at: string | null
                        view: 'side' | 'front' | 'top' | null
                        note: string | null
                        created_at: string
                      }>
                    | null
                }>
              }
            }
          }
        }
      }
    }
  )
    .from('dog_progress_photos')
    .select('id, photo_url, taken_at, view, note, created_at')
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('taken_at', { ascending: false })
    .limit(100)

  // signed URL 5분 — 첫 페인트용. client 에서 만료되면 GET API 로 refresh.
  const rows = photoRows ?? []
  const initialPhotos: ProgressPhotoRow[] = await Promise.all(
    rows.map(async (r) => {
      const isPath = !/^https?:\/\//.test(r.photo_url)
      const signedUrl = isPath
        ? await signProgressPhotoUrl(supabase, r.photo_url)
        : r.photo_url
      return { ...r, signed_url: signedUrl }
    }),
  )

  return (
    <PhotosClient
      dogId={dogId}
      dogName={dog.name}
      userId={user.id}
      initialPhotos={initialPhotos}
    />
  )
}
