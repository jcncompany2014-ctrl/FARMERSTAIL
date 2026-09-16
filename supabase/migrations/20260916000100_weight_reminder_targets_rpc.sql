-- weight-reminder 크론이 2026-05 부터 호출해 온 RPC — 한 번도 만들어진 적이 없어
-- 매주 PGRST202(404) 뒤 N+1 폴백으로만 돌았다(2026-09-16 전수 점검). 코드가 기대하는
-- 형태(id, user_id, name, last_weighed) 그대로. 판정은 폴백과 같다: 기록이 없거나
-- 마지막 측정일(KST)이 cutoff_date 보다 앞이면 대상(cutoff 당일 기록은 최신으로 본다).
-- 프로덕션 적용: 2026-09-16 MCP. 실행 권한: postgres·service_role 만(anon/authenticated 없음).
-- 검증: 함수 본문과 같은 SELECT 를 읽기전용 롤로 실행해 행 수 확인.
create or replace function public.weight_reminder_targets(cutoff_date date, max_rows integer default 200)
returns table (id uuid, user_id uuid, name text, last_weighed timestamptz)
language sql
stable
set search_path to 'public', 'pg_catalog'
as $$
  select d.id, d.user_id, d.name::text, w.last_weighed
  from public.dogs d
  left join lateral (
    select max(wl.measured_at) as last_weighed
    from public.weight_logs wl
    where wl.dog_id = d.id
  ) w on true
  where w.last_weighed is null or (w.last_weighed at time zone 'Asia/Seoul')::date < cutoff_date
  order by w.last_weighed nulls first, d.id
  limit greatest(1, coalesce(max_rows, 200))
$$;

revoke execute on function public.weight_reminder_targets(date, integer) from public, anon, authenticated;
