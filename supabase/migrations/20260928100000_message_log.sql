-- 알림톡 발송 기록 (2026-09-28, docs/MARKET_HUB_AND_ALIMTALK_PLAN_2026_10.md §2).
--
-- 솔라피는 멱등키를 주지 않는다 → 같은 이벤트가 두 번 와도(크론 재시도·웹훅 재전송) 한 번만
-- 보내도록 (event_type, source_id, channel) unique 로 **발송 전에 자리를 먼저 잡는다**.
-- 결과는 솔라피 웹훅(single-report)이 provider_message_id 로 갱신한다.
-- 번호는 마스킹(to_masked)만 남긴다 — 원번호는 주문·구독 행에 이미 있다.
-- service_role 전용(RLS on, 정책 없음, anon/authenticated 권한 회수).

create table if not exists public.message_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid,
  event_type text not null,
  source_id text not null,
  channel text not null check (channel in ('alimtalk', 'sms')),
  template_code text not null,
  to_masked text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'delivered', 'failed')),
  provider_message_id text,
  provider_group_id text,
  status_code text,
  error text,
  constraint message_log_once unique (event_type, source_id, channel)
);

comment on table public.message_log is '알림톡·문자 발송 기록 — 이벤트당 1회(unique), 결과는 솔라피 웹훅이 갱신';

create index if not exists message_log_created_idx on public.message_log (created_at desc);
create index if not exists message_log_provider_idx on public.message_log (provider_message_id);

alter table public.message_log enable row level security;
revoke all on table public.message_log from anon, authenticated;
