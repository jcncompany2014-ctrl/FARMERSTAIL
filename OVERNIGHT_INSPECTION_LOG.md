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

## 2026-06-28 22:36 — 누적 배포 + 무한 점검 루프 재개

- **배포**: 커밋 `21279de`(기준선 d84c56d 이후 누적 293파일) main 푸시 → Vercel 프로덕션 READY(~129s). 사전검증 전부 green: tsc 0 · eslint 0에러 · 테스트 1257 · `next build` 0 · pre-push CI빌드재현 통과.
- **라이브 스모크(farmerstail.kr)**: `/` · `/start` · `/start/survey` · `/our-food` · 신규이미지(recipe-analysis/meal-recipe/supplement-box/meal-hero/health/protein) 전부 **200**.
- **⚠️ 미적용 마이그레이션(사장님 수동 필요)**: `20260627000001_orders_discount_reason.sql` 는 ③ 자동할인 코드보다 **먼저** 적용해야 함(구독결제 cron이 orders.discount_reason 기록). `drop_referral_system.sql` 은 배포 **後** 적용. 미적용 시 자동할인/레퍼럴 정리 미완 — 단 코드가 에러시 정가 폴백이라 과금은 안전.
- **루프**: 2계층 크론(작업 `c750452c` 10분 · 체크인 `ab93fa09` 5시간). `durable:true` 줬으나 런타임 session-only → 앱 켜둬야 유지.
- **다음 감사 영역(라운드로빈, 계속)**: discount 슬롯경계 → SubscriptionsWebClient vs 앱 동등성 → 계정 페이지 쿼리/타입 → 레퍼럴 잔존 → 이메일템플릿 → tiers → StartSurvey → F2 정리.

## 2026-06-29 14:35 — 점검: discount 엔진 + 구독결제 통합 (포어그라운드, 사장님 동석)

- **discount 엔진(lib/discount.ts)**: 슬롯경계(`tierSlotRange` UTC 등분)·스택금지·첫주문우선·`applyDiscount` 상하한 정독 — 정책(반기2·분기4) 정확, 버그 없음. 테스트 21 green. **안 건드림(잘 완성).**
- **구독결제 KST(`todayKstIsoDate`)**: UTC+9 후 날짜 슬라이스 → 슬롯경계 KST 정합. 타임존 버그 없음. count 쿼리 전부 `error`→`fullCharge` 폴백 확인.
- **🔴 통합 의존성(확정, 읽기전용 검증)**: `subscription-charge/route.ts:480` 주문 insert가 `discount_reason` **무조건** 포함. 프로덕션(adynmnrzffidoilnxutg) `information_schema` 조회 → **`orders.discount_reason` 컬럼 부재** = 마이그 `20260627000001` 미적용. 실구독 청구 시 `ORDER_INSERT_FAILED`.
  - **단 `subscriptions` 0행**(런칭 전) → 현재 깨지는 청구 없음. **첫 실구독 전 마이그 적용 필수**(긴급X·필수O). 코드는 전제 맞아 무변경.
- **다음 라운드로빈**: SubscriptionsWebClient vs 앱 동등성 → 계정 페이지 쿼리/타입 → 레퍼럴 잔존 → 이메일템플릿 → tiers → StartSurvey → F2.
- **✅ 해소(사장님 승인 후 MCP 적용)**: `apply_migration(adynmnrzffidoilnxutg, orders_discount_reason)` success. 재검증 — `orders.discount_reason` text + CHECK(first_order|tier|birthday|none|NULL) + `orders_user_discount_reason_idx` 전부 생성 확인. → 구독결제 주문 insert 정상화, 첫 실구독 결제 안전. **🔴 해소.**
  - 남음: `drop_referral_system`(20260627000000)은 destructive DROP이라 미적용 유지(사장님 별도 결정 시). generated types 재생성은 cast 동작 중이라 선택(미실시).

## 2026-06-29 14:40 — 점검: 웹 구독관리 동등성
- **SubscriptionsWebClient vs 앱 SubscriptionsClient**: pause/resume/cancel/reminder/interval 전부 supabase 직접 `update().eq('id').eq('user_id', uid)` 소유권 스코프. 앱 원본도 **동일 패턴**(grep 확인 — 양쪽 다 /api·rpc·fetch 부수효과 0). resume 카드재등록/카드없음 가드·box-sub next_delivery(2주→+15d, else +1M) 동등. **동등성 OK, 버그 없음.**
- **다음**: 계정 페이지 쿼리/타입 → 레퍼럴 잔존 → 이메일템플릿 → tiers → StartSurvey → F2.

## 2026-06-29 14:46 — 점검: 계정 페이지 쿼리/타입
- `/account`·`/account/dogs`·`/account/subscriptions`·`/account/profile` 서버 쿼리 컬럼을 **실 스키마와 대조**(information_schema): dogs(age_value/age_unit/birth_date/breed/photo_url/user_id)·profiles(email/cumulative_spend/tier/name/phone/id) **전부 실재**. 컬럼 미스매치 0.
- 결과 사용: count `null` 폴백 graceful, profile maybeSingle null안전, dogs `data ?? []` 안전, auth 가드+redirect. order_status 카운트는 실제 enum(pending/preparing/shipping) — 이전 'confirmed/shipped' 오류 수정 주석 확인. **버그 없음.**

## 2026-06-29 14:46 — 점검: 레퍼럴 제거 완전성 (잔존 참조)
- 라이브 코드 `_dead_referral` import 0 · referral href/Link 0 · `from '...referral'` 0. robots.ts `/r/` disallow는 죽은 라우트라 무해. cap.ts `referral:30000`·types.ts 레퍼럴 테이블은 **의도적 보존/DB정합**(DROP 마이그 미적용이라 테이블 실재). **레퍼럴 제거 완전, 버그 없음.** (trivial: robots `/r/` 항목 추후 정리 가능 — 무해라 미수정)

## 2026-06-29 14:50 — 점검: 이메일 템플릿 (쿠폰 잔재)
- birthday/comeback/vip 쿠폰 템플릿: **라이브 호출 0건**(발송 크론 격리됨) → 죽은 템플릿, 무해. 미수정.
- **🟢 수정+배포**: `orders.ts` 환불(주문취소) 메일 "사용한 포인트와 쿠폰은 모두 돌려드려요"→"사용한 포인트는 모두 돌려드려요". 라이브 발송 메일이 폐지된 쿠폰 환불을 약속(환불정책 페이지는 이미 정리, 메일만 누락) = 고객 혼선. 카피만 수정(로직 무변경). tsc0·eslint0 → 커밋 `5b04411` push(pre-push CI빌드 통과) → Vercel 배포.
- **다음**: tiers(lib/tiers.ts 등급혜택 자동할인 정합) → StartSurvey → F2(Tabs.tsx stale 주석, trivial).

