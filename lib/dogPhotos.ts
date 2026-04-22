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
function pathFromPublicUrl(url: string): string | null {
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

export async function deleteDogPhotoByUrl(
  supabase: SupabaseClient,
  url: string | null | undefined
): Promise<void> {
  if (!url) return
  const path = pathFromPublicUrl(url)
  if (!path) return
  await supabase.storage.from(DOG_AVATARS_BUCKET).remove([path])
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
