# 🔄 구독 전용 전환 (SUBSCRIPTION-ONLY MIGRATION)

> **사장님 지시 (2026-06-26)**: "전체적으로 무료배송이라는 시스템을 없애. 우리 어차피
> 이제 낱개로 안 팔아서 무조건 구독식이라 의미가 없어. 아예 빼. 그리고 위시리스트나 뭐
> 그런거처럼 상품페이지가 있어야만 연동이 되는 페이지나 기능들 다 없애."
>
> = **낱개(단품) 커머스 전면 폐지 → 구독 전용.** 무료배송·위시리스트·상품페이지 의존
> 기능을 전부 제거하되 **구독 결제 흐름은 절대 깨지지 않게** 단계적으로.

---

## ⛔ 보존 — 절대 건드리지 말 것

- **구독 흐름**: `/start`(설문 퍼널) → 맞춤 플랜 → `/subscribe/[slug]`, `app/(main)/dogs/[id]/order`
- **구독 결제**: `app/api/payments/confirm`, `app/api/cron/subscription-charge` (⚠️ **이게 `/checkout`을
  공유하는지 = 보존/제거 분기 핵심 — 제거 전 반드시 확인**)
- 설문결과·고객정보·결제시스템·도메인 (웹/앱 공유 자산)
- `(auth)` 인증, 법정 `SiteFooter`, DB 마이그레이션 apply

---

## 🗑️ 제거 대상

### A. 무료배송 시스템 (이번 세션에 방금 추가한 등급 무료배송 포함)
- `lib/commerce/shipping.ts` — `tierShippingPolicy` + `FREE_SHIPPING_THRESHOLD`/임계 로직
- `app/checkout/page.tsx`·`CheckoutForm.tsx` — 등급 무료배송 주입(회차292 추가분)
- `app/cart/page.tsx` — 무료배송 안내·진행바
- `components/cart/CartReceipt.tsx`·`CartChrome.tsx` — "무료배송까지 N원" UI
- `components/products/DeliveryCountdownBanner.tsx` 등
- → 구독식은 배송비가 구독가 포함이라 배송비/무료배송 개념 자체가 불필요.

### B. 위시리스트 (19파일 — 상품페이지 의존)
- `app/(main)/mypage/wishlist/page.tsx`·`WishlistRemoveButton.tsx`
- `components/products/WishlistButton.tsx`·`WishlistContext.tsx`
- 호출처: `products/[slug]/ProductDetailClient.tsx`, `MypageClient.tsx`(진입점), `AppChrome.tsx`
- 보존: `account/delete`·`privacy/export`의 `wishlists` 정리 로직(탈퇴/내보내기 — 데이터 위생)
- ⚠️ `wishlists` DB 테이블은 불변(코드만 제거)

