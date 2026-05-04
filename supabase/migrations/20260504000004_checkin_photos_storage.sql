-- ============================================================================
-- Migration: dog_checkin_photos Storage bucket — 변/털 사진 첨부
-- ============================================================================
--
-- 보호자가 체크인 (week_2 / week_4) 응답 시 변 / 털 사진을 첨부할 수 있는
-- Storage bucket. dog_checkins.photo_urls (text[]) 가 저장된 URL 들.
--
-- # 향후 (D1)
-- vision 모델 (Claude API) 가 사진 → Bristol/coat 자동 채점.
--
-- # 폴더 구조
--   {user_id}/{dog_id}/{checkin-id-or-timestamp}-{filename}
--
-- # RLS — 사용자 본인 폴더 (auth.uid() = {user_id}) 만 read/write.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dog_checkin_photos',
  'dog_checkin_photos',
  false,
  5 * 1024 * 1024, -- 5MB cap
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "checkin_photos_self_insert" ON storage.objects;
CREATE POLICY "checkin_photos_self_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dog_checkin_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "checkin_photos_self_select" ON storage.objects;
CREATE POLICY "checkin_photos_self_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dog_checkin_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "checkin_photos_self_delete" ON storage.objects;
CREATE POLICY "checkin_photos_self_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dog_checkin_photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "checkin_photos_admin_select" ON storage.objects;
CREATE POLICY "checkin_photos_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dog_checkin_photos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
