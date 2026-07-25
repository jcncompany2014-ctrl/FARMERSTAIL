# 파머스테일 코드 작업 마스터플랜 (실행자용)

> 작성: 2026-07-25 아침, Fable(설계) → 실행은 저비용 모델이 이 문서를 그대로 따른다.
> 성격: **이 문서가 지시서다.** 여기 없는 판단이 필요하면 멈추고 기록만 남겨라(임의 확장 금지).
> 진행 표기: 각 작업 앞 체크박스를 완료 시 `[x]` 로 바꾸고, 파일 하단 "실행 로그"에 한 줄 추가.

---

## 0. 실행자 필독 — 규칙 (위반 시 사고)

### 0-1. 매 작업 검증 3종 (파일 수정할 때마다, 몰아서 금지)
```bash
cd /c/Users/A/Desktop/projects/farmerstail-app
npx tsc --noEmit          # ⚠️ 절대 | head / | tail 붙이지 말 것 (exit code 삼킴)
npx eslint <수정한 파일들>
npm test                  # 1373개 전부 pass 여야 함. 하나라도 fail → 즉시 되돌리고 기록
```

### 0-2. 커밋 규칙
- 작업 단위(아래 각 체크박스)마다 1커밋. 커밋 후 `git push`.
- 메시지: `<type>(admin): <한 줄 요약> (계획 A1-3)` 처럼 **이 문서의 작업 ID를 꼬리에 명시**.
- 마지막 줄에 반드시:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

### 0-3. 절대 금지 (여기 손대면 안 됨 — 발견사항은 기록만)
- 결제/청구: `app/api/payments/**`, `app/api/cron/subscription-charge/**`, `lib/payments/**`, `lib/discount.ts`
- 인증: `app/(auth)/**`, `lib/auth/**`, `app/auth/**`
- 임상/알고리즘 수치·로직: `lib/nutrition*`, `lib/personalization/**` (표시 문자열도 손대지 말 것)
- DB: `supabase/migrations/**` 신규 작성 금지, Supabase MCP `apply_migration`/`execute_sql` 쓰기 금지
- 웹 고객화면 시각: `app/admin` **밖의** 파일은 이 계획에 명시된 것 외 수정 금지 (웹/앱 분리 규칙 — AGENTS.md)
- 법정 인쇄물: `app/admin/label/[sku]/**` 시각·문구 (사료관리법 표기)
- **잘 되는 코드 리디자인 금지** — 이 문서에 적힌 기계적 치환·명시된 작업만

### 0-4. 사업 지침 (화면에 반영된 값을 바꾸거나 새로 쓸 때 이와 어긋나면 중단·기록)
- 박스 = 레시피 최대 2종, 섞으면 무조건 반반(5:5). 첫 박스는 1종 100%
- 화식 비율 티어 = 곁들임 30 / 반반 50 / 완전 100 (그 외 없음)
- 배송 = 2주마다, 발송은 화요일 하루 (일요일 주문 마감)
- 연어·양 = 고객 완전 비노출 (엔진 내부 deferred 만)
- 포인트·쿠폰·위시리스트·낱개커머스 = 폐기 (새 코드에 등장 금지)
- 할인 = 기본구독 15%(제품 sale_price) + 나무 등급 10%(청구 시) 뿐
- 고객 문구: 처방·전문용어(BCS/DCM)·정확한 영양% 금지, 강아지=petName('이'), 사용자='님'

### 0-5. admin 디자인 정본 (새로 쓰는 마크업은 이걸 따름)
- 헤더: `<h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">` + 설명 `text-[13px] text-zinc-500 mt-1`
- 카드: `rounded-lg bg-white border border-zinc-200` / KPI는 `components/admin/ui.tsx`의 `StatCard`(label·value·unit·sub·help·tone[neutral|green|red|amber])
- 색: zinc 중립 + terracotta 액센트만. moss/sale/gold 는 상태색으로만
- 탭: `AdminTabs`(tabGroups.ts) — 그룹 페이지 최상단

