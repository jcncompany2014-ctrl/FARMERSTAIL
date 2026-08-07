-- 빌링키 **값** 을 브라우저로 내리지 않고 "등록 여부"만 주기 (2026-08-08 보안 재감사)
--
-- # 무슨 일이 있었나
-- `app/admin/subscriptions/page.tsx` 는 `'use client'` 인데 `select('*')` 로
-- 구독 전체를 조회했다. 즉 **전 고객의 `billing_key`·`billing_customer_key` 가
-- 어드민 브라우저의 네트워크 응답과 메모리에 통째로 올라갔다.** 어드민 기기
-- 침해·악성 확장 프로그램·XSS 하나면 전 고객 결제 자격증명이 한 번에 나간다.
--
-- 고객 화면 3곳도 같은 모양이다(본인 것만 나가므로 타인 유출은 아니지만,
-- 빌링키는 토스 규약상 서버 보관 대상이고 `select('*')` 는
-- `last_charge_lock_at`·`next_retry_at` 같은 서버 전용 칸까지 함께 내보낸다):
--   · app/account/subscriptions/page.tsx
--   · app/(main)/dogs/[id]/subscription/page.tsx
--   · app/(main)/dogs/[id]/page.tsx
--
-- 그런데 그 화면들이 **실제로 쓰는 건 전부 `!!billing_key`** — 등록 여부
-- 불리언 하나다. 값이 필요 없다.
--
-- # 왜 computed column 인가
-- 20260808000000 이 홈 RPC 에서 `(s.billing_key is not null) as has_billing_key`
-- 로 같은 문제를 이미 풀었다. 하지만 위 화면들은 RPC 가 아니라 PostgREST
-- 테이블 조회를 쓴다. PostgREST 는 **테이블을 인자로 받는 함수**를 그 테이블의
-- 계산 컬럼으로 노출하므로(`select=id,has_billing_key`), 조회 방식을 안 바꾸고
-- 같은 규칙을 적용할 수 있다.
--
-- 보안상 안전한 이유: 이 함수는 **이미 볼 수 있는 행**에 대해서만 호출된다
-- (RLS 가 먼저 행을 거른다). 돌려주는 것도 불리언 하나라 키를 역산할 수 없다.

create or replace function public.has_billing_key(public.subscriptions)
returns boolean
language sql
stable
-- security definer 가 **아니다** — 호출자 권한으로 돌고, RLS 가 이미 통과시킨
-- 행에만 적용된다. 권한 상승 표면을 만들지 않는다.
set search_path = public
as $$
  select $1.billing_key is not null
$$;

comment on function public.has_billing_key(public.subscriptions) is
  'PostgREST 계산 컬럼. 빌링키 값 대신 등록 여부만 노출한다 — select(*) 가 전 고객 결제 자격증명을 브라우저로 내보내던 것을 막기 위해(2026-08-08).';

-- 계산 컬럼은 조회하는 쪽이 EXECUTE 를 가져야 한다.
-- (이미 볼 수 있는 행의 불리언 하나이므로 권한을 넓히지 않는다.)
grant execute on function public.has_billing_key(public.subscriptions)
  to authenticated, service_role;
