-- ============================================================================
-- Migration: events table — 랜딩 / 대시보드 / /events 페이지에서 노출되는
--             공개 이벤트 메타. 관리자가 /admin/events 에서 CRUD.
-- ============================================================================
--
-- 배경
-- ----
-- 지금까지 이벤트 데이터는 `lib/events/data.ts` 의 `MOCK_EVENTS` 배열로
-- 하드코딩되어 있었다. 기간 · 할인율 · 설명 · 쿠폰코드가 전부 code repo 에
-- 박혀 있어서, 시즌 프로모션을 돌리려면 코드 수정 + 배포 루프를 타야 했다.
--
-- 이 마이그레이션이 events 테이블을 만들고, 호출부 (`getActiveEvents`,
-- `getEventBySlug`) 는 Supabase fetch 로 대체된다. 관리자 UI (/admin/events)
-- 에서 상시 편집 가능.
--
-- 왜 쿠폰 테이블과 따로인가
-- ------------------------------
-- `coupons` 는 체크아웃에서 실제 할인을 계산하는 **규칙**. `events` 는 유저
-- 에게 노출되는 **프로모션 페이지** (magazine-style editorial + CTA). 한
-- 쿠폰이 여러 이벤트에서 노출될 수도, 이벤트 없이 쿠폰만 존재할 수도 있다
-- → 1:N 분리가 자연스럽다. 연결은 `coupon_code` text 소프트키로.
--
-- welcome 같은 "자동 혜택" 이벤트는 쿠폰과 매핑되지 않고 signup trigger /
-- checkout 로직에서 별도로 처리된다 (ctaVariant='benefit-auto').
--
-- RLS
-- ---
--  * SELECT: 퍼블릭 (is_active=true). 랜딩 & /events 는 비로그인 포함 전체
--    유저가 본다.
--  * INSERT/UPDATE/DELETE: admin 전용. `public.is_admin()` 헬퍼 사용.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- URL slug. `/events/[slug]` 경로에 그대로 꽂히므로 소문자 + 하이픈만.
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),

  -- 카드 / 리스트 / 상세 hero 에 공통으로 나오는 표시 필드.
  kicker text NOT NULL,
  en_title text NOT NULL,
  ko_subtitle text NOT NULL,
  tagline text NOT NULL,
  highlight text NOT NULL,

  -- 진행 기간. ends_at > starts_at CHECK.
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  CONSTRAINT events_period_valid CHECK (ends_at > starts_at),

  -- 상태 라벨 (우상단 chip). "LIVE · D-1" / "ONGOING" / "D-30" 식. 관리자가
  -- 직접 입력. 비우면 렌더 시점에 날짜 기반으로 계산(현재 호출부는 단순
  -- 필드 그대로 표시하므로 admin 이 적절히 채워 넣는다).
  status_label text NOT NULL DEFAULT 'ONGOING',

  -- palette — 상세 hero / 카드 배경 테마. 앱의 디자인 토큰 4개로 제한.
  palette text NOT NULL DEFAULT 'ink'
    CHECK (palette IN ('ink', 'terracotta', 'moss', 'gold')),

  -- 이벤트 성격 분기. 'welcome' 은 로그인 + created_at 기반 3시간 타이머
  -- 블록으로 렌더. 나머지는 'default'.
  kind text NOT NULL DEFAULT 'default'
    CHECK (kind IN ('default', 'welcome')),

  -- 상세 페이지 primary CTA. 'coupon-claim' → 쿠폰 코드 복사 버튼,
  -- 'benefit-auto' → 자동 적용 안내 (welcome 혜택 등).
  cta_variant text NOT NULL DEFAULT 'coupon-claim'
    CHECK (cta_variant IN ('coupon-claim', 'benefit-auto')),

  -- 쿠폰 이벤트일 때만. coupons.code 와 soft-link (text). 쿠폰 삭제/코드
  -- 변경 시 자동 연동은 없음 — 관리자가 수동으로 관리.
  coupon_code text,

  -- 상세 페이지 긴 본문 blocks.
  detail_lede text NOT NULL DEFAULT '',
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  terms jsonb NOT NULL DEFAULT '[]'::jsonb,  -- string[]

  -- 상세 하단 보조 CTA (옵션). `{"label": "...", "href": "..."}` 혹은 null.
  cta_secondary jsonb,

  -- 정렬 우선순위 — 높을수록 먼저. 같으면 starts_at desc.
  sort_priority int NOT NULL DEFAULT 0,

  -- is_active=false 면 공개 노출에서 빠짐 (관리자는 전체 조회 가능).
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 공개 쿼리 (is_active + now range + sort) 를 위한 복합 인덱스.
CREATE INDEX IF NOT EXISTS events_active_window_idx
  ON public.events (is_active, ends_at, starts_at);

CREATE INDEX IF NOT EXISTS events_sort_priority_idx
  ON public.events (sort_priority DESC, starts_at DESC);

-- updated_at 자동 갱신 트리거 — app 에서 매번 쓰지 않아도 되게.
CREATE OR REPLACE FUNCTION public.events_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 — 활성 이벤트만. 비활성 이벤트는 admin 전용.
-- 기간 필터는 app 레이어에서 걸어도 되고 SQL 단에서 걸어도 되지만, RLS 는
-- **노출 가능성** 만 통제하고 "지금 보여줄지" 는 호출부 쿼리에 맡긴다.
-- (관리자 프리뷰에서 "아직 시작 전" 이벤트를 미리 보고 싶을 수 있으므로.)
CREATE POLICY events_public_read ON public.events
  FOR SELECT
  USING (is_active = true);

