/**
 * Farmer's Tail — Formula 한국어 포매터.
 *
 * `Formula` 객체를 고객에게 노출할 수 있는 한국어 텍스트로 변환.
 * 알림 / 이메일 / 구독 동의 모달 등에서 동일 표현 유지.
 *
 * 모두 pure function — DB / 네트워크 / Date 호출 없음.
 *
 * (2026-07-24 정리: 라인 비율%·요약 포매터 7종은 prod 미사용이라 삭제.
 *  고객 노출은 recipeName[원물명] + friendlyChangeReason[변경 사유] 둘뿐.)
 */
import { FOOD_LINE_META, ALL_LINES } from './lines.ts'
import type { Formula } from './types.ts'

/**
 * 고객 알림용 원물(레시피) 이름 — 비율(%) 없이 원물명만.
 *
 * 박스는 최대 2종(섞으면 반반)이라, 비중 있는 라인 최대 2개의 고객표시명
 * (nameKo: 치킨·오리·흑돼지·한우)을 뽑아 "한우·치킨 레시피"처럼 만든다.
 * 형용사가 붙은 subtitle('프레시 한우 레시피')이 아니라 nameKo 를 쓰므로
 * '프레시'·'무항생제' 같은 수식어는 자동 배제된다.
 *
 * (사장님 2026-07-23: 알림에 "소고기 60% 메인" 같은 비율 표기 금지 —
 *  두 원물을 섞으면 무조건 반반이므로 %는 오해를 부른다. 원물+레시피로.)
 */
export function recipeName(formula: Formula): string {
  const active = ALL_LINES.filter((l) => formula.lineRatios[l] > 0)
    .sort((a, b) => formula.lineRatios[b] - formula.lineRatios[a])
    .slice(0, 2)
    .map((l) => FOOD_LINE_META[l].nameKo)
  const label = active.length > 0 ? active.join('·') : '맞춤'
  return `${label} 레시피`
}

const ALLERGY_PROTEIN_KO: Record<string, string> = {
  chicken: '닭',
  duck: '오리',
  pork: '돼지',
  beef: '소',
  salmon: '연어',
}

/**
 * 다음 박스 변경 사유를 고객 언어 한 문장으로 — 구독페이지 동의 모달·알림용.
 * forced(알레르기·건강)는 안전 프레이밍, 그 외(몸무게 등)는 담백하게.
 * 개발 문구(diff.forceReasons)를 그대로 노출하지 않기 위함(사장님 2026-07-23).
 */
export function friendlyChangeReason(
  reasoning: Array<{ ruleId: string }>,
  forced: boolean,
): string {
  if (forced) {
    const allergy = reasoning.find(
      (r) =>
        r.ruleId.startsWith('allergy-') || r.ruleId.startsWith('next-allergy-'),
    )
    if (allergy) {
      const key = allergy.ruleId.replace(/^next-/, '').replace(/^allergy-/, '')
      const ko = ALLERGY_PROTEIN_KO[key]
      return ko
        ? `새로 등록한 ${ko} 알레르기를 반영하려고요.`
        : '새로 등록한 알레르기를 반영하려고요.'
    }
    return '건강 상태(만성질환)를 반영하려고요.'
  }
  return '그동안의 체크인과 몸무게 변화를 반영했어요.'
}
