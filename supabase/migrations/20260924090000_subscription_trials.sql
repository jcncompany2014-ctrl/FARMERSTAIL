-- 구독 체험단 가격표 (docs/TRIAL_PROGRAM_2026_10.md v2 · 2026-09-24)
--
-- 어드민이 선발 계정에 "도장"을 찍으면, 청구가 3단으로 흐른다:
--   ① cheap_remaining 회차 동안: 박스당 cheap_price 원 (기본 100원 — 10원은
--      카드 최소금액 거절→3회 실패 정지 리스크로 기각, 결제감사 #7 참조)
--   ② half_remaining 회차 동안: 자기 산출 구독가(total_amount)의 half_rate (기본 50%)
--   ③ 소진 후: 정상 (행은 기록으로 남는다 — 체험단 이력 조회용)
--
-- 회차 차감은 **결제 성공 시에만** (프로모션 소진과 같은 원칙 — 결제감사 #3).
-- 전환 기준은 날짜가 아니라 회차 — 건너뛰기로 혜택이 증발하지 않는다.
--
-- RLS: 정책 없음 = service_role 전용. 돈이 걸린 칸이라 고객·anon 접근 차단
-- (subscriptions 돈컬럼 잠금과 같은 원칙). 고객 화면 표시는 서버 컴포넌트가
-- service_role 로 읽어 그린다.

create table if not exists public.subscription_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cheap_remaining integer not null default 4 check (cheap_remaining >= 0),
  half_remaining integer not null default 4 check (half_remaining >= 0),
  cheap_price integer not null default 100 check (cheap_price >= 100),
  half_rate numeric not null default 0.5 check (half_rate > 0 and half_rate < 1),
  note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table public.subscription_trials is
  '체험단 3단 가격표. cheap_price>=100 체크 = 카드 최소금액 사고 방지(10원 금지를 DB가 강제).';

alter table public.subscription_trials enable row level security;
-- 정책을 만들지 않는다 = anon/authenticated 전부 차단, service_role 만 통과.