## 2026-06-29 14:54 — 점검: tiers 정합 + StartSurvey + F2 (라운드로빈 1바퀴 완료)
- **tiers**: lib/tiers.ts 등급 할인 카피 ↔ lib/discount.ts `TIER_DISCOUNT` 대조 — seed 첫주문50%·sprout 무할인·bloom 연2회25%·fruit 연4회20%·mate 매주문10%·생일 전등급20% **전부 일치**. discount.ts가 rate 단일소스(tiers.ts는 표시카피+적립률), 수치 발산 0. 버그 없음.
  - 🟡 관찰(기록만): 생일20%+등급할인 등급별 별도 나열하나 stack 금지(최대 1개)라 꽃·열매 생일월엔 등급할인 우선. "중복 불가" 미고지 — 마케팅 결정사항, 미수정.
- **StartSurvey**: 이번 세션 UI 전면 작업 + 매 편집 tsc/eslint/serve(200) 재검증 완료. 답안 key(body/allergy/taste/food/health) 결과계산과 정합, draft에 PII 미저장(answers만). 프로덕션 /start/survey 200. 추가 버그 없음.
- **F2(Tabs.tsx stale 주석)**: 주석(import 아님)이라 무해 — 보수 규칙(잘 되는 코드 안 건드림)상 record-only 유지.

### ✅ 라운드로빈 1바퀴 완료 (2026-06-29)
점검 7영역: discount엔진·구독결제통합·웹구독관리·계정페이지·레퍼럴·이메일템플릿·tiers/StartSurvey.
**배포 수정 2건**: ①discount_reason 마이그(MCP) ②환불메일 카피(5b04411). 나머지 clean.
**다음 바퀴 후보**: 결제 confirm 경로(3b-2 미완, 신중)·admin 라우트·cron 4종·lib/personalization·SEO메타.

## 2026-06-29 14:57 — 점검: cron 정합 (vercel.json ↔ 라우트)
- 양방향 대조: **30 크론 = 30 라우트, 깨진 매핑 0.** 등록됐는데 라우트 없음 0 · 고아 라우트(미등록) 0 · 쿠폰/레퍼럴 죽은 크론 잔존 0. 크론 정리(②-1 격리) 정확 + quarterly-report 신규 정상 등록. **버그 없음.**

