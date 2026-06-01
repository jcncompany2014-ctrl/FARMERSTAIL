-- Migration: anthropic_usage — Anthropic AI 일별 사용량 누적 (비용 가드)
--
-- # 배경 (마스터피스 P1-O4)
-- AI 라우트 (/api/analysis/commentary, /structured, /api/health/ocr) 는 IP 당
-- rate-limit (5req/min) 만 있고 **일·월 누적 비용 추적·예산 cap·초과 알림이
-- 전무**. 분산 IP / 봇 / 버그 폭주 시 Anthropic 청구가 조용히 누적됨.
--
-- # 설계
-- (day, route) 단위로 호출수 + 토큰을 누적. PK 가 (day, route) 라 라우트별
-- 일일 1 row → 테이블이 작게 유지됨 (route 종류 × 일수). 전역 일일 cap 가드는
-- sum_anthropic_calls_today() 로 오늘 전체 호출수 합산해 확인.
--
-- usage.input_tokens / output_tokens 는 Anthropic 응답의 usage 필드에서 채움
-- (없으면 0). 호출수(calls) 는 cap 가드의 1차 기준 — 토큰보다 단순/안전.
--
-- # 보안 — service_role 전용
-- 사용자/익명이 직접 SELECT/INSERT 할 일 없음. RLS enable + policy 없음 →
-- service_role (createAdminClient) 만 접근. RPC 는 atomic upsert 로 race 안전.
--
-- # TTL
-- day 컬럼이 DATE 라 row 가 적게 유지되므로 즉시 정리 불필요. 운영 중 누적
-- 보고 retention 결정 (예: 13개월 이전 cleanup) — 현재는 별도 cron 안 만듦.

CREATE TABLE IF NOT EXISTS public.anthropic_usage (
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  route TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, route)
);

CREATE INDEX IF NOT EXISTS anthropic_usage_day_idx
  ON public.anthropic_usage (day DESC);

COMMENT ON TABLE public.anthropic_usage IS
  'Anthropic AI 일별 사용량 누적 (호출수 + 토큰). (day, route) PK. 비용 가드 / 모니터링용. service_role 전용.';

-- ──────────────────────────────────────────────────────────────────────────
-- atomic 누적 upsert — race 안전. 호출 성공 후 best-effort 로 호출.
-- p_calls 는 보통 1. p_input_tokens / p_output_tokens 는 응답 usage 에서.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.incr_anthropic_usage(
  p_route TEXT,
  p_input_tokens BIGINT DEFAULT 0,
  p_output_tokens BIGINT DEFAULT 0,
  p_calls INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.anthropic_usage AS u (day, route, calls, input_tokens, output_tokens, updated_at)
  VALUES (CURRENT_DATE, p_route, p_calls, GREATEST(p_input_tokens, 0), GREATEST(p_output_tokens, 0), now())
  ON CONFLICT (day, route)
  DO UPDATE SET
    calls = u.calls + EXCLUDED.calls,
    input_tokens = u.input_tokens + EXCLUDED.input_tokens,
    output_tokens = u.output_tokens + EXCLUDED.output_tokens,
    updated_at = now();
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 오늘 전역 호출수 합산 — 일일 cap 가드의 1차 기준. row 가 부재해도 0 반환.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sum_anthropic_calls_today()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(calls), 0)::BIGINT
  FROM public.anthropic_usage
  WHERE day = CURRENT_DATE;
$$;

-- RLS — service_role 전용. 명시적 policy 없음 → 익명/인증 사용자 접근 불가.
ALTER TABLE public.anthropic_usage ENABLE ROW LEVEL SECURITY;

-- RPC 권한 — 라우트가 createAdminClient (service_role) 로 호출. 익명/인증에는
-- 부여 안 함 (가드/기록은 서버 service_role 경로에서만).
GRANT EXECUTE ON FUNCTION public.incr_anthropic_usage(TEXT, BIGINT, BIGINT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sum_anthropic_calls_today()
  TO service_role;
