# 파머스테일 랜딩 — "원물 트럭의 여정" 에셋 생성 프롬프트 (사실적 풍경 수채)

생성 도구: Higgsfield / Midjourney 둘 다 대응. 영어 묘사 프롬프트는 공통,
미드저니 전용 플래그(`--ar`, `--sref`, `--no`)는 따로 표기.

---

## 0. 공통 규칙 (모든 컷에 적용)

- **그림체**: 사실적 풍경 수채 (loose realistic watercolour landscape, wet-on-wet
  soft washes, gentle gradients, visible cold-press paper grain, soft edges,
  atmospheric perspective, painterly, muted natural palette). **외곽선 없음.**
- **팔레트 (반드시 고정)**:
  - 풀밭/언덕: sage green `#6B7F3A` ~ `#8A9E5B`
  - 하늘/종이: warm cream `#F5F0E6`
  - 흙길: soft clay beige `#EAE1CF`
  - 포인트: wheat gold `#D4B872`
  - (트럭) farm red-brick `#A0452E`, 어두운 면 walnut `#3D2B1F`
- **광원**: 빛은 **항상 좌측 상단**에서. (레이어 합칠 때 그림자 방향이 맞아야 함)
- **지평선**: 배경 컷은 화면 위에서 **약 45~52% 높이**에 통일.
- **그림자 금지**: 오브젝트(트럭/풍차/강아지) 바닥 그림자는 그림에 넣지 말 것
  (코드에서 따로 처리).
- **배경 제외 전부 투명 PNG** (배경 제거는 remove.bg → 가장자리 수작업 보정).
- **공통 네거티브(피할 것)**: `cartoon, vector, flat color, bold black outlines,
  clip art, 3d render, cgi, neon, oversaturated, harsh shadows, photo, text,
  watermark, frame, border`
  - 미드저니: 프롬프트 끝에 `--no outline, cartoon, vector, text, frame, 3d`

---

## 1. ★ 가장 먼저: 스타일 기준(앵커) 1장

> 이건 화면에 안 씀. "우리 그림체는 이거다" 견본. 이게 정해져야 나머지가 같은 톤으로 나옴.
> 마음에 드는 1장이 나오면 그 이미지를 **미드저니 `--sref` 또는 힉스필드 레퍼런스로
> 고정**하고 아래 레이어들을 뽑는다.

```
A serene rolling Korean farm landscape in loose realistic watercolour,
soft wet-on-wet washes, gentle sage-green hills receding into hazy distant
mountains, a warm cream sky, a soft clay dirt road winding down an S-curve,
a small white windmill far on a hill, light from the upper-left, calm and
warm, muted natural palette, visible paper texture, painterly soft edges,
no outlines, hand-painted, atmospheric perspective
```
미드저니: 위 프롬프트 + `--ar 3:2 --style raw`

---

## 2. 배경 레이어 (★ 언덕부터 — 지금 우선순위)

> 전부 **가로로 길고, 윗부분은 투명**. 같은 앵커 톤으로.
> 미드저니 투명 배경이 잘 안 나오면: "on a plain flat off-white background"로
> 뽑은 뒤 remove.bg.

### A1 — 하늘 (투명 아니어도 됨, 유일하게 꽉 찬 배경)
```
A soft warm watercolour sky, smooth gradient from pale cream at the top to
gentle wheat-gold near the horizon, wet-on-wet wash, visible paper grain,
empty (no sun, no clouds detail), calm, light from upper-left
```
미드저니: `--ar 16:10`  · 슬롯: `A1_sky` · 파일: `/public/landing/a1-sky.webp`

### A2 — 먼 산맥 (흐릿한 원경, 채도 낮게)
```
Distant misty mountain ridges in pale desaturated blue-green watercolour,
2 or 3 overlapping layers fading into haze, very soft edges, low detail,
atmospheric perspective, transparent background, light from upper-left
```
미드저니: `--ar 16:5` · 슬롯: `A2_farMountain` · 파일: `a2-far-mountain.png`

### A3 — 중간 언덕 (진한 초록 + 나무 실루엣)
```
A row of mid-distance green hills in soft watercolour, deeper sage green,
subtle field stripes, a few soft tree-cluster silhouettes on the ridge,
gentle washes, no outlines, transparent background, light from upper-left
```
미드저니: `--ar 12:5` · 슬롯: `A3_midHill` · 파일: `a3-mid-hill.png`

### A4 — ★ 앞 언덕 + 지그재그 길 (제일 중요)
```
A bright sage-green grassy foreground hill in soft realistic watercolour,
with a soft clay-beige dirt road winding from the far top-centre down to the
bottom in a gentle S-curve, the road narrow far away and widening as it comes
near, two soft bends, delicate grass texture, no outlines, soft edges,
transparent background, light from upper-left
```
미드저니: `--ar 9:5` · 슬롯: `A4_frontHillRoad` · 파일: `a4-front-hill-road.png`
- ⚠️ 트럭이 이 길 위를 달리므로, **이 컷이 정해지면 나한테 보여줘** — 길 곡선에
  맞춰 트럭 좌표(웨이포인트)를 1회 맞춘다. (이미 코드에 좌표 상수로 빼둠)

