# 🌙 야간 전수 감사 (2026-07-18~19)

> 사장님 지시(2026-07-18 밤): "나 자고 일어날 때까지 멈추지 말고 앱 모든 부분을
> 전수 검사해." 아래 범위로 앱(웹+앱) 전체를 훑어 발견을 여기 기록한다.

## 검사 범위 (사장님 7축 + α)
1. **디자인/UI 문제** — 깨진 레이아웃·오버플로·톤 불일치·v3 스케일 위반
2. **연결 안 된 기능** — 완성됐는데 진입점 없는 것 (풀스택인데 死링크)
3. **빈약한 페이지** — 내용이 얇거나 placeholder 만 있는 화면
4. **부분 롤아웃 불일치** — 새 정보가 A엔 적용됐는데 B엔 안 된 것
   (이번 세션 변경: 사이클=박스3개·처방→가격연동·구독전용·포인트폐기·연어제거·화식비율)
5. **업그레이드 요소** — 지금도 되는데 더 나아질 수 있는 것
6. **정보 불일치** — 같은 사실을 두 곳이 **다르게** 말하는 것 (제일 위험)
7. **고객이 나중에 부딪힐 문제** — 死엔드·막다른 길·오해 유발 카피
8. 그 외 발견되는 전부

## 작업 규칙 (AUDIT_FINDINGS.md 프로토콜 계승)
- **감사 = 기록이 원칙.** 명백한 1줄 버그만 즉시 수정(로그 남김), 나머지는 여기 적어
  사장님 복귀 후 일괄 결정.
- **결제·인증·DB·SiteFooter·특허 플래그 = 점검만(불변).**
- 매 스텝: `npx tsc --noEmit && npx eslint <touched>` GREEN 확인. 파이프 금지.
- app-only·additive 수정만. 웹/앱 톤 분리 원칙 준수([[feedback_web_app_never_cross]]).
- 큰 파일은 Grep/구간 Read 로 토큰 절약. 한 스텝 = 5~15분 분량.

## 진행 로그
_(각 스텝: `[회차N · 무엇] 발견/수정 요약`)_

**[회차1 · 사이클 카피 잔재 스윕]** 이번 세션 사이클 변경(30일→박스3개) 후 고객
카피에 옛 주기 잔재 검사. 대부분 무관/정합(건강기록 "최근 30일"·survey 30일 가드·
"4주차 종합 체크인"[=3번째 박스=day28, 신모델과 정합]). **발견 1건(기록·의도판단
필요)**:

- **🟡 #A1 정보 불일치 — "4주 건너뛰기" 라벨 ↔ 부제 모순** (구독관리, 결제 인접이라
  기록만): `app/account/subscriptions/SubscriptionsWebClient.tsx:636`. 버튼 제목
  "4주 건너뛰기"인데 부제는 "다음 배송만 미루고 구독은 유지". 실제 동작=`handlePause(id,4)`
  → `nextCycleDate(baseIso, 4)` 로 **4주** 미룸(2026-07-17 커밋 c27fb84 이 그렇게
  고침). 박스가 14일치라 4주 미루면 **약 2주간 사료 공백**(같은 화면 다른 곳 경고
  "4주로 바꾸면 2주 뒤에 굶는다"와 충돌). **의도 판단 필요**: (a) 4주 skip 이 맞다면
  부제를 "4주 뒤로 미루고"로 · (b) 다음 배송(2주)만이 맞다면 라벨을 "다음 배송
  건너뛰기"로+handlePause(id,2). 앱판 DogSubscriptionClient 에도 동일 패턴 있는지
  후속 확인. 결제 인접(next_delivery_date)이라 무단 수정 X → 사장님 결정.

**[회차2 · skip 기능 크로스 화면 대조]** #A1 후속. 앱판/웹판 구독 "건너뛰기"를 대조.

