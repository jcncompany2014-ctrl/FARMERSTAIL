-- =============================================================================
-- P20 — 의료 기록 raw 이미지 첨부 + 시계열 사진 (B-13, B-66)
-- =============================================================================
--
-- medical_records.attached_image_url: OCR 사용 안 하고 진단서 raw 이미지
--   만 보관하고 싶을 때 (수의사가 참고용으로 볼 수 있도록).
-- dog_progress_photos: 옵션 — 보호자가 시계열 사진을 자율적으로 업로드.
-- =============================================================================

ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS attached_image_url text;

CREATE TABLE IF NOT EXISTS public.dog_progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  view text CHECK (view IS NULL OR view IN ('side', 'front', 'top')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_photos_dog
  ON public.dog_progress_photos (dog_id, taken_at DESC);

ALTER TABLE public.dog_progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_photos_self" ON public.dog_progress_photos;
CREATE POLICY "progress_photos_self" ON public.dog_progress_photos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.dog_progress_photos IS
  '시계열 진행 사진 — 보호자 자율 업로드. P20 phase.';
