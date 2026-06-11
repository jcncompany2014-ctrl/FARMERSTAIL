# 앱 느낌 감사 (App-feel Audit) — 2026-06-09

> "심플 모바일 웹페이지 같다"를 만드는 코드 요소 41개. 실제 파일:줄 근거.
> 영향도(앱느낌 깨는 정도) / 난이도. ✅ 처리 후 체크.

## 🎯 핵심 5 (먼저 체감)
1. 로고→홈 + 모든 화면 헤더 동일 → '한 페이지 웹사이트' 느낌
2. 삭제/취소/해지 확인창이 화면 한가운데 웹 팝업 박스 (useConfirm → BottomSheet 한 곳 고치면 12화면 일괄)
3. 화면 끝 고무줄 출렁 + 당겨서 새로고침 (overscroll-behavior 한 줄)
4. 화면 전환 애니메이션 0 + 로딩 중 빈 화면 깜빡 (template.tsx + loading.tsx 스켈레톤)
5. viewportFit:cover 누락 → 노치/홈바까지 안 차고 위아래 띠 (한 줄)

---

## ⚡ 빠른 승리 (high 영향 · low 난이도 — 한 방에 가능)
- [x] **overscroll-behavior** html 추가 → 당겨서새로고침·바운스 차단. ✅ Phase1
- [x] **tap-highlight** 앱 chrome 전역(a 포함) → 탭 시 파란/회색 박스 제거. ✅ Phase1
- [x] **로고 홈링크 제거** → 로고는 장식(span)으로. ✅ Phase1
- [x] **viewportFit:'cover'** 추가 → 노치 끝까지 풀블리드. ✅ Phase1
- [x] **useConfirm → BottomSheet** → 12개 확인창이 아래서 올라오는 시트로. ✅ Phase2
- [x] **구독해지 모달 → 시트** + "계속 받을게요" 메인/"해지" 약화(이탈방지). ✅ Phase2
- [x] **window.confirm()/alert() 제거(4곳)** → useConfirm/Toast. ✅ Phase2 (VetShare·DogFamily×2·AddressSearch)

## 🎨 상단바 개편 (사장님 결정)
- [x] 로고 왼쪽(장식) + **활성 강아지 칩**(아바타+이름+▾→/dogs) 오른쪽. ✅
- [x] 2px 헤어라인 제거 → **그림자/블러로 떠 있는 느낌**. ✅
- [x] 장바구니 → 하단 탭 / 알림 → 마이페이지 "받은 알림"(고립 방지). ✅

## 🔨 큰 공사 (high 영향 · med/high 난이도 — 단계로)
- [ ] **화면별 헤더 제목 + 뒤로가기** (헤더가 title/back 받게). `AppChrome.tsx:213-293` · high
- [ ] **화면 전환 애니메이션** `app/(main)/template.tsx` 신설(이미 키프레임 있음). med
- [ ] **loading.tsx 스켈레톤** 일기/건강/구독/적립금/검색/챗봇/리포트 추가(53중 5개뿐). med
- [ ] **뒤로가기 헤더 좌상단 고정 + router.back()** (지금 본문 안 10.5px 링크). med
- [ ] **QuickLog/WeightInput 시트 slide-up + 백드롭** (지금 풀스크린 깜빡). med
- [ ] **상태바 safe-area 색 채움 + statusBarStyle** (viewportFit과 세트). med
- [ ] **user-select/touch-callout off** (앱 전역, 입력창·본문 예외). med

## 🧹 자잘 (med/low)
- [ ] 강아지 상세 '2번째 탭바'(밑줄 가로탭) 세그먼트형으로. `DogTabsNav.tsx:84` · med
- [ ] 헤더 높이 하드코딩(60px) → CSS변수. `DogTabsNav.tsx:86` · low
- [ ] 장바구니 상단+하단 중복 → 하단 한 곳. `AppChrome.tsx:267,71` · low
- [ ] 스크롤바 숨김(앱 chrome). `globals.css` (MISSING) · low
- [ ] 관성 스크롤 `-webkit-overflow-scrolling:touch` 전역. `globals.css:728`만 · low
- [x] `text-size-adjust:100%` (OS 글자확대 방지). ✅ Phase1 (덤)
- [ ] 진입 애니메이션 거의 미사용(2화면뿐). `lib/motion.ts` · low
- [ ] 탭 가능 '카드' 누름 반응(active:scale) 추가. `TodayCard.tsx` 등 · low
- [ ] hover:underline 제거(손가락 환경 죽은 스타일) 5곳. low
- [ ] 밑줄 텍스트 링크 → 버튼/›화살표 7곳. med
- [ ] BottomSheet 드래그로 닫기 제스처(지금 손잡이 장식만). `BottomSheet.tsx:116` · med
- [ ] 토스트 스와이프로 닫기. `Toast.tsx:333` · med
- [ ] BottomSheet 채택률↑(시트 패턴 통일). med
- [ ] apple-touch-icon 180x180 PNG 추가. `layout.tsx:175` · low
- [ ] maskable 아이콘 safe-zone PNG. `manifest.json:40` · low
- [ ] viewport colorScheme:'light' 고정. `layout.tsx:186` · low
- [ ] 분석 스피너 → 스켈레톤. `AnalysisView.tsx:313` · low
- [ ] 헤더 블러 톤 다듬기. `AppChrome.tsx:216` · low
- [ ] 헤더에 검색 진입구(검색화면은 있는데 못 들어감). `AppChrome.tsx:249` · low
- [ ] Tooltip hover식 → 탭 펼침. `Tooltip.tsx:61` · low
- [ ] 데스크톱 phone-frame 바깥 앱셸 연출. `AppChrome.tsx:208` · low
