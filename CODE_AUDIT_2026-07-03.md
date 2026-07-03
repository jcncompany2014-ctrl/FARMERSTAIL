# 전면 코드 감사 원장 — 2026-07-03

사장님 지시: "모든 부분 코드적으로 점검, 세세한 것까지 빠짐없이, 조금이라도 이상하면 전부 기록. 재량으로 고칠 건 고치고 버릴 건 버려라."

규칙: 발견 즉시 이 원장에 기록. 수정 시 배치별 `tsc/eslint/tests` 검증 후 커밋. 결제·인증·DB DDL은 신중(명백한 것만, 검증 필수).

표기: 🔴 실버그(수정) · 🟠 이상함(수정 or 결정필요) · 🟡 기록만(무해/사장님 결정) · 🟢 점검함(클린)

---

## 배치 1 — 최근 변경 자가 리뷰 + 정합성 크로스체크

- 🔴 **checkout/fail "결제 다시 시도하기" → /checkout 오링크 (수정)**: 어제 잔재 정리에서 내가 /cart→/checkout 으로 바꿨으나 /checkout 자체가 `redirect('/start')` 라 실패 사용자가 설문으로 떨어짐. 도달 경로 조사: /checkout/fail 은 checkout/success confirm 에러 redirect 전용(+휴면 인터랙티브 체크아웃), 카드등록 실패는 별도 /subscribe/billing-fail. → 주 CTA "주문 내역 확인하기"(/mypage/orders) 로 정정.
- 🟢 vercel.json 크론 등록 28 ↔ app/api/cron 라우트 28 — 양방향 일치 (cart-recovery·restock-alerts 제거 후 재검증).
- 🟢 **내부 링크 무결성 전수**: 라우트 150개 대비 정적 href 데드링크 **0** (일회용 스크립트 대조, 동적 세그먼트 매칭 포함).
- 🟢 **이미지 참조 ↔ public 실재**: 누락 1건 = Avatar docstring 예시(/dog.jpg, 비렌더) — 무해.
- 🟠 **SEO 구조화 데이터에 폐지 경로 (수정)**: ① 루트 layout 전 페이지에 나가던 WebSite JSON-LD 의 SearchAction 이 폐지된 `/products?q=` 를 target — 제거(구글도 2024-10 사이트링크 검색박스 종료). ② `buildProductJsonLd` 는 호출처 0 죽은 export + offer.url 이 `/products/[slug]` — 삭제(테스트 동반 정리). 구독 상품 LD 필요 시 /subscribe 기준 재설계.
- 🟢 휴리스틱: console.log **0** · TODO/FIXME/HACK **0** · @ts-ignore/expect-error **1**(테스트 의도) · `_dead_q4`/`_dead_referral` 소스 참조 **0**.
- 🟢 폐지 경로 라이브 링크: href 로 /products·/cart 등을 가리키는 실코드 0 (docstring 예시 2건뿐 — Button.tsx·Avatar.tsx, 비렌더 무해).

## 배치 2 — 인프라 · 프로덕션 레이어

- 🟢 **프로덕션 스팟 10라우트 전부 200** (/·/start·/why-app·/our-food·/plans·/faq·/login·/account·sitemap·robots).
- 🟢 **Vercel 런타임 에러 7일 = 기존 refresh_token 1그룹뿐, 마지막 발생 6/29 = getSafeUser 수정(7/1) 이전** → 수정 효과 실증, 신규 에러 0.
- 🟢 **DB 보안 어드바이저: ERROR 0.** WARN = security-definer 함수 익명/인증 실행권한 32(레퍼럴 DROP 으로 35→32 감소·기존 기록 항목, DDL 하드닝은 사장님 결정) + `auth_leaked_password_protection` 1(**Supabase 대시보드 토글로 켜기 권장** — 유출 비밀번호 차단, DDL 아님). INFO = RLS enabled·무정책 3(anthropic_usage·email_suppressions·rate_limit_counters — 전부 service-role 전용 내부 테이블, deny-all 이 의도된 안전 자세).
- 🟡 DB 성능 어드바이저: Supabase 린터 자체가 SQL 문법 에러로 응답 실패(서버측 버그, 우리 문제 아님). 7/1 기록(auth_rls_initplan 164 등) 유효.
- 🟡 npm audit 15 (critical 0 · high 2 = 전부 dev 전용 vite/ws · moderate 11) — 7/1 과 동일, 프로덕션 런타임 긴급 0. next 는 수정 포크라 무단 업데이트 금지.
- 🟡 **types.ts 드리프트**: DROP 된 coupons·referral 테이블/RPC 타입 잔존(참조 9곳, 전부 자동생성 파일 내부 — 라이브 코드 참조 **0**). 타입 재생성(generate_typescript_types)으로 정리 가능하나 대량 diff 라 별도 회차 권장.
- 🟢 고아 컴포넌트: components/cart·products 는 이미 A단계에서 삭제 완료(빈 디렉토리), variant 컴포넌트 참조 0 확인.
- 🟢 클린 빌드 동등성: 오늘 3회 push 의 pre-push build:ci(next build 전체 재현) 전부 통과.

