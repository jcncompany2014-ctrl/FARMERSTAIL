# 설문 퍼널 이미지 배치 가이드 (누끼 일러스트 / 상품 사진)

> 사장님 지시(2026-06-16): "모든 설문페이지에 누끼 일러스트·상품사진을 적재적소에." →
> 아래 6개 자리에 **PhotoSlot 플레이스홀더**를 배치 완료. 실제 이미지가 준비되면
> 각 PhotoSlot 에 `src`/`alt` 만 넣으면 즉시 사진으로 바뀐다(회차223 패턴, 하위호환).

## 자리(6) — 어디에 / 무엇을 / 비율

| # | 위치 | 들어갈 이미지 | 비율 | 파일·컴포넌트 |
|---|------|---------------|------|----------------|
| 1 | 랜딩 히어로 (우측, 모바일은 텍스트 아래) | 강아지 정면 또는 밥그릇+상품 누끼 — 첫인상 대표 | 4:3 | `app/start/page.tsx` Hero |
| 2 | 랜딩 스텝0 폼 위 | 강아지 슬림 환영 일러스트 | 16:5 | `app/start/page.tsx` Step0 |
| 3 | 랜딩 "이렇게 진행돼요" 3카드 | 단계별 작은 누끼 (강아지 / 설문 / 상품) | 3:2 | `app/start/page.tsx` FLOW map |
| 4 | 설문 각 문항 상단 띠 | 문항별 일러스트 (체형·단백질·밥그릇·사료·건강) | 16:6 | `app/start/StartSurvey.tsx` `QUESTION_ILLUST` |
| 5 | 결과 상단 큰 배너 | 강아지·상품 누끼 대표 컷 | 16:6 | `app/start/StartSurvey.tsx` 결과뷰 |
| 6 | 결과 구독 플랜 카드 안 | 신선식 상품 사진 (누끼 밀팩) | 16:8 | `app/start/StartSurvey.tsx` 플랜 카드 |

## 실제 이미지 주입 방법

1. 누끼 이미지를 `public/` 에 저장 (예: `public/start-hero.png`).
2. 해당 PhotoSlot 에 `src`/`alt` 추가:
   ```tsx
   <PhotoSlot label="..." src="/start-hero.png" alt="우리 아이 맞춤 신선식" ratio="4 / 3" ... />
   ```
   → `src` 가 있으면 라벨 플레이스홀더 대신 `object-cover` 사진으로 렌더(`components/web/fd/ui.tsx`).
3. 문항별(4)은 `QUESTION_ILLUST` 가 라벨만 들고 있으므로, 사진까지 키별로 주입하려면
   `Record<string,{label:string;src?:string}>` 로 확장 후 PhotoSlot 에 전달.

## 정직성
이미지는 디자인 미리보기용 플레이스홀더. 실제 사진은 **가짜 기관 로고·미검증 보증·질병 단정 컷 금지**(표시광고법). 강아지/상품/식단 일반 컷만.
