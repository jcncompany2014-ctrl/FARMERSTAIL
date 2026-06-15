# Farmer's Tail 웹 — The Farmer's Dog 클론 빌드 노트

> 2026-06-13 사장님 지시: thefarmersdog.com 을 **디자인·UI·스크롤 모션·기능 전부**
> 충실히 복제. 로고 제외, 설문(quiz) 페이지 제외, 모든 페이지 복제.
> 한글 위주 + 영어는 "느낌"으로 아주 살짝. 질문하지 말고 이 메모에 적고 진행.
> 사진은 어울리는 placeholder(설명 포함)로 채워 즉시 교체 가능하게.
> 그동안 만든 프론트는 폐기하고 새로.

이 파일 = **결정 로그 + 진행 상황 + 빌드 스펙**.

---

## 0. 원칙 / 제약 (불변)

- **저작권**: FD 의 ① 마케팅 문구 원문 ② 사진/일러스트 ③ 로고 = 복제 금지.
  복제 대상 = 레이아웃·정보구조·컴포넌트·인터랙션·스크롤 모션·페이지 구성.
  카피는 파머스테일용 한글로 **새로 작성**(번역 아님). 영어는 eyebrow/포인트로만.
- **사진**: 의도된 placeholder(솔리드 색면 + "여기엔 ○○ 사진" 라벨). 사장님이
  파일만 교체하면 끝. 와이어프레임 점선 금지(미완성처럼 보임).
- **정직 원칙**: 가짜 후기·통계·수치 금지. 후기/숫자는 placeholder 또는 검증값.
- **사료관리법**: 질병 치료·효능 단정 금지(생활개선 표현 OK).
- **레시피**: 영업비밀, 노출 금지.
- **불변(AGENTS.md)**: app/web dispatch, 결제/체크아웃, 법정 푸터(SiteFooter). web 시각은 허용.
- **CTA**: 모든 "시작하기" 류 → 기존 설문 퍼널 planHref(`/dogs/new`|`/signup`).
- **git**: push 금지(사장님 지시 전). 로컬 verify GREEN 유지.

---

## 1. 디자인 시스템 (라이브 추출 확정)

### 팔레트
| 토큰 | hex | 용도 |
|---|---|---|
| `--fd-pine` | `#173B33` | 주력 다크 그린 — 본문 텍스트, 다크 섹션 bg |
| `--fd-green` | `#3C725E` | 미디엄 그린 — 보조 버튼/섹션/아이콘 |
| `--fd-green-soft` | `#B5D3BA` | 옅은 그린 — 다크 위 보조 텍스트/장식 |
| `--fd-cream` | `#EDE8D9` | 따뜻한 오트밀 — 라이트 섹션 bg |
| `--fd-offwhite` | `#F7F5F0` | 웜 오프화이트 — 기본 페이지 bg |
| `--fd-coral` | `#F2674B` | 코랄 — 주력 CTA pill (흰 텍스트) |
| `--fd-coral-text` | `#B63619` | 코랄(어둡게) — 라이트 bg 위 작은 링크/라벨 텍스트 (AA≥4.5, cream 4.86:1) [회차21] |
| `--fd-muted` | `#5A6C61` | 뮤트 그린그레이 — 보조 텍스트 |
| white | `#FFFFFF` | 카드/대비 |

