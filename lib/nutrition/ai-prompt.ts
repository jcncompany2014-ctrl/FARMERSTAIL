/**
 * AI 분석 v2 — 구조화된 영양 분석 프롬프트.
 *
 * 출력 형식: 엄격한 JSON. 클라이언트가 zod 로 검증해서 표시.
 * 이전 (commentary.ts) 의 자유 문장 3~4 줄과 다른 점:
 *   - 위험 신호 카드 (warning/info/positive)
 *   - 7일 식단 전환 플랜
 *   - 가이드라인 인용 (NRC/AAFCO/FEDIAF 명시)
 *   - 수의사 상담 권고 여부
 *   - 다음 행동 권유
 */

import {
  CHRONIC_CONDITION_LABELS,
  GUIDELINE_CITATIONS,
  type ChronicConditionKey,
} from './guidelines'

export type AiAnalysisContext = {
  dogName: string
  breed: string
  ageValue: number
  ageUnit: 'years' | 'months'
  weight: number
  neutered: boolean
  activity: 'low' | 'medium' | 'high'
  stage: string
  bcsLabel: string
  bcsScore: number
  mcsScore: number | null
  bristolScore: number | null
  mer: number
  feedG: number
  proteinPct: number
  fatPct: number
  carbPct: number
  fiberPct: number
  caPRatio: number
  supplements: string[]
  chronicConditions: ChronicConditionKey[]
  currentMedications: string[]
  currentFoodBrand: string | null
  pregnancyStatus: 'none' | 'pregnant' | 'lactating' | null
  coatCondition: string | null
  appetite: string | null
  dailyWalkMinutes: number | null
  riskFlags: string[]
  prevBcsScore: number | null
}

/**
 * AI 가 반환해야 하는 JSON schema (zod 미사용 — 가벼운 런타임 검증만).
 * AI 응답을 유연하게 파싱: 필수 필드만 강제, 부가 필드는 옵션.
 */
export type AiAnalysisJson = {
  /** 1~2 문단 종합 의견 (한국어, 정중체) */
  summary: string
  /**
   * 핵심 포인트 카드. type 별 톤 다르게 표시:
   *   warning: 빨간 / 즉시 조치 필요
   *   info: 파란 / 참고 사항
   *   positive: 초록 / 긍정 신호
   */
  highlights: Array<{
    type: 'warning' | 'info' | 'positive'
    title: string
    body: string
  }>
  /**
   * 7일 식단 전환 플랜 (현재 식단 → 새 식단). 현재 브랜드를 알면 명시,
   * 모르면 generic. transition 객체 자체는 옵션 — 신규 가입자에겐 안 줌.
   */
  transition: {
    days: Array<{ day: number; oldPct: number; newPct: number; note: string }>
    finalNote: string
  } | null
  /** 다음 행동 — 예: "주 1회 체중 측정 후 4주 후 재분석" */
  nextActions: string[]
  /** 인용 출처 키 (GUIDELINE_CITATIONS.key 중) */
  citations: string[]
  /** 수의사 상담 강력 권장 여부 + 사유 */
  vetConsult: {
    recommended: boolean
    reason: string | null
  }
}

const ACTIVITY_KR: Record<'low' | 'medium' | 'high', string> = {
  low: '낮음 (거의 안 움직임)',
  medium: '보통 (하루 1~2회 산책)',
  high: '활동적 (뛰어다니기 좋아함)',
}

function ageText(v: number, u: 'years' | 'months'): string {
  return `${v}${u === 'years' ? '살' : '개월'}`
}

function bcsTrend(cur: number, prev: number | null): string {
  if (prev === null) return '직전 기록 없음 (첫 분석)'
  const delta = cur - prev
  if (delta === 0) return `직전 BCS ${prev}에서 변화 없음`
  if (delta > 0) return `직전 BCS ${prev}에서 +${delta}단계 (체중 증가 추세)`
  return `직전 BCS ${prev}에서 ${delta}단계 (체중 감소 추세)`
}

