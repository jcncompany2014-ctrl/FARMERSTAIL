// B-66 / P20 — 시계열 진행 사진 갤러리 + 업로드 페이지.
//
// # 비활성 상태 (2026-05-16)
// 사용자 결정으로 진입점 차단. 페이지 진입 시 dog detail 로 server redirect.
// PhotosClient.tsx / API route / storage lib / 마이그레이션 모두 보존 —
// 재활성 시 이 파일을 git commit 839ae01 의 page.tsx 본체로 되돌리고
// DiaryClient.tsx 의 진입 Link 만 복원하면 즉시 부활.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// PhotosClient.tsx 가 이 type 을 import 하므로 export 유지 (compile 호환).
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
  redirect(`/dogs/${dogId}`)
}
