/**
 * 설문 알레르기 보기 — 정본(2026-10-09 앱 새 디자인, 시안 E09·F22·F22b · 앱시안 결정 20번·3번 '문구').
 *
 * ★이 라벨은 화면 글자이자 **저장값이자 추천 차단 키**다. 차단 게이트(v2 filterByAllergies · v3 excludeIfAllergy ·
 *  compute 누출 감지 · progression 게이트)는 SKU_MODEL.blockingAllergies 와 **글자 단위로** 비교한다
 *  (lib/start-allergy-labels.ts 머리글 — 영문 키가 그대로 저장돼 차단이 통째로 꺼졌던 사고). 라벨을 바꾸면
 *  blockingAllergies·/start 번역표를 같이 바꾸고, 옛 라벨로 저장된 답은 아래 별칭으로 새 라벨에 잇는다.
 *
 * 바뀐 것(사장님 10/8):
 *  · '계란'·'곡물 (밀/옥수수)' 보기 삭제 — 판매 4종 전부에 난각분말·현미가 들어가 걸러 줄 레시피가 없다.
 *    예전에 고른 답은 **지우지 않는다**(기록 — 차단엔 원래 안 쓰였다). 보기에서만 빠진다.
 *  · '연어·생선' → '연어' — 연어 고기만 피하는 선택(연어유는 4종 공통, 안내는 9/24 결정대로 안 넣음).
 *  · '고기·생선' / '그 밖의 재료' 두 묶음.
 */

export const ALLERGY_GROUPS = [
  { label: '고기·생선', options: ['닭·칠면조', '소고기', '돼지고기', '오리', '양고기', '연어', '흰살생선'] },
  { label: '그 밖의 재료', options: ['유제품', '대두', '감자', '견과류'] },
] as const

export const ALLERGY_OPTIONS: readonly string[] = ALLERGY_GROUPS.flatMap((g) => [...g.options])

/** 옛 라벨 → 지금 라벨. 저장된 옛 답을 화면에 불러올 때 쓴다(차단 표는 옛 라벨도 같이 들고 있다). */
export const LEGACY_ALLERGY_ALIASES: Readonly<Record<string, string>> = {
  '연어·생선': '연어',
}

/** 보기에서 뺀 라벨 — 저장된 답엔 남아 있을 수 있다(지우지 않는다). */
export const RETIRED_ALLERGY_OPTIONS: readonly string[] = ['계란', '곡물 (밀/옥수수)']

/**
 * 저장된 알레르기 답 → 지금 화면에 쓸 값. 옛 라벨만 새 라벨로 바꾸고(중복 제거) **나머지는 그대로 둔다** —
 * 모르는 값·뺀 보기를 버리면 다시 제출할 때 기록이 조용히 사라진다(없어지는 것보다 남는 게 안전).
 */
export function normalizeAllergyAnswers(list: readonly string[]): string[] {
  const out: string[] = []
  for (const v of list) {
    const next = LEGACY_ALLERGY_ALIASES[v] ?? v
    if (!out.includes(next)) out.push(next)
  }
  return out
}
