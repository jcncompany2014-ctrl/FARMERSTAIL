-- orders INSERT 회수 + 죽은 테이블의 anon 정책 폐쇄 (2026-08-08 RLS 전수 감사)
--
-- ── ① orders — authenticated INSERT 가 전 컬럼으로 열려 있었다
--
-- 20260731000000 이 orders 를 "결제 원장"으로 규정하고 UPDATE 를 전면
-- 회수했는데, INSERT 는 "클라이언트 경로가 아직 있음" 이라며 남겨 뒀다.
-- **그 주석은 이제 낡았다** — 저장소 전수 grep 결과 orders 를 INSERT 하는
-- 곳은 청구 크론(service_role) **한 곳**뿐이다. 낱개 커머스가 구독 전용으로
-- 전환되면서(2026-06-26) 클라이언트 주문 생성 경로가 사라졌는데 권한만
-- 남아 있었다.
--
-- 열려 있으면 무엇이 되나: 로그인 사용자가 REST 로
--   POST /rest/v1/orders {user_id: 본인, total_amount: 100,
--                          payment_status: 'paid', subscription_id: ...}
-- → 결제 없이 "결제완료" 주문이 원장에 생기고, **INSERT + paid 에 발화하는
--   트리거 3개**(도장 적립·등급 누적·판매수 증가)가 그대로 돈다 —
--   **도장판을 위조 주문으로 채워 나무 등급(매 주문 10% 영구 할인)을 파밍**
--   할 수 있다. 도장판은 채워지는 순간 영구 잠금이라 되돌리기도 어렵다.
--
-- 같은 계열(subscriptions·subscription_items·dog_formulas·profiles)은 이미
-- 잠갔다 — orders INSERT 가 마지막 반쪽이었다.
revoke insert on public.orders from authenticated;
-- (anon 은 20260731000000 이 이미 회수했다. 멱등을 위해 한 번 더.)
revoke insert on public.orders from anon;

comment on table public.orders is
  '결제 원장. 고객 UPDATE 전면 회수(20260731000000) + INSERT 회수(20260808000300) — 쓰기는 service_role(청구 크론·웹훅·admin 라우트)만. 위조 paid 주문으로 도장·등급을 파밍하는 경로를 막는다.';

-- ── ② search_queries — 죽은 기능에 anon 무제한 INSERT 가 열려 있었다
--
-- 20260501000004 가 "anon 검색도 로깅" 하려고 WITH CHECK(true) INSERT 를
-- 열었는데, **이 테이블에 쓰는 코드가 저장소에 0곳**이다(검색 로깅 기능이
-- 커머스 폐지와 함께 사라졌다). 남은 것은 익명 누구나 행을 무한히 꽂을 수
-- 있는 표면뿐이다 — 로그 오염 + 저장소 팽창.
-- ★`drop policy if exists` 도 **테이블이 없으면** 42P01 로 실패한다 —
--  프로덕션 실측에서 search_queries 테이블 자체가 없었다(마이그레이션
--  파일에는 있지만 실제 DB 에는 적용된 적이 없거나 드롭됨). 존재 확인으로 감싼다.
do $$
begin
  if to_regclass('public.search_queries') is not null then
    execute 'drop policy if exists "search_queries_insert_anon" on public.search_queries';
  end if;
end $$;
-- SELECT 는 admin 전용 그대로. 쓰기 정책이 0개가 되므로 service_role 만 쓴다.

-- ── ③ feature_flags — 읽는 코드가 0곳인데 anon 전체 읽기가 열려 있었다
--
-- 20260501000005 가 USING(true) 로 열어 뒀는데 **이 테이블을 읽는 코드도
-- 저장소에 0곳**이다. 남은 것은 미출시 기능명·A/B variants payload 를
-- 비로그인이 통째로 읽을 수 있는 표면뿐이다(사업 정보 경미 유출).
--
-- 기능을 되살릴 때는 그때 명시적으로 정책을 다시 열고, 그 리뷰가 목적이다
-- (컬럼을 좁혀 variants 를 빼는 것까지 그때 판단).
-- 실물 정책명은 feature_flags_public_select (20260501000005:61).
-- 테이블·정책 존재를 확인하며 SELECT 정책을 전부 지운다.
do $$
declare
  pol record;
begin
  if to_regclass('public.feature_flags') is null then
    return;
  end if;
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'feature_flags'
      and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.feature_flags', pol.policyname);
  end loop;
end $$;
