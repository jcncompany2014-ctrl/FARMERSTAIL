-- ============================================================================
-- Migration: chatbot_messages — AI 영양사 대화 history
-- ============================================================================
--
-- # 배경
-- /chat 페이지가 stateless single-turn 이었음. 사용자가 후속 질문하면
-- 이전 컨텍스트 잃음. 30일 history 보관 + Anthropic API 호출 시 마지막
-- 10턴 묶어 보내 자연스러운 대화.
--
-- # 정책
-- - 최근 30일 message 만 보관 (cron 정리)
-- - 한 사용자당 최근 10턴까지만 컨텍스트로 묶음 (token 비용 ↓)
-- - dog_id 옵션 — 같은 강아지에 대한 연속 질문은 같은 conversation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  /** 같은 (user_id, dog_id) 쌍의 message 들이 한 conversation 으로 묶임. */
  dog_id uuid,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_messages_user_created_idx
  ON public.chatbot_messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chatbot_messages_user_dog_idx
  ON public.chatbot_messages (user_id, dog_id, created_at DESC);

ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chatbot_select_own ON public.chatbot_messages;
CREATE POLICY chatbot_select_own ON public.chatbot_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chatbot_insert_own ON public.chatbot_messages;
CREATE POLICY chatbot_insert_own ON public.chatbot_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chatbot_delete_own ON public.chatbot_messages;
CREATE POLICY chatbot_delete_own ON public.chatbot_messages
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.chatbot_messages IS
  'AI 영양사 챗봇 대화 history. (user_id, dog_id) 페어로 conversation 그룹.';
