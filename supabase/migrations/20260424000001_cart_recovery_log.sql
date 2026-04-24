-- 장바구니 재결제 유도 알림 로그.
--
-- 쓰임새
-- ----
-- 사용자가 장바구니에 상품을 담았지만 일정 시간(기본 24시간) 이상 결제하지 않으면
-- "아직 담아둔 상품이 있어요" 메일을 한 번 보낸다. 중복 발송 방지를 위해 매번
-- 행을 남겨 두고, 다음 발송 결정시 "지난 7일 내 발송 이력이 있으면 skip" 으로
-- 쿨다운을 건다.
--
-- 왜 profiles 에 컬럼을 안 붙였는가
-- --------------------------------
-- 운영 중 발송 타이밍/메시지를 여러 버전(A/B) 으로 쪼갤 가능성 → row 로그가
-- 확장에 유리. 또 "어떤 상품이 담겨 있어 보냈는지" 스냅샷 필드가 필요할 수 있음.
--
-- RLS
-- ---
-- 본인 로그만 read. write 는 cron (service_role) 이 전담하므로 self-insert 정책은 두지 않음.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cart_recovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  item_count integer NOT NULL DEFAULT 0,
  subtotal integer NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'email' -- 'email' | 'push' (추후)
);

-- "이 유저가 최근 언제 받았는지" 쿨다운 체크용 — 최신 한 건만 보면 됨.
CREATE INDEX IF NOT EXISTS cart_recovery_log_user_sent_idx
  ON public.cart_recovery_log (user_id, sent_at DESC);

ALTER TABLE public.cart_recovery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY cart_recovery_log_self_select ON public.cart_recovery_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY cart_recovery_log_admin_read ON public.cart_recovery_log
  FOR SELECT
  USING (public.is_admin(auth.uid()));

COMMENT ON TABLE public.cart_recovery_log IS
  '장바구니 재결제 유도 알림 발송 로그. 쿨다운(7일) 체크 및 리포팅용.';

COMMIT;
