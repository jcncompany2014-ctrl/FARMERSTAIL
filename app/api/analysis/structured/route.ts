import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildAnalysisPrompt,
  parseAiAnalysis,
  type AiAnalysisContext,
} from '@/lib/nutrition/ai-prompt'
import { birthdayInfo } from '@/lib/nutrition/wow-angles'
import type { ChronicConditionKey } from '@/lib/nutrition/guidelines'
import { zAnalysisRequest } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import {
  checkAnthropicDailyCap,
  recordAnthropicUsage,
} from '@/lib/anthropic-usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROUTE = 'analysis-structured'

/**
 * POST /api/analysis/structured
 *
 * Body: { analysisId: string }
 * Output: { structured: AiAnalysisJson, cached: boolean }
 *
 * 분석 결과 (analyses) + 설문 (surveys) + 강아지 (dogs) 를 join 해 AI 에 보내고
 * 구조화된 JSON 분석을 받아 analyses.structured_analysis 에 캐시.
 *
 * (구 /api/analysis/commentary 는 2026-07-16 폐기 — 이 라우트가 유일한 AI 분석.)
 *
 * # 보호
 * - Zod 검증 (analysisId UUID)
 * - Rate limit: IP 당 분당 5건 — Anthropic 비용 공격 방어 (캐시 hit 는 cheap
 *   하니 후술 캐시 분기 후 limit 카운트 안 하는 변수도 검토 가능)
 */

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
  error?: { type?: string; message?: string }
}

