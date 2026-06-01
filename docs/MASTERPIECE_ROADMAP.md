# 마스터피스 로드맵 — 출시 수준 완성도

> 2026-06-01 기준. R60~R101(코드 정적 분석)이 끝난 뒤, **"당장 시장에 내놔도 손색없는가"**를
> 4영역 병렬 진단으로 측정한 결과 + 갭 우선순위 + 실행 계획.
>
> **핵심 결론**: 코드·엔지니어링(SEO/카피/결제/보안/성능/a11y primitive)은 **상위 1% 마스터피스급**.
> 그러나 **실 데이터·콘텐츠가 비어 있고**(법적 출시 불가), **토큰 일관성·알림 연결**이 미완이라
> "껍데기는 명품, 알맹이 일부 미입력" 상태. 코드가 아니라 **데이터·콘텐츠·운영 연결**이 남은 일.

---

## 📊 4영역 진단 점수

| 영역 | 현재 | 한줄 |
|---|---|---|
| 콘텐츠·카탈로그·SEO | **중** | SEO/카피/코드 인프라는 상위 1%, 상품 실 데이터(영양·이미지·법정표시) 전 품목 비어 있음 |
| 운영·모니터링·관측성 | **중상** | 계측은 촘촘, "장애가 나를 깨우는" 알림 전달이 Sentry 콘솔 수동 의존 + 문서-코드 불일치 |
| 디자인·UX | **중상** | 신규 v3·핵심 여정·web/app 분리는 출시급, 구세대 페이지에 radius/타이포 토큰 드리프트 |
| 성능 / 접근성 | **상 / 중상** | 성능 거의 마스터피스, a11y는 primitive 최상급이나 중첩 main·app 라이트 대비 미달 |

**P0 출시차단은 전부 "콘텐츠 데이터"에 몰려 있음** — 코드는 이미 준비됨, 데이터만 채우면 됨.

---

## 🔴 P0 — 출시 차단 (반드시 출시 전)

법적 의무 미충족 또는 빈 상품 페이지. **출시 자체가 불가능한 항목.**

### P0-1. 상품 영양·원재료·법정표시 데이터 입력 〔법적〕
- **문제**: `products` 22개 전부 `nutrition_facts`/`ingredients`/`origin`/`manufacturer`/`feeding_guide`/`allergens` = NULL. `ProductFoodInfo`가 의무 14항목을 전 상품에서 "정보 준비 중"으로 렌더. 사료관리법·전자상거래법 표시의무 미충족(공정위 시정명령+과태료 500만원 리스크).
- **누가**: 🤝 공동 — 영양 수치는 `algorithm_food_lines` 5건에 이미 존재 → **내가 products 동기화 가능**. 제조사명/주소/유통기한/원산지는 **창업자만 아는 사업 정보** → 입력 필요.
- **범위**: 최소 핵심 5종 화식 SKU(FT-B05/C01/D02/P04/S03)부터.

### P0-2. 상품 대표 이미지 〔커머스 기본〕
- **문제**: 이미지 16/22 누락(영양제 0/4·구독 0/3·핵심 SKU 2종 포함), 갤러리 0/22.
- **누가**: 🙋 창업자 — 실제 상품 사진은 내가 못 만듦. 업로드 흐름은 admin에 이미 있음(R98 이미지 처리). 최소 핵심 5종 + 노출 빈도 높은 구독/체험팩 우선.

### P0-3. SKU 정책 확정
- **문제**: `sku` 채워진 건 5건뿐(나머지 17개 NULL). 카피·알고리즘은 "10종 화식" 전제인데 카탈로그는 영양제·구독·간식이 SKU 없이 섞임.
- **누가**: 🤝 공동 — "10종" 기획이면 나머지 화식 5종에 SKU 부여(내가 가능), 아니면 카피의 "10종"을 실제 5종으로 정합(내가 가능). **결정만 창업자**.

---

## 🟠 P1 — 출시 1주 내 (완성도 한 단계)

### 콘텐츠
- **P1-C1. FAQ·파트너 fallback→DB 승격**: 잘 쓴 FAQ 24문항·파트너 6곳이 코드 `FALLBACK_*`에 갇혀 미노출(DB의 얇은 6건/4건만 라이브). FALLBACK을 DB에 insert → 즉시 풍부한 콘텐츠 노출. 🤖 내가 가능.
- **P1-C2. 컬렉션 4개 상품 매핑**: `collection_items=0`이라 4개 컬렉션 전부 빈 껍데기. 컬렉션별 3~6개 product_id 매핑 + hero_image. 🤝 매핑은 내가, 이미지는 창업자.
- **P1-C3. 카테고리 taxonomy 정합** ✅: 칩(영어슬러그 meal/treat/set/supp)·ALLOWED(한글부분집합)·DB(한글5종) 3중 불일치로 카테고리 필터 4/5 가 통째로 깨져 있던 걸 발견 → 음식종류 4분류(화식/간식/영양제/체험팩)로 통일. 정기배송·구독 → 화식 rename(마이그 20260601000000, 코드영향 0 확인) + 앱칩 href + ALLOWED + 데스크톱 CatalogFilters 3곳 DB값 정합.
- **P1-C4. 이벤트 3개 이미지**: hero 슬라이더·Event JSON-LD용 배너. 🙋 창업자.

