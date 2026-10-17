/**
 * 등록성분량 — 사료관리법에 따라 레시피마다 등록한 성분량(정본 한 곳).
 *
 * 출처: 사장님 스마트스토어 상세페이지의 '등록성분량' 표(2026-10-15 받은 참고 자료, 레시피 4장) — 사장님 10/17
 * "지금은 등록성분대로 올려. '검사 결과가 나오면 올려요'라고 쓰면 미완성 업장 같다". 등록증 번호는 싣지 않는다(10/15).
 * 수분을 포함한 그대로(as-fed) 기준이다 — 습식 화식이라 수분이 75% 안팎.
 * 조단백질·칼슘·인은 '이상'(최소 보증), 조지방·조섬유·조회분·수분은 '이하'(최대 보증) — 등록 표기 그대로.
 * 등록을 바꾸면 이 표와 팩 라벨을 같이 고친다(규칙290 이 값이 비거나 한 칸이라도 빠지면 빨간불).
 */
import type { StoreRecipe } from './catalog.ts'

export type RegisteredRow = { name: string; pct: number; bound: '이상' | '이하' }

const row = (name: string, pct: number, bound: '이상' | '이하'): RegisteredRow => ({ name, pct, bound })

export const REGISTERED_ANALYSIS: Record<StoreRecipe, readonly RegisteredRow[]> = {
  chicken: [row('조단백질', 15.1, '이상'), row('조지방', 4.7, '이하'), row('조섬유', 0.3, '이하'), row('조회분', 2.2, '이하'), row('수분', 75.2, '이하'), row('칼슘', 0.3, '이상'), row('인', 0.3, '이상')],
  duck: [row('조단백질', 13.1, '이상'), row('조지방', 5.2, '이하'), row('조섬유', 0.3, '이하'), row('조회분', 2.1, '이하'), row('수분', 76.3, '이하'), row('칼슘', 0.3, '이상'), row('인', 0.3, '이상')],
  pork: [row('조단백질', 14.9, '이상'), row('조지방', 5.4, '이하'), row('조섬유', 0.2, '이하'), row('조회분', 2.1, '이하'), row('수분', 76.1, '이하'), row('칼슘', 0.3, '이상'), row('인', 0.3, '이상')],
  beef: [row('조단백질', 13.9, '이상'), row('조지방', 5.5, '이하'), row('조섬유', 0.3, '이하'), row('조회분', 2.1, '이하'), row('수분', 75.1, '이하'), row('칼슘', 0.3, '이상'), row('인', 0.3, '이상')],
}

/** 화면 표기 — '15.1% 이상'. */
export function registeredValue(r: RegisteredRow): string {
  return `${r.pct}% ${r.bound}`
}
