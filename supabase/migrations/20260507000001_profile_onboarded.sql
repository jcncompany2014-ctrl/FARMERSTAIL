-- Migration: profiles.onboarded_at — 가입 후 첫 진입 튜토리얼 표시 여부
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

COMMENT ON COLUMN public.profiles.onboarded_at IS
  '가입 후 첫 진입 튜토리얼 완료 시각. NULL = 아직 안 봄 → 다음 dashboard 진입 시 노출.';
