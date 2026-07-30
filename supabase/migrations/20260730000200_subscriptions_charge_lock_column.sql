-- 청구 윈도우 진입 표시 (2026-07-30 최종감사 critical)
--
-- # 문제 — 주석이 없는 방어를 설명하고 있었다
-- 청구 크론이 카드를 긁기 직전에 status 를 재확인하는데, 그 코드 위 주석은
-- 이렇게 주장했다:
--   "UPDATE-with-RETURNING 으로 active 사용자만 atomically 청구 윈도우 진입
--    (last_charge_lock_at 마킹 — 다른 cron run 과 self-cancel 간 윈도우 좁힘)"
-- 실제 코드는 평범한 SELECT 였고, `last_charge_lock_at` 은 **저장소 전체에서
-- 그 주석 한 줄이 유일한 등장**이었다(컬럼도, UPDATE 도 없었다).
-- 없는 방어를 있다고 믿게 만드는 주석이라 코드가 없는 것보다 더 위험했다 —
-- 실제로 그 파일을 여러 번 수정하면서 그 주석을 읽고 넘어갔다.
--
-- # 이 컬럼의 역할
-- 청구 직전에 `UPDATE ... WHERE status='active' SET last_charge_lock_at=now()
-- RETURNING id` 로 **원자적으로 선점**한다. UPDATE 는 행 잠금을 잡으므로 여러
-- run 이 겹쳐도 하나만 통과한다. 0행이면 그 사이 상태가 바뀌었거나 다른 run 이
-- 선점한 것이므로 청구하지 않는다.
--
-- 선점만으로는 부족하다는 점도 함께 처리했다: 선점은 "긁기 시작할 때 active 였음"
-- 만 보장하고 **긁는 동안(토스 응답 최대 30초)의 해지는 못 막는다.** 그래서 청구
-- 성공 직후 status 를 다시 확인하고, 해지됐으면 즉시 환불(실패 시 환불 큐)한 뒤
-- 주문을 발송 대기로 올리지 않는다 — subscription-charge/route.ts 참조.
--
-- 부가 효과: "언제 청구를 시도했는지"가 남는다(last_charged_at 은 성공 시각이라
-- 시도 시각과 다르다). 진행 중인 청구를 조회할 수 있다.
--
-- # 권한
-- 20260730000000 화이트리스트 이후 subscriptions UPDATE 권한은 4개 칸만
-- authenticated 에 부여돼 있다. 새 컬럼은 기본적으로 권한이 없으므로 **고객은 이
-- 칸을 쓸 수 없다** — 별도 REVOKE 불필요(화이트리스트의 이점, 실측 확인).

alter table public.subscriptions
  add column if not exists last_charge_lock_at timestamptz;

comment on column public.subscriptions.last_charge_lock_at is
  '청구 크론이 이 구독의 청구 윈도우에 진입한 시각. UPDATE-with-RETURNING 선점용 — 배치 조회 후 상태가 바뀐 구독에 청구하지 않기 위한 것(2026-07-30). service_role 전용.';
