-- 낱개 커머스 잔재 테이블 전면 DROP (2026-07-16) — 프로덕션 적용 완료
--
-- 구독 전용 전환(2026-06-26) 때 낱개 판매·장바구니·위시리스트·컬렉션이 폐지됐는데
-- **테이블은 남아 있었다.** 코드가 읽는 곳이 전부 "지우기(계정삭제)" 뿐이거나 0이다.
--
-- 실측(코드 전수 + DB 행수):
--  · wishlists          0행 · 코드참조 0
--  · collections        4행 · 코드참조 0   (collection_items 가 FK → 먼저 drop)
--  · collection_items   5행 · 코드참조 0
--  · product_variants   0행 · 코드참조 0   (cart_items·restock_alerts 가 FK → 함께)
--  · restock_alerts     0행 · 계정삭제에서 '지우기'만
--  · cart_recovery_log  0행 · 계정삭제에서 '지우기'만
--  · cart_items         4행 · 계정삭제·결제확정에서 '비우기'만 (담을 방법이 이제 없음)
--
-- point_ledger 는 **제외** — 5행 + 개인정보 내보내기·법정 보관·계정삭제 크론이 얽혀 있어
-- 별도 판단 필요(애매 목록 유지).
--
-- CASCADE 로 FK 순서 무시하고 한 번에. 전부 폐지된 기능이라 복구 계획 없음.
-- 이 마이그레이션과 함께 지운 코드: account/delete 의 3개 delete op + docstring,
-- payments/confirm 의 cart 비우기, swr-lite·source-waitlist 주석 예시, types.ts 7블록.

drop table if exists public.cart_items cascade;
drop table if exists public.cart_recovery_log cascade;
drop table if exists public.restock_alerts cascade;
drop table if exists public.collection_items cascade;
drop table if exists public.collections cascade;
drop table if exists public.product_variants cascade;
drop table if exists public.wishlists cascade;
