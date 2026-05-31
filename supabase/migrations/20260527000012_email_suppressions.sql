-- R101-F (D7): email_suppressions — 하드바운스/스팸신고 주소 전(全) 발송 차단.
--
-- # 문제
-- Resend webhook 이 bounce/complaint 시 newsletter_subscribers + profiles.agree_email
-- 만 갱신했다. 이는 마케팅만 막고, 트랜잭션 메일(주문/배송 안내)은 동의와 무관하게
-- 무조건 발송한다. 그 결과 (a) 영구적으로 존재하지 않는 주소(하드바운스)로 매 주문마다
-- 재발송, (b) 스팸신고(complaint)한 주소에도 거래메일 계속 발송 → Resend 도메인 평판
-- 하락 → 전체 전달성 붕괴.
--
-- # Fix
-- email PK suppression 테이블. webhook 이 Permanent bounce / complaint 시 upsert,
-- sendEmail 진입부에서 조회해 skip. unsubscribe(마케팅 거부)는 여기 넣지 않는다 —
-- 트랜잭션 메일은 계속 가야 하므로(마케팅 차단은 profiles.agree_email 로 별도 처리).
--
-- # 멱등
-- email PK + upsert(onConflict=email) 라 webhook 재시도/중복 안전.

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email      TEXT PRIMARY KEY,
  reason     TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'complaint')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- 정책 없음 = service_role 전용(RLS default deny). 서버 코드(webhook/sendEmail)는
-- createAdminClient(service_role) 로 접근하므로 충분 — anon/authenticated 는 차단.

COMMENT ON TABLE public.email_suppressions IS
  'R101-F: 하드바운스/스팸신고 주소 — sendEmail 이 조회해 전 발송 skip (도메인 평판 보호)';
