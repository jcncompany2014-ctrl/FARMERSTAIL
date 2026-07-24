import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import {
  computeBoxItems,
  subscribableItems,
  type BoxItem,
} from '@/lib/personalization/boxPricing'
import type { Formula } from '@/lib/personalization/types'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import { addDaysKst, todayKstIsoDate } from '@/lib/datetime-kst'
import { weekdayOf, weekdayKo, SHIP_WEEKDAY } from '@/lib/shipping-schedule'
import {
  AdminHeader,
  AdminCard,
  Badge,
  StatCard,
  SectionTitle,
} from '@/components/admin/ui'
import PickingListExport, { type PickingRow } from './PickingListExport'
import ShippingLabels from './ShippingLabels'

export const dynamic = 'force-dynamic'

/**
 * /admin/personalization/picking-list — 발송일(화요일) 박스 패킹 리스트.
 *
 * # 2026-07-19 전면 재작성 (옛 버전의 4중 낡음 수정)
 *  ①  옛: 주간(daily_grams×7) — 박스는 **14일치**다. 절반 분량이 표시됐다.
 *  ②  옛: 화식 비율(fresh_ratio) 미반영 — 곁들임(30%) 고객도 100% 분량으로 표시.
 *  ③  옛: "총 그램 반올림" — 실제 포장은 **5g 올림 팩 × 14개**(boxPricing 정본).
 *  ④  옛: 활성 처방 전체가 매일 다 뜸 — 이제 **그날 발송할 구독**만.
 *
 * # 데이터 흐름 (청구·화면과 같은 정본)
 *  발송 대상 = active 구독 중 next_delivery_date ≤ 발송일. 단, 발송일 아침
 *  청구 크론(subscription-charge)이 이미 돌았으면 날짜가 +14 밀려 있으므로
 *  `next_delivery_date = 발송일+14` (= 오늘 아침 청구 완료분)도 포함한다.
 *  팩 구성 = 강아지의 최신 승인 처방 × fresh_ratio → computeBoxItems (정본).
 *  고객이 /order·승인 화면에서 본 것과 **같은 함수**라 포장·청구·화면이 일치.
 */

type FormulaRow = {
  id: string
  dog_id: string
  cycle_number: number
  formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
  daily_kcal: number
  transition_strategy: string | null
  user_adjusted: boolean
  approval_status: string | null
}

type SubRow = {
  id: string
  dog_id: string | null
  user_id: string
  fresh_ratio: number | null
  next_delivery_date: string | null
  total_amount: number
  recipient_name: string | null
  recipient_phone: string | null
  zip: string | null
  address: string | null
  address_detail: string | null
  delivery_memo: string | null
  total_deliveries: number | null
}

type PickProduct = {
  slug: string
  name: string
  price: number
  sale_price: number | null
  stock: number
  is_subscribable: boolean | null
}

/** 오늘 포함 다가오는 화요일(발송일). ?date= 없을 때 기본값. */
function upcomingShipDate(): string {
  const today = todayKstIsoDate()
  const gap = (SHIP_WEEKDAY - weekdayOf(today) + 7) % 7
  return addDaysKst(today, gap)
}