---

## A. 어드민 마스터피스 트랙

### A1. 옛 웜 토큰 → zinc 잔재 마무리 (기계적 치환, 37파일)

**목적**: admin 전체에서 폐기된 웜 토큰을 zinc 표준으로. 12파일은 완료(2026-07-25 야간), 아래 37파일이 잔여.

**치환 매핑 (이것만, 다른 창의적 치환 금지)**:
```bash
sed -i 's/text-ink\b/text-zinc-900/g; s/text-text\b/text-zinc-800/g; s/text-muted\b/text-zinc-500/g; s/bg-bg\b/bg-zinc-50/g; s/border-line\b/border-zinc-200/g; s/bg-text\b/bg-zinc-900/g; s/hover:bg-\[#5C4130\]/hover:bg-zinc-700/g' <파일>
```
- ⚠️ `var(--terracotta)`, `var(--moss)`, `text-sale`, `text-moss`, `text-gold`, `text-terracotta` 는 **건드리지 않는다** (브랜드/상태 액센트).
- ⚠️ `app/admin/label/[sku]/page.tsx` 는 **제외** (법정 인쇄물).

**배치 (배치당 1커밋, 커밋 ID를 메시지에)**:
- [ ] A1-1 (밀도 상위): users/page · products/[id]/insights/page · reports/page · personalization/page · orders/[id]/PartialCancelPanel
- [ ] A1-2: users/[id]/message/page · users/[id]/message/MessageComposer · search-all/page · refunds/page · push-campaigns/CampaignBuilder
- [ ] A1-3: products/[id]/nutrients/NutrientsForm · orders/page · blog/categories/CategoriesManager · push-stats/page · loyalty/page
- [ ] A1-4: subscriptions/calendar/page · push-campaigns/page · products/page · subscriptions/charges/page · products/ProductForm
- [ ] A1-5: orders/[id]/PaymentEventTimeline · finance/page · cs-inbox/page · orders/[id]/ShippingControl · products/[id]/page
- [ ] A1-6 (저밀도 나머지): orders/[id]/OrderStatusControl · personalization-insights/page · invention-flags/page · blog/BlogPostForm(잔여3) · algorithm/page · products/new/page · products/[id]/nutrients/page · blog/categories/page · blog/[id]/page · subscriptions/page · products/ProductRowActions · blog/new/page

**완료 기준(DoD)**: `grep -rE "text-ink|text-muted|text-text|bg-bg\b|border-line|bg-text\b" app/admin --include="*.tsx" | grep -v "label"` 결과 **0줄** + 검증 3종 그린.

**함정**:
- `text-text` 치환 시 `text-textarea` 같은 오매칭 없음(\b 경계) — 확인만.
- `bg-bg-2` 는 이미 `bg-zinc-50` 으로 끝났음. `bg-bg/40` 같은 변형은 `bg-zinc-50/40` 으로 자연 치환됨(정상).
- 치환 후 같은 줄에 `style={{ color: 'var(--ink)' }}` 인라인이 남아 이중지정되면: 인라인 쪽을 `#18181b` 로 바꾸지 말고 **그대로 두고 기록만** (인라인 정리는 별도 판단 필요).

### A2. admin 페이지 docstring 현행화 (주석만, 코드 무변경)

**목적**: 대개편 이전 설명이 남은 파일 상단 docstring 을 현재 기능 설명으로. **코드·JSX 는 절대 안 건드림.**

- [ ] A2-1 `app/admin/personalization/page.tsx` 상단 docstring — 현재는 "알고리즘 시뮬레이터 + 운영 통계"라고 시작. 다음 내용으로 교체:
  ```
  /admin/personalization — 레시피 승인(동의) 현황 페이지 (대개편 v2 R4).
  주인공은 고객 동의 대기 큐(5일 타임아웃)·승인 KPI·케어목표/체크인 통계.
  알고리즘 시뮬레이터 2종(v2 firstBox/nextBox·v3)은 ?dev=1 게이트로 숨김
  (개발용 — <details> 접이식은 렌더러 freeze 재현되어 서버 조건부로 대체).
  ```
