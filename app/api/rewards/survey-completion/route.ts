import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { capAllowance, annualCapFor } from '@/lib/rewards/cap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/rewards/survey-completion
 *
 * 설문 완료 보상 적립 — 1,000P. 연 한도 5,000P (audit 1-3).
 *
 * 이전엔 SurveyClient 에서 `apply_point_delta` RPC 를 직접 호출 →
 * 사용자는 강아지 N마리 등록하면 N * 1,000P 무한 적립 가능했음.
 * 이제 서버 측에서:
 *   1. 인증 확인
 *   2. survey_id 가 해당 사용자의 강아지 소유인지 확인
 *   3. 연 누적 + 1,000P 가 cap 을 넘으면 잔여분만 적립 (0이면 skip)
 *   4. service-role 로 ledger 안전하게 기록
 *
 * 멱등성: apply_point_delta 의 unique index (user_id, reference_type,
 *   reference_id) 가 같은 survey 재적립 차단.
 */

const SurveyRewardSchema = z.object({
  surveyId: z.string().uuid(),
})

const REWARD_AMOUNT = 1000

export async function POST(req: Request) {
  // 결제 confirm 수준의 가벼운 rate limit — 동일 사용자가 분당 30회 이상
  // 호출하면 차단. 정상 흐름은 설문 1건 = API 1콜.
  const rl = rateLimit({
    bucket: 'rewards-survey',
    key: ipFromRequest(req),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, SurveyRewardSchema)
  if (!parsed.ok) return parsed.response
  const { surveyId } = parsed.data

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

  // 설문이 이 사용자 소유인지 확인 — RLS 가 막아주긴 하지만 명시적 확인.
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, user_id')
    .eq('id', surveyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!survey) {
    return NextResponse.json(
      { code: 'SURVEY_NOT_FOUND', message: '설문을 찾을 수 없어요' },
      { status: 404 },
    )
  }

  // 연 cap 검사 — 잔여분만 보상.
  const admin = createAdminClient()
  const allowed = await capAllowance(
    admin,
    user.id,
    'survey_completion',
    REWARD_AMOUNT,
  )

  if (allowed === 0) {
    return NextResponse.json({
      ok: true,
      amount: 0,
      capped: true,
      annualCap: annualCapFor('survey_completion'),
      message:
        '올해 설문 응원 포인트 한도(' +
        annualCapFor('survey_completion').toLocaleString() +
        'P) 에 도달했어요. 정성 들여 작성해주셔서 감사드려요.',
    })
  }

  // service-role 로 ledger 기록. 멱등성은 partial unique index 에 위임.
  const { data: rpcData, error } = await admin.rpc('apply_point_delta', {
    p_user_id: user.id,
    p_delta: allowed,
    p_reason: '정성껏 답변해주신 설문 응원 포인트',
    p_reference_type: 'survey_completion',
    p_reference_id: surveyId,
  })

  if (error) {
    return NextResponse.json(
      { code: 'LEDGER_FAILED', message: error.message },
      { status: 500 },
    )
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
  const alreadyApplied = row?.message === 'already_applied'

  return NextResponse.json({
    ok: true,
    amount: alreadyApplied ? 0 : allowed,
    balanceAfter: row?.balance_after ?? null,
    capped: allowed < REWARD_AMOUNT,
    alreadyApplied,
  })
}