## 배치 3 — 파일 전수 정독 (FILE_AUDIT_CHECKLIST.md 기준, 총 651파일)

### 사장님 질문 답변 — checkout 은 잔재인가?
**맞음 — 인터랙티브 체크아웃(성공/실패 페이지 + /api/payments/confirm)은 진입점 0 확정.** successUrl 을 /checkout/success 로 설정하는 코드 0, /checkout 링크 0(자체가 redirect('/start')). 유일한 도달 = confirm 에러 redirect(자기참조). **단 즉시 격리 보류 — 토스 PG 심사에 "일반 결제경로" 증빙이 필요할 수 있음.** 심사 방침(빌링만으로 가능한지) 확인 후 격리 결정. 코드 품질 자체는 모범(레이스 가드·자동환불 큐·위변조 alert 완비)이라 휴면 상태로 무해.

### 웨이브 1-2 정독 결과 (직접 16 + 에이전트 69 = 85파일)
- 🟢 **CORE-결제 5/5 직접 정독** (toss.ts·billing-error-classify·billing-issue·confirm·webhook): 실버그 0. 방어 설계 모범(Idempotency-Key·타임아웃·레이스 0-row 가드·webhook 재조회 검증·원자 dedup). 수정: stale docstring 2(부분취소 미지원 표기·존재않는 billing-confirm 라우트 언급).
- 🟡 결제 기록: ①`recoverOrderPointsAndCoupon` 함수명에 쿠폰 잔재(기능은 포인트 복구, 이름만 — 결제경로 광범위 rename 이라 보류) ②confirm:418 `payment_refund_queue as any` 캐스트 = types.ts 재생성 대기 항목과 동일 뿌리.
- 🟢 **components/v3 34/34** (에이전트): 실버그 0. 수정: Tabs.tsx stale docstring(CouponBrowser). 기록: StreakRewards bronze/silver 하드코딩 hex 2(티어 메탈색 — 토큰 없음, 시각변화 위험으로 보류). 오탐 기각: occurred_at 컬럼(실재 확인).
- 🟢 **lib/email 13 + lib/personalization 22** (에이전트): 실버그 0. 기록: firstBox·skuModel·v3/types stale docstring 소소 3(역사 기록 성격) · 기능성 소스(Layer B) 전부 coming_soon 인데 feedback 카피가 "대기열 등록" 약속(제품 로드맵 — 사장님 영역) · reliability 가중치 검증이 런타임 throw(빌드타임 이동 제안 — 잘 도는 코드라 보류). 오탐 기각: 첫주문 50% 자동할인 카피(실제 구현됨), 뉴스레터 인프라(현역).

