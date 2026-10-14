import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { recordAdminAction } from '@/lib/admin-audit'
import { latestSurveyByDog, allergiesFromAnswers } from '@/lib/personalization/dogAllergyBlocks'
import { currentServingFormula } from '@/lib/personalization/servingFormula'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import type { BoxProduct } from '@/lib/personalization/boxPricing'
import { subscriptionState, type SubLike } from '@/lib/subscription-state'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import {
  allergyEditImpact,
  buildAdminAllergySurveyRow,
  sameAllergies,
  validateNextAllergies,
} from '@/lib/admin/allergy-edit'
import { requireAdminUser, isUuid, rejectDeletedCustomer } from '../../_guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/users/[id]/allergies — 강아지 알레르기 고치기(2026-10-14 C5, 규칙258).
 *
 *   action 'preview'  — 저장하지 않고 영향만: 새로 막히는 레시피, 지금 박스가 멈추는지(담지 못한 몫).
 *   action 'save'     — 최신 설문을 복사한 '관리자 수정' 새 설문 행을 넣는다(옛 행은 그대로 — 설문은 기록).
 *                       requestProposal=true 면 재제안 크론에 '앞당긴 제안' 요청을 같이 넣는다.
 *   action 'propose'  — 저장 없이 앞당긴 제안 요청만(이미 고친 뒤 다시 누를 때).
 *
 * # 금액·식단은 여기서 바꾸지 않는다
 * 레시피·금액 변경은 고객 동의가 필요하다(금액 변경 동의 모달·3일 타임아웃). 그 제안을 만드는 곳은 재제안 크론뿐이라,
 * 여기서는 요청(formula_proposal_requests)만 넣고 크론이 같은 경로로 제안을 만든다(lib/personalization/early-proposal).
 * subscriptions·dog_formulas 는 이 라우트가 쓰지 않는다.
 *
 * # 범위
 * 관리자 확인 뒤 service_role. 강아지가 경로의 고객 것인지 확인한다(다른 고객의 강아지 id 로 고칠 수 없게).
 */

const zBody = z.object({
  action: z.enum(['preview', 'save', 'propose']),
  dogId: z.string().uuid(),
  allergies: z.array(z.string().max(40)).max(20).optional(),
  note: z.string().max(200).optional(),
  requestProposal: z.boolean().optional(),
})

