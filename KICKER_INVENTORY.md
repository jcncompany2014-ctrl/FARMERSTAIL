# KICKER_INVENTORY — 영문 킥커/아이브로우 전수 + 판정

> P4 (2026-07-09). Track B "영문 모노 킥커 → 한글" 인벤토리. **코드 무변경 원칙**
> (age-gate 버그 1건만 즉시 수정). 나머지는 사장님 방향 결정 후 P5에서 적용.

## ★핵심 발견 — 전면 한글화는 권장하지 않음

영문 킥커는 대부분 **의도된 디자인 장치**다:
- **웹** = The Farmer's Dog 클론(farm v6, 사장님 승인). FD 실제 사이트가 영문 섹션
  라벨(`OUR STORY`, `WHY FRESH`…)을 쓰고, 우리 `Eyebrow` 컴포넌트 docstring도
  "영문 소형 대문자 라벨 (섹션 머리 악센트)"로 명시. 이걸 다 한글로 바꾸면
  **FD 느낌 자체가 사라진다** → [[feedback-fd-rebuild-not-reskin]] 위배 소지.
- frontend-design 스킬 원문: *"브리프가 시각 방향을 못박았으면 그대로 따르라 —
  브리프의 말이 항상 이긴다."* 우리 브리프(FD 클론)는 못박힌 상태.

즉 de-AI의 실질 성과는 **Track A(도장)·C(폴라로이드)**로 충분하고, 킥커는
"바꾸면 오히려 손해"인 영역이 대부분이다. 아래 분류로 사장님 판정만 남긴다.

## 분류 (총 ~110곳)

### ① 웹 FD 에디토리얼 — 순수 영문 · **유지 권장** (~55곳)
`OUR STORY` `WHY FRESH` `THE SCIENCE` `MAGAZINE` `REVIEWS` `SCIENCE` `METHOD`
`CITATIONS` `CONDITIONS` `OUR FOOD` `REAL INGREDIENTS` `SOUS-VIDE` `THE DIFFERENCE`
`OUR PROCESS` `A COMPLETE BOWL` `HOW IT WORKS` `WHY SUBSCRIBE` `CONTACT` `CH · {no}`
등. (about/page, our-food, page, plans, science, reviews, why-fresh, blog, brand…)
→ FD 클론의 정체성. 바꾸면 FD 느낌 손실.

### ② 웹 혼합 "영문 · 한글" · **유지 권장** (~12곳)
`Subscriptions · 정기배송` `Our Dogs · 우리 아이` `Profile · 내 프로필`
`Payments · 결제와 환불` `Newsletter · 뉴스레터` `Key Ingredients · 핵심 원물`
`Standard · 어떻게 만드나요` `Guide · 급여 · 보관` `WELCOME · 무료 맞춤 분석` 등.
→ 이미 한글 병기. 영문은 작은 악센트라 어색하지 않음.

### ③ farm v4 넘버링 · **유지** (승인 스펙) (~8곳)
`NO.01 — ORIGIN` ~ `NO.06 — OUR PROMISES` (about), `OUR STORY · VOL.03`,
`BY THE NUMBERS` (brand). → 스토리 챕터=실제 순서라 넘버링 정당(스킬 기준 통과).

### ④ 앱(v3) Mono/kicker — 순수 영문 · **사장님 판정** (~25곳)
`Diary · 일상 기록`(한글 병기 O) / `Weight Log` `New Weight Log` `Welcome` `History`
`Certificate` `Privacy` `Install` `Cookies` `Subscription` `My Benefits` `All Tiers`
`New` / AppShowcase 목업의 `Hello · good afternoon` `Now featuring` `Daily Energy · MER`
`Custom Box · Cycle 1` `Health Care` `Family` 등.
→ **여기가 유일하게 논쟁적.** 앱은 한국인의 매일 쓰는 도구라, 순수 영문 킥커
(`Weight Log`, `History`)는 FD 참조가 아니라 그냥 멋. 한글화(`체중 기록`, `기록`)가
자연스러울 수 있음. 단 AppShowcase(웹 /why-app의 폰 목업)는 웹 맥락이라 유지 쪽.

### ⑤ 버그/어색 · **즉시 수정** (1곳)
- `app/onboarding/age-gate/page.tsx:115` `Age Verification14세 확인` — 구분자 누락으로
  영문·한글이 붙음. → `14세 확인`(앱 온보딩=한글 맥락)으로 수정. **P4에서 처리 완료.**

## ★사장님 결정 (2026-07-09): **A — 전부 유지.**
④ 앱 킥커도 유지. Track B 전면 전환 드롭. ⑤ age-gate 버그만 수정(완료).
de-AI 성과는 Track A(도장)·C(폴라로이드)로 확보.

## 권장안
- ①②③ 유지, ⑤ 수정(완료). ④만 사장님 결정:
  - **A** 전부 유지 (de-AI는 도장·폴라로이드로 충분) ← 가장 안전
  - **B** 앱 실화면 kicker만 한글화(Weight Log→체중 기록 등), 웹·목업은 유지 ← 절충
  - **C** 웹 포함 전면 한글화 ← FD 느낌 손실, 비권장