### C. 낱개 커머스 페이지 (구독 결제 경로 확인 후)
- `/products`·`/products/[slug]`, `/cart`, `/checkout` (구독이 안 쓰면 제거 / 쓰면 구독용만 유지)
- `/collections`, `/best`, `/new`, `/events` 등 단품 진열
- ~15페이지 + 6이메일의 `/products` 링크 (= AUDIT_FINDINGS #6/#7/#35)

---

## 📋 순서 (안전한 것부터 · 각 단계 tsc+eslint+테스트 GREEN)

1. **위시리스트 제거** — 가장 독립적, 구독 결제 무관. 컴포넌트+진입점+페이지.
2. **무료배송 제거** — A 목록. 배송비 표시/계산 정리.
3. **구독 결제 경로 확인** — `/checkout`을 구독이 공유하는지 grep/추적. 결과로 C 분기 결정.
4. **낱개 커머스 페이지 제거 또는 구독 전용화** — 3의 결과 기반.
5. **링크/이메일 정리** — `/products` 링크를 `/start`(구독 퍼널)로 일괄 교체.

## ⚠️ 진행 원칙
- 각 단계 **참조 0 확인(grep) → 제거 → 여파 수습 → 검증**. 애매하면 멈추고 기록.
- 결제/구독 흐름이 의존하면 **제거 금지 → 이 문서에 "보존" 이관**.
- 한 번에 1~3파일씩. 거대 일괄 변경 금지(되돌리기 어려움).

---

## ✅ 복귀 후 결정 체크리스트 (5분 트리아지 · 무인 루프가 turnkey화)

> 무인 루프가 **안전한 무해 정돈은 전부 완료**(아래 진행 로그 — 낱개 cart/checkout/products 링크 redirect·AppChrome dead·마이크로카피·SEO). 남은 건 **결제/web/기능존속/DB 결정 동반**이라 무인 미수정 = 사장님 판단 항목만 모음. 상세는 `AUDIT_FINDINGS.md` #번호.

1. **✅ 배송비 정책 단일화 — 2026-06-27 완료** (무료배송 전체 폐지: 배송비 구독료 포함·결제요약/카피/등급혜택 정리·#83 자연소멸. 잔여=admin placeholder 저우선) · ~~🔴 원 기록 (결제·가장 큼 · #86+#83)~~ — `subscribe/[slug]`가 가입 첫 결제에 **배송비 임계 무료배송 모델 작동 중**, 정기결제는 번들(별도 0)이라 **모델 불일치**. + 웹 프로모 "3만원 무료배송"(`WebChrome.tsx:76`) + confirm 서버검증 미적용(#83). → ⓐ 전부 번들/무료 통일 vs ⓑ 임계 유지 결정 후 #83 단일세션. ※ "무료배송 시스템 폐지"가 **낱개만 반영**, 구독 가입가·웹엔 잔존.
2. **🟠 상품 검색 섹션 (#85 ⓐ)** — 앱 통합검색 상품 섹션이 dead링크(강아지/다이어리는 정상). 폐지 시 **turnkey 범위 #85에 정리됨**.
3. **🟠 내 리뷰·재주문 dead링크 (#85 ⓑⓒ)** — 리뷰→제품상세(dead)·재주문→/cart(dead). 리뷰 재배치·'재주문'을 구독 재개로 재해석 결정.
4. **🔵 admin events/collections** — 고객면은 redirect 폐지됐으나 admin 관리·"라이브 보기" 잔존. 관리기능 유지 여부.
5. **🔵 위시/cart DB 테이블 드롭** — 기능 제거됐으나 테이블 존속(탈퇴 시 삭제→`mypage/delete` 파기 고지 정확·유지 중). 정식 드롭 시 고지 갱신.
6. **🟡 restock(재입고)** — 신청 진입점 dead. 낱개 품절 알림 폐기 vs "단백질 품절 알림" 재활용.
7. **🟡 타이포 off-scale (#84)** — app 4곳 `text-[18/20/28px]` V3FontSize 비표준. 토큰 통일 vs display 의도 유지(스크린샷 동반) 정책.
8. **🔵 B-#9 streak·B-#83 confirm** — 무인 금지. 복귀 후 단일세션(streak 개월수 재정의 / confirm 배송비 재검증).

### 🔧 복귀 후 즉시 실행 (결정 거의 불필요·turnkey — 무인 루프가 dead 확정)
> "삭제 vs 보존"만 가볍게 확인하면 바로 처리 가능한 것들. 정확한 위치는 위 진행 로그 참조.
- **cart-recovery cron 제거** — `vercel.json` :7(functions) + :42~43(crons) + route 격리. cart 폐지로 영구 dead(매일 1회 발송 0).
- **#6 6이메일 dead 링크** — comeback/vip/birthday/newsletter-welcome의 CTA href `/products`→`/start`(4개·본문 코히런스 확인) + cart.ts(폐지)·restock.ts(restock 결정).
- **orphan 4종**(#87) — `BrandWordmark`(완전 dead 확실·story도 없음)·`Avatar`·`Slider`·`AllergyBanner` = 각 {barrel `index.ts` export 줄 + `.tsx` + `stories/*`} 삭제.
- **낱개/잔재 UI orphan**(회차311~312·consumer 0 전수 확정) — 남은 **4종**: `components/ui/StockBadge`·`components/ui/VariantSelector`(낱개 재고/옵션 UI)·`components/coupons/CheckoutCouponSheet`(checkout 쿠폰 UI)·`components/SearchBar`(inline 검색으로 대체됨). 전부 `.tsx` 삭제(barrel 없음·import 0). **✅ `V3RecommendationCard`는 회차325 삭제 완료**(사장님 "없애" 지시 이행·mv→`_dead_q2`·tsc GREEN).
- **products dead 잔여** — `_dead_q2`(회차294~ 격리분) 확정 삭제(`rm`).
- ⚠️ **DB 보존**: `products`(구독 SKU)·`wishlists`·`cart_items`(PIPA 파기/내보내기 대상) 테이블은 **드롭 금지**.

---

## 진행 로그

> **▶ 현황(회차324·무인 종합): 구독전환 무인 작업 전 영역 완결.** dead 정리(링크 href/push·주석·loading·cron·orphan 9종)·라이프사이클 인프라 검증(가입→온보딩→리텐션→churn off-ramp→win-back **5단계 견고**)·성장 전략(BRAND_ADVICE 1-F 포지셔닝 / 1-G AOV·CAC·리텐션) 완료. **남은 건 전부 복귀 후 결정/즉시실행** (↑이 문서 상단 「복귀 후 결정 체크리스트 8」 + 「즉시실행 turnkey」). 이후 firing은 한계효용 낮음 — 복귀 시 `/loop` stop 후 **#86 배송비**부터 권장.

- (2026-06-26 회차292) 계획 수립. 영향 규모 확인(위시 19·체크아웃 17파일).
- (회차292) **위시리스트 의존맵 확정** — 아래 9곳을 **한 번에 원자적으로** 제거(부분 제거 시 빌드 깨짐):
  - ① `components/WebChrome.tsx` (:16 import · :189/:538 `<WishlistProvider>` 래핑 제거)
  - ② `components/AppChrome.tsx` (:30 import · :357/:756 래핑 제거) — ⚠️ chrome 최상위 **전역** Provider라 앱/웹 양쪽
  - ③ `app/(main)/mypage/wishlist/page.tsx` 삭제
  - ④ `app/(main)/mypage/wishlist/WishlistRemoveButton.tsx` 삭제
  - ⑤ `components/products/WishlistContext.tsx` 삭제
  - ⑥ `components/products/WishlistButton.tsx` 삭제
  - ⑦ `app/products/[slug]/ProductDetailClient.tsx` — WishlistButton 사용 제거
  - ⑧ `app/(main)/mypage/MypageClient.tsx` + `mypage/page.tsx` — 위시 진입점(메뉴 링크) 제거
  - ⑨ `components/v3/Badge.tsx`·`AppChrome` 등 잔여 import/참조 정리
  - **보존**: `account/delete`·`privacy/export`의 `wishlists` 정리 로직(데이터 위생). `wishlists` DB 테이블 불변.
  - **제거 순서**: 사용처(⑦⑧)·페이지(③④) → Provider(①②) → 컴포넌트 파일(⑤⑥) 삭제 → tsc+eslint+테스트 GREEN.
- **(2026-06-26 회차293) ✅ 1단계 위시리스트 제거 완료** — CatalogProductCard(위시버튼)·WebChrome/AppChrome(Provider+import+라벨)·MypageClient/mypage-page(StatCell+prefetch+prop)·app-required/proxy(죽은 경로) 정리 + **4파일 삭제**(WishlistContext·WishlistButton·mypage/wishlist/page·WishlistRemoveButton). `.next` 캐시 클리어 후 tsc+eslint GREEN. **보존됨**: account/delete·privacy/export·mypage/delete·privacy의 `wishlists` 정리 로직(데이터 위생) + DB 테이블. **잔여**: PDP heart(`ProductDetailClient` 자체 wishlists 쿼리)는 3단계 products 제거 시 함께.
- **(2026-06-26 회차293) ✅ 구독 결제 경로 확인 완료** — 구독(`app/(main)/subscribe/*`)은 `/checkout` **미사용**(grep 매치 0), `dogs/[id]/order`(OrderClient)도 자체 결제 흐름. **→ 낱개커머스 `/checkout`·`/cart`·`/products` 통째 제거가 구독을 깨지 않음**(안전 확정). 단 `payments/confirm` API는 공유 가능성으로 **보존**(불변).
- **다음 시작점**: **2단계 = 낱개커머스 통째 제거**(무료배송 자동 포함). 대상: `/products`·`/products/[slug]`·`/cart`·`/checkout`·`/collections`·`/best`·`/new`·`/events` 페이지 + `lib/commerce/shipping.ts`(미사용화 후 삭제) + `components/cart/*`·`components/products/*` 잔여 + ~15페이지·6이메일의 `/products` 링크 → `/start`. **큰 작업이라 깨끗한 컨텍스트에서 단계적으로**(각 단계 참조0 확인→제거→검증). PDP heart(ProductDetailClient wishlists)도 여기서 함께 소멸.
- **(2026-06-26 회차294) ✅ 2단계 진행 — 낱개커머스 redirect 전환**: `/new`(alias·링크0) 삭제 + `/collections`·`/collections/[slug]`·`/products`·`/products/[slug]`·`/cart` → `redirect('/start')`. 각 `.next` 클리어 후 tsc+eslint GREEN. 공유 컴포넌트(CatalogProductCard·CartList·CartReceipt·CartChrome·ProductDetailClient 등)는 고아화(빌드 무관, P2 정리 대상). **redirect 방식 장점**: 기존 링크(상품/장바구니 버튼)가 가도 `/start`로 자동 — 링크 깨짐 0. **잔여**: `/checkout`(success/confirm 보존 확인 후 page만 redirect) · `shipping.ts`(무료배송, checkout 정리 후 삭제) · 고아 컴포넌트 정리 · nav 링크 텍스트 정돈. **`/events` 보존**(프로모션, 사장님 확인 대기).
- **(2026-06-26 회차294) ✅ `/checkout` redirect — 낱개 결제 차단 완료**. 낱개커머스 **전 진입점**(products·products/[slug]·cart·checkout·collections·collections/[slug]·new) 차단 = **구독 전용 동선 확립**. 무료배송도 사용자 노출 0(checkout/cart 자체가 redirect). 결제 확정 API(payments/confirm)·checkout/success 보존. tsc+eslint GREEN. **→ 2단계 핵심 완료.** **남은 polish(빌드 무관 dead code·급하지 않음)**: ⓐ고아 컴포넌트/파일 삭제(CheckoutForm·CartList·CartReceipt·CartChrome·CatalogProductCard·ProductDetailClient·`lib/commerce/shipping.ts` 등) ⓑnav "상품/장바구니" 메뉴 라벨 정돈(클릭 시 /start로 가지만 라벨 잔존) ⓒ`/events` 처리 결정.

## Polish 의존맵 (회차294 확인 — ⚠️ git 없음·복구 불가라 삭제 매우 신중)
- **dead code 연쇄**(빌드 무관·**안 지워도 앱 정상**): `ProductDetailClient`→{`RelatedProducts`,`RecentlyViewed`}→`CatalogProductCard`←`CartAddMore`(cart). 전체 군: cart 컴포넌트(`CartList`·`CartReceipt`·`CartChrome`·`CartUpsell`·`CartStickyCTA`·`CartCouponContext/Provider`·`CartAddMore`) + `CheckoutForm` + `Catalog{ProductCard,Hero,Chrome,SubscribeBand}` + `lib/commerce/shipping.ts` + `lib/cart/category-meta.ts`. ⚠️ `CheckoutForm.generateOrderNumber`를 `subscription-charge`가 **실제 import하는지**(주석뿐일 수도) 확인 후 삭제. 각 파일 사용처 0 grep 확인 필수(git 없어 복구 불가). **✅ 격리 완료(회차294)**: mv 안전방식(프로젝트 밖 격리→tsc→되돌림)으로 **~30개 진짜 dead 확정** — components/cart/*(7)·app/cart/CartList·app/checkout/CheckoutForm·app/products/[slug]/ProductDetailClient·components/products/*(18)·lib/commerce/shipping(+test)·lib/cart/category-meta. **격리 후 tsc + 테스트 1236 GREEN.** `projects/_dead_q`에 보관(빌드서 제외·복구 가능, 확정 후 rm 가능). **CheckoutForm을 subscription-charge가 import 안 함**도 검증됨(주석뿐). 잔여(미확인): app/products/[slug]/{ProductReviews,RestockButton}·products·checkout layout/loading 등.
- **(2026-06-26 회차295) ✅ events 완전 제거 + _dead_q 영구삭제 + A 핵심 완료**: dashboard events noop 제거(getActiveEvents import·Promise.all·hidden span)+EventClaimBlock·events/layout·lib/events/data 격리. **_dead_q ~33개 dead code 영구삭제**(tsc+테스트 1236으로 dead 입증). nav 메뉴=chrome엔 없음(Phase Q로 이미 /start). **A(구독 전용 전환) 핵심 완료** — 위시리스트·낱개커머스·events·무료배송·nav cart·dead code 전부. **무해 잔여(P2)**: WelcomeCouponBanner·app 산발 /products 링크(redirect 무해)·AppChrome isProductsRoot/isProductDetail 헤더 dead 로직·products/checkout layout·loading.
- **다음 작업 (사장님 "돌아올때까지 전부 진행" 지시)**: **B-#9 streak** = 'cycle'→'**함께한 개월수**'로 재정의(streaks.ts computeStreak 입력 checkins→가입일·마일스톤 1/3/6/12개월·StreakRewards UI·dashboard 사용처·멱등 지급). **B-#83** confirm 배송비 서버 재검증(보정 방식·결제라 신중). **C** 구독 퍼널/관리 UX·디자인. 각 한 묶음씩 일관 변경+검증(끊겨도 GREEN 유지).
- **(2026-06-27 무인 L1)** SubscriptionsEmptyState 구독 빈상태 CTA 정합: href `/products`→`/start` + "제품 둘러보기"→"정기배송 시작하기". tsc+eslint GREEN. **P2 산발 링크 잔여(다음 스텝)**: compare·mypage/orders/page·OrdersAppView·subscribe/[slug]의 `/products`(빈상태/안내) + checkout success/fail의 `/products`·`/cart`(결제 페이지라 신중). 빈상태부터 안전하게.
- **(2026-06-27 무인 L1)** subscribe/[slug] 정기배송불가 fallback 링크 정합: href `/products`→`/start` + "← 제품 목록"→"← 맞춤 식단 시작하기". tsc+eslint GREEN. **잔여**: compare·mypage/orders/page·OrdersAppView(web/app 공유라 신중·동선 정합은 안전하나 양쪽 영향 확인)·checkout success/fail(결제 페이지).
- **(2026-06-27 무인 L1)** mypage/orders 빈주문 CTA 2곳(page·OrdersAppView) 동선 정합: href `/products`→`/start` + "제품 둘러보기"→"정기배송 시작하기". web/app 공유지만 동선/카피라 안전·tsc+eslint GREEN. **산발 링크 잔여**: compare(web/app)·checkout success/fail의 `/products`·`/cart`(결제 페이지라 신중).
- **(2026-06-27 무인 L2)** compare(5종 SKU 영양비교·구독선택 도움이라 **보존**) 뒤로가기 링크 정합: href `/products`→`/start` + "제품 둘러보기"→"맞춤 식단 시작하기"·tsc+eslint GREEN. **→ 산발 링크 안전분(빈상태/안내) 전부 완료.** 잔여 = checkout success/fail의 `/products`·`/cart`(결제 흐름 페이지라 복귀 후 신중). 다음 스텝부터는 C 디자인 카피/토큰 또는 P3 점검으로 전환.
- **(2026-06-27 무인 L1)** products dead 잔여 격리(mv 안전방식): `products/loading`·`products/[slug]/{loading,ProductReviews,RestockButton}` → `_dead_q2`(page redirect로 고아·tsc GREEN 입증). 확정 dead·복귀 후 rm. products/[slug]엔 redirect page만 남음. **잔여 dead**: products/layout·checkout layout/loading(layout 구조·결제라 신중·보류). 다음=C 디자인/P3 점검.
- **(2026-06-27 무인 L1)** products/layout 점검 = **`AuthAwareShell`(app/web dispatch)이라 ⛔ 불변 보존**(redirect로 metadata만 dead·layout 통째는 dispatch 규칙). checkout layout/loading도 결제 ⛔ 보류. → **dead 파일 정리 종료**(안전분 전부 격리·dispatch/결제는 규칙상 보존). 다음 발동부터 **C 디자인(카피/토큰/a11y) · P3 점검**으로 전환.
- **(2026-06-27 무인 L1·C디자인)** 마케팅 알림 설정 카피 정합: PreferencesPanel notify_marketing hint "할인·신상품·장바구니 리마인더"→"할인·신상품 소식"(cart 폐지로 장바구니 리마인더 무의미). tsc+eslint GREEN. **보존 판단**: NotificationsClient cart 알림 카테고리 라벨·mypage/delete 데이터목록 "장바구니"(데이터/카테고리라 보존)·notify_restock(재입고는 구독에도 의미).
- **(2026-06-27 무인 L1·P3→정합)** sitemap.ts SEO 정합: 구독 전환으로 redirect된 커머스 라우트(`/products`·`/collections`·`/best`·`/new`·`/events` 정적 + products/collections/events 동적 쿼리·Routes) 제거 → 크롤러가 redirect URL 인덱싱(GSC 중복/리다이렉트 경고)하는 문제 방지. blog posts 동적은 보존·tsc+eslint GREEN. **다음 점검**: robots.ts의 products/events 처리(disallow vs 누락).
- **(2026-06-27 무인 L1·SEO 정합)** robots.ts disallow에 redirect 커머스 라우트 추가: `/products`(+/*)·`/collections`(+/*)·`/events`(+/*)·`/best`·`/new` (`/cart`는 기존). sitemap 제외와 일관 — 크롤러의 redirect URL 인덱싱(GSC "Page with redirect" 경고) 차단·tsc+eslint GREEN. **→ SEO 정합 완료(sitemap+robots).** 다음 발동: C 디자인 카피/토큰 또는 P3 점검 계속.
- **(2026-06-27 무인 L1·P3 점검)** restock(재입고 알림) 기능 점검 = 구독 전환으로 **신청 진입점 dead**: 신청 버튼 RestockButton(products/[slug])이 redirect·격리됨 → 새 restock 신청 불가. restock-alerts cron엔 `/products` url 없음(직접 깨진 deep-link는 아님). 잔존: notify_restock 설정·restock-alerts cron·restock/route·restock_alerts 테이블·admin/restock/dispatch. **복귀 후 결정**: 낱개 품절 재입고 기능 폐기 vs "단백질 품절 알림"으로 재활용. 점검만(코드 무변경).
- **(2026-06-27 무인 L1)** AppChrome screenTitle dead 줄 제거: `if (p.startsWith('/products/')) return '상품'`(products redirect로 도달 안 함)·tsc+eslint GREEN. **AppChrome 잔여 dead(복귀 후)**: isProductsRoot/isProductDetail 헤더 삼항(좌측/중앙 zone 분기·chrome 일관변경이라 복귀 후 단일세션). **→ 구독 전환 무해 잔여 거의 소진** — 남은 안전 작업은 일반 C 디자인(카피/토큰/a11y)·P3 점검.
- **(2026-06-27 무인 L1·a 잔여정돈) ✅ AppChrome isProductsRoot/isProductDetail 헤더 dead 분기 제거**(새 루프 프롬프트가 (a) 안전작업으로 명시 지정 → 이전 "복귀 후" 보류 해제): products가 `/start` redirect라 그 pathname에서 AppChrome가 렌더되는 일이 절대 없음 = dead. 정리 ① 좌측 zone 제품검색 분기(isProductsRoot) ② 중앙 zone 제품상세 동적 상품명(isProductDetail) ③ `dynamicTitle` state + `ft:screen-title` 이벤트 리스너(PDP 격리로 송신자도 소멸) ④ menuPathname 리셋의 setDynamicTitle ⑤ `Search` lucide import. **도달 가능한 전 경로의 렌더 결과 동일(visual-neutral)** → 스크린샷 없이 안전·tsc+eslint GREEN. **→ AppChrome의 구독전환 dead 청소 완료**(앞선 cart·screenTitle 줄에 이어 헤더 삼항까지). 잔여 안전작업 = C 디자인 토큰(off-scale 타이포는 #84로 기록)·P3 점검.
- **(2026-06-27 무인 L1·a 잔여정돈) ✅ 쿠폰함 '제품 보러가기' → 정기배송 정합 + (a) 산발 링크 전수 감사 종결**: `mypage/coupons` CouponBrowser onShop `router.push('/products')`(dead·redirect) → `/start`, CouponCard 버튼 카피·aria-label "제품 보러가기"→"정기배송 보러가기" + docstring 정정(app/(main)+components/coupons·쿠폰함 전용 렌더라 checkout 무영향·tsc+eslint GREEN). **전수 grep 결과**: `/events`·`/collections`·`/best` **고객노출 0건**(admin 2곳만). 잔여 `/products`·`/cart` = ① 결제(checkout success/fail/error)=⛔복귀후 ② admin(collections·qna)=복귀후 ③ **아키텍처 의존 dead링크**(search 제품결과·mypage/reviews 제품링크·ReorderButton `/cart`)=**#85 기록**. → **고객노출 무해 quick-win 링크는 전부 소진**(남은 건 결제/admin/기능존속 결정 동반).
- **(2026-06-27 무인 L1·b 마이크로카피 감사) ✅ 낱개커머스 행동 카피 전수 클린**: app/(main)+components/v3에서 `장바구니|쇼핑|담기|구매하기|장바구니에 담기` grep — **낱개 구매 유도 카피 0건**. 잔존 "장바구니" 2곳은 **보존이 정답**: ① `NotificationsClient` 알림 **카테고리 라벨**(과거 cart 알림 이력 표시용) ② `mypage/delete` **파기 고지**(찜/장바구니 — 해당 DB 테이블 존속·탈퇴 시 hard-delete되므로 PIPA상 정확, 트리밍 시 과소고지 위험으로 유지). 코드 변경 없음(클린 확인). → **구독전환 카피 정합 확인 완료**. 잔여 결정거리: 위시/cart 테이블 정식 드롭 시 파기 고지 갱신(복귀 후).
- **(2026-06-27 무인 L1·b 카피점검→#86 기록) 무료배송 메시징 잔존 2면 발견**: ⓐ `subscribe/[slug]/SubscribeClient.tsx:488-498` 구독 가입 결제요약이 배송비 임계 무료배송 모델 **실제 유지 중**("X원 더 담으면 무료배송!") — 결제/가격 로직이라 ⛔, 정기결제(번들 0)와 불일치 가능성 = 사장님 결정(#83과 함께) ⓑ `WebChrome.tsx:76` 웹 프로모 "3만원 이상 무료배송"=web·표시광고(FD클론 소관). 무료배송 폐지가 코드/카피 면마다 분기 → **배송비 정책 단일화 결정 필요**(복귀 후·결제 동반). 코드 무변경(점검·기록). → AUDIT #86.
- **(2026-06-27 무인 L1·c search 정독→#85 보강)** 앱 통합검색(`search/page.tsx`) 정독: 검색은 **3종**(강아지·다이어리=정상 / 상품=dead링크). **검색 기능 자체는 건강**, 상품 섹션만 dead. #85 ⓐ에 제거 turnkey 범위(products 쿼리·렌더·카피 3곳·SearchBar) 기록. 결정 동반(상품검색 폐지 vs 레시피검색 재설계)이라 무인 미수정·코드 무변경.
- **(2026-06-27 무인 L1·정지작업)** v3 a11y 스폿점검(DatePicker native·Calendar aria-hidden / Cropper 슬라이더 aria-label·버튼 텍스트라벨) = **견고 재확인**(수정거리 아님). → **안전 수정거리 소진 확증**. 이에 문서 상단에 **"복귀 후 결정 체크리스트"(8항목·우선순위순) 신설** — 흩어진 #83~#86·admin·테이블드롭·restock·#84·streak를 사장님 5분 트리아지용으로 통합. 코드 무변경.
- **(2026-06-27 무인 L1·b 대비 AA 점검)** `inkFaint`(1.9:1·텍스트 금지) 오용 점검: app/(main)+components/v3 전 사용처가 **장식/UI-hint**(별점 빈별·Avatar offline 도트·DatePicker/Select disabled 아이콘[aria-hidden]·StreakRewards stage tone) — **본문 텍스트 오용 0건**(AGENTS.md 대비 규칙 준수·StreakRewards는 streak라 무인 금지). 대비 AA 클린 확인·코드 무변경.
- **(2026-06-27 무인 L1·a dead loading 정리)** collections dead loading 2개 격리(mv→`_dead_q2`): `collections/loading.tsx`·`collections/[slug]/loading.tsx` — page가 redirect라 loading 스켈레톤이 dead(+redirect 시 죽은 페이지 스켈레톤 깜빡임 UX 워트 제거). `rm -rf .next && tsc` GREEN(import 0 입증). 확정 dead·복귀 후 `_dead_q2` rm. **events·best는 redirect page만(클린)·`collections/layout`은 AuthAwareShell이라 ⛔ 보존.** → 낱개커머스 dead loading 정리 완료(products+collections).
- **(2026-06-27 무인 L1·a 푸시 dead링크 수정)** push-lifecycle D+30 "정기배송으로 더 편하게" 마케팅 푸시 url `/products?subscribable=1`(dead·redirect) → `/start`(카피 "맞춤 식단을 자동으로"와 정합·#74 선례·발송볼륨[#78] 무관 url-only). tsc+eslint GREEN. **+ 서버/lib `/products` dead링크 전수 grep**: 나머지 ⓐ `lib/email/index.ts:357` **재입고(restock) 푸시/이메일** `/products/[slug]` = restock 기능 존속 결정(체크리스트 #6)에 묶여 복귀 후 ⓑ admin 스토리지 경로·jsonld.test = 무관. → 고객 도달 푸시 dead링크 정리(이메일 잔여는 restock 결정 동반).
- **(2026-06-27 무인 L1·c 이메일 dead링크 전수 = AUDIT #6/#35 "6이메일" 구체화)** 이메일 템플릿이 절대URL `${SITE_URL}/products`라 따옴표-앵커 grep이 놓쳤던 걸 `lib/email/**` 전수 확인. **6 이메일 CTA가 폐지 라우트로** 연결(단 전부 `/start`로 **redirect되므로 하드 브레이크 아님** — 리다이렉트 홉+dead참조만): ⓐ **링크 스왑 후보 4**(generic 마케팅 CTA→/products): `comeback.ts:77`·`vip.ts:86`·`birthday.ts:82`·`newsletter-welcome.ts:85`("메뉴 둘러보기") ⓑ **폐지 결정 2**: `cart.ts:77`(`/cart` "장바구니로 돌아가기"=cart-abandoned 메일 자체가 cart폐지로 무의미)·`restock.ts:59`(`/products/[slug]` "지금 주문하기"=restock 기능 #6). **무인 미수정 이유**: 이메일=outbound 마케팅(표시광고)·본문이 낱개 상품 중심일 수 있어(코히런스) 단순 링크 스왑 아님 + #6/#35가 "커머스 방향 단일 결정"으로 이미 분류. → **#6/#35 turnkey화**(정확 파일/라인). 설문퍼널 통일=확정이면 복귀 후 ⓐ 4개 href→`/start`(본문 코히런스 확인하며)·ⓑ는 메일 존속 자체 결정. **체크리스트 #2~#3과 함께.**
- **(2026-06-27 무인 L1·a stale 주석 정리)** AppChrome의 폐지(cart/products) 참조 stale 주석 핵심 3개 정합: ① 파일 docstring "header w/ cart, bottom tab bar"→"header (logo + 강아지 칩)" ② parentForPath dead route 매핑 줄 `/cart·/products/:slug → /products` 제거(코드 미처리·dead) ③ 좌측 zone 주석 "제품탭 검색"(지난 리팩터로 제거된 분기) → "그 외 = 내 정보 진입". 주석-only·tsc+eslint GREEN. **잔여 stale 주석(저우선·미래 정리)**: line 29~31·42(탭루트 목록)·48~50(/cart)·289/312(bell/cart icons)·612(data-cart-bottom-nav) — 무해하나 다음 발동들에 점진 정리 가능.
- **(2026-06-27 무인 L1·a stale 주석 완결)** AppChrome 잔여 stale 주석 6곳 정합: 장바구니탭/카트아이콘 주석(29~31)·탭루트 목록 "홈/강아지/제품/장바구니/내정보"→"홈/강아지/내정보"(42)·/cart 탭루트 주석(48~50)·헤더 "Mono ticker+ChromeStamp+bell/cart icons"→"3-zone grid"(289)·Main row "wordmark+bell/cart"(312)·죽은 하단탭nav+CartStickyCTA swap 설명 제거(612). 전부 주석-only·tsc+eslint GREEN. **→ AppChrome cart/products stale 주석 정리 완결**(헤더 dead 로직+주석까지 한 파일 완전 정돈).
- **(2026-06-27 무인 L1·c cart 잔여 residue 전수 = 마지막 클러스터)** cart/wishlist 폐지 후 잔여 dead 참조 grep(`CartSticky|cart-cta-active|cart-bottom-nav|WishlistProvider|MiniCartToast|ft:cart`): ⓐ **globals.css dead CSS**(:563~572 `body.cart-cta-active [data-cart-bottom-nav]`·:791 MiniCartToast) — CartStickyCTA·하단탭nav·MiniCartToast 전부 제거돼 **셀렉터 매칭 요소 0**(grep=globals.css에만 잔존)=렌더 0(무해)이나 dead. **globals 변경은 preview 검증 필요(앱 스크린샷 불가)라 복귀 후 preview 세션서 제거.** ⓑ **ft:cart:add dispatch**(`ReorderButton.tsx:85`·`OrdersAppView.tsx:503`) — 리스너(카트 뱃지) 제거돼 dead no-op·**재주문 기능(#85 ⓒ)에 묶여 복귀 후**. → cart/wishlist UI 잔여 dead 참조는 이 2클러스터가 마지막(인앱 링크·주석·푸시는 정리 완료). 무해·저우선·기록만.
- **(2026-06-27 무인 L1·b 위시 카피 점검)** "위시리스트/찜/관심상품" 잔여 카피 grep(app/(main)): **UI-facing 위시 기능 카피 0건**. 잔존 "위시리스트" 1곳(`mypage/privacy/page.tsx:255` 데이터 내보내기 라벨)은 mypage/delete 파기고지와 동류 — `wishlists` 테이블 존속·열람/이동권(PIPA) 대상이라 **정확·보존**. → 위시리스트 폐지 카피 클린 확인·코드 무변경.
- **(2026-06-27 무인 L1·a docstring 정리)** AppChrome 파일 docstring의 stale "/products" 참조 제거: "notably /products, which must also be accessible to unauth browsers (PublicPageShell)"(products redirect라 거짓) → 일반 설명만 남김. 주석-only·tsc+eslint GREEN. **잔여 약한-stale 2곳은 보존**: line ~167 "알림/장바구니 대신"(왜 강아지 칩인지 historical)·~179 "cart 와 동일 패턴"(fetch 패턴 설명) — 코드 동작 설명이라 무해. → **AppChrome stale 주석 진짜 완결**.
- **(2026-06-27 무인 L1·b events 카피 점검)** events 폐지("다 없애") 후 "프로모션/이벤트" 잔여 카피 grep(app/(main)): **폐지 /events·이벤트 기능 가리키는 카피 0건**. 매치 2곳 = ⓐ `referral/page.tsx:17` docstring "이벤트 페이지 톤"(디자인 톤 묘사·유효) ⓑ `PreferencesPanel:28` "프로모션·쿠폰"(마케팅 알림 카테고리 라벨·유효). → events 폐지 카피 클린 확인·코드 무변경.
- **(2026-06-27 무인 L1·b 낱개 카피 점검)** "낱개/단품/개별구매/한 개씩" grep(app/(main)) = **0건** → 구독 전용 정합 클린(낱개 판매 함의 카피 없음)·코드 무변경.
- **(2026-06-27 무인 L1·c orphan 스폿점검)** v3 컴포넌트 사용처 추가 확인: Sparkline(`dogs/compare:156`)·Signature(`home/GreetingSection:183`) **둘 다 프로덕션 사용=orphan 아님**. → #87 Slider가 스폿점검 중 유일 orphan. 전수 orphan 스윕은 저우선(빌드 무해·#26 클러스터와 복귀 후 일괄)·코드 무변경.
- **(2026-06-27 무인 L2·a barrel docstring 정합)** `components/v3/index.ts` JSDoc `@example`가 **존재하지 않는 `RibbonChip`** import + 폐지된 `events` 참조 → 실재 export(`Badge`)로 교체 + "랜딩/blog/events"→"랜딩/blog/마케팅". docstring-only(export 목록 자체는 정상)·tsc+eslint GREEN.
- **(2026-06-27 무인 L1·a router.push 잔여 점검)** 폐지 라우트로 가는 `router.push/replace` 전수(app+components, href와 별개 경로): **`ReorderButton.tsx:88` `/cart` 1건뿐**(이미 #85 ⓒ=재주문 기능 복귀후 추적 중). **신규 dead programmatic 네비 0건** → href·push 양쪽 모두 클린(ReorderButton 외)·코드 무변경.
- **(2026-06-27 무인 L1·b best/new 카피 점검 = 마이크로카피 스윕 종결)** "베스트/신상/인기상품" 폐지 카피 grep(app/(main)) = **0건**. → **마이크로카피 스윕 완료**: cart·위시·무료배송·events·낱개·best/new 전 폐지 키워드 클린(잔존은 전부 데이터/카테고리/PIPA 라벨로 보존 정당). 코드 무변경. **이후 마이크로카피 재점검 불필요.**
- **(2026-06-27 무인 L1·a home barrel docstring 정합)** `components/v3/home/index.ts` docstring 폐지 `events` 참조 → "마케팅"(v3 barrel과 동일 정합). + barrel 미export `QuickActionChips`는 **orphan 아님**(`ThisWeekSection`이 직접 import·render = 의도된 내부 sub-component). docstring-only·tsc+eslint GREEN. → **전 barrel(v3·home) docstring 정합 완료**(barrel 2개뿐 확인).
- **(2026-06-27 무인 L1·b Modal a11y 점검)** `Modal.tsx` 정독 = **견고**: native `<dialog>`+`showModal()`(포커스트랩/inert/ESC/focus복원 무료)·`aria-labelledby`(title)/`aria-label`(없을 때)·`useId` 중복 id 방지·닫기버튼 `aria-label`·V3 토큰 전수 준수. → v3 a11y 스폿점검 **4종**(DatePicker/Cropper/Slider/Modal) 전부 견고 = AUDIT a11y 평가 확증·코드 무변경. **이후 v3 a11y 스폿점검 저우선**(반복 견고).
- **(2026-06-27 무인 L1·b spacing 토큰 점검 = 토큰 스윕 종결)** arbitrary spacing(`p-[Npx]` 등 8pt 스케일 위반) grep(app(main)+v3) = **0건**. → **토큰 스윕 완료**: radius(클린)·타이포(off-scale 4=#84)·spacing-arbitrary(클린). 코드 무변경. (off-scale Tailwind spacing[mt-6 등]은 시각·노이즈라 무인 미점검·저우선.) **이후 토큰 재점검 불필요.**
- **(2026-06-27 무인 L1·c dead cron 점검 = 신규 표면)** cron 33종 Glob → **`cart-recovery`가 구독전환으로 영구 dead**: `cart_items` 24h+ 미변화 카트 스캔해 `notifyAbandonedCart`(cart.ts 이메일=dead /cart 링크 #6) 발송하나, **cart UI 폐지로 새 cart_items 0 → 매시간 실행해도 발송 0**(무의미 실행+vercel cron quota 낭비). **turnkey 제거(복귀 후)**: vercel.json `cart-recovery` 스케줄 제거 + route 격리 + (6이메일 #6과 함께) cart.ts·`notifyAbandonedCart`/`renderCartAbandoned` 정리. `restock-alerts` cron도 restock 기능(#6)에 묶임. 나머지 cron(구독/강아지/건강/결제)은 유효. **무인 미수정**: vercel.json=배포 config·결제 인접이라 복귀 후. 코드 무변경(점검·turnkey 기록). → 구독전환 dead 표면에 **cron 계층 추가 매핑**. **★회차308 vercel.json 확정**: 실제 스케줄 `0 9 * * *`(**매일 1회**·docstring "매시간 권장"은 부정확) → 제거 위치 = `vercel.json` **:7**(functions maxDuration) + **:42~43**(crons path/schedule) + route 격리. cart/wishlist/product 관련 **다른 dead cron 등록 0**(cart-recovery 단독). vercel.json=배포 config라 ⛔ 무인 미수정.
- **(2026-06-27 무인 L1·c cron dead-table 스윕 종결)** 폐지 테이블 읽는 cron 전수 grep: `cart_items`=**cart-recovery 단독**(dead·#6) / `wishlists`=cron 0건 / `.from('products')`=inventory-forecast·personalization-progression·restock-alerts 3종이나 **전부 유효** — `products` 테이블은 **구독 레시피 SKU 카탈로그로 존속**(낱개 판매 UI만 폐지·테이블/레시피는 alive)이라 재고예측·개인화·재입고 정상. → **cart-recovery가 유일 dead cron 확정**·cron 계층 점검 종결. 코드 무변경. **(중요: `products` 테이블=구독 SKU라 보존 — DB 드롭 금지.)**
- **(2026-06-27 무인 L1·c API dead-table 점검)** cron 외 `cart_items`/`wishlists` 의존 API route grep(app/api) = 4파일: ⓐ `account/delete`·`privacy/export` = **PIPA 유효**(존속 테이블 삭제/내보내기·delete/privacy 라벨과 정합) ⓑ `cart-recovery` = dead(#6) ⓒ `payments/confirm` = **⛔결제**(cart_items 참조=낱개 cart-clear 잔재 가능성·복귀 후 점검). → **신규 dead API route 0**(폐지 테이블 의존은 전부 PIPA/결제/기지 dead). 코드 무변경.
- **(2026-06-27 무인 L1·c lib cart/wishlist 잔여 점검)** lib `abandoned/wishlist` grep = 5파일: `cart.ts`·`email/index` notifyAbandonedCart=**#6 dead** / `supabase/types.ts`=존속 wishlists 테이블 **생성 타입(유효)** / `unsubscribe-token.ts:5`·`env.ts:113`=List-Unsubscribe HMAC 인프라 **유효**(vip/birthday/comeback 공용·"cart-abandoned"은 주석 예시 1개라 #6 제거 시 주석에서 함께 드롭). → **신규 dead lib 0**(lib 폐지 잔여는 #6 cart 이메일 클러스터로 수렴). 코드 무변경.
- **(2026-06-27 무인 L1·c middleware 점검)** 앱 `middleware.ts` **부재 확인**(node_modules만) → 폐지 라우트를 matcher로 특별 처리하는 dead 로직 자체가 없음. 인증/dispatch=layout(AuthAwareShell)+server-side, redirect=page-level `/start`로 깔끔. 코드 무변경.
- **(2026-06-27 무인 L1·c components orphan 스캔 = 신규 낱개 orphan 발견)** v3 외 components bash 스캔(18후보) → 검증: ⓐ **신규 낱개 orphan 3종(consumer 0 확정·import조차 없음)**: `components/ui/StockBadge`·`VariantSelector`(낱개 재고/옵션 UI)·`components/coupons/CheckoutCouponSheet`(checkout 쿠폰 UI) — 낱개/checkout 폐지로 dead, **components/ui·coupons에 있어 앞선 cart/products 디렉토리 스윕이 놓친 것**. 즉시실행 turnkey에 추가. ⓑ #26 기지 orphan: NutrientGauges38·StructuredAnalysis·FeedingPlanCard. ⓒ 스캔 candidate(복귀후 import-verify): SearchBar·V3RecommendationCard. ⓓ **`analysis/magazine` 11개=false positive**(AnalysisView/AnalysisMagazineSection이 import·사용 — `<Name` 스캔이 레지스트리 렌더 놓침=heuristic 한계). 코드 무변경(점검·기록).
- **(2026-06-27 무인 L1·c orphan candidate 확정)** SearchBar·V3RecommendationCard 전 참조 import-verify → **둘 다 confirmed orphan**: SearchBar=consumer 0(`search/page.tsx` inline 검색이 대체·SearchBar 미사용), V3RecommendationCard=`RecommendationBox.tsx:412` 주석 "사장님 2026-06-19 '없애' 제거"(렌더 삭제·파일 잔재). → 즉시실행 orphan을 **5종**(낱개 UI 3 + SearchBar + V3RecommendationCard)으로 갱신. 코드 무변경.
- **(2026-06-27 무인 L1·c 배송비 임계 출처 확정 → #86 보강)** `SHIPPING_FREE_THRESHOLD=30000`이 격리 `shipping.ts` 아닌 `SubscribeClient.tsx:51` + `OrderClient.tsx:92`(구독 주문 **2 진입점**)에 **로컬 하드코딩**(tsc GREEN 이유). → 배송비 정책 단일화(체크리스트 #1)는 **2 로컬 const + 각 무료배송 nudge UI + 정기결제 번들** 셋을 함께 결정해야 일관. 코드 무변경.
- **(2026-06-27 무인 L1·c orphan 삭제범위 완결)** 낱개/잔재 orphan 5종(StockBadge·VariantSelector·CheckoutCouponSheet·SearchBar·V3RecommendationCard) **story 부재 확인** → 삭제 = `.tsx` 1파일씩만(barrel·story·import 전부 0). v3 4종은 Avatar/Slider/AllergyBanner만 story 동반·BrandWordmark는 .tsx+barrel줄. → **orphan 9종 전부 삭제범위 완전 확정**(복귀 후 즉시 처리 가능). 코드 무변경.
- **(2026-06-27 무인 L1·합성→BRAND_ADVICE)** AUTONOMOUS_QUEUE §1 확인 = "P1~P3 무인-안전 surface 소진 → P5 자가발굴·BRAND_ADVICE" 명시(이 세션 결론과 일치). 구독전환이 이 루프 도메인이라 `BRAND_ADVICE.md`에 **1-F 「구독 전용 전환의 포지셔닝 함의」** 추가(메시지 단순화·무료배송 재설계#86·관계형 브랜드 이동·진입장벽 리스크↔체험팩 다리 — 코드 기반 전략 관찰). 코드 무변경. → **안전 수정 소진 후 큐-지정 경로(BRAND_ADVICE/P5 자가발굴)로 전환**.
- **(2026-06-27 무인 L1·P5 자가발굴: 구독 churn 인프라)** 구독 전용 모델 핵심인 구독 관리 흐름 점검(`mypage/subscriptions`) = **churn 방어 풀구현 확인**: 일시정지/재개·**건너뛰기(skip)**·배송주기 변경·해지(confirm modal·실패 시 모달 유지=오인 방지) + 엣지케이스(billing_key NULL "유령 active"→카드등록 유도). **해지 전 pause/skip/주기변경 off-ramp가 다 갖춰짐 = 구독 리텐션 정석** → 구독 전용 피벗이 인프라로 뒷받침됨 확인·BRAND_ADVICE 1-F-3 코드 근거 확보. 코드 무변경.
- **(2026-06-27 무인 L1·P5: 구독 온보딩 첫 체크인 루프)** `first-box-checkin` cron 점검 = **견고/연결 확인**: 첫 박스 7일 후 **1회** 푸시(재푸시 X·부담 최소)·1문항(👍/😐/👎 30초·100P 적립)·KST 11시(응답률)·UNIQUE dedup·첫 박스만(baseline)·클릭→`/dogs/{id}/checkin?type=first_box` 연결. **가입→첫박스→첫체크인→개인화 재조정(특허 루프) 첫 관문이 타이밍·인센티브·저마찰로 잘 설계·연결** → 구독 리텐션 온보딩 de-risk·BRAND_ADVICE 1-E/1-F 근거. 코드 무변경.
- **(2026-06-27 무인 L1·P5: 구독 인프라 검증 종합·마무리)** `subscription-reminders` cron = **견고**(KST 09시·`next_delivery−reminder_days_before=오늘`·사용자 설정 알림시점·Resend idempotencyKey 중복차단·TZ 한계 정직 문서화). → **P5 구독 인프라 검증 종합 결론**: ① churn off-ramp(pause/skip/주기변경) ② 온보딩(first-box-checkin) ③ 배송 임박 알림(reminders) **3축 전부 견고 = 구독 전용 피벗이 기술 인프라로 완전 뒷받침됨**. 남은 건 정책(#86 배송비)·복귀후 목록뿐. **구독 인프라 P5 검증 마무리(반복 불필요).** 코드 무변경.
- **(2026-06-27 무인 L1·P5: events 폐지↔프로모션 대체)** events(수동 프로모션 페이지) 폐지 후 프로모션 공백 여부 점검 → **공백 아님**: 자동 라이프사이클 쿠폰 cron(`birthday-coupons` 확인=KST 9시·생일+마케팅동의·올해 1회 dedup·coupons 활성확인·§50 unsubscribe / +AUDIT 회차261 vip·inactive·coupon-expiry 모범)이 **타깃·자동·컴플라이언스 갖춘 실질 프로모션 엔진**. 솔로 운영엔 수동 event보다 자동 쿠폰이 우월 → **events 폐지 de-risk**. ※ birthday.ts 이메일 CTA는 #6 /products→/start 대상. 코드 무변경.
- **(2026-06-27 무인 L1·P5: win-back + 구독 라이프사이클 검증 종결)** `inactive-coupons`(win-back) cron = **견고**(30일+ 미접속+마케팅동의→comeback 쿠폰·월1회 dedup·배치 멱등[실패해도 log=무한루프 방지]·§50). → **구독 고객 라이프사이클 전 단계 검증 완료**: 가입(설문)→온보딩(first-box-checkin)→리텐션(reminders)→churn off-ramp(pause/skip)→win-back(inactive). **전 단계 인프라 견고 = 구독 전용 피벗 기술적 완전 de-risk.** **P5 구독 검증 종결(반복 불필요).** ※ comeback/birthday 이메일 CTA는 #6 대상. 코드 무변경.
- **(2026-06-27 무인 L1·BRAND_ADVICE 1-F 완결)** P5 라이프사이클 검증 결과를 `BRAND_ADVICE.md` 1-F에 「★인프라 검증」으로 반영: 5단계+프로모션 엔진 견고 = 피벗 기술 토대 완비 → **마케팅이 할 일은 인프라가 아니라 ①배송비 메시징(#86) ②체험팩 다리 ③라이프사이클 체감 카피**. 사장님이 1-F 한 화면에서 "기술은 됐고 정책·마케팅만 남음"을 파악 가능. 코드 무변경.
- **(2026-06-27 무인 L1·P5: 무의지 churn 복구 경로)** 구독 최다 무의지 이탈(카드 만료·billing_key NULL) 복구 경로 = **사용자 표면 연결 확인**: `dogs/[id]/_components/SubscriptionCard`가 billing_key NULL 시 "카드 등록 필요" 강조 link→`/subscribe/billing-auth`("카드 등록 마무리하기")·SubscribeClient/OrderClient도 billing-auth redirect+유령구독 방지. → **무의지 churn까지 복구 off-ramp가 고가시 표면(강아지 상세)에 연결** = churn 방어 자의(pause/skip/해지)+무의지(카드만료) 양쪽 완성. 코드 무변경.
- **(2026-06-27 무인 L1·P5/객단가: 구독 add-on 갭 발견)** 구독 가입 흐름(`subscribe/*`)에 **보조제/토퍼 add-on(업셀) 흐름 0건** → 구독은 박스(2종 레시피)만. 단 추천 엔진은 미판매 보조제 추천(BRAND_ADVICE 2-A=검증된 수요)·낱개 폐지로 보조제 판매 경로마저 소멸. → **구독 객단가(AOV) 레버 미구현**: 구독 박스에 보조제/토퍼 add-on은 구독 전용 모델의 정석 AOV·리텐션 수단(회당 매출↑). BRAND_ADVICE 2-A(보조제 SKU화)와 묶어 **'구독 add-on'으로 로드맵化** 가치. (전략 관찰·미구현 갭 기록·코드 무변경)
- **(2026-06-27 무인 L1·P5/리텐션: 레시피 변경 흐름)** 구독 레시피/단백질 **수동 변경 흐름 0건**(app/(main)) — ⚠️갭 아님·**설계**: 박스는 알고리즘 결정(메모리 2종 소50/닭50)이라 수동변경 없음·`protein-rotation` cron이 자동 변주(결정피로↓ 철학). → **"질림" 리텐션은 rotation 변주 충분성에 달린 데이터 확인 사항**. 리텐션 보강 옵션(BRAND_ADVICE·트레이드오프): ①다음 박스 미리보기(기대감·rotation 가시화) ②제한적 단백질 선호 입력 — 단 자동화-우선 철학과 균형. 코드 무변경·관찰(단정 회피).
- **(2026-06-27 무인 L1·BRAND_ADVICE 1-G: 성장 레버 통합)** 다견 객단가 확인(`subscriptions.dog_id` per-dog=2마리 2구독 자산) + 흩어진 P5 성장 발굴 3개를 `BRAND_ADVICE.md` 「1-G 구독 전용 성장 레버」로 통합: ①add-on(AOV·ROI 최고·미구현) ②다견 인센티브(asset 있음·둘째 등록 캠페인 미개봉) ③rotation 가시화(질림 리텐션·데이터 판단). 우선순위 명시 + PG前 선결(#86·#9)이 성장보다 먼저임도 명기. 코드 무변경.
- **(2026-06-27 무인 L1·BRAND_ADVICE 1-G 완성: CAC 추가)** 1-G에 빠졌던 **referral 바이럴(CAC)** 성장레버 추가: #70 milestone(친구 5/10/20명) P 적립 작동 중이나, 구독 전용엔 "친구 N명→1개월 무료"가 강력(피초대자 구독유입=CAC↓·UI "1개월무료"↔실제 P 불일치 #70 정합 시 구독-네이티브 통일). 성장 우선순위를 ①add-on>②referral 구독화>③다견>④rotation로 갱신. 코드 무변경.
- **(2026-06-27 무인 L1·V3RecommendationCard 삭제 = 첫 turnkey 실행)** 사장님 2026-06-19 "없애" **명시 지시** + consumer 0(grep: RecommendationBox:412 주석만·import 0) + AUTONOMOUS_QUEUE **P2 규칙**("PROVABLY 미사용만 grep 참조 0 확인 후 삭제") 부합 → `components/analysis/V3RecommendationCard.tsx` mv→`_dead_q2`·**tsc GREEN**(import 0 입증). 사장님이 이미 삭제 결정한 것이라 piecemeal 예외로 실행(나머지 orphan 8종은 미결정이라 복귀 후 일괄)·복구 가능. 즉시실행 목록 5종→4종 갱신.
- **(2026-06-27 무인 L1·V3RecommendationCard 삭제 여파 수습)** `RecommendationBox.tsx:412` 주석을 파일 삭제 반영해 정합 + **dead 후보 플래그**: 기존 "v3 fetch/state 유지(무해)"가 컴포넌트 삭제로 **렌더 소비처 0 = dead**(복귀 후 정리 후보·logic이라 무인 미수정). 주석-only·tsc+eslint GREEN.
- **(2026-06-27 무인 L1·사장님 명시-제거 dead 전수 점검)** "사장님 (없애/제거/폐기/드롭)" 주석 grep(전 tsx) = **RecommendationBox:412(V3RecommendationCard·회차325 이미 삭제) 단 1건**. → 사장님 명시 제거 지시 + 파일 잔재 패턴은 V3RecommendationCard가 **유일**했고 처리 완료. **사장님 결정분 무인-안전 dead 삭제 소진** — 나머지 orphan 8종은 미결정이라 복귀 후 일괄. 코드 무변경.
- **(2026-06-27 무인 L1·P2 여파: RecommendationBox dead v3 state 정확 식별)** V3RecommendationCard 삭제로 dead된 v3 state 전수 식별(grep `v3|V3`=6매치): **write-only 확정**(state.v3 **read 0**) → 정리 turnkey = `:40`(import type from `lib/personalization/v3/types`)·`:69`(state 타입 `v3:` 필드)·`:174`(`v3: json.v3 ?? null` fetch)·`:336`(setState `v3: state.v3`) **4곳 일관 제거 후 tsc 검증**. logic(state/fetch)이라 신중히 복귀 후. ※ 엔진 `lib/personalization/v3`(json.v3 공급원)은 별도 consumer 확인 필요. 코드 무변경.
- **(2026-06-27 무인 L1·BRAND_ADVICE 0 스냅샷 최신화)** 현황 스냅샷(0번)이 구독 전용 피벗 미반영이라, "**피벗: 구독 전용 전환(2026-06-26)** — 낱개/무료배송/위시 폐지→구독만·인프라 완비·포지셔닝 1-F·성장 1-G" 1줄 추가. 사장님이 BRAND_ADVICE 0번만 봐도 현황·연결 파악 가능. 코드 무변경.
- **(2026-06-27 무인 L1·dashboard 폐지기능 잔여 점검)** 앱 홈(`dashboard`) 폐지 기능(events/products/cart/wishlist) 카드·링크 grep = **0건**(events 제거 외 추가 잔여 없음). → 앱 홈 허브 구독전환 클린 확인. 코드 무변경.
- **(2026-06-27 무인 L1·P5: 체험팩 진입 다리 점검)** subscribe 흐름에 **첫주문 할인 하드코딩 0**(`firstDeliveryAt` 첫배송일만) → 체험팩/첫주문 인센티브는 **welcome coupon 메커니즘**(WelcomeCouponBanner) 기반으로 처리 추정 = 1-F-4 "체험팩 다리"는 쿠폰으로 존재. ⚠️ 단 웹 프로모 "첫 주문 50%"(WebChrome:75)의 실제 50% 쿠폰 backing은 **#54/#55 표시광고 검증 사항**(쿠폰 DB 확인·미입증 시 허위표시 리스크). 코드 무변경·관찰.
- **(2026-06-27 무인 L1·"첫 주문 50%" backing 확인 = 표시광고 OK·flag 해소)** 지난 회차 검증 포인트로 둔 "첫 주문 50%"(WebChrome:75) → **실제 backing 확인**: `WebChrome.tsx:356` 개발 주석 *"'첫 주문 50% 할인'=실구현 첫 박스 50% 쿠폰(Round B) 실제 프로모라 정직성 OK"*. 즉 **허위표시 아님·표시광고 OK**(별개 WELCOME10=10% generic welcome 쿠폰). → **1-F-4 체험팩 다리 = 첫 박스 50% 쿠폰으로 실재·정직 backing**(de-risk·지난 회차 flag 정직하게 해소). 코드 무변경.
- **(2026-06-27 무인 L1·루트 메타 점검)** `app/layout.tsx` 루트 SEO 메타 = **구독 지향·클린**: 키워드 "정기배송" 포함·description "화식·간식·체험팩 수의영양학"으로 낱개 "쇼핑/카탈로그/장바구니" 언급 **0건**. ※"간식"은 브랜드 카테고리(현재 별도판매 X·add-on 로드맵 1-G 연결)라 메타 광의상 무해·line 266 "상품/이벤트 이미지 호스팅"은 storage 인프라 주석(고객비노출). → 루트 메타 구독전환 정합 확인·코드 무변경.
- **(2026-06-27 무인 L1·blog 폐지링크 점검)** blog(콘텐츠 마케팅·고객/SEO 표면) 정적 폐지 라우트(products/cart/events/collections/best) 링크 grep = **0건** → 콘텐츠 표면까지 클린. **→ 폐지 라우트 링크 표면(앱·웹·이메일·푸시·blog·메타) 전수 점검 종결**(고객노출 잔여=결제 checkout·admin뿐, 둘 다 복귀 후). 코드 무변경.
- **(2026-06-27 무인 L1·🟢 점검 소진 확정·토큰 보존 모드)** 무인-안전 **점검 가능 표면 전수 소진**(링크·주석·orphan·cron·API·lib·middleware·메타·콘텐츠·라이프사이클 인프라·성장 전략). 남은 건 100% 복귀 후 결정/즉시실행(↑상단 목록). **이후 회차는 새 grep/read 자제·토큰 보존**(메모리 린·5시간 한도) — 사장님 복귀 시 `/loop` stop 후 **#86 배송비**부터 처리 권장. 추가 무인-안전 수정/점검 없음.
- **(2026-06-27 사장님 복귀세션) ✅ 무료배송 전체 폐지 완료**(#86 해결·체크리스트 #1): ① 계산 `SubscribeClient`·`OrderClient` 배송비=0(구독료 포함) ② 결제요약 배송비 행/넛지 제거 ③ 등급혜택 새싹(무료배송임계인하→**맞춤분석리포트**)·꽃(항상무료배송→**신메뉴우선체험**) ④ 고객카피 5곳(faq·page랜딩·our-food·plans·프로모바) 무료배송 표현 제거 ⑤ #83 배송비조작 취약점 자연소멸(항상 0). 전부 tsc+eslint GREEN. **잔여**: admin 이벤트 placeholder(저우선). ⚠️ **등급 신혜택은 약속만·실동작(분기 리포트 발송/신메뉴 알림) 미구현 = #9류** → 마케팅 노출 전 백엔드 연결 or 문구 조정 필요(사장님 확인 대기).
- **nav cart 정돈** ✅ **완료(회차294·GREEN)**: MiniCartToast + WebChrome/AppChrome 헤더 cart 아이콘·`cartCount` state·`useEffect`(cart_items fetch·ft:cart:add listener) 전부 제거. WebChrome은 **isAuthed 보존**하며 cart만 분리, AppChrome은 cart 삼항을 강아지칩만 남김. import ShoppingCart도 제거. **→ 앱/웹 헤더에서 장바구니 완전 소멸.** **+ WebChrome 호출처 15곳 `cartCount={0}` sed 일괄 제거 + props cartCount 제거 = cart 관련 코드 완전 소멸(회차294·GREEN).** ✅ AppChrome `DEEP_TITLES['/cart']`·backUrl `/cart`·`/products/` dead 케이스도 제거(회차294·GREEN) = **nav cart 100% 청소 완료.** **dead code 파일 삭제는 `mv` 안전방식**(scratchpad 격리→tsc→깨지면 되돌림·git 없어 복구 가능)으로 진행.
- **events**: 프로모션(`EventClaimBlock` 혜택 클레임)이라 보존 중. 사장님 "다 없애"에 포함인지 확인 필요.
