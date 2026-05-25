-- R16-E48 (2026-05-25): product_reviews 테이블 + RLS.
-- 정식 review system. mypage/reviews placeholder 였던 영역을 본격 가동.
-- (이 파일은 history 기록 — MCP 로 이미 production DB 에 적용됨)

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  dog_id UUID REFERENCES dogs(id) ON DELETE SET NULL,
  order_id UUID,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT NOT NULL,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejected_reason TEXT,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  CONSTRAINT product_reviews_user_product UNIQUE (user_id, product_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_pending ON product_reviews(created_at) WHERE status = 'pending';

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_reviews_select_own" ON product_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "product_reviews_select_public" ON product_reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "product_reviews_insert_own" ON product_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "product_reviews_update_own" ON product_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "product_reviews_delete_own" ON product_reviews FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS product_reviews_updated_at ON product_reviews;
CREATE TRIGGER product_reviews_updated_at BEFORE UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