→ 한 줄 요약: **딥 파인그린 + 오트밀 크림 + 코랄 포인트.** 따뜻+프리미엄+신선.
   파스텔 아님. 텍스트 기본색 = pine(#173B33), 다크섹션 텍스트 = white/green-soft.

### 타이포
- FD 실제: Neue Haas Grotesk(상용). → **대체: Pretendard**(이미 로드, KR+EN 그로테스크,
  weight 45~920). 헤드라인 = Pretendard 800~900 + letter-spacing 타이트(-0.02~-0.04em),
  line-height 1.0~1.1. 본문 = Pretendard 400~500.
- 손글씨 악센트(FD "Lazy Dog") → 작은 영어/한글 포인트에만 (Gaegu 또는 Caveat). 절제.
- H1 56px/900/-1px (데스크톱). 모바일 32~40px. H2 40~48px. 큰 숫자 통계 多.

### 라운드 / 도형
- 버튼 = **pill (9999px)**. 카드 = **거의 각짐 (2px)**. 아바타/아이콘 = 원(50%).
- → 프리미엄 에디토리얼: 둥근 버튼 + 샤프한 카드.

### 글로벌
- sticky 헤더 + sticky CTA(스크롤 시 하단/상단 고정 "시작하기").
- 상단 promo bar(쿠폰/혜택 띠) 있음.
- 신뢰 로고 행(언론/대학/리뷰 — 우리는 "수의사 자문/언론" placeholder).
- 스크롤 등장(fade/slide-up) 광범위. video 없음(이미지 위주).

---

## 2. 페이지 인벤토리

핵심(복제):
- [ ] `/` 홈
- [ ] `/our-food` 우리 음식(신선식 이유 + 재료 + 사료 비교)
- [ ] `/reviews` 후기
- [ ] `/about-us` 브랜드 스토리
- [ ] `/faq` 자주 묻는 질문 (아코디언 + 카테고리)
부가(후순위):
- [ ] `/digest` 매거진(기존 /blog 활용)
- [ ] `/breed` 견종별
- [ ] `/diy` (선택)
제외: ~~설문/signup quiz~~, 외부(vets/affiliates/careers 외부화)

글로벌: 헤더 nav = 우리 음식 / 후기 / 브랜드 / FAQ + 로그인 + 코랄 "시작하기".
푸터 = 멀티컬럼(메뉴/회사/도움말/SNS) + 법정 SiteFooter(불변) 유지.

## 3. 홈(/) 섹션 스펙 (FD 정석 흐름 — 한글 카피 신규)

1. **Promo bar** (상단 얇은 띠) — 혜택 한 줄.
2. **헤더**(sticky) — 로고·nav·로그인·코랄 CTA.
3. **Hero** — 좌: 거대 헤드라인 + 부카피 + 코랄 "시작하기" + 신뢰 한 줄 / 우: 강아지가
   밥그릇 보는 큰 사진(placeholder). 아래 **신뢰 로고 행**(언론/수의자문 placeholder).
4. **신선식 선언** — "사람이 먹을 수 있는 진짜 음식" 큰 문장 + 재료 이미지.
5. **수의영양 설계** — 완전균형·표준 공식 신뢰 (크림 bg).
6. **맞춤 플랜** — 우리 아이 몸에 맞춘 정량/신선배송 (이미지+텍스트 2단 교차).
7. **작동 방식 3단계** — 설문 → 맞춤조리·배송 → 더 건강한 하루 (번호 스텝, 다크 그린 bg).
8. **신선 vs 사료 비교** — 비교표/대비 비주얼.
9. **건강 변화** — 소화·피모·활력 등 생활개선(질병단정 X) 카드/리스트.
10. **후기** — 큰 신뢰 문구 + 별점 + 후기 카드(placeholder, 가짜 X) + 통계 band.
11. **창업 스토리 snippet** — 사진 + 한 단락 + "브랜드 이야기" 링크.
12. **최종 CTA band** (코랄 또는 pine) — "시작하기".
13. **푸터**.
+ **sticky CTA**: 모바일 하단 고정 "2분 설문 시작" (스크롤 등장).

## 4. 컴포넌트 인벤토리 (components/web/fd/)

- `Button`(pill: coral/green/outline/cream, sizes), `Container`(max-w), `Section`(bg variants + padding),
- `Eyebrow`(영문 포인트), `Stat`(큰 숫자), `LogoRow`(신뢰 로고 placeholder),
- `PhotoSlot`(솔리드 색면 + 라벨), `StepList`(번호 스텝), `CompareTable`(신선 vs 사료),
- `ReviewCard`(별점/아바타/텍스트 — placeholder), `Accordion`(FAQ), `StickyCta`,
- `Reveal`(스크롤 등장 — 기존 재사용), `Marquee`/`LogoTicker`(선택).
- 헤더 `WebChrome` FD형 재작성, 푸터 SiteFooter 유지.

## 5. 결정 로그 (사장님 검토용 — 내가 임의 결정)

- D1: 사진 = 솔리드 색면 placeholder + 라벨. 점선 X.
- D2: 헤드라인/본문 폰트 = Pretendard(상용 Neue Haas 대체). 손글씨 악센트 절제.
- D3: 신뢰 로고 행 = "언론/수의자문" 텍스트 placeholder (실제 로고 없음, 가짜 X).
- D4: 후기/통계 = placeholder("후기 자리", 숫자 비움). 실데이터 들어오면 교체.
- D5: 모든 시작 CTA → 설문 퍼널(planHref). 설문 페이지 자체는 클론 안 함.
- D6: 영어는 eyebrow/소량 악센트로만, 본문은 전부 한글.
- D7: 헤더 nav URL — 우리 음식 `/our-food`(신규) · 후기 `/reviews`(신규) ·
  브랜드 이야기 `/about`(기존 재사용, FD형 리빌드) · 자주 묻는 질문 `/faq`(기존 리빌드).
  매거진(/blog)은 메인 nav 에서 빼고 푸터로. (FD nav = Our Food/Reviews/About/FAQ 4개)
- D8: 폰트 = Pretendard 헤비(헤드라인 900). 다운로드 비용 0. 손글씨 악센트 보류.

## 6. 진행 로그

- 2026-06-13: 방향 전환(FD 클론). 사이트 정독 — 디자인시스템/구조 확정.
- ✅ 토큰(globals --fd-*) + 프리미티브(components/web/fd/ui.tsx: Button/Container/
  Section/Eyebrow/Display/Stat/PhotoSlot/Hand) + StickyCta 완성.
- ✅ **홈(/) FD형 전면 재작성** — 10섹션(Hero·TrustStrip·RealFood·VetDeveloped·
  Personalized·HowItWorks(다크)·Compare표·Benefits·Reviews·Story·FinalCta) + sticky CTA.
  tsc/eslint GREEN, 프리뷰 렌더 확인. 코랄 CTA·딥그린·비교표·스텝 전부 작동.
- ✅ WebChrome 헤더 FD형(파인 promo바 / 크림 헤더 / 코랄 CTA / nav 4개: 우리음식·후기·브랜드·FAQ). verify GREEN.
- ▶ /our-food + /reviews 백그라운드 워크플로우(wf_11bfd373) 빌드 중 — web 전용(WebChrome 직접, 홈과 동일 패턴).

## 7. 아키텍처 주의 (중요)

- **홈(/)·/our-food·/reviews** = web 전용. WebChrome 직접 래핑(AuthAwareShell 미사용).
  앱 사용자는 미들웨어가 /dashboard 등으로 분기하므로 web 마케팅 라우트는 web만 그림.
- **기존 /faq·/about** = **AuthAwareShell** 사용(web+app 공용 dispatch). /faq 는
  DB(faqs 테이블) published + fallback. JSON-LD 빌드. → 그냥 WebChrome 으로 덮으면
  **앱 뷰가 깨짐**. FD 리빌드 시 ① AuthAwareShell 유지 + 콘텐츠만 FD 톤으로, 또는
  ② isAppContextServer() 로 web/app 분기(AGENTS.md 패턴2). 후속 단계에서 신중히.
  기능(DB fetch·JSON-LD·아코디언 details/summary)은 보존.

- ✅ **/our-food** (워크플로우) — Hero·재료6·조리·완전균형·비교표·맞춤(다크)·FinalCta·StickyCta. tsc/eslint GREEN, 렌더 확인.
- ✅ **/reviews** (워크플로우) — Hero(정직 평점)·필터탭·후기 placeholder 9·통계(준비중)·Featured·FinalCta. 가짜 후기/숫자 0. GREEN, 렌더 확인.
- D10: /about·/faq = AuthAwareShell **유지**(불변). 콘텐츠만 FD 톤으로 리스타일,
  /faq 의 DB fetch·JSON-LD·아코디언 보존. (WebChrome 직접 교체 = dispatch 변경이라 금지)
- ▶ 다음: /about FD 리스타일 → /faq FD 리스타일 → 푸터(FD 멀티컬럼, 법정 SiteFooter 위에) → 전체 verify.

- ✅ /about FD 리스타일(AuthAwareShell 유지, 6섹션 + 다크 promises + 코랄 CTA). GREEN, 웹뷰 렌더 확인.
- ✅ /faq FD 리스타일(DB fetch·JSON-LD·아코디언 보존, 카테고리별 + 코랄 + CTA). GREEN.
- ✅ FdFooter(둘러보기·고객지원 컬럼 + 워드마크 + 코랄 CTA) → 법정 SiteFooter 위. WebChrome 와이어. GREEN, 렌더 확인.

## 8. 현재 라이브 (검증 완료) — FD 웹 클론 핵심 完
헤더(FD) · 홈(10섹션) · /our-food · /reviews · /about · /faq · FdFooter+SiteFooter · sticky CTA.
전부 tsc/eslint GREEN, 프리뷰 렌더 OK, 콘솔 에러 0. 딥파인+크림+코랄, 코랄 pill, 샤프 카드, 비교표, 아코디언, 사진 placeholder, 정직 후기/숫자.

## 9. 남은 것 (후순위, 계속 진행)
- /blog(매거진) FD 톤 리스타일 ✅(회차1·2) · /contact 폼 FD 톤 ✅(회차3) · (선택)/breed·/diy
- 데스크톱 폭에서 각 페이지 2단 레이아웃 점검 · reduced-motion/Lighthouse
- 커밋(사장님 지시 시) · ~~트럭/구 farm v5 잔재 컴포넌트 정리~~ ✅(회차25, 10개 제거)
dev 주의: WebChrome import 변경 후엔 `.next` 비우고 재시작(스테일 청크 방지).

---

## 10. 사장님 긴급 3대 지시 (2026-06-13) + 회차17~25 진행 (옛 화면 FD화·a11y·정리)

> 큐 = `FD_CLONE_QUEUE.md` 섹션0 / FD 실구조 기준 = `FARMERSDOG_FIDELITY_SPEC.md`.

### 사장님 지시 (최우선)
- **① 옛 화면 전부 FD 재제작**(로그인·회원가입 등): 인증 로직·DB·리다이렉트 보존, presentation만 FD.
- **② 앱 ↔ 웹 완벽분리**: 웹 마케팅 페이지가 PWA(앱)에서 AppChrome(하단 탭바)로 넘어가면 안 됨 → 항상 WebChrome. 근본원인=웹 라우트 layout.tsx 의 AuthAwareShell 래핑 → 해법: page=WebChrome 직접 + layout=pass-through.
- **③ (가장 중요) 톤 흉내가 아니라 실레이아웃 순서·각요소 모션/슬라이드·디자인요소·상단메뉴까지 그대로 복제.** → FIDELITY_SPEC 이 전 페이지 기준.

### 진행 (회차17~25)
- ✅ **①인증 4종 FD화**(회차17~19): (auth)/login·signup·forgot·reset 색토큰 FD 리맵 + 파인 pill 제출버튼 + AuthHero(공유) FD 톤. Supabase 로그인·signup_profile·consent·referral·throttle·OAuth·redirect **전부 무수정**.
- ✅ **②완벽분리**(회차12·20): 콘텐츠 마케팅 페이지(faq·about·blog·contact) page=WebChrome 직접 + layout=pass-through. legal/business = 웹·앱 공유 유틸이라 AuthAwareShell 유지가 맞음(판단). 
- ✅ **③홈+하위 FD 실구조**(회차13~16·20·23): 홈 12섹션·our-food 10섹션·reviews 8섹션·about 9섹션·plans(모션 fidelity 보강) + 헤더 nav "수의사 전문가" 추가 + FdSlider 캐러셀.
- ✅ **a11y 대비/헤딩**(회차21·22): 밝은 bg 작은 코랄 링크 11곳→`--fd-coral-text`, our-food green-soft→흰색, sr-only h2(science·blog/[slug]), 데코 아이콘 aria-hidden.
- ✅ **①계정 패밀리 FD화**(회차24): /business·/account·/account/profile 옛 v4토큰→FD(pine/coral-text/green/green-soft/흰카드·`<Eyebrow>`·rounded-lg). AuthAwareShell·isApp·Supabase·redirect 보존.
- ✅ **정리**(회차25): 미사용 옛 landing/truck/journey 10개 제거(참조 전수검증, git 복구가능).

### 결정 로그 (사장님 검토용 — 내가 임의 결정한 것)
- **D11**: /account·/account/profile·/business = 웹·앱 **공유 인증/법정 유틸**(푸터·약관동의서 양쪽 링크) → AuthAwareShell **유지**가 맞음. ②지시("웹 *마케팅* 페이지")는 홈·our-food·reviews·plans 등 마케팅 라우트 한정. 앱 안에서 이들 누르면 AppChrome(탭바) 나오는 게 정상.
- **D12**: /welcome = PWA 첫실행 **온보딩 인터셉트**(자체 다크셸·robots noindex·헤더/탭바 의도 생략). 마케팅 아님 → ②범위 밖, **변경 안 함**.
- **D13**: cart/checkout/products = 커머스(불변) + 사장님 피벗(웹=설문 퍼널, 커머스 비노출)으로 **FD화 보류**. 정책 확정 시 진행.
- **D14 ▣ 사장님 결정 대기 (자동변경 금지)**: 주력 코랄 CTA의 **흰 텍스트 on 코랄(#F2674B) = 3.08:1**.
  - 측정: 버튼 라벨 sm 14px / md 15–16px / lg 16–17px, 전부 bold(800)이나 **18.66px 미만** → WCAG '큰 텍스트(3:1)' 자격 없음 → 본문 기준 **4.5:1(AA) 미달**. (버튼 *도형* 자체는 1.4.11 비텍스트 3:1은 통과.) 작은 코랄 링크/라벨은 이미 `--fd-coral-text`(#B63619)로 AA 처리 끝 — 이 항목은 **흰글자 코랄 pill 한정**.
  - **A. 현행 유지 (#F2674B)** — FD 라이브 추출 실제색, **fidelity 100%**. 단 CTA 라벨 a11y 3.08:1.
  - **B. #D8462A 로 교체** — 이미 정의된 `--fd-coral-ink`. 흰글자 **≈4.35:1** (AA에 거의 도달, 큰 텍스트 AA는 확실 통과). 톤은 살짝 더 깊은 코랄 — 브랜드 인상 거의 유지. **권고 절충안**.
  - **C. #C63E22 로 교체** — 흰글자 **≥4.5:1 (AA 정식 통과)**. 가장 안전하나 코랄이 다소 차분/벽돌톤.
  - **영향범위(토큰 1줄 `--fd-coral` 값 교체 시 전파)**: Button coral tone · Section coral bg · PhotoSlot coral 슬롯 · StickyCta · 코랄 뱃지/포인트 전부 동시 변경(일관). globals.css:77 한 줄. WebChrome/globals 변경이므로 `.next` 클리어+preview 재시작 필요.
  - 사장님 한마디(A/B/C)면 다음 크론 발동이 토큰 1줄 교체+검증+렌더확인까지 끝냄.
- **D15**: 옛 v4 토큰(--ink/--terracotta/--moss/--gold 등)은 globals.css 에 **정의는 유지**(아직 미전환 앱 v3 등이 참조) — 페이지별로 FD 토큰으로 갈아끼우는 방식. 전역 삭제 아님.
- **D16 (보조 라우트 분류, 회차54)**: 미분류 6종 점검 결과 —
  - `/best`·`/new` = `redirect('/products?sort=…')` **리다이렉트 stub** → 작업 불필요.
  - `/compare`(옛토큰0)·`/collections`(옛토큰21)·`/events`(옛토큰20·쿠폰/이벤트 허브) = `/products`·결제·쿠폰 참조하는 **커머스/프로모 surface → 피벗 보류**(cart/checkout/products와 동일). 커머스 정책 확정 시 진행.
  - `/partners`(옛토큰18) = **"농장 파트너 소개" 브랜드 마케팅 페이지**(소싱 스토리=설문 퍼널 브랜드와 부합) — 그런데 **bare `<main>`(WebChrome 없음→FD 헤더/푸터·앱웹 dispatch 누락) + 옛 v4 토큰 18개**. **FD화 대상**(큐 J 신설, 작게 쪼개 진행). 292줄.

### 달성 밀스톤 (회차11~133, 상세는 FD_CLONE_QUEUE.md 로그)
- **옛 색 0 — 전 web 표면**: 마케팅 13페이지 + 공유컴포넌트(web/fd·WebChrome·SiteFooter·auth·landing) + 루트 layout + error/404 + (auth)·account + legal 4페이지까지 var()형·Tailwind 클래스형·font-serif·rounded-2xl 모두 0(회차80 재스윕 검증). globals 정의부만 앱v3용 잔존=정상.
- **FD fidelity**: 홈 14섹션 스펙 1:1, FdSlider 캐러셀(키보드 a11y), 헤더 nav 5항목(수의사전문가→/science), 마퀴 신뢰strip, 백하프 다크 브레이크(VetVoices pine), 모션 스태거 일관(홈/our-food/reviews/blog), PhotoSlot(brand 히어로 추가).
- **a11y**: skip-link(WCAG2.4.1)·드로어 dialog 표준(role/aria-modal/aria-expanded/controls·Escape·포커스 진입·복귀)·nav aria-current(데스크톱/chip/drawer)·reduced-motion 이중 net·promo aria-live 안티패턴 제거.
- **SEO/메타**: OG 13/13·sitemap(/our-food·/reviews 보강)·robots·404 FD.
- **정직성**: StarDots 빈 dots(가짜 평점 제거)·후기 placeholder·가짜 숫자/보증/질병단정 0.
- **후속 하드닝·폴리시 (회차84~133)**: ①결제/안전 P0 다수 하드닝(R83~R88 — toss timeout·idempotency·부분환불·CASCADE→RESTRICT 등, 단 결제 *로직* 불변 범위 내). ②**Section0(사장님 긴급 ①재설계)·Section F(인증 표면) 종결**: 로그인=2단 split·계정 패밀리(/account·/account/profile·/business)·forgot/reset(AuthHero 중앙 hero) 전부 FD 재검증 완료(코드 옛토큰 누수 0; login·AuthHero docstring 거짓 정정 — 회차129~131). 주 진입(login·signup)=2단 브랜드패널 / 보조 트랜잭션(forgot·reset)=중앙 hero 의 의도적 tier 구분. ③**Breadcrumb JSON-LD 전 마케팅 표면**(our-food·reviews·plans·science·about·contact·newsletter·business·partners + blog/[slug]·faq, 회차118~128). ④blog/[slug] 읽는시간(122)·StickyCta(132, ISR-safe 정적 /signup) / FdFooter 둘러보기 nav 보강(133, +수의사전문가·농장파트너). ⑤정직성 3축 전수 grep 클린(가짜 기관/숫자/효능단정 0, 회차121)·가짜 5점 별점 4곳 제거(회차120).
- **사장님 결정 대기** (3건):
  1. **D14 코랄 CTA 대비비** — 흰-on-코랄(#F2674B) 3.08:1(본문 AA 미달). A.현행(fidelity) / B.#D8462A(≈4.35:1 권고) / C.#C63E22(≥4.5:1 정식AA) 중 택1. globals.css:77 1줄 교체.
  2. **웹 헤더 카트 아이콘** — 웹=설문 퍼널 피벗인데 헤더에 /cart 아이콘 노출(docstring상 "주문/체험팩 결제 흐름 살아있는 동안 유지"). 커머스 완전 제거 확정 시 숨김 여부 결정.
  3. **/events·/collections 처리(회차158·159)** — 둘 다 옛 v4 토큰 범벅+WebChrome 래퍼 없음=미마이그레이션 보류인데 sitemap 색인 등록(비노출 의도와 모순). (A)커머스 재개 시 FD 마이그+WebChrome / (B)지금 noindex+sitemap 제거로 비노출 실현 중 택1. 커머스 피벗 stance 결정 사안. (/best·/new는 옛토큰 없는 redirect alias=별건.)
- **보류**: 커머스(cart/checkout/products/compare/collections/events) 피벗 정책 확정 시. legal/business/account=AuthAwareShell 유지(색만 FD).