## 2026-06-29 15:02 — 루프 재시작(크론 36ffb3fc 작업·4279bbb0 체크인) + 점검: SEO sitemap/robots
- sitemap.ts: 정적 18라우트 + blog 동적(try/catch, 500 안던짐). 레퍼럴(/r/·/mypage/referral)·쿠폰·낱개커머스(/products·/collections·/events) 전부 미포함(구독전환 정합). /account/* 미포함=맞음(인증페이지는 robots disallow).
- 라이브 검증: sitemap 정적 18라우트 **전부 farmerstail.kr 200**(404 0건). robots.ts `/r/` disallow는 죽은라우트라 무해. **SEO 정합, 버그 없음.**
- 다음 라운드로빈: admin 라우트 에러처리 · a11y · 미사용 export · 깨진 내부링크 · 이메일 발송 경로.

## 2026-06-29 18:18 — 포어그라운드 점검 배치 (admin·링크·a11y·todo)
- admin 라우트 raw 에러: blog/draft:189(외부 NETWORK_ERROR, admin전용 저위험)·partial-cancel:257(결제경로). 둘 다 명확버그 아님+admin/결제 → 미수정(규칙).
- **내부 링크 깨짐 스캔**: 라이브 57개 정적 href → 프로덕션 검사. 55개 200, 2개(tractive/connect·privacy/export)는 인증 API라 401 정상. **진짜 404 0건.**
- **a11y**: `<img>` alt 누락 **0**. TODO/FIXME/HACK 실제 마커 **0**(매치는 포맷마스크·테스트설명).
- **자동할인 엔진 기능검증(대표 7시나리오)**: 첫주문50%→15000·나무10%·꽃25%(슬롯사용시 0)·열매+생일 스택금지(20% 1개)·나무+생일 큰쪽(생일20%) 선택·씨앗 무할인 전부 **정확**. 슬롯경계 분기(Q2)/반기(H2 연말→익년1/1 롤오버) 정확. 배포 결제할인 숫자 검증 완료.

## 2026-06-29 18:20 — 점검: cron 인증 건전성
- cron 인증: 30/30 라우트 모두 `cron-auth`(CRON_SECRET Bearer) 게이트, 인증 로직 테스트 green. 빠진 라우트·우회 0. **건전.**
- **다음 라운드로빈**: 이메일 notify 오케스트레이션 · PWA manifest/sw · env 누락 가드 · 성능(이미지 lazy/sizing) · 접근성(focus/label).

## 2026-06-30 (연속루프 전환: 10분크론 폐기 → 쉬지않고 한도까지) — 점검 배치
- 이메일 발송층(lib/email/index notify 15종): 죽은 쿠폰/레퍼럴 발송 함수 라이브 호출 0, notifyCoupon/referral 발송자 없음. **발송층 깨끗.**
- PWA: manifest.json 유효(name·6아이콘 전부 실재·standalone·start_url /dashboard), public/sw.js 존재. **건전.**
- 보안: 클라이언트(.tsx)에서 CRON_SECRET/SERVICE_ROLE/TOSS_SECRET/ANTHROPIC/RESEND 등 secret 참조 **0** — 서버전용 유지. **누출 없음.**
- **다음**: env 필수값 가드 · 접근성(icon-only 버튼 aria-label) · 성능(img sizing/lazy) · 미사용 export · personalization(읽기전용).
- 접근성: aria-label 없는 button 5개 모두 **텍스트 라벨 있는 버튼**(아이콘전용 아님) → 스크린리더 OK. img alt 0누락.
- 디버그 누출: 프로덕션 코드 console.log/debug **0건**(error/warn만). 깨끗.
- 성능: public/ >500KB 미최적화 이미지 **0건**(전부 webp/최적화).
- lib/coupons.ts 잔존(쿠폰제거 미완 — 결제경로라 무인 금지, 사장님 동석 시).
- env.ts: zod 스키마 + 필수값 누락 즉시 throw(prod SERVICE_ROLE/CRON_SECRET 가드). 조용한 실패 없음. **견고.**

### 이 연속 턴 점검 요약 (2026-06-30)
이메일발송층·PWA/manifest·클라보안(secret누출0)·a11y(img alt0·아이콘전용버튼0)·console.log0·대용량이미지0·env가드 — 전부 clean. lib/coupons.ts만 잔존(결제경로 무인금지=기록만).

## 2026-06-30 — 연속 점검 배치 2
- cron KST/UTC 날짜계산: 전반 일관·신중(dog-age-update·push-lifecycle 과거 off-by-one 수정 주석). 버그 없음.
- 하드코딩 localhost/127.0.0.1 프로덕션 누출 **0**.
- 마케팅 11페이지(about·brand·our-food·why-fresh·reviews·plans·partners·faq·contact·science·newsletter) 전부 metadata export 있음. SEO OK.
- 계정 허브: /account 가 subscriptions·dogs·profile·orders 전부 링크. 새 페이지 도달성 OK.
- React: jsx-key·exhaustive-deps eslint 강제(빌드 green=위반0). dangerouslySetInnerHTML 9곳 전부 sanitize markdown/통제 상수(XSS 홀 없음).
- 보안: @ts-nocheck/@ts-ignore **0**(타입체크 우회 없음). 계정·마이페이지 데이터쿼리 전부 auth.getUser()+`.eq(user_id/id)` 소유권 필터. as any 20개는 의도적 schema-drift 캐스트. 테스트 1257 green. 프로덕션 헬스 200.

### 종합(2026-06-30): 약 17개 영역 연속 감사 완료 — 실버그 2건(마이그·환불카피, 배포) 외 전부 clean. 코드베이스 매우 탄탄.

## 2026-06-30 — 🟢 실작업: 쿠폰 시스템 코드 전면 제거 (사장님 승인, 배포 49add2d)
- DB 확인: 주문 7건 중 할인 0·쿠폰 redemption 0 → 쿠폰 경로 한 번도 안 쓰임(죽은 경로) → 제거 저위험 확정.
- revokeCouponRedemption 호출+import 제거: order-expire·cancel·cancel-items·refund-recovery (4파일, 각 독립 블록).
- payments/confirm: 쿠폰 위변조검증(coupon fetch+computeCouponDiscount) 제거 → 단건 체크아웃 무할인이므로 discount_amount>0이면 위변조 거부(가드 보존·강화). recomputedSubtotal 총액검증 유지.
- lib/coupons.ts + coupons.test.ts 삭제(고아 확인). **410줄 삭제.**
- 단계별 검증: 4파일 제거→tsc0/eslint0 → confirm→tsc0/eslint0(recomputedSubtotal 잔존확인) → 삭제→tsc0/eslint0/test1241 → next build0 → 커밋+push(pre-push CI빌드 통과).
- **남음(④, 사장님 결정)**: coupons 테이블 DROP 마이그 · admin events coupon-claim 변형 제거(테이블 의존) · checkout/success order.coupon_code 표시(현재 null 무해).

## 2026-06-30 — 쿠폰 ④ 블로커 발견(사장님 결정 대기)
- events 3개 중 2개가 cta_variant='coupon-claim': subscription-launch(SUBLAUNCH·종료6/15)·black-friday(BF2026·예정11월). → admin coupon-claim 코드 제거 시 이 라이브 이벤트 표시 깨짐. orders→coupons FK 0(테이블 DROP 자체는 안전). **사장님 이벤트 처리 결정 후 진행.** leftover(admin 드롭다운+coupons 8행) 무해 보존.

## 2026-06-30 — 쿠폰 제거 후 프로덕션 헬스 + 죽은템플릿 정리
- 죽은 쿠폰 이메일 템플릿(birthday/comeback/vip) 삭제 — 고아 확인, tsc0, 배포 95083ea.
- 프로덕션 광범위 헬스: /·/start·/start/survey·/our-food·/checkout·/events·/events/black-friday·/plans·/reviews·/account·/legal/refund 전부 200. order-expire 크론 401(정상). **쿠폰 410줄 제거가 프로덕션 안 깨뜨림 확인.**

### 오늘 배포 요약: discount_reason마이그 · 5b04411(환불카피) · 49add2d(쿠폰코드410줄) · 95083ea(죽은템플릿). 전부 검증·헬스 OK.
### 남은 큰 진척 = 사장님 결정 필요: ①events 2개(coupon-claim) 처리 ②체험팩 제거 진입설계 ③coupons테이블 DROP(①후)

## 2026-06-30 — ✅✅ 쿠폰 시스템 완전 제거 완료 (코드+DB+이벤트)
- 이벤트: black-friday·subscription-launch coupon-claim→benefit-auto 전환(보존·활성, 공개페이지 200).
- 코드: admin/events page.tsx coupons 쿼리 제거(3e85e4e) · account-purge 쿠폰 deleteStep 제거(3966fb1, DROP 전 배포).
- DB DROP(apply_migration drop_coupon_system): 테이블 6(coupons·coupon_redemptions·manual_coupon_grants·birthday/inactive/vip_coupon_log) + 함수 2(redeem_coupon·revoke_coupon_redemption). 재검증=남은 쿠폰 객체 0. orders→coupons FK 0이라 orders 무영향(orders.coupon_code 컬럼은 잔존·null·무해).
- DB 데이터 안전: 쿠폰 redemption 0(한번도 안씀)이라 손실 데이터 없음.
- ⚠️ 남은 무해 잔재(차후): admin coupon-claim UI 셸(inert, 이벤트 0개라 미사용) · orders.coupon_code 컬럼 · generated types.ts(재생성 시 정리) · _dead_q4 격리 쿠폰코드. 전부 무해.

## 2026-07-01 00:51 — 🤖 예약 크론(00:50) 종합 점검 배치
- 격리 죽은코드: 라이브가 _dead_q4/_dead_referral import **0** — 격리 완전.
- i18n lib/korean(조사): 받침 한글수학(%28) 정확, petName/josa 맞음. 비한글 무받침 기본은 문서화된 한계(강아지이름 무해). 버그 없음.
- 깨진 이미지: 코드 정적 src↔public/ 대조 — `/dog.jpg`는 Avatar.tsx JSDOC 예시(렌더 아님), 실제 깨진 이미지 **0**.
- 보안: 하드코딩 시크릿/키 **0**.
- DB 스키마 드리프트: subscriptions 14컬럼(billing_*·coverage/interval_weeks·reminder_enabled 등) 전부 실존, 드리프트 **0**.
- 🟢 **쿠폰 DROP 안전 재확인**: 라이브 코드가 삭제된 6테이블/2함수 참조 **0**(.from/.rpc). 남은 coupon_code는 events/orders 잔존컬럼(미드롭·null·무해) 읽기뿐 — 안 깨짐.
- 마무리: 전체 테스트 green, 프로덕션 11라우트 전부 200.
- **결론: 신규 영역 전부 clean, 실작업 0. 다음 크론 02:50 이어감.**

## 2026-07-01 02:5x — 🤖 예약 크론(02:50) 종합 점검 배치 (보안·DB·성능)
- RLS 커버리지: 모든 public 테이블 RLS 활성(꺼진것 0). 정책 0개 3테이블(anthropic_usage·email_suppressions·rate_limit_counters)=서비스롤 전용 인프라, 정상.
- Supabase advisor(보안): **ERROR 0**. WARN 73 — security_definer_function_executable 70(≈35함수×auth/anon, 대부분 의도 RPC/트리거. ⚠️anon 실행가능 35건 검토권장), rls_enabled_no_policy 3(인프라). 전부 DDL이라 무인 미수정.
- Supabase advisor(성능): **ERROR 0**. WARN 279 — auth_rls_initplan 164(★RLS `auth.uid()`→`(select auth.uid())` 감싸면 스케일 개선), multiple_permissive_policies 112, unused_index 84·unindexed_fk 31(런칭전 노이즈).
- DevContextToggle: layout NODE_ENV!=='production' 가드 — 프로덕션 노출 **0**, 정상.
- **결론: ERROR 0, 코드 실버그 0.** DB advisor 권고는 DDL이라 기록만.
- ⭐ 사장님 액션 후보(DDL, 시간날때): ①auth_rls_initplan 164건 RLS 최적화 마이그 ②anon security-definer 35함수 검토 ③레퍼럴 DROP 마이그(redeem_referral_code 등 잔존).
- 다음 크론 04:50 이어감.

## 2026-07-01 04:5x — 🤖 예약 크론(04:50) 점검: 고객 카피 쿠폰 잔재 + 비결제 API
### 🟡 고객 노출 카피 쿠폰 잔재 4곳 (환불메일 외 — 사장님 present일 때 일괄 수정 권장, 무인 미수정)
- app/(main)/mypage/membership/page.tsx:406 "등급 산정에서 적립금·쿠폰 할인 차감 후" → "·쿠폰" 제거. (app-only, 안전)
- app/(main)/mypage/notifications/PreferencesPanel.tsx:28 label '프로모션 · 쿠폰' → '프로모션 · 혜택' 등(wording 판단). (app-only)
- app/mypage/orders/[id]/CancelOrderButton.tsx:161 "사용한 포인트와 쿠폰은 환원" → "포인트는 환원". (⚠️주문/결제경로 — 신중)
- app/mypage/orders/[id]/page.tsx:196 "포인트와 쿠폰은" → "포인트는". (⚠️주문/결제경로)
- (무해): MypageClient/order-expire/subscription-charge/cancel 주석·PurchaseTracker coupon prop(null)·PointsBrowser refType(과거 P 아이콘, 보존)·StartSurvey:559 "(실제 쿠폰)" 주석.
### 비결제 API 에러처리: NextResponse 에 raw error.message 노출 **0**(결제/admin 제외 전수). 마무리 tsc 0, 프로덕션 5라우트 200.
### 결론: 코드 실버그 0. 발견=고객카피 쿠폰잔재 4곳(사장님 일괄 수정 권장, 무인 미수정). 다음 크론 06:50 이어감.

## 2026-07-01 06:5x — 🤖 예약 크론(06:50) 점검: 이메일·미들웨어·a11y·설문엣지
- 이메일 발송(lib/email/client.ts sendEmail): 멱등키·suppression(fail-open)·구조화결과(ok/skipped/reason)·RFC8058 List-Unsubscribe·try/catch. **견고, 버그 없음.**
- 미들웨어/dispatch: AuthAwareShell + lib/app-context 존재(빌드 Proxy Middleware 확인). 정상.
- 🟡 a11y(마이너 기록): StartSurvey 가입폼 텍스트 input(이름·이메일·비번·출생연도) label 시각표시는 있으나 **htmlFor/id 미연결** → 스크린리더 라벨 미연관. 체크박스는 implicit 연결 OK. 개선 후보(무인 미수정).
- ✅ 설문 결과 엣지: `computeStartPlan.noSafeRecipe` + UI 분기로 전 단백질 알레르기→"상담 안내" graceful(가짜폴백 없음). 테스트 보증. 안 깨짐.
- **결론: 코드 실버그 0. a11y label 마이너 갭만 기록.** 다음 크론 08:50 이어감.

## 2026-07-01 08:5x — 🤖 예약 크론(08:50) 점검: 구독전환·에러커버리지·캐시이상
- 구독전환 완전성: /products·/collections·/cart 코드 전부 `redirect('/start')`(HEAD 배포). /products·/collections는 프로덕션 fresh 307→/start 정상.
- 🟠 **이상 1건 — /cart CDN 캐시 staleness**: 코드는 redirect 무조건인데 프로덕션 /cart는 **X-Vercel-Cache HIT 200(옛 장바구니 콘텐츠)**, 캐시우회 쿼리(?nocache=ts)로도 HIT=정적캐시. /collections는 fresh 307(MISS). → **/cart만 옛 빌드 캐시 잔존**. 코드 정상=인프라(CDN) 이슈. 영향 낮음(/cart 무링크·구독전환). **자가복구**: 다음 배포 시 CDN 무효화 예상. 안 되면 Vercel 캐시 퍼지 또는 cart/page.tsx `export const dynamic='force-dynamic'`. 무인 미수정(코드정상+커머스경로).
- 에러바운더리: global-error 1+not-found 1+error.tsx 4+loading.tsx 13 — 적정.
- 프로덕션 12라우트 전부 200.
- **결론: 코드 실버그 0. /cart CDN 캐시 이상 1건 기록(사장님 확인 권장).** 다음 크론 10:50.

