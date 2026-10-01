import type { SupabaseClient } from '@supabase/supabase-js'
import { pushToUser } from '@/lib/push'
import { TRIAL_STAMP_COPY, type TrialPushResult } from './trial-notify-copy.ts'

export { TRIAL_STAMP_COPY, trialPushLabel, type TrialPushResult } from './trial-notify-copy.ts'

/**
 * 체험단(서포터즈) 도장 알림 — 관리자가 도장을 찍으면 그 보호자에게 앱 알림 한 통.
 *
 * # 왜 (2026-10-01 사장님)
 * "체험단 도장 찍으면 알림 날라갈 수 있게 (서포터즈로 지정됐다, 지금 바로 카드 등록을 해놔라)"
 * "그 카드등록 알림 들어가면 바로 분석페이지에 플랜 선택하는 화면으로 넘어가지게"
 * 도장만 찍고 알려주지 않으면 고객은 100원 혜택이 생긴 줄 모르고, 카드를 등록해야 첫 박스가 나간다.
 *
 * ★문구는 사장님이 아직 정하지 않았다("멘트는 어케 할지 모르겠음") — TRIAL_STAMP_COPY 한 곳만
 *   고치면 된다. 비율%·"언제든"·전문용어 금지(고객 문구 브랜드 보이스).
 *
 * 링크: 분석이 있는 강아지 → 분석 페이지의 플랜 고르기 카드(`?focus=plan`, RecommendationBox 가
 *   그 카드로 내려간다) · 분석이 없으면 설문 · 강아지가 없으면 강아지 등록.
 * 분류 'order'(서비스 안내) — 고객이 직접 지원한 체험단 참여에 대한 안내라 광고성 알림이 아니다.
 *   'marketing' 이면 (광고) 표기·야간 차단·기본 수신 거부라 대부분 닿지 않는다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

/** 알림이 열 화면 — 분석 있는 최근 강아지의 플랜 고르기 > 설문 > 강아지 등록. */
export async function trialStampTarget(
  admin: AnyClient,
  userId: string,
): Promise<{ ok: true; url: string; dogName: string | null } | { ok: false; error: string }> {
  const { data: dogs, error: dogsErr } = await admin
    .from('dogs')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (dogsErr) return { ok: false, error: dogsErr.message }
  const list = (dogs ?? []) as Array<{ id: string; name: string | null }>
  if (list.length === 0) return { ok: true, url: '/dogs/new', dogName: null }

  const { data: latest, error: anErr } = await admin
    .from('analyses')
    .select('dog_id')
    .eq('user_id', userId)
    .in('dog_id', list.map((d) => d.id))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (anErr) return { ok: false, error: anErr.message }
  const analyzed = latest ? list.find((d) => d.id === (latest as { dog_id: string }).dog_id) : undefined
  if (analyzed) return { ok: true, url: `/dogs/${analyzed.id}/analysis?focus=plan`, dogName: analyzed.name }
  const first = list[0]!
  return { ok: true, url: `/dogs/${first.id}/survey`, dogName: first.name }
}

/** 도장 알림 보내기. 실패해도 던지지 않는다 — 도장 자체는 이미 찍혔다(결과는 관리자 화면에 표시). */
export async function notifyTrialStamp(
  admin: AnyClient,
  userId: string,
  boxes: { cheap: number; half: number },
): Promise<TrialPushResult> {
  const target = await trialStampTarget(admin, userId)
  if (!target.ok) return { sent: 0, reason: 'TARGET_LOOKUP_FAILED', url: '' }
  try {
    const r = await pushToUser(
      userId,
      {
        title: TRIAL_STAMP_COPY.title,
        body: TRIAL_STAMP_COPY.body({ dogName: target.dogName, ...boxes }),
        url: target.url,
        tag: `trial-stamp-${userId}`,
      },
      { category: 'order' },
    )
    return { sent: r?.sent ?? 0, reason: (r as { reason?: string } | undefined)?.reason ?? null, url: target.url }
  } catch {
    return { sent: 0, reason: 'PUSH_THREW', url: target.url }
  }
}
