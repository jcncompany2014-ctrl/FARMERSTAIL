/**
 * 메시지 요소 분해 학습 — 발명 명세 6.7 (B-82).
 *
 * 능동 개입 메시지를 5 요소로 분해:
 *  1. intro      — 도입 (예: "안녕하세요" / "초롱이를 위해")
 *  2. problem    — 문제 인식 (예: "체중이 늘었어요" / "산책 줄었네요")
 *  3. evidence   — 근거 (예: "지난 2주 +0.5kg")
 *  4. action     — 권유 행동 (예: "사료 5g 줄여볼까요")
 *  5. reward     — 보상 / 인센티브 (예: "오늘 1000P 적립")
 *
 * 각 요소의 조합 (예: full / no-evidence / no-reward) 별 응답률을 비교 학습.
 * → 사용자 페르소나 별로 어떤 요소 조합이 효과 좋은지 발견.
 *
 * # PCT 핵심 — flag 가드
 * flag OFF 면 항상 'full' template 반환 (모든 5 요소 포함).
 */

import { isInventionEnabled } from '../invention-flags.ts'

export type MessageElement =
  | 'intro'
  | 'problem'
  | 'evidence'
  | 'action'
  | 'reward'

export type MessageTemplate = {
  id: string
  elements: MessageElement[]
  /** A/B 학습용 메타 */
  label: string
}

export const TEMPLATES: MessageTemplate[] = [
  {
    id: 'full',
    elements: ['intro', 'problem', 'evidence', 'action', 'reward'],
    label: '전체 (5 요소)',
  },
  {
    id: 'no_problem',
    elements: ['intro', 'evidence', 'action', 'reward'],
    label: '문제 인식 제거 (부드러운)',
  },
  {
    id: 'no_evidence',
    elements: ['intro', 'problem', 'action'],
    label: '근거 제거 (간단)',
  },
  {
    id: 'action_only',
    elements: ['action'],
    label: '행동만 (즉시)',
  },
  {
    id: 'reward_first',
    elements: ['reward', 'action'],
    label: '보상 우선',
  },
]

/**
 * 페르소나 별로 어떤 template 이 효과 좋은지 학습한 결과를 기반으로 선택.
 * 데이터 없으면 페르소나 default heuristic 반환.
 */
export function selectTemplate(
  persona:
    | 'data_lover'
    | 'emotional'
    | 'convenience'
    | 'vet_dependent'
    | null,
  /** template_id → CTR 매핑 (학습 결과). 없으면 default */
  ctrByTemplate?: Map<string, number>,
): MessageTemplate {
  if (!isInventionEnabled('meta_learning')) {
    return TEMPLATES[0] // full fallback
  }

  // 학습 데이터 있으면 best
  if (ctrByTemplate && ctrByTemplate.size > 0) {
    let bestId = TEMPLATES[0].id
    let bestCtr = -1
    for (const [id, ctr] of ctrByTemplate) {
      if (ctr > bestCtr) {
        bestId = id
        bestCtr = ctr
      }
    }
    return TEMPLATES.find((t) => t.id === bestId) ?? TEMPLATES[0]
  }

  // default heuristic
  switch (persona) {
    case 'data_lover':
      return TEMPLATES.find((t) => t.id === 'full') ?? TEMPLATES[0]
    case 'emotional':
      return TEMPLATES.find((t) => t.id === 'no_problem') ?? TEMPLATES[0]
    case 'convenience':
      return TEMPLATES.find((t) => t.id === 'action_only') ?? TEMPLATES[0]
    case 'vet_dependent':
      return TEMPLATES.find((t) => t.id === 'no_evidence') ?? TEMPLATES[0]
    default:
      return TEMPLATES[0]
  }
}

/**
 * 메시지 요소 → 한글 카피 합성. template.elements 순서대로 join.
 */
export function composeMessage(
  template: MessageTemplate,
  parts: Partial<Record<MessageElement, string>>,
): string {
  // audit #28: 빈 template.elements 또는 parts 가 모두 undefined 면 빈 문자열
  // 푸시 알림으로 발송되는 위험. action 또는 generic fallback.
  const result = template.elements
    .map((el) => parts[el])
    .filter((x): x is string => !!x)
    .join(' · ')
  if (!result) {
    return parts.action ?? parts.intro ?? '알림'
  }
  return result
}