- **🔴 #A2 정보/동작 불일치 — 같은 "건너뛰기"가 앱=2주, 웹=4주** (결제 인접, 기록만):
  · 앱 `app/(main)/dogs/[id]/subscription/DogSubscriptionClient.tsx:387` — 라벨
    "2주 미루기", 동작 `skip()`→`nextCycleDate(base)` **weeks 없이=2주**(라벨↔동작 일치 ✓).
  · 웹 `app/account/subscriptions/SubscriptionsWebClient.tsx:636` — 라벨 "4주 건너뛰기",
    동작 `handlePause(id,4)`→`nextCycleDate(base,4)` **4주**.
  → **같은 구독의 같은 "건너뛰기" 버튼이 앱에선 2주, 웹에선 4주 미룬다.** 두 화면을
    오가는 고객은 같은 액션에서 다른 결과를 봄(사장님 원칙 "정보 정본 통일" 위반).
    #A1(웹 부제 "다음 배송만"=2주)과 종합하면 **웹의 "4주"가 drift 로 의심**(부제·앱판
    모두 2주). 정본 결정 필요: skip=2주로 통일이 자연스러워 보이나(박스 14일치라 4주
    미루면 2주 공백) 사장님 판단. 결제 인접이라 무단 수정 X.

**[회차3 · 폐기 기능 카피 잔재 (포인트·연어)]** #4 부분롤아웃 축. 이번 세션/최근
제거 작업(포인트 폐기 2026-07-16, 연어 카탈로그 제거)이 고객 카피에 잔재 남겼는지.
**✅ 클린 — 발견 0**:
- 포인트: 고객 노출 화면에 "적립/포인트" 잔재 0. 검색 히트는 전부 주석이거나
  `privacy/page.tsx`의 "포인트 이력"(개인정보 내보내기 라벨 — point_ledger 에 법정
  보관 데이터 잔존이라 **정당**, 거짓약속 아님).
- 연어: 고객 노출(products·compare·our-food·copy-strings·chatbot)에 미출시 연어
  추천/노출 0. 연어유(원료)·알레르기 옵션만 정상 잔존.
→ 두 제거 작업 카피 스윕 철저함 재확인. (재검사 불필요.)

**[회차4 · 미연결 완성 기능 스캔]** #2 축. lib 전수에서 프로덕션 참조 0 파일 추림
(발명 휴면 제외). 발명계열(diet-simulation·meta-learning×3·w-image)=플래그 게이트라
정상. **실제 미연결 완성 기능 발견**:

