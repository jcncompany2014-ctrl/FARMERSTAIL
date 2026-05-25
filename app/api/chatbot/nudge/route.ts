import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeChatNudge,
  type NudgeContext,
} from '@/lib/chat/proactive-nudges'
import { parseLock } from '@/lib/personalization/method-lock'
import type { Json } from '@/lib/supabase/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/chatbot/nudge?dogId=...
 *
 * 챗봇 진입 시 1건 능동 개입 메시지 반환. dogId 없거나 익명이면 가벼운
 * 인사. RLS 가 dog → user 본인 매칭을 강제 — 외부 dogId 추측 차단.
 *
 * 응답 형식
 *   { nudge: ChatNudge } | { nudge: null }
 *
 * 클라이언트는 nudge 가 있고 thread 가 비어있을 때만 ui-only assistant
 * 메시지로 표시. DB chatbot_messages 에 저장 X — 대화 진행은 사용자가
 * 입력한 후 정상 POST 흐름에서 첫 사용자 메시지 + 그에 대한 응답으로 시작.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dogId = url.searchParams.get('dogId')

  // 가입일 — 첫 4주 보호 phase 판단용
  const userCreatedAt = user.created_at ?? null
  const daysSinceSignup = userCreatedAt
    ? Math.floor(
        (Date.now() - new Date(userCreatedAt).getTime()) / 86_400_000,
      )
    : null

  if (!dogId) {
    const nudge = computeChatNudge({
      dogName: null,
      latestBcs: null,
      daysSinceLastWeight: null,
      allergiesSource: null,
      daysSinceSignup,
    })
    return NextResponse.json({ nudge })
  }

  // dog meta + 최신 analysis + 최신 weight log — 병렬
  const [{ data: dog }, { data: analysis }, { data: weight }] =
    await Promise.all([
      supabase
        .from('dogs')
        .select('name, allergies_source, user_method_lock')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('analyses')
        .select('bcs_score')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('weight_logs')
        .select('measured_at')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (!dog) {
    return NextResponse.json({ nudge: null })
  }

  const daysSinceLastWeight = weight?.measured_at
    ? Math.floor(
        (Date.now() - new Date(weight.measured_at as string).getTime()) /
          86_400_000,
      )
    : null

  // R32 #20 — user_method_lock parse. weight/activity/feed 각 변수의
  // 측정도구 권유 차단 여부. voice-guidelines §9.
  const lock = parseLock(
    (dog as { user_method_lock: Json | null }).user_method_lock ?? null,
  )

  const ctx: NudgeContext = {
    dogName: (dog as { name: string | null }).name,
    latestBcs:
      (analysis as { bcs_score: number | null } | null)?.bcs_score ?? null,
    daysSinceLastWeight,
    allergiesSource:
      ((dog as { allergies_source: string | null }).allergies_source as
        | NudgeContext['allergiesSource']) ?? null,
    daysSinceSignup,
    methodLock: lock,
  }
  return NextResponse.json({ nudge: computeChatNudge(ctx) })
}
