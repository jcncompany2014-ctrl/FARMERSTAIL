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

---

## 2026-06-08 batch 4 — 보류 항목 (저위험이나 라우트 테스트 인프라 부재로 사람 적용 권장)

이 리포의 테스트는 순수 lib 함수 위주이고 API 라우트 에러경로 단위테스트 하네스가
없어, 아래 "행위 변경"들을 무인 규칙(행위 변경엔 테스트 동반) 하에 깔끔히 덮기
어려워 보류. 전부 기존 컨벤션(`dbError`/audit #69)과 일치하는 기계적 저위험 수정.

### E. audit #69 — raw DB/스토리지 에러 메시지 노출 (MEDIUM, 정보노출)
같은 파일 내 다른 핸들러는 `dbError()`/generic 메시지로 마스킹하는데 아래는 원시
에러 메시지를 응답에 그대로 실어 내부 스키마/인프라 단서 노출:
- `app/api/admin/products/[id]/duplicate/route.ts:88` — `insertError?.message` 반환
  → `message: '복제에 실패했어요'` 또는 `dbError(insertError, 'product_duplicate')`.
- `app/api/admin/blog/upload/route.ts:120`,
  `app/api/admin/events/upload/route.ts:133`,
  `app/api/admin/products/upload/route.ts:130` — `uploadError.message` 반환
  → 원시 메시지 제거, generic 문구만.
- 권장: 일괄로 raw message 제거. 비결제/비인증/비임상이라 저위험.

### F. admin 후속 update/insert 무검사 (LOW, 상태 불일치)
- `app/api/admin/push-campaigns/route.ts:129-132` — 캠페인 insert 후 sent/failed
  카운트 update 의 error 미검사 → 실패해도 200. (관리자 대시보드 한정 영향)
- `app/api/admin/users/[id]/message/route.ts:112-117` — cs_messages insert error
  미검사. 권장: error 체크 후 dbError.

### G. 챗봇 LLM 비용 일일 캡 누락 (MEDIUM, 비용 남용)
- `app/api/chatbot/route.ts`, `app/api/chatbot/stream/route.ts` 는 IP 분당 5회
  rate-limit 만 있고, `app/api/analysis/commentary/route.ts` 가 쓰는
  `checkAnthropicDailyCap()` 같은 일일 호출 상한이 없음. 분산 IP/다수 사용자 시
  24h Anthropic 비용 무제한. 권장: rate-limit 직후 `checkAnthropicDailyCap('chatbot')`
  추가(코드 패턴은 commentary 에 이미 존재). LLM 엔드포인트 행위 변경이라 검토 후 적용.
- 시스템 프롬프트(`lib/chatbot-system-prompt.ts`)의 프롬프트-인젝션 방어 문구는
  임상/조언 로직이라 변경 금지(문서화만).

### H. Tractive OAuth 콜백 입력검증 (LOW)
- `app/api/integrations/tractive/callback/route.ts` — `code` 길이/형식 검증 없이
  토큰 교환 호출, 빈 문자열도 통과. `lib/integrations/tractive.ts:117` 응답
  `access_token` null 미검사 → null 저장 가능. 권장: code 길이·형식 가드 +
  access_token 존재 검사. (CSRF state/secret/SSRF 는 안전 확인됨.)

---

## 2026-06-08 batch 5 — 보류 항목 (관찰성/네이티브, 사람 검토)

### I. refund-retry Toss 에러메시지 → Sentry/Slack PII 누출 (HIGH, RESTRICTED)
- `app/api/cron/refund-retry/route.ts:188/195/201` — `cancelPayment()` 실패 시
  `result.error.message`(Toss 응답 body 유래)를 DB `last_error` + `captureBusinessEvent`
  + `alertRefundFailure` 로 그대로 전달. Toss 에러문구에 카드/계좌/거래식별 PII 가
  섞이면 Sentry UI·Slack 웹훅에 노출.
- 권장: Sentry/alert 전달 전 카드·계좌 패턴 마스킹 + 길이 제한.
- **RESTRICTED**: 환불(결제) cron 경로 → 무인 변경 금지. 사람이 마스킹 적용 검토.

### J. 로그 위생 — 제어문자/길이 (LOW, 비차단)
- `lib/admin-audit.ts:133/139` — Supabase `error.message` 를 console.warn 에 그대로.
  유니크 위반 등으로 이메일 등이 섞일 수 있음 → 길이 제한·개행 제거 권장.
- `lib/cron-tracking.ts:71` — `message.slice(0,500)` 가 개행 미제거 → DB error_message
  /로그 라인 분할 가능. `.replace(/[\r\n]/g,' ')` 권장.
- 보류 사유: 에러경로 로깅이라 단위테스트로 덮기 어렵고, cron-tracking 은 결제 cron
  래퍼(인접). 저위험이나 검토 후 적용.

### K. Capacitor 네이티브 가드 (LOW, 방어적/선택)
- `lib/capacitor.ts:77/84` — push 등록 콜백 `t.value`/`err.error` 무가드(플러그인
  타입상 항상 존재하나 방어적으로 `t?.value ?? ''` 가능). `.remove()` 정리 promise
  rejection swallow.
- 보류 사유: 네이티브 런타임 필요로 단위테스트 불가 + 사실상 발생 불가 케이스. 선택.
