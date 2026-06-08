-- 기능성 소스(레이어 B) 출시 알림 대기열.
--
-- 추천 엔진 v3 의 레이어 B 는 강아지의 기능성 우려(피부/관절/소화/면역)를
-- "기능성 소스" 토퍼로 라우팅한다. 현재 소스는 전부 coming_soon(준비중)이라,
-- 분석 페이지의 v3 추천 카드에서 보호자가 "출시 알림 받기" 를 누르면 한 행을
-- 만든다. 소스 상품이 출시되면 cron/edge function 이 이 테이블을 스캔해
-- email+web-push 로 통지(restock_alerts 와 동일 패턴).
--
-- 설계 (restock_alerts 미러링)
-- ----------------------------
--  * concern 단위 구독(피부/관절/소화/면역). dog_id 는 컨텍스트용(어느 강아지
--    분석에서 눌렀는지) — 알림은 사용자 단위라 (user_id, concern) 유니크.
--  * dog_id 는 ON DELETE SET NULL — 강아지를 지워도 알림 구독은 유지.
--  * notified_at — 한 번 알리면 자동 해제. 재구독 원하면 row 삭제 후 재insert.
--
-- RLS: 본인 구독만 select/insert/delete + 관리자 read(대기 수요 집계).

BEGIN;

CREATE TABLE IF NOT EXISTS public.source_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dog_id uuid REFERENCES public.dogs(id) ON DELETE SET NULL,
  concern text NOT NULL CHECK (concern IN ('skin', 'joint', 'digestion', 'immune')),
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

-- (user, concern) 유니크 — 같은 우려 중복 구독 방지(여러 강아지·여러 클릭 OK).
CREATE UNIQUE INDEX IF NOT EXISTS source_waitlist_uniq_user_concern
  ON public.source_waitlist (user_id, concern);

-- 미통지 행만 스캔하는 partial index — 출시 통지 cron 용.
CREATE INDEX IF NOT EXISTS source_waitlist_pending_idx
  ON public.source_waitlist (concern)
  WHERE notified_at IS NULL;

-- 유저 구독 조회용.
CREATE INDEX IF NOT EXISTS source_waitlist_user_idx
  ON public.source_waitlist (user_id, created_at DESC);

ALTER TABLE public.source_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_waitlist_self_select ON public.source_waitlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY source_waitlist_self_insert ON public.source_waitlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY source_waitlist_self_delete ON public.source_waitlist
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY source_waitlist_admin_read ON public.source_waitlist
  FOR SELECT USING (public.is_admin());

COMMENT ON TABLE public.source_waitlist IS
  '기능성 소스(레이어 B) 출시 알림 대기열. concern 단위, (user,concern) 유니크.';
COMMENT ON COLUMN public.source_waitlist.notified_at IS
  '출시 통지(이메일+푸시) 완료 시점. NULL 이면 대기.';

COMMIT;