export default async function PickingListPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/personalization/picking-list')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const sp = await searchParams
  const shipDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : upcomingShipDate()
  const chargedBumpDate = addDaysKst(shipDate, 14)

  // 1) 발송 대상 구독 — 카드 미등록 구독은 next_delivery_date=null 이라 자동 제외.
  const { data: subsRaw } = await supabase
    .from('subscriptions')
    .select(
      'id, dog_id, user_id, fresh_ratio, next_delivery_date, total_amount, ' +
        'recipient_name, recipient_phone, zip, address, address_detail, ' +
        'delivery_memo, total_deliveries',
    )
    .eq('status', 'active')
    .or(
      `next_delivery_date.lte.${shipDate},next_delivery_date.eq.${chargedBumpDate}`,
    )
    .order('created_at', { ascending: true })
  const subs = ((subsRaw ?? []) as unknown) as SubRow[]

  const dogIds = [...new Set(subs.map((s) => s.dog_id).filter(Boolean))] as string[]

  // 2) 강아지 이름 + 최신 승인 처방 + 제품(정본 계산용) 병렬 로드.
  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const [{ data: dogsRaw }, { data: formulasRaw }, { data: prodRaw }] =
    await Promise.all([
      dogIds.length
        ? supabase.from('dogs').select('id, name').in('id', dogIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      dogIds.length
        ? supabase
            .from('dog_formulas')
            .select(
              'id, dog_id, cycle_number, formula, daily_kcal, ' +
                'transition_strategy, user_adjusted, approval_status',
            )
            .in('dog_id', dogIds)
            .order('cycle_number', { ascending: false })
        : Promise.resolve({ data: [] as unknown[] }),
      supabase
        .from('products')
        .select('slug, name, price, sale_price, stock, is_subscribable')
        .in('slug', allSlugs)
        .eq('is_active', true),
    ])

  const dogNames: Record<string, string> = {}
  for (const d of (dogsRaw ?? []) as Array<{ id: string; name: string }>) {
    dogNames[d.id] = d.name
  }

  // 강아지별 최신 **발송 가능** 처방 — DB check 제약의 실제 값 기준:
  //   auto_applied·approved = 발송 가능 / pending_approval(승인 대기)·
  //   declined(보호자 거절) = 발송 금지 → 그 이전 승인분으로 폴백.
  // (불변식: 승인 전엔 옛 처방·옛 금액 그대로.) cycle desc 정렬이라 첫 매치가 최신.
  const formulaByDog: Record<string, FormulaRow> = {}
  for (const f of ((formulasRaw ?? []) as unknown) as FormulaRow[]) {
    if (f.approval_status === 'pending_approval' || f.approval_status === 'declined')
      continue
    if (!formulaByDog[f.dog_id]) formulaByDog[f.dog_id] = f
  }

  const products: Record<string, PickProduct> = {}
  for (const p of ((prodRaw ?? []) as unknown) as PickProduct[]) {
    products[p.slug] = p
  }

  // 3) 구독 → 팩 구성 (boxPricing 정본).
  const rows: PickingRow[] = subs.map((sub) => {
    const dogName = (sub.dog_id && dogNames[sub.dog_id]) || '(강아지 미상)'
    const f = sub.dog_id ? formulaByDog[sub.dog_id] : undefined
    const freshRatio = sub.fresh_ratio ?? 100

    let packs: PickingRow['packs'] = []
    if (f) {
      const items = subscribableItems(
        computeBoxItems({
          formula: {
            lineRatios: f.formula.lineRatios,
            toppers: f.formula.toppers ?? { vegetable: 0, protein: 0 },
            dailyKcal: f.daily_kcal,
          },
          freshRatio,
          products,
        }),
      )
      packs = items.map((it: BoxItem<PickProduct>) => ({
        name: it.product.name,
        packG: it.packG,
        count: it.quantity,
        totalG: it.deliveredG,
      }))
    }

    return {
      subId: sub.id,
      dogName,
      recipientName: sub.recipient_name ?? '(수령인 미등록)',
      phone: sub.recipient_phone ?? '',
      zip: sub.zip ?? '',
      addressLine:
        [sub.address, sub.address_detail].filter(Boolean).join(' ') ||
        '(주소 미등록)',
      memo: sub.delivery_memo ?? '',
      freshRatio,
      freshLabel: freshTierLabel(sub.fresh_ratio),
      freshUnknown: sub.fresh_ratio == null,
      cycleNumber: f?.cycle_number ?? null,
      userAdjusted: f?.user_adjusted ?? false,
      transition: f?.transition_strategy ?? '',
      noFormula: !f,
      charged: sub.next_delivery_date === chargedBumpDate,
      overdue:
        sub.next_delivery_date != null && sub.next_delivery_date < shipDate,
      totalAmount: sub.total_amount,
      packs,
      boxTotalG: packs.reduce((s, p) => s + p.totalG, 0),
    }
  })

  // 4) 조리 합계 — 제품별 총 팩수·총 그램 (그날 주방이 만들 전체 물량).
  const cookTotals = new Map<string, { packs: number; grams: number }>()
  for (const r of rows) {
    for (const p of r.packs) {
      const cur = cookTotals.get(p.name) ?? { packs: 0, grams: 0 }
      cookTotals.set(p.name, {
        packs: cur.packs + p.count,
        grams: cur.grams + p.totalG,
      })
    }
  }
  const totalPacks = rows.reduce(
    (s, r) => s + r.packs.reduce((x, p) => x + p.count, 0),
    0,
  )
  const totalGrams = rows.reduce((s, r) => s + r.boxTotalG, 0)
  const totalAmountSum = rows.reduce((s, r) => s + r.totalAmount, 0)
  const problemCount = rows.filter((r) => r.noFormula || r.overdue).length

  const prevShip = addDaysKst(shipDate, -7)
  const nextShip = addDaysKst(shipDate, 7)

  return (
    <main className="px-5 py-6 max-w-6xl mx-auto">
      <AdminHeader
        title={`박스 패킹 — ${shipDate} (${weekdayKo(shipDate)})`}
        sub={
          <>
            화요일 발송분 박스를 싸기 위한 리스트예요 — 강아지별로 어떤
            레시피 팩을 몇 개 넣는지 나와요 (섞는 박스는 두 레시피 반반).
            고객이 결제한 금액과 같은 기준으로 계산돼요.{' '}
            <Link href={`?date=${prevShip}`} className="underline">
              ← 지난주
            </Link>{' '}
            ·{' '}
            <Link href={`?date=${nextShip}`} className="underline">
              다음주 →
            </Link>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <ShippingLabels rows={rows} date={shipDate} />
            <PickingListExport rows={rows} date={shipDate} />
          </div>
        }
      />

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="발송 박스" value={rows.length} sub="이 발송일에 나갈 구독" />
        <StatCard label="총 팩 수" value={totalPacks} sub="조리·포장할 팩 개수" />
        <StatCard
          label="총 조리량"
          value={`${(totalGrams / 1000).toFixed(1)}kg`}
          sub="팩 그램 합계 (5g 올림 반영)"
        />
        <StatCard
          label="확인 필요"
          value={problemCount}
          tone={problemCount > 0 ? 'red' : 'green'}
          sub={problemCount > 0 ? '처방 없음·지연 청구' : '문제 없음'}
          help="처방이 없거나(포장 불가) 청구가 밀린(카드 문제) 박스 수예요."
        />
      </div>

      {/* 조리 합계 — 주방용. 제품별로 이날 만들 총량. */}
      {cookTotals.size > 0 && (
        <AdminCard className="mb-6">
          <SectionTitle
            title="조리 합계"
            desc="이 발송일에 주방이 만들 제품별 총량이에요. (팩 그램 × 팩 수)"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[...cookTotals.entries()].map(([name, t]) => (
              <div
                key={name}
                className="rounded-lg border border-zinc-200 px-3 py-2.5"
              >
                <p className="text-[12px] font-bold text-zinc-800 truncate">
                  {name}
                </p>
                <p className="text-[15px] font-bold text-zinc-900 mt-0.5">
                  {(t.grams / 1000).toFixed(2)}kg
                  <span className="text-[11px] text-zinc-500 font-semibold ml-1.5">
                    {t.packs}팩
                  </span>
                </p>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* 박스 목록 */}
      {rows.length === 0 ? (
        <AdminCard>
          <p className="text-[13px] text-zinc-500">
            이 발송일에 나갈 박스가 없어요. 카드가 등록된 활성 구독만 발송
            대상이에요.
          </p>
        </AdminCard>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <AdminCard key={r.subId} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-zinc-900">
                  {r.dogName}
                </span>
                <span className="text-[12px] text-zinc-500">
                  {r.recipientName}
                </span>
                <Badge tone={r.freshUnknown ? 'amber' : 'blue'}>
                  {r.freshLabel} {r.freshRatio}%
                  {r.freshUnknown ? ' (비율 미상 — 100% 기준)' : ''}
                </Badge>
                {r.cycleNumber != null && (
                  <Badge tone="neutral">cycle {r.cycleNumber}</Badge>
                )}
                {r.userAdjusted && <Badge tone="neutral">보호자 조정</Badge>}
                {r.charged ? (
                  <Badge tone="green">오늘 아침 청구 완료</Badge>
                ) : r.overdue ? (
                  <Badge tone="red">청구 지연 — 재시도 중</Badge>
                ) : (
                  <Badge tone="amber">발송일 아침 청구 예정</Badge>
                )}
              </div>

              {r.noFormula ? (
                <p className="mt-3 text-[12.5px] font-semibold text-red-600">
                  ⚠ 승인된 처방이 없어 팩 구성을 계산할 수 없어요 — 이 강아지의
                  처방을 먼저 확인해 주세요.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.packs.map((p) => (
                    <div
                      key={p.name}
                      className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2"
                    >
                      <p className="text-[12px] font-bold text-zinc-800">
                        {p.name}
                      </p>
                      <p className="text-[12.5px] text-zinc-600 mt-0.5">
                        <strong className="text-zinc-900">{p.packG}g</strong> ×{' '}
                        {p.count}팩 ={' '}
                        {p.totalG >= 1000
                          ? `${(p.totalG / 1000).toFixed(2)}kg`
                          : `${p.totalG}g`}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                <span>
                  [{r.zip}] {r.addressLine}
                </span>
                {r.phone && <span>{r.phone}</span>}
                {r.memo && (
                  <span className="text-amber-700 font-semibold">
                    메모: {r.memo}
                  </span>
                )}
                <span className="ml-auto font-bold text-zinc-700">
                  {r.totalAmount.toLocaleString()}원
                </span>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* 합계 푸터 */}
      {rows.length > 0 && (
        <p className="mt-4 text-right text-[12px] text-zinc-500">
          청구 합계{' '}
          <strong className="text-zinc-800">
            {totalAmountSum.toLocaleString()}원
          </strong>{' '}
          · {rows.length}박스 · {totalPacks}팩 ·{' '}
          {(totalGrams / 1000).toFixed(1)}kg
        </p>
      )}
    </main>
  )
}
