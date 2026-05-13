import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PhotoUploadClient from './PhotoUploadClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '강아지 사진 보내주기',
  robots: { index: false, follow: false },
}

type Params = Promise<{ token: string }>

/**
 * /photo-upload/[token] — 익명 강아지 사진 업로드 페이지.
 *
 * 보호자가 친구에게 보낸 link 의 진입점. 친구가 강아지 사진 한 장 찍어
 * 올리면 자동으로 dog.photo_url 적용.
 */
export default async function PhotoUploadPage({ params }: { params: Params }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('fetch_photo_request', {
    p_token: token,
  })
  type RpcResult =
    | {
        ok: true
        dogName: string | null
        ownerName: string | null
        expiresAt: string
      }
    | { ok: false; error: string; message: string }
  const result = (data ?? {
    ok: false,
    error: 'unknown',
    message: '응답 없음',
  }) as RpcResult

  return <PhotoUploadClient token={token} initial={result} />
}
