-- 푸시 카테고리 정리 (2026-07-16) — 프로덕션 적용 완료
-- DB 실제 버전: 20260716013907 · 20260716014055
--
-- # 왜
-- 체중 리마인더·체중 급변 경보·DCM 검진 권고·개입 경보가 **카테고리가 없어서
-- 'order'(주문·배송)로 위장**해 나가고 있었다. 그 결과 보호자가 배송 알림을 끄면
-- **건강 경보까지 같이 꺼졌다**. 반대로 알림함엔 "체중 재주세요"가 '주문' 딱지로 떴다.
--
-- notify_restock · notify_cart 는 구독 전용 전환 때 플로우가 사라졌는데 컬럼·타입·
-- 게이팅 코드가 남아 있었다(UI 만 숨겨 뒀었다).
-- 실측: push_preferences 1행, 둘 다 끈 사람 0명 → 잃을 데이터 없음.

ALTER TABLE push_preferences
  DROP COLUMN IF EXISTS notify_restock,
  DROP COLUMN IF EXISTS notify_cart,
  ADD COLUMN IF NOT EXISTS notify_health boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN push_preferences.notify_health IS
  '건강 알림(체중 재기·체중 급변·검진 권고·개입 경보). 기본 ON — 배송 알림과 분리해야 배송을 꺼도 건강 경보는 남는다.';

-- ── 잔소리 상한을 **실제로** 걸기 위한 표식
--
-- 기존엔 category in ('cart','restock') 로 주 2건 상한을 걸었는데 그 두 카테고리가
-- 사라져 **상한이 아무것도 막지 못하는 상태**였다(docs/110-checklist.md #15 는 ✅ 였다).
--
-- 카테고리로 거는 방식 자체가 틀렸다: 'health' 에는 "체중 재주세요"(안 보내도 되는
-- 잔소리)와 "체중이 급격히 줄었어요"(절대 잘리면 안 되는 경보)가 같이 산다.
-- → 보내는 쪽이 스스로 '권유성'이라 표시하게 하고, 상한은 그 표식에만 건다.
--   경보는 표시하지 않으므로 영원히 안 잘린다.
ALTER TABLE push_log
  ADD COLUMN IF NOT EXISTS nudge boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN push_log.nudge IS
  '안 보내도 되는 권유성 알림(체중 재기 리마인더·체크인·설문 이어하기·광고)이면 true. 주 2건 상한은 이 표식에만 걸린다 — 건강 경보는 표시하지 않아 상한과 무관.';

CREATE INDEX IF NOT EXISTS push_log_nudge_window_idx
  ON push_log (user_id, sent_at DESC) WHERE nudge;