export async function POST(req: Request) {
  // ★ 비용 가드(rate-limit·일일캡)는 아래 '실제 AI 생성 직전'으로 내렸다(2026-07-17).
  // 예전엔 여기 맨 앞이라, AI 를 전혀 안 부르는 **캐시 반환·쿨다운 재사용** 응답까지
  // 429/503 으로 막혀 — 일일캡이 걸리면 이미 생성돼 무료로 보여주던 코멘트조차
  // 전원에게 차단됐다. 캐시/재사용은 비용이 0 이므로 가드 뒤로 보낸다.

  // Zod 검증
  const parsed = await parseRequest(req, zAnalysisRequest)
  if (!parsed.ok) return parsed.response
  const { analysisId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  // 1) analysis 로드 + 소유자 검증
  const { data: analysis, error: aErr } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .eq('user_id', user.id)
    .single()
  if (aErr || !analysis) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '분석을 찾을 수 없어요' },
      { status: 404 },
    )
  }

  // 2) 캐시 — 이 분석에 이미 코멘트가 있으면 즉시 반환 (로딩 없이 바로).
  if (analysis.structured_analysis) {
    return NextResponse.json({
      structured: analysis.structured_analysis,
      cached: true,
    })
  }

  // 2.5) ★ 강아지 단위 쿨다운 + 구독자만 refresh (2026-07-16, 사장님) ───────────
  // 규칙: **첫 코멘트는 강아지당 1회, 전원 무료**(전환 훅). 그 후 2주마다 갱신되는
  // 리밋 해제는 **구독자에게만**. 비구독자는 첫 코멘트를 영구 동결해 계속 보여준다.
  //  · recent 없음(첫 코멘트)      → 아래로 떨어져 생성(전원 무료)
  //  · recent 있고 14일 내         → 재사용(전원, AI 0)
  //  · recent 있고 14일 지남 + 구독 → 재생성(구독자 refresh)
  //  · recent 있고 14일 지남 + 비구독 → 첫 코멘트 동결 재사용(AI 0)
  // 재분석하면 새 analysisId 가 생겨 위 2) 캐시를 비껴가므로 **같은 강아지**의
  // 최근 코멘트를 기준으로 판정하고, 재사용 시 이 분석 행에 복사한다.
  const COOLDOWN_MS = 14 * 86_400_000
  const { data: recent } = await supabase
    .from('analyses')
    .select('structured_analysis, structured_analysis_at')
    .eq('dog_id', analysis.dog_id)
    .eq('user_id', user.id)
    .not('structured_analysis', 'is', null)
    .order('structured_analysis_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent?.structured_analysis && recent.structured_analysis_at) {
    const ageMs = Date.now() - new Date(recent.structured_analysis_at).getTime()
    const withinCooldown = ageMs < COOLDOWN_MS

    // 쿨다운이 지났을 때만 구독 여부를 본다(구독자여야 refresh 허용).
    // 구독 = active/paused 이면서 카드 등록됨(billing_key). needs_card '시작 전' 제외.
    let subscribed = false
    if (!withinCooldown) {
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('dog_id', analysis.dog_id)
        .eq('user_id', user.id)
        .in('status', ['active', 'paused'])
        .not('billing_key', 'is', null)
        .limit(1)
      subscribed = (subs?.length ?? 0) > 0
    }

    // 재사용 조건: 쿨다운 내 OR 비구독. (구독자 + 쿨다운 지남만 아래로 떨어져 재생성.)
    if (withinCooldown || !subscribed) {
      await supabase
        .from('analyses')
        .update({
          structured_analysis: recent.structured_analysis,
          structured_analysis_at: recent.structured_analysis_at,
        })
        .eq('id', analysisId)
      return NextResponse.json({
        structured: recent.structured_analysis,
        cached: true,
      })
    }
    // else: 구독자 + 2주 경과 → 아래로 떨어져 재생성.
  }

  // ── 여기부터는 실제 AI 생성 경로(캐시·재사용에 안 걸린 요청만 도달) ──────────
  // 비용 가드를 여기서 적용 — Anthropic 을 실제로 부르는 요청만 rate-limit·일일캡에
  // 계상한다. (위 캐시/재사용 응답은 비용 0 이라 통과.)
  const ip = ipFromRequest(req)
  const rl = rateLimit({
    bucket: 'analysis-structured',
    key: ip,
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }
  const cap = await checkAnthropicDailyCap(ROUTE)
  if (cap.exceeded) {
    return NextResponse.json(
      {
        code: 'DAILY_CAP_EXCEEDED',
        message: '오늘 AI 사용량이 많아 잠시 후 다시 시도해 주세요',
      },
      { status: 503 },
    )
  }

  // 3) 강아지 + 설문 로드
  const { data: dog } = await supabase
    .from('dogs')
    .select('name, breed, breed_size, birth_date, weight, age_value, age_unit, neutered, activity_level, prescription_diet')
    .eq('id', analysis.dog_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '강아지 정보를 찾을 수 없어요' },
      { status: 404 },
    )
  }

  const { data: survey } = await supabase
    .from('surveys')
    .select(
      'mcs_score, bristol_stool_score, chronic_conditions, current_medications, current_food_brand, daily_walk_minutes, coat_condition, appetite, pregnancy_status',
    )
    .eq('id', analysis.survey_id)
    .maybeSingle()

  // 직전 분석 — 시계열 앵글용으로 BCS 외 급여량·생애주기·시각까지 가져온다.
  const { data: prevRows } = await supabase
    .from('analyses')
    .select('bcs_score, feed_g, stage, created_at')
    .eq('dog_id', analysis.dog_id)
    .eq('user_id', user.id)
    .lt('created_at', analysis.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
  const prev = prevRows && prevRows.length > 0 ? prevRows[0] : null

  // 직전 분석 이후 경과일 + 생일 D-day (이야깃거리 재료).
  const daysSinceLast =
    prev?.created_at && analysis.created_at
      ? Math.round(
          (new Date(analysis.created_at).getTime() -
            new Date(prev.created_at).getTime()) /
            86_400_000,
        )
      : null
  const bday = birthdayInfo(dog.birth_date ?? null, Date.now())

  // 4) Anthropic 호출
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json(
      {
        code: 'API_KEY_MISSING',
        message: 'AI 분석 기능이 비활성화되어 있어요',
      },
      { status: 503 },
    )
  }

  const ctx: AiAnalysisContext = {
    dogName: dog.name,
    breed: dog.breed ?? '믹스',
    ageValue: dog.age_value ?? 0,
    ageUnit: (dog.age_unit as 'years' | 'months') ?? 'years',
    weight: Number(dog.weight ?? 0),
    neutered: Boolean(dog.neutered),
    activity: (dog.activity_level as 'low' | 'medium' | 'high') ?? 'medium',
    stage: analysis.stage ?? '',
    bcsLabel: analysis.bcs_label ?? '',
    bcsScore: analysis.bcs_score ?? 5,
    mcsScore: survey?.mcs_score ?? null,
    bristolScore: survey?.bristol_stool_score ?? null,
    mer: Number(analysis.mer),
    feedG: Number(analysis.feed_g),
    proteinPct: Number(analysis.protein_pct),
    fatPct: Number(analysis.fat_pct),
    carbPct: Number(analysis.carb_pct),
    fiberPct: Number(analysis.fiber_pct),
    caPRatio: Number(analysis.ca_p_ratio),
    supplements: analysis.supplements ?? [],
    chronicConditions: (survey?.chronic_conditions ?? []) as ChronicConditionKey[],
    currentMedications: survey?.current_medications ?? [],
    currentFoodBrand: survey?.current_food_brand ?? null,
    pregnancyStatus: (survey?.pregnancy_status as 'none' | 'pregnant' | 'lactating' | null) ?? null,
    coatCondition: survey?.coat_condition ?? null,
    appetite: survey?.appetite ?? null,
    dailyWalkMinutes: survey?.daily_walk_minutes ?? null,
    riskFlags: analysis.risk_flags ?? [],
    prevBcsScore: prev?.bcs_score ?? null,
    breedSize: dog.breed_size ?? null,
    prevFeedG: prev?.feed_g != null ? Number(prev.feed_g) : null,
    prevStage: prev?.stage ?? null,
    daysSinceLast,
    daysUntilBirthday: bday?.daysUntil ?? null,
    turningAge: bday?.turningAge ?? null,
  }

  const prompt = buildAnalysisPrompt(ctx)
  let stopReason: string | null = null

  let text: string
  let usage: AnthropicResponse['usage']
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: (await import('@/lib/anthropic-models')).MODEL_HAIKU,
        // 2500 (기존 1500) — summary+highlights+transition(7일)+nextActions 를 한국어로
        // 채우면 1500 을 넘겨 JSON 이 중간에 잘리고 parse 가 실패했다(비용만 쓰고 캐시 0).
        max_tokens: 2500,
        // ── 프롬프트 캐싱 (2026-07-16) ──
        // system 은 가이드라인·규칙·질환 지식이라 **모든 강아지에게 똑같다**(길고 고정).
        // cache_control 로 표시하면 Anthropic 이 그 부분을 5분간 캐시해 **입력 토큰을
        // ~90% 깎아준다**. 강아지마다 다른 건 user(체중·품종)뿐이라 효과가 크다.
        // (블록 배열 형식이어야 cache_control 을 붙일 수 있어 문자열 → [{type:'text'}] 로.)
        system: [
          {
            type: 'text',
            text: prompt.system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: prompt.user }],
      }),
      cache: 'no-store',
      // Anthropic capacity hang 방어. 20초 안에 응답 없으면 abort.
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await res.json()) as AnthropicResponse & { stop_reason?: string }
    usage = data.usage
    stopReason = data.stop_reason ?? null
    if (!res.ok) {
      return NextResponse.json(
        {
          code: data.error?.type ?? 'ANTHROPIC_ERROR',
          message: data.error?.message ?? 'AI 응답을 받지 못했어요',
        },
        { status: 502 },
      )
    }
    text =
      (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n')
        .trim() ?? ''
    if (!text) {
      return NextResponse.json(
        { code: 'EMPTY_RESPONSE', message: 'AI가 빈 응답을 반환했어요' },
        { status: 502 },
      )
    }
  } catch (e) {
    return NextResponse.json(
      {
        code: 'FETCH_FAILED',
        message: e instanceof Error ? e.message : '알 수 없는 오류',
      },
      { status: 502 },
    )
  }

  // 사용량 누적 (best-effort). 호출은 성공했으니 parse 결과와 무관하게 기록
  // — 응답 토큰은 이미 과금됨.
  await recordAnthropicUsage(ROUTE, usage)

  const structured = parseAiAnalysis(text)
  if (!structured) {
    // 잘림(max_tokens)인지, 형식 오류인지 서버 로그로 남긴다 — 비용만 쓰고 캐시 0 이던
    // 원인을 눈으로 잡기 위해(2026-07-16). stop_reason='max_tokens' 면 상한을 더 올린다.
    console.error('[analysis-structured] PARSE_FAILED', {
      stopReason,
      textLen: text.length,
      tail: text.slice(-200),
    })
    return NextResponse.json(
      {
        code: 'PARSE_FAILED',
        message: 'AI 응답을 해석할 수 없어요',
        raw: text.slice(0, 500),
      },
      { status: 502 },
    )
  }

  // vetConsult 강화 — AI 가 false 라도 서버 측 risk_flags 가 강하면 덮어씀
  if (analysis.vet_consult_recommended && !structured.vetConsult.recommended) {
    structured.vetConsult = {
      recommended: true,
      reason:
        structured.vetConsult.reason ??
        '시스템이 위험 신호를 감지했어요. 주치 수의사와 상담을 권합니다.',
    }
  }

  // 5) 캐시 저장 (best effort). structured_analysis_at 을 **지금**으로 — 이 시각이
  //    강아지 2주 쿨다운의 기준이 된다(위 2.5 가 이 값을 본다).
  await supabase
    .from('analyses')
    .update({
      structured_analysis: structured,
      structured_analysis_at: new Date().toISOString(),
    })
    .eq('id', analysisId)

  return NextResponse.json({ structured, cached: false })
}
