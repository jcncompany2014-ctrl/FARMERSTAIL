/**
 * category-meta — 모바일 cart 의 카테고리 태그 라벨/색 매핑 (2026-05-21).
 *
 * products.category 컬럼 (DB enum-like string) → 한글 라벨 + tint 배경.
 * CartList 와 CartAddMore 가 공유.
 */

export type CatKey =
  | 'meal'
  | 'topper'
  | 'treat'
  | 'set'
  | 'supplement'
  | 'premium'

export interface CatMeta {
  label: string
  /** 배지 배경 (rgba/translucent 권장) */
  bg: string
  /** 배지 텍스트 색 */
  fg: string
}

export const CAT_META: Record<CatKey, CatMeta> = {
  meal: { label: '화식', bg: 'rgba(93, 111, 63, 0.16)', fg: '#5d6f3f' },
  topper: { label: '토퍼', bg: 'rgba(232, 168, 46, 0.18)', fg: '#a87520' },
  treat: { label: '간식', bg: 'rgba(232, 168, 46, 0.18)', fg: '#a87520' },
  set: { label: '체험팩', bg: 'rgba(220, 83, 42, 0.16)', fg: '#dc532a' },
  supplement: {
    label: '영양제',
    bg: 'rgba(63, 127, 184, 0.14)',
    fg: '#3f7fb8',
  },
  premium: { label: '프리미엄', bg: 'rgba(232, 168, 46, 0.18)', fg: '#a87520' },
}
