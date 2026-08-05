-- dog_formulas — 고객 쓰기 권한 회수 (2026-08-05 병렬 보안 감사)
--
-- # 왜
-- subscriptions(20260730000000)·orders(20260731000000)·profiles 를 컬럼
-- 화이트리스트로 잠갔는데, **그 잠긴 칸에 들어갈 값을 만들어내는 테이블**은
-- 열려 있었다. dog_formulas 는 `dog_formulas_self_update` 정책(auth.uid() =
-- user_id)만 있고 컬럼 GRANT 를 좁히는 마이그레이션이 없어서, 로그인한 고객이
-- anon 키 + 본인 JWT 로 REST 를 직접 때릴 수 있었다:
--
--     PATCH /rest/v1/dog_formulas?dog_id=eq.<본인 강아지>&cycle_number=eq.1
--     {"daily_kcal": 1}
--
-- 그 값이 **청구액에 선형 비례**한다(lib/personalization/boxPricing.ts):
--     dailyG = ratio × dailyKcal ÷ kcalPer100g × 100 × freshFactor
--            → mealPortionG → lineCycleTotal → total_amount
-- 그 다음 fresh-ratio 나 approve 를 호출하면 서버가 service_role 로
-- subscriptions.total_amount 를 그 금액으로 덮어쓴다. 소유권 검사는 본인
-- 강아지라 전부 통과한다. 실측 기준 정상 ~15만원이 3천원대가 된다.
--
-- 청구 검문소가 못 잡는다: charge-amount-guard 의 recomputeChargeBase 가
-- **같은 dog_formulas 행**을 읽으므로 stored == recomputed → mismatch=false →
-- 알림조차 안 뜬다. AGENTS 규칙2("방어의 탈출구를 열거하고 그 조건을 사용자가
-- 만들 수 있는지 본다")가 fresh_ratio 때와 같은 모양으로 재발한 것이다.
--
-- 부수 피해(임상): 안전 게이트 needsConsultation 이 같은 formula jsonb 안에
-- 있다. 고객이 false 로 써 버리면 알레르기 누출 박스가 결제·피킹까지 간다.
--
-- # 층위
-- AGENTS 규칙3 — "값을 검사하기 전에 쓸 수 없게 만드는 층위를 먼저 본다."
-- dog_formulas 에는 고객이 직접 써야 하는 칸이 하나도 없다(전부 서버 계산
-- 결과다). 그래서 화이트리스트가 아니라 **UPDATE/INSERT/DELETE 전면 회수**다.
-- SELECT 는 유지한다 — 대시보드·주문·플랜 화면이 전부 이 행을 읽는다.
--
-- 규칙13대로 잠금과 호출부를 같이 옮겼다. 쓰기 4곳을 service_role 로 전환:
--   app/api/personalization/adjust/route.ts   (사용자 조정 저장)
--   app/api/personalization/approve/route.ts  (승인·거절·연장 3곳)
--   app/api/personalization/compute/route.ts  (upsert·v3 백필 2곳)
-- 크론(personalization-progression·approval-timeout)은 이미 service_role.
-- 이 라우트들은 모두 상위에서 dogs 를 .eq('user_id', user.id) 로 확인한 뒤
-- 진행한다 — 범위는 RLS 가 아니라 코드가 책임진다(규칙8과 같은 모양).

revoke insert, update, delete on public.dog_formulas from authenticated;
revoke insert, update, delete on public.dog_formulas from anon;

-- 정책도 같이 걷는다. GRANT 만 회수하고 정책을 남기면, 나중에 누가 GRANT 를
-- 되살릴 때 "정책이 있으니 의도된 것"으로 읽힌다(주석이 없는 방어를 주장하는
-- 것과 같은 함정 — 규칙4).
drop policy if exists "dog_formulas_self_insert" on public.dog_formulas;
drop policy if exists "dog_formulas_self_update" on public.dog_formulas;

-- SELECT 는 그대로. (dog_formulas_self_select 정책 유지)