### 웨이브 2 정독 결과 (에이전트 85파일: 인증코어+소형API 25 · 공용컴포넌트 60)
- 🟠 **API 상태코드 부적절 2 (수정)**: notifications/seen profile 업데이트 실패가 200 반환→**500**(진실원 실패 은폐) · invitations/accept GET 비로그인 200→**401**(콜러 0 폴백 확인 후).
- 🟠 **쿠폰 dead column 읽기 2 (수정)**: orders cancel·cancel-items 가 select 에 `coupon_code`(항상 null·미사용) 포함 → 제거 + cancel 라우트 stale docstring("Decrement coupons.used_count") 삭제.
- 🟠 **stale 카트 주석 일괄 정정 (수정)**: AppChrome:170("cart 와 동일 패턴") · WebChrome 헤더 다이어그램([카트]·👤🛒·"카트 아이콘 유지" 문구) — 전부 현행(무카트) 반영.
- 🟢 인증코어(auth callback·lib/auth·lib/supabase) 실버그 0, 인증우회/IDOR 0. 공용 컴포넌트 60 실버그 0·고아 0·a11y 갭 0.
- 🟡 기록: push/preferences 의 notify_restock/notify_cart 필드(DB 컬럼 보존 결정과 커플링 — API 관통 유지가 정합) · invitations/create "Phase 2 이메일 발송" docstring(URL 공유 모델로 변경됨) · applyAutosignupDraft typegen 미반영 컬럼 주석.
- 오탐 기각: push/unsubscribe 401 누락(실제로는 명시돼 있음) · progress-photos path traversal(startsWith 가드 + RLS 이중).

### 웨이브 3 정독 결과 (앱 dogs 화면 + 크론 28 + 소형 API 일부)
- 🔴 **KST off-by-one 실버그 2 (수정)**: ①SurveyClient nextReview — `analyses` 저장값이 UTC slice 라 KST 00~09시 제출 시 하루 이르게 기록 → `addDaysKst(todayKstIsoDate(), n)` 하우스 헬퍼로 교체 ②HealthLogClient todayIso — 브라우저 로컬 날짜라 해외 접속 시 KST 조회(QuickActionChips)와 불일치 → KST 고정 패턴 통일.
- 🟡 **subscription-charge 기록(결제 크론 — 사장님 동석 리뷰 대상)**: ①성공 후 orders/subscriptions 업데이트 실패 시 charge=pending·order=failed 로 남는 부분 정합 경로(payment_events 엔 paid 기록 — reconcile 크론이 잡는 설계인지 확인 필요) ②R85-B3 재확인 SELECT 가 메모리 스냅샷과 섞임(RETURNING 재조회가 더 안전) ③discount_reason cast = types 재생성 대기.
- 🟡 기록: tracking-poll 등 비결제 크론 fire-and-forget 푸시/메일(Vercel drain 의존 — subscription-charge 만 await 로 강화된 상태) · weight-reminder RPC 는 **프로덕션 미구현 확인(pg_proc 0)** → 폴백 인라인 N+1 이 본선(프리런칭 규모 무해 — RPC 생성 or 시도 제거는 선택) · OrderClient firstDeliveryAt 표시 추정치는 해외 브라우저에서 ±1일 표시 오차 가능(저장 안 함 — 무해).
- 오탐 기각 4: OrderClient "심각 버그"(표시 전용·비저장) · CurrentFormulaCard null 가드(실존) · payment-ledger-reconcile 주석(현행 정확) · shippingFee=0 명시(의도된 정책 표현).
- 🟢 크론 28: 인증가드 28/28 · trackCron 일관 · 실패 5xx 정상. 소형 API 6(health·chatbot·addresses·contact·newsletter·tracking) 클린.
- ✅ 커버리지 갭 해소: dogs **64/64** · 소형 API 21(에이전트)+4(직접 og·consent) 완주.

### 웨이브 3 갭 정독 추가 결과
- 🟠 **수정 3**: ①dogs/health 서버 30일 윈도우가 UTC now 기준 → KST 헬퍼(00~09시 하루 밀림 해소) ②FirstCheckin 멱등 감지가 에러 메시지 문자열 의존 → `code==='23505'` 우선 추가 ③account/delete 부분실패가 console.error 만 → Sentry 비즈니스 이벤트 승격(PIPA 파기 후속조치 가시화).
- 🟠 **죽은 라우트 격리 1**: /api/og/sku/[code] — 참조 0(낱개 SKU 공유카드 시대) + 팔레트도 옛 v4 웜브라운 그대로였음 → `_dead_q4/og-sku`.
- 🟡 기록: auth/welcome-email·consent/unsubscribe-ack 발송실패 200(ok:false) 패턴(베스트에포트 설계 명시됨 — 유지) · photo-upload 중복감지 정규식 의존 · weightFromRER 로컬 중복(analyses) · todayIso 중복 구현 해소됨(수정 ②에 포함) · VetReport 주석 표현 불일치.
- 오탐 기각 3: PhotosClient +9h(하우스 패턴 정합) · DiaryClient 미사용 import(146행 사용) · YearInReview raw ISO(가입 시각 기준이 정답) · Number()||폴백(의도된 graceful).

