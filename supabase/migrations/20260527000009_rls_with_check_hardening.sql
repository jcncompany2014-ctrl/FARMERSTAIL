-- R90-A C1 (D7): RLS UPDATE policy 의 WITH CHECK 누락 보강.
--
-- # 문제
-- FOR UPDATE USING (auth.uid() = user_id) 만 정의된 정책은 행을
-- "어떤 행을 update 가능한가" 만 검사 — update 결과로 새 row 의
-- user_id 가 다른 사용자 UUID 가 되어도 막지 못함.
--
-- 즉 악의적 사용자가 자기 row 의 user_id 를 다른 사용자 ID 로 바꿔
-- 자기 데이터를 타인에게 떠넘기거나, 또는 (review 위조) 평판 조작 가능.
--
-- # 영향 받는 8개 테이블
-- addresses (배송지 탈취), push_preferences (알림 설정 위조),
-- personalization_preferences (개인화 데이터 위조),
-- personalization_overrides (위조), push_log_history (감사 로그 위조),
-- cs_messages (CS 메시지 위조), dog_records (체중/체크인 위조 4종),
-- product_reviews (평판 위조)
--
-- # Fix
-- 각 정책에 WITH CHECK (auth.uid() = user_id) 추가.
-- DROP + CREATE 로 정책 재정의 (Postgres 는 ALTER POLICY 가 WITH CHECK
-- 추가만 부분 지원하지 않음 — 안전하게 DROP).

-- ============================================================
-- 1) addresses (20260424000009_addresses.sql:121)
-- ============================================================
DROP POLICY IF EXISTS "addresses_update_own" ON public.addresses;
CREATE POLICY "addresses_update_own" ON public.addresses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2) push_preferences (20260424000003_push_preferences.sql:57)
-- ============================================================
DROP POLICY IF EXISTS "push_preferences_update_own" ON public.push_preferences;
CREATE POLICY "push_preferences_update_own" ON public.push_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3) personalization_preferences (20260502000002:119)
-- ============================================================
DROP POLICY IF EXISTS "personalization_preferences_update_own"
  ON public.personalization_preferences;
CREATE POLICY "personalization_preferences_update_own"
  ON public.personalization_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4) personalization_overrides (20260502000002:207)
-- ============================================================
DROP POLICY IF EXISTS "personalization_overrides_update_own"
  ON public.personalization_overrides;
CREATE POLICY "personalization_overrides_update_own"
  ON public.personalization_overrides
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5) push_log_history (20260504000003_push_log_history.sql:38)
-- ============================================================
DROP POLICY IF EXISTS "push_log_history_update_own"
  ON public.push_log_history;
CREATE POLICY "push_log_history_update_own"
  ON public.push_log_history
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6) cs_messages (20260509000000_cs_messages.sql:65)
-- ============================================================
DROP POLICY IF EXISTS "cs_messages_update_own" ON public.cs_messages;
CREATE POLICY "cs_messages_update_own" ON public.cs_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7) dog_records (20260525000001_dog_records.sql:38,72,101,137)
-- ============================================================
DROP POLICY IF EXISTS "dog_weight_logs_update_own" ON public.dog_weight_logs;
CREATE POLICY "dog_weight_logs_update_own" ON public.dog_weight_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dog_stool_logs_update_own" ON public.dog_stool_logs;
CREATE POLICY "dog_stool_logs_update_own" ON public.dog_stool_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dog_diary_entries_update_own"
  ON public.dog_diary_entries;
CREATE POLICY "dog_diary_entries_update_own" ON public.dog_diary_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dog_reminders_update_own" ON public.dog_reminders;
CREATE POLICY "dog_reminders_update_own" ON public.dog_reminders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8) product_reviews (20260525000002_product_reviews.sql:33)
-- ============================================================
DROP POLICY IF EXISTS "product_reviews_update_own" ON public.product_reviews;
CREATE POLICY "product_reviews_update_own" ON public.product_reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "addresses_update_own" ON public.addresses IS
  'R90-A C1 (D7): WITH CHECK 강제 — user_id 위조 방지';
