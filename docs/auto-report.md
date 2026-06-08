# 무인 점검 자동 리포트 (auto-report)

Opus 무인 점검 sweep 중 발견했으나 **직접 수정하지 않고 사람 검토로 넘긴** 항목.
원칙: 결제/주문/환불/정기결제/인증/임상 핵심 로직은 코드 변경 금지(문서화만).
그 외도 안전·저위험이 명확히 증명되지 않거나 테스트로 덮기 어려우면 보류.

---

## 2026-06-08 batch 2 — 보류 항목

### A. `app/api/addresses/[id]/route.ts:122` — DELETE 에러 메시지 raw 노출 (LOW)
- 같은 파일 PATCH(line 86)는 `dbError(error, ...)` 로 마스킹하는데, DELETE 는
  `return NextResponse.json({ error: delErr.message }, { status: 500 })` 로 원시
  DB 메시지를 그대로 반환 → 드물게 제약조건/스키마명 노출(reconnaissance).
- 권장 수정(저위험): `return dbError(delErr, 'addresses_delete', '배송지 처리에 실패했어요')`
  (`dbError` 는 이미 import 됨). audit #69 마스킹 정책과 일치.
- 보류 사유: 라우트 단 에러경로를 덮을 단위테스트 인프라가 없어 "행위 변경엔
  테스트 동반" 규칙을 깔끔히 만족시키기 어려움. 정합성 수정이라 사람이 적용 권장.

### B. `lib/ui-flags.ts` — switch default 누락 (LOW, 비현실적 입력)
- `isAdvancedUiEnabled()` 의 switch 에 default 가 없어 타입 외 값이 들어오면
  `undefined` 반환(호출부는 boolean 기대). TypeScript 가 컴파일 타임에 막아
  런타임 트리거는 사실상 없음.
- 권장: `default: return false` 방어 추가. 영향 미미라 우선순위 낮음.

### C. `lib/storage/medical-records.ts` — `medical-records-images` 버킷/RLS 미존재 의심 (검토)
- 코드가 참조하는 `medical-records-images` 스토리지 버킷 + owner RLS 정책이
  마이그레이션에 보이지 않는다는 리뷰 지적. 사실이면 의료기록 사진 기능이
  조용히 실패(서명URL null)하거나, 정책 부재 시 타인 의료기록 접근 위험.
- 보류 사유: **임상/의료 데이터 + DB 마이그레이션 영역** → 무인 규칙상 코드/마이그
  레이션 변경 금지. 출시 전 사람이 ① 버킷 존재 ② owner RLS 정책 존재를 직접 확인.

### D. (참고) `lib/csv.ts` formula-injection — 조치 불요
- 리뷰가 "셀이 quote 안 돼 leading `'` 보호가 약하다"고 지적했으나, leading
  apostrophe 는 OWASP 권고 방식이며 quote 여부와 무관하게 Excel/Sheets 가 셀을
  텍스트로 처리한다. 현 구현은 표준 방어로 **정상**. 변경하지 않음.