### 웨이브 5 정독 결과 (웹계정·결제화면·web/analysis 컴포넌트 47 + 웹마케팅 55/71)
- 🔴 **카드등록 재시도 막다른 길 (수정)**: billing-auth 가 failUrl 에 customerKey 를 안 실음 → billing-fail "다시 시도하기"가 subscriptionId 만 갖고 billing-auth 로 복귀 → `isInvalidEntry` 가드("잘못된 접근이에요")에 걸려 재시도 불가. 수정: failUrl 에 customerKey 동봉 + 실패 페이지는 둘 다 있을 때만 원클릭 재시도(없으면 구독 관리 경로 유도).
- 🟢 웹마케팅 71/81(페이지+클라이언트 컴포넌트, 잔여 10=loading 스켈레톤): 실버그 0 — redirect 셸·robots/sitemap 제외·정직 가드·JSON-LD·a11y 정합.
- 오탐 기각(2차 보고 중대 의심 2): ①auth/callback open redirect — `//`·`/\` 변형·/api 까지 이미 차단(모범 가드) ②bg-bg/text-text/rule 미정의 의심 — @theme 에 전부 정의 확인. 기록 🟡: humanizeSignupError 중복 구현(StartSurvey↔signup, 공용 util 후보) · offline 페이지 stale 주석 · age-gate 이중 액션 버튼 UX(검토 후보) · photo-upload/vet 토큰 페이지 a11y 세부 2.
- 🟢 웹계정(account 5)·checkout 6·mypage/orders 9·components/web 7·analysis 10: 실버그 0. 기록 🟡: PurchaseTracker "익명 결제" stale docstring · 주문상세 dt 폭 주석 불일치 · StickyCta 는 의도적 no-op(문서화됨). 기각: CancelOrderButton 카테고리 명명(주관).

### 웨이브 6 정독 결과 (lib 루트 60 + lib 하위 47 = 107파일, 최종 웨이브)
- 🟠 **죽은 커머스 export 2 제거**: `trackAddToCart`(analytics — 장바구니 폐지)·`formatCouponCode`(formatters — 쿠폰 폐지), 둘 다 참조 0 grep 확정, 테스트 동반 정리(1236→1233).
- 🟢 lib 전 계층 크리티컬 0: datetime-kst 월말 보정까지 정확 · discount/rate-limit/reconcile 가드 완비 · meta-learning 통계 인프라 견고 · rewards/points 의 referral enum 은 과거 원장 호환 명시(유지 정답).
- 🟡 기록: swr-lite/counterfactual/persona = invention-flags 킬스위치 뒤 의도 보류(PCT 출원 관련) · next-action 주석 번호 어긋남 · /cart 등 redirect 전용 라우트의 loading.tsx 잔존(무해 dead weight) · lib/cart 디렉토리는 실재하지 않음(빈 항목).
- 직접 검독: loading.tsx 13개 전수(잔재 참조 0, 스켈레톤 전부 클린).

## 추가 범위 A (소스 밖 전체) — SQL·CSS·scripts·테스트·루트 설정

- 🟢 **루트 설정 15개 직접 정독** (proxy.ts·next.config·instrumentation×2·sentry×2·capacitor·package.json·eslint/postcss/playwright/tsconfig 등): 보안헤더·CSP 로드맵·PII 스크러버·캐시 전략 모범. `npm test` glob(lib/**)은 테스트 85개 전부 lib 소속이라 완전 커버 확인.
- 🟠 **proxy.ts 수정 2**: ①admin 가드 getUser 무보호 → try/catch(stale refresh token 시 /admin 500 방지 — 7/1 수정과 동일 클래스) ②라우트 분류 주석의 폐지 경로(products/cart/signup/coupons/wishlist) 현행화. 기록 🟡: CSRF 목록의 `/api/subscriptions/`는 실재하지 않는 라우트(무해 dead 엔트리) · RULES 주석의 auth 튜닝 근거는 해당 룰 부재(supabase 클라 직접 인증이라 해당 없음 — 주석 성격).
- 🟠 **죽은 CSS 제거 1**: globals `.cart-cta-active`/`[data-cart-bottom-nav]` 스왑 규칙 — 토글러(CartStickyCTA·BottomNav) 삭제로 참조 0 (에이전트 "현역" 오판을 재검증으로 뒤집음).
- 🟢 CSS 10(전량)·scripts 6(전부 package.json 연결)·테스트 85+e2e: 잔재 셀렉터 0·skip 방치 0·폐지 라우트 방문 0·미정의 var() 0.
- 🟢 **SQL 마이그레이션 129/129**: 민감정보 0 · RLS 동반 생성 패턴 정합 · orders.user_id 인덱스 3종 완비(재검증). 기록 🟡(전부 적용된 히스토리 — 소급 수정 불가): 대형 마이그 6개 트랜잭션 미보호(당시 리스크·현재 영향 0) · **로컬↔원격 이력 정렬 필요**: 쿠폰 DROP(6/30)·레퍼럴 DROP(7/2)은 MCP 직접 적용이라 원격 이력에만 존재(레퍼럴은 로컬 파일도 있으나 이름 불일치). `supabase db push` 사용 시 혼동 소지 — 사장님 DB 정리 회차에서 정렬 권장(레퍼럴 파일은 전부 IF EXISTS 라 재적용도 무해).

## 디자인·UX 심층 검토 (사장님 지시 — 검토 + 재량 실행)

**실행 완료:**
- 🟠 **앱 검색 상품 섹션 제거**(#85ⓐ) — 결과 전부가 /start 로 바운스되는 죽은 링크였음. 강아지·다이어리 검색은 보존, 카피·aria 동반 정리.
- 🟠 **내 리뷰 죽은 제품 링크 제거**(#85ⓑ) — 카드 헤더 비내비게이션화(시각 동일).
- 🟠 **폐지 모델 카피 → 현행 사실 일괄**(#86ⓑ 확장, 사용자 노출 10곳): 프로모바·랜딩 메타/BENEFITS/CTA·about·our-food FAQ 2건(★"정기배송 안 해도 체험팩부터 가능" = 구독전용에서 허위 답변이었음)·why-fresh 2곳·루트 메타("화식, 간식, 체험팩"→"맞춤 화식 정기배송"). 통일 카피 = "첫 박스 50% 할인 · 약정 없음 · 언제든 해지"(전부 실재 사실).
- 🟢 **정량 스캔**(모바일 375px): /·/start 가로 오버플로우 0 · 랜딩/퍼널 구조 클린. 발견: 푸터 텍스트 링크 터치타깃 17~21px(WCAG 2.5.8 미달) → **FdFooter·SiteFooter 전 링크에 before 의사요소 히트존 확장**(시각 변화 0, 유효 ~41px, computed 검증). 오탐 기각: "웹/앱" 버튼 = DevContextToggle(프로덕션 미렌더).
- 🟠 **/start 스텝0 입력 4개 aria-label 연결**(이름·견종·나이·체중 — 시각 라벨만 있고 프로그래매틱 미연결이었음, 프리뷰 4/4 검증).
- 🎨 **/start 히어로 AI 비주얼 채움**(힉스필드 1장·2크레딧, 정면 푸들+실재료 신선식 그릇·크림톤 — public/start-hero.jpg 96KB) + **StartSurvey 결과 카드 상품사진 = 랜딩 실사진(meal-recipe.webp) 재사용**(무비용). 전환 퍼널의 placeholder 2곳 해소.

**사장님 결정 대기(디자인):** ①#73 PWA 설치 아이콘 = 드롭된 사각 모노그램 잔존(브러시 리브랜드 미반영 — 정사각 아이콘 시안 필요) ②B-2 완성기능 nav 노출(/family 베타·/dogs/compare — 1줄 활성화, 시각 결정) ③#84 앱 off-scale 타이포 4 ④#76 kcal/g 콤마 컨벤션 ⑤age-gate 이중 액션 버튼 ⑥#86ⓐ 구독 가입 첫 결제 배송비 임계 모델(결제 동석, #83 과 묶음).

## 🏁 전수 감사 최종 결산 (45/45 클러스터 · 651/651 파일, 2026-07-03)

**발견·수정 총계 (전 웨이브):**
- 🔴 실버그 수정 7: text-mute 미정의 클래스 45곳(뮤트색 미적용) · 카드등록 재시도 막다른 길(billing failUrl customerKey) · KST off-by-one 3(analyses 저장·건강로그·30일 윈도우) · checkout/fail 오링크 · API 상태코드 2(프로필 실패 은폐 500화·초대 GET 401)
- 🟠 정리 수정: SEO 폐지경로 2(SearchAction·Product LD) · 죽은 라우트/export 격리 3(og/sku·trackAddToCart·formatCouponCode) · 죽은 컬럼 select 2(coupon_code) · 멱등 감지 강화(23505) · PIPA 부분실패 Sentry 승격 · stale 주석 일괄(카트/쿠폰 시대 잔재 ~15곳)
- 🟡 사장님 결정 대기(원장 각 섹션 상세): ①인터랙티브 체크아웃 격리(PG 심사 방침 후) ②types.ts 재생성(cast 3곳 해소) ③subscription-charge 부분정합 경로 리뷰(동석) ④leaked password protection 토글 ⑤기능성 소스(Layer B) 로드맵 카피 ⑥notify_restock/cart DB 컬럼 정리 시점
- 오탐 기각 ~18건(전부 원장 기록) — 에이전트 보고는 전건 본선 검증 후 반영.
- 검증: 최종 eslint 0 · tsc 0 · 테스트 1233 GREEN · 매 웨이브 CI 빌드 통과 배포.
- 🔴 **`text-mute` 미정의 Tailwind 클래스 45곳 (수정)**: @theme 엔 `--color-muted` 만 존재 — `text-mute` 는 CSS 미생성으로 뮤트 색이 조용히 미적용(상속색 렌더). 에이전트는 1곳 오타로 봤으나 전수 grep 결과 8개 파일 45곳(수의사 리포트 13·admin insights/finance/nutrients/결제타임라인 27·InterventionWindowCard 3 등) → 전부 `text-muted` 로 일괄 수정. bg-/border- 계열은 0.
- 🟢 admin 77/77: 가드 이중화(레이아웃+페이지+API) 만점 · 쿠폰/커머스 잔재 0 · Phase B 개편 정합(웜톤 0). admin coupon-claim inert 셸도 미검출(이미 제거됨).
- 🟢 mypage 33 + 메인기타 20: 실버그 0. 기각: 쿠폰 refType 필터(과거 원장 row 표시용 방어 — 유지가 정답) · PreferencesPanel docstring(현행 정확). 기록 🟡: points/page 월 경계가 서버 로컬(UTC) 기준(통계 표시용 — KST 경계와 수 시간 오차, Intl Asia/Seoul 통일 후보) · dashboard 수동 +9h(하우스 패턴 — 헬퍼 통일은 선택).

- **실버그 1건 발견·수정**: checkout/fail 재시도 오링크(내 어제 수정분의 2차 오류 — /checkout 이 redirect 라우트임을 놓침).
- **SEO 폐지경로 2건 정리**: WebSite SearchAction 제거 + 죽은 buildProductJsonLd 삭제.
- 나머지 전 영역(링크·이미지·크론·휴리스틱·런타임·보안) **클린**. 코드베이스 상태 매우 견고.
- **사장님 결정 대기 항목**: ① Supabase 대시보드에서 leaked password protection 켜기(토글 1개, 권장) ② security-definer 32건 DDL 하드닝 ③ auth_rls_initplan 164건 성능 DDL ④ types.ts 재생성 ⑤ npm audit dev 의존성 정리.
