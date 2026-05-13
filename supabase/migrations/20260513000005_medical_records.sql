-- =============================================================================
-- 의료 기록 — medical_records (P4)
-- =============================================================================
--
-- 동물병원 방문 / 처방 / 진단을 시계열로 저장.
-- 입력 경로:
--   1. 수동 입력 (health 페이지)
--   2. OCR (D6.5) — 영수증/처방전 → MedicalRecordOcr 컴포넌트가 사용자
--      확인 후 POST /api/health/records 로 저장
--
-- source 컬럼으로 입력 출처 구분 — 신뢰도 가중치 계산에 사용.
--   manual = 사용자 직접 입력 (보통 정확)
--   ocr    = Claude Vision OCR (사용자가 확인 후 confirm 했지만 OCR 오인식 가능)
--   vet    = 수의사 직접 입력 (W=1.0 골든, 추후 phase)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date date,
  -- 진단명 array (한글)
  diagnosis text[] NOT NULL DEFAULT '{}',
  -- 처방 약 jsonb array [{ name, dosage, frequency }]
  medications jsonb NOT NULL DEFAULT '[]',
  -- 수의사 메모 / 자유 텍스트
  vet_notes text,
  -- 진료 시 측정 체중 (있을 경우)
  weight_kg numeric(5,2),
  -- 입력 출처
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ocr', 'vet')),
  -- OCR 자신감 점수 0~1 (source='ocr' 일 때만 의미)
  ocr_confidence numeric(3,2)
    CHECK (ocr_confidence IS NULL OR (ocr_confidence BETWEEN 0 AND 1)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_dog
  ON public.medical_records (dog_id, visit_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_medical_records_user
  ON public.medical_records (user_id, created_at DESC);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medical_records_self" ON public.medical_records;
CREATE POLICY "medical_records_self" ON public.medical_records
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.medical_records IS
  '의료 기록 시계열. manual / ocr / vet source 구분. P4 phase.';
