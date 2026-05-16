-- audit 1-9: 인-메모리 rate limiter → DB 백업.
--
-- Vercel Edge isolate 단위로 메모리 Map 이 분리되므로 실 한도가 quota × N
-- 으로 뻥튀기됨. attacker 가 같은 IP 로 부하를 주더라도 isolate 분산되면
-- 차단이 약해짐.
--
-- 해법: bucket+key 의 윈도우당 카운터를 Postgres row 로 저장 → 모든 isolate
-- 가 같은 row 를 참조. 정상 트래픽은 in-memory 가 1차로 빠르게 거름. 그래도
-- DB 쪽 카운트가 한도를 넘었으면 차단.
--
-- table 은 partial unique index (bucket, key, window_start_ms) 로 UPSERT.
-- 7일 지난 row 는 백그라운드 cron 으로 삭제 (TTL 운영).

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start_ms BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key, window_start_ms)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_updated
  ON rate_limit_counters (updated_at);

-- atomic increment — race 안전. window_start_ms 는 호출처가 floor(now/windowMs)
-- 로 계산해 넘겨야 함.
CREATE OR REPLACE FUNCTION incr_rate_limit_counter(
  p_bucket TEXT,
  p_key TEXT,
  p_window_start_ms BIGINT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limit_counters (bucket, key, window_start_ms, count, updated_at)
  VALUES (p_bucket, p_key, p_window_start_ms, 1, now())
  ON CONFLICT (bucket, key, window_start_ms)
  DO UPDATE SET
    count = rate_limit_counters.count + 1,
    updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- 7일 지난 row 정리 (cron 으로 매일 호출).
CREATE OR REPLACE FUNCTION sweep_rate_limit_counters()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_counters
  WHERE updated_at < now() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- RLS — 사용자는 직접 SELECT/INSERT 할 일이 없음. service_role 전용.
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- 명시적으로 policy 없음 → service_role 만 접근 가능.

-- RPC 권한 — 익명도 호출 가능해야 photo-upload 같이 anon endpoint 에서 사용.
GRANT EXECUTE ON FUNCTION incr_rate_limit_counter(TEXT, TEXT, BIGINT)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sweep_rate_limit_counters()
  TO service_role;