### 08:50 배치 종합결론
- DB 보안 어드바이저: **ERROR 0건**(76 lints: rls_no_policy 3·public_bucket_listing 2·security_definer 35×2·leaked_pw 1, 전부 WARN/INFO·기존알려진것). 쿠폰6테이블 DROP 후 보안 회귀 0.
- 법정 라우트 /legal·/legal/refund·/legal/terms·/legal/privacy·/business 전부 200.
- 핵심 라우트 / /start /login /faq 200, /account·/account/subscriptions·/account/dogs 307(미인증 리다이렉트 정상).
- git 작업트리 청결. branch main @ 3966fb1.
- **실코드버그 0. 유일 이상=/cart CDN 캐시 staleness(코드정상·인프라·log-only).** 미수정 원칙 준수(잘 동작하는 코드 안 건드림). 다음 예약크론 10:50.

## 2026-07-01 10:5x — 🤖 예약 크론(10:50) 점검: 보안(IDOR/소유권/토큰/admin가드)
- tsc --noEmit **EXIT=0**(clean).
- 동적 [id] API 8종 전수: 전부 `auth.getUser` + 소유권필터(`.eq('user_id',user.id)`) 보유. orders/cancel·addresses/[id]는 RLS+defense-in-depth 이중. **IDOR 0**.
- dogs/[id]/vet-share: 토큰발급 전 소유검증 + `randomBytes(20).base64url`(≈160bit) + 14일만료 + DELETE도 IDOR방어 주석/검증. 모범.
- photo-upload/[token](무인증): RPC토큰검증(unique+만료+1회용 IS NULL) + IP+token rate-limit(6/분·30/시) + 3MB/mime화이트 + upsert=false + 에러메시지 마스킹. 견고.
- admin API **11/11 권한가드 패턴 보유**(requireAdmin/isAdmin류).
- 🟡 트리비얼 기록: app/api/orders/[id]/cancel/route.ts docstring 41행 "5. Decrement coupons.used_count" = 드롭테이블 stale주석(코드엔 없음·비기능). 결제경로 파일이라 무인 미수정(rule③).
- **결론: 보안 STRONG, IDOR/권한누락 0. 실버그 0.**

