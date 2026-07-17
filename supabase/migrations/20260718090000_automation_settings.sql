-- 운영 자동화 설정 (2026-07-17 사장님: admin 에서 직접 조절)
--
-- # 목적
-- 코드 배포 없이 운영자가 조절할 값만 DB 로 뺀다:
--   · represcription_enabled — 처방 재제안 전체 kill switch(문제 생기면 즉시 OFF)
--   · marketing_push_hour    — 라이프사이클 마케팅 알림(D+1/D+7/D+30)이 나가는 KST 시각
--
-- 박스 개수(재검토 주기)·승인 대기 기간은 **일부러 코드에 둔다** — 임상 정합성이
-- 걸린 값이라(2박스로 줄이면 종합 체크인이 죽는 등) 정본 lib/personalization/cycle 의
-- 불변식 테스트로 보호한다.
--
-- # 안전망 (algorithm_food_lines 와 동일 패턴)
-- 행이 없으면 코드가 기본값으로 fallback → 이 테이블이 비어도/없어도 zero-downtime.
-- 싱글턴: id=1 한 행만. CHECK 로 다른 id 삽입 차단.

create table if not exists public.automation_settings (
  id smallint primary key default 1 check (id = 1),
  represcription_enabled boolean not null default true,
  marketing_push_hour smallint not null default 10
    check (marketing_push_hour >= 0 and marketing_push_hour <= 23),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table public.automation_settings is
  '운영 자동화 스위치(싱글턴 id=1). 비어 있으면 코드 기본값 fallback — 지우면 안 되지만 지워도 무해.';

-- 기본 행 1개 시드 (없을 때만).
insert into public.automation_settings (id) values (1)
  on conflict (id) do nothing;

alter table public.automation_settings enable row level security;

-- admin 만 읽고 쓴다. 크론은 service-role 이라 RLS 무관.
drop policy if exists automation_settings_admin_read on public.automation_settings;
create policy automation_settings_admin_read on public.automation_settings
  for select using (public.is_admin());

drop policy if exists automation_settings_admin_write on public.automation_settings;
create policy automation_settings_admin_write on public.automation_settings
  for update using (public.is_admin()) with check (public.is_admin());
