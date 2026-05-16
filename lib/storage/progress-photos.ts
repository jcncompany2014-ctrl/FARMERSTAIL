/**
 * progress-photos Storage 헬퍼 (B-66 / P20).
 *
 * 시계열 진행 사진 (측면 / 정면 / 위) 자율 업로드. medical-records 와 동일한
 * private bucket + signed URL 5분 정책. 디자인 의도: 보호자 본인만 갤러리
 * 열람, link share 는 짧은 토큰으로 별도 처리 (현재 미구현, 후속).
 *
 * # 정책
 *  - private bucket 'progress_photos' (마이그레이션 20260516000001)
 *  - path: {user_id}/{dog_id}/{photo_id}.{ext}
 *  - signed URL 5분
 *
 * # RLS storage 정책 (마이그레이션 SQL 참고)
 *   self insert / select / delete + admin select.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const PROGRESS_PHOTOS_BUCKET = 'progress_photos'
export const PROGRESS_PHOTOS_SIGNED_URL_TTL_SEC = 300 // 5분

/**
 * 진행 사진 업로드 path 생성.
 * @param userId 보호자 uuid
 * @param dogId 강아지 uuid
 * @param photoId dog_progress_photos row uuid
 * @param mime image/jpeg | image/png | image/webp
 */
export function makeProgressPhotoPath(
  userId: string,
  dogId: string,
  photoId: string,
  mime: string,
): string {
  const ext =
    mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  return `${userId}/${dogId}/${photoId}.${ext}`
}

/** 진행 사진 signed URL — TTL 5분. 실패 시 null (호출처 fallback). */
export async function signProgressPhotoUrl(
  supabase: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROGRESS_PHOTOS_BUCKET)
    .createSignedUrl(path, PROGRESS_PHOTOS_SIGNED_URL_TTL_SEC)
  if (error || !data) return null
  return data.signedUrl
}
