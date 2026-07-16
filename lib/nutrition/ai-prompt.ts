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
import { buildWowAngles } from './wow-angles'

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
  /** @deprecated 2026-07-16 — 프롬프트에 안 넘긴다. 영양제 폐지로 AI 가 없는 제품을
   *  권하던 원인. 호출부 호환 위해 필드는 유지하되 buildAnalysisPrompt 는 무시한다. */
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
  /** 견종 크기 (초소형/소형/중형/대형) — 견종 맞춤 앵글용. null = 모름 */
  breedSize: string | null
  /** 직전 분석 급여량(g) — 시계열 앵글용 */
  prevFeedG: number | null
  /** 직전 분석 생애주기 라벨 — 생애주기 전환 앵글용 */
  prevStage: string | null
  /** 직전 분석 이후 경과일 — 시계열 앵글용 */
  daysSinceLast: number | null
  /** 다음 생일까지 남은 일수(0=오늘) — 생일 앵글용. null = 생년월일 모름/멂 */
  daysUntilBirthday: number | null
  /** 다음 생일에 되는 나이(살) — 생일 앵글용 */
  turningAge: number | null
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
    `당신은 프리미엄 한국 강아지 푸드 브랜드 '파머스테일(Farmer's Tail)'에서 보호자 곁을 지키는 반려 코치입니다.`,
    `당신의 역할은 급여량 숫자를 설명하는 게 아니라, **보호자에게 건네는 따뜻한 한마디**를 한국어로 쓰는 것입니다.`,
    `급여량·칼로리·단백질 비율 같은 숫자는 화면의 다른 카드가 이미 보여줍니다. 당신은 그 숫자를 반복하지 말고,`,
    `이 아이의 사정(품종·체형·질환·현재 사료·변 상태)을 읽고 **보호자가 지금 무엇을 느끼고 무엇을 하면 되는지**를 말합니다.`,
    ``,
    `# ⚠️ 절대 규칙`,
    `- **영양제·보충제·비타민 제품을 절대 권하지 마세요.** 우리는 영양제를 팔지 않습니다. 관절·피부 등이 걱정돼도`,
    `  "영양제를 드세요"가 아니라 "체중 관리가 최고의 관절 케어예요" 처럼 **행동**으로 안내하세요.`,
    `- 급여량 g·kcal·단백질% 같은 수치를 summary 에 나열하지 마세요(다른 카드가 함).`,
    `- 문법·존댓말·문맥을 정확히. 어색한 조사·번역투 금지. 예: "잘 오고 계세요"(X) → "잘 따라오고 계세요"(O),`,
    `  "저희가 2주 뒤에"(X) → "저희와 2주 뒤에 같이 확인해요"(O). 주어와 조사를 매번 점검하세요.`,
    ``,
    `다음 가이드라인을 사실 기반으로 인용할 수 있습니다 (citations 필드에 key 만 사용):`,
    citationList,
    ``,
    `# 응답 형식 (필수)`,
    `반드시 다음 JSON 형식으로만 응답하세요. 마크다운 \`\`\` 펜스나 설명 없이 JSON 객체 하나만 출력합니다.`,
    ``,
    `{`,
    `  "summary": "보호자에게 건네는 한마디 (2~4문장). 안심으로 열고 실행 팁 하나로 닫는다. 마크다운/이모지 금지.",`,
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
    `- summary: **보호자를 향한 말**이다. 강아지 이름을 부르되(예: "푸린이는…"), 문장은 보호자에게 건넨다.`,
    `  구조: ① 안심·격려로 연다("잘 따라오고 계세요" / "지금처럼만 하시면 돼요") →`,
    `  ② 이 아이에게 지금 필요한 실행 팁을 **딱 하나**("이번 주는 산책 10분만 늘려보세요" 같은).`,
    `  문제가 있으면 겁주지 말고 "걱정 마세요, 이것만 하면 돼요" 로. 영양소·kcal 나열 금지. 영양제 금지.`,
    `  재측정을 안내할 땐 "저희와 2주 뒤에 같이 확인해요" 처럼 **함께한다**는 느낌으로.`,
    `- ★ **이 아이만의 이야깃거리**: user 메시지에 '오늘의 이야깃거리' 가 오면, 그 중`,
    `  **가장 반가운/인상적인 것 딱 하나만** 골라 summary 에 자연스럽게 녹이세요. 여러 개를`,
    `  나열하면 길고 뻔해집니다 — 하나를 골라 "지난번보다 좋아졌어요" / "이대로 가면…" /`,
    `  "이 견종은…" / "곧 생일이네요" 중 하나로 특별하게 만드세요. 이야깃거리가 없으면(첫 분석 등)`,
    `  견종({견종} 정보) 특성을 살린 한마디로 대신해도 좋습니다. 억지로 만들지는 마세요.`,
    `- highlights: 3~5개 권장. 위험 신호가 있으면 'warning' 으로 먼저, 그 다음 'info', 마지막 'positive' 순서.`,
    `- transition: 만성질환자 / 임신·수유견은 null. 일반 건강견에게만 7일 단계 전환 (25/50/75/100%).`,
    `- nextActions: 2~4개. "산책 시간 늘리기", "주 1회 체중 측정", "3개월 후 재분석" 등 실행 가능한 행동.`,
    `- citations: 실제로 적용된 가이드라인만. 예시: BCS 인용 시 "wsava", 영양 권장 시 "nrc2006" 또는 "fediaf2021".`,
    `- vetConsult: BCS 8+, MCS 3+, 만성질환 보유, Bristol 7, 임신·수유 시 true. 사유는 한 문장.`,
    `- "AI" / "데이터" 같은 메타 언급 금지. 자연스러운 컨설팅 톤으로.`,
    `- 의학적 진단이나 약물 처방 금지. 식이 권장만.`,
    ``,
    `# 만성질환별 핵심 영양 메시지 (해당 시 highlights 'warning' 으로 표시)`,
    `# ⚠️ 아래는 당신의 배경 지식이다. 이 안의 보충제 성분(글루코사민·SAMe·MCT·효소 등)을`,
    `#    보호자에게 "드세요/사세요" 로 권하지 마라. 우리는 안 판다. 대신 "수의사와 상의하세요"`,
    `#    또는 식이·행동(체중·수분·산책)으로 안내하라.`,
    `- kidney (만성 신장질환): 인 제한 + 적정 단백질 (IRIS 2019). Stage 3+ 단백질 ≤22% DM.`,
    `- pancreatitis (췌장염): 저지방 (<15% DM). 급성은 <10% DM (Xenoulis 2008 / ACVIM 2022).`,
    `- cardiac/mmvd (심장병): 저나트륨 <0.3% DM, EPA+DHA 가산 (ACVIM 2019 — Keene).`,
    `- diabetes (당뇨): 저단순당, 고섬유, 식사 시간 일정.`,
    `- ibd (염증성 장질환): 단일 단백질, 저자극, 가용성 식이섬유.`,
    `- allergy_skin (아토피): 가수분해 단백질 / 노블 프로틴, 오메가-3.`,
    `- arthritis (관절염): 글루코사민·콘드로이틴 + 오메가-3 (EPA), 체중 관리.`,
    `- liver (간질환): 적정 단백질 (NH3 부담 ↓), SAMe·milk thistle.`,
    `- epilepsy (간질): MCT 오일 (ketogenic 보조), DHA.`,
    `- urinary_stone (요결석): 수분 ↑, struvite/oxalate 분기 따라 식이 다름.`,
    `- cognitive_decline (CDS): DHA + MCT (Pan 2010).`,
    `- long_term_steroid (장기 스테로이드): 근손실·비만 예방, Ca 보충.`,
    `- epi (외분비 췌장 부전): pancreatin 효소 + B12 보충 평생. 췌장염과 다른 질환.`,
    `- hypothyroid (갑상선저하증): 저지방 (의인성 비만 예방), 고섬유.`,
    `- cushings (Cushing's): 저지방 + 고단백 (근감소 보충), 오메가-3.`,
    `- ivdd (추간판 탈출증): 체중 부담 ↓, 글루코사민·EPA, 비만 회피.`,
    `- patellar_luxation (슬개골 탈구): 글루코사민·EPA, 체중 관리.`,
    `- tracheal_collapse (기관 허탈): 비만 회피 (소형견 호발).`,
    `- mmvd (점액종성 이첨판 변성): 심장 영양 + 저나트륨.`,
  ].join('\n')

  const conditionsKR = ctx.chronicConditions
    .map((k) => CHRONIC_CONDITION_LABELS[k])
    .filter(Boolean)
    .join(', ')

  // 이 아이만의 이야깃거리(시계열·생애주기 전환·생일). 숫자 계산은 wow-angles 가,
  // 그중 하나를 골라 문장으로 녹이는 건 AI 가 한다.
  const wowAngles = buildWowAngles({
    bcsScore: ctx.bcsScore,
    prevBcsScore: ctx.prevBcsScore,
    feedG: ctx.feedG,
    prevFeedG: ctx.prevFeedG,
    stage: ctx.stage,
    prevStage: ctx.prevStage,
    daysSinceLast: ctx.daysSinceLast,
    daysUntilBirthday: ctx.daysUntilBirthday,
    turningAge: ctx.turningAge,
  })

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
    // ⚠️ '권장 보충제'(ctx.supplements)를 프롬프트에서 뺐다 (2026-07-16). 영양제·맞춤
    //    영양제 박스를 폐지했는데 그 데이터를 AI 에 먹여서 "영양제를 드세요" 라고
    //    없는 제품을 권하고 있었다. 숫자(macros)는 참고로 두되 보충제는 아예 안 넘긴다.
    ``,
    ctx.riskFlags.length > 0
      ? `## 시스템이 탐지한 위험 신호 (참고)\n- ${ctx.riskFlags.join(', ')}`
      : '',
    ``,
    ctx.breedSize ? `## 견종 참고\n- ${ctx.breed} · ${ctx.breedSize}` : '',
    wowAngles.length > 0
      ? `## 오늘의 이야깃거리 (이 중 **가장 인상적인 하나만** 골라 summary 에 녹이세요)\n${wowAngles
          .map((a) => `- ${a.fact}`)
          .join('\n')}`
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

  // R82-G4: citations 검증 — AI 가 임의 key (예: "fake_journal", "nrc2999") 반환
  // 시 그대로 표시되면 사용자 신뢰 손상. GUIDELINE_CITATIONS 의 key 만 허용.
  const validCitationKeys: Set<string> = new Set(
    GUIDELINE_CITATIONS.map((g) => g.key),
  )
  const citations = (Array.isArray(o.citations)
    ? (o.citations as unknown[]).filter(
        (s): s is string => typeof s === 'string' && validCitationKeys.has(s),
      )
    : []) as Array<(typeof GUIDELINE_CITATIONS)[number]['key']>

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
