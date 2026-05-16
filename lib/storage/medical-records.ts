/**
 * Medical records 전용 storage 헬퍼 (audit #72).
 *
 * # 정책
 *  - private bucket 'medical-records-images' (마이그레이션 medical_records_bucket_only)
 *  - path: {user_id}/{dog_id}/{record_id}-{ext}
 *  - signed URL 5분 (PII 노출 윈도우 최소화)
 *
 * # RLS storage 정책 — owner-only (대시보드/CLI 로 별도 설정)
 *
 *   CREATE POLICY medical_records_owner ON storage.objects
 *     FOR ALL USING (
 *       bucket_id = 'medical-records-images' AND
 *       auth.uid()::text = (storage.foldername(name))[1]
 *     );
 *
 * MCP 권한 한계로 마이그레이션에 정책 자동 적용 안 됨 — supabase CLI 또는
 * 대시보드 → Storage → Policies 에서 위 SQL 실행.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const MEDICAL_RECORDS_BUCKET = 'medical-records-images'
export const MEDICAL_RECORDS_SIGNED_URL_TTL_SEC = 300 // 5분

/**
 * 의료기록 이미지 업로드 path 생성.
 * @param userId 보호자 uuid
 * @param dogId 강아지 uuid
 * @param recordId 의료기록 row uuid
 * @param mime image/jpeg | image/png | image/webp
 */
export function makeMedicalRecordPath(
  userId: string,
  dogId: string,
  recordId: string,
  mime: string,
): string {
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : 'jpg'
  return `${userId}/${dogId}/${recordId}.${ext}`
}

/** 의료기록 이미지 signed URL — TTL 5분. */
export async function signMedicalRecordUrl(
  supabase: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(MEDICAL_RECORDS_BUCKET)
    .createSignedUrl(path, MEDICAL_RECORDS_SIGNED_URL_TTL_SEC)
  if (error || !data) return null
  return data.signedUrl
}
