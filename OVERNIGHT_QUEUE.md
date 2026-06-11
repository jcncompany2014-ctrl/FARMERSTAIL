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
- [x] A1. 타이포 스케일 위반 정리 — 완료
  - [x] A1-1: 페이지 h1 32 통일 (156fdf9)
  - [x] A1-2: components/v3 off-scale 정렬 (4ef4e2b) — 예외: 날짜 숫자 디스플레이, MyDogsSection 20(R23)
  - [x] A1-3: app/(main) 본문 off-scale 정렬 (5b7b4d7) — 예외: 이모지·통계 숫자·가격 디스플레이
- [x] A2. spacing — 점검 결과 위반 없음(카드16/섹션20/히어로24 일관 패턴). 변경 안 함 (ba4771d 메모)
- [x] A3. radius — 실위반 0 (잔재 2건은 과거 정리 주석). 변경 안 함
- [x] A4. 색 — terracotta 는 앱 스코프 alias(--terracotta: var(--accent))로 이미 해결, inkFaint 4건은 전부 아이콘(허용). 변경 안 함
- [x] A5. 헤더 높이 64px 고정 + --ft-header-h 변수 + DogTabsNav safe-area 보정 (ba4771d)

## Phase B — 인터랙션 폴리시 (앱 손맛)
- [x] B1. 누름 피드백 — 전역 CSS 로 앱 스코프 a/button 전체 적용 (dc9ec59). 개별 active:scale 산재 정리는 자연 흡수.
- [x] B2. 죽은 hover:underline 6곳 제거 (3e634ae). 나머지 hover:* 는 v4 게이트로 터치 무해 — 정리 불필요 판정.
- [x] B3. 밑줄 링크 10곳 → › 그래머 (5758ddb). 의도적 유지 3곳 로그 참조.
- [x] B4. BottomSheet 드래그 닫기 (aabd93f) — 그래버+제목 존, 90px 임계, 스프링백.
- [x] B5. Toast 스와이프 닫기 (757071a).
- [x] B6. 스크롤바 숨김 + 관성 스크롤 (aeb3727)
- [x] B7. user-select/touch-callout off, 입력류 예외 (aeb3727) — build:ci 권위 검증 포함
- [x] B8. 상태바 색 — (main) viewport override, paper 톤 (cadbc1b).
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
