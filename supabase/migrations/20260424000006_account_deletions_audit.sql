-- 20260424000006_account_deletions_audit.sql
--
-- 회원 탈퇴 이력 감사 테이블. 개인정보보호법 제21조 (파기) 와 전자상거래법 제6조
-- (거래 기록 5년 보존) 의 충돌을 관리하기 위해:
--   - profiles.deleted_at 로 소프트 삭제 표시
--   - auth.users 는 shouldSoftDelete 로 비활성화
--   - 별도 `account_deletions` 에 "언제 / 왜 / 원본 이메일 해시" 만 남겨
--     재가입 방지·민원 대응·CS 문의 답변에 사용.
--
-- 원본 이메일을 평문으로 남기지 않는다 — sha256 해시만 보관해
-- "동일 이메일로 재가입 시도했는지" 만 탐지 가능.

BEGIN;

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  -- 유저가 탈퇴 시 자발적으로 남긴 사유 (선택). 200자 제한.
  reason text,
  -- sha256(lower(trim(원본 이메일))). 해시 일치로 재가입/재탈퇴 패턴 식별.
  email_hash text,
  -- 탈퇴 직전 진행 중이던 주문 수 — churn 분석/규제 대응 참고용.
  open_order_count int default 0
);

create index if not exists account_deletions_email_hash
  on public.account_deletions(email_hash);
create index if not exists account_deletions_time
  on public.account_deletions(deleted_at desc);

-- RLS: 본인 조회 가능 (탈퇴 후 접근은 당연히 막히므로 실질 의미는 관리자 전용).
alter table public.account_deletions enable row level security;

drop policy if exists account_deletions_admin_select on public.account_deletions;
create policy account_deletions_admin_select on public.account_deletions
  for select
  using (public.is_admin());

-- 편의용 해시 헬퍼. pgcrypto 의 digest 를 hex 로 인코딩.
create extension if not exists pgcrypto;

create or replace function public.sha256_hex(input text)
returns text
language sql
immutable
as $$
  select encode(digest(lower(trim(coalesce(input, ''))), 'sha256'), 'hex');
$$;

COMMIT;