-- 관리자 전체 읽기 (비활성 포함).
CREATE POLICY events_admin_read ON public.events
  FOR SELECT
  USING (public.is_admin());

-- 관리자 전용 INSERT / UPDATE / DELETE.
CREATE POLICY events_admin_insert ON public.events
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY events_admin_update ON public.events
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY events_admin_delete ON public.events
  FOR DELETE
  USING (public.is_admin());

-- ── Seed: 기존 MOCK_EVENTS 3개 이관 ──────────────────────────────────────
-- 서비스 시작 시 페이지가 empty 로 뜨지 않도록 mock 데이터를 그대로 insert.
-- slug UNIQUE 덕분에 재실행해도 중복되지 않음 (ON CONFLICT DO NOTHING).
INSERT INTO public.events (
  slug, kicker, en_title, ko_subtitle, tagline, highlight,
  starts_at, ends_at, status_label, palette, kind, cta_variant, coupon_code,
  detail_lede, perks, terms, cta_secondary, sort_priority, is_active
) VALUES
(
  'black-friday',
  'Limited · 블랙 프라이데이',
  'BLACK FRIDAY',
  '연중 최대 혜택',
  '수의영양학으로 설계한 전 라인, 단 4일. 재고 소진 시 조기 마감될 수 있어요.',
  '최대 50% OFF',
  '2026-11-28T00:00:00+09:00',
  '2026-12-01T23:59:59+09:00',
  'LIVE · D-1',
  'ink',
  'default',
  'coupon-claim',
  'BF2026',
  '연간 가장 큰 폭으로 가격이 움직이는 단 4일. 화식·간식·체험팩 전 라인이 일제히 세일 구간으로 들어갑니다.',
  '["전 라인 최대 50% 할인","₩70,000 이상 주문 시 무료배송","정기배송 신규 가입 시 추가 10% 중복 할인"]'::jsonb,
  '["2026.11.28 00:00 – 2026.12.01 23:59 KST 기간 한정","재고 소진 시 사전 공지 없이 마감될 수 있어요","쿠폰은 1인 1회 사용, 타 쿠폰과 중복 사용 불가"]'::jsonb,
  '{"label":"세일 상품 보러 가기","href":"/products?event=black-friday"}'::jsonb,
  30,
  true
),
(
  'welcome',
  'First Order · 첫 주문 혜택',
  'WELCOME',
  '처음이신가요?',
  '앱 최초 가입 시 ₩5,000 즉시 할인 + 첫 배송 무료. 중복 사용 가능.',
  '₩5,000 + 무료배송',
  '2026-04-01T00:00:00+09:00',
  '2026-05-31T23:59:59+09:00',
  'ONGOING',
  'terracotta',
  'welcome',
  'benefit-auto',
  NULL,
  '처음 파머스테일을 만난 우리 아이에게 드리는 환영 선물. 가입 직후 3시간 안에 장보러 가시면 자동으로 적용돼요.',
  '["₩5,000 즉시 할인 (최소 주문 ₩15,000)","첫 배송 무료 — 새벽/일반 모두 가능","중복 사용 가능 — 다른 쿠폰과 함께"]'::jsonb,
  '["가입 후 3시간 이내 주문 시에만 적용","1회 주문에 한해 사용","주문 취소 시 혜택은 복구되지 않아요"]'::jsonb,
  '{"label":"지금 장보러 가기","href":"/products?welcome=1"}'::jsonb,
  20,
  true
),
(
  'subscription-launch',
  'New · 정기배송 런칭',
  'SUBSCRIBE',
  '매달 배송, 매달 할인',
  '정기배송 가입 시 전 품목 상시 20% 할인. 배송 간격은 자유롭게 조정.',
  '-20% 상시',
  '2026-04-15T00:00:00+09:00',
  '2026-06-15T23:59:59+09:00',
  'D-30',
  'moss',
  'default',
  'coupon-claim',
  'SUBLAUNCH',
  '매달 잊지 않고 챙기기 위해 시작한 정기배송. 런칭을 기념해 가입자 전원에게 상시 20% 할인 코드를 드려요.',
  '["전 품목 정기배송 시 상시 20% 할인","배송 간격 2 / 4 / 6주 자유 조정","언제든 일시정지 · 해지 가능, 위약금 없음"]'::jsonb,
  '["정기배송 가입 시점에 자동 적용","1회성 주문에는 사용 불가","런칭 프로모션은 2026.06.15 까지 가입자 한정"]'::jsonb,
  '{"label":"정기배송 플랜 보기","href":"/plans"}'::jsonb,
  10,
  true
)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE public.events IS
  '공개 프로모션 이벤트 메타. 랜딩 / 대시보드 / /events 페이지에 노출되고 /admin/events 에서 CRUD.';
COMMENT ON COLUMN public.events.coupon_code IS
  'coupons.code 와 soft-link. cta_variant=coupon-claim 일 때만 의미 있음.';
COMMENT ON COLUMN public.events.kind IS
  'welcome 은 유저 created_at 기준 3시간 카운트다운으로 렌더. default 는 일반 CTA.';

COMMIT;
