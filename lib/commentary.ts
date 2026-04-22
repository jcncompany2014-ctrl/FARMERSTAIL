/**
 * Prompt builder for AI-generated nutrition commentary.
 * Server-only helper — consumed by `app/api/analysis/commentary/route.ts`.
 */

export type CommentaryContext = {
  dogName: string
  breed: string
  ageValue: number
  ageUnit: 'years' | 'months'
  weight: number
  activity: 'low' | 'medium' | 'high'
  stage: string // 한글 라벨 (예: "성견 (유지기)")
  bcsLabel: string
  bcsScore: number
  mer: number
  feedG: number
  proteinPct: number
  fatPct: number
  carbPct: number
  fiberPct: number
  caPRatio: number
  supplements: string[]
  /** 직전 분석의 BCS 점수 (없으면 null) */
  prevBcsScore: number | null
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
  if (prev === null) return '(직전 기록 없음)'
  const delta = cur - prev
  if (delta === 0) return `(직전 BCS ${prev}에서 변화 없음)`
  if (delta > 0) return `(직전 BCS ${prev}에서 +${delta}단계 증가)`
  return `(직전 BCS ${prev}에서 ${delta}단계 감소)`
}

export function buildCommentaryPrompt(ctx: CommentaryContext): {
  system: string
  user: string
} {
  const system = [
    "당신은 프리미엄 강아지 푸드 브랜드 '파머스테일(Farmer's Tail)'의 전담 수의영양 컨설턴트입니다.",
    '따뜻하고 간결한 한국어로, 보호자가 안심할 수 있는 톤으로 분석 코멘트를 작성하세요.',
    '',
    '규칙:',
    '- 정확히 3~4문장으로 작성하세요.',
    '- 이모지, 마크다운, 제목, 리스트를 사용하지 마세요. 순수 문장만 출력하세요.',
    '- 강아지를 이름으로 부르세요.',
    '- 단백질·지방·탄수화물 비율 중 1~2개의 핵심 포인트만 짚으세요 (모두 나열 금지).',
    '- BCS 추세가 있으면 한 문장으로 언급하세요.',
    '- 보충제 추천은 이유와 함께 최대 1개만 언급하세요.',
    '- 끝 문장은 보호자를 안심시키거나 다음 행동(식단/산책 등)을 제안하세요.',
    '- "좋아요", "걱정 마세요" 같은 과도한 구어체는 피하고 전문성 있는 정중체를 쓰세요.',
  ].join('\n')

  const lines = [
    `## ${ctx.dogName} 기본 정보`,
    `- 견종: ${ctx.breed}`,
    `- 나이: ${ageText(ctx.ageValue, ctx.ageUnit)}`,
    `- 체중: ${ctx.weight}kg`,
    `- 활동량: ${ACTIVITY_KR[ctx.activity]}`,
    `- 생애주기: ${ctx.stage}`,
    '',
    '## 체형',
    `- ${ctx.bcsLabel} · BCS ${ctx.bcsScore}/9 ${bcsTrend(ctx.bcsScore, ctx.prevBcsScore)}`,
    '',
    '## 일일 권장 에너지/급여량',
    `- MER: ${ctx.mer} kcal/일`,
    `- 급여량: ${ctx.feedG}g/일`,
    '',
    '## 영양소 구성 (DM basis)',
    `- 단백질: ${ctx.proteinPct}%`,
    `- 지방: ${ctx.fatPct}%`,
    `- 탄수화물: ${ctx.carbPct}%`,
    `- 식이섬유: ${ctx.fiberPct}%`,
    `- Ca:P 비율: ${ctx.caPRatio}`,
    '',
    '## 맞춤 보충제',
    ctx.supplements.length > 0
      ? ctx.supplements.map((s) => `- ${s}`).join('\n')
      : '- 해당 없음',
    '',
    `위 데이터를 바탕으로 ${ctx.dogName}의 보호자에게 전할 분석 코멘트를 작성해 주세요.`,
  ]

  return { system, user: lines.join('\n') }
}
