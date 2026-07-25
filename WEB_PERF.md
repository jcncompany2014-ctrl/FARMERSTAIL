# 웹 성능 실측 (계획 D2) — 2026-07-25

프로덕션(`www.farmerstail.kr`) 실측. 대상은 **`/start`** — 인스타·오프라인 QR 이
전부 여기로 모이는 퍼널 진입점이라 여기 1초가 곧 전환율이다.
뷰포트 375×812(모바일).

## 측정값 (수정 전)

| 지표 | 값 | 평가 |
|---|---|---|
| TTFB | **47ms** | 매우 좋음 (Vercel icn1 + Supabase 서울) |
| FCP | 1,824ms | 개선 여지 |
| DOMContentLoaded | 1,789ms | |
| load | 2,403ms | |
| **총 전송량** | **4,291KB** | ★문제 |
| 리소스 수 | 55개 | |

전송량 내역: `link` 16개 **3,562KB** / `script` 17개 391KB / `img` 5개 319KB.

## 원인 — 전송량의 78%가 폰트였다

| 폰트 | 크기 | /start 에서 실제 사용 |
|---|---|---|
| PretendardVariable | **2,009KB** | ✅ 요소 218개 전부 |
| MaruBuri SemiBold | 455KB | ❌ **0개** |
| MaruBuri Bold | 441KB | ❌ **0개** |
| MaruBuri Regular | 424KB | ❌ **0개** |

브라우저에서 `document.fonts` 를 직접 확인한 결과 로드 완료된 건
`pretendard` · `Bungee` · `JetBrains Mono` 뿐 — **MaruBuri 1.32MB 는 preload 로
받아놓고 한 글자도 안 쓰였다.**

`next/font` 는 기본이 `preload: true` 라, root layout 에 CSS 변수를 붙이는 것만으로
**모든 라우트**에 `<link rel=preload>` 가 박힌다. MaruBuri 는 웹 랜딩의 serif
헤드라인 전용이고 앱 컨텍스트에서는 아예 안 쓰는데도 전 페이지에서 받고 있었다.

## 조치 — MaruBuri `preload: false`

`app/layout.tsx`. @font-face 정의와 `--font-serif` 매핑은 그대로 두고 preload 만 끈다.
실제로 serif 를 쓰는 웹 랜딩에서는 CSS 매칭 시점에 받고, `display: swap` 이라
그 사이 폴백으로 먼저 그려진다(글자가 사라지지 않는다).

**빌드 산출물 검증:** 프리렌더 HTML 전체에서 MaruBuri preload **25건 → 0건**,
Pretendard 는 25건 유지. CSS 의 `MaruBuri_Bold/Regular/SemiBold` @font-face 와
`--font-serif: "maruBuri", "maruBuri Fallback"` 매핑 생존 확인.

→ **모든 페이지에서 1.32MB 감소** (4.29MB → 약 2.97MB, −31%)

## 남은 개선 후보 (사장님 판단 필요)

1. **Pretendard 2MB 서브셋** — 가장 큰 단일 항목. 한글 전체 글리프를 담은
   변수 폰트라 원래 크다. `Pretendard-dynamic-subset`(unicode-range 로 100여 조각
   분할, 실사용분만 다운로드)로 바꾸면 통상 2MB → 50~100KB 수준이 된다.
   **다만 글리프 커버리지가 바뀌므로 희귀 한자·특수기호가 깨질 수 있다.**
   외형은 동일하지만 "디자인 동결" 기간이라 교체는 사장님 확인 후 진행 권장.
2. FCP 1.8s — TTFB 가 47ms 인데 FCP 가 1.8s 라는 건 렌더 차단이 JS/CSS 쪽이라는
   뜻. 폰트 1.32MB 를 덜어낸 뒤 재측정해서 남는지 먼저 볼 것.

## 재측정 방법

배포 후 브라우저에서 `www.farmerstail.kr/start` 를 375px 로 열고:
```js
performance.getEntriesByType('resource')
  .reduce((s, r) => s + (r.transferSize || 0), 0) / 1024
```
