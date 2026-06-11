# 야간 자율 디자인 마스터피스 큐 — 2026-06-11 시작

> 사장님 지시: "더 앱스럽게 + 난잡한 요소·오류 전부 뜯어고치기 + 디자인 마스터피스.
> 메인색·레이아웃·폰트·앱 스타일 많이 바뀌어도 됨. 퀄리티 최우선. 멈추라 할 때까지 계속."
>
> 진행 규칙 (모든 루프 공통 — 절대 어기지 않는다):
> 1. 한 번에 한 항목. 수정 → `cd /c/Users/A/Desktop/projects/farmerstail-app && npm run verify` → GREEN 이면 로컬 커밋 + OVERNIGHT_LOG.md 기록 → 항목에 [x].
> 2. verify 실패 → `git checkout -- .` 원복 → 로그에 SKIP + 사유 기록 → 다음 항목.
> 3. 범위: app/(main)/** · components/v3/** · globals.css 의 앱 스코프 · app/dashboard — **만**.
>    variant 분기 컴포넌트는 app variant 쪽만. 웹 에디토리얼 톤(serif/white card/rounded-xl) 불변.
> 4. 금지: 레시피/영양 수치, 결제·Toss, DB 마이그레이션 적용, git push, 배포, 사료법 위반 문구, 사실 조작.
> 5. 사용자 노출 한국어는 완벽하게. 과장·허위 문구 생성 금지.
> 6. 큐가 비면: 탭루트→깊은화면 순으로 화면을 하나 골라 정독 → 마스터피스 기준 미달 항목을 큐에 보충 → 계속.
> 7. 사장님 결정이 필요한 건 만들지 말고 로그의 "아침 결정 필요" 섹션에 기록.

## Phase A — 시각 기반 (파운데이션 일관성)
- [ ] A1. 타이포 스케일 위반 정리 — 앱 스코프에서 V3FontSize(9/10.5/12/13.5/16/22/32/54) 외 임의 px (13/14/15/11/28 등) 전수 → 가장 가까운 토큰으로. 화면 단위로 쪼개서 여러 커밋 OK.
  - [x] A1-1: 페이지 h1 32 통일 (156fdf9)
  - [x] A1-2: components/v3 off-scale 정렬 (4ef4e2b) — 예외: 날짜 숫자 디스플레이, MyDogsSection 20(R23)
  - [ ] A1-3: app/(main) 화면들 본문 off-scale (text-[11px]·text-[14px]·fontSize 11/14/15/17/18 등) — 묶음별로.
- [ ] A2. spacing 표준 위반 정리 — px-5/mt-3/p-4/gap-3 표준 외 잡값 정리 (화면 단위).
- [ ] A3. radius 위반 정리 — 앱 스코프 rounded-xl/2xl/3xl 잔재 → 4px(카드)/12px(시트·히어로) 체계로.
- [ ] A4. 색 일관성 — terracotta(웹 잔재) vs accent 혼용 정리, inkFaint 텍스트 사용처 제거(대비 위반), sale/sage/gold 역할 일관성.
- [ ] A5. 헤더 높이 하드코딩(60px) → CSS 변수 (DogTabsNav.tsx:86 외).

## Phase B — 인터랙션 폴리시 (앱 손맛)
- [ ] B1. 탭 가능한 카드 전부 press 피드백(active:scale-[0.98] + transition) — TodayCard 등 홈/목록 카드 전수.
- [ ] B2. hover 전용 스타일 정리 — hover:underline 제거(5곳+), hover 색변화는 active 병행으로.
- [ ] B3. 밑줄 텍스트 링크 → 버튼/› 화살표 그래머 (7곳).
- [ ] B4. BottomSheet 드래그로 닫기 제스처 (BottomSheet.tsx — 그래버가 실제로 동작하게, touch 이벤트).
- [ ] B5. Toast 스와이프로 닫기 (Toast.tsx).
- [ ] B6. 스크롤바 숨김(앱 chrome) + 관성 스크롤 전역 (globals.css 앱 스코프).
- [ ] B7. user-select/touch-callout off — 앱 전역, 입력창·본문 텍스트 예외.
- [ ] B8. 상태바 safe-area 색 채움 + statusBarStyle (viewportFit cover 와 세트).
- [ ] B9. 진입 애니메이션 활용 확대 — lib/motion.ts 가 2화면뿐 → 주요 화면 목록/카드에 stagger fade-in-up.
- [ ] B10. Tooltip hover식 → 탭 펼침 (Tooltip.tsx:61).

## Phase C — 화면별 마스터피스 패스 (정독 → 난잡 요소 제거 → 위계 재정리)
각 화면: 시각 위계(한 화면에 강조 1개), 정렬선, 여백 리듬, 죽은 공간, 중복 정보, 어색한 한국어까지 점검.
- [ ] C1. 홈(dashboard) — 첫인상의 전부. 섹션 간 리듬·카드 위계·인사말 영역.
- [ ] C2. 강아지 목록(/dogs) + 상세 — DogTabsNav 밑줄 가로탭 → 세그먼트형(audit 항목).
- [ ] C3. 제품 목록 + PDP (app variant 쪽만).
- [ ] C4. 장바구니 — 상단+하단 중복 정리(AppChrome.tsx:267,71 audit 항목) 포함.
- [ ] C5. 마이페이지 허브 — 메뉴 그룹핑·아이콘 일관성.
- [ ] C6. 분석 화면 — 분석 스피너 → BrandLoader/스켈레톤 (AnalysisView.tsx:313).
- [ ] C7. 설문 — STEP 진행감, 선택지 카드 손맛.
- [ ] C8. 체크인/일기/건강/리마인더 묶음.
- [ ] C9. 주문 플로우(OrderClient) + 박스 승인(approve).
- [ ] C10. 알림/검색/챗봇/리포트 묶음.

## Phase D — 마감 디테일
- [ ] D1. 헤더에 검색 진입구 (검색화면 있는데 진입로 없음 — AppChrome 강아지칩 옆 아이콘).
- [ ] D2. 데스크톱 phone-frame 바깥 앱셸 연출 (AppChrome.tsx:208).
- [ ] D3. viewport colorScheme:'light' 고정 (layout.tsx).
- [ ] D4. BottomSheet 채택률 — 남은 중앙 Modal 패턴 시트로 통일.
- [ ] D5. 빈 상태(empty state) 전수 — 일러스트/아이콘+CTA 그래머 통일.
- [ ] D6. 큐 소진 시: 규칙 6에 따라 화면 정독으로 신규 항목 보충.

## 완료
(완료 항목은 [x] 로 위에서 체크 + OVERNIGHT_LOG.md 에 상세)
