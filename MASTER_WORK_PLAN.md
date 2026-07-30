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
- **결제수단 = 카드 · 토스페이 뿐 (2026-07-30, 정본 `lib/payments/billing-methods.ts`)**
  네이버페이는 사장님 지시로 제외, 카카오페이는 토스가 자동결제를 지원하지 않는다.
  카드사 선택(현대/삼성…) 구조는 **일반결제 전용**이라 구독엔 못 쓴다 — 자동결제는
  카드를 저장해야 하고 그러려면 카드번호가 필요하다. 토스페이는 **기본 켜짐**
  (계약 확인 완료 2026-07-30) — 비상 스위치만 `NEXT_PUBLIC_TOSSPAY_BILLING=off`.
  결제 등록 화면은 **자체 헤더 + "다음" 버튼**이다 — iOS 는 사용자가 직접 안
  누른 화면 이동을 막을 수 있어 토스 호출은 반드시 클릭 핸들러 안에서 한다
  (useEffect 자동 호출로 되돌리지 말 것).
  **등록 여부는 `billing_key` 로만 판정한다** — 토스페이는 카드번호(last4)가
  없어서 last4 로 보면 등록한 고객이 등록 화면으로 무한히 돌려보내진다.
- 고객 문구: 전문용어(BCS/DCM)·정확 영양% 금지, 강아지=petName('이')·사용자='님' (lib/korean)

### 0-4. admin 디자인 정본
- 헤더: `text-[22px] font-bold tracking-tight text-zinc-900 leading-tight` + 설명 `text-[13px] text-zinc-500 mt-1` ("~하는 곳이에요" 톤)
- 카드: `rounded-lg bg-white border border-zinc-200` · KPI = ui.tsx `StatCard`
- 색: zinc 중립 + terracotta 액센트. moss/sale/gold 는 상태색으로만 · 탭: `AdminTabs`
- **숫자 입력은 `components/admin/NumberInput` 만 쓴다 (2026-07-26)** —
  raw `<input type="number">` 에 `onChange={(e) => set(Number(e.target.value))}`
  를 쓰면 **칸을 비웠을 때 `Number('')` 가 0 이라 0 이 박히고 지워지지 않는다**
  (사장님 제보: 20 → 150 으로 못 고침). NumberInput 은 편집 중 글자를 직접
  들고 있어 빈 칸이 유지되고, 휠 스크롤로 값이 바뀌는 것도 막는다.
  필수 항목은 `emptyAs={0}`, 비워도 되는 항목은 생략(=null).
  규칙은 `lib/number-field.ts` + 테스트 8개로 고정돼 있다.
  예외: `?dev=1` 뒤의 시뮬레이터 — 타입 캐스트가 얽혀 있고 사장님이 쓰지 않는다.
- **개발자 용어를 화면에 그대로 찍지 말 것 (2026-07-26 사장님 지적)** —
  `cron · pending → cancelled` 이나 `{"reason": "..."}` JSON 덩어리가 그대로
  보이면 사장님은 못 읽는다. DB 원본값은 **반드시 라벨 표를 거친다**:
  상태값 → `STATUS_LABEL`, 자동작업 경로 → `lib/cron-labels.ts` 의 `cronLabel()`,
  metadata JSON → `라벨: 값` 줄로 풀고 내부 식별자(paymentKey 등)는 감춘다.
  새 이벤트·크론을 추가하면 라벨 표에도 한 줄 추가할 것(빠지면 원본이 노출돼
  바로 눈에 띈다). `master switch`·`payload`·`grace period` 같은 영문 기술어도 금지.
- **설명문 강조 (2026-07-25 추가)** — ui.tsx 의 `Hl`·`Em`·`Warn` 만 쓴다.
  `<Hl>` 형광펜 = **문단당 딱 하나**, "이 페이지가 뭐 하는 곳인가"의 핵심.
  `<Em>` = 숫자·기준·조건(잘못 읽으면 안 되는 값, 여러 개 OK).
  `<Warn>` = 되돌릴 수 없거나 고객에게 바로 나가는 동작.
  형광펜 2개 이상 = 강조 소멸. 새 admin 페이지를 만들면 설명문에 이걸 적용할 것.
- **다열 그리드는 반드시 반응형** — `grid-cols-3` 처럼 프리픽스 없이 쓰면 폰에서도
  3열이라 칸이 130px 로 눌려 글자가 한 단어씩 세로로 쪼개진다(2026-07-25 제보).
  폼 2/1 분할은 `grid-cols-1 lg:grid-cols-3` + `lg:col-span-2`. **col-span 도 같이
  반응형이어야 한다** — 1열 그리드의 `col-span-2` 는 암묵적 2번째 컬럼을 만든다.
  지표 카드는 `grid-cols-2 md:grid-cols-4`.
- **service_role(`createAdminClient`) 을 쓰는 admin 페이지는 자체 가드 필수** —
  RLS 를 우회하므로 layout 가드만 믿으면 안 된다. 자세한 근거는
  ADMIN_SECURITY_REVIEW.md.
