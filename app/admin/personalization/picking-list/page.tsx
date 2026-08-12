import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import {
  computeBoxItems,
  subscribableItems,
  type BoxItem,
} from '@/lib/personalization/boxPricing'
import type { Formula } from '@/lib/personalization/types'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { addDaysKst, todayKstIsoDate, kstDateOf } from '@/lib/datetime-kst'
import { isShippable } from '@/lib/admin/ship-block'
import { weekdayOf, weekdayKo, SHIP_WEEKDAY } from '@/lib/shipping-schedule'
import {
  AdminHeader,
  AdminCard,
  Badge,
  StatCard,
  SectionTitle,
} from '@/components/admin/ui'
import CopyField from '@/components/admin/CopyField'
import PickingListExport, { type PickingRow } from './PickingListExport'
import ShippingLabels from './ShippingLabels'
import PackingChecklist from './PackingChecklist'

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
  /** active | paused — paused 는 "결제 후 정지" 경고 표시용(2026-08-07). */
  status: string
  /** 청구 가능 판정용 — 이 둘이 없으면 청구 크론이 건너뛴다. */
  /** 카드 등록 여부만 — 키 값은 서버 밖으로 안 나간다(20260808000100). */
  has_billing_key: boolean
  requires_billing_key_renewal: boolean | null
  /**
   * ★오늘 청구가 실패했는지 판정용(2026-08-12 3라운드 감사).
   * 청구 실패는 next_delivery_date 를 **안 민다** → charged=false, overdue=false 라
   * 배지가 최종 else 인 "발송일 아침 청구 예정" 으로 떨어졌다. 이미 실패한 뒤인데
   * 예정이라고 말하니 그대로 조리·포장·발송됐다(무료 박스).
   */
  last_failed_charge_at: string | null
  last_failed_charge_code: string | null
}

type PickProduct = {
  slug: string
  name: string
  price: number
  sale_price: number | null
  stock: number
  is_subscribable: boolean | null
}

