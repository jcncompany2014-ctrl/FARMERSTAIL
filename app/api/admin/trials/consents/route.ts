import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { dbError } from '@/lib/api/errors'
import { recordAdminAction } from '@/lib/admin-audit'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { PRICE_RISE_LABEL, validateConsentInput } from '@/lib/payments/price-rise'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 서포터즈 가격 인상 동의 기록 API (admin 전용) — 2026-10-14 A1.
 *
 *   POST   — 동의 받음 기록 { userId, rise: 'to_half'|'to_full', consentedOn: 'YYYY-MM-DD', channel, memo? }
 *   DELETE — 기록 취소 { id, reason? } (지우지 않고 revoked_at 표시 — 증빙)
 *
 * 청구 크론은 인상 회차에 유효한 기록이 없으면 청구를 보류한다(lib/payments/price-rise priceRiseGate).
 * 그래서 이 기록은 돈이 나가게 하는 스위치다 — 화면이 확인창을 띄우고, 여기서 작업 기록(admin_audit_log)을 남긴다.
 * subscription_price_consents 는 고객 쓰기 권한이 없다(20261014200000) — 쓰기는 이 라우트가 service_role 로만 한다.
 * 관리자 확인은 /api/admin/trials 와 같은 방식(쿠키 사용자 → isAdmin).
 */

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { fail: NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 }) }
  if (!(await isAdmin(supabase, user)))
    return { fail: NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 }) }
  return { user, supabase }
}

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail

  let body: { userId?: unknown; rise?: unknown; consentedOn?: unknown; channel?: unknown; memo?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }
  if (typeof body.userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.userId)) {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'userId 필요' }, { status: 400 })
  }
  const v = validateConsentInput(body, todayKstIsoDate())
  if (!v.ok) return NextResponse.json({ code: 'INVALID_CONSENT', message: v.message }, { status: 400 })

  const admin = createAdminClient()
  // 서포터즈 도장이 있는 사람에게만 — 엉뚱한 고객에게 기록이 붙지 않게.
  const { data: trial, error: trialErr } = await admin
    .from('subscription_trials')
    .select('user_id')
    .eq('user_id', body.userId)
    .maybeSingle()
  if (trialErr) return dbError(trialErr, 'admin_trial_consent_trial_lookup', '서포터즈 상태를 확인하지 못했어요')
  if (!trial) {
    return NextResponse.json({ code: 'NOT_SUPPORTER', message: '서포터즈 도장이 없는 고객이에요' }, { status: 404 })
  }

  const { data: row, error } = await admin
    .from('subscription_price_consents')
    .insert({
      user_id: body.userId,
      rise: v.rise,
      consented_on: v.consentedOn,
      channel: v.channel,
      memo: v.memo,
      recorded_by: gate.user.id,
    })
    .select('id, rise, consented_on, channel, memo, created_at')
    .single()
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { code: 'ALREADY', message: `이미 '${PRICE_RISE_LABEL[v.rise]}' 동의 기록이 있어요 — 고치려면 기록을 취소하고 다시 남겨 주세요` },
        { status: 409 },
      )
    }
    return dbError(error, 'admin_trial_consent_create', '동의 기록을 남기지 못했어요')
  }
  await recordAdminAction(gate.supabase, {
    action: 'trial_price_consent_record',
    entityType: 'user',
    entityId: body.userId,
    diff: { after: { id: row.id, rise: v.rise, consented_on: v.consentedOn, channel: v.channel, memo: v.memo } },
    req,
  })
  return NextResponse.json({ ok: true, consent: row })
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail

  let body: { id?: unknown; reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'id 필요' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''

  const admin = createAdminClient()
  // 지우지 않는다 — 취소 표시만(누가 언제 왜 취소했는지가 증빙이다). 이미 취소된 기록은 0행.
  const { data: rows, error } = await admin
    .from('subscription_price_consents')
    .update({ revoked_at: new Date().toISOString(), revoked_by: gate.user.id, revoke_reason: reason || null })
    .eq('id', body.id)
    .is('revoked_at', null)
    .select('id, user_id, rise, consented_on, channel')
  if (error) return dbError(error, 'admin_trial_consent_revoke', '기록을 취소하지 못했어요')
  if (!rows || rows.length === 0) {
    return NextResponse.json({ code: 'NOT_FOUND', message: '기록이 없거나 이미 취소됐어요' }, { status: 404 })
  }
  const r = rows[0]!
  await recordAdminAction(gate.supabase, {
    action: 'trial_price_consent_revoke',
    entityType: 'user',
    entityId: r.user_id,
    diff: { before: { id: r.id, rise: r.rise, consented_on: r.consented_on, channel: r.channel }, meta: { reason } },
    req,
  })
  return NextResponse.json({ ok: true })
}
