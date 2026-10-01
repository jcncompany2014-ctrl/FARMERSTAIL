import type { AlgorithmInput, FoodLine } from './types.ts'

/**
 * 질환 때문에 뺀 레시피 라인 — 알레르기 차단처럼, 이후 어떤 룰도 다시 넣지 못한다. 정본 한 곳.
 *
 * # 왜 (2026-10-01 근거↔박스 스윕에서 발견)
 * 신장병 3단계·간질환·요로결석 룰이 한우를 빼고 "한우 레시피는 뺐어요"라고 말한 뒤, 같은 처방의 마른 체형
 * (BCS 3)·활동량 룰이 '고단백 = 한우'를 다시 올렸다. 9살 마른 신장병 강아지(케어 목표 일반)의 첫 박스가
 * **한우 100%** 로 나왔다 — 인(신장)·구리(간)·옥살산(결석) 때문에 뺀 바로 그 레시피다.
 *
 * firstBox 의 룰 순서(질환 → 체형 → 활동량 …)를 바꾸면 다른 결과가 다 흔들리므로, 순서는 두고
 * 마지막 단계들(위장 민감 중심 라인·정규화·가용성 대체·선호 첫 박스)에서 이 목록을 막는다.
 * 재제안(nextBox)도 같은 목록을 매 회차 막는다.
 *
 * 각 질환 룰(firstBox applyChronicAdjustments)과 같은 판정이어야 한다:
 *  · 신장: IRIS 1·2단계 = 단백질 정상(빼지 않음) · 4단계 = 한우·치킨 · 3단계·미진단·비정상 값 = 한우
 *  · 요로결석 = 한우 · 간질환 = 한우
 */
export function clinicallyExcludedLines(
  input: Pick<AlgorithmInput, 'chronicConditions' | 'irisStage'>,
): Set<FoodLine> {
  const out = new Set<FoodLine>()
  const c: readonly string[] = input.chronicConditions ?? []
  if (c.includes('kidney')) {
    const stage = input.irisStage
    if (stage === 4) {
      out.add('premium')
      out.add('weight')
    } else if (stage !== 1 && stage !== 2) {
      out.add('premium')
    }
  }
  if (c.includes('urinary_stone')) out.add('premium')
  if (c.includes('liver') || c.includes('hepatic')) out.add('premium')
  return out
}