export function buildAnalysisPrompt(ctx: AiAnalysisContext): {
  system: string
  user: string
} {
  const citationList = GUIDELINE_CITATIONS.map(
    (c) => `- ${c.key}: ${c.label} (${c.title}, ${c.org})`,
  ).join('\n')

  const system = [
    `당신은 프리미엄 한국 강아지 푸드 브랜드 '파머스테일(Farmer's Tail)'의 수의영양 컨설턴트입니다.`,
    `당신의 역할은 보호자에게 정확하고 보수적이며 안심할 수 있는 영양 분석을 한국어로 제공하는 것입니다.`,
    ``,
    `다음 가이드라인을 사실 기반으로 인용할 수 있습니다 (citations 필드에 key 만 사용):`,
    citationList,
    ``,
    `# 응답 형식 (필수)`,
    `반드시 다음 JSON 형식으로만 응답하세요. 마크다운 \`\`\` 펜스나 설명 없이 JSON 객체 하나만 출력합니다.`,
    ``,
    `{`,
    `  "summary": "1~2 문단의 종합 영양 의견. 강아지 이름을 부르고, 정중체. 마크다운 / 이모지 금지.",`,
    `  "highlights": [`,
    `    { "type": "warning|info|positive", "title": "짧은 제목", "body": "1~2 문장 설명" }`,
    `  ],`,
    `  "transition": {`,
    `    "days": [{ "day": 1, "oldPct": 75, "newPct": 25, "note": "..." }, ...],`,
    `    "finalNote": "전환 완료 후 한 줄 안내"`,
    `  } | null,`,
    `  "nextActions": ["권장 행동 1", "권장 행동 2", ...],`,
    `  "citations": ["nrc2006", "aafco2024", ...],`,
    `  "vetConsult": { "recommended": true|false, "reason": "사유 (recommended=true일 때만)" | null }`,
    `}`,
    ``,
    `# 톤 / 내용 규칙`,
    `- summary: 강아지 이름 사용. 정중체. 핵심 포인트 1~2개만. 모든 영양소 나열 금지.`,
    `- highlights: 3~5개 권장. 위험 신호가 있으면 'warning' 으로 먼저, 그 다음 'info', 마지막 'positive' 순서.`,
    `- transition: 만성질환자 / 임신·수유견은 null. 일반 건강견에게만 7일 단계 전환 (25/50/75/100%).`,
    `- nextActions: 2~4개. "산책 시간 늘리기", "주 1회 체중 측정", "3개월 후 재분석" 등 실행 가능한 행동.`,
    `- citations: 실제로 적용된 가이드라인만. 예시: BCS 인용 시 "wsava", 영양 권장 시 "nrc2006" 또는 "fediaf2021".`,
    `- vetConsult: BCS 8+, MCS 3+, 만성질환 보유, Bristol 7, 임신·수유 시 true. 사유는 한 문장.`,
    `- "AI" / "데이터" 같은 메타 언급 금지. 자연스러운 컨설팅 톤으로.`,
    `- 의학적 진단이나 약물 처방 금지. 식이 권장만.`,
  ].join('\n')

  const conditionsKR = ctx.chronicConditions
    .map((k) => CHRONIC_CONDITION_LABELS[k])
    .filter(Boolean)
    .join(', ')

  const userLines = [
    `# ${ctx.dogName} 의 분석을 부탁드립니다.`,
    ``,
    `## 기본 정보`,
    `- 견종: ${ctx.breed}`,
    `- 나이: ${ageText(ctx.ageValue, ctx.ageUnit)}`,
    `- 체중: ${ctx.weight}kg`,
    `- 중성화: ${ctx.neutered ? '완료' : '미완료'}`,
    `- 활동량: ${ACTIVITY_KR[ctx.activity]}${ctx.dailyWalkMinutes ? ` · 산책 ${ctx.dailyWalkMinutes}분/일` : ''}`,
    `- 생애주기: ${ctx.stage}`,
    ctx.pregnancyStatus && ctx.pregnancyStatus !== 'none'
      ? `- 임신·수유: ${ctx.pregnancyStatus === 'pregnant' ? '임신 중' : '수유 중'}`
      : '',
    ``,
    `## 체형·근육 평가 (WSAVA)`,
    `- ${ctx.bcsLabel} (${bcsTrend(ctx.bcsScore, ctx.prevBcsScore)})`,
    ctx.mcsScore !== null ? `- MCS ${ctx.mcsScore}/4` : '- MCS 미기재',
    ``,
    `## 변·소화`,
    ctx.bristolScore !== null ? `- Bristol Stool ${ctx.bristolScore}/7` : '- 미기재',
    ``,
    `## 만성질환 / 약물`,
    conditionsKR ? `- 진단 질환: ${conditionsKR}` : '- 없음',
    ctx.currentMedications.length > 0
      ? `- 복용 약/보충제: ${ctx.currentMedications.join(', ')}`
      : '- 복용 중인 약 없음',
    ctx.currentFoodBrand ? `- 현재 주식: ${ctx.currentFoodBrand}` : '',
    ctx.coatCondition ? `- 모질·피부: ${ctx.coatCondition}` : '',
    ctx.appetite ? `- 식욕: ${ctx.appetite}` : '',
    ``,
    `## 시스템이 산출한 일일 권장 (계산 기반 — 우리 가이드라인 분기 결과)`,
    `- MER: ${ctx.mer} kcal/일`,
    `- 급여량: ${ctx.feedG}g/일`,
    `- 단백질: ${ctx.proteinPct}% / 지방: ${ctx.fatPct}% / 탄수: ${ctx.carbPct}% / 식이섬유: ${ctx.fiberPct}%`,
    `- Ca:P 비율: ${ctx.caPRatio}`,
    ctx.supplements.length > 0
      ? `- 권장 보충제: ${ctx.supplements.join(', ')}`
      : '',
    ``,
    ctx.riskFlags.length > 0
      ? `## 시스템이 탐지한 위험 신호 (참고)\n- ${ctx.riskFlags.join(', ')}`
      : '',
    ``,
    `위 데이터를 바탕으로 위 형식의 JSON 으로만 응답해 주세요.`,
  ]
    .filter(Boolean)
    .join('\n')

  return { system, user: userLines }
}

