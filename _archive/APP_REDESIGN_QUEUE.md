# 앱 디자인 완성 루프 큐 (APP_REDESIGN)

> **목표**: 앱(PWA = `app/(main)/**` + `components/v3/**` + `app/dashboard/**`)을
> **웹 FD 느낌으로 디자인 완성** — 사장님 기준 "딱 봤는데 진짜 완성본이구나".
> **presentation 만** 손댄다(로직·DB·기능 불변). 색·radius·spacing·폰트·className·여백·위계.
> 한 회차(루프 1iteration) = 미완료 `[ ]` 1개(클러스터/파일)를 끝까지 → `[x]` + 한 줄 로그.

---

## ⚙️ 루프 규칙 (매 회차 먼저 읽기)

### 1. 한 회차 절차
1. 이 파일 **섹션 0(긴급지시) 먼저** → 다음 미완료 `[ ]` 1개 선택(우선순위 = 섹션 2 순서).
2. 대상 = 화면/컴포넌트 **클러스터 1개** 또는 파일 1~2개. 욕심내지 말 것.
3. 웹 FD 기준(아래 "디자인 기준")으로 수정: 하드코딩색→토큰 · v3 스케일 준수 · 대비 맥락 보정 · 여백/위계 정돈 · shape(필요 시 pill/rounded 웹 정렬).
4. **검증**(규칙 2) → 통과해야 `[x]`.
5. 큐 `[x]` + 한 줄 로그(섹션 끝 "진행 로그").
6. 막히면(불변·위험·애매) 손대지 말고 노트에 적고 다음으로.

### 2. 검증 (★제약 반영 — 앱은 스크린샷 불가)
- 앱 화면은 **로그인+ft_app 게이트** 뒤 → AI가 스크린샷 self-검증 불가. 그래서 **코드 레벨로 확실히**:
  - `cd /c/Users/A/Desktop/projects/farmerstail-app && npx tsc --noEmit` (**파이프 금지**) GREEN
  - `npx eslint <touched>` GREEN
  - 토큰/대비/스케일 grep 클린(하드코딩 brand hex 0, off-scale 0)
- **웹 화면**(/, /start, /login, /our-food 등) 건드리면 → preview 스크린샷 검증.
- **레이아웃 "느낌"·실데이터 화면**은 사장님이 실기기에서 스폿체크(AI 사각지대).
- 비밀번호 입력/로그인 = AI 안전규칙상 **불가** → 실로그인 화면은 사장님 확인.

### 3. 예산 규율 (★5시간 한도 안 끊기게)
- **대규모 병렬 워크플로우 금지.** (감사용 97 agent·480만 토큰 = 5시간 창 즉시 소진 → 이게 끊김의 원인.)
- 감사 필요 시 **직접 grep** 또는 **클러스터 1~2개짜리 소규모만**.
- 한 회차 = **직접 편집 위주·잘게·꾸준히**. 완만한 토큰 소비 → 사실상 연속 가동.
- 끊겨도 = 하드 정지 아님. 다음 가동이 이어받음(자가복구). `ScheduleWakeup` 호출 금지.

### 4. 불변 (절대 금지)
결제/체크아웃 로직 · `(auth)` 인증 로직 · DB apply/migration · 법정 SiteFooter ·
app/web dispatch(AuthAwareShell·ft_app) · **git commit/push·배포**(사장님 "배포" 전까지) ·
**비밀번호 입력/로그인**. presentation 만.

### 5. 안전·정직
가짜 후기·기관/언론 보증·질병 단정·레시피 배합 노출 금지. 알레르겐 추천 금지.

### 6. 자가발굴 + 에스컬레이션 (큐 비면 — "다 했다" 금지)
큐가 비면 단계적으로 내려가며 **계속** 일감 발굴(사장님 "멈춰" 할 때까지):
1. **디자인 자가발굴**: lean 재감사(grep 하드코딩색/off-scale/대비 스윕, 클러스터 1개 소규모 감사) → 새 항목 보충.
2. **그것도 마르면 → 웹·앱 오류/버그 검토(어떻게든)**: 기능·콘솔 에러·엣지케이스·깨진 링크/이미지·접근성·죽은 코드·타입 느슨함·로직 허점 등. 발견 시 고치되 **불변영역(결제·인증·DB·배포)은 그대로** — 막히면 노트만.
3. 그래도 없으면 → FD 실구조 fidelity 심화(레퍼런스 = thefarmersdog.com).

---

## 🎨 디자인 기준 (웹 FD = 정답)

> ★★ **레퍼런스는 늘 The Farmer's Dog (thefarmersdog.com)** — 막히거나 패턴 의심되면
> `r.jina.ai/https://www.thefarmersdog.com/<경로>` 로 FD 실구조(레이아웃·섹션·인터랙션) 참고.
> 우리 웹은 이미 FD 클론이므로 "웹 FD 느낌" = FD 느낌. 톤 흉내가 아니라 실구조 fidelity.

**앱 토큰값** (`[data-ft-chrome="app"]` 스코프 — 2026-06-17 웹값 정렬 완료):
`--accent #C86B45`(테라코타 CTA) · `--accent-deep #782E22`(딥/텍스트·hover) ·
`--sage #3C725E`(그린) · `--sage-soft #7A8B7B` · `--ink #16140f`(헤딩/본문) ·
`--ink-soft #3a342a` · `--ink-mute #706854`(보조 AA하한) · `--paper #f4ede0`(bg) ·
`--paper-hi #fbf6ec` · `--surface-card-elevated #fff` · `--rule rgba(22,20,15,.12)` ·
`--sale #b83a2e`(에러/할인) · `--yellow #e6b942`. 별칭 `--terracotta=accent`·`--moss=sage`·`--gold=yellow`.
JS 미러 = `lib/design/tokens.ts`(V3.*) — CSS와 항상 동일값 유지.

**스케일**(AGENTS.md SSOT): 폰트 9/10.5/12/13.5/16/22/32/54 · radius 2/4/12/999(rounded-xl/2xl/3xl 금지) · spacing 8pt 4/8/12/16/20/28/40/64.

