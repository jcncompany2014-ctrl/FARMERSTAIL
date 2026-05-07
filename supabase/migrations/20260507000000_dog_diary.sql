-- ============================================================================
-- Migration: dog_diary — 사진 일기 (강아지 일상 stickiness)
-- ============================================================================
--
-- # 배경
-- 사용자 retention 의 핵심 — 매일 들러서 강아지 사진을 남기는 행동.
-- D2C 펫푸드의 본질은 "구매"가 아니라 "일상". 펫 보호자가 자기 강아지의 매일을
-- 기록하는 surface 가 있으면 앱을 매일 열게 됨 → 정기배송 전환 / retention ↑.
--
-- # 컬럼
-- - photo_urls: text[] — 한 entry 에 사진 0~5장 (멀티 업로드)
-- - note: text — 100자 이내 짧은 메모 ("산책 다녀옴", "오늘 입맛 좋음")
-- - mood: smallint 1-5 — 그 날의 강아지 기분 (선택)
-- - created_at — 일기 작성일 (기준 KST)
--
-- # RLS
-- 자기 row 만 select / insert / update / delete. user_id = auth.uid().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dog_diary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  photo_urls text[] NOT NULL DEFAULT '{}',
  note text CHECK (char_length(note) <= 200),
  mood smallint CHECK (mood IS NULL OR (mood >= 1 AND mood <= 5)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dog_diary_dog_created_idx
  ON public.dog_diary (dog_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dog_diary_user_created_idx
  ON public.dog_diary (user_id, created_at DESC);

ALTER TABLE public.dog_diary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dog_diary_select_own ON public.dog_diary;
CREATE POLICY dog_diary_select_own ON public.dog_diary
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_diary_insert_own ON public.dog_diary;
CREATE POLICY dog_diary_insert_own ON public.dog_diary
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_diary_update_own ON public.dog_diary;
CREATE POLICY dog_diary_update_own ON public.dog_diary
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dog_diary_delete_own ON public.dog_diary;
CREATE POLICY dog_diary_delete_own ON public.dog_diary
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.dog_diary IS
  '강아지 일상 사진 일기. 사용자 retention 의 핵심 surface.';

-- ── Storage bucket: dog-diary-photos (private) ─────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dog-diary-photos',
  'dog-diary-photos',
  false,
  5 * 1024 * 1024, -- 5MB / file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Storage RLS: 자기 폴더 (user_id/...) 만 read/write.
DROP POLICY IF EXISTS "dog_diary_photos_select_own" ON storage.objects;
CREATE POLICY "dog_diary_photos_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'dog-diary-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "dog_diary_photos_insert_own" ON storage.objects;
CREATE POLICY "dog_diary_photos_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'dog-diary-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "dog_diary_photos_delete_own" ON storage.objects;
CREATE POLICY "dog_diary_photos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'dog-diary-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