### 운영
- **P1-O1. 코드 독립 알림 fallback** ✅: `ops-digest` cron 신설 — 매일 KST 8시 cron_health 24h 실패 + refund 큐 적체(pending/permanently_failed) + 24h+ 미결제 적체를 집계해 `business.email` 로 HTML 다이제스트(이상 0건이면 skip, 스팸 방지). Sentry 콘솔 설정과 무관하게 메일로 도달. vercel.json 등록(cron 34개).
- **P1-O2. 문서-코드 정합** ✅: 운영자 메일은 `business.email`(이미 존재, contact 가 사용) 사용 — 새 env 불필요. inventory-forecast/reconcile docstring 의 허위 "admin 이메일(NEXT_PUBLIC_ADMIN_EMAIL)" → "Sentry 기록 + ops-digest 종합 메일" 로 정정.
- **P1-O3. cron-health admin 탭**: "24h cron 실패" 카드가 `/admin?tab=cron-health`로 링크하나 해당 탭 렌더링 없음(죽은 링크). 실패 cron 목록 화면 구현. 🤖 내가 가능.
- **P1-O4. AI 비용 가드**: rate-limit만 있고 일·월 예산 cap·누적 추적·초과 알림 없음. `anthropic_usage` 테이블 + 일 cap + commentary fetch 실패 captureException. 🤖 내가 가능.
- **P1-O5. 프로덕션 SENTRY_DSN 주입 + 콘솔 룰/채널 연결**: 🙋 창업자(Vercel env + Sentry 콘솔) — 출시 체크리스트에 못 박기.

### 디자인·접근성
- **P1-D1. `rounded-full` → `rounded`(4) 정리**: 41개 파일이 v3 시그니처 radius 이탈(DogDetailClient 16·ReferralView 12·membership 9 등). 진짜 pill만 유지하고 카드/버튼/입력은 4px. 🤖 내가 가능(파일별 pill 의도 구분).
- **P1-D2. 타이포 px 리터럴 → V3FontSize**: `text-[13/14/15/18/20px]` 269+곳이 스케일 이탈(SSOT인 components/v3조차 일부 위반). 화면군 단위 토큰화. 🤖 내가 가능(점진).
- **P1-D3. 검색 빈 상태 보강**: `search/page.tsx` "결과 없어요"가 맨 텍스트 한 줄 → AnalysisEmptyState 패턴(아이콘+안내+추천). 🤖 내가 가능.
- **P1-A1. 중첩 `<main>` 랜드마크** ✅: (main) 하위 58파일 64개 `<main>` → `<div>` 강등(속성 보존), AppChrome 의 `<main id="main">` landmark 만 유지. 중첩 0건 확인 + 1035 테스트 통과.
- **P1-A2. app 라이트 mute 대비 미달** ✅: `inkMute #7d7460`(paper 3.97:1, AA 미달, ~859곳) → `#706854`(4.75:1 AA pass) darken. CSS var(`--ink-mute`) + `tokens.ts` + 인라인 하드코딩 4파일(coupons/CartChrome/notifications.css) 정합 + contrast.test 회귀(≥4.5) + AGENTS.md 문서. inkSoft(9.7) 와 구분되어 mute 위계 유지.

---

## 🔵 P2 — 출시 이후 (지속 완성도)

- **콘텐츠**: about/brand 중복 title+canonical 차별화, 상품 meta_description/롱폼 본문, 출시 후 리뷰 시딩(베타 cohort)으로 AggregateRating 활성화.
- **운영**: 죽은 alert 헬퍼 3종(alertNshRisk/alertQualityBreach/alertPiiLeak) wiring, /api/health 외부 의존성 deep probe(`?deep=1`), 백업 자동화(주1 pg_dump cron + 분기 복원 리허설).
- **디자인**: 인라인 빈상태→공유 EmptyState 수렴, CartList app radius 8→4/12, /offline v3 grammar, 데스크톱 폭·compare표·터치타깃 실측.
- **성능/a11y**: CompareClient recharts `next/dynamic` 분할, 고객노출 raw `<img>` 5곳 next/image, v3 Tabs 화살표키 roving tabindex.

### ⚠️ 실테스트(결제키) 필요 — 이전 R101 보류분
- R101-I: webhook PARTIAL_CANCELED refunded_amount 정합(멱등성 설계)
- R101-H: sales_count/cumulative_spend 트리거 재설계(prod 마이그+회귀)
- 결제 1회 실 흐름(결제→confirm→영수증→부분취소→환불) — 가장 큰 단일 검증

---

## 🗺️ 실행 순서 제안

1. **내가 바로 할 수 있는 P0/P1 코드·데이터 작업** (창업자 입력 불요):
   영양데이터 동기화(P0-1 수치부) → FAQ/파트너 DB 승격(P1-C1) → 카테고리 정합(P1-C3) →
   알림 fallback+문서정합(P1-O1/O2) → cron-health 탭(P1-O3) → AI 비용가드(P1-O4) →
   중첩 main(P1-A1) → 대비(P1-A2) → 타이포/radius 토큰(P1-D1/D2) → 검색 빈상태(P1-D3)
2. **창업자만 채울 수 있는 것** (병행):
   상품 사진(P0-2) · 제조사/원산지/유통기한 사업정보(P0-1 법정부) · SKU 정책 결정(P0-3) ·
   이벤트/컬렉션 이미지 · Vercel SENTRY_DSN + Sentry 콘솔 알림 채널(P1-O5)
3. **결제키 발급 후**: R101-I/H + 결제 1회 실테스트 (P2 실테스트군)

각 항목은 5~15분 phase로 쪼개 설명·검증·커밋하며 진행.
