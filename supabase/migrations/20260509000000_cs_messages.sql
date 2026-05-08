-- ============================================================================
-- Migration: cs_messages — 어드민 ↔ 사용자 1:1 양방향 CS 대화
-- ============================================================================
--
-- # 배경
--
-- 기존: admin 이 push notification 으로 단방향 발송. push_log 에만 기록.
-- 사용자가 답장할 수 없어서 후속 대화는 메일/카카오톡으로 분기 — 흐름 끊김.
--
-- 이 테이블은 user_id 기준 thread 1개. admin/user 양쪽이 메시지 추가 가능.
-- admin 이 발송한 메시지는 push 로도 함께 보내짐 (lib/push 자동 push_log 기록).
--
-- # 스키마
--
-- - id            : 메시지 행
-- - user_id       : 어떤 사용자의 thread 인지 (FK auth.users)
-- - sender        : 'admin' | 'user'  — 발신자 구분
-- - sender_id     : auth.users.id (admin 의 경우 발송한 admin 의 id)
-- - body          : 메시지 본문
-- - read_at       : 상대측이 읽음 처리한 시각 (NULL 이면 미확인)
-- - created_at    : 발송 시각
--
-- # RLS
--
-- - select_own : 자기 user_id thread 만 읽을 수 있음
-- - insert_user : 자기 user_id 에만 sender='user' 로 insert 가능
-- - admin 은 별도 select/insert/update policy 로 모든 thread 접근.

CREATE TABLE IF NOT EXISTS public.cs_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('admin', 'user')),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_messages_user_recent_idx
  ON public.cs_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS cs_messages_admin_unread_idx
  ON public.cs_messages (created_at DESC)
  WHERE sender = 'user' AND read_at IS NULL;

ALTER TABLE public.cs_messages ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 thread 만 select.
DROP POLICY IF EXISTS cs_messages_self_select ON public.cs_messages;
CREATE POLICY cs_messages_self_select ON public.cs_messages
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자가 자기 thread 에 자기 메시지만 insert.
DROP POLICY IF EXISTS cs_messages_user_insert ON public.cs_messages;
CREATE POLICY cs_messages_user_insert ON public.cs_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND sender = 'user'
    AND auth.uid() = sender_id
  );

-- 사용자가 admin 이 보낸 메시지의 read_at 만 update 가능 (자기 thread 내).
DROP POLICY IF EXISTS cs_messages_user_mark_read ON public.cs_messages;
CREATE POLICY cs_messages_user_mark_read ON public.cs_messages
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- admin 전체 select.
DROP POLICY IF EXISTS cs_messages_admin_select ON public.cs_messages;
CREATE POLICY cs_messages_admin_select ON public.cs_messages
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- admin insert (자기 sender_id 로, sender='admin').
DROP POLICY IF EXISTS cs_messages_admin_insert ON public.cs_messages;
CREATE POLICY cs_messages_admin_insert ON public.cs_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND sender = 'admin'
    AND auth.uid() = sender_id
  );

-- admin 이 사용자 메시지 read 처리 가능.
DROP POLICY IF EXISTS cs_messages_admin_update ON public.cs_messages;
CREATE POLICY cs_messages_admin_update ON public.cs_messages
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
