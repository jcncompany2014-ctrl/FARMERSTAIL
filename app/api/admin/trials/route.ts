import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { dbError } from '@/lib/api/errors'
import { safeOrTerm } from '@/lib/supabase/or-filter'
import { recordAdminAction } from '@/lib/admin-audit'
import { customerHistories, hasPaidBox, hasSupporterPricedBox } from '@/lib/payments/customer-history'
import { notifyTrialStamp, trialPushLabel } from '@/lib/payments/trial-notify'
import { restorePatch, softCancelPatch, trialCancelPlan } from '@/lib/payments/trial-cancel'
import { loadChargeProjection } from '@/lib/payments/charge-projection-load'
import { nextChargeRunDate } from '@/lib/shipping-schedule'
import { addDaysKst, todayKstIsoDate } from '@/lib/datetime-kst'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 체험단 도장 API (admin 전용) — docs/TRIAL_PROGRAM_2026_10.md v2.
 *
 *   GET    — 도장 목록(+프로필) / ?q= 로 도장 찍을 후보 검색(이메일·이름)
 *            ?rounds=1 — 구독별 다음 결제 회차(실제 금액·인상 동의 보류 예정) — 구독 목록 화면용(2026-10-15 F-a)
 *   POST   — 도장 찍기 { userId, note?, cheapBoxes?, halfBoxes? } / 다시 찍기 { userId, restore: true }(취소 때 남은 회차로)
 *   DELETE — 도장 취소 { userId }
 *
 * ★도장 취소(2026-10-15 F-a, 규칙260) — 서포터즈 가격으로 결제된 적이 있으면 행을 지우지 않고 '남은 회차 0 + 취소 시각'으로
 *   남긴다(lib/payments/trial-cancel). 그래야 청구 크론이 '앞 결제 100원 → 이번 정가 = 정가 인상'으로 보고 정가 동의가
 *   기록돼야만 결제하고, 체험단 화면에 남아 동의를 기록할 수 있다. 서포터즈 가격 결제가 없는 사람(잘못 찍은 도장)만 지운다.
 *
 * subscription_trials 는 RLS 정책이 없다(service_role 전용) — 돈이 걸린 칸이라
 * 프로모션과 같은 원칙으로 쓰기를 admin API 로만 몰아둔다.
 */

/** 구독 목록 화면에 내려 보낼 다음 결제 회차 — 금액·날짜는 정본 펼치기(loadChargeProjection) 그대로. */
type NextRoundView = {
  shipIso: string
  chargeIso: string
  chargeAmount: number
  listAmount: number
  held: boolean
  rise: string | null
  phase: string
}

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

