-- ─────────────────────────────────────────────────────────────────────────────
-- 어드민 화면이 브라우저에서 직접 바꾸는 표에 감사 기록 (2026-09-26 출시 전 점검 6차)
--
-- 구독 상태(일시정지·해지·재개)·상품(가격·재고·판매 여부)·추천 알고리즘 설정·자동화 스위치는
-- 어드민 화면이 브라우저 Supabase 클라이언트로 바로 쓴다(RLS is_admin). 서버 라우트가 아니라
-- recordAdminAction 이 한 번도 불리지 않아 "누가 언제 무엇을 바꿨나"가 남지 않았다.
-- 화면 코드를 서버 라우트로 옮기는 대신(잘 도는 화면을 깨뜨릴 위험) DB 에서 한 번에 잡는다.
--
-- 누구를 기록하나: auth.uid() 가 있고 is_admin() 인 요청만.
--   · 고객 본인이 자기 구독을 바꾸는 것(4칸 화이트리스트) → 관리자 아님 → 기록 안 함
--   · 서버(service_role, 크론) → auth.uid() null → 기록 안 함(서버 라우트는 recordAdminAction 이 따로 남긴다)
-- 무엇을: UPDATE 는 바뀐 칸만 {from,to}, INSERT/DELETE 는 행 전체. 결제 키 칸은 절대 싣지 않는다.
-- 실패해도 운영 조작을 막지 않는다(감사 기록 insert 오류는 삼킨다 — AFTER 트리거 + 예외 블록).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.audit_admin_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_pk text := tg_argv[0];
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb;
  v_id text;
begin
  -- 두 단계로 나눈다: 크론·서버(uid 없음)는 auth.users 조회 없이 바로 빠진다(청구 크론이 행마다 부른다).
  if v_uid is null then
    return null;
  end if;
  if not public.is_admin() then
    return null;
  end if;

  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old) - 'billing_key' - 'billing_customer_key';
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new) - 'billing_key' - 'billing_customer_key';
  end if;
  v_id := coalesce(v_new ->> v_pk, v_old ->> v_pk);

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(e.key, jsonb_build_object('from', v_old -> e.key, 'to', e.value))
      into v_diff
      from jsonb_each(v_new) as e
     where (v_old -> e.key) is distinct from e.value
       and e.key <> 'updated_at';
    if v_diff is null then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    v_diff := jsonb_build_object('new', v_new);
  else
    v_diff := jsonb_build_object('old', v_old);
  end if;

  begin
    insert into public.admin_audit_log (actor_user_id, action, entity_type, entity_id, diff)
    values (v_uid, 'db_' || lower(tg_op), tg_table_name, v_id, v_diff);
  exception when others then
    raise warning '[admin-audit trigger] % %: %', tg_table_name, tg_op, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.audit_admin_row_change() from public, anon, authenticated;

drop trigger if exists audit_admin_change on public.subscriptions;
create trigger audit_admin_change after update on public.subscriptions
  for each row execute function public.audit_admin_row_change('id');

drop trigger if exists audit_admin_change on public.products;
create trigger audit_admin_change after insert or update or delete on public.products
  for each row execute function public.audit_admin_row_change('id');

drop trigger if exists audit_admin_change on public.algorithm_food_lines;
create trigger audit_admin_change after insert or update or delete on public.algorithm_food_lines
  for each row execute function public.audit_admin_row_change('line');

drop trigger if exists audit_admin_change on public.algorithm_breed_predispose;
create trigger audit_admin_change after insert or update or delete on public.algorithm_breed_predispose
  for each row execute function public.audit_admin_row_change('breed_key');

drop trigger if exists audit_admin_change on public.algorithm_chronic_severity;
create trigger audit_admin_change after insert or update or delete on public.algorithm_chronic_severity
  for each row execute function public.audit_admin_row_change('condition');

drop trigger if exists audit_admin_change on public.automation_settings;
create trigger audit_admin_change after update on public.automation_settings
  for each row execute function public.audit_admin_row_change('id');
