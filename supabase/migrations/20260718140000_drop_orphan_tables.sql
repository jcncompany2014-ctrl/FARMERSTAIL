-- 삭제된 기능의 고아 테이블 정리 (2026-07-18).
--
-- 가족초대·진행사진 갤러리 기능을 코드에서 완전 삭제(옛잔재 스윕)함에 따라,
-- 남은 빈 테이블 2개를 드롭한다. 둘 다 조사 시점:
--   · 0행 (데이터 손실 없음)
--   · inbound FK 0 · 트리거 0 · 코드 참조 0 (완전 고아)
--
-- ★유지: point_ledger(과거 원장·법정보관·개인정보export/계정purge 얽힘),
--   orders.points_* 컬럼(과거 주문 이력·재무 리포트), photo_request_tokens(사진부탁 = 살아있는 기능).
--   → 이들은 클린업이 아니라 법적 데이터 보관 대상이므로 건드리지 않는다.

-- dog_invitations 에 의존하던 고아 뷰(초대 수락 flow용, 코드 참조 0)도 함께 정리.
drop view if exists public.dog_invitations_public;
drop table if exists public.dog_invitations;
drop table if exists public.dog_progress_photos;
