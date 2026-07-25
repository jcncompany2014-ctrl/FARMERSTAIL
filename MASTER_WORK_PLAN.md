# 파머스테일 마스터 워크플랜 (실행자용) — v2

> 2026-07-25 Fable 설계 → 실행은 저비용 모델이 이 문서를 따른다.
> 실행자는 이 문서 범위 안에서 **재량껏 잘 구현**하면 된다. 단 §0-2 금지 목록과 §0-3 사업 지침은 재량 밖 — 어기지 말 것.
> 진행 표기: 완료 시 체크박스 `[x]` + 하단 "실행 로그"에 한 줄.

---

## §0. 실행자 규칙

### 0-1. 매 작업 검증 3종 (파일 수정마다)
```bash
cd /c/Users/A/Desktop/projects/farmerstail-app
npx tsc --noEmit          # ⚠️ | head / | tail 금지 (exit code 삼킴 — AGENTS.md)
npx eslint <수정한 파일들>
npm test                  # 1373개 전부 pass. fail → 원인 고치거나 되돌릴 것
```
커밋은 작업 ID 단위 1개, 메시지 꼬리에 `(계획 A1-3)` 형식으로 ID 명시, 마지막 줄:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` — 커밋 후 push.

### 0-2. 금지 (여기만은 재량 없음)
- **수정 금지 파일**: `app/api/payments/**` · `app/api/cron/subscription-charge/**` · `lib/payments/**` · `lib/discount.ts` · `app/(auth)/**` · `lib/auth/**` · `lib/nutrition*` · `lib/personalization/**`(수치·로직) · `app/admin/label/[sku]/**`(법정 인쇄물 시각)
- **DB**: 마이그레이션은 이 문서에 **SQL 이 그대로 적힌 것만** `apply_migration` 허용. 임의 DDL 금지.
- **웹 고객화면 시각**: admin 밖 파일은 이 문서에 명시된 것만 (웹/앱 분리 — AGENTS.md).
- 잘 돌아가는 로직의 동작 변경 금지 (UI·카피·구조 개선은 OK).

### 0-3. 사업 지침 (화면·문구·값이 이와 어긋나게 만들지 말 것)
- 박스 = 레시피 최대 2종·섞으면 무조건 반반. 첫 박스 = 1종 100%
- 화식 티어 = 곁들임30 / 반반50 / 완전100 뿐 · 배송 = 2주마다 화요일(일요일 마감)
- 연어·양 = 고객 완전 비노출 · 포인트/쿠폰/위시리스트/낱개커머스 = 폐기(새 코드 등장 금지)
- 할인 = 구독 15%(sale_price) + 나무 10%(청구 시) 뿐
- 고객 문구: 전문용어(BCS/DCM)·정확 영양% 금지, 강아지=petName('이')·사용자='님' (lib/korean)

### 0-4. admin 디자인 정본
- 헤더: `text-[22px] font-bold tracking-tight text-zinc-900 leading-tight` + 설명 `text-[13px] text-zinc-500 mt-1` ("~하는 곳이에요" 톤)
- 카드: `rounded-lg bg-white border border-zinc-200` · KPI = ui.tsx `StatCard`
- 색: zinc 중립 + terracotta 액센트. moss/sale/gold 는 상태색으로만 · 탭: `AdminTabs`

### 0-5. 사장님 운영 리듬 (신기능은 이 흐름을 돕는 것)
일요일 주문 마감 → **월요일 원료 확정·손질** → **화요일 조리·포장·발송** → 수시 CS/재고/알림. 솔로 운영, 주 사용기기 = 폰.

---

## §A. 어드민 마스터피스 — 신기능 트랙 (사장님 편의, 스펙 포함)

### A-F1. 🥩 원료 소요량 계산 — ✅ **이미 구현돼 있음 (2026-07-25 확인, 작업 불요)**
피킹 리스트에 "조리 합계" 섹션이 이미 제품별 `N.NNkg · N팩` 을 보여준다(page.tsx cookTotals).
아래 원안은 참고용으로만 남김.

<details><summary>원안(불요)</summary>
**왜**: 월요일에 "이번 주 닭 몇 kg, 오리 몇 kg 사야 하지?"를 지금은 피킹 리스트를 보고 암산한다.
**어디에**: `app/admin/personalization/picking-list/page.tsx` — 기존 요약 카드 옆/아래 새 섹션 "원료 준비".
**데이터**: 이미 있는 `rows[].packs[]`(name·packG·count·totalG)를 레시피(slug→단백질)별로 합산. `LINE_TO_SLUG`/`SKU_MODEL[].nameKo` 매핑 재사용.
**표시**: 레시피별 `총 g` 합계를 kg(소수1자리 올림)로 — 예: `치킨 4.2kg · 오리 2.8kg`. 완제품 기준임을 명시하는 한 줄("팩 총량 기준 — 원물 소요는 배합비만큼 곱해 주세요"). 손질 여유율 등 임의 가정 추가 금지(배합비는 영업비밀·이 화면에 없음).
- [x] 확인 결과 기구현 — 작업 없음 `(계획 A-F1)`
</details>

### A-F2. 📦 패킹 체크 모드 (화요일 포장 실수 방지)
**왜**: 박스 N개를 싸면서 어떤 걸 쌌는지 놓치기 쉬움.
**어디에**: picking-list 각 박스 카드에 클라이언트 체크박스(완료 표시 시 카드 흐리게 + 취소선). 저장은 `localStorage`(키: `packing-${shipDate}`) — DB 불필요, 새로고침 유지, 발송일 바뀌면 리셋.
**추가**: 헤더에 "N/M 완료" 진행 카운터.
- [x] 완료 2026-07-25 — PackingChecklist.tsx (localStorage `packing:{발송일}`·진행바·초기화) `(계획 A-F2)`

### A-F3. 📊 재고 간편 조정 (제조 후 보충)
**왜**: 화요일 조리 후 재고 반영이 지금은 제품 편집 폼 깊숙이.
**어디에**: `app/admin/products/page.tsx` 각 행 재고 숫자 옆 `[-10][-1][+1][+10]` 버튼(클라 컴포넌트 — 기존 `ProductRowActions.tsx` 패턴/权한 재사용, supabase `.update({ stock })`).
**가드**: 결과가 0 미만이면 0으로 클램프. 성공 토스트 "재고 103 → 117".
- [x] 완료 2026-07-25 — ProductRowActions StockEditor 에 −10/−1/+1/+10 델타(0 클램프·토스트) `(계획 A-F3)`

### A-F4. 🔔 아침 운영 브리핑 푸시 (매일 09시)
**왜**: 아침에 admin 안 열어도 오늘 할 일을 폰에서 봄.
**구현**: 새 크론 `app/api/cron/daily-briefing/route.ts` — 기존 크론 골격(`isAuthorizedCronRequest`+`trackCron`) 복사. 집계는 대시보드 ActionsPanel 과 동일 쿼리(미발송24h+·결제실패·답장대기·재고부족·오늘 화요일이면 발송 박스 수). 발송은 `lib/push` 의 기존 발송 헬퍼로 **admin(사장님) 계정에만** (profiles.role='admin' 대상, category='order'). 전부 0건이면 "오늘 처리할 일 없음 ☀️"도 발송.
**등록**: `vercel.json` cron 배열에 `0 0 * * *`(UTC 0시 = KST 09시) 추가.
- [x] 완료 2026-07-25 — /api/cron/daily-briefing + vercel cron `0 0 * * *`(KST 09시). admin 계정 푸시(카테고리 게이트 우회)·url='/admin' 딥링크·0건도 발송. 기존 ops-digest(장애 이메일)와 역할 다름 `(계획 A-F4)`

### A-F5. 🗒️ 고객 운영 메모 (CS 기억 보조)
**왜**: "이 고객 지난번 배송 이슈로 사과드렸던 분" 같은 걸 머리로 기억 중.
**DB(이 SQL 그대로만 적용 허용)**:
```sql
-- 계획 A-F5: 고객 운영 메모 (admin 전용)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_note text;
COMMENT ON COLUMN public.profiles.admin_note IS 'admin 전용 운영 메모(계획 A-F5). RLS: 기존 profiles 정책상 본인 row select 가능하므로 고객에게 보일 수 있는 내용 금지 — UI 에 그 경고 문구 표시.';
```
**UI**: `app/admin/users/[id]/message/page.tsx` 상단(프로필 아래)에 메모 textarea + 저장 버튼(클라 컴포넌트). 회원 목록(users/page.tsx) 행에는 메모 있으면 📌 아이콘만. **경고 문구 필수**: "⚠️ 고객 본인 조회 가능성 있는 필드 — 민감한 표현 금지".
- [x] 완료 2026-07-25 — profiles.admin_note 마이그레이션 + AdminNoteCard(1:1 메시지 최상단·본인노출 경고) `(계획 A-F5)`

### A-F6. 📅 배송 캘린더 날짜 클릭 → 그날 박스 목록
**왜**: 캘린더에서 날짜의 배송 상세를 보려면 지금은 구독 목록으로 이동해 찾아야 함.
**구현**: `subscriptions/calendar/page.tsx` 날짜 셀에 배송 있으면 `?day=YYYY-MM-DD` 링크 → 같은 페이지 하단에 그날 구독(강아지·수령인·금액) 리스트 렌더(서버 컴포넌트 분기, 이미 fetch한 데이터 재사용).
- [x] 완료 2026-07-25 — '+N건 더 보기' 링크 + `?day=` 하단 전체 목록(추가 쿼리 없음) `(계획 A-F6)`

### A-F7. ✉️ CS 템플릿 관리형 확장
**왜**: 1:1 메시지 템플릿 3개(환불·지연·결제실패)가 하드코딩 — 사장님이 자주 쓰는 문구를 스스로 추가 못 함.
**구현(가벼운 버전)**: MessageComposer 의 TEMPLATES 배열을 `automation_settings` 같은 싱글턴이 아니라 **localStorage 커스텀 템플릿**(추가/삭제 UI)과 병합 표시. DB 불필요.
- [x] 완료 2026-07-25 — 기본3종+커스텀(localStorage `admin:cs-templates`) 병합, '현재 문구 저장'/칩 ✕ 삭제. 저장→표시→삭제 라이브 검증 `(계획 A-F7)`

### (보류 — 조건 충족 시) A-F8. 주문 일괄 배송처리 + 운송장: **택배사 계약 확정 후** Fable 이 스펙 작성.

---

## §B. 어드민 마스터피스 — 마감(폴리시) 트랙

### B1. 옛 웜 토큰 → zinc 잔재 마무리 (37파일, 기계적)
**치환(이 매핑만)**:
```bash
sed -i 's/text-ink\b/text-zinc-900/g; s/text-text\b/text-zinc-800/g; s/text-muted\b/text-zinc-500/g; s/bg-bg\b/bg-zinc-50/g; s/border-line\b/border-zinc-200/g; s/bg-text\b/bg-zinc-900/g; s/hover:bg-\[#5C4130\]/hover:bg-zinc-700/g' <파일>
```
`var(--terracotta|--moss)`·`text-sale/moss/gold/terracotta` 는 유지. `label/[sku]` 제외.
- [ ] B1-1: users/page · products/[id]/insights · reports · personalization/page · orders/[id]/PartialCancelPanel
- [ ] B1-2: users/[id]/message(page·MessageComposer) · search-all · refunds · push-campaigns/CampaignBuilder
- [ ] B1-3: nutrients/NutrientsForm · orders/page · blog/categories/CategoriesManager · push-stats · loyalty
- [ ] B1-4: subscriptions/calendar · push-campaigns/page · products/page · charges · ProductForm
- [ ] B1-5: PaymentEventTimeline · finance · cs-inbox · ShippingControl · products/[id]/page
- [ ] B1-6(나머지 12): OrderStatusControl · personalization-insights · invention-flags · BlogPostForm(잔여3) · algorithm · products/new · nutrients/page · blog/categories/page · blog/[id] · subscriptions/page · ProductRowActions · blog/new
**DoD**: `grep -rE "text-ink|text-muted|text-text|bg-bg\b|border-line|bg-text\b" app/admin --include="*.tsx" | grep -v label` → 0줄.

### B2. `.kicker` 클래스 잔재 → zinc 라벨
사용처(`grep -rn "kicker" app/admin`)를 `text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500` 로 교체(HelpTip 유지). globals.css 정의는 그대로.
- [ ] B2 완료 → DoD: admin 내 kicker 0줄.

### B3. docstring 현행화 (주석만)
- [ ] B3-1 `personalization/page.tsx` 상단 — "레시피 승인(동의) 현황 페이지. 시뮬레이터는 ?dev=1 게이트(접이식은 렌더러 freeze 로 서버 조건부 대체)" 취지로 교체.
- [ ] B3-2 `AdminNav.tsx` 상단 그룹 설명이 옛 구조면 "매일/돈/가끔/추후 개발(2026-07-24 v2)" 로.
- [ ] B3-3 `grep -rn "쿠폰|포인트 적립|위시리스트|무료배송" app/admin` — 주석이면 "(폐기 2026-07)" 부기.

### B4. admin API 라우트 점검 (11개)
blog/draft · blog/upload · events/upload · orders/[id]/partial-cancel · orders/[id]/status · orders/export · products/upload · promotions/qr · promotions · push-campaigns · users/[id]/message
- [ ] B4-1 각 라우트 표 작성 → `ADMIN_API_REVIEW.md`: | 라우트 | isAdmin 가드 | 입력 검증 | 에러 형식 | rate limit | 원본 DB에러 노출 | 비고 |
- [ ] B4-2 수정: (a) isAdmin 가드 누락 라우트에 추가 (b) 원본 DB 에러 노출 → console.error + 일반 문구(audit #69 패턴). 그 외 개선도 재량으로 가능하되 **동작(성공 응답 shape) 변경 금지**.

### B5. 공통화
- [ ] B5-1 FilterChip(charges 로컬) ↔ orders 인라인 필터 — ui.tsx 로 공통 추출 후 두 곳 적용(시각은 현행 orders 스타일 기준 통일).
- [ ] B5-2 `AdminHeader` 미사용 페이지 목록화(ADMIN_API_REVIEW.md 하단) — 마이그레이션은 선택(할 경우 시각 동일 유지).

---

## §C. 고객 앱 트랙 (출시 전 점검·작업)

- [~] C1 (부분) types.ts 에 profiles.admin_note 수기 삽입 완료(2026-07-25). CLI 인증 필요해 전체 재생성은 미실행 — 드롭 함수 4개 타입 잔재는 남아 있음: `lib/supabase/types.ts` 재생성(드롭 함수 4개 타입 잔재 제거): `npx supabase gen types typescript --project-id adynmnrzffidoilnxutg --schema public > lib/supabase/types.ts` → tsc 에러 시 `git checkout -- lib/supabase/types.ts` 후 에러 내용 기록.
- [ ] C2 `/account/subscriptions` 웹톤 잔재 제거(기존 태스크 #8) — 앱 컨텍스트에서 웹 카드 스타일 남은 부분을 v3 톤으로(AGENTS.md 분리 규칙 준수, `isAppContextServer` 분기 패턴).
- [ ] C3 모바일 웹뷰 QA 체크리스트 실행·기록(`MOBILE_QA.md` 신규): 설문 전 스텝 · 분석 · 플랜 · 로그인/가입 · 마이페이지 — 375px에서 스크린샷 찍고 깨짐/오버플로 기록(수정은 admin 규칙과 동일하게 안전한 것만).
- [ ] C4 PWA 점검: manifest.json(이름·아이콘·theme_color)·오프라인 fallback 존재 여부·홈화면 설치 흐름 — 기록 후 안전한 수정.
- [ ] C5 에러/빈 상태 카피 톤 점검: "~해요" 체·기술용어 노출 없는지 grep(`Error|failed|exception` 문자열이 고객 화면에 그대로 노출되는 곳) — 발견 시 부드러운 문구로.

## §D. 웹(퍼널) 트랙

- [ ] D1 SEO 기본: 각 공개 페이지(`/`·`/start`·`/compare`·`/faq`·`/blog`·`/about`·`/science`·`/partners`) metadata(title·description·OG 이미지) 존재 확인 → 누락만 보완. `sitemap.ts`/`robots.ts` 존재 확인.
- [ ] D2 Lighthouse 성능 1회 측정·기록(모바일 기준, `WEB_PERF.md`): LCP 3s+ 페이지만 원인 기록(이미지 크기 등). 수정은 이미지 최적화(next/image 전환·사이즈 명시)류 안전한 것만.
- [ ] D3 퍼널 계측 확인: `lib/analytics` 의 trackAnalysisViewed/trackBoxRecommended 류가 /start→가입 흐름에서 실제 호출되는지 코드 추적·기록.

## §E. 품질/인프라 (상시)

- [ ] E1 주간 회귀: `npm test` + E2E 체인(scratchpad audit-chain — repo 루트 임시 복사 실행, 35 불변식) — 실패 시 커밋 금지·원인 기록.
- [ ] E2 `get_advisors(security)` 월 1회 실행·기록 — 새 WARN 만 보고.
- [ ] E3 (출시 후) 성능: RLS `auth.uid()` per-row 3곳 `(select auth.uid())` 마이그레이션·미사용 인덱스 46개 정리 — 시점 오면 Fable 이 SQL 작성.

---

## §F. 📦 25일 야간 보류함 (사장님 "25일 야간작업 뭐 해야 하지?" 트리거 시 꺼내기)

1. 플랜 가격 카피 — "하루 14,795원부터"(완전화식) vs "곁들임 기준 ~4,400원부터". 결정 시: `lib/start-plan.ts` 에 곁들임(×0.3) 값 추가 + StartSurvey 564·565·609 문구 교체.
2. progression 크론(cycle2+) gate 대칭 — compute route 5.5a 블록(549-560줄 패턴)을 nextBox 저장 직전에 동일 적용. 임상 인접이라 이 항목만은 적용 후 Fable 리뷰 요청.
3. §A 신기능 중 그날 밤 우선순위 지정받아 실행.

---

## 실행 로그
- 2026-07-25 v1 계획 수립, 같은 날 v2 개정(신기능 스펙 본편 승격 + 앱/웹/품질 로드맵 추가) (Fable)
