-- 해지되면 카드 토큰을 지운다 (2026-08-08 실데이터 정합성 감사).
--
-- # 발견
-- 프로덕션 SELECT 감사에서 status='cancelled' 인데 billing_key 가 남은 구독
-- 2건(7/30~31 테스트 해지분)이 나왔다. 해지는 클라이언트가 status 를 직접
-- UPDATE 하는 흐름(status 는 고객 화이트리스트 4칸 중 하나)이라 서버 훅이
-- 없고, 클라이언트는 잠긴 billing_key 칸을 지울 **권한이 없다** — 그래서
-- 해지된 구독마다 결제 토큰이 영구 잔존하는 구조였다. 탈퇴 라우트는 지우지만
-- (account/delete) 해지는 탈퇴가 아니다.
--
-- # 왜 트리거인가
-- 해지 진입점이 앱·웹·cleanup 크론·탈퇴 등 여러 곳이라 라우트마다 지우면
-- 갈라진다(이 저장소에서 반복 확인된 형태). 컬럼 권한은 문장 기준으로
-- 검사되고 트리거의 NEW 수정은 그 제약을 받지 않으므로, BEFORE 트리거가
-- 잠긴 칸을 지우는 유일하게 안전한 층위다.
--
-- 청구 크론은 status='active' 만 고르므로 해지된 행의 토큰을 쓰는 코드는
-- 없다(재신청 = 새 구독 행 + 새 카드 등록). 카드 브랜드/끝 4자리는 민감정보가
-- 아니라 이력 표시용으로 남긴다.

create or replace function public.tg_subscriptions_clear_billing_on_cancel()
returns trigger
language plpgsql
security definer
-- create or replace 는 SET 절을 리셋한다 — 매번 명시(20260512000000 잠금 유지).
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    new.billing_key := null;
    new.billing_customer_key := null;
    new.requires_billing_key_renewal := false;
    new.next_retry_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_subscriptions_clear_billing_on_cancel()
  from public, anon, authenticated;

drop trigger if exists trg_subscriptions_clear_billing_on_cancel
  on public.subscriptions;
create trigger trg_subscriptions_clear_billing_on_cancel
  before update of status on public.subscriptions
  for each row
  execute function public.tg_subscriptions_clear_billing_on_cancel();

-- 기존 잔존분 정리 — 감사에서 나온 2건(및 향후 같은 상태) 소급 말소.
update public.subscriptions
set billing_key = null,
    billing_customer_key = null,
    requires_billing_key_renewal = false,
    next_retry_at = null
where status = 'cancelled' and billing_key is not null;
