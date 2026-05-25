-- R15-B (2026-05-25): 5개 새 dog 관련 테이블 마이그레이션.
--
-- R14 에서 클라이언트 localStorage 기반으로 시작한 페이지들 (vaccinations,
-- medications, expenses) 을 DB 영속화. 추가로 B18 (activity_logs / QuickLog),
-- B12 (dog_connections / 견 친구) 도 함께 생성.
--
-- 모두 RLS 활성, user_id 기준 격리. dog_id 외래키 + ON DELETE CASCADE.

-- =============================================================================
-- 1. dog_vaccinations (B11)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dog_vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 백신 종류 — DHPPL / Corona / KennelCough / Rabies / Heartworm / Other
  vaccine TEXT NOT NULL,
  -- 접종일 (yyyy-mm-dd)
  date DATE NOT NULL,
  -- 다음 일정 (옵션, nullable)
  next_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dog_vaccinations_dog_id ON dog_vaccinations(dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_vaccinations_user_id ON dog_vaccinations(user_id);
CREATE INDEX IF NOT EXISTS idx_dog_vaccinations_next ON dog_vaccinations(next_date) WHERE next_date IS NOT NULL;

ALTER TABLE dog_vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dog_vaccinations_select_own" ON dog_vaccinations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dog_vaccinations_insert_own" ON dog_vaccinations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dog_vaccinations_update_own" ON dog_vaccinations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dog_vaccinations_delete_own" ON dog_vaccinations
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 2. dog_medications (B12)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dog_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  schedule TEXT NOT NULL CHECK (schedule IN ('daily', 'weekly', 'asneeded')),
  -- HH:MM (텍스트 — 단순 표시용)
  time TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dog_medications_dog_id ON dog_medications(dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_medications_user_id ON dog_medications(user_id);
CREATE INDEX IF NOT EXISTS idx_dog_medications_enabled
  ON dog_medications(dog_id, enabled) WHERE enabled = TRUE;

ALTER TABLE dog_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dog_medications_select_own" ON dog_medications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dog_medications_insert_own" ON dog_medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dog_medications_update_own" ON dog_medications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dog_medications_delete_own" ON dog_medications
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 3. dog_expenses (B13)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dog_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('food', 'vet', 'snack', 'supplies', 'etc')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dog_expenses_dog_id ON dog_expenses(dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_expenses_user_id ON dog_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_dog_expenses_date ON dog_expenses(dog_id, date DESC);

ALTER TABLE dog_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dog_expenses_select_own" ON dog_expenses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dog_expenses_insert_own" ON dog_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dog_expenses_update_own" ON dog_expenses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dog_expenses_delete_own" ON dog_expenses
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 4. activity_logs (B14 / B18)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 활동 유형 — meal / walk / poop / play / sleep / other
  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('meal', 'walk', 'poop', 'play', 'sleep', 'water', 'other')
  ),
  -- 시간 (실제 발생 시각, optional — null 이면 created_at)
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 활동별 추가 데이터 (분, 그램 등)
  duration_min INTEGER,
  amount NUMERIC(6, 2),
  unit TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_dog_id ON activity_logs(dog_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_occurred
  ON activity_logs(dog_id, occurred_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select_own" ON activity_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activity_logs_insert_own" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activity_logs_update_own" ON activity_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "activity_logs_delete_own" ON activity_logs
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 5. dog_connections (B15 / 견 친구 시스템)
-- =============================================================================
-- 양방향 친구 관계 — 한 쌍당 한 row. UNIQUE constraint 로 중복 방지.
-- requester_dog_id < receiver_dog_id (사전식) 정렬해서 항상 같은 row.
CREATE TABLE IF NOT EXISTS dog_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- requester (작은 UUID)
  requester_dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- receiver (큰 UUID)
  receiver_dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  receiver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 상태 — pending / accepted / blocked
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'blocked')
  ),
  -- 어떤 견을 통해 만났는지 (산책로 / 동네 / 견종)
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT dog_connections_pair_unique UNIQUE (requester_dog_id, receiver_dog_id),
  -- 자기 자신과 친구 못 함
  CONSTRAINT dog_connections_no_self CHECK (requester_dog_id <> receiver_dog_id),
  -- 정렬 보장 (requester < receiver, UUID 비교)
  CONSTRAINT dog_connections_sorted CHECK (requester_dog_id < receiver_dog_id)
);

CREATE INDEX IF NOT EXISTS idx_dog_connections_requester
  ON dog_connections(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_dog_connections_receiver
  ON dog_connections(receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_dog_connections_status
  ON dog_connections(status) WHERE status = 'pending';

ALTER TABLE dog_connections ENABLE ROW LEVEL SECURITY;

-- 양쪽 사용자 모두 조회 가능
CREATE POLICY "dog_connections_select_either" ON dog_connections
  FOR SELECT USING (
    auth.uid() = requester_user_id OR auth.uid() = receiver_user_id
  );
-- requester 만 insert 가능
CREATE POLICY "dog_connections_insert_requester" ON dog_connections
  FOR INSERT WITH CHECK (auth.uid() = requester_user_id);
-- receiver 만 status update (수락/거절)
CREATE POLICY "dog_connections_update_receiver" ON dog_connections
  FOR UPDATE USING (auth.uid() = receiver_user_id);
-- 양쪽 모두 delete 가능
CREATE POLICY "dog_connections_delete_either" ON dog_connections
  FOR DELETE USING (
    auth.uid() = requester_user_id OR auth.uid() = receiver_user_id
  );

-- =============================================================================
-- updated_at 자동 갱신 trigger (vaccinations / medications 에만)
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dog_vaccinations_updated_at ON dog_vaccinations;
CREATE TRIGGER dog_vaccinations_updated_at
  BEFORE UPDATE ON dog_vaccinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS dog_medications_updated_at ON dog_medications;
CREATE TRIGGER dog_medications_updated_at
  BEFORE UPDATE ON dog_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
