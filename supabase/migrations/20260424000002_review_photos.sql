-- 리뷰 시스템 확장: 사진 첨부 지원.
--
-- 변경점
-- ------
--  1) reviews 에 image_urls text[] 컬럼 추가. `{}` 기본값이라 기존 리뷰는 빈 배열.
--  2) review-photos 스토리지 버킷 + RLS.
--     · 업로드: 로그인 유저만, `<user_id>/<filename>` 경로.
--     · 읽기: public (리뷰 목록이 public 노출이므로).
--     · 삭제: 본인 업로드만.
--  3) 정렬/필터 지원을 위해 has_photo 는 DB 컬럼이 아니라 쿼리 조건으로 처리.
--     `array_length(image_urls, 1) > 0` 인덱스는 과잉 — 리뷰 한 상품당 최대 수백 건
--     규모에서 불필요.
--
-- 데이터 스키마
-- -----------
--  · image_urls 은 Supabase Storage 의 public URL (CDN) 문자열. /storage/v1/object/public/...
--    경로 그대로 저장해서 애플리케이션은 바로 <img src=...> 에 박는다.
--  · 최대 4장 제한은 애플리케이션 레이어에서 (DB에서 강제하지 않음) — 미래에
--    프로모션 이벤트로 "8장 리뷰" 를 열고 싶어질 때 스키마 수정 없이 풀기 위해.

BEGIN;

-- 1) reviews.image_urls
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.reviews.image_urls IS
  '리뷰 사진 public URL 배열 (Supabase Storage review-photos 버킷). 최대 4장은 앱에서 강제.';

-- 2) review-photos 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3) 스토리지 정책. storage.objects 에 건다.
-- Upload: 로그인 유저, 본인 user_id 하위 경로만.
DROP POLICY IF EXISTS "review-photos self upload" ON storage.objects;
CREATE POLICY "review-photos self upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'review-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: 공개. 버킷 public=true 라 signed URL 없이도 /storage/v1/object/public/... 접근 가능.
-- 여전히 SDK 경유 listing 은 정책이 필요하므로 열어둠.
DROP POLICY IF EXISTS "review-photos public read" ON storage.objects;
CREATE POLICY "review-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');

-- Delete: 본인 업로드만.
DROP POLICY IF EXISTS "review-photos self delete" ON storage.objects;
CREATE POLICY "review-photos self delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'review-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
