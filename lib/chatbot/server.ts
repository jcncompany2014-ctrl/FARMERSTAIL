/**
 * AI 상담 서버 도우미 — 이용 자격 확인 · 강아지 정보 읽기 (2026-10-13 점검, 규칙191).
 *
 * 두 라우트(app/api/chatbot · app/api/chatbot/stream)와 화면(app/(main)/chat)이 같은 판정을 쓴다.
 * 조회는 service_role 로 하고 범위는 코드가 `.eq('user_id', userId)` 로 책임진다(AGENTS 규칙8).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import type { SubLike } from '@/lib/subscription-state'
import { canUseChatbot } from './eligibility.ts'
import { buildDogInfoBlock, type ChatDogRow, type ChatSurveyRow } from './dog-context.ts'

export type ChatbotAccess = 'allowed' | 'not_subscriber' | 'lookup_failed'

/** 정기배송 중(active·paused)인가. 조회 실패는 '아님'이 아니라 '모름'(lookup_failed) — 규칙1. */
export async function checkChatbotAccess(userId: string): Promise<ChatbotAccess> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return 'lookup_failed'
  }
  const { data, error } = await admin
    .from('subscriptions')
    .select('status, has_billing_key, next_delivery_date, failed_charge_count, requires_billing_key_renewal')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
  if (error) {
    captureBusinessEvent('warning', 'chatbot.access_lookup_failed', { userId, dbError: error.message })
    return 'lookup_failed'
  }
  return canUseChatbot((data ?? []) as unknown as SubLike[]) ? 'allowed' : 'not_subscriber'
}

/**
 * 그 강아지의 <dog_info> — 본인 강아지만(.eq user_id), 알레르기·기저질환은 최신 설문에서.
 * 조회가 실패하면 '알 수 없음'으로 넘겨 AI 가 먼저 묻게 한다(없음으로 넘기지 않는다).
 */
export async function loadChatDogInfo(userId: string, dogId: string): Promise<string> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return buildDogInfoBlock(null, null)
  }
  const [{ data: dog, error: dogErr }, { data: survey, error: surveyErr }] = await Promise.all([
    admin
      .from('dogs')
      .select('name, breed, age_value, age_unit, weight, gender, neutered')
      .eq('id', dogId)
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('surveys')
      .select('answers, chronic_conditions')
      .eq('dog_id', dogId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (dogErr || surveyErr) {
    captureBusinessEvent('warning', 'chatbot.dog_context_lookup_failed', {
      userId,
      dogId,
      dbError: (dogErr ?? surveyErr)?.message ?? 'unknown',
    })
  }
  // 강아지를 못 읽었으면 이름 없이 '알 수 없음' — 남의 강아지 id 도 여기로 온다(0행).
  if (dogErr || !dog) return buildDogInfoBlock(null, null)
  // 설문을 못 읽었으면 알레르기는 '알 수 없음'(설문 없음과 같은 취급) — 없다고 말하지 않는다.
  return buildDogInfoBlock(dog as ChatDogRow, surveyErr ? null : ((survey ?? null) as ChatSurveyRow))
}
