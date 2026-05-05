-- ============================================================================
-- Migration: subscription → dog 연결 + 월정기배송 portion 모델
-- ============================================================================
--
-- 배경
--  · /dogs/[id]/order 에서 시작한 정기배송은 어떤 강아지의 맞춤 박스인지
--    추적 → 강아지 상세 페이지에 "이 강아지 정기배송" 섹션 표시
--  · 박스 정기배송은 항상 한달마다 (interval_weeks=4) 청구 / 배송.
--    portion 은 2주치 또는 4주치:
--      - 4주치 (full 화식) — 한 달 풀커버, 인기 옵션
--      - 2주치 (hybrid) — 가성비. 화식 50% + 건식사료 50% 권장 (보호자 판단).
--
-- 변경
--  1. subscriptions.dog_id (uuid, nullable, FK → dogs.id ON DELETE SET NULL)
--     nullable 이유: 기존 단일 SKU /subscribe/[slug] 흐름은 dog 무관.
--     SET NULL → 강아지 삭제 시 구독은 보존, 사용자가 별도 해지 결정.
--  2. subscriptions.coverage_weeks (smallint, default 4)
--     배송 1회 분량의 주(week) 수 — 2 (반월·하이브리드) | 4 (전월·풀)
--     cron 청구는 interval_weeks 기준 (4주마다 = 월 1회), coverage_weeks 는
--     포장 g 산정 + UI 레이블 전용.
--  3. 강아지별 active 정기배송 조회 인덱스
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS dog_id uuid
    REFERENCES public.dogs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_weeks smallint NOT NULL DEFAULT 4
    CHECK (coverage_weeks IN (2, 4));

-- 강아지 상세 페이지의 active 구독 조회 — (dog_id, status, created_at desc)
-- partial index 로 active/paused 만 인덱스 (canceled 는 listing 거의 안 됨).
CREATE INDEX IF NOT EXISTS subscriptions_dog_active_idx
  ON public.subscriptions (dog_id, created_at DESC)
  WHERE dog_id IS NOT NULL AND status IN ('active', 'paused');

COMMENT ON COLUMN public.subscriptions.dog_id IS
  '구독이 어떤 강아지 맞춤 박스에서 시작했는지 (NULL = 단일 SKU 구독). '
  '강아지 삭제 시 SET NULL — 구독 자체는 사용자 결정으로 해지.';

COMMENT ON COLUMN public.subscriptions.coverage_weeks IS
  '배송 1회 분량의 주 수 (2 또는 4). 박스 정기배송 한정. '
  '2 = 하이브리드 (화식 50% + 건식 50% 권장), 4 = 풀 화식.';
