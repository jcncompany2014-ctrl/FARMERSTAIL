-- =============================================================================
-- profiles.notifications_last_seen_at — 알림 unread 카운트 기준점.
--
-- # 컨셉
--
-- 별도 notifications 피드 테이블 없이 "사용자가 알림 인박스를 확인한 시점" 만
-- 기록한다. 클라이언트는 이 시점 이후 업데이트된 데이터 (주문 상태 변경 등)
-- 의 개수를 unread 로 보여준다.
--
-- 미래에 정식 in-app notification feed 가 필요해지면 별도 테이블을 만들고 이
-- 컬럼은 그쪽 테이블의 read 상태와 자연스럽게 합쳐 쓸 수 있다.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_last_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.notifications_last_seen_at IS
  'Timestamp when user last opened the notifications inbox. Used as cutoff for unread count of order updates and other actionable signals.';

-- 인덱스 불필요 — 단일 row 조회 (id 기준) 라 PK 만으로 충분.
