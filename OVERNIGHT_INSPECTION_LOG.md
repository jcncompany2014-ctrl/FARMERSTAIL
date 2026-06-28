# 야간 무한 점검 로그 (2026-06-27 밤 시작)

사장님 취침 중 코드 검증 루프. **UI 디테일·결제 3b-2(체크아웃 자동할인 결정 필요)·`.next`(dev 서버 보존)는 안 건드림.** 안전한 코드 오류만 수정, 나머지는 여기 기록 → 아침 검토.

규칙: tsc/eslint/tests 그린 유지. 결제·동작 바꾸는 위험한 수정은 기록만. 트리비얼·안전한 것만 즉시 수정.

---

## Iteration 1 — 베이스라인 + 자동할인 cron 감사

**베이스라인 (전부 GREEN):**
- dev 서버 localhost:3000 → 200 (아침 캡쳐용 보존됨)
- `tsc --noEmit` 소스 에러 0 · `.next` stale 0
- `node:test lib/**/*.test.ts` → **1257 pass / 0 fail**
- eslint(세션 변경 핵심 11파일) → 0
- dangling 참조 감사: 레퍼럴 테이블/RPC 런타임 호출 0, 옛 할인엔진 API 0, 죽은 컴포넌트 import 0

**발견:**

### 🔴 F1 (수정함) — `subscription-charge` `resolveAutoDiscount` 에러 시 잘못된 할인
- count 쿼리(`{ count } = await ...`)가 DB 에러여도 `count=null`, 코드가 `(count ?? 0)` 로 0 취급.
- 결과: isFirstPaidOrder 쿼리 일시 실패 → `(null??0)===0`=true → **첫주문 아닌 고객에 50% 오적용**(undercharge). 슬롯/생일 쿼리 실패도 "미사용" 으로 편향돼 할인 오적용.
- **수정 (검증완료: tsc 0 · eslint 0 · dev 200)**: 각 입력 쿼리에 `error` 검사 추가 → 하나라도 실패하면 즉시 `fullCharge`(무할인=정가 `sub.total_amount`) 반환. `CountFilter` 타입에 `error` 노출. (정가는 구독 약정가라 overcharge 아님. 드문 일시 에러에 할인 1회 누락만 — 안전 방향.)

### 🟡 F2 (기록만 — 트리비얼) — `components/v3/Tabs.tsx:6` 주석 stale
- docstring 이 `CouponBrowser`(격리됨 `_dead_q4`) 를 언급. import 아님(주석)이라 무해. 정리 대상.

**다음 감사 영역 (라운드로빈):** discount 엔진 슬롯경계 엣지 → 웹 구독 client(`SubscriptionsWebClient` 액션 핸들러 vs 앱 원본 동등성) → 계정 페이지 쿼리/타입 → 레퍼럴 제거 완전성(잔존 라우트/링크) → 이메일 템플릿 → tiers → 설문(StartSurvey) → F2 정리.

---
