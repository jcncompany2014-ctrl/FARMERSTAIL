-- Feature flags / A/B 테스트 인프라.
--
-- # 두 종류
--   1) Boolean flag — on/off (예: "new_checkout_flow")
--   2) Variant flag — 사용자를 buckets 로 나눠 다른 경험 노출 (예: "hero_copy"
--      → 'control' / 'urgency' / 'value')
--
-- # 사용자 버킷팅
-- user_id 가 있으면 hash(user_id, flag_key) → 0~99 정수 → variants[i] 매칭.
-- 같은 사용자는 같은 flag 에 항상 같은 variant — 일관성.
-- 비로그인 사용자: 별도 buckets 미적용 (기본값 control 노출). 익명 분석은
-- GA4 의 자체 실험 기능 사용 권장.
--
-- # 운영
-- admin 이 /admin/feature-flags 에서 flag 추가 / on/off / variants 비율 조정.
-- 코드 deploy 없이 즉시 반영 (cache TTL 60s).

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  -- description: 운영자에게 보일 설명. UI 에서 flag 무엇인지 식별.
  description text,
  -- enabled: 전역 on/off. false 면 항상 default_value.
  enabled boolean NOT NULL DEFAULT false,
  -- variants: jsonb 배열. 각 항목 { key, weight, payload? }
  --   key — 'control' | 'urgency' | ... 식별자
  --   weight — 0~100 합계 100 권장. 정확히 100 아니어도 비례 분배.
  --   payload — 선택. variant 별 추가 데이터 (UI 텍스트 등)
  -- 비어있으면 boolean flag 로 동작 (true = enabled, false = disabled).
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- 비로그인 / hash 실패 시 fallback variant key. 보통 'control'.
  default_variant text NOT NULL DEFAULT 'control',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_flags_enabled_idx
  ON public.feature_flags (enabled)
  WHERE enabled = true;

-- updated_at 자동 갱신.
CREATE OR REPLACE FUNCTION public.set_feature_flags_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_feature_flags_updated_at();

-- RLS — public read (앱 부팅 시 모든 사용자가 읽음), admin write.
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags_public_select" ON public.feature_flags;
CREATE POLICY "feature_flags_public_select"
  ON public.feature_flags
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "feature_flags_admin_write" ON public.feature_flags;
CREATE POLICY "feature_flags_admin_write"
  ON public.feature_flags
  FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 시드 — 샘플 flag 1개. 운영자가 변경/삭제 가능.
INSERT INTO public.feature_flags (key, description, enabled, variants, default_variant)
VALUES
  (
    'hero_copy_test',
    '랜딩 hero 카피 A/B 테스트 (control / urgency / value)',
    false,
    '[
      {"key":"control","weight":34,"payload":{"label":"우리 아이 첫 화식"}},
      {"key":"urgency","weight":33,"payload":{"label":"한 번 먹으면 못 돌아가요"}},
      {"key":"value","weight":33,"payload":{"label":"수의영양학으로 만든 한 끼"}}
    ]'::jsonb,
    'control'
  )
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.feature_flags IS
  'Feature flags / A/B 테스트. enabled+variants 조합으로 boolean / multi-arm 둘 다 처리.';
