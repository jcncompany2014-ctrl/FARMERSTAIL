-- ============================================================================
-- Migration: progress-photos Storage bucket — 시계열 진행 사진 (B-66)
-- ============================================================================
--
-- 보호자가 강아지 시계열 사진 (측면/정면/위) 을 자율 업로드. table 은 P20
-- (20260513000010_progress_photos.sql) 에서 만들어졌고, 이 마이그레이션은
-- 실제 이미지를 보관할 Storage bucket + RLS 정책.
--
-- # 폴더 구조
--   {user_id}/{dog_id}/{photo_id}.{ext}
--
-- # RLS — checkin_photos 패턴 그대로 (audit RLS storage 정책).
--   - self insert / select / delete (auth.uid() == owner folder)
--   - admin select (디버깅 / CS)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress_photos',
  'progress_photos',
  false,
  5 * 1024 * 1024, -- 5MB cap (audit #94 다운스케일 후 평균 ~500KB)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "progress_photos_self_insert" ON storage.objects;
CREATE POLICY "progress_photos_self_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'progress_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "progress_photos_self_select" ON storage.objects;
CREATE POLICY "progress_photos_self_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'progress_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "progress_photos_self_delete" ON storage.objects;
CREATE POLICY "progress_photos_self_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'progress_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "progress_photos_admin_select" ON storage.objects;
CREATE POLICY "progress_photos_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'progress_photos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

COMMENT ON POLICY "progress_photos_self_select" ON storage.objects IS
  '시계열 진행 사진 self read — 보호자 본인만 (B-66, P20).';