- **표는 반드시 `overflow-x-auto` 래퍼 안에** — globals.css 의
  `.admin-body table { min-width: 720px }` 때문에 래퍼 없는 표 하나가 페이지
  전체를 옆으로 밀어낸다. 히트맵 색은 연속 alpha 금지, **배경·글자색 고정 쌍**
  (`CohortRetentionTable` 의 `RETENTION_SCALE` 패턴)으로 대비를 보장할 것.

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
- [x] B1-1(완료 2026-07-25): users/page · products/[id]/insights · reports · personalization/page · orders/[id]/PartialCancelPanel
- [x] B1-2: users/[id]/message(page·MessageComposer) · search-all · refunds · push-campaigns/CampaignBuilder
- [x] B1-3: nutrients/NutrientsForm · orders/page · blog/categories/CategoriesManager · push-stats · loyalty
- [x] B1-4: subscriptions/calendar · push-campaigns/page · products/page · charges · ProductForm
- [x] B1-5: PaymentEventTimeline · finance · cs-inbox · ShippingControl · products/[id]/page
- [x] B1-6(완료·DoD 0줄): OrderStatusControl · personalization-insights · invention-flags · BlogPostForm(잔여3) · algorithm · products/new · nutrients/page · blog/categories/page · blog/[id] · subscriptions/page · ProductRowActions · blog/new
**DoD**: `grep -rE "text-ink|text-muted|text-text|bg-bg\b|border-line|bg-text\b" app/admin --include="*.tsx" | grep -v label` → 0줄.

### B2. `.kicker` 클래스 잔재 → zinc 라벨
사용처(`grep -rn "kicker" app/admin`)를 `text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500` 로 교체(HelpTip 유지). globals.css 정의는 그대로.
- [x] B2 완료 2026-07-25 — className='kicker' 7곳 zinc 유틸로. DoD 0줄 달성.

### B3. docstring 현행화 (주석만)
- [x] B3-1 완료 2026-07-25 — `personalization/page.tsx` 상단 — "레시피 승인(동의) 현황 페이지. 시뮬레이터는 ?dev=1 게이트(접이식은 렌더러 freeze 로 서버 조건부 대체)" 취지로 교체.
- [x] B3-2 확인 — `AdminNav.tsx` 이미 v2 최신(수정 불요) 상단 그룹 설명이 옛 구조면 "매일/돈/가끔/추후 개발(2026-07-24 v2)" 로.
- [x] B3-3 확인 — 폐기 개념 주석은 이미 정정 표기됨. `grep -rn "쿠폰|포인트 적립|위시리스트|무료배송" app/admin` — 주석이면 "(폐기 2026-07)" 부기.

