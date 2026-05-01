/**
 * 공용 blurDataURL — Next/Image 의 placeholder="blur" prop 에 넣을 base64.
 *
 * # 왜 동일 placeholder?
 * 동적 Supabase Storage 이미지는 build 시 blurhash 를 미리 계산할 수 없다.
 * 옵션:
 *   1) 사용자 첫 페인트에 단색 박스 (현재 패턴 — div 의 var(--bg-2) 배경)
 *   2) 모든 이미지에 같은 brand-tone blur — 페이지 일관성, 거의 cream/베이지
 *   3) 빌드/runtime 단계에서 per-image blurhash 계산 (6kb 추가 + RSC 호출)
 *
 * 현재 단계: (2) 가 비용 0 + 시각적으로 안정적. PLP 50개 카드가 모두 같은
 * cream blur 로 시작 → Image 로드 시 fade-in. 시멘틱 신호 (CLS / LCP) 도
 * placeholder="blur" 일 때 더 잘 잡힘.
 *
 * # 데이터
 * 8×6 픽셀 cream tone (#F5F0E6) PNG → base64. 약 200 bytes 미만. 한 번 로드되면
 * 모든 next/image 가 재사용.
 */

/**
 * 8×6 px solid cream (#F5F0E6) PNG, base64 인코딩.
 * 디자인 토큰 var(--bg) 와 일치.
 */
export const BLUR_CREAM =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAAAaA42UAAAAFElEQVQI12P8//8/AzbAxIAOaCwAALb6BYHcYC42AAAAAElFTkSuQmCC'

/**
 * 8×6 px solid bg-2 (#EDE6D8) PNG. 약간 진한 베이지 — 카드 위 이미지가 cream
 * 위에 올라갈 때 placeholder 가 사라져 보이지 않도록.
 */
export const BLUR_BG2 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAAAaA42UAAAAFElEQVQI12P88OEDAzbAxIAOaCwAAFf8AsHfWN1FAAAAAElFTkSuQmCC'

/**
 * 1×1 px transparent PNG — 프로덕트 카드처럼 부모가 이미 var(--bg-2) 배경을
 * 가진 경우 placeholder 자체를 얇게.
 */
export const BLUR_TRANSPARENT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='