## 2026-07-01 10:5x — 🟡 피벗 후 죽은 목적지 링크 3곳 (checkout/order — 무인 미수정·사장님 결정필요)
구독전용 전환으로 /products·/cart는 redirect('/start')라 404는 아니나, 아래 버튼들이 **결제완료/실패 후 사용자를 설문(/start)으로 떨어뜨림** = 어색한 UX. 전부 결제/주문경로(rule③).
- app/checkout/fail/page.tsx:81 "장바구니로 돌아가기"→/cart · :93 "쇼핑 계속하기"→/products. (구독전용엔 둘 다 무의미)
- app/checkout/success/page.tsx:390 "쇼핑 계속하기"→/products. (결제완료 후 설문행)
- app/mypage/orders/[id]/ReorderButton.tsx:88 재주문→`ft:cart:add` 이벤트+router.push('/cart'). **카트기반 재주문 플로우 전체가 구독전용에선 죽은 개념** → "재주문"을 /account/subscriptions or 구독관리로 보낼지 제품결정 필요.
- (무해): components/ui/Button.tsx:26 /products는 JSDoc예시(렌더X). robots.ts /r/ disallow는 의도(크롤차단).
→ 권장: 사장님이 checkout/order UX 손볼 때 일괄. 재주문 버튼은 의미 재정의 필요.

## 2026-07-01 10:5x — 점검: SEO 라우팅 정합
- 프로덕션 /sitemap.xml 200(application/xml) · /robots.txt 200(text/plain). 정상 서빙.
- sitemap.ts: 피벗 인지(낱개커머스 /products·/collections·/best·/new·/events 제외 주석명시) + 정적 18 URL + 동적 blog_posts.
- sitemap 등재 정적 12라우트(/about /brand /our-food /why-fresh /reviews /plans /partners /contact /newsletter /science /business /blog) **전부 200** — 죽은 sitemap 항목 0.
- **결론: SEO 라우팅 정합 clean.**

## 2026-07-01 10:5x — 점검: 메타데이터/OG/구조화데이터
- 루트 layout: metadataBase + title템플릿("%s | 파머스테일") + description + openGraph + twitter card + 동적 `/api/og` 이미지.
- 주요 공개 7페이지(/, /our-food, /plans, /reviews, /brand, /blog, /start) 전부 자체 metadata export.
- 동적 OG: 프로덕션 /api/og **200 image/png 67KB** — 소셜 공유 미리보기 정상생성.
- JSON-LD 구조화데이터: about/blog/blog[slug]/brand/business/contact/faq/layout/newsletter/our-food 등 10+페이지 적용. 브랜드 SEO 성숙.
- **결론: 메타/OG/구조화데이터 성숙·clean.**

### 10:50 배치 종합결론
- 점검영역 4: ①보안(IDOR/소유권/토큰/admin가드) ②피벗후 죽은링크 ③SEO라우팅 ④메타/OG/구조화데이터.
- **실코드버그 0 · tsc EXIT=0 · 코드 무변경(working tree 청결, 로그만).**
- 보안 STRONG(IDOR 0, admin 11/11 가드, 토큰 견고). SEO/메타 성숙.
- 발견(전부 무인 미수정·사장님 결정): 🟡 checkout/order 죽은목적지 링크 3곳(/cart·/products→/start, 재주문 의미 재정의 필요) · 🟡 cancel route stale 주석 1(coupons.used_count).
- 다음 예약크론 12:50.

## 2026-07-01 12:5x — 🤖 예약 크론(12:50) 점검: 클라/서버경계·접근성·성능·DB정합
- 클라/서버 경계(시크릿 누출): 'use client' 179파일 중 서버시크릿(SERVICE_ROLE/CRON_SECRET/TOSS_SECRET/createAdminClient) 참조 **0**. NEXT_PUBLIC 목록 전부 의도된 공개값(비즈정보 법정표시·GA/Clarity/Meta분석·Kakao JS키·Supabase anon·Toss client·VAPID public). **시크릿 누출 0.**
- 접근성(이미지 alt): app/components tsx 66개 img/Image 태그 중 alt 누락 **0**(스캔 1건은 주석 내 `<img>` 오탐, 실제 PhotoGrid는 alt="" 장식용 정답). 커버리지 완전.
- DB 정합(읽기전용, execute_sql): orphan order_items **0** · dogs 고아(무프로필) **0** · 포인트원장 음수잔액 유저 **0** · active구독 billing_key누락 **0** · orphan 0 전반. 프리런칭 카운트 일관(orders7/paid0/discount0, subs0, dogs8, profiles6, ledger5, refunds0). **참조무결성 위반 0.**
- 크론 정합: vercel.json 30 crons ↔ app/api/cron route 파일 **30개 양방향 100% 일치**(dangling/미등록 0). 쿠폰크론 제거 잔재 없음.
- 크론 인증가드: 샘플 5종(subscription-charge·order-expire·account-purge·payment-ledger-reconcile·tracking-poll) 프로덕션 전부 **401**(무보호 200/깨짐 500 없음). 결제크론 포함 견고.

### 12:50 배치 종합결론
- 점검영역 5: ①클라/서버 시크릿누출 ②접근성(이미지 alt) ③DB정합(읽기전용) ④크론 config정합 ⑤크론 인증가드.
- **실코드버그 0 · 코드 무변경(working tree 로그만) · 신규발견 0.**
- 시크릿누출 0 · alt누락 0 · DB참조무결성 위반 0 · 크론 30↔30 일치 · 크론 401 견고.
- (이번 배치는 코드변경 없어 tsc 생략 — rule② "변경마다" 조건. 이전 10:50 배치서 tsc EXIT=0 확인됨.)
- 다음 예약크론 14:50(마지막).