- [ ] A2-2 `components/admin/AdminNav.tsx` 상단 주석의 그룹 설명이 "운영/분석/상품·콘텐츠/맞춤·시스템" 옛 구조를 언급하면 → "매일 / 돈 / 가끔 / 추후 개발 (2026-07-24 대개편 v2)" 로.
- [ ] A2-3 grep 으로 옛 개념 언급 주석 찾기: `grep -rn "쿠폰\|포인트 적립\|위시리스트\|무료배송" app/admin --include="*.tsx"` → **주석에서만** 남아있으면 "(폐기됨 2026-07)" 표기가 이미 있는지 확인, 없으면 주석에 덧붙임. 코드면 건드리지 말고 기록.

**DoD**: 변경은 주석 diff 뿐 (git diff 에서 코드 라인 변화 0).

### A3. `.kicker` CSS 클래스 잔재 정리

**배경**: `kicker` / `kicker-gold` / `kicker-muted` 클래스(웜 시절 uppercase 라벨)가 admin 에 남음 (reports/page.tsx 의 "차감 항목"·"많이 팔린 상품", cron-health "실패 기록" 등).

- [ ] A3-1 사용처 수집: `grep -rn "kicker" app/admin --include="*.tsx"` (globals.css 정의는 그대로 둠 — 웹에서 쓸 수 있음)
- [ ] A3-2 admin 내 사용처만 다음 마크업으로 교체:
  `<span className="kicker...">텍스트</span>` → `<h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">텍스트</h2>`
  (HelpTip 이 안에 있으면 유지. 기존이 span 이고 주변 구조상 h2 가 어색하면 span 유지하고 클래스만 교체)
- [ ] A3-3 검증 3종 + 커밋 1개.

**DoD**: `grep -rn "kicker" app/admin --include="*.tsx"` 0줄.

### A4. admin API 라우트 일관성 리뷰 (기록 위주 — 수정은 명시된 것만)

**대상 11개**: blog/draft · blog/upload · events/upload · orders/[id]/partial-cancel · orders/[id]/status · orders/export · products/upload · promotions/qr · promotions · push-campaigns · users/[id]/message

- [ ] A4-1 각 라우트를 열어 아래 표를 `ADMIN_API_REVIEW.md` (신규 파일)에 채운다. **코드 수정 없음.**
  | 라우트 | isAdmin 가드 | 입력 검증(zod?) | 에러 응답 형식({code,message}?) | rate limit | 원본 DB 에러 노출? | 비고 |
