# 6라운드 감사 — 의도적 보류 2건 (2026-08-20)

돈·상태기계 14타깃 정독 → 확정 15건. 13건 수정·배포, **2건은 근거·리스크
저울질 끝에 보류**했다. "왜 안 고쳤나"를 나중에 추적할 수 있게 남긴다.

## 1. toss-lib: unknown 에러 멱등키 회전 → 모호-캡처 이중청구 (medium, confidence medium)

**주장**: subscription-charge 의 failed_charge_count 가 두 목적을 겸한다 —
(A) 3-strike 일시정지 카운터, (B) 멱등키 회전 앵커(chargeRetrySuffix `:rN`).
unknown 에러가 count 를 올려 다음 재시도가 새 멱등키를 쓰는데, 만약 직전 시도가
실제로 캡처됐다면(돈은 나갔는데 에러코드) 새 키로 또 긁혀 이중청구.

**왜 보류**:
- 같은 파일을 정독한 **다른 finder(cron-charge)가 이 시나리오를 "미보고"**했다:
  chargeBillingKey 가 **모든 결과불명(타임아웃·비JSON 502 등)을 NETWORK_ERROR
  (transient)로 흡수**하고, transient 는 count 를 안 올려 멱등키를 유지한다.
  unknown 으로 분류되는 건 토스가 **명시적 에러코드를 준** 경우 = 캡처 안 된
  실패일 가능성이 높다. "캡처됐는데 unknown 에러코드" 조합을 **구체 코드로
  재현하지 못했다**.
- 수정안(멱등 회전 카운터를 별도 DB 컬럼으로 분리)은 스키마 변경 + 청구 로직
  변경이라, confidence medium·재현 불가 대비 **리스크가 크다**("내 수정이 더
  나쁠 수 있다").

**재검토 조건**: 실결제 시작 후 토스 대시보드에서 "이중청구" 실사례가 나오거나,
classifyBillingError 가 unknown 으로 분류하는 실제 토스 코드 중 "승인 성공했으나
후처리 에러" 계열이 확인되면. 그때 idempotency_rotation_count 컬럼 분리.

## 2. boxpricing: 가용성 게이트가 재고·구독가능 미반영 → 품절 라인 증발 (medium→low)

**주장**: deriveAvailableLines 가 products 존재 여부만 보고 stock·is_subscribable
을 안 봐서, is_active 인데 품절인 라인이 박스에서 재분배 없이 빠질 수 있다
(반박스 → 비례 저청구).

**왜 보류**: refuter가 low 로 하향. **실질 안전망이 이미 있다** — 피킹 리스트의
`missing` 탐지(page.tsx)가 "레시피는 부르는데 박스에 못 담기는 항목"을 잡아
발송 전 사장님에게 경고한다. 이 발견은 "조용한 사고"가 아니라 "수동 개입 필요"를
없애는 견고성 개선이라 우선순위가 medium 미만. 프로덕션 실측: 메인 4종 전부
is_active·is_subscribable·stock 100+ 라 현 데이터 괴리 0.

**재검토 조건**: 실제로 라인 품절이 잦아 반박스 CS 가 늘면, deriveAvailableLines
입력을 subscribableItems(stock>0 && is_subscribable)와 일치시켜 자동 재분배.
