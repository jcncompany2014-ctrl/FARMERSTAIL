import type { SupabaseClient } from '@supabase/supabase-js'

export const DOG_AVATARS_BUCKET = 'dog-avatars'
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024 // 3MB, matches bucket limit

export type PhotoState =
  | { action: 'keep' }
  | { action: 'replace'; file: File; previewUrl: string }
  | { action: 'remove' }

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function guessExt(file: File): string {
  const byMime = EXT_BY_MIME[file.type]
  if (byMime) return byMime
  const m = /\.([a-zA-Z0-9]+)$/.exec(file.name)
  return (m?.[1] ?? 'jpg').toLowerCase()
}

/** Extracts the storage object path from a public URL, or null if mismatch. */
export function dogAvatarPathFromUrl(url: string): string | null {
  const marker = `/object/public/${DOG_AVATARS_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  return url.slice(i + marker.length)
}

export async function uploadDogPhoto(
  supabase: SupabaseClient,
  userId: string,
  dogId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const ext = guessExt(file)
  const path = `${userId}/${dogId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(DOG_AVATARS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage
    .from(DOG_AVATARS_BUCKET)
    .getPublicUrl(path)

  return { url: data.publicUrl, path }
}

/**
 * 사진 파기 — **서버 라우트로** (2026-09-26 출시 전 점검 5차).
 * 브라우저의 `storage.remove()` 는 dog-avatars 에 SELECT 정책이 없어 0건 삭제로 조용히
 * 끝났다(바꾸거나 지운 사진이 공개 URL 로 계속 열림). /api/dog-photos/remove 가 소유를
 * 확인하고 service_role 로 지운다. 실패는 던진다 — 호출부가 best-effort 로 삼킨다.
 */
export async function deleteDogPhotoByUrl(
  _supabase: SupabaseClient,
  url: string | null | undefined
): Promise<void> {
  if (!url) return
  if (!dogAvatarPathFromUrl(url)) return
  const res = await fetch('/api/dog-photos/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error(`photo remove failed: ${res.status}`)
}

/**
 * Resolves a PhotoState into a final photo_url to persist.
 * - keep: returns currentUrl unchanged
 * - replace: uploads new file, best-effort deletes old one
 * - remove: best-effort deletes old, returns null
 */
export async function resolvePhotoState(
  supabase: SupabaseClient,
  userId: string,
  dogId: string,
  currentUrl: string | null,
  state: PhotoState
): Promise<string | null> {
  if (state.action === 'keep') return currentUrl

  if (state.action === 'remove') {
    await deleteDogPhotoByUrl(supabase, currentUrl).catch(() => {})
    return null
  }

  // replace
  const { url } = await uploadDogPhoto(supabase, userId, dogId, state.file)
  if (currentUrl) {
    await deleteDogPhotoByUrl(supabase, currentUrl).catch(() => {})
  }
  return url
}
