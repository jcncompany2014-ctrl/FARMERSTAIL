import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { AdminHeader, LoadError } from '@/components/admin/ui'
import { addDaysKst, todayKstIsoDate } from '@/lib/datetime-kst'
import { nextChargeRunDate } from '@/lib/shipping-schedule'
import { loadChargeProjection } from '@/lib/payments/charge-projection-load'
import { trialPlanView } from '@/lib/admin/trial-plan'
import TrialsClient, { type TrialRow } from './TrialsClient'

/**
 * /admin/trials — 구독 체험단(서포터즈) 도장 · 가격 전환표 · 인상 동의 기록 (docs/TRIAL_PROGRAM_2026_10.md v2).
 *
 * 선발자가 일반 가입을 마치면 여기서 도장을 찍는다. 도장이 붙은 계정은
 * 청구가 100원×4 → 자기 구독가 반값×4 → 정상가로 자동 진행되고,
 * 각 전환의 마지막 결제 때 다음 가격 예고 푸시·메일이 나간다.
 *
 * ★2026-10-14 A1(사장님 '필수') — 사람마다 회차 일정표(결제일·금액)와 가격 전환일, 인상별 동의 상태를 보여 주고
 *   '동의 받음 기록'을 남긴다. 청구 크론은 인상 회차에 동의 기록이 없으면 청구하지 않고 보류한다.
 *   일정·금액은 손 계산이 아니라 정본 함수(trialPricing·chargeDateFor·resolveAutoDiscount)로 펼친다 —
 *   lib/payments/charge-projection.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '체험단',
  robots: { index: false, follow: false },
}

export default async function AdminTrialsPage() {
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/trials')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const admin = createAdminClient()
  // 규칙1 — error 를 버리면 조회 실패가 "체험단 없음"으로 위장한다.
  const { data: trials, error } = await admin
    .from('subscription_trials')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <>
        <AdminHeader title="서포터즈" sub="서포터즈 등록 · 진행 현황" />
        <LoadError what="체험단 목록" />
      </>
    )
  }

  const ids = (trials ?? []).map((t) => t.user_id)
  const today = todayKstIsoDate()
  const profileById = new Map<string, { name: string | null; email: string | null }>()
  const subsByUser = new Map<string, Array<{ id: string; status: string; dogName: string | null }>>()
  let planError: string | null = null
  const plans = new Map<string, ReturnType<typeof trialPlanView>>()

  if (ids.length > 0) {
    const [profRes, subsRes] = await Promise.all([
      admin.from('profiles').select('id, name, email').in('id', ids),
      admin
        .from('subscriptions')
        .select('id, user_id, dog_id, status, next_delivery_date, total_amount, requires_billing_key_renewal')
        .in('user_id', ids)
        .in('status', ['active', 'paused']),
    ])
    if (profRes.error) planError = `프로필: ${profRes.error.message}`
    for (const p of profRes.data ?? []) profileById.set(p.id, { name: p.name, email: p.email })

    if (subsRes.error) {
      planError ??= `정기배송: ${subsRes.error.message}`
    } else {
      const subs = subsRes.data ?? []
      const dogIds = [...new Set(subs.map((s) => s.dog_id).filter((x): x is string => !!x))]
      const dogName = new Map<string, string>()
      if (dogIds.length > 0) {
        const { data: dogs, error: dogsErr } = await admin.from('dogs').select('id, name').in('id', dogIds)
        if (dogsErr) planError ??= `강아지: ${dogsErr.message}`
        for (const d of dogs ?? []) dogName.set(d.id, d.name)
      }
      for (const s of subs) {
        const arr = subsByUser.get(s.user_id) ?? []
        arr.push({ id: s.id, status: s.status, dogName: s.dog_id ? (dogName.get(s.dog_id) ?? null) : null })
        subsByUser.set(s.user_id, arr)
      }
      // 일시정지·카드 재등록 필요 구독은 청구 크론이 건너뛴다 — 일정표는 청구될 정기배송만(카드 등록 전은 발송일이 없어 빠진다).
      const active = subs
        .filter((s) => s.status === 'active' && s.requires_billing_key_renewal !== true)
        .map((s) => ({
          id: s.id,
          user_id: s.user_id,
          next_delivery_date: s.next_delivery_date,
          total_amount: s.total_amount,
        }))
      const proj = await loadChargeProjection(admin, active, {
        fromIso: nextChargeRunDate(),
        untilChargeIso: addDaysKst(today, 400),
        // 일정표는 동의를 받는다고 보고 끝까지 펼친다 — 보류될 회차는 '동의 필요'로 표시.
        stopAtHold: false,
        // 남은 체험 회차 + 정가 2회(첫 정가·그 다음)까지.
        maxRounds: (c) => (c.trial ? c.trial.cheap_remaining + c.trial.half_remaining + 2 : 2),
      })
      if (!proj.ok) {
        planError ??= proj.error
      } else {
        for (const id of ids) {
          const ctx = proj.contextByUser.get(id)
          plans.set(id, trialPlanView(proj.roundsByUser.get(id) ?? [], ctx?.consents ?? [], today))
        }
      }
    }
  }

  // 동의를 기록한 관리자 이름 — 증빙 표시용(누가 남겼나). 못 읽으면 이름 대신 '관리자'로만 보인다(판정과 무관).
  const recorderNames: Record<string, string> = {}
  const recorderIds = [
    ...new Set(
      [...plans.values()].flatMap((p) => p.rises.map((r) => r.consent?.recordedBy ?? null)).filter((x): x is string => !!x),
    ),
  ]
  if (recorderIds.length > 0) {
    const { data: recs, error: recErr } = await admin.from('profiles').select('id, name, email').in('id', recorderIds)
    if (!recErr) for (const p of recs ?? []) recorderNames[p.id] = p.name ?? p.email ?? '관리자'
  }

  const rows: TrialRow[] = (trials ?? []).map((t) => ({
    ...t,
    profile: profileById.get(t.user_id) ?? { name: null, email: null },
    subs: subsByUser.get(t.user_id) ?? [],
    plan: plans.get(t.user_id) ?? null,
  }))

  return (
    <>
      <AdminHeader
        title="체험단"
        sub="도장 찍기 · 3단 가격(100원→반값→정상) 회차 일정 · 가격 인상 동의 기록"
      />
      {planError && (
        <div className="mb-4">
          <LoadError
            what="회차 일정·동의 상태"
            hint={`일정표와 동의 상태가 비어 보여도 없는 게 아니라 조회가 실패한 거예요. 새로고침해 주세요. (${planError.slice(0, 120)})`}
          />
        </div>
      )}
      <TrialsClient initial={rows} today={today} planLoaded={!planError} recorderNames={recorderNames} />
    </>
  )
}
