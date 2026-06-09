-- =============================================================================
-- 의료기록 이미지 버킷 — owner-only RLS 정책 (점검 C)
-- =============================================================================
--
-- 배경:
--   `lib/storage/medical-records.ts` 는 비공개 버킷 `medical-records-images` 를
--   참조한다. 버킷 자체는 마이그레이션(20260513000005 계열)로 생성돼 있고
--   public=false 상태(외부 직접 접근 차단)다. 다만 storage.objects 에 이 버킷용
--   RLS 정책이 없어 "deny-all" 상태였다 — 즉 service_role(서버) 외에는 아무도
--   접근 못 함. 현재 이 버킷을 쓰는 라우트가 아직 없어 보안 구멍은 아니지만,
--   추후 사용자-스코프 클라이언트로 사진 업로드/조회 기능을 연결할 때를 대비해
--   owner-only 정책을 명시해 둔다(본인 폴더 {user_id}/... 만 접근).
--
-- 경로 규약: {user_id}/{dog_id}/{record_id}.{ext}
--   → (storage.foldername(name))[1] = user_id
--
-- 안전성:
--   - 비공개 버킷 + 현재 미사용 코드라 이 정책 적용은 기존 동작에 영향 없음.
--   - 다른 버킷은 bucket_id 조건으로 격리 — 영향 없음.
--   - 멱등(IF EXISTS drop 후 create).
-- =============================================================================

DROP POLICY IF EXISTS "medical_records_images_owner" ON storage.objects;
CREATE POLICY "medical_records_images_owner" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'medical-records-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'medical-records-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMENT ON POLICY "medical_records_images_owner" ON storage.objects IS
  '의료기록 이미지 owner-only. 경로 첫 세그먼트(user_id)가 본인일 때만 접근. 점검 C.';