## 2026-07-01 14:5x — 🤖 예약 크론(14:50·마지막) 점검: 타입안전·죽은코드·성능·이메일링크·최종헬스
- tsc --noEmit **EXIT=0**(clean).
- 타입안전 이스케이프: @ts-ignore **0**(blanket 없음), @ts-expect-error 1(테스트 의도적 invalid입력). as any 29·eslint-disable 88 = 전부 문서화된 종류(no-img-element 39 의도적 raw img·no-explicit-any 31 supabase 제네릭캐스트·react-hooks 신규strict 15). 건강.
- 🟡 죽은코드 2건(비결제·analysis 인접, 삭제안함·기록만): components/analysis/magazine/**AtAGlance.tsx**(렌더서 제거됨, AnalysisMagazineSection:122 주석 "→삭제" 명시, 파일만 잔존) · **CelebrationBanner.tsx**(참조 0). 둘 다 컴파일OK·무해 dead weight. magazine 나머지 10파일은 사용중. → 사장님이 analysis 손볼 때 정리 후보(버그 아님).
- 성능/이미지: next.config images remotePatterns(supabase+unsplash)·minimumCacheTTL 1년(prod)·AVIF/WebP formats. 최적화 양호.
- 성능/쿼리: 무제한 .select 휴리스틱 9건 = 전부 cron 배치잡(cart-recovery·payment-ledger-reconcile·push-lifecycle·restock-alerts 등)+admin push-campaigns. 배치는 전행처리 설계상 정상, 현재 프리런칭 규모(profiles6·subs0) 무해. **버그 아님·스케일워치**(대규모 성장 시 페이지네이션 고려).
- 🟡 이메일 링크 잔재(커머스시대, 구독전용 정리대상·무인 미수정): lib/email/templates/cart.ts:77 `${SITE_URL}/cart`(장바구니 이탈메일) · restock.ts:59 `/products/${slug}`(재입고메일) · index.ts:358 `/products/${slug}`. 셋 다 제거경로→/start redirect. cart-recovery/restock 크론은 존재하나 구독전용서 cart_items/restock 신규유입 사실상 0(휴면). → 쿠폰처럼 **플로우 존폐 제품결정 후 제거/재링크**(SUBSCRIPTION_ONLY_MIGRATION 항목). client.ts http URL은 Resend API엔드포인트(정상).
- 최종 프로덕션 헬스: 24개 중 23개 200. /signup 404 조사 결과 **의도된 제거·무해**: signup/page.tsx 없음(설문 자동가입 전환), 라이브 네비게이션 0(Onboarding 완료는 router.replace('/start'|'/login') 478-479행, 둘 다 200). /signup 참조는 stale 주석 4곳(welcome/page.tsx:7·not-found.tsx:15·blog/[slug]:322·AuthHero.tsx:10, 비기능·무해). not-found CTA는 /start·/ 정상.
- 제거경로 /products·/collections·/best 프로덕션 전부 307 redirect 정상.

### 14:50 배치 종합결론 (마지막 예약크론)
- 점검영역 5: ①타입안전 이스케이프 ②죽은코드(고아모듈) ③성능(이미지/쿼리) ④이메일 링크정합 ⑤최종 프로덕션 헬스.
- tsc EXIT=0 · 코드 무변경(working tree 로그만) · 실코드버그 **0**.
- 발견(전부 무인 미수정·기록): 🟡 죽은 analysis 컴포넌트 2(AtAGlance·CelebrationBanner) · 🟡 이메일 커머스링크 잔재 3(cart/restock→redirect경로) · stale 주석(/signup 4·coupons 1).

## ==== 2026-07-01 무인 예약점검 시리즈 총결산 (00:50~14:50, 8배치) ====
- **실코드 버그 발견/수정: 0건.** 코드베이스는 매우 탄탄, 무인 코드변경 0(모든 배치 working tree 청결).
- 점검 커버리지(누적): 죽은코드격리·i18n·시크릿·스키마드리프트·RLS·DB advisor(보안/성능)·비결제 API 에러처리·이메일 발송메커니즘·미들웨어·a11y(설문라벨+이미지alt)·설문엣지·구독전환·에러바운더리·라우트헬스·보안(IDOR/소유권/토큰/admin가드)·SEO(sitemap/robots/메타/OG/JSON-LD)·클라서버경계·DB정합(읽기전용)·크론정합·크론인증·타입안전·성능(이미지/쿼리)·이메일링크·최종헬스. **≈24개 영역.**
- **사장님 결정/조치 필요 항목(전부 무인 미수정·기록만)**:
  ① checkout/order 죽은목적지 링크 3(checkout success/fail·ReorderButton→/cart·/products, 재주문 의미 재정의)
  ② 고객카피 쿠폰잔재 4(membership:406·PreferencesPanel:28·CancelOrderButton:161·orders/[id]:196)
  ③ 이메일 커머스링크 잔재 3(cart/restock 템플릿)
  ④ 죽은 analysis 컴포넌트 2(AtAGlance·CelebrationBanner)
  ⑤ DB advisor DDL 권고(auth_rls_initplan 164·anon security-definer 35·레퍼럴 DROP 마이그 미적용)
  ⑥ stale 주석/설문폼 a11y 라벨연결
- ①②③은 구독전용 전환 잔재(SUBSCRIPTION_ONLY_MIGRATION 후속), ⑤는 DDL(무인금지). 전부 결제/커머스/DB 인접이라 사장님 present 시 일괄 권장.
- 다음 예약크론 없음(시리즈 종료). 깨끗한 앱상태 위해 RESTART_CLAUDE.bat 권장.

## 2026-07-01 14:5x — 🤖 예약 크론(추가 배치) 점검: 테스트·입력검증·webhook보안·로그PII
- 전체 테스트 스위트: **1241 pass / 0 fail** (suites 317, 1.6s). green.
- 입력검증/엔드포인트 게이팅: mutation 라우트 56개 전수 — **무검증+무제한+무인증 = 0**. zod 미검출 27건도 전부 auth/rate-limit/webhook서명 중 하나로 게이팅.
- webhook 보안: payments/webhook=Toss HMAC 미서명이라 **paymentKey 재조회(Secret Key)로 검증**+금액대조+위변조Sentry알림(모범). webhooks/resend=**Svix 서명검증**(HMAC-SHA256, prod secret 누락시 503). 둘 다 견고, 위조 주입 불가.
- 로그 위생: console.* 에 민감값(password/token/secret/key/email) 로깅 **0**. 디버그 console.log **0**(error/warn + Sentry 구조화로깅만 사용). PII/시크릿 누출 없음.
- 결론: **실코드버그 0 · 코드 무변경.** 테스트 1241 green, 엔드포인트 게이팅 완전, webhook 서명검증 견고, 로그 위생 완벽. 매우 탄탄.

## 2026-07-01 15:0x — 점검: 마이그레이션 드리프트 + 의존성 취약점(npm audit)
- 마이그 드리프트: 프로덕션 적용 최신 = orders_discount_reason(20260629 적용✓)·drop_coupon_system(20260630 적용✓). **drop_referral_system(로컬 20260627000000)은 미적용** — 단 cleanup DROP이라 미적용이 안전(코드는 이미 레퍼럴 전면제거, 죽은 테이블/RPC만 잔존). 레퍼럴 RPC 3종(redeem_referral_code 등)은 **types.ts 자동생성 타입에만** 존재·라이브 호출 0. discount_reason 사고(코드가 미적용 컬럼 의존)의 반대방향이라 **위험 드리프트 없음**. (rule③ DB apply 무인금지 → 미적용 유지, 사장님 배포 정리 시 적용)
- npm audit: 총 15(critical 0·high 2·moderate 11·low 2).
  - high 2 = **전부 dev/build 전용**: vite(devDep, Windows dev서버 fs.deny/NTLM CVE·prod무관) · ws(transitive webpack-bundle-analyzer/HMR·서버리스 런타임 미노출).
  - moderate 11 = 대부분 transitive/dev(opentelemetry×4·brace-expansion·js-yaml·postcss·tar). prod직접 2(@sentry/nextjs=opentelemetry 버블업·앱익스플로잇 낮음, next=**수정포크라 공개CVE 부적용 가능·무인 업데이트 금지**).
  - **긴급 프로덕션 런타임 취약점 0. fixAvailable=True지만 dep변경(특히 next 포크)은 무인 금지** → 사장님 리뷰 권장(npm audit fix는 dev툴링만 영향).

## 2026-07-01 15:0x — 점검: env검증·React hooks·⭐프로덕션 실런타임 에러(Vercel)
- env.ts: zod serverSchema + 필수값(SUPABASE URL/ANON) 검증 + SERVICE_ROLE prod분기 throw + Next inline-safety(명시적 키접근, spread 금지) 주석. 견고. (TOSS_SECRET/SERVICE_ROLE 직접 process.env 참조는 서버측만·누출0.)
- React hooks 억제 스팟체크: set-state-in-effect(StartClient:50·CookieConsent:19) 둘 다 **deps=[] 마운트1회 외부스토어(localStorage/cookie) 동기화**, 세터 상태가 deps에 없어 캐스케이딩 없음, 주석이 React19룰 반박 명시. purity 억제는 admin display용 new Date()(오탐). **무한루프/stale-closure 버그 0.**
- ⭐⭐ **프로덕션 실런타임 에러 1그룹(Vercel 7일)**: `AuthApiError: Invalid Refresh Token: refresh_token_not_found` count 8·users 4·routes `/`·`/dashboard`, first 2026-04-21 last 2026-06-29(10주 저빈도).
  - **원인**: dashboard/page.tsx:81-83 `supabase.auth.getUser()`가 try/catch 무보호(하단 Promise.all 쿼리만 에러처리). stale/만료 refresh token 시 SSR 자동갱신이 AuthApiError throw → `if(!user)redirect('/login')` 도달 못하고 **서버에러로 전파**. `/` 랜딩 경로도 동일 패턴 추정.
  - **영향**: 낮음(10주 4명), 해당 유저는 깔끔한 로그인 리다이렉트 대신 에러화면.
  - **정석 fix(사장님·auth경로)**: getUser를 catch로 감싸 refresh_token_not_found면 stale sb쿠키 정리+미로그인 처리(redirect '/login' or 공개뷰). lib/supabase/server.ts createClient or middleware에 중앙화 권장. Supabase SSR 알려진 패턴.
  - ⛔ **rule③ 인증경로라 무인 미수정 — 기록만.** (시리즈 통틀어 유일한 실프로덕션 에러 = 최우선 액션아이템)

### 15:0x 배치 종합결론
- 점검영역 5: 마이그드리프트·npm audit·React hooks억제·env검증·**Vercel 실런타임 에러**.
- 코드 무변경(로그만). tsc EXIT=0·테스트 1241 green(직전).
- 🟢 clean: 마이그(위험드리프트0)·env검증·React hooks(버그0)·audit(긴급런타임0).
- ⭐ **최우선 액션(사장님, auth경로)**: 프로덕션 refresh_token_not_found 에러 — dashboard/`/` getUser 무보호. Supabase SSR catch 패턴으로 해소 권장. **시리즈 통틀어 유일한 실프로덕션 에러.**

## 2026-07-01 15:1x — 🟢 실작업: auth refresh_token_not_found 서버에러 수정 (사장님 동석 승인, 배포 6bf5e91)
사장님 "고쳐봐" → rule③ auth경로지만 **동석 승인이라 진행**.
- 진단: `lib/supabase/server.ts` 얇은 createClient만·미들웨어 없음. getUser 호출 199곳/171파일 → 개별래핑 위험. **중앙 세이프헬퍼 + 실제 에러난 진입점 2곳만** 적용(최소·안전).
- 수정: `getSafeUser(supabase)` 헬퍼 신설(getUser의 throw + `{error}` 반환 둘 다 흡수 → User|null). 적용: app/page.tsx(랜딩, user→isAuthed) · app/(main)/dashboard/page.tsx(getUser→getSafeUser, 이후 if(!user)redirect narrowing 유지). import 추가.
- 검증: tsc --noEmit EXIT=0 · eslint 3파일 0 err · pre-commit(eslint+tsc) 통과 · **pre-push build:ci(전체 CI 빌드) 통과** · push 6bf5e91. Vercel 자동배포.
- 효과: stale/만료 refresh token 유저가 /·/dashboard 서버에러 대신 로그인 리다이렉트/공개뷰로 graceful. (배포 후 curl 재검증 진행.)
- ⚠️ 나머지 ~197 getUser 호출부는 미변경(에러 미발생 경로 + 최소수정 원칙) — 필요시 점진 롤아웃 가능.
- ✅ 배포 검증: 배포 URL(iqkzxg54s) 200·pre-push build:ci 통과·프로덕션 / 200·/dashboard 307→/app-required(web 레이아웃 가드=기존정상, getUser변경은 app-context authed에만 영향)·/login 200. **회귀 0·500 없음.** stale token 서버에러→graceful 전환. (refresh_token_not_found 재발은 신규트래픽서 사라질 예정.)
- ⭐ **시리즈 유일 실프로덕션 에러 = 수정완료(6bf5e91).** 나머지 발견은 전부 사장님 결정용 정리항목(무인 미수정).

## 2026-07-01 15:2x — 점검: 크론 실행 건전성(프로덕션 cron_health, 읽기전용)
- 등록 크론 30종 전부 **last_status=success · 14일 에러 0** · 지속 200-1400ms 정상. 결제크론 subscription-charge(06-30 19:21 success)·refund-retry·subscription-cleanup·payment-ledger-reconcile 정상.
- 폐지 크론 4종(birthday-coupons·coupon-expiry·referral-milestones·inactive-coupons)은 06-15~06-28 이후 미실행 = 정상 정지(vercel.json 등록해제됨, cron_health는 과거이력만). 마지막 실행도 success(쿠폰 DROP 06-30 전이라 에러 없음).
- **결론: 프로덕션 크론 인프라 완전 건전, 조용한 실패 0.**

## 2026-07-01 15:2x — 점검: 프로덕션 런타임 로그(관측성)
- Vercel 런타임 로그 24h(Pro 보존한도): **error/warning/fatal 0 · 5xx 0 · 4xx 0**, 200만 68건(+정상 3xx 소수). 프리런칭 저트래픽이나 서버/클라 에러 0.
- (auth refresh_token 에러는 장기 에러집계 테이블서 발견·수정완료, 24h내 재발 0.)
- **결론: 프로덕션 런타임 clean.**

## 2026-07-01 15:2x — 점검: 공유 인터랙티브 컴포넌트 a11y
- components/ui/BottomSheet.tsx(9곳 사용) + components/v3/Modal.tsx(barrel `@/components/v3` 경유·medications/vaccinations 등 사용): 둘 다 **네이티브 `<dialog>`** 기반 → ESC·포커스트랩·inert·click-outside 브라우저 처리. `aria-labelledby`(useId 인스턴스별 유일 id, 하이드레이션 안전)+title 없을 시 aria-label 폴백+닫기버튼 aria-label. **모범 a11y, 갭 0.**
- (v3/Modal은 barrel export라 초기 orphan grep서 누락됐으나 실사용 확인 — 고아 아님. 앞서 AtAGlance/CelebrationBanner는 barrel 미포함 = 진짜 고아 유지.)

### 15:2x 배치 종합결론 (auth수정 후속 점검)
- 점검영역 3: ①크론 실행건전성(cron_health 30종 success·에러0) ②프로덕션 런타임로그(24h error/4xx/5xx 0) ③공유 모달 a11y(네이티브 dialog 모범).
- **신규 실버그 0.** 프로덕션 인프라(크론·런타임)·핵심 UI a11y 전부 건전.
- 앞선 auth refresh_token 수정(6bf5e91)이 이 세션의 유일한 코드변경, 배포·검증 완료.

---

# 2026-07-25 밤 — 고객 실사용 정밀 점검 + 어드민 마스터피스

> 지시: ①고객 실사용 문제요소 위주 ②어드민(신기능 발굴·디자인 편의·시인성/가독성·오류).
> 원칙: 잘 되는 코드 안 건드림 · 매 건 tsc+eslint · 결제/인증/DB/임상 로직은 기록만 · admin UI/가독성은 수정 OK.

- [시작] 야간 루프 재개.
- [iter1·고객 모바일 실주행] 웹 퍼널 홈→/start→설문 4스텝→결과, 375px 완주.
  - ✅ 쿠키배너·히어로·설문 카드·초안복원(재방문 시 답 유지)·견종 자동완성 전부 정상.
  - 🐛수정: **무료분석 결과 '오리·연어' 노출** — start-teaser PROTEIN_ORDER에 미판매 연어·양 잔존
    + 전부알레르기 fallback['닭'] 모순 → 4종만+상담분기(카톡버튼). 라이브 재검증 '오리·돼지' ✓. 커밋 됨.
  - 📝기록(아침 결정): ①체중 number input이 **마우스휠 스크롤에 값 변경**(6→5.9 실제 재현) —
    데스크톱 웹 위험, onWheel blur 처리 후보. ②플랜 "하루 약 N원**부터**"가 완전화식(100%) 단가 —
    '부터'인데 최저티어(곁들임30%) 아님. 가격 표시 정책이라 사장님 결정 필요(4,400원부터로 바꾸면 전환율↑ 여지).
- [iter2] 🐛수정: number 입력 휠 값변경(6→5.9 실재현) — 고객 11곳 onWheel blur. 라이브 재검증 값 유지 ✓. 커밋 됨.
- [iter3·admin 가독성] 극소폰트 스캔(9px 11곳·10px 126곳) → 대부분 킥커/뱃지(의도)라 유지,
  본문성 힌트·주의문구만 선별 상향(블로그폼·FAQ/산지 힌트·부분환불 주의·환불캡션·KPI힌트). 커밋 됨.
- [iter4·고객 실사용] 로그인 모바일 ✓(카카오 우선·설문 유도 정합). 빈 상태(대시보드/강아지/주문) 렌더 존재 ✓. 에러 토스트 28파일 커버 ✓. 프로덕션 빌드 그린 ✓.
- [신기능 후보 — 아침 사장님 결정 대기]
  1. **재고 간편 조정**: 제조 후 재고 보충이 지금은 제품 편집 폼 깊숙이. 제품 목록 행에 +/- 빠른 조정 버튼(재고만 patch). 데이터·API 이미 존재 → 라벨 인쇄급 난이도.
  2. **주문 일괄 배송처리**: 화요일 발송 후 운송장 N건 입력이 현재 주문상세 하나씩. 택배사 확정 후 설계 권장(보류 사유 기존과 동일).
  3. **오늘의 운영 브리핑 푸시**: 매일 아침 처리대기 요약을 사장님 폰으로. cron+push 인프라 있음. (선호도 확인 필요)
- [iter5·admin 모바일+대비] 표 4곳(자동작업·FAQ·인사이트·알림통계) 가로스크롤 추가(폰 깨짐 방지). zinc-400 스캔 → 정보성 2곳만 zinc-500 상향(메타는 의도 유지). 커밋 2건.
- [iter6·고객 흐름 정적] approve(더블제출 가드·금액 diff ✓)·checkin(중복응답 안내·editMode ✓)·nextBox(자체 알레르기 blocked 필터+정규화 ✓) — 건강.
  - 📝기록(낮 확인 권장): progression 크론(cycle2+)은 저장 전 gateAvailability 미적용 — cycle1이 게이트되므로(이전 formula 상속) 연어 유입 가능성 낮지만, compute(5.5a)와 대칭 맞추면 완전해짐. 임상 인접이라 밤엔 미수정.
- [iter7] admin 빈 상태 문구 전수 — 맥락형+헤더 CTA 존재로 건강(개선 불요). 구독관리 화면(dogs/[id]/subscription·account/subscriptions) subscriptionState 정본 사용 ✓·busy 더블클릭 가드 ✓.
- [iter8] 주문상세 '환불 가능 잔액' 오표시(미결제 취소에 total 노출) → canRefund 조건부 '—'. 라이브 검증 ✓. 커밋 됨.
- [iter9] 🐛수정: 제품상세→라벨 PDF 링크가 UUID 라 항상 404 → slug→SKU 역매핑(C01 라벨 정상 렌더·130kcal v4.0 정합 확인). 회귀감시: test 1373+tsc 그린.
- [iter10·코드 마스터피스] KPI 카드 로컬 재정의 10곳 발견 → ui.tsx StatCard(unit 추가) 정본 통합 시작. 1차 3곳(cron-health·charges·push-stats) 교체+정의 삭제(-120줄). 남은 7곳 다음 사이클.
- [iter11] KPI 통합 완료 — 표준형 5곳 StatCard 정본화(cron-health·charges·push-stats·finance·insights), 특수형 5곳 의도적 유지(refunds 아이콘카드·personalization warn·beta 인쇄·cohort 아이콘·nutrients 미니). 로컬 정의 -5개.
