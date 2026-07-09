# DESIGN_DEAI_PLAN — "AI 티 벗기기" 시그니처 디자인 계획

> 작성 2026-07-09 (Fable, frontend-design 스킬 진단 기반) · 실행 담당: Opus
> 사장님 승인: "사진 빼고 나머지 전부 ㄱ" (2026-07-09). 사진(실사 촬영)은 사장님 직접.

## 0. 배경 — 왜 이 작업인가

frontend-design 스킬의 AI 디자인 클리셰 진단:
**"웜 크림 배경 + 고대비 세리프 + 테라코타 포인트"는 현재 AI가 가장 많이
만드는 디폴트 룩 1번**이고, 우리 웹(#F7F5F0 + #EDE8D9 + #C86B45 + 마루부리)이
정확히 그 안에 있다. 앱 v3(헤어라인 룰 + 모노 킥커)도 클리셰 3번(신문형)에 걸침.

팔레트 자체는 FD 실물 레퍼런스 + 사장님 어스톤 승인(2026-06-15)이므로 **유지**.
전략은 색을 바꾸는 게 아니라 **팔레트 위에 파머스테일만의 것을 얹는 것**:

1. **Track A** — 도장(스탬프) 시그니처: 브랜드 최고 고유 자산을 아이콘 감옥에서 해방
2. **Track B** — 영문 모노 킥커 → 한글 라벨 (AI 에디토리얼 틱 제거)
3. **Track C** — 그리드 브레이크 + 손글씨 캡션 (의도적 불완전함, 실사 사진 슬롯 선행)
4. **Track D** — 실측 숫자 카피 (⛔ HOLD — 착수 조건 아래 명시)

## 1. 절대 가드레일 (위반 시 롤백)

1. **AGENTS.md 전체 준수** — 특히 app/web 분리(`data-ft-chrome` 스코프), 결제/체크아웃
   로직·법정 푸터 불가침, v3 스케일(radius 4단계 / type 8단계 / spacing 8pt) 외 값 금지.
2. **팔레트 전면 교체 금지.** 기존 토큰 값 변경 금지 — 신규 토큰 **추가만** 허용.
3. **`/recipe/[protein]` URL·라우팅 절대 불변** (실물 인쇄 QR이 이 주소를 가리킴).
4. **FEED_CALORIE_HOLD.md 침범 금지.** `lib/mix-feeding.ts`, kcal 숫자 표기(현재
   설계값 168~206), 급여량 로직 일절 건드리지 않는다. 실측 kcal(112~117) 노출 금지 —
   Track D 착수 조건 미충족 상태.
5. **모션 예산 = 신규 1곳** (앱 일기 도장 모먼트). 그 외 신규 스크롤 리빌/애니메이션
   추가 금지. `prefers-reduced-motion` 시 모든 신규 모션은 정적 표시로 대체.
6. **린 방식** — 대규모 병렬 에이전트 금지. 직접 편집, phase당 5~15분, phase마다
   `npm run verify`(no-pipe), push 전 `rm -rf .next && npx next build`.
7. **프리뷰 환경 한계** — hidden 탭이라 스크린샷 타임아웃·IntersectionObserver 미발화.
   검증은 DOM eval/computed style로. 모션 최종 확인은 사장님 실기기.
8. 효능 단정·질병 치료 표현 금지(식품 표시광고 가드). 도장 문구도 사실만.

## 2. 조사에서 확정된 사실 (재조사 불필요)

| 항목 | 사실 |
|---|---|
| 마루부리 | **이미 웹 --font-serif로 적용됨** (Phase Q 2026-06-12, `app/layout.tsx:50`). 서체 트랙은 이 계획에서 제외 |
| 손글씨체 Gaegu | 이미 로드됨 (`--font-hand`, `app/layout.tsx:93`) — 사용처는 `components/web/fd/ui.tsx` 뿐. Track C에서 재활용 |
| 도장 잉크색 | 실물 컷아웃(`public/icons/icon-512.png`) 불투명 픽셀 평균 = **#694036** (마룬브라운). 신규 토큰의 근거 |
| 도장 원본 에셋 | `public/icons/icon-512.png`(누끼) / `public/logo-stamp.png`(크림 배경 포함) |
| v3 킥커 컴포넌트 | `components/v3/Mono.tsx` — 한글 렌더 이미 지원(letterSpacing 0.04em·wordSpacing -0.12em 조정 완료). 컴포넌트 수정 불필요, **내용물(문구)만** 전환 대상 |
| 킥커류 사용 규모 | uppercase/tracking 패턴 128곳 · 60+파일 (웹+앱 합산) — 인벤토리 선행 필수 |
| 앱 일기 저장 성공점 | `app/(main)/dogs/[id]/diary/DiaryClient.tsx:176` `toast.success('일기를 저장했어요')` |
| 레시피 상세 데이터 | `lib/recipe-detail.ts` (카피는 사장님 검토 대기 중 — 문구 수정 금지, 구조 추가만) |

---

## Track A — 도장(스탬프) 시그니처 ★핵심

### A-0. 토큰 추가
`lib/design/tokens.ts` V3에 1개 추가 (globals.css `:root`에도 미러):
```ts
/** 실물 스탬프 잉크 — icon-512 누끼 불투명 픽셀 평균 샘플(2026-07-09). 도장 전용. */
stamp: '#694036',
```
accent(#C86B45)·accentDeep(#782E22)과 **혼용 금지** — 도장은 항상 이 색.
"실물에서 샘플링한 색"이라는 점이 이 트랙의 존재 이유다.

### A-1. `components/brand/InkStamp.tsx` (신규 — 웹/앱 공용, 서버 안전)
순수 SVG 컴포넌트. 실제 검수 도장의 관용을 따른다:
- 원형 **이중 테두리** (외곽 ~2.5, 내곽 ~1), 중앙 텍스트 1~2줄 + 선택적 날짜 줄
- 잉크 질감: `feTurbulence`(fractalNoise) + `feDisplacementMap`(scale 1.5~2.5)로
  가장자리 거칠기, 전체 opacity 0.9~0.92 — "고르게 안 찍힌 도장" 느낌
- props: `lines: string[]`(1~2줄), `sub?: string`(날짜 등), `size?: number`(기본 96),
  `rotate?: number`(기본 -4), `className?`
- 텍스트: Pretendard 700~800, letterSpacing 0.08em (세리프 금지 — 도장은 각인체)
- 장식이면 `aria-hidden`, 의미 전달이면 `role="img"` + aria-label prop
- hex 직접 사용 금지 — `V3.stamp` / `var(--stamp)` 참조

### A-2. 적용처 ① /recipe/[protein] 4종 (웹, QR 유입 페이지)
- 위치: "우리 기준 4카드" 섹션 헤더 우측 or 히어로 사진 우하단 오버랩 중
  레이아웃 덜 깨지는 쪽 (rotate -6°, size ~92)
- 문구(사실만): `["파머스테일 주방", "직접 조리 · 검수"]` + sub: `SINCE 2026`
- ⚠️ "농림축산검역본부 검정" 등 **기관명 표기는 넣지 않는다** — 표기 규정 확인
  전. 사장님 결정 대기 항목 §7-①
- 4페이지 모두 동일 도장 (SKU별 변형 금지 — 시그니처는 하나)

### A-3. 적용처 ② 앱 일기 저장 "도장 쾅" 모먼트 (모션 예산 유일 사용처)
`components/v3/StampMoment.tsx` (신규, 앱 전용):
- 트리거: DiaryClient 저장 성공. 기존 `toast.success` **대체** (이중 알림 방지,
  에러 경로 toast는 유지)
- 모션: 오버레이 중앙에 도장이 scale 1.5·opacity 0 → 90ms에 scale 0.96(임팩트)
  → settle 1.0, rotate -4° 고정, 총 ~450ms(`V3Transition.slow` 커브),
  800ms 유지 후 fade-out. 잉크 스플랫 파티클은 **넣지 않는다**(과함)
- 도장 문구: `["기록 완료"]` + sub: 오늘 날짜(`M.D`)
- 가능하면 `navigator.vibrate(10)` (지원 기기 한정, try 없이 optional chaining)
- reduced-motion: 모션 없이 400ms 정적 표시 후 사라짐
- `sessionStorage` 카운트 등으로 빈도 제한하지 **말 것** — 매 저장마다 찍히는 게 맞음
  (도장은 기록의 보상)

### A-4. (옵션 — 사장님 취향 확인 후) 웹 홈 신뢰 섹션 배경 워터마크
`app/page.tsx` 신뢰/스토리 밴드 1곳에 size 240·opacity 0.04 정적 도장.
기본은 **미적용** — §7-② 답변 받으면 반영.

## Track B — 영문 모노 킥커 → 한글 라벨

### B-1. 인벤토리 (코드 변경 없는 phase)
grep (`Mono`, `uppercase`, `tracking-[0.1*em]`, `letterSpacing: '0.1`)으로 전수 수집
→ `KICKER_INVENTORY.md` 생성: `파일:라인 | 현재 문구 | 분류 | 제안 | 판정`.

### B-2. 판정 기준 (이 표 그대로 적용)
| 분류 | 예 | 처리 |
|---|---|---|
| 데이터성 mono | `D-1`, `3.2kg`, 날짜, 카운터, 시간 | **유지** (mono가 정보) |
| 브랜드 고유 영문 | `FARM·TO·TAIL`, `Farmer's Tail` | **유지** |
| farm v4 스펙 넘버링 | Cormorant italic `No. 01`, Archivo `001` | **유지** (승인된 기획) |
| 장식성 영문 섹션 라벨 | `RECIPE`, `FAMILY`, `OVERVIEW`, `WHY APP` 류 | **한글 전환** — `레시피`, `가족`, `개요`처럼 1:1. Mono 컴포넌트 그대로(한글 지원됨), 문구만 교체 |
| 애매 (혼합·뉘앙스) | `Hello, Seongmin · evening` 류 | 표에 ⚠️ 남기고 **건드리지 않음** → 사장님 판정 |

### B-3. 적용
"한글 전환" 판정분만 일괄 교체. 한글 라벨에 `upper` 무의미하니 그대로 두되
(무해), 시각 확인은 대표 화면 3곳(앱 홈·강아지 상세·웹 홈) DOM eval.

## Track C — 그리드 브레이크 + 손글씨 캡션 (실사 슬롯 선행)

### C-1. `components/web/fd/Polaroid.tsx` (신규, 웹 전용)
- 흰 프레임(상좌우 ~12px, 하단 ~44px 캡션 영역), `rotate` prop ±3° 이내,
  그림자는 아주 얕게(기존 --fd 톤), 캡션은 `--font-hand`(Gaegu 700) + inkMute
- 사진은 next/image, 캡션 텍스트 prop

### C-2. 배치 — 정확히 2곳만 (페이지당 1곳 절제)
1. 웹 홈 스토리/신뢰 섹션 1곳 — 기존 이미지 중 하나를 폴라로이드로 감싸고
   캡션 예: `오늘 아침 주방에서`
2. `/why-app` MORE_FEATURES 그리드 상단 1곳 — 캡션 예: `산책 다녀와서 한 장`
- **사장님 실사 도착 시 src만 교체**하면 되도록 주석으로
  `{/* TODO(사장님 실사): /public/photo-kitchen-01.jpg 로 교체 */}` 규약 명시
- 완벽 정렬 그리드를 깨는 게 목적 — 폴라로이드가 그리드 셀보다 살짝 회전·돌출

## Track D — 실측 숫자 카피 ⛔ HOLD (착수 금지)

**착수 조건: ① 사장님 레시피/단가 확정 ② FEED_CALORIE_HOLD.md 해제.** 둘 다
충족 전에는 이 트랙의 어떤 코드도 만지지 않는다. (현 kcal 표기 168~206은 설계값,
실측 112~117과 다름 — 지금 숫자를 얹으면 서로 모순되는 숫자가 사이트에 공존하게 됨.)

조건 충족 후 할 일(예약): 형용사 카피를 검증 가능한 숫자로 —
- 패턴: "저온에서 오래" → "62°C에서 N시간 수비드" / "영양 균형" → "실측 NNNkcal/100g ·
  검정성적서 기준" / "신선한 재료" → "제조 후 N일 내 도착"
- 삽입 위치: `/recipe/*` 성분표 placeholder, `/why-fresh` 공정 섹션, `/our-food`,
  `/plans` 신뢰 밴드

---

## 5. 실행 순서 (phase당 5~15분, 각 phase 끝 = verify + 커밋)

| Phase | 내용 | 완료 판정 |
|---|---|---|
| P1 | A-0 토큰 + A-1 InkStamp 컴포넌트 | verify 통과, 임시 페이지 없이 P2에서 실사용으로 확인 |
| P2 | A-2 레시피 4종 도장 | 프리뷰 DOM에서 4페이지 SVG 존재·위치 확인 |
| P3 | A-3 StampMoment + DiaryClient 연결 | verify + reduced-motion 분기 코드 리뷰 |
| P4 | B-1 인벤토리 생성 (코드 무변경) | KICKER_INVENTORY.md 완성 |
| P5 | B-3 명백 항목 일괄 전환 | verify + 대표 3화면 DOM 확인 |
| P6 | C-1·C-2 폴라로이드 2곳 | verify + DOM 확인 |
| P7 | `rm -rf .next && npx next build` → push/배포 → 프로덕션 200 확인 | 배포 URL 4곳 스팟체크 |

문제 발생 시: 해당 phase만 되돌리고 다음 phase 진행 가능 (트랙 간 의존성은
P1→P2·P3 뿐).

## 6. 완료 정의 (DoD)
- [ ] `npm run verify` 그린, 클린 빌드 그린, 배포 후 주요 페이지 200
- [ ] 신규 hex 직접 사용 0건 (토큰 참조만)
- [ ] 신규 모션 1곳뿐이며 reduced-motion 분기 존재
- [ ] KICKER_INVENTORY.md에 유지/전환/⚠️ 판정 전수 기록
- [ ] 기존 토큰 값·kcal 숫자·/recipe URL·결제 로직 diff 0

## 7. 사장님 결정 대기 (실행 중 차단 아님 — 병행 질문)
1. 도장 문구에 검정 기관명 표기 여부 (표기 규정 확인 필요 — 기본은 미표기)
2. A-4 웹 홈 워터마크 적용 여부 (기본 미적용)
3. KICKER_INVENTORY.md의 ⚠️ 항목 판정
4. 실사 사진 촬영 (Track C 폴라로이드 src 교체용 — 주방·강아지·손 클로즈업 폰 촬영이면 충분)