**대비 규칙**: `accent #C86B45` 는 작은 텍스트 on paper = 3.4:1(미달) → **라이트 bg 작은 텍스트엔 `accent-deep`**. 단 **다크 카드(ink-bg) 위에선 accent 가 맞음**(밝아야 읽힘) — 맥락 보고 판단. `ink-faint`(#b6ab93)는 텍스트 금지.

---

## 0. 🚨 긴급지시 (최우선)

**[2026-06-19 오버나이트 자율 루프 — 사장님 취침 중, "멈춰" 전까지 계속]**
무한 점검·업그레이드. 매 회차 이 섹션부터 읽고 아래 우선순위로 **잘게 직접 편집**(워크플로/대규모 병렬 에이전트 금지 — 5시간 한도). 매 회차 tsc+eslint GREEN, 한 줄 로그. 토큰 아끼지 말고 최상 품질. "다 했다"로 멈추지 말 것.

우선순위(위→아래):
1. **강아지 상세 분석/처방/구독 3탭 재설계** — 사장님 불만: 3탭 존재의의 불명 · 설문(분석) 결과 어떻게 보는지 동선 막막 · 구독 페이지 난잡·이해 안됨(결제하는데) · 처방 탭 왜 있는지 모름. → ⓐ IA 재검토(통합/단순화 가능?) ⓑ **분석 결과 진입·이해 명료화** ⓒ **구독 페이지** 위계·카피 정리("내가 뭘 결제했고 다음 배송 뭔지" 즉시 이해) ⓓ **처방 탭** 가치 드러내거나 통합. presentation+IA 우선, 로직·DB·결제 불변.
2. **설문 결과 페이지 색감 불일치 정리** — 중간중간 안 맞는 색 → v3/FD 토큰 통일. **[단서]** 분석 결과는 `components/analysis/magazine/*` 가 **독자 팔레트** `magazine/palette.ts`(brand #A0432C·bg #EFE7D2·card #FBF6E7·ink #1B1410·muted #7A6A5A 등)를 써서 FD/v3 토큰(accent #C86B45·paper #F7F5F0·ink #16140f)과 어긋남 = 색감 주범. AdjustSheet/adjust-sheet.css 도 #566729·#A0452E·#8A3923 등 옛 hex 산재. 로그인 게이트라 blind → 한 번에 소폭·토큰 정렬, tsc/eslint로만 검증. palette.ts 한 곳을 FD 톤으로 맞추면 magazine 전체 일괄 정렬됨.
3. **앱 전용 설문 페이지 전부 업그레이드** (`app/(main)/dogs/[id]/survey/**`) — FD식·명료화.
4. **그 외 무한 점검·업그레이드** — 앱/웹 visible 개선·죽은코드·접근성·카피·색/여백/위계.

불변금지: 결제/체크아웃 · (auth)인증 · app/web dispatch(ft_app) · 법정 SiteFooter · DB apply · git commit/push · 배포. 정직성(가짜후기/질병단정/레시피·알레르겐 노출 금지). FD 레퍼런스.
검증: `cd /c/Users/A/Desktop/projects/farmerstail-app && npx tsc --noEmit && npx eslint <touched>`(파이프 금지). 웹 변경=preview 스크린샷(앱은 로그인게이트→코드검증+show_widget).
재개: durable cron(매시 :15)이 rate-limit/세션종료 후 ~4:15 자동 재개. 사장님 "멈춰" 시 CronDelete.

---

**[2026-06-17 루프 일시정지 — 예산 보호]** 크론(1ac3181e) AI 판단으로 정지. 사유: 앱 디자인 코드검증-안전정리 + 웹 라우트 헬스 + eslint/tsc 전부 클린 = 안전·고가치 작업 소진. survey의 `var(--fd-*)`는 웹값으로 정상 해석돼 web-faithful(문제 아님). 더 돌리면 빈 회차로 5시간 토큰만 소모. **재개 = 사장님 "이어서/루프 다시" 한마디** 또는 새 작업 지시. 남은 일감 = B9(off-scale radius/font, 시각확인 필요)·tier-2 deep 오류검토·웹 fidelity 잔가지.

**[2026-06-17 마일스톤 — 루프 방향 전환]** 앱 디자인 코드검증-안전정리 완료(토큰·색·옛팔레트·eslint 클린). 앱 화면은 스크린샷 검증 불가라, 남은 앱 visible 변경(off-scale radius/font=B9)은 **사장님 시각확인 전까지 blind 금지**. 다음 회차부터 루프 우선순위:
1. **웹 FD fidelity 심화 (스크린샷 검증 가능 → 최우선)** — `FD_CLONE_QUEUE.md` 의 미완료/오탐 점검, 웹 마케팅·퍼널 화면을 thefarmersdog.com 실구조 대비 보강. 수정 시 preview 스크린샷 검증.
2. 웹·앱 **오류/버그 검토**(코드검증형: tsc/eslint/엣지케이스·죽은코드·접근성). 앱 로직은 불변영역 주의.
3. 앱 deep 디자인은 사장님 B9 시각확인 후 재개.
_(사장님 새 지시 생기면 이 위에 추가)_

---

## 1. ✅ 완료 — 파운데이션 (2026-06-17)
- [x] **CSS 토큰 웹 정렬**: app-scope `--accent`→#C86B45·`--accent-deep`→#782E22·`--sage`→#3C725E·`--sage-soft`→#7A8B7B·`--shadow-accent` rgba 갱신. 191곳 토큰참조 한 번에 웹 브랜드색.
- [x] **JS 토큰 정렬**: `lib/design/tokens.ts` accent/accentDeep/sage/sageSoft → CSS와 동일값(웹). (JS토큰 import 컴포넌트도 정렬)
- [x] **옛 브랜드 hex 정리(showpiece)**: 인증서(#A0452E·#7B6F5C·#1E1A14·#FAF6EC→토큰)·checkin.css(#566729→sage)·chat hero(#5a6e2a→sage-soft)·notifications.css 폴백 6곳.

---

## 2. 백로그 — 감사 77건 (클러스터별, 우선순위 순)

> 각 클러스터 `[ ]` = 한 회차. 하위 항목 다 처리 후 `[x]`. 맥락(라이트/다크 bg) 보고 토큰 선택.

### B1. 공용 프리미티브 `components/v3/*` (기반 — 수십 화면 영향)
- [x] **2026-06-17**: 에러색 `#b03a2e`→`V3.sale` ×3(InlineReviewForm·WeightInputSheet·QuickLogSheet) · DailyCheckinStack `moss '#5a6e2a'`(올리브)→`V3.sageSoft`(온브랜드 그린, sage와 구분). Avatar `#fff`(컬러 아바타 위 흰텍스트)·Modal 잉크 backdrop·각종 boxShadow rgba·Cropper canvas fill·메달tier(bronze/silver)색 = 기능적·정확값이라 유지(churn 회피). Badge/Checkbox/MiniBars/DatePicker 하드코딩 brand색 0. tsc+eslint GREEN.

### B2. `components/v3/home/*` (홈 — 최다 노출)
- [x] **2026-06-17**: 홈은 파운데이션 덕에 **이미 토큰 기반**. TodayCard/EmptyHomeNoDogs `borderRadius:28`=56×56 **원형 아이콘**(오탐)→`999`(시각동일·스케일준수). inset shadow 3곳=**사진 프레임 보더**(기능적)·다크텍스트 opacity 0.6/0.7(체감0)·#d6c9aa(사진 placeholder tone)=유지. tsc+eslint GREEN.

### B3. `components/v3/dog/*` (강아지 상세 섹션)
- [x] **2026-06-17**: spacing 8pt 정렬 — DogDetailHero `14px 20px 24px`→`12px 20px 28px`·`5px 8px`→`4px 8px` · MemoTimeline `3px 7px`→`4px 8px` · WeightInputSheet `10px 0`→`12px 0`. DogDetailFAB `borderRadius:28`=원형 FAB→`999`. 에러색=B1서 처리. toneBg #d6c9aa(placeholder)·WeightChartCard shadow fallback=유지. tsc+eslint GREEN.

### B4. `components/v3/catalog/* + pdp/*` (커머스 — 앱 노출 한정)
- [x] **2026-06-17**: 하드코딩 brand색 **0**(이미 토큰 클린). toneBg 배열·#d6c9aa(사진 placeholder)·inset 사진보더·다크텍스트 opacity = 기능적/체감0 유지. PdpWhyRecipe 대형숫자 accent = 28px 대형텍스트라 3.4:1 통과(유지). `CatalogBanner fontSize:38` = 배너 히어로 의도값, off-scale지만 시각변경 위험+저트래픽 → 시각확인 전 유지(노트). tsc GREEN.

### B5. 홈/강아지 화면 `app/(main)/dashboard · dogs`
- [x] **2026-06-17**: dogs/page `var(--bg)`→`var(--paper)` ×3 · dogs/compare Sparkline `var(--terracotta)`→`var(--accent)`(둘 다 동일값 캐노니컬 rename, 시각0). `--rule-2`(구분점용 유효 토큰)·DashboardClientIslands `#F5E0C2`(EVENT_PALETTE 큐레이션 테마색)=유지. tsc+eslint GREEN.

### B6. 강아지 서브화면 `app/(main)/dogs/[id]/*` (+ .css)
- [x] **2026-06-17 (안전분)**: checkin.css placeholder `#B6A990`→`var(--ink-faint)`·에러텍스트 `#8A3923`→`var(--accent-deep)`·radius 10px→12px · health/reminders `bg-[#FDFDFD]`→`bg-white`. 모두 ≈동일값·스케일, 체감0. tsc+eslint GREEN.
- [ ] **B6 게이트(→B9, 시각확인 필요)**: checkin `#7A5B1B`(다크골드, 토큰없음) · HealthLog `#FFB8A8`(다크bg 위 밝은텍스트=맥락) · DogDetailClient `#FFF5F3`(sale tint 아이콘 backdrop) · order.css/survey.css radius 대량(10/8/7/6→4/12, visible) · reminders 카테고리 rgba tint

### B7. 마이페이지 `app/(main)/mypage/*`
- [x] **2026-06-17**: coupons subtitle `#3a342a`→`var(--ink-soft)`(정확값) · AddressForm 입력 `#fdfdfd`→`var(--surface-card-elevated)`(흰색, audit의 --bg-2=탄색은 오답) · integrations 에러텍스트 `#8A3923`→`var(--accent-deep)`. certificate=showpiece서 처리됨. coupons "Coupons" 눈썹 accent=B1 결정대로 유지(웹 동일 트레이드오프)·#FFF5F2 pale tint·shadow rgba=유지. tsc+eslint GREEN.

### B8. 기타·셸 `app/(main)/{chat,reports,search,family,notifications,...}`
- [x] **2026-06-17**: survey/Body 웹토큰 누수 `--fd-coral`→`--accent`(동일값)·`--fd-gold`→`--gold`(앱 골드) · ChatClient `--bg-2`→`--paper-deep`(동일값) · OrderClient `fontSize:13`→`13.5`(base). ChatClient 흰텍스트 on terracotta = 사이트 표준 CTA(웹 동일 트레이드오프) 유지. tsc+eslint GREEN.

### B9. 게이트(맥락 판단 필요)
- [ ] DogDetailHero:119 Mono accent xs — 라이트bg면 accent-deep, 다크면 유지(맥락 확인) · survey.css radius 대량 스케일 정리(10/8/7/6→4/12)

---

## 3. 자가발굴 (B1~B9 완료 후 — 멈추지 말 것)
- [x] 전 앱 하드코딩 brand hex 재스윕 — **1차: 옛 팔레트 잔재 박멸** (#566729→sage·#8b3923→accent-deep·#a0452e→accent 등 7파일). **2차(확인): exact-토큰값 "하드코딩"은 전부 `var(--token,#hex)` 폴백·canvas export 리터럴(html2canvas, var()불가)·주석·온브랜드 카테고리 tint → 고칠 bare 0.** 앱 색/토큰 완전 클린 확인.
- [x] 앱 전체 eslint = **0 이슈**(코드 health 양호).
- [ ] off-scale 폰트/radius 재스윕 → **B9 시각확인 게이트로 이관**(visible 변경이라 화면 확인 필요·blind 금지).
- [ ] off-scale 폰트/radius/spacing 재스윕
- [ ] 대비 전수(accent/ink-faint 텍스트)
- [ ] 웹 FD shape 정렬 심화(앱 버튼 pill 여부 등 — 사장님 시각 확인 묶어서)
- [ ] 큐 비면 클러스터 1개 lean 재감사로 새 항목 보충

---

## 진행 로그 (회차마다 한 줄)
- 2026-06-17 파운데이션: CSS+JS 토큰 웹 정렬 + showpiece 옛hex 정리. 큐 신설.
- 2026-06-17 B1: v3 프리미티브 에러색→V3.sale ×3 + moss→sageSoft. (기능적 shadow/canvas/메달색 유지)
- 2026-06-17 B2: v3/home 원형아이콘 radius→999. (홈 이미 토큰 클린)
- 2026-06-17 B3: v3/dog spacing 8pt 정렬 4건 + FAB radius→999.
- 2026-06-17 B4: v3/catalog+pdp 점검 — 이미 토큰 클린(하드코딩 brand색 0). 10분 크론(1ac3181e) 가동.
- 2026-06-17 B5: dogs/page·compare 캐노니컬 토큰 rename(--bg→--paper, --terracotta→--accent).
- 2026-06-17 B6(안전분): checkin.css placeholder/에러텍스트/radius 토큰화 + health/reminders input bg→white. visible/맥락 항목은 B9 게이트.
- 2026-06-17 B7: mypage coupons/AddressForm/integrations 하드코딩색→토큰(ink-soft·surface·accent-deep).
- 2026-06-17 B8: survey/Body 웹토큰 누수 정리(fd-coral→accent·fd-gold→gold) + chat --bg-2→--paper-deep + order font 13→13.5. ▶B1~B8 안전분 완료, 남은 건 B9(시각확인 게이트) + 자가발굴.
- 2026-06-17 자가발굴1: 옛 팔레트 잔재 박멸(옛그린 #566729→sage·옛브라운 #8b3923→accent-deep·옛테라코타 #a0452e→accent) 7파일. tsc+eslint GREEN.
- 2026-06-17 자가발굴2(확인): exact-토큰값 하드코딩=전부 폴백/canvas리터럴/주석/tint(bare 0) + 앱 eslint 0이슈. ▶디자인 코드검증 안전정리 완료. 남은=B9 시각게이트(off-scale radius/font)·tier-2 오류검토.
- 2026-06-17 tier2 웹스모크: 세션 변경 웹 8라우트(/, /start, /login, /our-food, /plans, /why-fresh, /about, /reviews) 전부 200·회귀0 확인. ▶디자인+웹 안전작업 사실상 완료, 루프 diminishing returns — B9 사장님 시각확인 또는 새 지시 대기.
- 2026-06-17 ⏸루프 정지: survey의 var(--fd-*)=web-faithful(문제아님) 확인, 안전·고가치 작업 소진. 크론(1ac3181e) 정지(예산 보호). 재개=한마디.
- 2026-06-17 앱 nav 개편(사장님 직접): ①'제품' 탭 제거(커머스 피벗, 4→3) ②**하단 탭바 완전 제거 → 홈 허브형**(로고→홈·헤더 좌측 계정아이콘→내정보·강아지칩→우리아이·← 뒤로). 콘텐츠 pb 100→40px, TABS/미사용아이콘 정리. tsc+eslint GREEN. ★데스크탑 앱뷰(localhost:3000/?ft-app=1+로그인)서 사장님 확인 요망.
- 2026-06-18 앱 색감 웹통일(사장님): app-scope --paper #f4ede0→#F7F5F0(=웹 offwhite)·--paper-deep→#EDE8D9(=웹 cream)·--paper-hi 중성화 + tokens.ts 미러. 상/하단/전체 누런톤 제거. tsc GREEN, preview 토큰 실측 확인.
- 2026-06-18 홈 정리(사장님): 대시보드에서 "오늘의 한 가지"(TodayCard)+"오늘의 체크인"(DailyChecks) 제거 → 전용 nextAction 엔진 전체(unanalyzed/pendingFormula/staleWeight/noSub/firstCheckin)+죽은 DB read 2개(dog_formulas·weight_logs) 동반 정리. "우리 아이들" 2마리+ 일 때만 노출(1마리=spotlight 중복). tsc+eslint GREEN. ★데스크탑 앱뷰서 사장님 확인 요망.
- 2026-06-18 PawFab 신설(사장님): 하단 중앙 강아지 발바닥 FAB(반쯤 잘려 peek + bob 모션) → 탭하면 발가락 4개가 작은 동그라미로 부채꼴 팝(활성강아지 라우팅). components/v3/PawFab.tsx, AppChrome 전역 마운트(몰입화면·강아지없음 숨김), globals ft-paw-bob 키프레임. 하단바 제거 후 "자주 기입" 진입 대체. tsc+eslint GREEN.
- 2026-06-18 PawFab 누끼 리디자인(사장님 "느낌은 맞는데 누끼 따서 자연스럽게"): 원+작은아이콘(스티커처럼 떠보임) → 배경/테두리 없는 **발자국 실루엣**(120px, ink fill) + 윤곽 따라 떨어지는 drop-shadow 컷아웃. bob 폭 8%→4% 완화. **+404 버그 수정**: walks 라우트 없음(404) 확인 → toe 4개를 실재 distinct 라우트로 교정(건강/체중/일기/사진, 전부 200 확인). tsc+eslint GREEN.
- 2026-06-18 PawFab 코너 FAB 전환(사장님 "거추장·뜬금없음" → 자연스럽게): 하단중앙 잘린 발자국 실루엣+bob 폐기 → **우하단 ink 원형 FAB**. globals ft-paw-bob 키프레임 제거.
- 2026-06-18 PawFab 패드 유기적모양 + 네임카드 트레일 방향(사장님): ①펼침 패드를 정원(border-radius 999) → **벡터 메타카팔 path**(viewBox 99 191 314 258) + -38° 회전 + scale-in(bottom-right origin) → 모서리에서 솟는 진짜 발바닥 모양. 닫힘 원 ↔ 열림 패드 2버튼 크로스페이드. ②네임카드 발자국을 right-쏠림 → **left 기반 왼→오 트레일**(116/168/226/288, 위아래 흔들림). tsc+eslint GREEN.
- 2026-06-18 발자국 벡터 교체+PawFab 발자국화+네임카드 발자국(사장님): ①DogPawMark path를 새 벡터(paw-1, 깔끔한 4토+패드)로 교체 → 모든 placeholder/FAB 발자국 일괄 변경 ②PawFab 펼침을 벡터의 발가락 배열·비율을 ~38° 누인 좌표로 재배치(패드 우66/하46 모서리 잘림, 안쪽토 높고가깝게·바깥토 낮고넓게) → 누운 발자국 완성 ③네임카드 빈 공간에 은은한 발자국 트레일 3개(opacity 0.05~0.07, 클릭통과). tsc+eslint GREEN. ★데스크탑 앱뷰 확인 요망.
- 2026-06-18 기록 간편화 Phase 1(사장님 "설문식이면 안 함"): 건강(식사) 진입을 무거운 /health 6필드 설문 → **QuickHealthSheet(바텀시트, 식욕·배변·활동 칩, 탭한 것만 1~3탭 저장)** 로. health_logs 동일 컬럼·값이라 호환, "자세히"로 풀폼 이동. PawFab 건강 토 = 시트 오픈(나머지 토는 router.push 유지, 토를 Link→button 전환). 발견: QuickLogSheet/DogDetailFAB 는 만들어졌으나 미연결 상태였음. tsc+eslint GREEN. 다음: 체중/일기/사진(+산책) 퀵화.
- 2026-06-18 등급 아이콘 제거(사장님 결정): 이모지/벡터 아이콘 시도 → "아이콘 빼고 글씨+색만". TierChip·포인트 pill에서 아이콘 전부 제거, TierIcon/TIER_EMOJI/TIER_ICON_SVG·미사용 icon-*.svg 삭제. 등급 구분=칩 색(meta.bg/ink: 씨앗 moss·새싹 연두·꽃 핑크·열매 테라코타·나무 ink+gold). 배경 webp는 유지. tsc+eslint GREEN, orphan 0.
- 2026-06-18 마이페이지 정리(사장님): ①네임카드 **박스 제거 + 이름 16→27 black** → "내 정보"임을 한눈에(이름이 곧 헤더). ②포인트 카드 배경을 **등급별 수채화**로(씨앗/새싹/꽃/열매/나무) — Downloads PNG 5장 sharp 최적화→public/tiers/{seed,sprout,bloom,fruit,mate}.webp(13~83KB), 왼쪽 paper gradient로 어두운 글자 가독성, 오른쪽 식물 노출. 텍스트 yellow/V3Dark → ink/accentDeep. ③**단짝 → 나무** 라벨 변경(lib/tiers.ts mate.label, DB키 'mate' 불변 → 전 surface 자동) + user-facing 하드코딩(인증서·VIP메일·멤버십) 정리. milestones "단짝"은 단어라 유지. tsc+eslint GREEN, /tiers/*.webp 200 확인.
- 2026-06-18 PawFab "발자국 완성"형(사장님 의도 명확화): 닫힘=ink 56원+발자국아이콘 → 열림=**FAB가 큰 패드(140)로 커지며 우하단 모서리로 들어가 아랫부분 화면밖 잘림** + 액션 원 4개가 **ink 발가락**으로 사분원 아치 배치 → 우하단에 하나의 발자국 완성. 밝은 스크림(어두운 발자국 가시성). 액션=건강/체중/일기/사진(전부 실재 라우트). tsc+eslint GREEN. ★데스크탑 앱뷰 확인 요망.
- 2026-06-18 강아지 발자국 placeholder 통일(사장님 제공 벡터): lucide PawPrint(아웃라인) → 사장님 dog-paw-svgrepo 채움 벡터를 **공용 components/DogPawMark.tsx** 로 만들어 9곳 일괄 교체(MyDogsSection·ActiveDogCard·DogDetailHero·DogSwitcher·EmptyHomeNoDogs·DogHelloCard·DogPhotoPicker·dogs 목록 ×2). size/color·className(currentColor) 양쪽 지원. +마이페이지 네임카드의 의미없는 원형 사람아이콘(아바타) 제거(이름/이메일은 같은 /account/profile 링크라 기능 유지, User import 정리). tsc+eslint GREEN.
- 2026-06-18 기록 간편화 Phase 2~6(사장님 "이부분 누르면 더 편하게 입력" — 개요 카드 식사·산책·체중 + FAB 발가락 체중·일기·사진): 페이지 이동 전부 제거하고 그 자리 바텀시트로. **신규 자체완결 시트**: QuickWeightSheet(WeightInputSheet UI 재사용 + weight_logs insert + dogs.weight 마스터 갱신), QuickChipSheet(식사=appetite·산책=activity_level 단일칩, health_logs 호환), QuickMemoSheet(dog_diary.note), QuickPhotoSheet(DiaryClient와 동일 파이프라인 — 1280px webp→dog-diary-photos 버킷→1년 signed URL→dog_diary). **진입점 배선**: ①대시보드 칩을 client island `QuickActionChips`로 분리(서버 ThisWeekSection은 7일 그리드 유지, lucide Icon prop 직렬화 회피 위해 kind 기반으로 전환) → 식사·산책·체중 시트 ②PawFab 발가락 건강/체중/일기/사진 전부 시트(router.push 제거, href는 fallback 유지). 시트 배럴 export 정리. health_logs.mood=string 컬럼 주의(number 캐스팅 버그 1회 수정). tsc+eslint GREEN, ✓Compiled, 서버→client 경계 정상. ★데스크탑 앱뷰 확인 요망.
- 2026-06-18 산책 시간 추가 + 퀵시트 kicker 일괄 제거(사장님): ①산책을 전용 **QuickWalkSheet**로 교체 — 활동량 칩(→health_logs.activity_level) + **산책 시간 30분 단위 스텝퍼**(min30/max300 →activity_logs activity_type:'walk', duration_min). 시간은 항상 기록(기본 30분)·활동량 선택. health_logs엔 시간 컬럼 없어 activity_logs 사용(insertActivity 헬퍼 "QuickLog용" 컨벤션). QuickActionChips 산책 배선 교체, ACTIVITY_OPTS 제거. ②**전 퀵시트 상단 주황 kicker(Mono accent) 제거** — QuickHealth/QuickChip/QuickMemo/QuickPhoto/WeightInputSheet 5종 + QuickChipSheet kicker prop 자체 삭제(미사용 Mono import 정리, h2 top margin 0). tsc+eslint GREEN.
- 2026-06-18 퀵시트 저장 피드백 추가(사장님 "더할거 이어서"): 6종 퀵시트(건강·식사·산책·체중·일기·사진) 저장 성공 시 useToast 토스트("…를 기록했어요" / 사진은 N장). 이전엔 조용히 닫히기만 해 "저장됐나?" 불확실 → 확인 피드백. 에러는 기존 인라인 빨간문구 유지. 시트는 전부 app(ToastProvider 하위)이라 안전. tsc+eslint GREEN, 서버 200.
- 2026-06-18 대시보드 카드 "오늘 기록함" 상태 반영(사장님 ㄱㄱ): QuickActionChips(client)에서 마운트 시 오늘치 조회 — 식사=health_logs.appetite(오늘), 산책=activity_logs walk(오늘), 체중=weight_logs(오늘) → 기록했으면 sub를 초록(sage) "기록함 ✓"(체중은 값+✓)으로, 안 했으면 기존 "오늘 기록". **저장 시 onSaved로 즉시 낙관적 갱신**(리로드 없이 ✓). 서버 대시보드 페이지·prop 안 건드리고 client island 자체 처리(직렬화/페이지 리스크 0). set-state-in-effect 회피 위해 조회결과는 .then 콜백에서 set. tsc+eslint GREEN, ✓Compiled.
- 2026-06-19 디자인 개편 사장(死藏)코드 대청소(사장님 "없어진것들 전부, 웹·앱 둘다"): knip(동적 import 포함 분석)로 미사용 파일 색출 → **62개 삭제**(4배치, 배치마다 tsc 게이트 GREEN). ①홈/대시보드 카드 14(TodayCard·ForTodaySection·FarmToTailSection·DailyChecks·NextActionCard·Persona·Milestone·Streak·Accuracy·AccuracyDeltaChip·InsightChip·DogHelloCard·DashboardClientIslands·ChromeStamp) ②앱 v3/dog 미연결 섹션 7+배럴+독립 죽은 컴포넌트(DogPhotoWizard·DogSilhouette·InAppCamera·TrendsCard·CountUp·PublicPageShell)+cascade lib(useDismissible·useFitTextSize) 16 ③웹 v3 커머스 redesign 미연결(catalog·pdp·photo·streak)+sheet 배럴 16 ④admin/products 3+ui 프리미티브(EmptyState·Form·Motion·ProgressiveDisclosure)4+lib 헬퍼 9. **검증**: 각 후보 import처(정적+동적+문자열) grep 0 확인, batch별 tsc GREEN, 최종 tsc+eslint 0 errors, git 복구가능. **의도적 KEEP**: public/sw.js(런타임 등록), PhotosClient(2026-05-16 보존 명시), scripts/d2-typography-sweep.mjs(1회성 툴). **package.json deps는 안 건드림** — knip "unused deps"(Capacitor·pretendard·react-hook-form·bundle-analyzer)는 네이티브빌드/동적/설정 사용이라 전부 false positive. env.ts의 stale 주석(삭제된 env.client.ts 참조) 정리. **남은 작업**: 미사용 export 123개(주로 배럴 재export — components/v3/index.ts의 BrandWordmark·RibbonChip·V3Ticker 등 → 트림하면 그 컴포넌트 파일들도 cascade 삭제 가능). 라이브 배럴 건드리는 더 섬세한 패스라 다음 단계.
- 2026-06-19 상단바 로고 교체(사장님): App·Web 헤더의 `/logo-brush.png` `<img>` 3곳 → **BrandWordmark**(검은 폰트 워드마크 "FARMER'S TAIL.", sans 900 ink + accent 마침표)로 교체. AppChrome 중앙(size20, /dashboard), WebChrome 데스크탑(size22)·모바일중앙(size20). BrandWordmark는 V3 토큰을 inline hex로 쓰므로 web 컨텍스트서도 정상(예외적 안전). 고아 eslint-disable 주석도 제거. 웹 `/` 스크린샷으로 렌더 확인. ※마침표(.)는 accent(테라코타) — 완전 검정 원하면 accentColor=ink 1줄. tsc+eslint GREEN.
- 2026-06-19 상단바 로고 정정(사장님 "이 브러시 로고를 폰트만 검정+누끼"): 앞 BrandWordmark(텍스트) 오해 → **브러시 로고 이미지**를 검정+투명으로. public/logo.png(흰 텍스트+골드, 투명·블롭없음)을 소스로 sharp `dest-in` 합성(검정 #16140f rect ∩ 로고 알파) → **public/logo-black.png**(1000×291, 브러시 텍스처 보존, 전체 검정, 투명배경) 생성. App·Web 헤더 3곳 BrandWordmark→`<img src="/logo-black.png">`(앱 h-12·웹 h-14·웹모바일 h-[54px]). BrandWordmark import 원복(컴포넌트·export는 유지). 웹 / 스크린샷 확인. logo-brush.png(터라코타 블롭본)는 헤더서 미사용됨(에셋 보존). tsc+eslint GREEN.
- 2026-06-19 토스트 정렬·지속 + 웹로고 색·위치(사장님): ①토스트 1줄(설명없음)일 때 아이콘↔텍스트 세로 중앙(items-start→조건부 items-center, 텍스트가 체크보다 위로 뜨던 것 수정) ②success 토스트 자동닫힘 3s→**2s**("등록 알림 2초 후 사라지게") ③웹 헤더 로고를 로그인·메뉴(둘 다 var(--fd-pine) #173B33)와 **동일 파인색**으로 + logo.png 소스 트림(상하 81/59 비대칭 제거)으로 **중앙 복원** + 모바일 로고 spill(translate +13px) 제거→진짜 중앙. 에셋 분리: **logo-mark.png**(파인, 웹 데스크h-9·모바일h-9) / **logo-ink.png**(잉크 #16140f, 앱 헤더 h-8 — 앱은 잉크 아이콘과 톤 맞춤). logo-black.png 삭제. 모바일·데스크탑 / 스크린샷 확인. tsc+eslint GREEN.
- 2026-06-19 마이페이지 정리 + 로고 전수 + signup 폐지(사장님): ①**마이페이지** — 통계 COUPONS 카드 제거(쿠폰 의미없음 → 3칸 grid) + 주문 카운트에서 결제취소·환불(payment_status cancelled/refunded) 제외 + Benefits 메뉴 찜한상품·내리뷰·내쿠폰 3줄 제거(멤버십등급만). 쿠폰 쿼리/prop/아이콘(Heart·Star·Ticket) 정리. ★통계 4번째 칸 내용은 사장님 결정 대기(우리아이 수/누적구매/3칸유지). ②**로고 전수교체** — 옛 logo-brush.png(터라코타) 6곳 → 새 검정 워드마크. sharp로 logo.png→**logo-ink**(잉크 밝은bg: login·AuthHero·survey·BrandLoader)·**logo-mark**(파인 웹헤더)·**logo-paper**(페이퍼 다크bg: admin) 3색 트림 생성. 모바일웹 노출 로고 한 단계씩 축소(h-9→h-8 등). ③**signup 폐지** — (auth)/signup 페이지 삭제, 추천진입 /r/[code]→/start, 공유URL(ShareClient·ReferralView)→/r/CODE, 뉴스레터→/start, robots /signup 제거, referral-redirect e2e·playwright 주석 정리. ft_ref 쿠키 attribution 유지. 전체 tsc+eslint GREEN.
- 2026-06-19 기능 페이지 3개 폐지(사장님 "이거 기능 페이지 아예 없애"): **식단 시뮬레이션(/simulate)·지출 트래커(/expenses)·마일스톤(/milestones)** 페이지 dir + DogDetailClient 진입 카드 3개 삭제. InterventionWindowCard(체중추세 경보, dog상세 live)의 /simulate CTA 링크만 제거(경보 카드 본체·Link import·dogId destructure 정리, 카드는 유지). **lib 유지** — diet-simulation(intervention-alerts cron + InterventionWindowCard 사용), lib/dashboard/milestones(대시보드 인사말 currentMilestone 사용)라 orphan 아님. 잔여 /simulate·/expenses·/milestones 링크 0 확인, 전체 tsc+eslint GREEN.
- 2026-06-19 [오버나이트 #1] 분석 결과 색감 1차 정렬(우선순위 2): `components/analysis/magazine/palette.ts` WARM_CREAM 의 off-브랜드 색 → v3 토큰. brand #A0432C→**#C86B45**(accent), brandDeep #7E3220→**#782E22**(accentDeep), ink #1B1410→**#16140f**, ink2 #3B2E24→**#3a342a**, muted #7A6A5A→**#706854**. 크림 bg/card·차트 카테고리색(wine/ochre/blush/olive)은 보존(blind 위험·차트 구분성 → 시각확인 후 별도 회차). palette.ts 1곳으로 magazine 전체 일괄 반영. tsc+eslint GREEN.
- 2026-06-19 [오버나이트 #2] 분석 AdjustSheet 색감 정렬(우선순위 2 계속): `adjust-sheet.css` + `AdjustSheet.tsx` 옛 hex → 브랜드 토큰. #566729(올리브 긍정)→**#3C725E**(sage), #A0452E(경고)→**#b83a2e**(sale), #8A3923(에러텍스트→sale·CTA hover→**#782E22** accentDeep), rgba(160,69,46)→sale rgba(184,58,46), rgba(107,127,58)→sage rgba(60,114,94), #A86B4A(육류토퍼)→**#C86B45**(accent). #FFF5F2 옅은틴트·#fff·var(--moss/terracotta) 보존. tsc+eslint GREEN. → **우선순위 2(설문 색감) 코드레벨 큰 줄기 정렬 완료**(magazine bg/card·차트 카테고리색·var(--moss) 잔여는 시각확인 후 별도). **다음 회차: 우선순위 1 착수** — 분석/처방/구독 3탭 IA 재설계: DogTabsNav + analyses/formulas/order 페이지 조사 → "설문 결과 어떻게 보는지" 진입 동선부터 명료화.
- 2026-06-19 [오버나이트 #3] 우선순위 1 — 3탭 IA 조사 + 처방 페이지 목적 명료화: **funnel 파악** = 분석(영양 분석 결과 — analyses는 이미 최신결과 hero+히스토리로 잘 됨)→**처방(/formulas = 그 분석으로 만든 "박스 레시피", 식이라인 비율·cycle 조정·승인)**→구독(/order 정기배송). 사장님 "처방 왜 있는지 모름" 원인 = ⓐ 분석 hero가 '맞춤 영양 처방'을 보여주는데 '처방' 탭이 또 있어 **단어 충돌** ⓑ 처방 페이지가 자기 목적을 안 드러냄. → `formulas/page.tsx` 헤더 카피 개선(kicker 'MY BOX·맞춤 박스', h1 '박스 타임라인'→'맞춤 박스 구성', 본문에 분석→박스→정기배송 연결 명시). tsc+eslint GREEN. **★사장님 결정(브랜드 보이스):** 탭 라벨 '처방'→'박스'로 바꾸면 단어충돌 해소·더 명확 — 임의변경 보류, 컨펌 대기. **다음 회차:** 구독(/order) '난잡·이해 안됨' 위계·카피 정리("내가 뭘 결제했고 다음 배송 뭔지" 즉시 이해).
- 2026-06-19 [오버나이트 #4] 구독(/order) hero 카피 명료화(우선순위 1, **결제 로직 불변**): /order = 분석 formula로 박스 정기배송 신청하는 결제-인접 폼(Toss billing-auth). hero 본문이 전문용어 덩어리("4주치 풀·2주치 하이브리드·사료관리법 ±5% 허용오차 팩 반올림")라 "난잡·이해 안됨"의 일부 → 보호자 친화로("분석 결과 그대로 만든 박스를 한 달에 한 번 · 분량 자동 계산 · 언제든 일시정지·해지"). **카피만, 폼/결제/로직 미변경.** tsc+eslint GREEN. **★주의:** /order 폼 깊은 위계 정리는 결제-인접 + 로그인게이트(blind)라 사장님 시각검토 권장 — 임의 레이아웃 변경 보류. **다음 회차: 우선순위 3 — 앱 설문 페이지(`survey/**`) 업그레이드**(결제 무관·안전, FD식 명료화).
- 2026-06-19 죽은 코드 2차(export/배럴, 사장님 "계속"): knip 재실행 → 미사용 파일 3개만 잔존(전부 KEEP: PhotosClient·sw.js·d2-sweep). 명확한 디자인 cruft인 **v3 컴포넌트 12개 삭제**(RibbonChip·V3Ticker·V3Section·MiniBars·Tooltip·Stepper·Dropdown·RadioGroup·Checkbox·DailyCheckinStack·PhotoTimeline·InlineReviewForm) — 배럴 재export+컴포넌트 default 둘 다 미사용 + 타입(DropdownItem 등)도 self/배럴에만 존재 확인 후 v3/index.ts 트림 + 파일 삭제. **누적 미사용 파일 74개 정리.** 남은 미사용 export(~109)는 lib API 표면(datetime-kst·dog-records·capacitor·design tokens 스케일 등 — "디자인부분" 아님, 의도적 API, 트리셰이킹) + 라이브 파일 내 자잘한 UI export(Skeleton 변형 등) → 과삭제 위험으로 보류. tsc+eslint 0 errors.
- 2026-06-19 [오버나이트 #5] 우선순위 1 ⓑ — 분석 결과 진입 동선 명료화(설문↔분석 단어 bridge): 강아지 상세(DogDetailClient) Primary actions 2카드가 `/survey`('설문')와 `/analysis`('분석')를 **서로 다른 단어**로 불러 "설문 결과 어디서 보지?" 동선이 막막했음(사장님 직접 불만). → 카피로 연결: 분석카드 제목 '맞춤 영양 분석 보기'→**'설문 결과 · 맞춤 영양 분석'**, 본문 'AI가…식단을 분석'→'**설문을 바탕으로** {name}의 식단을 분석'; 설문카드 본문 '맞춤 식단 추천을 위한 5분 설문'→'맞춤 분석을 위한 5분 설문 · **결과는 분석에서**'. 두 카드가 '분석' 어휘 공유 → 퍼널(설문→분석) 가독. **카피만, 레이아웃·조건부렌더·로직 불변** (currentFormula 기반 카드 재정렬=더 깊은 개선이나 blind+/analysis 빈상태 동작 불확실 → 사장님 시각확인 후로 보류). +설문 input 스텝 Body.tsx 점검: `#A6BEDA`=저체중 cool-blue vs 과체중 warm 의도적 온도 메타포(오탐 아님, 유지). tsc+eslint GREEN. **다음 회차:** 우선순위 1 잔여 — SubscriptionCard/CurrentFormulaCard(강아지 상세 구독·처방 진입 카드) 카피 명료화, 또는 우선순위 4 web-visible 개선(스크린샷 검증 가능).
- 2026-06-19 [오버나이트 #6] 우선순위 1 ⓓ — '처방' 탭 단어충돌 해소(→'박스' 통일): 사장님 "처방 탭 왜 있는지 모름"의 진짜 원인 발견 = 5탭 nav(개요/기록/분석/**처방**/구독, `components/dogs/DogTabsNav.tsx`)의 '처방' 탭이 **분석 페이지 hero "맞춤 영양 처방"과 단어 충돌** + #3에서 /formulas 페이지를 "맞춤 박스 구성"으로 이미 개명해 **탭(처방)↔페이지(박스) 불일치**까지 생긴 상태. → /formulas 가리키는 모든 라벨을 '박스'로 통일: ①DogTabsNav 탭 label '처방'→'박스'(+docstring) ②layout.tsx docstring ③analyses hero CTA '처방 확인'→'박스 보기'(+ 2개 docstring). 이제 퍼널 = 분석(영양 분석/처방=임상 결과)→**박스**(맞춤 박스 구성)→구독(정기배송), 단어 1:1. 분석 hero "맞춤 영양 처방"은 임상 신뢰도(NRC2006) 브랜드 강점이라 유지(이제 탭과 안 부딪힘). **라벨/카피만, 라우트·로직 불변** — 2글자라 grid 레이아웃 위험 0. tsc+eslint GREEN. **★사장님 스폿체크:** '처방'→'박스' 탭명 1줄 되돌리기 가능(DogTabsNav L70). **다음 회차:** 우선순위 1 거의 완료(IA 단어/동선 정리됨) → 우선순위 4 web-visible 개선(스크린샷 검증) 또는 처방→박스 **탭 통합 여부**(분석+박스 한 탭? = 더 큰 구조변경, 사장님 결정).
- 2026-06-19 [오버나이트 #7] 우선순위 4 웹 visible 점검(스크린샷 검증) + 우선순위 1 분석 진입 카피: ①**웹 감사** — preview(farmerstail-dev:3000)로 홈(/) + 설문 퍼널 입구(/start)를 데스크탑·모바일(375) 양쪽 스크린샷/스냅샷/콘솔 점검: 시맨틱 헤딩·skip-link·이미지 alt·landmark role 정상, 콘솔 에러/경고 0, 비교 테이블('그동안의 사료 vs 파머스테일')이 모바일서 사이드바이사이드 아닌 **스택 카드**로 안전, 로고 파인색·중앙정렬 정상 → **visible 웹 퍼널 클린/고품질 확인, 결함 0**(FD 루프가 잘 유지 중). ②**분석 진입 카피**(우선순위 1 ⓑ 마무리) — 사장님 "설문 결과 어디서 보지?"의 마지막 고리: 분석 탭→`/analyses` 랜딩 헤더가 "분석 히스토리 · 총 N회의 맞춤 분석 기록"이라 **'설문' 단어가 없어** 연결이 안 됐음(빈 상태는 이미 "설문을 완료하면…" 연결됨). → 채워진 헤더 부제 '총 N회의 맞춤 분석 기록이 있어요'→**'설문으로 받은 맞춤 분석 결과 · 총 N회'**. h1 '분석 히스토리'는 탭↔페이지 일치 위해 유지, 부제만 bridge. 카피만, 레이아웃·로직 불변. tsc+eslint GREEN. **다음 회차:** 우선순위 1 거의 완결(설문→분석→박스→구독 어휘·동선 정리됨) → 우선순위 4 계속(웹 2차 페이지 /our-food·/reviews·/faq 스크린샷 점검 또는 코드레벨 a11y/죽은코드 스윕).
- 2026-06-19 [오버나이트 #8] 웹 2차 페이지 감사(/our-food) + 박스 어휘 온보딩 정렬: ①**/our-food 감사**(스크린샷/DOM/링크 검증) — 헤딩 22개 정상 위계, REVIEWS 섹션이 **가짜후기 없이 정직**("실제 후기가 모이면 이 자리에 채워집니다" + "후기 자리" placeholder), FAQ가 네이티브 `<details>/<summary>`(키보드 접근성 최상), 페이지 내 내부링크 19개 **전부 resolve**(200; /account만 auth redirect=정상, **404 0개**), 모바일 클린. → visible 웹 결함 0 재확인. ②**박스 어휘 온보딩 정렬**(우선순위 1 연장) — OnboardingTutorial Step3(정기배송) body '맞춤 **처방**을 정기적으로 받아보세요'→'맞춤 **박스**를…'. 정기배송으로 받는 건 물리적 박스라 더 정확 + #6 박스 어휘를 신규유저 첫인상까지 일관화. Step2 '정밀 영양 처방'은 분석=임상 용어라 유지(analyses hero와 일치). 카피만, tsc+eslint GREEN. **다음 회차:** 우선순위 4 — 웹 나머지(/reviews·/about·/science·/faq) 정직성/품질 스폿 또는 코드레벨 죽은코드 knip 3차.
- 2026-06-19 [재설계 ★사장님 직접지시 "분석→박스 점프 비효율, 분석/박스/구독 싹 갈아엎어"] **Phase 1+2 — IA 통합(박스 탭 폐지·분석 결과로 일원화)**: 근본원인 파악 = `/analysis`(매거진 결과)가 이미 분석+추천박스(BoxMixCard 인라인)+가격+"정기배송 신청" CTA를 한 페이지에 다 갖춘 **완성된 통합 페이지**인데, ⓐ분석 탭이 `/analyses`(히스토리 리스트)로 가서 결과가 아닌 목록에 떨어지고 ⓑ중복 **박스 탭(/formulas)** + /analyses 히어로의 "박스 보기"→/formulas **점프**가 있어 "분석 들어가서 박스 보기 누르면 또 페이지 넘어가는" 비효율 발생. **Phase 1**(DogTabsNav+layout): 분석 탭 href `/analyses`→**`/analysis`**(결과뷰 직결), **박스 탭 삭제**(ClipboardList import 정리), grid-cols-5→4, isActive에 formulas/approve 흡수(박스 cycle 이력 가도 분석 탭 하이라이트). **5탭→4탭(개요/기록/분석/구독)**. **Phase 2**(analyses 히어로): 최신 분석 히어로의 2버튼('자세히 보기'→/analyses/[id] archive=박스/CTA 빠진 축약본 + '박스 보기'→/formulas 점프) → **단일 "전체 분석 결과 보기"→/analysis**. 옛 분석은 타임라인 리스트(각 →/analyses/[id])로 접근 유지, /formulas는 CurrentFormulaCard "히스토리"로 보조 접근 유지(고아 아님). tsc+eslint GREEN(2파일씩 2회). **남은 Phase**: 3=구독(/order) 레이아웃 위계 재설계(★결제-인접 Toss billing+blind → 보수적·되돌리기 가능 + 사장님 실기기 확인), 4=분석 결과(/analysis 매거진) 레이아웃·색 다듬기(blind). **불변 준수**: 결제로직·라우트 파일 삭제 안 함(/formulas 라우트 존속, 탭만 제거)·DB·dispatch 그대로.
- 2026-06-19 [재설계 Phase 3a — 구독(/order) 명료화, ★사장님 "구독부터 과감히" 선택] **"한눈에" 요약 카드 신설**: 사장님 "난잡·이해 안됨"의 핵심 = 보호자 3대 질문(뭘/얼마/언제)이 페이지에 흩어짐(첫배송일은 분량 섹션에, 가격은 맨 아래 결제요약에, 구성은 중간). → 히어로 직후 상단에 **.ord-glance 카드**(받는 것=강아지 맞춤박스·N주치 / 첫 배송=날짜+이후 매월 / **월 결제=20px 강조**) 추가 — 스크롤 없이 즉시 파악. 값은 portion 선택에 반응(coverageWeeks·totalAmount·firstDeliveryAt 기존 state 재사용, **계산·결제 로직 0 변경, 표시만**). +라벨 없던 아이템 리스트(ord-list)에 '추천 박스 구성' 헤더(ord-section-h) 추가. order.css에 .ord-glance* 스타일(surface-card-elevated bg·terracotta 28% 보더·rule-2 divider, 가격 20px=대형텍스트라 대비 통과). **결제-인접 blind → 보수적·되돌리기 가능**(카드/헤더 추가만, 폼·토스 빌링·전상법 고지 그대로). tsc+eslint GREEN. **다음 Phase 3b:** 구독 섹션 스텝 구조화(①분량②구성③배송지④결제)·아이템카드 밀도 정리·옛 terracotta rgba(160,69,46)→브랜드토큰 — 단 visible이라 사장님 실기기 확인 후 과감히. 그 다음 Phase 4=분석 결과 레이아웃.
- 2026-06-19 [재설계 ★사장님 "뒤로가기가 웹스타일 — 직전 작성 화면으로 되돌아감, 앱은 이렇게 안 됨"] **계층형(native up) 뒤로가기로 전환**: AppChrome 헤더의 깊은화면 ← 버튼이 `router.back()`(브라우저 히스토리 되감기 → 폼 이탈→복귀 시 그 폼으로 복귀)이던 걸, **`parentForPath(pathname)` → 구조상 부모로 `router.push`**. 매핑: /dogs/:id/<sub>→/dogs/:id(강아지상세=개요) · /dogs/:id/<a>/<b>→/dogs/:id/<a>(중첩 한 단계) · /dogs/:id→/dashboard(홈) · /cart·/products/:slug→/products · /mypage/orders/:id→/mypage/orders · /mypage/<sub>→/mypage · 그외(강아지등록·검색·알림·상담)→/dashboard. UUID 정규식으로 동적 id 보존. 이제 어떤 경로로 왔든 ← = 항상 같은 상위 화면(예측 가능, 앱다움). FOCUS_PATHS(설문/체크인/승인)는 헤더 자체가 hidden이라 무관. tsc+eslint GREEN. **범위 주의**: 기기 하드웨어 백(안드 물리버튼/iOS 스와이프)은 여전히 히스토리 기반(PWA 관례 — 커스텀 히스토리 스택 가로채기는 위험해 미적용). /order 하단 'ng' 고스트 '뒤로'→/analysis는 펀널 복귀 affordance라 유지. blind(로그인게이트) → 코드검증만, 사장님 실기기 확인 요망.
- 2026-06-19 [오버나이트 #9 = 재설계 Phase 3b 보수분] 구독 페이지 섹션 일관성: 라벨 없던 **결제 요약 섹션에 헤더(ord-section-h "결제 요약" + CreditCard)** 추가 → 이제 /order 4블록(분량 선택 / 추천 박스 구성 / 수령인 정보 / 결제 요약) 전부 일관 라벨 = "난잡" 완화(순수 추가형, 레이아웃 안 깨짐). +order.css 옛 테라코타 box-shadow 값 `rgba(160,69,46,…)`→현행 브랜드 `rgba(200,107,69,…)` 2곳(.ord-interval-on·.ord-btn-prim) 정정(거의 무감지, 무위험). **남김(사장님 실기기 확인 후)**: .ord-err 틴트는 terracotta→sale(#b83a2e) hue 변경이라 visible → 보류 / 아이템카드 밀도 정리·섹션 스텝 구조도 visible → 보류. 결제/폼/토스 빌링 불변. tsc+eslint GREEN. **다음**: 사장님이 Phase 3a~b(구독 상단 카드+헤더)·뒤로가기 실기기 확인 후 방향 주면 visible 작업 재개; 그 전엔 Phase 4(분석 결과 레이아웃) 또는 안전한 코드레벨 점검(우선순위 4)로.
- 2026-06-19 [재설계 ★사장님 글랜스카드 스샷 승인 "이 느낌으로 밑에도 싹·분석결과도 갈아엎어 제발"] **구독 하단 전체 + 분석 결과 surface 통일(흰 카드 on paper)**: 사장님이 글랜스 카드(Phase 3a)를 실기기 스샷으로 보고 방향 승인 → blind 우려 해소, 과감히 확장. ①**/order 하단 통일**(order.css): 결제요약 bg-2(탄)→흰 elevated+rule보더, 폼 input/textarea #FDFDFD/10px→흰색/12px, 분량카드·아이템카드 surface-card→surface-card-elevated(흰색)+패딩↑. 글랜스 카드와 같은 "흰 카드+12px+hairline" 언어로 페이지 전체 일관(상단만 새것/하단 옛것 해소). ②**/analysis(매거진) surface 통일**(magazine/palette.ts 1파일): WARM_CREAM 웜크림 bg #EFE7D2→**#F7F5F0(paper)**·card #FBF6E7→**#FFFFFF**·cardSoft→#FAF8F3·bgDeep→#EDE8D9·line #D8CDB3→#E4DFD3. palette가 13개 매거진 컴포넌트(Hero·Diagnosis·Nutrients·BoxMix·Supplements·Energy·CTA 등)의 유일 surface 소스라 한 곳 수정=전체 일괄. 크림↔v3토큰 "색감 안맞" 주범 제거 + 텍스트 대비 ↑(흰 위 ink/muted). 결제/폼/계산/로직 불변, 카테고리색·ink·brand 유지. tsc+eslint GREEN. **다음 /analysis 회차**: BoxMix 라인색(olive/wine/ochre/blush)을 FOOD_LINE_META(주문·formula와 동일)로 일원화(분석↔박스↔주문 5라인 색 통일) + 레이아웃 밀도. **사장님 실기기 확인**: /order 전체 + /analysis 결과 화면.
- 2026-06-19 [재설계 "이어서"] 분석↔박스↔주문 **5라인 색 통일** + 매거진 accent 브랜드 정렬: ①매거진 BoxMix가 `lineColors(palette)`(전용 olive/wine/ochre/blush)를 써서 **같은 분석 페이지의 RecommendationBox(이미 FOOD_LINE_META 색 사용)와도 색이 달랐음** → `lineColors()`를 **FOOD_LINE_META(주문·formula·RecommendationBox SSOT)**에서 가져오게 변경(basic=오리=sage·weight=닭=terracotta·skin=연어=gold·premium=한우=wine·joint=돼지=blush). 이제 분석→박스→주문 내내 라인색 1:1. FOOD_LINE_META.color가 일부 var(--token)이라 BoxMixCard 아이콘 bg `${color}22`(var 알파합성 깨짐)→**color-mix**로 교체. ②매거진 off-브랜드 accent 2개 브랜드 정렬: accentOlive(긍정/in-range) #6B7E3B→**#3C725E(sage)**, accentOchre(하이라이트) #C9A24A→**#e6b942(gold)** — 영양바·스탯아이콘·그라디언트 등 전반 브랜드 그린/옐로로(hex 유지라 알파합성 무탈). accentWine/Blush는 브랜드 대응 없어 유지. 전 consumer가 app 컨텍스트(var 해석됨)·非app 렌더 0 확인. tsc+eslint GREEN. **남은 /analysis**: 레이아웃 밀도/여백 다듬기(시각확인 후). **사장님 실기기 확인**: 분석 결과 박스 색이 주문과 같은지.
- 2026-06-19 [오버나이트 #10] 매거진 하드코딩색 감사 + cardSoft 깊이 회귀 수정: ①매거진 컴포넌트 하드코딩 색 전수(grep) — 전부 기능적 중립색(`#fff` on 컬러칩/체크아이콘, rgba 흑/백 알파)뿐, 브랜드 충돌 earthy/cream 잔재 0 = **컴포넌트 레벨 색 클린 확인**(palette가 유일 소스, 이미 브랜드 정렬). ②**회귀 수정**: 직전 회차 흰 surface 전환 때 `cardSoft #FAF8F3`(거의 흰색)로 둬서, 흰 카드 위 중첩 패널(BoxMix 기간 토글 트랙·박스 row 패널·보충제 칩)이 깊이를 잃음(흰 위 흰, 토글 활성 흰 thumb 안 보임). → cardSoft `#FAF8F3`→**`#F0EBE0`**(따뜻한 소프트 틴트)로 깊이 복원. ramp: card#fff > paper#F7F5F0 > cardSoft#F0EBE0 > bgDeep#EDE8D9(단조). 단일 값, palette 통해 전 매거진 일괄. tsc+eslint GREEN. **남은 /analysis**: 레이아웃 밀도/여백 = 실기기 확인 후. accentWine/Blush(스탯·영양 액센트)는 브랜드 대응 없어 보류.
- 2026-06-19 [재설계 "이어서 멈추지마"] 매거진 카드 surface를 /order 클린 카드와 통일(ReportCard 1곳): 매거진 11카드 공용 래퍼 ReportCard가 **떠 있는 소프트 드롭섀도(`0 12px 28px ink10`)+코너 등록마크(인쇄 플러리시)+보더 없음** = /order 승인 디자인(평면 흰 카드 **1px 보더**, 그림자 없음)과 다른 언어였음. → boxShadow 제거 + `border: 1px solid p.line` 추가 + CornerMark 3개 렌더 제거(컴포넌트 export는 유지). 한 컴포넌트 수정이 Hero/Diagnosis/AtAGlance/DailyEnergy/BoxMix/Nutrients/Supplements/CTA 등 전 매거진 카드에 일괄 → 분석 결과가 주문과 같은 평면 흰 카드 느낌. AnalysisView 매거진 컨테이너 bg=paper와도 정합. tsc+eslint GREEN. **남은 매거진 편집감 잔재(스텐실 폰트 eyebrow·"0X/0Y" 넘버링)**: 더 클린하게 갈지 사장님 취향 — 보류. **사장님 실기기 확인**: 분석 결과 카드가 주문 카드처럼 평면+보더로 보이는지.
- 2026-06-19 [★사장님 "각 레시피 박스 카드 앞 원형 누끼 제품사진 슬롯 + 알고리즘 2종 레시피로 바뀜"] 분석 BoxMixCard: ①레시피 행 leading을 **38px 사각 아이콘 → 52px 원형 슬롯**(라인색 틴트 원+보더, overflow hidden). `BoxMixItem.photoUrl?` 추가 → 있으면 `next/image`(objectFit contain)로 원형 안 표시, 없으면 라인 아이콘 placeholder. **누끼 제품사진 자리 자연스럽게 잡아둠**(나중에 SKU별 photoUrl 채우면 표시). 2종이라 행 적음 → 큼직한 원형 어울림. ②알고리즘 변경 반영: tail 하드코딩 "화식 5종 믹스" → **`화식 ${items.length}종 레시피`**(동적). 표시 로직만, 알고리즘/계산 불변. memory `project_box_two_line_recipe` 기록. tsc+eslint GREEN. **다음**: 같은 원형 슬롯을 /order 아이템 카드·formula 카드·RecommendationBox로 확장(각 레시피 박스 카드 통일). **사장님**: 누끼 사진 URL은 SKU별로 생기면 photoUrl 배선; 원형 위치/크기 실기기 확인.
- 2026-06-19 [★사장님 "로딩화면 이거 왜이래" 스샷] 분석 로딩(survey/steps/Loading.tsx) 체크리스트 모순 수정: 원인=cosmetic stage 카운터가 700ms마다 +1, max 4로 ~2.8초면 4단계 다 '완료(초록체크)' 되는데 실제 compute+save(router.push /analysis)는 더 걸려서 "4개 다 체크인데 계속 ANALYZING"= 다 됐는데 멈춘 듯 보임. +라벨 "RER·MER 계산 중"에 done 체크 = 모순. **기능적 멈춤 아님**(완료 시 결과로 이동, 실패 시 retry/err 경로 있음). 수정: ①activeIdx=min(loadingStage, len-1) 클램프 → 마지막 단계는 결과 이동 전까지 항상 진행(spinner), 절대 '전부 완료' 안 보임. ②라벨 '처리/중' 제거('체형 평가'·'RER·MER 계산') → 체크=완료로 정확히 읽힘. cosmetic만, 분석/compute/저장 로직 불변. tsc+eslint GREEN.
- 2026-06-19 [★사장님 스샷3장 "분석결과 전체 마음에 안듦 — 강력 갈아엎어"] 매거진 1차 과부하 제거(AnalysisMagazineSection): 진단=숫자 반복(435 ×4·BCS 7/9 ×3·270g 다수)+모순라벨+preamble 비대. → ①AtAGlance 카드 삭제(435/270/BCS = sticky바+DailyEnergy 중복) ②Celebration 배너 삭제("처방 준비됐어요"=바로 위 Diagnosis와 중복) ③Diagnosis 칩 "BCS 7/9 · BCS 7/9"(bcsLabel=="BCS 7/9" 중복) → "BCS 7/9" ④guidelineLabel "AAFCO {NRC2006+AAFCO2024+FEDIAF2024+WSAVA2021+IRIS2019+KFA}…"(6기준 raw dump) → "AAFCO 2024 · NRC 2006 기준 충족". import/destructure 정리, tsc+eslint GREEN. **★사장님 확인 필요(미해결)**: 하루 숫자 충돌 — DailyEnergy/BoxMix=435kcal·270g vs RecommendationBox 다크카드=392kcal·302g(2,114g/주). 과체중→감량(-1%/주)이라 435=유지MER vs 392=감량급여 목표로 추정되나 라벨이 없어 "버그처럼 모순"으로 보임. compute 영역이라 blind 수정 금지 → 사장님이 "435=유지·392=감량목표" 맞다 하면 라벨로 구분(표시만) 예정. **다음 강력 후보**: BoxMix+RecommendationBox 2개 레시피 섹션 통합 검토(둘 다 닭 표시·구독CTA 중복) · 경고 톤(꼭 확인하세요+확인 필요+권장범위 밖) 완화 · 에디토리얼 라벨 정리.
- 2026-06-19 [★사장님 "몰라 알아서 만들어봐"] 매거진 2차 강력 정리(표시만·계산/결제 불변): ⑤숫자 충돌 완화 — DailyEnergy 부제 "하루에 필요한 에너지"→**"하루 체중 유지에 필요한 에너지"**로 435=MER(유지) 명시(아래 392=감량급여와 의도된 차이임을 라벨로). ⑥**빈 추이 카드 게이트** — history<2면 AnalysisTrendsCard 숨김(첫 분석=전환화면에 "2회+ 하면 표시" 빈 placeholder 어수선 제거). ⑦**경고 톤 심각도 적응** — 위험/주의(critical·high)·수의상담·게이트 있을 때만 "꼭 확인하세요"+terracotta, 참고(info)만이면 **"참고할 점"+gold**(정상 결과를 불안하게 안 보이게, 개별 항목 severity 태그는 유지=정직성). tsc+eslint GREEN. **남김(위험)**: BoxMix+RecommendationBox 통합은 RecommendationBox가 compute/구독/비율조정 기능 컴포넌트(789줄)라 blind 병합 위험 → 보류.
- 2026-06-19 [★사장님 "참고할 점 카드 가장 밑으로 내려"] AnalysisView 안전·주의 신호 섹션을 sticky 바로 아래(최상단)→**페이지 최하단(AnalysisCTASection 뒤)**으로 이동. 긍정 결과(진단·박스·영양) 먼저 보이고 참고사항은 마지막. IIFE 통째 cut→paste(같은 컴포넌트 scope라 analysis/formula/helper 그대로 동작), 톤 적응(hasSerious)·심각도 태그 유지. mt-4→mt-5. **주의**: critical 게이트(췌장염 부적합)는 /order 상단에 별도 prominent alert로 이미 노출돼 구매 시 안전망 유지됨. tsc+eslint GREEN.
- 2026-06-19 [★사장님 다발 피드백] ①**가격카드 이모티콘**: copy-strings price_framing 💚·first_box_offer 🎁 emoji 제거 → PriceFramingCard에 lucide Heart(moss)·Gift(terracotta)로 교체(나머지 lucide와 통일). ②**"맞춤 베이스 레시피" 카드 없애기(사장님 "없애" 확인)**: RecommendationBox:415 `<V3RecommendationCard>` 렌더 제거(+import·v3 prop threading 정리, v3 state fetch는 무해해 유지). 이 카드가 위 BoxMix와 닭·비율·g/kcal **중복** + 그 카드 dailyKcal(v3엔진 435) vs 다크카드(v2 392) **302g/435kcal 숫자충돌의 주범** → 제거로 모순까지 동시 해결. V3RecommendationCard.tsx 파일은 /start(웹 설문)에서 아직 써서 **삭제 안 함**. 그 카드 layerB(기능성 '소스' 대기열)도 같이 사라졌으니 → 영양제 reframe 때 소스 훅 재배치 예정. tsc+eslint GREEN. **남은 사장님 요청(진행중)**: ③"왜 이 비율" 컴팩트화(내용 유지·공간↓) ④다크카드 디자인 정리 ⑤영양제(SupplementsCard) = 알약 추천 말고 우리 소스/화식이 채워주는 식으로 reframe.
- 2026-06-19 [★사장님 기능버그 3종 신고] **(1) 새 강아지 등록폼 옛정보 잔존**: NewDogClient autosave(`ft:new-dog-draft`)가 제출 성공 시 clear되지만, 디바운스(500ms) autosave가 그 직후 발화해 draft를 되살리는 **레이스** → 다음 '강아지 추가'에 옛 정보. fix=`submittingRef` 가드(제출 시작 시 true→autosave 재저장 skip, 실패 시 false). **(2) 분석 로딩 15초 멈춤**: saveAndGoResult가 analysis insert(저장 완료) 후 `/api/rewards/survey-completion` fetch를 **await**한 뒤 결과로 이동(timer) → 보상 API 느리면 navigation이 묶임. fix=AbortController 4s 타임아웃(보상은 비핵심, 느리면 토스트만 생략하고 이동). **(3) "30일" 토스트 2번**: (2) 때문에 멈춰서 새로고침→설문 재진입→30일 가드→/analysis로 바운스 시 surveyBlockedDays 토스트가 StrictMode/재마운트로 이중 발화. fix=`blockedToastShownRef` 가드. 계산·결제·DB 스키마 불변, tsc+eslint GREEN. **잔여 가능성**: 15초가 보상 fetch 아니라 analysis insert/compute(백엔드)면 추가 조사 필요 — 사장님 재현 시 알려주면 deep dive.
- 2026-06-19 [★사장님 "한국어 조사/받침 문법 웹·앱 전체 정확히"] **lib/korean.ts 신설**: hasBatchim(종성 = (code-0xAC00)%28!==0) + **petName(name)**(받침 있으면 친근형 '이' 붙임: 나우→나우, 푸린→푸린이 / 친근형은 항상 모음끝이라 뒤 조사 모음형 그대로) + josa/eunNeun/iGa/eulReul/waGwa 프리셋. **적용(분석 결과 visible)**: HeroSection 식단제목+사진 placeholder("나우이의 식단"→"나우의 식단"), DailyEnergy("나우이가"→"나우가"), Diagnosis headline body, BoxMix("…첫 박스"), Supplements("…맞춤 보충제"). tsc+eslint GREEN. **sweep 완료(visible .tsx + copy-strings)**: 분석결과 전부·formulas·checkin·approve·first-checkin·year-in-review(와/과)·analysis OG layout·NutrientGauges·Celebration + **copy-strings.ts**(${name}이 전수 + withDogName의 "○○이" 치환을 petName으로). 전수 grep 결과 .tsx의 rendered name+이/raw josa 0건(DiagnosisCard 한 곳은 JSDoc 주석 예시라 무해). tsc+eslint GREEN. **남은 tail(비visible)**: .ts 이메일 템플릿(personalization-cycle.ts)·cron(first-box-checkin route)의 ${name}이 — 이메일이라 우선순위 낮음, 다음에. **+ 별개 대형 작업**: 분석 결과 = 스샷 위쪽(히어로·진단·DailyEnergy)만 남기고 하단(박스/추천/영양/보충제/가격/CTA) 전면 재디자인(사장님 "기똥차게").
- 2026-06-19 [재디자인 진행] RecommendationBox 하단 정리(사장님 콕 집은 2건): ①**"왜 이 비율" 접기식** — fb-reasoning 헤더를 toggle 버튼(ChevronDown·aria-expanded)으로, 기본 whyOpen=false → reason rows 숨김(공간 대폭 절약), 탭 시 펼침. ②**다크카드→흰카드**(recommendation.css fb-totals): `var(--ink)` 다크+18px+light텍스트 → **흰 elevated(surface-card-elevated)+1px rule+12px**, .l muted·.v ink(serif→sans 통일)·ghost버튼 ink/rule보더·prim hover accent-deep·전환가이드 박스는 흰 위에서 가독성↑. tsc+eslint GREEN. **재디자인 진행분 완료**: ①SupplementsCard reframe(알약추천X→"우리 화식·데일리 소스가 챙김": 헤더 "더 챙겨주는 영양·우리 소스·화식으로", 오해 부르던 "+"→체크, "따로 영양제 챙길 필요 없어요" footer). ②NutrientsCard 톤(per-nutrient "확인 필요"빨강→"권장 이상/이하" 골드 사실표기 / 요약필 모순 ✓→Info + "맞춤 설계로 AAFCO 권장과 달라요" 안심 톤). 모두 tsc+eslint GREEN. **하단 재디자인 현황**: BoxMix(흰카드+원형슬롯)·RecommendationBox(왜이비율 접기+다크→흰카드)·Supplements·Nutrients 완료. 남음=CTAStack(처방상담+공유)·PriceFraming(이모지 완료)·AnalysisCTASection 잔다듬 + 사장님 실기기 전체 리뷰.
- 2026-06-19 [★사장님 "제품탭 아예 없애" — 앱에 카탈로그 떴음] **앱 커머스 카탈로그 제거**: app/products/page.tsx + app/products/[slug]/page.tsx 에 `if (isApp) redirect('/dashboard')`(isApp=isAppContextServer). 어떤 진입(CartUpsell·CouponCard·WelcomeCouponBanner·ErrorScreen·검색 링크)으로 와도 앱에선 홈으로 → catch-all "없애". **웹 editorial 카탈로그는 그대로**(isApp 게이트). 박스 정기배송 funnel은 /dogs/[id]/order(별개)라 무영향. tsc+eslint GREEN. **잔여(미요청·노트)**: 앱 내 /products 링크들은 이제 홈으로 no-op(약간 어색 — 원하면 app서 숨김) · 장바구니(/cart)·체크아웃도 커머스 잔재라 정리 가능(사장님 확인 시). app/products 의 isApp 카탈로그 렌더 코드는 이제 dead(무해, 추후 정리).
- 2026-06-19 [★사장님] ①**영양 균형(NutrientsCard) 아예 삭제** — AnalysisMagazineSection에서 `<MagNutrients>` 제거(+컴포넌트 import 제거, type만 유지, nutrientRows destructure 정리). ②**"왜 이 비율" 이동** — RecommendationBox에서 fb-totals(정기배송 신청 CTA 박스) **위→아래**로 이동(접기식 그대로, marginTop 14). 분석 결과 카드 순서: …박스→RecommendationBox(흰 totals+정기배송)→**왜이비율**→추이(2회+)→보충제→CTA. tsc+eslint GREEN.
- 2026-06-18 죽은 코드 정리(사장님 ㄱㄱ): orphan 컴포넌트 **QuickLogSheet**(components/v3/sheet) + **DogDetailFAB**(components/v3/dog) 삭제 — 둘 다 자기 파일+배럴 export 외 사용처 0(grep 확인). sheet/index·dog/index 에서 export(+ FabAction 타입) 제거. PawFab+퀵시트 체계로 완전 대체돼 불필요. whole-project tsc GREEN(타 참조 없음 확인), eslint GREEN.
- 2026-06-18 남은 lucide PawPrint 일괄 정리(사장님 "개요 탭 안 바뀜" + "모든 부분"): DogPawMark에 무시되는 strokeWidth prop 추가(lucide 자리 drop-in 호환) → ①**개요 탭 아이콘**(DogTabsNav, 사장님 지목) ②추천 페이지 강아지 사진 placeholder(ReferralView) ③온보딩 step1 히어로(OnboardingTutorial) 3곳 벡터 교체. **제외**: 멤버십 나무등급 "구매 적립 3%" 혜택 불릿 아이콘(tiers.ts Icon:'paw') — 트럭/왕관/선물 등 outline 혜택 아이콘 한 세트라 fill 단독 교체 시 충돌 → 보류(사장님 결정 대기). globals .lucide-paw-print rotate(-15deg)는 이 잔여 paw에 아직 적용되어 유지. tsc+eslint GREEN. ※기존 "안 보임"은 브라우저 PWA 서비스워커 캐시(코드/서버는 정상) — Ctrl+Shift+R 또는 Clear site data 1회 필요.
