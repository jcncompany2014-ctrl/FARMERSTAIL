-- 검색어 로깅.
--
-- # 목적
-- 인기 검색어 / 결과 0건 검색어 / 신규 카테고리 발견 시그널 수집. 마케팅
-- 콘텐츠 / 상품 큐레이션 결정에 활용.
--
-- # 프라이버시
-- 사용자 식별자 저장 안 함. q + result_count + 발생 시각만. 로그인 사용자도
-- user_id 비움 (개인 검색 이력 ≠ 운영 인사이트).
-- IP 도 저장 안 함 — 인기 검색어 집계는 IP 없어도 충분.

CREATE TABLE IF NOT EXISTS public.search_queries (
  id bigserial PRIMARY KEY,
  -- 정규화된 query (소문자, trim, 한글 그대로). 같은 사용자가 'COCO' / 'coco'
  -- 검색해도 같은 행으로 집계되도록.
  q_normalized text NOT NULL,
  -- 원 검색어. 사용자가 입력한 그대로 — 한글 / 영문 mixed 분석용.
  q_raw text NOT NULL,
  -- 결과 0건이면 inventory gap — 카테고리 신규 검토 신호.
  result_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 인기 검색어 집계 인덱스 — 일별 GROUP BY q_normalized.
CREATE INDEX IF NOT EXISTS search_queries_recent_idx
  ON public.search_queries (created_at DESC, q_normalized);

-- 결과 0건 검색어 빠른 조회.
CREATE INDEX IF NOT EXISTS search_queries_zero_idx
  ON public.search_queries (created_at DESC)
  WHERE result_count = 0;

-- RLS — public insert 허용 (anon 검색도 로깅), select 는 admin 만.
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_queries_insert_anon" ON public.search_queries;
CREATE POLICY "search_queries_insert_anon"
  ON public.search_queries
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "search_queries_admin_select" ON public.search_queries;
CREATE POLICY "search_queries_admin_select"
  ON public.search_queries
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- TTL — 90일 지난 행은 운영 가치 떨어짐. cron 으로 별도 정리해도 되지만
-- 우선은 그냥 보존. 트래픽 폭증 시 partition / cron purge 검토.

COMMENT ON TABLE public.search_queries IS
  '검색어 로깅 — 인기 검색어 / 0건 검색어 분석. user 정보 / IP 저장 X.';

-- 인기 검색어 RPC — 최근 N일 동안 검색 횟수 + 결과 0건 횟수.
CREATE OR REPLACE FUNCTION public.popular_search_queries(
  p_days integer DEFAULT 7,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  q text,
  total_count bigint,
  zero_count bigint,
  avg_result numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role IS DISTINCT FROM 'admin' THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF v_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    sq.q_normalized AS q,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE sq.result_count = 0) AS zero_count,
    AVG(sq.result_count)::numeric AS avg_result
  FROM public.search_queries sq
  WHERE sq.created_at >= now() - (p_days || ' days')::interval
  GROUP BY sq.q_normalized
  ORDER BY total_count DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.popular_search_queries(integer, integer) IS
  '최근 N일 인기 검색어 + 결과 0건 비율. admin only.';
