-- 어드민 배송지 고치기 — 바꾸기 전 값 기록 (2026-10-15 어드민 수정 F-b, 규칙276).
--
-- # 왜
-- 10/14 고객 화면(C5)의 '배송지 고치기'는 기본 배송지(addresses)와 결제된 발송 대기 주문(orders)의 받는 분·전화·주소를 덮어쓴다.
-- 작업 기록(admin_audit_log)에는 바뀐 칸 이름만 남겼다(규칙257 — 주소 원문을 지울 수 없는 기록에 넣지 않는다). 그래서 다른 손님을
-- 눌러 고쳤거나 오타를 내면 원래 주소를 되살릴 방법이 없었고, 결제 원장(orders)의 '결제할 때의 주소'도 흔적 없이 바뀌었다.
-- 옛 값은 이 표에 남긴다 — 고객 개인정보라 **탈퇴하면 같이 지운다**(app/api/account/delete — auth 는 soft delete 라 FK cascade 는
-- 5년 뒤 영구 삭제 때에만 돈다). 작업 기록에는 이 표의 행 id 와 바뀐 주문 id 만 남긴다.
--
-- # 쓰는 곳
-- app/api/admin/users/[id]/address — 고치기 **전에** 한 줄(applied=false)을 넣고, 바꾼 뒤 applied=true·바뀐 주문 id 를 채운다.
-- 기록을 못 넣으면 배송지를 바꾸지 않는다(되살릴 단서 없이 바꾸지 않는다).
--
-- # 권한
-- 고객(anon·authenticated)은 쓰지 못한다. 읽기는 관리자(is_admin())만, 쓰기는 서버(service_role) — admin_customer_notes 와 같은 원칙.
--
-- ★적용 순서: 이 파일을 **코드 배포 전에** 적용한다 — 없으면 어드민 '배송지 고치기'가 '기록을 남기지 못해 바꾸지 않았어요'로 멈춘다
--   (돈·발송에는 영향 없음 — 고객 앱의 배송지 관리·청구·포장은 이 표를 읽지 않는다).

create table if not exists public.admin_address_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  -- 바꾸기 전 기본 배송지 {recipient_name, phone, zip, address, address_detail} — 없었으면(새로 만듦) null.
  before_address jsonb,
  -- 바꾼 값(같은 모양).
  after_address jsonb not null,
  also_pending_orders boolean not null default false,
  -- 같이 고칠 결제된 발송 대기 주문의 바꾸기 전 값 — [{id, recipient_name, recipient_phone, zip, address, address_detail}].
  orders_before jsonb not null default '[]'::jsonb,
  -- 실제로 바꿨나(고치기 전에 넣고, 바꾼 뒤 true) · 실제로 바뀐 주문 id.
  applied boolean not null default false,
  applied_order_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.admin_address_changes is
  '어드민 배송지 고치기의 바꾸기 전 값(기본 배송지·결제된 발송 대기 주문). 고객 개인정보 — 탈퇴 시 account/delete 가 지운다. '
  '관리자만 읽고(is_admin), 쓰기는 서버(service_role). 2026-10-15 F-b 규칙276.';

create index if not exists admin_address_changes_user_idx
  on public.admin_address_changes (user_id, created_at desc);

alter table public.admin_address_changes enable row level security;

revoke all on table public.admin_address_changes from anon, authenticated;
grant select on table public.admin_address_changes to authenticated;
grant all on table public.admin_address_changes to service_role;

drop policy if exists admin_address_changes_admin_select on public.admin_address_changes;
create policy admin_address_changes_admin_select on public.admin_address_changes
  for select to authenticated
  using (public.is_admin());

-- 자기 검증 — 고객은 못 쓰고 익명은 못 읽고, 관리자 읽기 정책·라우트가 쓰는 칸이 있다.
do $$
begin
  if has_table_privilege('authenticated', 'public.admin_address_changes', 'insert')
     or has_table_privilege('authenticated', 'public.admin_address_changes', 'update')
     or has_table_privilege('authenticated', 'public.admin_address_changes', 'delete')
     or has_table_privilege('anon', 'public.admin_address_changes', 'select')
     or has_table_privilege('anon', 'public.admin_address_changes', 'insert') then
    raise exception 'admin_address_changes 에 고객 쓰기·익명 권한이 남아 있다';
  end if;
  if not has_table_privilege('service_role', 'public.admin_address_changes', 'insert')
     or not has_table_privilege('service_role', 'public.admin_address_changes', 'update')
     or not has_table_privilege('service_role', 'public.admin_address_changes', 'delete') then
    raise exception 'admin_address_changes 서버(service_role) 쓰기·지우기 권한이 없다 — 라우트·탈퇴가 못 쓴다';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_address_changes' and policyname = 'admin_address_changes_admin_select'
  ) then
    raise exception 'admin_address_changes 관리자 읽기 정책이 없다';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'admin_address_changes'
        and column_name in ('user_id', 'changed_by', 'before_address', 'after_address', 'also_pending_orders',
                            'orders_before', 'applied', 'applied_order_ids')) <> 8 then
    raise exception 'admin_address_changes 칸이 모자라다 — app/api/admin/users/[id]/address 가 이 이름을 쓴다';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.admin_address_changes'::regclass) then
    raise exception 'admin_address_changes RLS 가 꺼져 있다';
  end if;
end $$;