- [ ] A4-2 표에서 다음 두 가지만 **수정 허용**:
  (a) `isAdmin` 가드가 **아예 없는** 라우트 → 다른 라우트와 동일 패턴으로 추가 (예: orders/[id]/status 의 패턴 복사)
  (b) DB/스토리지 **원본 에러 message 를 클라이언트에 그대로 반환**하는 곳 → `console.error` 로 남기고 클라이언트엔 일반 문구 (기존 audit #69 패턴 검색해서 동일하게)
- [ ] A4-3 그 외 발견(검증 없음·rate limit 없음 등)은 표의 비고에 기록만.

**DoD**: ADMIN_API_REVIEW.md 완성 + (수정했다면) 검증 3종 그린 + 라우트당 개별 커밋.

### A5. 공통화 여지 (리스크 낮은 것만)

- [ ] A5-1 `FilterChip` — 현재 charges/page.tsx 에만 로컬 정의. orders/page 의 상태 필터는 인라인 구현. **통합하지 말고** 다음만: charges 의 FilterChip 위에 주석 `// 공통화 후보 — orders 인라인 필터와 통일 여지(계획 A5-1, 사장님 승인 대기)` 추가. (실제 통합은 시각 변화라 승인 필요)
- [ ] A5-2 `AdminHeader`(ui.tsx) 채택 현황 조사만: `grep -rLn "AdminHeader" app/admin/*/page.tsx | head` 로 raw h1 페이지 목록을 ADMIN_API_REVIEW.md 하단에 기록. (마이그레이션은 하지 않음 — raw 패턴도 이미 표준 문자열로 통일돼 있음)

---

## B. 고객 앱/웹 코드 트랙 (⚠️ admin 밖 — 명시된 것만)

- [ ] B1 `lib/supabase/types.ts` 재생성 — 드롭된 함수 4개(accept_dog_invitation·lookup_invitation_by_token·upsert_cart_item·refund_order_points) 타입 잔재 제거:
  ```bash
  npx supabase gen types typescript --project-id adynmnrzffidoilnxutg --schema public > lib/supabase/types.ts
  ```
  실행 후 검증 3종. tsc 에러가 나면(다른 코드가 그 타입 참조) **되돌리고 기록** (`git checkout -- lib/supabase/types.ts`).
- [ ] B2 (보류 — 사장님 결정 대기) 플랜 "하루 N원부터" 카피: 결정 나면 `lib/start-plan.ts` 의 dailyKrw 계산에 곁들임 티어(×0.3) 값을 추가하고 StartSurvey 564·565·609 문구를 "곁들임 기준 하루 약 N원부터"로. **결정 전 착수 금지.**
- [ ] B3 (보류 — 임상 인접, 사장님 승인 후) progression 크론 gate 대칭: `app/api/cron/personalization-progression/route.ts` 의 nextBox 결과 저장 직전에 compute route 5.5a 와 동일한 gateAvailability 블록 추가. compute/route.ts 549-560줄 패턴 그대로. **승인 전 착수 금지.**

---

## C. 품질/인프라 트랙

- [ ] C1 알고리즘 회귀 재검증 절차(변경 없어도 주 1회 권장): `npm test` + scratchpad `audit-chain.ts`(E2E 35 불변식)를 repo 루트 임시 복사로 실행. 실패 시 어떤 불변식인지 기록하고 **수정 시도 금지**(Fable 호출).
- [ ] C2 (출시 후) 성능 어드바이저 처리: RLS `auth.uid()` per-row 3곳(stamps·promotion_claims·product_qna) `(select auth.uid())` 치환 마이그레이션, 미사용 인덱스 46개 정리 — **지금은 하지 않음.**

---

## D. 📦 25일 야간작업 보류함 (사장님이 "25일 야간작업 뭐 해야 하지?" 라고 물으면 이 섹션을 보여주고 지시받아 실행)

1. **플랜 가격 카피 결정** — "하루 약 14,795원부터"(완전화식 단가) vs "곁들임 기준 하루 약 4,400원부터". 결정 시 → B2 실행.
2. **재고 간편 조정 버튼** — 제품 목록(app/admin/products/page.tsx) 각 행에 [-10] [-1] [+1] [+10] 재고 patch 버튼. API: 기존 제품 업데이트 경로 재사용(supabase client `.update({stock})` — ProductRowActions 패턴 참조). 승인 시 상세 스펙은 Fable 이 작성.
3. **아침 운영 브리핑 푸시** — 매일 09시 처리대기 요약(미발송·결제실패·답장대기·재고부족)을 사장님 폰 푸시로. cron + lib/push 재사용. 승인 시 상세 스펙은 Fable 이 작성.
4. **progression gate 대칭(B3)** — 위험 낮음·임상 인접이라 승인 필요.
5. (참고) 주문 일괄 배송처리는 **택배사 계약 확정 후** 설계.

---

## 실행 로그 (실행자가 한 줄씩 추가)
- 2026-07-25 계획 수립 (Fable)
