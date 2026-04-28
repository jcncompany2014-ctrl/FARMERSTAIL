-- ============================================================================
-- Migration: events 테이블에 이미지 필드 추가 + events 스토리지 버킷 생성.
-- ============================================================================
--
-- 배경
-- ----
-- `20260424000007_events.sql` 로 이벤트 테이블을 만들고 나서, 랜딩 카드 /
-- 상세 hero 가 전부 palette 단색 배경 + 텍스트로만 구성되어 있었다. 에디토
-- 리얼 톤이라 단색도 "의도된" 느낌이지만, 실제 운영에선 블랙프라이데이 · 웰컴
-- · 정기배송처럼 성격이 다른 이벤트마다 시그니처 이미지를 깔아야 전환율이
-- 붙는다 (유저가 스크롤 1초 안에 "무슨 이벤트인지" 읽어낼 수 있어야 하므로).
--
-- 스키마 결정
-- -----------
-- 필드 두 개만 추가:
--   * image_url text  — 카드 / hero 양쪽에서 공통 사용. 같은 이미지를 두 곳
--                       에 쓰는 게 이벤트 IPX (identity) 관점에서 자연스럽다.
--                       카드는 4:5 크롭, hero 는 풀블리드 — object-fit: cover
--                       로 CSS 에서 해결.
--   * image_alt text  — 접근성. 비우면 en_title 을 fallback 으로 렌더.
--
-- 별도 card_image_url / hero_image_url 로 쪼갤 수도 있었지만, 운영 복잡도가
-- 2배로 뛰는 반면 실익은 낮다 (이벤트 수 < 10). 필요해지면 나중에 컬럼만
-- 추가하면 호환.
--
-- 스토리지 버킷
-- -------------
-- `public.events` 테이블과 이름 충돌을 피하려고 버킷 이름은 `event-images`.
-- RLS:
--   * SELECT: anon/authenticated 전부. 랜딩은 비로그인도 보니까 필수.
--   * INSERT/UPDATE/DELETE: admin 전용. `public.is_admin()` 헬퍼.
-- ============================================================================

BEGIN;

-- ── 컬럼 추가 ──────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_alt text;

COMMENT ON COLUMN public.events.image_url IS
  '이벤트 대표 이미지 — 카드 배경 (overlay 위) + 상세 hero backdrop 에 동일 소스로 쓰임. event-images 버킷의 public URL.';
COMMENT ON COLUMN public.events.image_alt IS
  '이미지 alt 텍스트 (a11y). 비우면 en_title 이 fallback.';

-- ── 스토리지 버킷 ──────────────────────────────────────────────────────────
-- public=true 로 만들어 `getPublicUrl()` 이 서명 없이 바로 URL 을 돌려주게 한다
-- (서명 URL 은 TTL 관리가 귀찮고, 랜딩에선 CDN 캐시와 궁합도 안 좋음).
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- ── 스토리지 RLS ──────────────────────────────────────────────────────────
-- storage.objects 에 이미 RLS 가 켜져있다. 정책만 추가.

DROP POLICY IF EXISTS "event-images public read" ON storage.objects;
CREATE POLICY "event-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images');

DROP POLICY IF EXISTS "event-images admin insert" ON storage.objects;
CREATE POLICY "event-images admin insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-images' AND public.is_admin());

DROP POLICY IF EXISTS "event-images admin update" ON storage.objects;
CREATE POLICY "event-images admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'event-images' AND public.is_admin());

DROP POLICY IF EXISTS "event-images admin delete" ON storage.objects;
CREATE POLICY "event-images admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-images' AND public.is_admin());

COMMIT;