export async function GET(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail
  const admin = createAdminClient()

  const params = new URL(req.url).searchParams
  const q = params.get('q')?.trim() ?? ''
  if (q) {
    // 후보 검색 — 카카오 가입자는 email 이 없을 수 있어 이름도 함께 찾는다.
    // .or() 보간은 반드시 safeOrTerm (규칙49 — supabase-js 가 escape 안 함).
    const safeQ = safeOrTerm(q)
    if (!safeQ) return NextResponse.json({ ok: true, candidates: [] })
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, email, created_at')
      .or(`email.ilike.%${safeQ}%,name.ilike.%${safeQ}%`)
      .limit(10)
    if (error) return dbError(error, 'admin_trials_search', '검색하지 못했어요')
    // 후보마다 구독 상태·결제 박스 수·가입일 — 이름만 보고 엉뚱한 사람(기존 구독자)에게 붙이는 사고 방지.
    const hist = await customerHistories(admin, (data ?? []).map((p) => p.id))
    if (!hist.ok) return dbError({ message: hist.error }, 'admin_trials_search_history', '고객 이력을 불러오지 못했어요')
    return NextResponse.json({
      ok: true,
      candidates: (data ?? []).map((p) => ({ ...p, ...hist.byUser.get(p.id)! })),
    })
  }

  const { data: trials, error } = await admin
    .from('subscription_trials')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return dbError(error, 'admin_trials_list', '체험단 목록을 불러오지 못했어요')

  const ids = (trials ?? []).map((t) => t.user_id)
  const profileById = new Map<string, { name: string | null; email: string | null }>()
  if (ids.length > 0) {
    const { data: profs, error: profErr } = await admin
      .from('profiles')
      .select('id, name, email')
      .in('id', ids)
    if (profErr) return dbError(profErr, 'admin_trials_profiles', '프로필을 불러오지 못했어요')
    for (const p of profs ?? []) profileById.set(p.id, { name: p.name, email: p.email })
  }

  /**
   * ?rounds=1 — 구독별 다음 결제 회차(2026-10-15 F-a, 규칙264). 구독 목록이 '인상 동의 없음 → 청구 보류'를 몰라
   * 보류될 박스를 '결제 예정'으로 보였다. 체험단 화면·달력과 같은 정본 펼치기(loadChargeProjection, 보류에서 멈춤)를 쓴다.
   * 대상 = 청구 크론과 같은 조건(진행 중 · 카드 있음 · 재등록 불필요 · 발송일 있음). 실패는 roundsError — 화면이 알린다(규칙1).
   */
  let nextRounds: Record<string, NextRoundView> | null = null
  let roundsError: string | null = null
  if (params.get('rounds') === '1' && ids.length > 0) {
    const { data: subs, error: subsErr } = await admin
      .from('subscriptions')
      .select('id, user_id, next_delivery_date, total_amount')
      .in('user_id', ids)
      .eq('status', 'active')
      .eq('requires_billing_key_renewal', false)
      .not('billing_key', 'is', null)
      .not('next_delivery_date', 'is', null)
    if (subsErr) {
      roundsError = `정기배송: ${subsErr.message}`
    } else {
      const proj = await loadChargeProjection(
        admin,
        (subs ?? []).map((s) => ({
          id: s.id,
          user_id: s.user_id,
          next_delivery_date: s.next_delivery_date,
          total_amount: s.total_amount,
        })),
        { fromIso: nextChargeRunDate(), untilChargeIso: addDaysKst(todayKstIsoDate(), 120), stopAtHold: true },
      )
      if (!proj.ok) {
        roundsError = proj.error
      } else {
        nextRounds = {}
        for (const rounds of proj.roundsByUser.values()) {
          for (const r of rounds) {
            if (nextRounds[r.subId]) continue
            nextRounds[r.subId] = {
              shipIso: r.shipIso,
              chargeIso: r.chargeIso,
              chargeAmount: r.chargeAmount,
              listAmount: r.listAmount,
              held: r.held,
              rise: r.rise,
              phase: r.phase,
            }
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    trials: (trials ?? []).map((t) => ({
      ...t,
      profile: profileById.get(t.user_id) ?? { name: null, email: null },
    })),
    ...(params.get('rounds') === '1' ? { nextRounds: nextRounds ?? {}, roundsError } : {}),
  })
}

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail

  let body: { userId?: string; note?: string; cheapBoxes?: number; halfBoxes?: number; force?: boolean; restore?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }
  if (!body.userId) {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'userId 필요' }, { status: 400 })
  }

  /**
   * 다시 찍기(2026-10-15 F-a) — 취소된 도장을 **취소 때 남은 회차로** 되살린다(새로 4+4 가 아니다 — 100원 박스가 한 번 더
   * 나가던 것). 결제 이력 확인(아래 force)은 하지 않는다: 이미 서포터즈였던 사람이고, 되살리는 회차 수가 화면 확인창에 보인다.
   * 알림은 보내지 않는다(관리자 정정). 낙관적 잠금 — 취소된 행만 바꾼다(0행 = 그 사이 바뀜).
   */
  if (body.restore === true) {
    const admin = createAdminClient()
    const { data: row, error: rowErr } = await admin
      .from('subscription_trials')
      .select('cheap_remaining, half_remaining, cancelled_at, cancelled_cheap_remaining, cancelled_half_remaining')
      .eq('user_id', body.userId)
      .maybeSingle()
    if (rowErr) return dbError(rowErr, 'admin_trials_restore_lookup', '도장 상태를 확인하지 못했어요')
    if (!row) return NextResponse.json({ code: 'NOT_FOUND', message: '도장 기록이 없어요' }, { status: 404 })
    const patch = restorePatch(row)
    if (!patch) {
      return NextResponse.json({ code: 'NOT_CANCELLED', message: '취소된 도장이 아니에요 — 새로고침해 주세요' }, { status: 409 })
    }
    const { data: upd, error: updErr } = await admin
      .from('subscription_trials')
      .update(patch)
      .eq('user_id', body.userId)
      .not('cancelled_at', 'is', null)
      .select('user_id')
    if (updErr) return dbError(updErr, 'admin_trials_restore', '도장을 다시 찍지 못했어요')
    if (!upd || upd.length === 0) {
      return NextResponse.json({ code: 'CONFLICT', message: '그 사이 도장 상태가 바뀌었어요 — 새로고침해 주세요' }, { status: 409 })
    }
    await recordAdminAction(gate.supabase, {
      action: 'trial_restamp',
      entityType: 'user',
      entityId: body.userId,
      diff: {
        before: { cancelled_at: row.cancelled_at, cheap_remaining: row.cheap_remaining, half_remaining: row.half_remaining },
        after: { cheap_remaining: patch.cheap_remaining, half_remaining: patch.half_remaining },
      },
      req,
    })
    return NextResponse.json({ ok: true, restored: { cheap: patch.cheap_remaining, half: patch.half_remaining } })
  }
  // 회차는 1~12 상한 — 실수로 400 같은 값이 들어가 1년 넘게 100원이 나가는 사고 방지.
  const cheap = Math.trunc(Number(body.cheapBoxes ?? 4))
  const half = Math.trunc(Number(body.halfBoxes ?? 4))
  if (!Number.isFinite(cheap) || cheap < 0 || cheap > 12 || !Number.isFinite(half) || half < 0 || half > 12) {
    return NextResponse.json({ code: 'INVALID_BOXES', message: '회차는 0~12 사이예요' }, { status: 400 })
  }

  const admin = createAdminClient()
  // ★기존 구독자에게 잘못 찍으면 다음 결제부터 100원×4 → 반값×4(2026-09-28 9차 점검).
  //   결제한 박스가 있으면 기본 거부 — 화면이 한 번 더 확인받고 force 로만 찍는다.
  //   이력 조회 실패는 막는다(돈이 걸린 도장).
  const paid = await hasPaidBox(admin, body.userId)
  if (paid === null) {
    return NextResponse.json({ code: 'HISTORY_UNAVAILABLE', message: '결제 이력을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요' }, { status: 503 })
  }
  if (paid && body.force !== true) {
    return NextResponse.json(
      { code: 'HAS_PAID_HISTORY', message: '이미 결제한 박스가 있는 고객이에요 — 찍으면 다음 결제부터 서포터즈 가격이 적용돼요' },
      { status: 409 },
    )
  }
  const { error } = await admin.from('subscription_trials').insert({
    user_id: body.userId,
    cheap_remaining: cheap,
    half_remaining: half,
    note: (body.note ?? '').trim(),
    created_by: gate.user.id,
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { code: 'ALREADY', message: "이미 체험단 도장 기록이 있어요 — 취소된 도장이면 아래 목록에서 '도장 다시 찍기'를 눌러 주세요" },
        { status: 409 },
      )
    }
    return dbError(error, 'admin_trials_create', '도장을 찍지 못했어요')
  }
  await recordAdminAction(gate.supabase, {
    action: 'trial_stamp',
    entityType: 'user',
    entityId: body.userId,
    diff: { after: { cheap_remaining: cheap, half_remaining: half }, meta: { forced: paid === true } },
    req,
  })
  // 도장 알림 — "서포터즈로 선정됐어요, 플랜 고르고 카드 등록" → 분석 페이지 플랜 고르기로(사장님 2026-10-01).
  // 실패해도 도장은 이미 찍혔다 — 결과 한 줄을 관리자 화면에 보여 직접 연락할지 판단하게 한다.
  const push = await notifyTrialStamp(admin, body.userId, { cheap, half })
  return NextResponse.json({ ok: true, push: { sent: push.sent, label: trialPushLabel(push) } })
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }
  if (!body.userId) {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'userId 필요' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data: row, error: rowErr } = await admin
    .from('subscription_trials')
    .select('cheap_remaining, half_remaining, note, created_at, cancelled_at, cancelled_cheap_remaining, cancelled_half_remaining')
    .eq('user_id', body.userId)
    .maybeSingle()
  if (rowErr) return dbError(rowErr, 'admin_trials_cancel_lookup', '도장 상태를 확인하지 못했어요')
  if (!row) {
    return NextResponse.json({ code: 'NOT_FOUND', message: '도장이 없거나 이미 취소됐어요' }, { status: 404 })
  }
  // 서포터즈 가격으로 결제된 박스가 있나 — 모르면 막는다(모르고 지우면 동의 장치를 건너뛴 정가 결제가 나간다).
  const supporterPaid = await hasSupporterPricedBox(admin, body.userId)
  if (supporterPaid === null) {
    return NextResponse.json(
      { code: 'HISTORY_UNAVAILABLE', message: '결제 이력을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요' },
      { status: 503 },
    )
  }
  const plan = trialCancelPlan({ row, hasSupporterPaid: supporterPaid })
  if (plan === 'already') {
    return NextResponse.json({ code: 'ALREADY_CANCELLED', message: '이미 취소된 도장이에요' }, { status: 409 })
  }

  if (plan === 'soft') {
    // ★행을 지우지 않는다 — 남은 회차 0 + 취소 시각(청구 크론이 정가 인상으로 보고 동의를 요구한다). 낙관적 잠금:
    //   읽은 뒤 청구 크론이 회차를 썼으면 0행 → 다시 시도(취소 때 남은 회차를 틀리게 보관하지 않게).
    const patch = softCancelPatch(row, new Date().toISOString(), gate.user.id)
    const { data: upd, error: updErr } = await admin
      .from('subscription_trials')
      .update(patch)
      .eq('user_id', body.userId)
      .is('cancelled_at', null)
      .eq('cheap_remaining', row.cheap_remaining)
      .eq('half_remaining', row.half_remaining)
      .select('user_id')
    if (updErr) return dbError(updErr, 'admin_trials_soft_cancel', '도장을 취소하지 못했어요')
    if (!upd || upd.length === 0) {
      return NextResponse.json({ code: 'CONFLICT', message: '그 사이 남은 회차가 바뀌었어요 — 새로고침 후 다시 눌러 주세요' }, { status: 409 })
    }
    await recordAdminAction(gate.supabase, {
      action: 'trial_unstamp',
      entityType: 'user',
      entityId: body.userId,
      diff: {
        before: { cheap_remaining: row.cheap_remaining, half_remaining: row.half_remaining, note: row.note, created_at: row.created_at },
        after: { cheap_remaining: 0, half_remaining: 0, cancelled_at: patch.cancelled_at },
        meta: { mode: 'soft' },
      },
      req,
    })
    return NextResponse.json({ ok: true, mode: 'soft' })
  }

  // 서포터즈 가격 결제가 한 번도 없는 사람(잘못 찍은 도장) — 지운다. 읽은 회차 그대로일 때만(그 사이 100원 결제가 나갔으면 0행).
  // 지우기 전 남은 회차를 감사 기록에 담는다 — 떼고 다시 찍으면 4+4 로 초기화되므로 흔적이 필요.
  const { data: rows, error } = await admin
    .from('subscription_trials')
    .delete()
    .eq('user_id', body.userId)
    .is('cancelled_at', null)
    .eq('cheap_remaining', row.cheap_remaining)
    .eq('half_remaining', row.half_remaining)
    .select('cheap_remaining, half_remaining, note, created_at')
  if (error) return dbError(error, 'admin_trials_delete', '도장을 취소하지 못했어요')
  if (!rows || rows.length === 0) {
    return NextResponse.json({ code: 'CONFLICT', message: '그 사이 도장 상태가 바뀌었어요 — 새로고침 후 다시 눌러 주세요' }, { status: 409 })
  }
  await recordAdminAction(gate.supabase, {
    action: 'trial_unstamp',
    entityType: 'user',
    entityId: body.userId,
    diff: { before: rows[0], meta: { mode: 'delete' } },
    req,
  })
  return NextResponse.json({ ok: true, mode: 'delete' })
}