/**
 * AI 응답 텍스트 → AiAnalysisJson 파싱. 안전한 fallback 포함.
 */
export function parseAiAnalysis(text: string): AiAnalysisJson | null {
  // 마크다운 ```json ... ``` 펜스 제거
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '')
  // 시작 { 부터 마지막 } 까지만 잘라내기
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  cleaned = cleaned.slice(start, end + 1)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>

  // 필수 필드 검증
  if (typeof o.summary !== 'string' || o.summary.trim().length < 10) return null
  if (!Array.isArray(o.highlights)) return null

  // sanitize
  const highlights = (o.highlights as unknown[])
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
    .map((h) => ({
      type:
        h.type === 'warning' || h.type === 'info' || h.type === 'positive'
          ? (h.type as 'warning' | 'info' | 'positive')
          : ('info' as const),
      title: typeof h.title === 'string' ? h.title : '',
      body: typeof h.body === 'string' ? h.body : '',
    }))
    .filter((h) => h.title && h.body)

  let transition: AiAnalysisJson['transition'] = null
  if (o.transition && typeof o.transition === 'object') {
    const t = o.transition as Record<string, unknown>
    if (Array.isArray(t.days)) {
      transition = {
        days: (t.days as unknown[])
          .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
          .map((d) => ({
            day: Number(d.day) || 1,
            oldPct: Number(d.oldPct) || 0,
            newPct: Number(d.newPct) || 0,
            note: typeof d.note === 'string' ? d.note : '',
          })),
        finalNote: typeof t.finalNote === 'string' ? t.finalNote : '',
      }
    }
  }

  const nextActions = Array.isArray(o.nextActions)
    ? (o.nextActions as unknown[]).filter((s): s is string => typeof s === 'string')
    : []

  const citations = Array.isArray(o.citations)
    ? (o.citations as unknown[]).filter((s): s is string => typeof s === 'string')
    : []

  const vc = (o.vetConsult ?? {}) as Record<string, unknown>
  const vetConsult = {
    recommended: vc.recommended === true,
    reason: typeof vc.reason === 'string' ? vc.reason : null,
  }

  return {
    summary: o.summary,
    highlights,
    transition,
    nextActions,
    citations,
    vetConsult,
  }
}