- **🟡 #A3 전환 급여표(transition-plan.ts) 완성됐는데 UI 미연결 — 첫주 이탈 방어**:
  `lib/transition-plan.ts` 참조 0(테스트는 있음=완성). 파일 docstring: "화식 전환
  실패 1위 = 급하게 바꿔 배탈 → 보호자가 '음식이 안 맞나' 하고 그만둠. transitionStrategy
  를 이미 계산·저장하는데 **고객에게 한 번도 안 보여줬다**(approve 페이지만 읽음)."
  → 날짜별 전환 급여표("첫 2주 이렇게 바꿔주세요")를 순수함수로 완성해뒀으나 진입점 0.
  **메모리 "전환급여표 완료"는 lib 완성을 뜻했고 UI 연결 아님**(불일치 정정). 이탈률
  60% 첫주 구간을 직접 겨냥 → 연결 가치 큼. grace-period(#A? 미연결)와 **같은 축**
  (첫주 리텐션 완성-미연결 클러스터). 연결=UI 배치 결정이라 무단 X → 사장님 결정.
  · 참고: 확인된 다른 미연결=onboarding/grace-period.ts(첫4주 보호정책, 이번 세션
    이미 파악). 발명계열은 특허 플래그 결정([[project_invention_flag_pending]]) 대기.

**[회차5 · 진행사진 진입점 실검증]** #6 축(기록 정확성). #A3 후속으로 "진입점 죽은
완성 기능" 재확인 중, 메모리/AUDIT 의 "#32 진행사진 진입점 비활성=재활성 1줄" 을 실검증.

- **🔵 #A4 정정 — 진행사진은 이미 도달 가능(이전 감사·메모리가 부정확)**:
  `diary/DiaryClient.tsx:242` 의 photos Link 는 비활성 맞음(주석 "재활성 시 복원").
  **그러나** `components/v3/PawFab.tsx:47` 의 '사진' 발가락이 조건없이 `/dogs/[id]/photos`
  로 연결되고, PawFab 은 `AppChrome.tsx:648` 에서 앱 전역 렌더(dog상세·focus 제외).
  → **진행사진은 PawFab 로 이미 진입 가능 = 死기능 아님.** AUDIT_FINDINGS #32/메모리의
  "진입점 죽음, diary Link 재활성 필요" 는 **부정확**(diary 링크만 죽었고 PawFab 은 살아있음).
  액션 정정: "재활성"은 헛일 — 진입점이 이미 있음. 굳이 diary 에도 링크를 둘지는
  UX 취향(중복 진입점) 문제일 뿐. **die feature 아님 → 우선순위 강등.**
  (교훈: "진입점 0" 주장은 FAB/nav/딥링크까지 봐야 확정 — 한 곳 비활성 ≠ 도달 불가.)

**[회차6 · top-level 앱 페이지 진입점 검증]** #2·#7 축. (main) 그룹 top-level 페이지가
실제로 도달 가능한지 nav/chrome/딥링크 전수 확인(#A4 교훈 반영). reports·notifications=
mypage 메뉴로 정상. **고아 2건**:

- **🟡 #A5 /search 고아 페이지 — 227줄인데 진입 링크 0** (고객 도달 불가):
  `app/(main)/search/page.tsx`(227줄, 실기능)로 가는 링크가 전 앱에 **없다**. 유일
  참조=`AppChrome.tsx:78` 의 **제목 맵**(`'/search':'검색'`, 라우트→헤더제목)뿐 —
  클릭 진입 아님. 검색 아이콘/버튼도 없음. → **URL 직접입력 아니면 고객이 못 찾음.**
  기록 많은 앱이라 검색은 유용할 수 있는데 nav 에서 빠짐(과거 있다가 제거된 듯).
  → 진입점 추가(검색 아이콘) or 페이지 정리, 사장님 결정. 공유 chrome 수정이라 무단 X.
- **🔵 #A6 /family 고아 — 229줄, 참조 0** (단 의도적일 가능성 높음):
  `app/(main)/family/page.tsx`(229줄) 참조 전무. **메모리 [[project_dog_page_overhaul]]
  에 "가족초대 숨김"** 기록 있음 → **의도적 hide 로 추정**. 확인만: 정말 숨긴 거면
  정상(나중에 켤 자산), 실수로 빠진 거면 진입점 필요. 사장님 확인.

**[회차7 · v3 디자인 스케일 위반]** #1 축. `npm run check:design` 5건 → **오타 2건
즉시 수정**(app-only·1px 무해·AGENTS.md "그 자리에서 정리" 규칙, tsc+eslint GREEN):
- ✅ 수정 `PlanClient.tsx:509` borderRadius 11→**12**(md, off-by-one 오타).
- ✅ 수정 `PlanClient.tsx:361` h1 fontSize 23→**22**(lg, off-by-one).
- **🔵 #A7 남은 3건(의도적/애매 — 기록만)**:
  · `PlanClient.tsx:709` fontSize 56 = **장식 이모지(🍲 aria-hidden)** → 텍스트 스케일
    대상 아님, 검사기 오탐. 그대로 두거나 검사기 예외처리 권장.
  · `mypage/accuracy/page.tsx:178` borderRadius 26 = **52×52 완벽한 원**(반지름=변/2).
    렌더 정상, 토큰만 안 씀 → '50%' 또는 pill(999)로 바꾸면 검사기 클린(선택).
  · `mypage/MypageClient.tsx:113` fontSize 27 = lg(22)·xl(32) **사이 애매값**(off-by-one
    아님). 사용자 이름 hero 추정. 22/32 중 결정 필요 → 디자인 판단(무단 스냅 X).

**[회차8 · 할인·등급 정보 정합]** #6 축(#A2 가 이 축이라 심화). 가격/할인/등급 숫자가
화면마다 다르게 말하는지 대조. **✅ 클린 — 발견 0(정합 확증)**:
- 구독 할인율: OrderClient 가 `SUBSCRIPTION_DISCOUNT_PCT`(lib/pricing) 상수 사용 —
  하드코딩 충돌 없음.
- 나무 등급 10% 할인: `discount.ts MATE_RATE=0.1` ↔ `tiers.ts` benefits "매 주문 10%
  자동 할인/모든 정기배송에 10% 자동 적용" ↔ membership 페이지가 그 데이터 렌더 →
  **적용·표시·수치 3중 정합**. (#71 "등급혜택 약속>백엔드" 우려는 나무 할인 한정
  **해소 확인** — 백엔드가 실제 적용하고 화면도 정확히 안내.)
- 등급 임계값 씨앗10/새싹20/꽃30/열매40/나무50 = tiers.ts threshold 와 정본 일치.
  "나무만 할인"(다른 등급 benefits 에 할인 약속 없음) 정합.
- 블랭킷 "첫 주문 50%" = 메인 퍼널에서 제거됨(StickyCta·WebChrome 에 제거 기록 주석만).
→ 할인/등급 정보축 정합 확증. 재검사 불필요.

**[회차9 · 폐지 커머스 경로 死엔드]** #7 축. 구독전용 전환으로 폐지된 낱개커머스
(/products·/cart·/collections) 로 가는 死링크가 고객을 막다른 길로 보내는지.
**✅ 클린 — 死엔드 없음(메모리 우려 해소)**:
- `/products` 페이지가 **`/start`(설문 퍼널)로 redirect** → 어디서 링크가 와도 고객이
  안 막힘(막다른 길 아님, 퍼널로 흡수).
- 앱/컴포넌트에 **실제** `/products`·`/cart` 고객 링크 **0건**. 남은 참조는 (a) `/products`
  route 자신의 SEO 메타(canonical/og, 무해·리다이렉트됨) (b) Button.tsx·ErrorScreen.tsx
  의 **JSDoc 주석 예시**뿐(실사용 아님). ErrorScreen 실사용처 중 /products 넘기는 곳 0.
- `/compare`(분석→"4종 라인 비교" CTA)=살아있는 정보 페이지, 카피 "치킨·오리·흑돼지·
  한우"로 연어 제거와 정합 → 死엔드 아님.
→ 메모리 "#6/#7/#35 ~15페이지 /products 死엔드" 우려는 **redirect 로 실질 해소**.
  (경미: Button·ErrorScreen JSDoc 예시가 아직 '/products' 지시 — 미래 개발자 오도
   가능, 문서 staleness 🔵 매우 낮음. 코드동작 무관이라 기록만.)

**[회차10 · 빈 상태(empty state) 나갈 길]** #7 축. 신규 사용자가 처음 마주치는 빈
화면에서 다음 행동 CTA 가 살아있는지(死엔드 아닌지). **✅ 클린 — 전부 살아있음**:
- 강아지 목록 빈: "아직 등록된 아이가 없어요" + `/dogs/new`(실페이지) ✓
- 대시보드 강아지 0: `EmptyHomeNoDogs` + `addDogHref="/dogs/new"`, 퀵액션도 firstDog
  없으면 /dogs/new 폴백 ✓
- 구독 0: `SubscriptionsWebClient:263` "아직 정기배송이 없어요" + `/start` "맞춤 플랜
  시작하기" CTA ✓ (퍼널로 연결)
- `mypage/subscriptions`(앱) = `/account/subscriptions` 로 redirect(위 빈 상태로 흡수) ✓
→ 신규 온보딩 경로 막다른 길 0. (온보딩 동선 견고 재확인 — 이전 감사 "앱 동선
  빈틈없음" 결론과 일치.)

**[회차11 · 배송 요일·주기 정보 정합]** #6 축. 배송 정보(요일·주기·마감)가 화면마다
다르게 말하는지. 정본=`lib/shipping-schedule`(SHIP_WEEKDAY=2 화요일, LEAD_DAYS=2
일요일 마감). **✅ 대체로 클린 + 경미 관찰 1건**:
- 배송 주기: 전 화면 "2주마다" 일관(order·plan·formulas·SubscriptionCard·DogSubscription).
  요일 언급은 모두 "화요일"(order 1020/1049). 정본과 정합. ("매주"는 복약뿐, 무관.)
- **🔵 #A8 pause/cancel 통지 창이 실제 마감보다 보수적** (경미, 기록만):
  `OrderClient.tsx:958` "위약금 없이 일시정지·해지 가능 (발송 **1주일 전**까지 알려주세요)"
  ↔ 실제 시스템 마감=**일요일(발송 2일 전, LEAD_DAYS=2)**. "일요일 마감"은 고객에
  미노출(내부 주석뿐)이라 **화면 모순은 아님**. 다만 고객이 "1주일 전 놓쳤다"고 오해해
  일시정지 포기→원치 않는 박스 수령 가능(under-promise). 개선안: "발송 3일 전(일요일)
  까지"로 실제 유연성 반영 검토(고객 이득 방향). 결제 인접이라 무단 수정 X → 사장님 판단.

**[회차12 · CS/문의 시스템 진입·왕복 검증]** #2 축. 메모리 "#4 1:1 문의 진입점 부재"
우려 실검증. **✅ 완전 연결 — 우려 해소**:
- 문의 시작: MypageClient → `/help`(고객센터, 153줄). `/help` 가 `isApp && kakaoUrl`
  이면 **카카오톡 채널**, 아니면 **/contact 폼** 으로 라우팅(:73-75,120-122) →
  **2026-07-17 결정("앱=카카오, 웹=폼+카카오")과 정확히 정합.** + /faq 도 메뉴 연결.
- admin 답장 왕복: `admin/users/[id]/message` 가 `pushToUser({url})` + `cs_messages`
  thread insert + push_log(알림센터 누적) → **사용자가 push+알림센터로 답장 수신**,
  `/mypage/cs` thread 에서 확인. reply route GET="알림센터에서 호출".
→ 문의 진입(카카오/contact)·답장 왕복(push→알림센터→thread) 모두 배선됨. **死엔드 아님.**
  (경미: /mypage/cs thread 를 **상시 메뉴로 능동 열기**는 없음 — 답장 알림 통해서만
   진입. 단 신규 문의는 카카오/contact 로 유도가 설계라 정상. 🔵 매우 낮음.)

**[회차13 · 앱 내부 링크 무결성]** #7 축. 깨진 href/잘못된 라우트로 고객이 404 를
맞는 곳이 있는지. (main)+components/v3 정적 href ~22개를 실제 page.tsx 와 대조.
**✅ 클린 — 깨진 링크 0**:
- 검증한 정적 href 전부 실 페이지로 해결(/mypage/orders=top-level 웹앱공유, /compare·
  /legal·/account/* 등 포함). API-as-href 2개(privacy/export 다운로드·tractive/connect
  OAuth)도 정상 라우트.
→ 이전 감사 "실 死링크 1건(intervention-alerts→/simulate) 수정완료" 이후 링크 무결성
  견고 재확인. (스코프: 정적 href. 템플릿리터럴 동적 href 는 대상별로 이미 회차1~12 에서
  개별 확인됨 — dogs/[id]/*·checkin·approve 등.)

**[회차14 · 빈약한 페이지 (얇은 page.tsx)]** #3 축. 라인수 최소 페이지가 placeholder/
스텁인지 실기능인지. **✅ 클린 — 빈약/스텁 없음**:
- 7줄 페이지 3개(mypage/addresses·consent·notifications) = 전부 **의도적 redirect**
  (2026-07-16 통합: 배송지→/account/profile, 알림 동의/설정→/notifications?tab=).
  placeholder 아님.
- 통합 정합 확인: `/notifications` 가 `?tab=` 읽음(page:15 searchParams) → AlertsClient
  전달 → 탭별 렌더(inbox/push/consent, :67-75). **redirect→tab파라미터→탭렌더 완전 배선**
  → 통합 후 탭 딥링크 정확 작동(엉뚱한 탭 착지 없음).
- 나머지 12~13줄(vaccinations·medications·reminders·analyses/[id]) = client 위임
  server wrapper(표준 패턴, 실기능은 Client 컴포넌트에).
→ 빈약한 페이지 축 클린. "얇다=빈약"은 오해, 전부 위임/redirect.

**[회차15 · 화식 비율 3티어 정합]** #4·#6 축. 메모리 "3티어 /order 정합 후속(현재
불일치)" 실검증. **🟡 #A9 티어 정의 4중 산개 + 미세 라벨 불일치** (결제 인접+리팩터라
기록만):
- **FRESH_TIERS 배열이 3곳에 각각 로컬 정의**(SSOT 아님): OrderClient:78·PlanClient:108·
  RecommendationBox:45. 스키마도 제각각(value/label · value/label/**sub** · key/name/ratio).
  **내용(곁들임30/반반60/완전화식100·copy·note·badge)은 현재 일치하나 3중 복제라 drift
  위험**(하나 고치면 나머지 갈라짐 — 이번 세션 skip #A2 와 같은 패턴).
- **라벨 불일치**: 정본 `freshTierLabel`(freshTier.ts)=`화식 곁들임`/`화식 반반`/`완전 화식`,
  구독 표시 4화면(DogSubscription·SubscriptionCard·SubscriptionsWebClient·admin)이 사용.
  vs 선택 화면 FRESH_TIERS=`곁들임`/`반반`/`완전 화식`. → 고객이 **선택 시 "곁들임" →
  구독 후 "화식 곁들임"** 을 봄(완전 화식만 일치). 미세하나 정본 통일 원칙 위반.
- 참고: BoxMixCard=단백질 mix(2종 박스) 시각화라 티어와 무관(오탐 아님, 별개 개념).
→ **권장**: FRESH_TIERS 를 freshTier.ts 로 일원화(value/label/copy/note/sub 단일 정의)
  + freshTierLabel 을 거기서 파생(또는 라벨 정본 통일). 결제 흐름(order/plan) 닿으니
  사장님 결정 후 리팩터. **이번 감사 최대 구조 발견**(메모리 우려 실체 확정).

**[회차16 · 접근성(a11y) 업그레이드 여지]** #5 축. 아이콘 전용 버튼 aria-label·이미지
alt 누락 같은 개선 여지. **✅ 클린 — a11y 는 이미 강점(업그레이드 여지 적음)**:
- 이미지 alt 누락 0: grep 매치 3건 전부 멀티라인 JSX 로 alt 존재("체크인 사진"·
  업로드 프리뷰 `alt=""`[장식용 a11y 정답]·`alt={dog.name}`).
- a11y 커버리지 풍부: 40파일 aria-label, role="alert"×23·status×5·aria-live×5·
  dialog×4·switch×3·radiogroup×2·progressbar×2. 색맹 텍스트태그·포커스트랩·announce
  이전 감사에서도 견고 확인.
→ 메모리 "a11y 심층감사 완료" 실증. **업그레이드 값은 a11y 가 아니라 이미 기록된
  #A3(전환급여표 연결=리텐션)·#A5(/search 진입점=발견성)에 있음** — 그쪽이 ROI 큼.

**[회차17 · 이름 문법(josa) 정합]** #6 축(2바퀴째). 이름 뒤 변동 조사(은/는·이/가·
을/를·이에요/예요·(으)로)를 헬퍼 우회해 하드코딩한 곳. **✅ 클린 — 발견 0**:
- 변동 조사 하드코딩 0(모든 변형 grep). 유일 매치=JournalSection 주석의 "{dogName}의"
  (`의`=받침 무관 불변 조사라 안전).
- josa 헬퍼(petName/withHonorific/josa) **33파일** 사용. 토스트 패턴 `${petName(dogName)}가`
  = 정답 설계: petName 이 받침 이름에 '이' 붙여 **모음 종결로 정규화** → 고정 '가' 항상 맞음.
→ 메모리 "이름 문법 규칙 전 UI 적용"·이전 감사 "josa 종결(#68)" 실증. 이름 문법 강점.
  (누적: 검사 8+2 축 대부분 클린. 실결정은 여전히 #A2·#A9 두 정본화 이슈에 집중.)

**[회차18 · 통화·숫자 포맷 일관성]** #6 축. 가격(원) 표시가 콤마 포맷을 일관되게
쓰는지 (raw 숫자 노출 안티패턴). **✅ 클린 — 발견 0**:
- 모든 "원" 표시가 `toLocaleString` 또는 `won()` 헬퍼 경유(order·plan·approve·
  subscriptions). raw 숫자+원 안티패턴 grep 2종 모두 0건.
- `won()`='ko-KR' 명시 / bare `toLocaleString()` = 숫자 천단위 콤마 동일 → 시각 결과
  일치(68,000원). 두 방식 혼재해도 표시 불일치 없음.
- kcal/g 무콤마(vs 원 콤마)는 메모리 #76 의 **의도적 컨벤션 결정** → 버그 아님.
→ 통화 포맷 정합. (참고: won() 헬퍼가 approve 에만 로컬 정의 — #A9 처럼 산개 소지
  있으나 결과 동일이라 위험 낮음. lib 공용화는 선택.)

**[회차19 · 날짜 표시 KST off-by-one]** #7 축. 서버 컴포넌트가 timeZone 없이 raw
Date 로 날짜를 포맷하는 곳(UTC→하루 틀림). **🟡 #A10 실버그 발견+즉시 수정**:
- ✅ **수정 `dogs/[id]/formulas/page.tsx:284`** `formatDateRange` 의 fmt 가 timeZone
  없이 `getMonth()/getDate()` → 서버(UTC)에서 시간성분 있는 입력이 하루 전날로 표시.
  입력 셋 중 `applied_from/until`(date-only)=안전하나 **폴백 `created_at`(timestamp)이
  위험**. 특히 **progression 크론이 KST 05시(=UTC 전날 20시)에 만든 pending 처방**의
  created_at 이 **하루 전날로 표시**됐다(TZ=UTC 재현: 7.18 처방→"7.17"). +9h 시프트
  후 UTC 파트 읽기로 수정(datetime-kst currentKstHour 와 동일 패턴, "M.D" 포맷 보존,
  date-only 불변). TZ=UTC 검증: 전 케이스 KST 정확. app-only·additive·tsc+eslint GREEN.
- 대조: `analyses/page.tsx:51` 은 **`timeZone:'Asia/Seoul'` 명시로 이미 정확**(모범).
  클라이언트 컴포넌트들(AnalysisView·DogDetail·Health·Reminders)은 브라우저=KST 라
  한국 사용자에 안전(비-KST 사용자만 미세 위험, 타깃 밖).
→ 서버측 raw-Date off-by-one 1건 잡음. (교훈: 서버 컴포넌트 날짜 포맷은 반드시
  timeZone:'Asia/Seoul' 또는 +9h 시프트 — 클라와 달리 UTC 라 자정 경계서 틀림.)

**[회차20 · 서버 날짜 포맷터 형제 전수]** #7 축. #A10 후속 — 다른 서버 컴포넌트의
raw Date 날짜 포맷을 전수 대조(off-by-one 은 형제가 있다). 서버 page.tsx 5곳 검사:
- ✅ 이미 정확(timeZone:'Asia/Seoul' 있음): `analyses:51`·`vet-report:177/314/334`·
  `membership:367`. → 대부분 모범적으로 timeZone 지정돼 있음.
- ✅ **수정 `reports/page.tsx:48` (#A11) timeZone 누락**: 월간 리포트 헤더
  `monthLabel = new Date().toLocaleDateString('ko-KR',{year,month})` 에 timeZone 없어
  **매월 1일 KST 00~09시(UTC 전월)에 지난 달로 표시**(TZ=UTC 재현: KST 8/1 03시→"2026년
  7월"). 형제들이 다 갖고 있는 `timeZone:'Asia/Seoul'` 한 줄 추가로 수정(월 중반 불변,
  TZ=UTC 검증). app-only·additive·GREEN.
→ 서버측 날짜 off-by-one 전수 완료: 실버그 2건(#A10 formulas·#A11 reports) 잡음,
  나머지 4곳은 이미 정확. **서버 날짜 timeZone 축 클린 종결.**

**[회차21 · 체중 입력 검증]** #7 축. 체중에 음수/0/비정상 입력이 급여량 계산으로
흘러가는지. **✅ 클린 — 하한 전 경로 보호**:
- NewDog/EditDog: `parseFloat(weight) <= 0` 명시 가드 + input `min="0" max="100"
  step="0.1"`.
- QuickWeightSheet(고빈도 스테퍼 진입): `WeightInputSheet:236` `Math.max(0.1, ...)`
  하한 클램프 → **0/음수 불가**. 더블탭 가드(submittingRef)도 있음.
- 최종 방어: nutrition.ts `Math.max(0.5, Math.min(100, weight))` 클램프(NaN/극단 차단).
→ 모든 체중 경로가 0/음수 차단. 검증 방식은 다르나(명시 vs 스테퍼) 둘 다 유효.
  (🔵 매우 낮음: QuickWeightSheet 스테퍼는 **상한 클램프 없음**[NewDog는 max=100].
   스테퍼로 100+ 도달은 비현실적 + 하류 클램프라 실질 무해. 일관성 위해 스테퍼에
   Math.min(100,...) 추가 검토 가능 — 선택.)

**[회차22 · 이메일 템플릿 정보 정합]** #4 축. 발송 후 못 고치는 이메일에 폐지 정보
(포인트·낱개커머스·옛 배송주기)·표시광고 리스크가 남았는지. **✅ 클린 — 발견 0**:
- 폐지 정보 잔재 0(포인트·적립·/products·낱개·4주·매달·무료배송·장바구니·위시리스트 grep).
- CTA 링크 전부 살아있는 라우트(/start·/dogs·/analysis·/mypage/orders·subscriptions·
  /track·/invitations + newsletter API). **/products·/cart 死링크 0** → 메모리 "이메일
  6개 /products 링크" 우려 **해소**.
- 표시광고 리스크 0: 효능/치료/완치/보장 단정 없음(유일 "보장"=발송 중복방지 기술 주석).
- 배송 주기: 8개 템플릿(orders·subscription·personalization-cycle·quarterly 등)이
  "정기배송" 일반 표현, 옛 4주/매주 없음 → 구독 모델 정합.
→ 이메일 축 클린. 구독전용·포인트폐기·연어제거·2주배송이 이메일까지 정합 롤아웃됨.

**[회차23 · 고객용 API 라우트 死엔드포인트]** #2 축. 만들어놓고 프론트가 안 부르는
API 가 있는지. 동적 라우트(`[id]`,`[token]`)는 `${id}` 템플릿 리터럴로 부르므로 고유
세그먼트로 재검증. **✅ 클린 — 새 死엔드포인트 0**:
- "호출처 0" 1차 플래그 10건 중 **9건은 동적 라우트 오탐**(실제 호출 확인):
  vet-share(ShareWithVetButton+이번세션 VetShareButton)·progress-photos(PhotosClient)·
  photo-request(PhotoRequestButton)·orders/cancel(CancelOrderButton)·dogs/invite
  (DogFamilyMembers)·addresses/[id]·default(AddressesClient·AddressForm)·tractive/disconnect
  (동적 provider fetch).
- **유일 진짜 고아 = `/api/orders/[id]/cancel-items`**(호출 0 재확인) — 이미 기록된
  낱개 커머스 부분취소 잔재([[project_legacy_sweep]]). 구독전환으로 도달 불가, Toss
  환불 로직 품어 결제 인접 → 무단 삭제 X, 사장님 확인 대기(신규 아님).
- 부수: 가족초대 invite API 는 DogFamilyMembers 가 호출 → **invite API 는 고아 아님**
  (#A6 는 /family '페이지' 진입점 문제이지 API 문제 아님 — 구분).
→ API 표면 잘 배선됨. 死엔드포인트는 기존 known 1건뿐.

---