### A5 — 풍차/헛간 (랜드마크, 선택)
```
A small white Dutch-style windmill on a grassy mound, soft watercolour,
warm cream body, muted red-brown roof and blades, gentle wash, no outline,
transparent background, light from upper-left
```
미드저니: `--ar 7:10` · 슬롯: `A5_windmill` · 파일: `a5-windmill.png`

---

## 3. 트럭 · 강아지 (언덕 OK 된 다음 배치)

### T1 — 측면 트럭 (왼쪽을 보고 달리는 측면)
```
A small vintage farm truck seen from the side, facing left, soft realistic
watercolour, farm red-brick cab, natural wooden cargo bed with pumpkins,
carrots and leafy greens peeking over the top, gentle washes, no outline,
no ground shadow, transparent background, light from upper-left
```
미드저니: `--ar 16:9` · 슬롯: `T1_truckSide` · 파일: `t1-truck-side.png`
- 우측 진행은 코드에서 좌우반전 → 따로 안 뽑아도 됨 (적재함 글자 넣지 말 것).

### T3 — ★ 정면 도착 트럭 (클라이맥스, 제일 공들일 1장)
```
A vintage farm truck seen from the front, soft realistic watercolour,
farm red-brick cab with windshield, grille, two round headlights, bumper and
licence plate, behind the cab a wide wooden cargo bed full of fresh produce —
pumpkin, carrots, broccoli, leafy greens and a wooden crate — gentle washes,
warm, no outline, no ground shadow, transparent background, light upper-left
```
미드저니: `--ar 5:4` · 슬롯: `T3_truckFront` · 파일: `t3-truck-front.png`

### B1 — 달리는 강아지 (마중 나오는, 측면)
```
A happy small dog running, seen from the side facing left, soft realistic
watercolour, cream-white fur, a wheat-gold collar, tail up, gentle washes,
no outline, no ground shadow, transparent background, light from upper-left
```
미드저니: `--ar 4:3` · 슬롯: `B1_dog` · 파일: `b1-dog.png`

---

## 4. 도구별 메모

**Midjourney**
- 앵커 1장 확정 → 그 이미지 URL을 `--sref <url>`로 모든 레이어에 붙여 톤 고정.
- 오브젝트(트럭/강아지/풍차)는 `isolated single object, plain off-white
  background` 추가해서 뽑고 remove.bg.
- 투명 PNG가 필요한 컷은 생성 후 remove.bg(또는 포토샵 개체 선택).

**Higgsfield**
- `--sref`가 없으면: 앵커 이미지를 **레퍼런스 이미지로 첨부**하고 "match this
  painting style, same palette and lighting"을 프롬프트에 추가.
- 마찬가지로 배경 제거는 remove.bg.

**공통 팁 (스펙 6번)**
- 레이어가 각각 톤이 어긋나면, 풍경을 **통째로 1장** 뽑은 뒤 포토샵에서
  산/언덕 경계를 따서 분리하는 게 각각 생성보다 톤이 잘 맞는다.
- 트럭과 배경을 **한 장에 같이 생성하지 말 것** — 분리가 안 되면 패럴랙스 불가.

---

## 5. 다 뽑은 다음 (교체 방법 — 코드 안 건드림)

1. 받은 파일을 위의 파일명대로 `C:\Users\A\Desktop\projects\farmerstail-app\public\landing\` 에 넣는다.
   (폴더 없으면 만들기)
2. `lib/landing/journeyConfig.ts` 의 `ASSET_SLOTS` 에서 해당 슬롯의
   `src: null` → `src: '/landing/파일명'` 으로 바꾼다. (또는 나한테 "넣었어"
   하면 내가 한 번에 연결)
3. 끝. placeholder 가 실제 그림으로 자동 교체된다.

내보내기 규격: 표기 비율 유지, **@2x 해상도**(레티나), 배경 제외 투명 PNG
(최종 배포 시 내가 WebP 변환).

---

## 6. 추천 진행 순서

1. **앵커 1장** (스타일 견본) — 마음에 들 때까지.
2. **A4 앞 언덕+길** → 나한테 보여주기 (트럭 좌표 맞춤).
3. A1 하늘 → A2 먼 산 → A3 중간 언덕 → A5 풍차.
4. 언덕 톤 OK 되면 T1 / T3 / B1.

MVP(이것만 있어도 화면 됨): **A1·A2·A3·A4 + T1·T3·B1** 7장.
