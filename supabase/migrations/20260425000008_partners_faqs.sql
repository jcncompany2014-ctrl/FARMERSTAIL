-- Migration: partners + faqs (admin 관리 가능 콘텐츠)
-- Why: /partners, /faq 페이지가 hardcoded array. admin 이 SQL 안 쓰고 추가/수정/
-- 삭제 가능하도록 DB 로 끌어내림. 마이그레이션 적용 후 페이지가 fallback (DB 비어있으면
-- hardcoded) → DB 우선 으로 전환되도록 페이지 코드도 함께 갱신.

-- ── partners ───────────────────────────────────────────────────
create table if not exists public.partners (
  id            uuid primary key default gen_random_uuid(),
  region        text not null,                  -- "강원 평창"
  name          text not null,                  -- "평창 청옥 한우농가"
  ingredient    text not null,                  -- "한우 안심 / 양지"
  body          text not null,                  -- 본문 설명
  cert          text,                           -- 인증 (1++ / HACCP)
  image_url     text,
  is_published  boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists partners_published_idx
  on public.partners (is_published, sort_order);

create or replace function public.tg_partners_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists partners_set_updated_at on public.partners;
create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.tg_partners_set_updated_at();

-- ── faqs ─────────────────────────────────────────────────────
create table if not exists public.faqs (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('식단·영양', '배송·환불', '결제', '정기배송')),
  question      text not null,
  answer        text not null,
  is_published  boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists faqs_published_idx
  on public.faqs (is_published, category, sort_order);

create or replace function public.tg_faqs_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists faqs_set_updated_at on public.faqs;
create trigger faqs_set_updated_at
  before update on public.faqs
  for each row execute function public.tg_faqs_set_updated_at();

-- RLS ────────────────────────────────────────────────────────
alter table public.partners enable row level security;
alter table public.faqs     enable row level security;

drop policy if exists "partners public read" on public.partners;
create policy "partners public read"
  on public.partners for select to anon, authenticated
  using (is_published = true);

drop policy if exists "partners admin all" on public.partners;
create policy "partners admin all"
  on public.partners for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "faqs public read" on public.faqs;
create policy "faqs public read"
  on public.faqs for select to anon, authenticated
  using (is_published = true);

drop policy if exists "faqs admin all" on public.faqs;
create policy "faqs admin all"
  on public.faqs for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Seed (개발 / 첫 배포 fallback) ─────────────────────────────
insert into public.partners (region, name, ingredient, body, cert, sort_order) values
  ('강원 평창', '평창 청옥 한우농가', '한우 안심 / 양지',
   '해발 700m 이상 청정 목초지에서 방목·곡물 병행 사육. 도축 24시간 내 작업장 도착, 익일 조리.',
   '1++ / HACCP', 1),
  ('전남 완도', '완도 청해진수산', '자연산 연어 / 황태',
   '양식이 아닌 자연산만 입고. 수은·중금속 검사 매 배치 외부기관 의뢰.',
   '수산물 위생증명', 2),
  ('제주 구좌', '구좌 무농약 당근밭', '당근 / 비트',
   '4년 윤작·무농약 인증. 화학 비료 / 제초제 일체 미사용. 수확 후 24시간 내 입고.',
   '무농약 인증', 3),
  ('충북 괴산', '괴산 유기 귀리', '귀리 / 현미',
   '국내 1세대 유기 곡물 농가. 잔류 농약 제로. 도정 후 1주 안에 사용.',
   '유기농 인증', 4)
on conflict do nothing;

insert into public.faqs (category, question, answer, sort_order) values
  ('식단·영양', '하루에 얼마나 먹여야 하나요?',
   '체중과 활동량에 따라 다르며, 패키지에 일일 권장 급여량이 표기돼 있어요. 정밀한 권장량은 마이페이지 → 우리 아이 등록 후 자동 계산됩니다.', 1),
  ('식단·영양', '사료에서 화식으로 바로 바꿔도 되나요?',
   '갑작스런 전환은 장에 부담이 될 수 있어요. 7일에 걸쳐 화식 비율을 25% → 50% → 75% → 100% 로 늘려가는 방식을 권장합니다.', 2),
  ('배송·환불', '평일 몇 시까지 결제해야 다음날 받을 수 있나요?',
   '평일 오후 1시까지 결제 시 익일 출고, 일반적으로 결제일 + 2 영업일 이내 도착합니다. 도서산간 1일 추가.', 1),
  ('배송·환불', '배송비는 얼마인가요?',
   '3만원 이상 무료배송 / 미만 3,000원. 도서산간 +3,000원.', 2),
  ('결제', '어떤 결제 수단을 지원하나요?',
   '신용/체크카드 · 카카오페이 · 토스페이 · 가상계좌 · 휴대폰 결제. 토스페이먼츠를 통해 처리되며 카드 정보는 당사 서버에 저장되지 않습니다.', 1),
  ('정기배송', '정기배송은 어떻게 시작하나요?',
   '정기배송 가능 상품 페이지에서 "정기배송으로 시작" 을 누르면 주기를 선택할 수 있어요.', 1)
on conflict do nothing;