### B4. admin API 라우트 점검 (11개)
blog/draft · blog/upload · events/upload · orders/[id]/partial-cancel · orders/[id]/status · orders/export · products/upload · promotions/qr · promotions · push-campaigns · users/[id]/message
- [x] B4-1 완료 2026-07-25 → ADMIN_API_REVIEW.md. 각 라우트 표 작성 → `ADMIN_API_REVIEW.md`: | 라우트 | isAdmin 가드 | 입력 검증 | 에러 형식 | rate limit | 원본 DB에러 노출 | 비고 |
- [x] B4-2 완료 — isAdmin 누락 0건 확인, promotions DB에러 노출 3곳 dbError 적용. 수정: (a) isAdmin 가드 누락 라우트에 추가 (b) 원본 DB 에러 노출 → console.error + 일반 문구(audit #69 패턴). 그 외 개선도 재량으로 가능하되 **동작(성공 응답 shape) 변경 금지**.

### B5. 공통화
- [x] B5-1 완료(2026-07-25) — ui.tsx FilterChip 통합, 4곳 적용, 웜 잔재 2건 제거. ~~원문~~  FilterChip(charges 로컬) ↔ orders 인라인 필터 — ui.tsx 로 공통 추출 후 두 곳 적용(시각은 현행 orders 스타일 기준 통일).
- [x] B5-2 완료 — ADMIN_API_REVIEW.md 하단 기록(문자열 표준 통일돼 시각 차 없음). `AdminHeader` 미사용 페이지 목록화(ADMIN_API_REVIEW.md 하단) — 마이그레이션은 선택(할 경우 시각 동일 유지).

---

## §C. 고객 앱 트랙 (출시 전 점검·작업)

- [x] **C1 완료(2026-07-25)** — CLI 대신 MCP generate_typescript_types 로 재생성. 드롭 함수 4개(accept_dog_invitation·lookup_invitation_by_token·refund_order_points·upsert_cart_item) 타입 제거, 스탬프 함수 3종 추가. 호출부 0건 확인. ~~기존 메모~~:  types.ts 에 profiles.admin_note 수기 삽입 완료(2026-07-25). CLI 인증 필요해 전체 재생성은 미실행 — 드롭 함수 4개 타입 잔재는 남아 있음: `lib/supabase/types.ts` 재생성(드롭 함수 4개 타입 잔재 제거): `npx supabase gen types typescript --project-id adynmnrzffidoilnxutg --schema public > lib/supabase/types.ts` → tsc 에러 시 `git checkout -- lib/supabase/types.ts` 후 에러 내용 기록.
- [x] C2 완료(2026-07-25) — 색 토큰 스왑에 모서리 반경까지 확장. `/account/subscriptions` 웹톤 잔재 제거(기존 태스크 #8) — 앱 컨텍스트에서 웹 카드 스타일 남은 부분을 v3 톤으로(AGENTS.md 분리 규칙 준수, `isAppContextServer` 분기 패턴).
- [ ] C3 모바일 웹뷰 QA 체크리스트 실행·기록(`MOBILE_QA.md` 신규): 설문 전 스텝 · 분석 · 플랜 · 로그인/가입 · 마이페이지 — 375px에서 스크린샷 찍고 깨짐/오버플로 기록(수정은 admin 규칙과 동일하게 안전한 것만).
- [x] C4 확인 완료(2026-07-25) — manifest 바로가기 4개 전부 실 라우트, SW 오프라인 fallback 연결됨. 수정 불요. PWA 점검: manifest.json(이름·아이콘·theme_color)·오프라인 fallback 존재 여부·홈화면 설치 흐름 — 기록 후 안전한 수정.
- [x] C5 완료(2026-07-25) — 전수 스캔 1건(/mypage/orders DB 원본 에러 노출) 수정, 원본은 Sentry 로. 에러/빈 상태 카피 톤 점검: "~해요" 체·기술용어 노출 없는지 grep(`Error|failed|exception` 문자열이 고객 화면에 그대로 노출되는 곳) — 발견 시 부드러운 문구로.

## §D. 웹(퍼널) 트랙

- [x] D1 완료(2026-07-25) — 공개 11개 점검, 실제 갭은 /start(sitemap 누락 + OG 없음) 하나. 둘 다 추가. SEO 기본: 각 공개 페이지(`/`·`/start`·`/compare`·`/faq`·`/blog`·`/about`·`/science`·`/partners`) metadata(title·description·OG 이미지) 존재 확인 → 누락만 보완. `sitemap.ts`/`robots.ts` 존재 확인.
- [x] D2 완료(2026-07-25) — WEB_PERF.md. 실측 4.29MB → 폰트 preload 1.32MB 제거. Pretendard 서브셋은 사장님 판단 대기. Lighthouse 성능 1회 측정·기록(모바일 기준, `WEB_PERF.md`): LCP 3s+ 페이지만 원인 기록(이미지 크기 등). 수정은 이미지 최적화(next/image 전환·사이즈 명시)류 안전한 것만.
- [x] D3 완료(2026-07-25) — /start 익명 퍼널 계측 0건이던 것을 이벤트 4종 추가. 퍼널 계측 확인: `lib/analytics` 의 trackAnalysisViewed/trackBoxRecommended 류가 /start→가입 흐름에서 실제 호출되는지 코드 추적·기록.

## §E. 품질/인프라 (상시)

- [ ] E1 주간 회귀: `npm test` + E2E 체인(scratchpad audit-chain — repo 루트 임시 복사 실행, 35 불변식) — 실패 시 커밋 금지·원인 기록.
- [x] E2 실행(2026-07-25) — 새 WARN 0건. 유출 비밀번호 차단 토글만 사장님 조치 대기. `get_advisors(security)` 월 1회 실행·기록 — 새 WARN 만 보고.
- [ ] E3 (출시 후) 성능: RLS `auth.uid()` per-row 3곳 `(select auth.uid())` 마이그레이션·미사용 인덱스 46개 정리 — 시점 오면 Fable 이 SQL 작성.

---

## §F. 📦 25일 야간 보류함 (사장님 "25일 야간작업 뭐 해야 하지?" 트리거 시 꺼내기)

1. 플랜 가격 카피 — "하루 14,795원부터"(완전화식) vs "곁들임 기준 ~4,400원부터". 결정 시: `lib/start-plan.ts` 에 곁들임(×0.3) 값 추가 + StartSurvey 564·565·609 문구 교체.
2. ~~progression 크론(cycle2+) gate 대칭~~ → **완료(2026-07-25)**. 5.5a(판매중 게이트)
   + 5.5c(알레르기 누출 감지) 둘 다 적용. 누출 시 자동적용 금지 + 전용 푸시 문구 +
   메일 억제 + Sentry 알림. **남은 사장님 판단 1건**: 모든 라인이 차단된 경우
   이전 처방도 안전하지 않은데, 구독을 자동 일시정지할지 상담 후 수동 처리할지는
   운영 정책이라 코드에서 임의로 정하지 않았다.
3. §A 신기능 중 그날 밤 우선순위 지정받아 실행.

---

## 실행 로그
- 2026-07-25 v1 계획 수립, 같은 날 v2 개정(신기능 스펙 본편 승격 + 앱/웹/품질 로드맵 추가) (Fable)