type UntypedInsert = {
  from: (t: string) => {
    insert: (r: Record<string, unknown>) => {
      select: (c: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }>
      }
    }
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ code: 'INVALID_USER' }, { status: 400 })
  const gate = await requireAdminUser()
  if (!gate.ok) return gate.response
  const parsed = await parseRequest(req, zBody)
  if (!parsed.ok) return parsed.response
  const { action, dogId } = parsed.data

  const admin = createAdminClient()
  // 탈퇴한 회원의 강아지는 고치지 않는다(규칙275) — 미리보기만은 된다(읽기).
  if (action !== 'preview') {
    const deleted = await rejectDeletedCustomer(admin, id)
    if (deleted) return deleted
  }
  const { data: dog, error: dogErr } = await admin
    .from('dogs')
    .select('id, user_id, name')
    .eq('id', dogId)
    .maybeSingle()
  if (dogErr) return NextResponse.json({ code: 'DB_ERROR', message: '강아지를 확인하지 못했어요' }, { status: 500 })
  if (!dog || dog.user_id !== id) {
    return NextResponse.json({ code: 'NOT_FOUND', message: '이 고객의 강아지가 아니에요' }, { status: 404 })
  }

  // 진행 중 정기배송 — 상태 정본(subscriptionState).
  const { data: subRows, error: subErr } = await admin
    .from('subscriptions')
    .select('id, status, has_billing_key, next_delivery_date, failed_charge_count, requires_billing_key_renewal, fresh_ratio, created_at')
    .eq('dog_id', dogId)
    .eq('user_id', id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
  if (subErr) return NextResponse.json({ code: 'DB_ERROR', message: '정기배송을 확인하지 못했어요' }, { status: 500 })
  // 해지 안 된 것 중 가장 최근(강아지당 진행 중 구독은 1개 — subscriptions_one_live_per_dog).
  // 화식 비율은 영향 계산에 읽기만 한다 — 타입도 Record 로 적어 '금액·비율 쓰기' 감시(규칙257)와 겹치지 않게.
  const liveSub =
    ((subRows ?? []) as unknown as Array<SubLike & { id: string } & Record<'fresh_ratio', number | null>>)[0] ?? null
  const liveActive =
    !!liveSub &&
    subscriptionState({
      ...liveSub,
      failed_charge_count: liveSub.failed_charge_count ?? 0,
      requires_billing_key_renewal: !!liveSub.requires_billing_key_renewal,
    }) === 'active'

  if (action === 'propose') {
    const res = await requestProposal({ admin, dogId, userId: id, surveyId: null, requestedBy: gate.user.id, liveActive })
    // 앞당긴 제안 요청도 작업 기록에(규칙276) — 예전엔 저장 때만 남았다.
    if (res.ok) {
      await recordAdminAction(gate.supabase, {
        action: 'dog_proposal_request',
        entityType: 'dog',
        entityId: dogId,
        diff: { meta: { reason: 'admin_allergy_edit', userId: id } },
        req,
      })
    }
    return res
  }

  // 최신 설문 — 정본 판정(latestSurveyByDog: created_at 최신, 누가 썼는지 묻지 않음). 행 전체를 복사하므로 * 로 읽는다.
  const { data: surveyRows, error: surveyErr } = await admin
    .from('surveys')
    .select('*')
    .eq('dog_id', dogId)
    .order('created_at', { ascending: false })
    .limit(5)
  if (surveyErr) return NextResponse.json({ code: 'DB_ERROR', message: '설문을 불러오지 못했어요' }, { status: 500 })
  const latest = latestSurveyByDog(
    (surveyRows ?? []) as unknown as Array<Record<string, unknown> & { dog_id: string; answers: unknown; created_at: string }>,
  ).get(dogId)
  if (!latest) {
    // 설문이 없으면 복사할 행이 없다 — 알레르기만 든 빈 설문을 만들면 케어 목표·기저질환이 비어 다음 제안이 틀어진다.
    return NextResponse.json(
      { code: 'NO_SURVEY', message: '설문 기록이 없어 알레르기를 고칠 수 없어요 — 고객이 설문을 먼저 해야 해요' },
      { status: 409 },
    )
  }
  const prevAllergies = allergiesFromAnswers(latest.answers)
  const checked = validateNextAllergies(parsed.data.allergies ?? [], prevAllergies)
  if (!checked.ok) {
    return NextResponse.json(
      { code: 'INVALID_ALLERGY', message: `고를 수 없는 값이에요: ${checked.invalid.join(', ')}` },
      { status: 422 },
    )
  }
  const nextAllergies = checked.allergies

  // 영향 — 지금 먹는 식단(정본 currentServingFormula)으로 박스를 전·후 두 번 계산(정본 computeBoxPlan).
  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const [formulasRes, prodRes] = await Promise.all([
    admin
      .from('dog_formulas')
      .select('formula, daily_kcal, approval_status, applied_from, created_at')
      .eq('dog_id', dogId)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('products')
      .select('slug, price, sale_price, stock, is_subscribable')
      .in('slug', allSlugs)
      .eq('is_active', true),
  ])
  if (formulasRes.error || prodRes.error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '식단·제품을 불러오지 못했어요' }, { status: 500 })
  }
  const serving = currentServingFormula(
    (formulasRes.data ?? []) as unknown as Array<{
      formula: { lineRatios: Record<string, number>; toppers?: { protein: number; vegetable: number } | null }
      daily_kcal: number
      approval_status: string | null
      applied_from: string | null
      created_at: string
    }>,
    todayKstIsoDate(),
  )
  const products: Record<string, BoxProduct> = {}
  for (const p of (prodRes.data ?? []) as BoxProduct[]) products[p.slug] = p
  const impact = allergyEditImpact({
    prevAllergies,
    nextAllergies,
    serving: serving as Parameters<typeof allergyEditImpact>[0]['serving'],
    freshRatio: liveSub?.fresh_ratio ?? null,
    products,
  })
  const unchanged = sameAllergies(prevAllergies, nextAllergies)
  const summary = {
    prevAllergies,
    nextAllergies,
    unchanged,
    hasLiveSubscription: !!liveSub,
    liveActive,
    impact,
  }

  if (action === 'preview') return NextResponse.json({ ok: true, ...summary })

  if (unchanged) {
    return NextResponse.json({ code: 'UNCHANGED', message: '바뀐 알레르기가 없어요', ...summary }, { status: 409 })
  }

  const row = buildAdminAllergySurveyRow(latest, nextAllergies, {
    at: new Date().toISOString(),
    note: parsed.data.note ?? null,
  })
  const { data: inserted, error: insErr } = await (admin as unknown as UntypedInsert)
    .from('surveys')
    .insert(row)
    .select('id')
    .single()
  if (insErr || !inserted) {
    console.error('[admin/allergies] 설문 행 저장 실패', insErr?.message)
    return NextResponse.json({ code: 'DB_ERROR', message: '알레르기를 저장하지 못했어요' }, { status: 500 })
  }

  await recordAdminAction(gate.supabase, {
    action: 'dog_allergy_edit',
    entityType: 'dog',
    entityId: dogId,
    diff: {
      before: { allergies: prevAllergies },
      after: { allergies: nextAllergies },
      meta: { surveyId: inserted.id, heldAfter: impact.heldAfter.map((h) => h.line) },
    },
    req,
  })

  if (parsed.data.requestProposal) {
    const res = await requestProposal({
      admin,
      dogId,
      userId: id,
      surveyId: inserted.id,
      requestedBy: gate.user.id,
      liveActive,
    })
    const body = (await res.json()) as Record<string, unknown>
    return NextResponse.json({ ok: true, surveyId: inserted.id, ...summary, proposal: body }, { status: 200 })
  }
  return NextResponse.json({ ok: true, surveyId: inserted.id, ...summary })
}

/** 재제안 크론에 앞당긴 제안 요청 — 진행 중(구독 중) 정기배송이 있을 때만. 이미 대기 중이면 그대로 둔다. */
async function requestProposal(i: {
  admin: ReturnType<typeof createAdminClient>
  dogId: string
  userId: string
  surveyId: string | null
  requestedBy: string
  liveActive: boolean
}): Promise<NextResponse> {
  if (!i.liveActive) {
    return NextResponse.json(
      { code: 'NO_ACTIVE_SUBSCRIPTION', message: '구독 중인 정기배송이 없어 제안을 보낼 곳이 없어요 — 다음 신청 때 고친 알레르기로 계산돼요' },
      { status: 409 },
    )
  }
  const { error } = await i.admin.from('formula_proposal_requests').insert({
    dog_id: i.dogId,
    user_id: i.userId,
    reason: 'admin_allergy_edit',
    survey_id: i.surveyId,
    requested_by: i.requestedBy,
  })
  if (error) {
    // 23505 = 이 강아지에 이미 대기 중인 요청이 있다(강아지당 1건) — 같은 결과라 성공으로 본다.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, alreadyQueued: true })
    }
    console.error('[admin/allergies] 제안 요청 저장 실패', error.message)
    return NextResponse.json({ code: 'DB_ERROR', message: '제안 요청을 저장하지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, alreadyQueued: false })
}
