/**
 * 어드민 고객 화면 조회 — 서버 전용(service_role). 판정은 전부 정본 함수를 부른다(다시 짜지 않는다):
 *
 *   구독 상태        subscriptionState · SUB_STATE_LABEL · SUB_STATE_TONE      (lib/subscription-state)
 *   다음 발송·결제일  describeUpcomingBox · chargeTimingFor                       (lib/shipping-schedule)
 *   실제 나갈 금액    resolveAutoDiscount(구독 id 와 함께 — 화면 미리보기와 같은 규칙) (lib/payments/auto-discount)
 *   서포터즈 단계     supporterViews                                            (lib/payments/trial-display)
 *   지금 식단        servingFormulaByDog                                       (lib/personalization/servingFormula)
 *   박스 구성        computeBoxPlan · subscribableItems                        (lib/personalization/boxPricing)
 *   알레르기 막힌 라인 blockedLinesByDogFromSurveys · latestSurveyByDog          (lib/personalization/dogAllergyBlocks)
 *   알레르기·기저질환 allergiesFromSurvey · chronicFromSurvey                     (lib/chatbot/dog-context)
 *   배송지           pickShippingTarget                                        (lib/commerce/shipping-target)
 *   챙길 손님        loadCustomerFlags → customerFlags                         (lib/admin/customer-flags)
 *
 * service_role 인 이유(규칙8): 주소록·알림 기기·서포터즈·설문은 본인만 읽는 RLS 라 관리자 쿠키로 읽으면 0행 — '없음'으로
 * 보인다. 호출부(page.tsx)가 관리자 확인을 먼저 하고, 범위는 전부 `.eq('user_id', userId)`(또는 그 고객의 강아지·구독 id)로
 * 코드가 묶는다. 칸마다 조회 실패를 errors 에 따로 담는다 — 실패를 '없음'으로 그리지 않는다(규칙1).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { selectInChunks } from '@/lib/supabase/in-chunks'
import { todayKstIsoDate, addDaysKst } from '@/lib/datetime-kst'
import { subscriptionState, SUB_STATE_LABEL, SUB_STATE_TONE, type SubLike } from '@/lib/subscription-state'
import { chargeTimingFor, describeUpcomingBox, nextChargeRunDate } from '@/lib/shipping-schedule'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { supporterViews } from '@/lib/payments/trial-display'
import type { TrialState } from '@/lib/payments/trial'
import { servingFormulaByDog } from '@/lib/personalization/servingFormula'
import { computeBoxPlan, subscribableItems, type BoxProduct } from '@/lib/personalization/boxPricing'
import { blockedLinesByDogFromSurveys, latestSurveyByDog } from '@/lib/personalization/dogAllergyBlocks'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import { ALL_LINES, FOOD_LINE_META } from '@/lib/personalization/lines'
import type { FoodLine } from '@/lib/personalization/types'
import { allergiesFromSurvey, chronicFromSurvey } from '@/lib/chatbot/dog-context'
import { pickShippingTarget } from '@/lib/commerce/shipping-target'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import { APPROVAL_KR } from '@/lib/survey/labels'
import { ageLabelFromBirth } from '@/lib/dog-age'
import { loadCustomerFlags } from '@/lib/admin/customer-flags-load'
import { adminEditMarkOf } from '@/lib/admin/allergy-edit'
import { describeSubscriptionEvent, eventActorLabel, eventKindLabel } from '@/lib/subscription-events'
import { FIRST_CHECKIN_LABEL, firstCheckinNeedsOwner, isCheckinPalatability } from '@/lib/first-checkin'
import { loadChargeProjection } from '@/lib/payments/charge-projection-load'
import { trialPlanView } from '@/lib/admin/trial-plan'
import type { BoxView, CustomerData, DogView, SectionKey, SubView } from './_types'

const PROVIDER_LABEL: Record<string, string> = { kakao: '카카오', apple: '애플', email: '이메일', google: '구글' }

const APPROVAL_LABEL: Record<string, string> = {
  ...APPROVAL_KR,
  pending_approval: '고객 동의 대기',
  declined: '고객 거절',
}

type SubRow = SubLike & {
  id: string
  user_id: string
  dog_id: string | null
  total_amount: number
  fresh_ratio: number | null
  billing_card_brand: string | null
  billing_card_last4: string | null
  total_deliveries: number | null
  created_at: string
  cancelled_at: string | null
  last_failed_charge_reason: string | null
  recipient_name: string | null
  recipient_phone: string | null
  zip: string | null
  address: string | null
  address_detail: string | null
}

type FormulaRow = {
  id: string
  dog_id: string
  cycle_number: number | null
  formula: {
    lineRatios: Record<FoodLine, number>
    toppers?: { protein: number; vegetable: number } | null
    priceChange?: { from?: number; to?: number } | null
  }
  daily_kcal: number
  approval_status: string | null
  applied_from: string | null
  created_at: string
}

type SurveyRow = {
  id: string
  dog_id: string
  answers: unknown
  chronic_conditions: string[] | null
  created_at: string
}

/** 고객 한 명 — 프로필이 없으면 null(404). 프로필 조회 자체가 실패하면 throw(화면 전체가 의미 없다). */
export async function loadCustomerData(userId: string): Promise<CustomerData | null> {
  const admin = createAdminClient()
  const today = todayKstIsoDate()
  const errors: Partial<Record<SectionKey, string>> = {}
  const fail = (k: SectionKey, e: { message: string } | null | undefined) => {
    if (e) errors[k] = e.message
  }

  const [
    profRes,
    authRes,
    dogsRes,
    subsRes,
    trialRes,
    ordersRes,
    paidBoxRes,
    chargesRes,
    refundsRes,
    eventsRes,
    notesRes,
    memoRes,
    csRes,
    pushRes,
    tokensRes,
    webPushRes,
    addrRes,
    promoRes,
    neighborRes,
    proposalRes,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, name, email, phone, zip, address, address_detail, role, created_at, deleted_at')
      .eq('id', userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
    admin
      .from('dogs')
      .select('id, name, breed, weight, birth_date, age_value, age_unit, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    admin
      .from('subscriptions')
      .select(
        'id, user_id, dog_id, status, has_billing_key, next_delivery_date, failed_charge_count, ' +
          'requires_billing_key_renewal, total_amount, fresh_ratio, billing_card_brand, billing_card_last4, ' +
          'total_deliveries, created_at, cancelled_at, last_failed_charge_reason, ' +
          'recipient_name, recipient_phone, zip, address, address_detail',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    admin
      .from('subscription_trials')
      .select('cheap_remaining, half_remaining, cheap_price, half_rate, note')
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('orders')
      .select('id, order_number, created_at, total_amount, refunded_amount, payment_status, order_status, subscription_id, tracking_number')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
    // 결제됐고 발송 대기 중인 정기배송 박스 — '이번 박스' 판정(describeUpcomingBox)과 주소 변경 대상 수.
    admin
      .from('orders')
      .select('id, subscription_id, paid_at, created_at')
      .eq('user_id', userId)
      .not('subscription_id', 'is', null)
      .in('payment_status', [...PAID_STATUSES])
      .eq('order_status', 'preparing')
      .order('created_at', { ascending: false }),
    admin
      .from('subscription_charges')
      .select('id, scheduled_for, status, amount, error_message, attempted_at')
      .eq('user_id', userId)
      .order('scheduled_for', { ascending: false, nullsFirst: false })
      .limit(10),
    admin
      .from('refunds')
      .select('id, order_id, amount, reason, status, refunded_at')
      .eq('user_id', userId)
      .order('refunded_at', { ascending: false, nullsFirst: false })
      .limit(10),
    admin
      .from('subscription_events')
      .select('id, subscription_id, actor, kind, before, after, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
    admin
      .from('admin_customer_notes')
      .select('id, noted_on, channel, body, follow_up_on, done, done_at, created_at')
      .eq('user_id', userId)
      .order('noted_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('admin_user_notes').select('note').eq('user_id', userId).maybeSingle(),
    admin
      .from('cs_messages')
      .select('id, sender, body, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('push_log')
      .select('id, title, sent_at, read_at')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(5),
    admin.from('native_push_tokens').select('platform, app_version, updated_at').eq('user_id', userId),
    admin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin
      .from('addresses')
      .select('recipient_name, phone, zip, address, address_detail')
      .eq('user_id', userId)
      .eq('is_default', true)
      .limit(1),
    admin.from('promotion_claims').select('claimed_at, promotions(code, name)').eq('user_id', userId),
    admin.from('neighbor_discounts').select('source, redeemed_at').eq('user_id', userId).maybeSingle(),
    admin
      .from('formula_proposal_requests')
      .select('dog_id, requested_at, processed_at, outcome')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(10),
  ])

  if (profRes.error) throw new Error(`고객 조회 실패: ${profRes.error.message}`)
  const prof = profRes.data as {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    zip: string | null
    address: string | null
    address_detail: string | null
    role: string | null
    created_at: string | null
    deleted_at: string | null
  } | null
  if (!prof) return null

  // ── 가입 경로·마지막 접속 ──
  fail('account', authRes.error)
  fail('account', promoRes.error)
  fail('account', neighborRes.error)
  const extras: string[] = []
  for (const c of (promoRes.data ?? []) as unknown as Array<{ promotions: { code: string | null; name: string | null } | null }>) {
    if (c.promotions) extras.push(`행사 가입 ${c.promotions.name ?? c.promotions.code ?? ''}`.trim())
  }
  if (neighborRes.data) extras.push('이웃 할인 대상')
  if (trialRes.data) extras.push('서포터즈')
  const authUser = authRes.data?.user ?? null
  const provider = String((authUser?.app_metadata as { provider?: string } | undefined)?.provider ?? '')
  const account: CustomerData['account'] = authRes.error
    ? null
    : {
        providerLabel: PROVIDER_LABEL[provider] ?? (provider || '알 수 없음'),
        lastSignInAt: authUser?.last_sign_in_at ?? null,
        extras,
      }

  // ── 강아지·구독 ──
  fail('dogs', dogsRes.error)
  fail('subs', subsRes.error)
  fail('trial', trialRes.error)
  fail('paid_box', paidBoxRes.error)
  const dogs = (dogsRes.data ?? []) as Array<{
    id: string
    name: string
    breed: string | null
    weight: number | null
    birth_date: string | null
    age_value: number | null
    age_unit: string | null
  }>
  const subs = ((subsRes.data ?? []) as unknown as SubRow[]).map((s) => ({
    ...s,
    failed_charge_count: s.failed_charge_count ?? 0,
    requires_billing_key_renewal: !!s.requires_billing_key_renewal,
  }))
  const dogName = new Map(dogs.map((d) => [d.id, d.name]))
  const trial = (trialRes.data as (TrialState & { note: string | null }) | null) ?? null

  // 결제됐고 아직 안 나간 박스(구독별 가장 최근) — 화면·포장 목록과 같은 기준.
  const paidAtBySub = new Map<string, string>()
  for (const o of (paidBoxRes.data ?? []) as Array<{ subscription_id: string | null; paid_at: string | null; created_at: string }>) {
    if (o.subscription_id && !paidAtBySub.has(o.subscription_id)) paidAtBySub.set(o.subscription_id, o.paid_at ?? o.created_at)
  }

  // 서포터즈 단계(정본) — 체험 조회가 실패했으면 비워 둔다(정가로 단정하지 않게 화면이 칸 오류를 띄운다).
  const supporter = trialRes.error
    ? new Map()
    : supporterViews(subs, trial ? new Map([[userId, trial]]) : new Map())
  // 결제 시점 — 체험 조회 실패면 모름(null).
  const timing = trialRes.error ? null : chargeTimingFor(trial)

  // 실제 나갈 금액 — 청구와 같은 함수(구독 id 를 넘겨 여러 구독 순서까지 같은 규칙).
  const chargeById = new Map<string, { amount: number; label: string | null }>()
  await Promise.all(
    subs.map(async (s) => {
      const st = subscriptionState(s)
      if (st === 'cancelled' || st === 'needs_card') return
      try {
        const d = await resolveAutoDiscount({ userId, subtotal: s.total_amount ?? 0, subscriptionId: s.id })
        chargeById.set(s.id, { amount: d.chargeAmount, label: d.label })
      } catch (e) {
        errors.charge_preview = e instanceof Error ? e.message : String(e)
      }
    }),
  )

  // ── 서포터즈 가격 인상·동의·보류 — 체험단 화면과 같은 정본(loadChargeProjection → trialPlanView, 규칙278). 읽기만.
  //   예전엔 이 화면이 resolveAutoDiscount 만 봐서 동의가 없어 보류될 회차도 '12/1 결제 예정'처럼 보였다.
  let supporterPlan: CustomerData['supporterPlan'] = trialRes.error ? undefined : null
  if (!trialRes.error && trial) {
    const liveForPlan = subs
      .filter((s) => s.status === 'active' && !s.requires_billing_key_renewal)
      .map((s) => ({ id: s.id, user_id: userId, next_delivery_date: s.next_delivery_date, total_amount: s.total_amount }))
    const [proj, holdsRes] = await Promise.all([
      loadChargeProjection(admin, liveForPlan, {
        fromIso: nextChargeRunDate(),
        untilChargeIso: addDaysKst(today, 400),
        // 체험단 일정표와 같은 펼치기 — 동의를 받는다고 보고 끝까지(보류될 회차는 held 로 표시).
        stopAtHold: false,
        maxRounds: (c) => (c.trial ? c.trial.cheap_remaining + c.trial.half_remaining + 2 : 2),
        // 금액 계산이 던져도 화면 전체가 아니라 이 칸만 '못 불러옴'으로.
      }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) })),
      admin
        .from('subscription_charge_holds')
        .select('ship_date, charge_date, rise')
        .eq('user_id', userId)
        .is('resolved_at', null)
        .order('ship_date', { ascending: true }),
    ])
    if (!proj.ok) {
      errors.trial_plan = proj.error
      supporterPlan = undefined
    } else if (holdsRes.error) {
      errors.trial_plan = holdsRes.error.message
      supporterPlan = undefined
    } else {
      const ctx = proj.contextByUser.get(userId)
      const plan = trialPlanView(proj.roundsByUser.get(userId) ?? [], ctx?.consents ?? [], today)
      supporterPlan = {
        next: plan.next
          ? { chargeIso: plan.next.chargeIso, amount: plan.next.chargeAmount, label: plan.next.label, held: plan.next.held }
          : null,
        rises: plan.rises.map((r) => ({
          label: r.label,
          status: r.status,
          chargeIso: r.round?.chargeIso ?? null,
          amount: r.round?.amount ?? null,
          prevAmount: r.round?.prevAmount ?? null,
          consentedOn: r.consent?.consentedOn ?? null,
          channel: r.consent?.channel ?? null,
        })),
        openHolds: ((holdsRes.data ?? []) as Array<{ ship_date: string; charge_date: string; rise: string | null }>).map((h) => ({
          shipDate: h.ship_date,
          chargeDate: h.charge_date,
          rise: h.rise,
        })),
      }
    }
  }

  const subViews: SubView[] = subs.map((s) => {
    const st = subscriptionState(s)
    const sv = supporter.get(s.id)
    return {
      id: s.id,
      dogId: s.dog_id,
      dogName: (s.dog_id && dogName.get(s.dog_id)) || '(강아지 미상)',
      state: st,
      stateLabel: SUB_STATE_LABEL[st],
      tone: SUB_STATE_TONE[st],
      freshRatio: s.fresh_ratio,
      freshLabel: freshTierLabel(s.fresh_ratio),
      storedAmount: s.total_amount,
      chargeAmount: chargeById.get(s.id)?.amount ?? null,
      chargeLabel: chargeById.get(s.id)?.label ?? null,
      supporterCaption: sv?.caption ?? null,
      upcoming:
        st === 'cancelled'
          ? null
          : describeUpcomingBox({
              nextDeliveryDate: s.next_delivery_date,
              timing: s.status === 'active' ? timing : null,
              hasPaidPreparingOrder: paidAtBySub.has(s.id),
              paidAt: paidAtBySub.get(s.id) ?? null,
              today,
            }),
      timingKnown: timing !== null,
      cardBrand: s.billing_card_brand,
      cardLast4: s.billing_card_last4,
      totalDeliveries: s.total_deliveries ?? 0,
      createdAt: s.created_at,
      cancelledAt: s.cancelled_at,
      lastFailReason: s.last_failed_charge_reason,
      nextDeliveryDate: s.next_delivery_date,
    }
  })

  // ── 설문·식단·박스 ──
  const dogIds = dogs.map((d) => d.id)
  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const [surveysRes, formulasRes, prodRes, flagsRes, checkinRes] = await Promise.all([
    selectInChunks(dogIds, (chunk) =>
      admin
        .from('surveys')
        .select('id, dog_id, answers, chronic_conditions, created_at')
        .in('dog_id', chunk)
        .order('created_at', { ascending: false }),
    ),
    selectInChunks(dogIds, (chunk) =>
      admin
        .from('dog_formulas')
        .select('id, dog_id, cycle_number, formula, daily_kcal, approval_status, applied_from, created_at')
        .in('dog_id', chunk)
        .order('created_at', { ascending: false }),
    ),
    admin
      .from('products')
      .select('slug, name, price, sale_price, stock, is_subscribable')
      .in('slug', allSlugs)
      .eq('is_active', true),
    loadCustomerFlags(admin, [{ id: userId, email: prof.email, deleted_at: prof.deleted_at }]),
    // 첫 박스 체크인 답(규칙270) — 강아지당 한 줄(uq_first_box_checkin).
    selectInChunks(dogIds, (chunk) =>
      admin
        .from('feeding_outcomes')
        .select('dog_id, palatability, comment, created_at')
        .eq('source', 'first_box_checkin')
        .in('dog_id', chunk),
    ),
  ])
  fail('checkin', checkinRes.error)
  const checkinByDog = new Map<string, { palatability: string | null; comment: string | null; created_at: string }>()
  for (const c of (checkinRes.data ?? []) as Array<{ dog_id: string; palatability: string | null; comment: string | null; created_at: string }>) {
    checkinByDog.set(c.dog_id, c)
  }
  fail('surveys', surveysRes.error)
  fail('box', formulasRes.error)
  fail('box', prodRes.error)
  if (!flagsRes.ok) errors.flags = flagsRes.error

  const surveyRows = (surveysRes.data ?? []) as unknown as SurveyRow[]
  const latestByDog = latestSurveyByDog(surveyRows)
  const blockedByDog = blockedLinesByDogFromSurveys(surveyRows)
  const surveyCount = new Map<string, number>()
  for (const r of surveyRows) surveyCount.set(r.dog_id, (surveyCount.get(r.dog_id) ?? 0) + 1)

  const formulaRows = (formulasRes.data ?? []) as unknown as FormulaRow[]
  const servingByDog = servingFormulaByDog(formulaRows, today)
  const products: Record<string, BoxProduct & { name: string }> = {}
  for (const p of (prodRes.data ?? []) as Array<BoxProduct & { name: string }>) products[p.slug] = p

  const liveSubByDog = new Map<string, (typeof subs)[number]>()
  for (const s of subs) {
    if (!s.dog_id || subscriptionState(s) === 'cancelled') continue
    if (!liveSubByDog.has(s.dog_id)) liveSubByDog.set(s.dog_id, s)
  }

  function boxFor(dogId: string): BoxView | null {
    const sub = liveSubByDog.get(dogId)
    const f = servingByDog.get(dogId)
    if (!sub || !f) return null
    const recipe = ALL_LINES.filter((l) => (f.formula.lineRatios?.[l] ?? 0) > 0).map((l) => ({
      name: FOOD_LINE_META[l].nameKo,
      pct: Math.round((f.formula.lineRatios[l] ?? 0) * 100),
    }))
    const base: BoxView = {
      recipe,
      dailyKcal: f.daily_kcal,
      cycle: f.cycle_number,
      approvalLabel: APPROVAL_LABEL[f.approval_status ?? ''] ?? (f.approval_status || '—'),
      appliedFrom: f.applied_from,
      freshRatio: sub.fresh_ratio,
      freshLabel: freshTierLabel(sub.fresh_ratio),
      packs: [],
      held: [],
      note: null,
    }
    // 비율을 모르면 담지 않는다(포장 목록과 같은 원칙 — 100% 로 추측하지 않는다).
    if (sub.fresh_ratio == null || sub.fresh_ratio <= 0) return { ...base, note: '화식 비율을 몰라 팩 구성을 계산하지 않았어요' }
    // 설문을 못 읽었으면 알레르기를 모른다 — '알레르기 없음'으로 계산하지 않는다.
    if (surveysRes.error) return { ...base, note: '설문(알레르기)을 못 읽어 팩 구성을 계산하지 않았어요' }
    if (prodRes.error || Object.keys(products).length === 0) return { ...base, note: '제품을 못 읽어 팩 구성을 계산하지 않았어요' }
    const plan = computeBoxPlan({
      formula: {
        lineRatios: f.formula.lineRatios,
        toppers: f.formula.toppers ?? { protein: 0, vegetable: 0 },
        dailyKcal: f.daily_kcal,
      },
      freshRatio: sub.fresh_ratio,
      products,
      blockedLines: blockedByDog.get(dogId) ?? [],
    })
    return {
      ...base,
      packs: subscribableItems(plan.items).map((it) => ({ name: it.product.name, packG: it.packG, count: it.quantity })),
      // 포장 목록과 같은 말(picking-list 'held').
      held: plan.held.map((h) => ({
        name: `${FOOD_LINE_META[h.line].nameKo} 레시피`,
        reason:
          h.reason === 'allergen_in_formula'
            ? '처방에 알레르기 레시피가 들어 있어요'
            : '판매 중지 — 알레르기 없는 대체 레시피가 없어요',
      })),
    }
  }

  const dogViews: DogView[] = dogs.map((d) => {
    const s = latestByDog.get(d.id) ?? null
    const pending = formulaRows.find((r) => r.dog_id === d.id && r.approval_status === 'pending_approval') ?? null
    const live = liveSubByDog.get(d.id) ?? null
    return {
      id: d.id,
      name: d.name,
      breed: d.breed,
      weightKg: d.weight,
      ageLabel:
        ageLabelFromBirth(d.birth_date, Date.now()) ??
        (d.age_value != null && d.age_unit ? `${d.age_value}${d.age_unit === 'years' ? '살' : '개월'}` : null),
      survey: s
        ? {
            id: s.id,
            createdAt: s.created_at,
            allergies: allergiesFromSurvey(s),
            chronic: chronicFromSurvey(s),
            adminEdit: adminEditMarkOf(s.answers),
            count: surveyCount.get(d.id) ?? 1,
          }
        : null,
      box: formulasRes.error ? null : boxFor(d.id),
      pendingProposal: pending
        ? {
            cycle: pending.cycle_number ?? 0,
            createdAt: pending.created_at,
            priceFrom: pending.formula?.priceChange?.from ?? null,
            priceTo: pending.formula?.priceChange?.to ?? null,
          }
        : null,
      liveSubId: live?.id ?? null,
      liveActive: !!live && subscriptionState(live) === 'active',
      liveFreshRatio: live?.fresh_ratio ?? null,
      firstCheckin: checkinRes.error
        ? undefined
        : (() => {
            const c = checkinByDog.get(d.id)
            if (!c) return null
            return {
              label: isCheckinPalatability(c.palatability) ? FIRST_CHECKIN_LABEL[c.palatability] : '답 없음',
              comment: c.comment,
              answeredAt: c.created_at,
              needsOwner: firstCheckinNeedsOwner(c.palatability, c.comment) !== null,
              poor: c.palatability === 'poor',
            }
          })(),
    }
  })

  // ── 결제·주문·환불·변경 기록 ──
  fail('orders', ordersRes.error)
  fail('charges', chargesRes.error)
  fail('refunds', refundsRes.error)
  fail('events', eventsRes.error)
  const subDog = new Map(subs.map((s) => [s.id, s.dog_id ? (dogName.get(s.dog_id) ?? null) : null]))

  // ── 메모·메시지·알림 기기 ──
  fail('notes', notesRes.error)
  fail('memo', memoRes.error)
  fail('messages', csRes.error)
  fail('messages', pushRes.error)
  fail('flags', tokensRes.error)
  fail('flags', webPushRes.error)
  const thread = ((csRes.data ?? []) as Array<{ id: string; sender: string; body: string; created_at: string }>)
    .map((m) => ({ id: m.id, sender: (m.sender === 'admin' ? 'admin' : 'user') as 'admin' | 'user', body: m.body, createdAt: m.created_at }))
    .reverse()

  // ── 배송지(정본 순서: 기본 배송지 → 프로필 → 구독 신청서) ──
  fail('address', addrRes.error)
  const defaultAddr = ((addrRes.data ?? []) as Array<{
    recipient_name: string | null
    phone: string | null
    zip: string | null
    address: string | null
    address_detail: string | null
  }>)[0]
  const fromDefault = defaultAddr
    ? { name: defaultAddr.recipient_name, phone: defaultAddr.phone, zip: defaultAddr.zip, address: defaultAddr.address, addressDetail: defaultAddr.address_detail }
    : null
  const fromProfile = { name: prof.name, phone: prof.phone, zip: prof.zip, address: prof.address, addressDetail: prof.address_detail }
  const liveForAddr = subs.find((s) => subscriptionState(s) !== 'cancelled') ?? subs[0]
  const fromSub = liveForAddr
    ? { name: liveForAddr.recipient_name, phone: liveForAddr.recipient_phone, zip: liveForAddr.zip, address: liveForAddr.address, addressDetail: liveForAddr.address_detail }
    : null
  const current = pickShippingTarget([fromDefault, fromProfile, fromSub])
  const source: CustomerData['address']['source'] = !current
    ? null
    : pickShippingTarget([fromDefault])
      ? 'default'
      : pickShippingTarget([fromProfile])
        ? 'profile'
        : 'subscription'

  fail('proposals', proposalRes.error)

  return {
    userId,
    today,
    profile: {
      name: prof.name,
      email: prof.email,
      phone: prof.phone,
      createdAt: prof.created_at,
      role: prof.role,
      deletedAt: prof.deleted_at,
    },
    supporterPlan,
    account,
    flags: flagsRes.ok ? (flagsRes.byUser.get(userId)?.keys ?? []) : null,
    apps:
      tokensRes.error || webPushRes.error
        ? null
        : {
            tokens: ((tokensRes.data ?? []) as Array<{ platform: string | null; app_version: string | null; updated_at: string | null }>)
              .map((t) => ({ platform: t.platform ?? '?', version: t.app_version, updatedAt: t.updated_at }))
              .sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? '')),
            webPushCount: webPushRes.count ?? 0,
          },
    emailBounced: flagsRes.ok ? (flagsRes.byUser.get(userId)?.keys.includes('bounced') ?? false) : null,
    dogs: dogViews,
    subs: subViews,
    supporter: trial
      ? { cheapRemaining: trial.cheap_remaining, halfRemaining: trial.half_remaining, note: trial.note }
      : null,
    orders: ((ordersRes.data ?? []) as Array<{
      id: string
      order_number: string
      created_at: string
      total_amount: number
      refunded_amount: number | null
      payment_status: string
      order_status: string
      subscription_id: string | null
      tracking_number: string | null
    }>).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      createdAt: o.created_at,
      totalAmount: o.total_amount,
      refundedAmount: o.refunded_amount ?? 0,
      paymentStatus: o.payment_status,
      orderStatus: o.order_status,
      isSubscription: !!o.subscription_id,
      trackingNumber: o.tracking_number,
    })),
    charges: ((chargesRes.data ?? []) as Array<{
      id: string
      scheduled_for: string | null
      status: string
      amount: number | null
      error_message: string | null
      attempted_at: string | null
    }>).map((c) => ({
      id: c.id,
      scheduledFor: c.scheduled_for,
      status: c.status,
      amount: c.amount,
      errorMessage: c.error_message,
      attemptedAt: c.attempted_at,
    })),
    refunds: ((refundsRes.data ?? []) as Array<{
      id: string
      order_id: string | null
      amount: number
      reason: string | null
      status: string | null
      refunded_at: string | null
    }>).map((r) => ({
      id: r.id,
      orderId: r.order_id,
      amount: r.amount,
      reason: r.reason,
      status: r.status,
      refundedAt: r.refunded_at,
    })),
    events: ((eventsRes.data ?? []) as Array<{
      id: string
      subscription_id: string
      actor: string
      kind: string
      before: unknown
      after: unknown
      created_at: string
    }>).map((e) => ({
      id: e.id,
      kind: e.kind,
      actor: e.actor,
      createdAt: e.created_at,
      label: eventKindLabel(e.kind),
      actorLabel: eventActorLabel(e.actor),
      detail: describeSubscriptionEvent(e),
      dogName: subDog.get(e.subscription_id) ?? null,
    })),
    notes: ((notesRes.data ?? []) as Array<{
      id: string
      noted_on: string
      channel: string
      body: string
      follow_up_on: string | null
      done: boolean
      done_at: string | null
      created_at: string
    }>).map((n) => ({
      id: n.id,
      notedOn: n.noted_on,
      channel: n.channel,
      body: n.body,
      followUpOn: n.follow_up_on,
      done: n.done,
      doneAt: n.done_at,
      createdAt: n.created_at,
    })),
    memo: (memoRes.data as { note?: string | null } | null)?.note ?? null,
    messages: {
      thread,
      push: ((pushRes.data ?? []) as Array<{ id: string; title: string; sent_at: string; read_at: string | null }>).map((p) => ({
        id: p.id,
        title: p.title,
        sentAt: p.sent_at,
        readAt: p.read_at,
      })),
      awaitingReply: thread.length > 0 && thread[thread.length - 1]!.sender === 'user',
    },
    address: { current, source, pendingPaidBoxes: (paidBoxRes.data ?? []).length },
    proposals: ((proposalRes.data ?? []) as Array<{ dog_id: string; requested_at: string; processed_at: string | null; outcome: string | null }>).map((p) => ({
      dogId: p.dog_id,
      requestedAt: p.requested_at,
      processedAt: p.processed_at,
      outcome: p.outcome,
    })),
    errors,
  }
}
