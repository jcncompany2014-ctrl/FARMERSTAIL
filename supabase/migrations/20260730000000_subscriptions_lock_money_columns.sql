-- ============================================================================
-- subscriptions — 고객이 수정할 수 있는 칸을 **허용 목록**으로 제한
-- 2026-07-30 최종감사 (오늘 변경분 회귀 관점, critical)
-- ============================================================================
--
-- # 무엇이 문제였나
-- `authenticated` 와 `anon` 이 subscriptions 의 **모든 칸**에 UPDATE 권한을
-- 갖고 있었다(실측 37개 칸: total_amount · fresh_ratio · billing_key ·
-- total_deliveries · user_id 까지). RLS 정책 `subs_update_own_or_admin` 은
-- "본인 행이면 UPDATE 허용"만 보고 **어느 칸인지는 보지 않는다.**
-- anon key 는 공개값이므로 앱을 거치지 않고 REST 로 바로 PATCH 가 가능하다:
--
--   PATCH /rest/v1/subscriptions?id=eq.<본인구독>
--   { "total_amount": 100 }        → 100원만 내고 정상 박스 수령
--
-- # 왜 애플리케이션 검문소로는 부족했나
-- 2026-07-29 에 청구 크론에 "서버가 금액을 다시 계산해 대조하는" 검문소
-- (`lib/payments/charge-amount-guard.ts`)를 넣었다. 그런데 그 재계산은
-- 강아지·화식비율·처방이 있어야 가능하고, **없으면 검사를 건너뛴다**
-- (`verdict: 'skip-check'`). 그리고 `fresh_ratio` 도 고객이 쓸 수 있는 칸이라,
-- 조작 요청에 한 줄만 더 넣으면 검문소가 그대로 비켜섰다:
--
--   { "total_amount": 100, "fresh_ratio": 0 }   → skip-check → 100원 청구
--
-- 즉 **막으려던 취약점이 필드 하나로 그대로 열려 있었다.** 애플리케이션 층에서
-- 값을 검증하는 대신, 애초에 **쓸 수 없게** 만드는 것이 옳은 층위다.
--
-- # 허용 목록 (앱 코드 전수 조사 결과, 2026-07-30)
-- 클라이언트가 실제로 UPDATE 하는 칸은 넷뿐이다:
--   · status                     — 일시정지·재개·해지 (DogSubscriptionClient,
--                                   SubscriptionsWebClient, admin/subscriptions)
--   · next_delivery_date         — 건너뛰기·재개·해지 시 함께 갱신
--   · reminder_enabled           — 배송 알림 토글 (웹 구독 관리)
--   · last_failed_charge_reason  — 주문 화면의 롤백('item-insert-failed')
-- 나머지는 전부 **서버(service_role)만** 쓴다 — 청구 크론, billing-issue,
-- 승인 라우트, 탈퇴 라우트. service_role 은 컬럼 권한 검사를 받지 않으므로
-- 이 마이그레이션에 영향받지 않는다.
--
-- 블랙리스트가 아니라 화이트리스트인 이유: 앞으로 칸이 추가돼도 **기본이 보호**다.
-- 새 칸을 고객이 써야 하면 그때 명시적으로 GRANT 하게 된다(그 리뷰가 목적).
--
-- # 남아 있는 구멍 (이 마이그레이션으로 안 막히는 것)
-- INSERT 는 여전히 클라이언트가 한다(`OrderClient` 가 total_amount 를 계산해
-- 넣는다). 그래서 **구독을 만드는 순간의 금액 조작은 아직 가능**하다.
-- 제대로 막으려면 구독 생성을 서버 라우트로 옮겨 금액을 서버가 계산해야 한다
-- → 후속 작업. 다만 UPDATE 경로가 닫히면 "기존 구독을 나중에 깎는" 훨씬 쉬운
-- 공격은 사라진다.
-- ============================================================================

-- 먼저 테이블 전체 UPDATE 권한을 회수한다(모든 칸).
revoke update on public.subscriptions from authenticated;
revoke update on public.subscriptions from anon;

-- 그다음 앱이 실제로 쓰는 칸만 돌려준다.
grant update (
  status,
  next_delivery_date,
  reminder_enabled,
  last_failed_charge_reason
) on public.subscriptions to authenticated;

-- anon 은 구독을 수정할 일이 없다(비로그인 상태에서 구독 조작은 성립하지 않는다).
-- RLS 가 `auth.uid() = user_id` 로 이미 0행을 만들지만, 권한 자체를 주지 않는
-- 것이 한 겹 더 확실하다. anon key 가 공개값이라는 점을 고려한 선택.

comment on table public.subscriptions is
  '정기배송 구독. 고객(authenticated)은 status·next_delivery_date·reminder_enabled·last_failed_charge_reason 만 UPDATE 가능(2026-07-30 화이트리스트). 금액·빌링키·배송횟수 등은 service_role 전용 — 새 칸을 고객이 쓰게 하려면 명시적 GRANT 가 필요하다.';