/** 판매중지분까지 포함 — 빠진 이유를 말해 주기 위한 조회에만 쓴다. */
type PickProductAll = PickProduct & { is_active: boolean | null }

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
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/personalization/picking-list')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const sp = await searchParams
  const shipDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : upcomingShipDate()
  const chargedBumpDate = addDaysKst(shipDate, 14)

  // 1) 발송 대상 구독 — 카드 미등록 구독은 next_delivery_date=null 이라 자동 제외.
  // ★paused 도 함께 가져온다(2026-08-07 재감사).
  //   청구(KST 09:10) 한 시간 뒤 personalization-progression(10:10)이 알레르기
  //   누출을 감지하면 status='paused' 로 바꾼다. 그런데 이 목록은 'active' 만
  //   봤으므로 **한 시간 전에 결제된 박스가 포장 목록에서 사라졌다** — 주문은
  //   'preparing' 으로 남아 admin 주문 목록엔 보이니, 두 화면이 같은 건을
  //   정반대로 말했다(안 보냄 vs 보내야 함). 환불도 없다.
  //   돈을 받았으면 사장님이 그 사실을 알아야 한다 — 아래에서 경고로 표시한다.
  const { data: subsRaw, error: subsErr } = await supabase
    .from('subscriptions')
    .select(
      'id, dog_id, user_id, status, fresh_ratio, next_delivery_date, total_amount, ' +
        'recipient_name, recipient_phone, zip, address, address_detail, ' +
        'delivery_memo, total_deliveries, has_billing_key, requires_billing_key_renewal, ' +
        'last_failed_charge_at, last_failed_charge_code',
    )
    .in('status', ['active', 'paused'])
    .or(
      `next_delivery_date.lte.${shipDate},next_delivery_date.eq.${chargedBumpDate}`,
    )
    .order('created_at', { ascending: true })
  if (subsErr) {
    // 조회 실패를 "출고할 게 없음"으로 읽으면 그날 발송이 통째로 빠진다.
    throw new Error(`구독 조회 실패 — 목록을 신뢰할 수 없어요: ${subsErr.message}`)
  }
  const subs = ((subsRaw ?? []) as unknown) as SubRow[]

  /**
   * ★청구된 박스는 날짜가 어떻게 바뀌어도 이 목록에 남는다 (2026-08-08 재감사).
   *
   * 위 필터는 next_delivery_date 기준이다. 그런데 청구(화 09:10) **직후**
   * 고객이 '2주 미루기'나 '다시 시작'을 누르면 그 칸이 필터 밖(T+28·T+7)으로
   * 이동한다 — next_delivery_date 는 고객이 직접 쓸 수 있는 화이트리스트
   * 4칸 중 하나라 원천 차단이 안 된다. 돈은 받았고 주문은 preparing 인데
   * **조리·포장 목록에서만 사라졌다.** 발송 대기 주문(결제됨·preparing)을
   * 역방향 정본으로 삼아, 날짜 필터에 안 걸린 구독을 도로 붙이고 경고를 단다.
   */
  const subIdSet = new Set(subs.map((s) => s.id))
  const { data: strayOrders, error: strayErr } = await supabase
    .from('orders')
    .select('subscription_id')
    .in('payment_status', PAID_STATUSES)
    .eq('order_status', 'preparing')
    .not('subscription_id', 'is', null)
  if (strayErr) {
    throw new Error(
      `발송 대기 주문 조회 실패 — 목록을 신뢰할 수 없어요: ${strayErr.message}`,
    )
  }
  const movedIds = [
    ...new Set(
      ((strayOrders ?? []) as Array<{ subscription_id: string | null }>)
        .map((o) => o.subscription_id)
        .filter((id): id is string => id != null && !subIdSet.has(id)),
    ),
  ]
  const movedSubIds = new Set<string>()
  if (movedIds.length > 0) {
    const { data: movedRaw, error: movedErr } = await supabase
      .from('subscriptions')
      .select(
        'id, dog_id, user_id, status, fresh_ratio, next_delivery_date, total_amount, ' +
          'recipient_name, recipient_phone, zip, address, address_detail, ' +
          'delivery_memo, total_deliveries, has_billing_key, requires_billing_key_renewal, ' +
        'last_failed_charge_at, last_failed_charge_code',
      )
      .in('id', movedIds)
    if (movedErr) {
      throw new Error(
        `일정 이동 구독 조회 실패 — 목록을 신뢰할 수 없어요: ${movedErr.message}`,
      )
    }
    for (const m of ((movedRaw ?? []) as unknown) as SubRow[]) {
      subs.push(m)
      movedSubIds.add(m.id)
    }
  }

  const dogIds = [...new Set(subs.map((s) => s.dog_id).filter(Boolean))] as string[]

  /**
   * 이번 출고분 주문 — 포장하다 바로 송장을 넣으러 갈 수 있게 (2026-08-07 감사).
   *
   * 예전엔 피킹 리스트에 주문으로 가는 링크가 없어서, 포장할 때마다 주문 목록을
   * 따로 열고 수령인 이름으로 검색해 찾아야 했다. 매주 화요일 반복되는 손실이다.
   *
   * 구독당 **가장 최근** 미발송 주문 하나만 붙인다. 없으면(=아직 청구 전) 링크를
   * 안 보여준다 — 없는 링크를 만들어 막다른 길을 주는 것보다 낫다.
   */
  const subIds = subs.map((s) => s.id)
  const orderBySubId = new Map<string, { id: string; orderNumber: string }>()
  if (subIds.length > 0) {
    const { data: orderRows, error: ordersErr } = await supabase
      .from('orders')
      .select('id, order_number, subscription_id, created_at')
      .in('subscription_id', subIds)
      .in('payment_status', PAID_STATUSES)
      .eq('order_status', 'preparing')
      .order('created_at', { ascending: false })
    if (ordersErr) {
      // 링크가 없는 건 견딜 수 있지만, 조용히 없는 것처럼 보이면 안 된다.
      console.error('[picking-list] 주문 조회 실패', ordersErr.message)
    }
    for (const o of (orderRows ?? []) as Array<{
      id: string
      order_number: string
      subscription_id: string | null
    }>) {
      if (o.subscription_id && !orderBySubId.has(o.subscription_id)) {
        orderBySubId.set(o.subscription_id, {
          id: o.id,
          orderNumber: o.order_number,
        })
      }
    }
  }

  // 2) 강아지 이름 + 최신 승인 처방 + 제품(정본 계산용) 병렬 로드.
  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const [
    { data: dogsRaw },
    { data: formulasRaw },
    { data: prodRaw },
    { data: prodAllRaw },
  ] = await Promise.all([
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
            // ★처방 정렬은 created_at — cycle_number 가 아니다 (2026-07-30 최종감사).
            // 회차 번호가 큰 것이 최신이 아니다: 프로덕션 실측으로 cycle 2 가 cycle 1
            // 보다 5일 **먼저** 생성돼 있었다. 회차로 고르면 청구(subscription-charge)와
            // 다른 처방을 집어 "청구한 금액과 담는 박스가 다른 처방" 이 된다 —
            // 사장님이 과거 지적한 "닭으로 추천받았는데 오리랑 소를 받아" 와 같은 부류.
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as unknown[] }),
      supabase
        .from('products')
        .select('slug, name, price, sale_price, stock, is_subscribable')
        .in('slug', allSlugs)
        .eq('is_active', true),
      /**
       * ★ 같은 슬러그를 **필터 없이** 한 번 더 읽는다 (2026-07-31).
       *
       * 포장 대상은 위 조회(is_active=true)가 그대로 정한다 — 무엇을 담을지는
       * 안 바뀐다. 이건 **무엇이 빠졌는지 설명하기 위한** 조회다.
       *
       * 왜 필요한가: 팩 구성은 `computeBoxItems` → `subscribableItems` 를 거치는데
       * 그 두 단계가 **말없이 버린다** — 판매중지(products 조회에서 탈락하여
       * `if (!product) continue`, boxPricing:189)거나 재고 0·구독불가면
       * `subscribableItems`(:259)가 걸러낸다. 그래서 레시피가 3종을 부르는데
       * 리스트엔 2종만 뜨고, 사장님은 **빠진 걸 모른 채 포장해서 보낸다.**
       * 금액은 저장된 total_amount 로 그대로 청구되므로(규칙5) 고객은 제값을
       * 내고 덜 받는다. 조용히 빠지는 게 문제지 빠지는 것 자체가 문제가 아니다 —
       * 사람이 보고 판단할 수 있게 이름과 이유를 같이 띄운다.
       */
      supabase
        .from('products')
        .select('slug, name, price, sale_price, stock, is_subscribable, is_active')
        .in('slug', allSlugs),
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

  // 판매중지·재고0 까지 포함한 전체 — "무엇이 왜 빠졌는지" 설명 전용.
  // 포장 대상(products)에는 넣지 않는다.
  const productsAll: Record<string, PickProductAll> = {}
  for (const p of ((prodAllRaw ?? []) as unknown) as PickProductAll[]) {
    productsAll[p.slug] = p
  }

  /** 빠진 이유를 사람 말로. 순서가 곧 우선순위 — 판매중지가 재고보다 근본적이다. */
  function missingReason(p: PickProductAll | undefined): string {
    if (!p) return '상품 없음'
    if (p.is_active === false) return '판매중지'
    if ((p.stock ?? 0) <= 0) return '재고 0'
    if (p.is_subscribable === false) return '구독 불가'
    return '알 수 없음'
  }

  // 3) 구독 → 팩 구성 (boxPricing 정본).
  const rows: PickingRow[] = subs.map((sub) => {
    const dogName = (sub.dog_id && dogNames[sub.dog_id]) || '(강아지 미상)'
    const f = sub.dog_id ? formulaByDog[sub.dog_id] : undefined
    /**
     * ★비율을 **추측하지 않는다** (2026-08-08 금액 감사).
     *
     * 예전엔 `sub.fresh_ratio ?? 100` 이었다. 그런데 저장소의 다른 전 경로는
     * 비율이 없으면 **계산을 거부**한다(`lib/subscription/boxQuote.ts:55`
     * `if (!(input.freshRatio > 0)) return null`). 여기만 100% 로 가정했다.
     *
     * `fresh_ratio` 는 nullable 이다(20260713000000). 값이 없는데 100% 로
     * 담으면, 30% 요금(85,700원)을 청구한 고객에게 **100% 박스(277,100원어치)
     * 를 보낸다 — 3.2배**다. 반대 방향이면 제값 내고 3분의 1만 받는다.
     *
     * 모르면 담지 않는다. 화면이 사장님께 그 사실을 말하고 판단을 넘긴다.
     * (화면엔 이미 '비율 미상' 배지가 있었지만, 그 옆에서 팩 구성은 100%
     *  기준으로 그려지고 있었다 — 배지가 경고가 아니라 각주였다.)
     */
    const freshRatio = sub.fresh_ratio
    const freshUnknown = freshRatio == null

    let packs: PickingRow['packs'] = []
    let missing: PickingRow['missing'] = []
    if (f && !freshUnknown) {
      const boxInput = {
        formula: {
          lineRatios: f.formula.lineRatios,
          toppers: f.formula.toppers ?? { vegetable: 0, protein: 0 },
          dailyKcal: f.daily_kcal,
        },
        freshRatio,
      }
      const items = subscribableItems(
        computeBoxItems({ ...boxInput, products }),
      )
      packs = items.map((it: BoxItem<PickProduct>) => ({
        name: it.product.name,
        packG: it.packG,
        count: it.quantity,
        totalG: it.deliveredG,
      }))

      /**
       * ★ 레시피가 부른 것과 실제 담기는 것을 대조한다 (2026-07-31).
       *
       * `computeBoxItems` 는 상품 행이 없으면 `continue`(boxPricing:189),
       * `subscribableItems` 는 재고 0·구독불가를 `filter` 로 버린다(:259).
       * 둘 다 **말없이** 버려서, 레시피가 3종을 부르는데 리스트엔 2종만 뜨고
       * 사장님은 빠진 걸 모른 채 포장한다. 금액은 저장된 total_amount 로 그대로
       * 나가므로(규칙5) 고객은 제값을 내고 덜 받는다.
       *
       * 같은 순수 함수를 **판매중지분까지 포함한 목록**으로 한 번 더 돌려서
       * "원래 들어갔어야 할 것"을 만들고 차집합을 낸다. 비율 계산을 여기서
       * 다시 짜지 않는 게 핵심이다 — 그러면 정본이 둘이 되어 조용히 갈라진다.
       */
      const intended = computeBoxItems({ ...boxInput, products: productsAll })
      const packedSlugs = new Set(items.map((it) => it.product.slug))
      missing = intended
        .filter((it) => !packedSlugs.has(it.product.slug))
        .map((it: BoxItem<PickProductAll>) => ({
          name: it.product.name,
          packG: it.packG,
          count: it.quantity,
          reason: missingReason(productsAll[it.product.slug]),
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
      freshRatio: freshRatio ?? 0,
      freshLabel: freshTierLabel(sub.fresh_ratio),
      freshUnknown,
      cycleNumber: f?.cycle_number ?? null,
      userAdjusted: f?.user_adjusted ?? false,
      transition: f?.transition_strategy ?? '',
      noFormula: !f,
      // ★결제는 됐는데 그 뒤 정지된 건(2026-08-07). 청구(09:10) 한 시간 뒤
      //   재제안 크론(10:10)이 알레르기 누출을 감지하면 status 를 paused 로
      //   바꾼다 — 돈은 이미 받았다. 목록에서 지우지 말고 **사장님이 판단**하게
      //   보여준다(보낼지, 환불할지).
      //
      // ★2026-08-12 반증감사: 예전엔 `status === 'paused'` 만 봤다. 그런데
      //   일시정지는 next_delivery_date 를 **안 지운다**(해지만 지운다) — 그래서
      //   고객이 청구 전에 스스로 멈춘 구독(=한 푼도 안 받음)이 이 목록에 남아
      //   "돈은 이미 받았으니 보낼지 판단하세요" 로 뜨고, 정지가 풀릴 때까지
      //   매주 재등장했다. 무료 박스가 나갈 수 있는 자리다.
      //   판정을 추측이 아니라 **증거**로 바꾼다 — orderBySubId 는 이 구독의
      //   '결제됨 + 발송대기(preparing)' 주문이다. 그게 있어야 돈을 받은 것이다.
      pausedAfterCharge: sub.status === 'paused' && orderBySubId.has(sub.id),
      // 청구 전에 고객이 멈춘 건 — 보내면 안 된다(대금 없음).
      pausedBeforeCharge: sub.status === 'paused' && !orderBySubId.has(sub.id),
      // ★청구 후 고객이 일정을 옮겨 날짜 필터 밖으로 나간 건 — 발송 대기
      //   주문 역추적으로 붙었다. 돈은 받았으니 이번 발송에 포함해야 한다.
      dateMovedAfterCharge: movedSubIds.has(sub.id),
      // 청구 크론과 **같은 조건**. 이게 false 면 결제 없이 박스만 나간다.
      cannotCharge:
        !sub.has_billing_key || sub.requires_billing_key_renewal === true,
      charged: sub.next_delivery_date === chargedBumpDate,
      overdue:
        sub.next_delivery_date != null && sub.next_delivery_date < shipDate,
      /**
       * ★오늘 청구가 실패했다 (2026-08-12 3라운드 감사).
       * 실패는 next_delivery_date 를 안 밀기 때문에 charged=false·overdue=false 가
       * 되어 배지가 "발송일 아침 청구 예정" 으로 떨어졌다 — **이미 실패한 뒤인데**
       * 예정이라 말하니 그대로 조리·발송됐다. last_failed_charge_at 의 KST 날짜가
       * 오늘이면 오늘 청구가 깨진 것이다.
       */
      chargeFailedToday:
        sub.last_failed_charge_at != null &&
        kstDateOf(sub.last_failed_charge_at) === todayKstIsoDate(),
      failedCode: sub.last_failed_charge_code,
      totalAmount: sub.total_amount,
      order: orderBySubId.get(sub.id) ?? null,
      packs,
      missing,
      boxTotalG: packs.reduce((s, p) => s + p.totalG, 0),
    }
  })

  // 4) 조리 합계 — 제품별 총 팩수·총 그램 (그날 주방이 만들 전체 물량).
  //
  // ★발송 금지 건은 빼고 센다(2026-08-12 3라운드 감사). 돈을 못 받은 박스까지
  //   합계에 넣으면 **그만큼 재료를 사고 조리한다** — 화면 배지가 "보내지
  //   마세요" 라고 말해도 합계가 이미 그 물량을 시켰다. 라벨 필터와 **같은
  //   목록**을 쓴다(판정이 갈리면 또 어긋난다).
  const shippable = rows.filter(isShippable)
  const cookTotals = new Map<string, { packs: number; grams: number }>()
  for (const r of shippable) {
    for (const p of r.packs) {
      const cur = cookTotals.get(p.name) ?? { packs: 0, grams: 0 }
      cookTotals.set(p.name, {
        packs: cur.packs + p.count,
        grams: cur.grams + p.totalG,
      })
    }
  }
  const totalPacks = shippable.reduce(
    (s, r) => s + r.packs.reduce((x, p) => x + p.count, 0),
    0,
  )
  const totalGrams = shippable.reduce((s, r) => s + r.boxTotalG, 0)
  const totalAmountSum = rows.reduce((s, r) => s + r.totalAmount, 0)
  // ★ 청구 불가도 '확인 필요' 다 — 예전엔 noFormula/overdue 만 세어서,
  //   결제되지 않을 박스가 아무 표시 없이 포장 대상에 섞였다(2026-07-31).
  // ★freshUnknown 도 문제다 (2026-08-08 diff 재검증). 행 단위는 빨간 경고를
  //  달았는데 이 카운트에서 빠져 '확인 필요' 타일이 그 박스를 안 셌다 —
  //  팩이 0g 으로 계산 제외되는데 상단 요약(총 조리량)은 그 사실을 안 말해서,
  //  주방이 요약 기준으로 조리하면 그만큼 부족했다.
  const problemCount = rows.filter(
    (r) =>
      r.noFormula ||
      r.freshUnknown ||
      r.overdue ||
      r.cannotCharge ||
      r.pausedAfterCharge ||
      r.dateMovedAfterCharge ||
      r.missing.length > 0,
  ).length
  const excludedFromTotals = rows.filter(
    (r) => r.noFormula || r.freshUnknown,
  ).length

  /**
   * 레시피가 부를 수 있는 슬러그인데 **products 에 행 자체가 없는** 것.
   *
   * 이건 행별 경고로 안 잡힌다 — 행이 없으면 `computeBoxItems` 가 '원래 담겼어야
   * 할 것' 목록에도 못 넣기 때문이다(비교 대상 자체가 안 생긴다). 설정 문제라
   * 드물지만, 나면 그 라인을 쓰는 **모든 박스**에서 한 종이 통째로 조용히 빠진다.
   */
  const unknownSlugs = allSlugs.filter((sl) => !productsAll[sl])

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
          sub={
            problemCount > 0
              ? excludedFromTotals > 0
                ? `처방·비율 미상 ${excludedFromTotals}박스는 아래 합계에서 빠져 있어요`
                : '처방 없음·지연 청구·품절'
              : '문제 없음'
          }
          help="처방이 없거나(포장 불가), 화식 비율이 저장돼 있지 않거나(계산 불가), 청구가 밀렸거나(카드 문제), 레시피 항목을 담을 수 없는(품절·판매중지) 박스 수예요. 처방·비율이 없는 박스는 총 조리량 합계에 포함되지 않으니 그만큼 따로 계산해 주세요."
        />
      </div>

      {unknownSlugs.length > 0 && (
        <AdminCard className="mb-6 border-red-300 bg-red-50">
          <p className="text-[13px] font-bold text-red-800">
            ⚠ 상품 등록이 빠진 레시피 항목이 있어요
          </p>
          <p className="mt-1 text-[12.5px] text-red-700">
            아래 항목은 레시피가 부를 수 있는데 상품 목록에 없어요. 이 라인을 쓰는
            <strong> 모든 박스에서 한 종이 통째로 빠진 채</strong> 포장됩니다 —
            상품을 먼저 등록해 주세요.
          </p>
          <p className="mt-1.5 text-[12px] font-mono text-red-800">
            {unknownSlugs.join(' · ')}
          </p>
        </AdminCard>
      )}

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
        // 계획 A-F2 — 패킹 체크 모드. 카드 렌더는 그대로 두고 체크 토글만 얹는다.
        <PackingChecklist shipDate={shipDate} subIds={rows.map((r) => r.subId)}>
          {rows.map((r) => (
            <AdminCard key={r.subId} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-zinc-900">
                  {r.dogName}
                </span>
                <span className="text-[12px] text-zinc-500">
                  {r.recipientName}
                </span>
                <Badge tone={r.freshUnknown ? 'red' : 'blue'}>
                  {r.freshUnknown
                    ? '화식 비율 미상'
                    : `${r.freshLabel} ${r.freshRatio}%`}
                </Badge>
                {r.cycleNumber != null && (
                  <Badge tone="neutral">cycle {r.cycleNumber}</Badge>
                )}
                {r.userAdjusted && <Badge tone="neutral">보호자 조정</Badge>}
                {/* ★ 청구 불가를 **가장 먼저** 판정한다 (2026-07-31).
                    예전엔 이 구독에도 '발송일 아침 청구 예정' 이 떴다 — 청구
                    크론이 영원히 건너뛰는데도. 사실이 아닌 안내였다. */}
                {/* ★판정 순서 = **발송 금지 사유 먼저**(2026-08-12 3라운드 감사).
                    예전엔 paused 가 맨 앞이라 '청구 불가'(카드 영구거절 등)를
                    가렸고, 청구가 **실패**한 건은 어떤 가지에도 안 걸려 최종
                    else 인 "청구 예정" 으로 떨어져 그대로 발송됐다. 돈을 못 받는
                    사유를 전부 앞에 세우고, 마지막 else 는 진짜 '아직 청구 전'
                    일 때만 남게 한다. */}
                {r.cannotCharge ? (
                  <Badge tone="red">청구 불가 — 발송하지 마세요</Badge>
                ) : r.chargeFailedToday ? (
                  <Badge tone="red">오늘 청구 실패 — 보내지 마세요</Badge>
                ) : r.pausedBeforeCharge ? (
                  <Badge tone="red">고객이 정지 — 미결제, 보내지 마세요</Badge>
                ) : r.pausedAfterCharge ? (
                  <Badge tone="amber">결제 후 정지됨 — 확인 필요</Badge>
                ) : r.dateMovedAfterCharge ? (
                  <Badge tone="amber">결제됨 — 발송 대기 주문 있음</Badge>
                ) : r.charged ? (
                  <Badge tone="green">오늘 아침 청구 완료</Badge>
                ) : r.overdue ? (
                  <Badge tone="red">청구 지연 — 재시도 중</Badge>
                ) : (
                  <Badge tone="amber">발송일 아침 청구 예정</Badge>
                )}
              </div>

              {r.chargeFailedToday && !r.cannotCharge && (
                <p className="mt-3 text-[12.5px] font-semibold text-red-600">
                  ⛔ <strong>오늘 아침 청구가 실패</strong>했어요
                  {r.failedCode ? ` (${r.failedCode})` : ''}. 돈을 못 받았으니
                  조리·발송하지 마세요. 카드 문제면 고객이 카드를 바꾼 뒤 자동으로
                  다시 청구돼요 — 그때 발송하시면 됩니다.
                </p>
              )}

              {r.pausedBeforeCharge && (
                <p className="mt-3 text-[12.5px] font-semibold text-red-600">
                  ⛔ 고객이 <strong>결제 전에 직접 일시정지</strong>한 구독이에요.
                  이번 회차는 <strong>청구되지 않았습니다</strong> — 조리·발송하지
                  마세요. (일시정지는 배송일을 지우지 않아서 목록에 남습니다.
                  고객이 다시 시작하면 그때 정상 청구돼요.)
                </p>
              )}

              {r.pausedAfterCharge && (
                <p className="mt-3 text-[12.5px] font-semibold text-amber-800">
                  ⚠ 결제는 됐는데 그 뒤 구독이 <strong>정지</strong>됐어요(대개
                  알레르기 누출이 감지되면 자동으로 멈춥니다). 돈은 이미 받았으니
                  그냥 사라지면 안 됩니다 — <strong>보낼지 환불할지 판단</strong>해
                  주세요. 레시피가 안전한지부터 확인하시는 게 좋습니다.
                </p>
              )}

              {r.dateMovedAfterCharge && (
                <p className="mt-3 text-[12.5px] font-semibold text-amber-800">
                  ⚠ <strong>결제된 발송 대기 주문</strong>이 있는데 배송일만
                  보면 이번 발송 대상이 아닌 것처럼 보이는 구독이에요. 고객이
                  청구 직후 일정을 옮겼거나, 해지했거나, 지난주에 송장을 안
                  넣어 남은 것일 수 있어요 — 돈은 이미 받았으니 목록에 남겨
                  뒀어요. 보내는 게 기본이고, 애매하면 주문 링크에서 결제일을
                  먼저 확인해 주세요.
                </p>
              )}

              {r.cannotCharge && (
                <p className="mt-3 text-[12.5px] font-semibold text-red-600">
                  ⚠ 결제수단이 없거나 카드가 영구 거절된 구독이에요. 자동결제가
                  일어나지 않으니 <strong>이 박스는 보내지 마세요.</strong> 고객이
                  결제수단을 다시 등록하면 다음 회차부터 정상 발송됩니다.
                </p>
              )}

              {/* ★ 조용히 빠진 항목을 드러낸다 (2026-07-31). 예전엔 그냥
                  사라져서 3종 레시피가 2종으로 포장돼 나갔다 — 금액은 그대로. */}
              {r.missing.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3">
                  <p className="text-[12.5px] font-bold text-amber-900">
                    ⚠ 레시피에 있는데 담을 수 없는 항목이 {r.missing.length}개
                    있어요 — 이대로 보내면 <strong>제값 받고 덜 나갑니다.</strong>
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {r.missing.map((m) => (
                      <li key={m.name} className="text-[12px] text-amber-900">
                        · <strong>{m.name}</strong> {m.packG}g × {m.count}팩 —{' '}
                        {m.reason}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11.5px] text-amber-800">
                    재고를 채워 다시 열거나, 발송을 미루거나, 고객에게 알리고
                    조정해 주세요.
                  </p>
                </div>
              )}

              {r.freshUnknown ? (
                /* ★비율을 모르면 팩을 계산하지 않는다(2026-08-08 금액 감사).
                   추측해서 담으면 청구액과 박스가 최대 3.2배 갈린다. */
                <p className="mt-3 text-[12.5px] font-semibold text-red-600">
                  ⚠ 화식 비율이 저장돼 있지 않아 팩 구성을 계산하지 않았어요 —
                  추측해서 담으면 청구한 금액과 박스가 어긋납니다. 이 구독의
                  화식 비율을 먼저 확인해 주세요.
                </p>
              ) : r.noFormula ? (
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

              {/* 주소·전화는 눌러서 복사 — 폰으로 드래그 선택하다 잘못 복사하면
                  엉뚱한 곳으로 박스가 간다(2026-08-07 감사). */}
              <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500">
                <CopyField
                  value={`[${r.zip}] ${r.addressLine}`}
                  label={`[${r.zip}] ${r.addressLine}`}
                />
                {r.phone && <CopyField value={r.phone} />}
                {r.memo && (
                  <span className="text-amber-700 font-semibold">
                    메모: {r.memo}
                  </span>
                )}
                {r.order && (
                  <Link
                    href={`/admin/orders/${r.order.id}`}
                    className="font-bold text-terracotta underline underline-offset-2"
                  >
                    주문 {r.order.orderNumber} →
                  </Link>
                )}
                <span className="ml-auto font-bold text-zinc-700">
                  {r.totalAmount.toLocaleString()}원
                </span>
              </div>
            </AdminCard>
          ))}
        </PackingChecklist>
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
