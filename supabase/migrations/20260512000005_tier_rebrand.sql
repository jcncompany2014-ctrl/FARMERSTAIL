-- 등급 리브랜딩 — bronze/silver/gold/vip 4단계 → seed/sprout/bloom/fruit/mate 5단계.
--
-- brand alignment
-- ───────────────
-- 파머스테일 = 농부의 꼬리. 식물 lifecycle (씨앗 → 새싹 → 꽃 → 열매) +
-- 강아지와의 관계 정점 (단짝) 으로 brand DNA 명확화.
--
-- 5단계 기준 (한국 화식 D2C 가격대)
--   seed   : < 50,000      신규 / 첫 박스 전
--   sprout : >= 50,000     첫 박스 1개 이상
--   bloom  : >= 300,000    의미 있는 단골 (~6박스)
--   fruit  : >= 1,000,000  장기 고객 (~정기배송 6개월)
--   mate   : >= 3,000,000  최상 등급 (~정기배송 2년)
--
-- 순서가 중요
-- ──────────
-- 새 CHECK 를 먼저 추가하면 기존 'bronze' 행이 즉시 위반. 그래서
--   1) DROP 기존 CHECK
--   2) fn_compute_tier 재정의
--   3) cumulative_spend 기반 UPDATE
--   4) ADD 새 CHECK
-- 순으로 한 트랜잭션에 묶는다.

-- 1) 기존 CHECK 제약 제거.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;

-- 2) fn_compute_tier 재정의.
CREATE OR REPLACE FUNCTION public.fn_compute_tier(spend bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN spend >= 3000000 THEN 'mate'
    WHEN spend >= 1000000 THEN 'fruit'
    WHEN spend >= 300000  THEN 'bloom'
    WHEN spend >= 50000   THEN 'sprout'
    ELSE 'seed'
  END
$function$;

-- 3) 기존 데이터 재계산.
UPDATE public.profiles
   SET tier = public.fn_compute_tier(COALESCE(cumulative_spend, 0)),
       tier_updated_at = now();

-- 4) 새 CHECK 제약.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tier_check
  CHECK (tier = ANY (ARRAY['seed'::text, 'sprout'::text, 'bloom'::text, 'fruit'::text, 'mate'::text]));

COMMENT ON FUNCTION public.fn_compute_tier(bigint) IS
  '누적 결제액 기반 등급 계산. seed/sprout/bloom/fruit/mate 5단계.';
