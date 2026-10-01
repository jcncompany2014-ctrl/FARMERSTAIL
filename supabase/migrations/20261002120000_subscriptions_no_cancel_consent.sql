-- 2026-10-02 결제 후 취소 제한 — 맞춤 제작 동의 기록 (사장님 A안).
--
-- 카드 등록(정기결제 시작) 때 "결제된 박스는 단순 변심으로 취소·환불할 수 없다"는 별도 안내에 필수 체크를 받고,
-- 그 시각과 문구 버전을 구독에 남긴다(lib/payments/no-cancel-consent.ts 정본). 셀프 취소는 **그 결제 전에 동의한
-- 박스만** 막는다 — 기록이 없는 구독은 게시된 환불정책대로 발송 전 취소가 된다.
--
-- 쓰기는 billing-issue(service_role)만 한다. subscriptions UPDATE 는 고객에게 4칸 화이트리스트라
-- (20260730000000) 새 칸은 자동으로 막힌다 — 고객이 동의 기록을 지우거나 만들 수 없다.

alter table public.subscriptions
  add column if not exists no_cancel_consent_at timestamptz,
  add column if not exists no_cancel_consent_version text;

comment on column public.subscriptions.no_cancel_consent_at is
  '결제 후 취소 제한(맞춤 제작) 동의 시각 — 카드 등록 화면 필수 체크, billing-issue 가 기록. 이 시각 이후 결제된 박스만 셀프 취소 불가';
comment on column public.subscriptions.no_cancel_consent_version is
  '동의한 안내 문구 버전(lib/payments/no-cancel-consent NO_CANCEL_CONSENT_VERSION)';
