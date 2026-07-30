-- 같은 강아지에 진행 중인 구독은 하나만 (2026-07-30 최종감사 critical)
--
-- # 문제
-- 중복 방어가 애플리케이션 코드의 "조회 후 삽입" 하나뿐이었다
-- (app/(main)/dogs/[id]/order/OrderClient.tsx). 조회와 삽입 사이에 잠금이 없어
-- 폰과 PC 에서 거의 동시에 신청하면 둘 다 "기존 구독 없음"을 보고 각각 만든다:
--
--   0.00s 폰: 조회 → 없음
--   0.05s PC: 조회 → 없음 (폰이 아직 insert 안 함)
--   0.30s 폰: insert A(active)
--   0.35s PC: insert B(active)
--
-- 둘 다 카드가 걸리면 2주마다 **두 번 청구 · 박스 두 개**가 영구 반복된다.
-- subscriptions 에 unique 제약이 하나도 없었다(실측 — 있던 것은
-- subscription_charges_idem 뿐).
--
-- 게다가 2026-07-30 에 신설한 /mypage/subscriptions 는 '시작 전' 구독마다 등록
-- 배너를 각각 그려서, 구독이 2개 생긴 고객이 **둘 다 등록**하도록 유도했다
-- (= 이중 청구가 실현되는 조건).
--
-- # 규칙
-- 진행 중(active/paused) 구독은 강아지당 하나.
--  · cancelled 제외 — 해지 이력은 여러 건 쌓이는 게 정상이고 재신청도 허용해야 한다.
--  · dog_id IS NULL 은 대상 밖(Postgres 는 NULL 을 서로 다르게 본다). 강아지를
--    삭제하면 dog_id 가 NULL 이 되므로(ON DELETE SET NULL) 그 구독들끼리는 제약이
--    걸리지 않는다 — 강아지 삭제 시 활성 구독 검사는 별도 작업.
--
-- 적용 전 실측: 진행 중 구독이 2개 이상인 강아지 0건.
-- 적용 후 실측: 두 번째 active insert 가 23505 로 거부됨(롤백 트랜잭션에서 확인).
--
-- # 애플리케이션 대응
-- OrderClient 가 23505 를 "이 강아지에 진행중인 정기배송이 이미 있어요"로 안내한다
-- (기존 조회 가드와 같은 문구·목적지). 조회 가드는 빠른 안내용으로 남기고 DB 가
-- 최후 방어선이 된다.

create unique index if not exists subscriptions_one_live_per_dog
  on public.subscriptions (dog_id)
  where status in ('active', 'paused') and dog_id is not null;

comment on index public.subscriptions_one_live_per_dog is
  '강아지당 진행 중(active/paused) 구독 1개. 조회-후-삽입 경합으로 이중 청구가 되는 것을 DB 에서 막는다(2026-07-30). cancelled 와 dog_id NULL 은 대상 밖.';
