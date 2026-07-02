'use client'

// audit #101 — OrderClient: 정기배송 신청 폼 + 분량 계산 + Toss billing-auth
// redirect. page.tsx (server) 가 dog ownership + formula + profile + products
// 를 server prefetch 후 prop drill. 빈 spinner 800ms+ 제거.
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  Check,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Bell,
  PackageOpen,
  Repeat,
  Truck,
  Search,
  CalendarDays,
  CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { haptic } from '@/lib/haptic'
import { formatPhone } from '@/lib/formatters'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import {
  LINE_TO_SLUG,
  TOPPER_TO_SLUG,
  deriveAvailableLines,
  deriveAvailableToppers,
  gateAvailability,
} from '@/lib/personalization/skuMap'
import './order.css'

/**
 * /dogs/[id]/order client 부분 — 분량/가격 계산, 주소 form, Toss billing-auth
 * redirect 까지. 서버에서 prefetch 한 dog/formula/products/profile 을 prop 으로
 * 받는다.
 *
 * # 흐름
 *  1. (server) 강아지 ownership + 최신 dog_formulas + profile + products fetch
 *  2. (client) 5 라인 + 2 토퍼 → SKU 매핑 (slug 기준), net_weight_g 로 팩 수 산정
 *  3. portion (2주치 / 4주치) 선택 — 청구는 항상 한달 1회.
 *     2주치 = 화식반 + 건식사료반 권장 (가성비), 4주치 = 풀 화식.
 *     사료관리법 ±5% 허용 오차 내 팩 수 산정 (95% 이상 deliver 시 floor).
 *  4. 주소·수령인 (profile pre-fill, 없으면 daum postcode)
 *  5. CTA "정기배송 신청" → subscriptions + subscription_items insert →
 *     /subscribe/billing-auth (Toss 카드 등록) 으로 redirect
 *
 * # 법적 근거
 *  - 사료관리법 시행규칙 별표 4 (사료 표시기준) — 표시 정량 ±5% 허용 오차
 *  - 식품등의 표시·광고에 관한 법률 (사료가 식품 분류는 아니지만 동일 정량 관행)
 *  - cycle 분량은 ratio × 일일 kcal / kcalPer100g × coverageWeeks × 7
 *
 * # SKU 매핑 (현재 등록된 4 라인 + 2 토퍼; joint 미등록 시 graceful skip)
 */
// LINE_TO_SLUG / TOPPER_TO_SLUG 는 skuMap (단일 SSOT) 에서 import.
// gateAvailability 가 활성 제품 없는 라인/토퍼를 가용 라인으로 재분배.

/** 동결건조 토퍼 평균 kcal/100g (USDA freeze-dried meat/veggie ~370-400). */
const TOPPER_KCAL_PER_100G = 380

/** 사료관리법 표시기준 ±5% 허용 — floor 가 95% 이상 deliver 하면 floor 채택. */
const TOLERANCE = 0.95

/**
 * 박스 정기배송 portion 옵션.
 * 배송 주기는 항상 한달마다 (interval_weeks=4). portion 만 선택.
 *  - 4주치: 한 달 풀커버 (화식 100%) — 인기
 *  - 2주치: 가성비 — 화식 50% + 건식사료 50% 권장 (보호자 판단)
 */
const PORTION_OPTIONS = [
  {
    value: 2 as const,
    label: '2주치',
    sub: '하이브리드',
    desc: '15일 1팩씩 · 나머지는 건식 반반',
  },
  {
    value: 4 as const,
    label: '4주치',
    sub: '풀 화식',
    desc: '30일 1팩씩 · 한달 풀 (인기)',
  },
]
type PortionWeeks = (typeof PORTION_OPTIONS)[number]['value']

// 구독료에 배송비 포함 — 무료배송/배송비 임계 시스템 폐지(2026-06-27 사장님 지시).

export type OrderProduct = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  stock: number
  net_weight_g: number | null
  is_subscribable: boolean | null
  /**
   * `{ calories_kcal_per_100g: number, protein_pct, fat_pct, ... }`
   * 토퍼 분량 정확 산정에 사용. 동결건조 제품은 보통 350-450 kcal/100g.
   */
  nutrition_facts: Record<string, number> | null
}

export type OrderProfileInitial = {
  name: string
  phone: string
  zip: string
  address: string
  address_detail: string
  /** 어떤 필드라도 채워졌으면 hint 노출 — 사용자가 다시 입력 안 해도 됨을 명시. */
  prefilled: boolean
}

type DaumPostcodeData = {
  userSelectedType: 'R' | 'J'
  roadAddress: string
  jibunAddress: string
  zonecode: string
  buildingName: string
}

let daumScriptLoaded = false
let daumScriptLoading = false
const daumCallbacks: (() => void)[] = []

function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve) => {
    if (daumScriptLoaded) {
      resolve()
      return
    }
    if (daumScriptLoading) {
      daumCallbacks.push(resolve)
      return
    }
    daumScriptLoading = true
    const s = document.createElement('script')
    s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    s.async = true
    s.onload = () => {
      daumScriptLoaded = true
      daumScriptLoading = false
      resolve()
      daumCallbacks.forEach((cb) => cb())
      daumCallbacks.length = 0
    }
    document.head.appendChild(s)
  })
}

/**
 * 메인 라인 — 1팩 = 1일 한끼 분량.
 * 일일 g 을 10g 단위로 ceil 반올림 (사료관리법 표시기준 ±5% 허용 내).
 * 예: 일일 164g → 한끼 170g (ceil), 158g → 160g.
 */
function mealPortionG(dailyG: number): number {
  if (dailyG <= 0) return 0
  return Math.ceil(dailyG / 10) * 10
}

/**
 * 토퍼 — 100g 동결건조 고정 팩. 사이클 총 필요량을 100g 팩 단위로
 * 사료관리법 ±5% 허용 내 floor/ceil 결정.
 */
function topperPacksForCycle(
  cycleG: number,
): { packs: number; deliveredG: number } {
  if (cycleG <= 0) return { packs: 1, deliveredG: 100 }
  const packG = 100
  const exact = cycleG / packG
  const floor = Math.max(1, Math.floor(exact))
  const ceil = Math.max(1, Math.ceil(exact))
  if (floor === ceil) {
    return { packs: floor, deliveredG: floor * packG }
  }
  if (floor * packG >= cycleG * TOLERANCE) {
    return { packs: floor, deliveredG: floor * packG }
  }
  return { packs: ceil, deliveredG: ceil * packG }
}

/**
 * 100g 단위 단가 기반 1팩 가격 산정.
 *  - product.price 는 100g 기준 단가 (예: 소 7,000원/100g)
 *  - 100원 단위 반올림.
 */
function pricePerPack(unitPricePer100g: number, packG: number): number {
  return Math.round((packG / 100) * unitPricePer100g / 100) * 100
}

/** g → 보기 좋은 한국어 (예: "1.4 kg" / "850 g"). */
function formatGrams(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

type LineItem = {
  slug: string
  line?: FoodLine
  topper?: 'vegetable' | 'protein'
  pct: number
  product: OrderProduct
  /** 발송할 팩 개수. 메인 = cycleDays, 토퍼 = ±5% tolerance. */
  quantity: number
  /** 한 팩 g — 메인은 일끼 분량, 토퍼는 100g 고정. */
  packG: number
  /** 일일 분량 g (계산값). */
  dailyG: number
  /** 한끼 분량 g (메인 = packG, 토퍼 = packG). UI 표시용. */
  mealG: number
  /** 사이클 총 필요 g. */
  cycleG: number
  /** 사이클 실제 발송 g. */
  deliveredG: number
  /** 1팩 단가. */
  pricePerPack: number
}

export type OrderClientProps = {
  dogId: string
  userId: string
  dogName: string
  /** server 가 dog_formulas latest row 를 normalized Formula 로 변환해 prop drill. */
  formula: Formula | null
  /** subscribable + active product map (slug→Product). server fetch. */
  products: Record<string, OrderProduct>
  /** server 에서 profile row 를 가공한 초기 값. row 없으면 prefilled=false. */
  profile: OrderProfileInitial
}

export default function OrderClient({
  dogId,
  userId,
  dogName,
  formula,
  products,
  profile,
}: OrderClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  // 정기배송 입력 — 한달 1회 청구 고정, portion (2주치 / 4주치) 만 선택
  const [coverageWeeks, setCoverageWeeks] = useState<PortionWeeks>(4)
  /** 회원가입 정보가 자동 기입됐는지 — 사용자에게 hint 노출. */
  const [profilePrefilled] = useState(profile.prefilled)
  /** 사용자가 주소를 수정했는지 — true 면 신청 시 profile 도 업데이트 옵션. */
  const [addressEdited, setAddressEdited] = useState(false)
  /** 변경 주소를 다음 정기배송에도 사용 (profiles upsert) 옵트인 토글. */
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(true)
  const [recipientName, setRecipientName] = useState(profile.name)
  const [recipientPhone, setRecipientPhone] = useState(profile.phone)
  const [recipientZip, setRecipientZip] = useState(profile.zip)
  const [recipientAddress, setRecipientAddress] = useState(profile.address)
  const [recipientAddressDetail, setRecipientAddressDetail] = useState(
    profile.address_detail,
  )
  const [memo, setMemo] = useState('')

  // formula 가 server 에서 null 이면 안내 메시지 자동 노출
  useEffect(() => {
    if (!formula) {
      setErr('아직 맞춤 박스 추천이 없어요. 분석을 먼저 받아 주세요.')
    }
  }, [formula])

  const setZipRef = useRef(setRecipientZip)
  const setAddrRef = useRef(setRecipientAddress)
  const setDetailRef = useRef(setRecipientAddressDetail)
  useEffect(() => {
    setZipRef.current = setRecipientZip
    setAddrRef.current = setRecipientAddress
    setDetailRef.current = setRecipientAddressDetail
  }, [])

  useEffect(() => {
    void loadDaumPostcode()
  }, [])

  // 첫 배송 예상일 — 신청일 + 4-7일 (택배 대기) 가정. 이후 한달 단위 청구.
  // (마이페이지/cron 가 next_delivery_date 관리)
  const [firstDeliveryAt, setFirstDeliveryAt] = useState<number | null>(null)
  useEffect(() => {
    setFirstDeliveryAt(Date.now() + 5 * 86400000)
  }, [])

  // ── 라인 + 토퍼 → 항목 빌드 (coverageWeeks 변경 시 자동 재계산) ────────
  //
  // 박스 정기배송 모델
  //   · 메인 5종 — 1팩 = 1일 한끼 분량 (10g 단위 ceil 반올림)
  //               4주치 = 30팩, 2주치 = 15팩 (1일 1팩)
  //   · 토퍼 — 100g 동결건조 고정 팩, 사이클 총 필요량 ±5% tolerance
  //
  // 가격 — product.price 는 100g 단위 단가 (예: 소 7,000원/100g)
  //   · 메인 1팩 = mealG / 100 × unitPrice (100원 단위 반올림)
  //   · 토퍼 1팩 = product.price (100g 표준)
  const cycleDays = coverageWeeks === 4 ? 30 : 15
  const items: LineItem[] = []

  if (formula) {
    const dailyKcal = formula.dailyKcal
    // 가용성 게이트 — 활성 제품 없는 라인/토퍼(연어 보류 등)를 가용 라인으로
    // 재분배. 저장된 formula 가 게이트 전 버전이어도 박스는 항상 100% 충족.
    const gated = gateAvailability(formula.lineRatios, formula.toppers, {
      availableLines: deriveAvailableLines(Object.keys(products)),
      availableToppers: deriveAvailableToppers(Object.keys(products)),
    })
    for (const line of ALL_LINES) {
      const ratio = gated.lineRatios[line] ?? 0
      if (ratio <= 0) continue
      const slug = LINE_TO_SLUG[line]
      if (!slug) continue
      const product = products[slug]
      if (!product) continue

      const meta = FOOD_LINE_META[line]
      const kcalPer100g = meta.kcalPer100g
      const dailyG = ((ratio * dailyKcal) / kcalPer100g) * 100
      const mealG = mealPortionG(dailyG)
      const cycleG = dailyG * cycleDays
      const deliveredG = mealG * cycleDays
      const unitPrice = product.sale_price ?? product.price
      const perPack = pricePerPack(unitPrice, mealG)
      items.push({
        slug,
        line,
        pct: Math.round(ratio * 100),
        product,
        quantity: cycleDays, // 1일 1팩 → cycleDays 팩
        packG: mealG,
        mealG,
        dailyG,
        cycleG,
        deliveredG,
        pricePerPack: perPack,
      })
    }
    for (const k of ['vegetable', 'protein'] as const) {
      const ratio = gated.toppers[k] ?? 0
      if (ratio <= 0) continue
      const slug = TOPPER_TO_SLUG[k]
      const product = products[slug]
      if (!product) continue
      // product.nutrition_facts.calories_kcal_per_100g 우선 (admin 입력),
      // 없으면 fallback 380 kcal/100g (USDA freeze-dried 평균).
      const topperKcal100g =
        (product.nutrition_facts?.calories_kcal_per_100g as number | undefined) ??
        TOPPER_KCAL_PER_100G
      const dailyG = ((ratio * dailyKcal) / topperKcal100g) * 100
      const cycleG = dailyG * cycleDays
      const { packs, deliveredG } = topperPacksForCycle(cycleG)
      const unitPrice = product.sale_price ?? product.price
      // 토퍼는 100g 표준 팩 → 단가 그대로
      items.push({
        slug,
        topper: k,
        pct: Math.round(ratio * 100),
        product,
        quantity: packs,
        packG: 100,
        mealG: dailyG, // 토퍼는 일일 sprinkle 분량
        dailyG,
        cycleG,
        deliveredG,
        pricePerPack: unitPrice,
      })
    }
  }

  const subtotal = items.reduce(
    (sum, it) => sum + it.pricePerPack * it.quantity,
    0,
  )
  const shippingFee = 0
  const totalAmount = subtotal + shippingFee
  const totalCycleG = items.reduce((s, it) => s + it.deliveredG, 0)

  const oosCount = items.filter((it) => (it.product.stock ?? 0) <= 0).length
  const nonSubscribableCount = items.filter(
    (it) => it.product.is_subscribable === false,
  ).length

  function strengthLabel(pct: number): { tier: string; tone: string } {
    if (pct >= 50) return { tier: '메인', tone: 'main' }
    if (pct >= 15) return { tier: '보조', tone: 'sub' }
    return { tier: '소량', tone: 'mini' }
  }

  const openAddressSearch = useCallback(async () => {
    await loadDaumPostcode()
    new (window as unknown as { daum: { Postcode: new (cfg: unknown) => { open: () => void } } }).daum.Postcode({
      oncomplete(data: DaumPostcodeData) {
        const addr =
          data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress
        setZipRef.current(data.zonecode)
        setAddrRef.current(addr)
        if (data.buildingName) {
          setDetailRef.current(data.buildingName)
        }
        setAddressEdited(true)
      },
    }).open()
  }, [])

  async function handleSubscribe() {
    if (items.length === 0) return
    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      setErr('수령인 이름·전화·주소를 모두 입력해 주세요.')
      return
    }
    // 한국 휴대폰 번호 검증 — 010/011/016/017/018/019 + 7-8 자리.
    // 대시 제거 후 정규식 체크.
    const phoneDigits = recipientPhone.replace(/[^0-9]/g, '')
    if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) {
      setErr('전화번호 형식이 맞지 않아요 (01x-XXXX-XXXX).')
      return
    }
    if (recipientName.trim().length < 2) {
      setErr('수령인 이름은 2자 이상이어야 해요.')
      return
    }
    const subscribable = items.filter(
      (it) =>
        (it.product.stock ?? 0) > 0 && it.product.is_subscribable !== false,
    )
    if (subscribable.length === 0) {
      setErr('정기배송 가능한 상품이 없어요. 재입고 후 다시 시도해 주세요.')
      return
    }
    setSubmitting(true)
    setErr('')
    try {
      // 중복 구독 방어 — 같은 강아지에 active 또는 paused 구독이 이미 있으면
      // 새로 생성 안 함 (마이페이지 / 강아지 상세에서 관리 유도). 사용자가
      // 빠른 더블탭 / 재진입으로 의도치 않게 중복 등록하는 케이스 차단.
      const { data: existingSubs } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', userId)
        .eq('dog_id', dogId)
        .in('status', ['active', 'paused'])
        .limit(1)
      if (existingSubs && existingSubs.length > 0) {
        const existingId = (existingSubs[0] as { id: string }).id
        setErr(
          '이 강아지에 진행중인 정기배송이 이미 있어요. 마이페이지에서 관리해 주세요.',
        )
        setTimeout(
          () => router.push('/mypage/subscriptions?highlight=' + existingId),
          1500,
        )
        return
      }

      const subSubtotal = subscribable.reduce(
        (s, it) => s + it.pricePerPack * it.quantity,
        0,
      )
      const subShipping = 0
      const subTotal = subSubtotal + subShipping
      // 박스 정기배송 다음 배송일:
      //   · 4주치 (풀 화식) — 캘린더 월 기준 (같은 날 다음 달)
      //   · 2주치 (하이브리드) — 15일 후
      // cron `nextDeliveryDate` 와 정합 (cron 도 box 구독은 같은 룰 사용).
      // R85-D4: KST helper — UTC 기준 .toISOString() off-by-one 차단.
      const { todayKstIsoDate, addDaysKst, addMonthsKst } = await import(
        '@/lib/datetime-kst'
      )
      const todayIso = todayKstIsoDate()
      const nextDeliveryIso =
        coverageWeeks === 2
          ? addDaysKst(todayIso, 15)
          : addMonthsKst(todayIso, 1)

      const customerKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`

      // audit #79: subscriptions schema-drift cast.
      const { data: sub, error: subErr } = await (
        supabase as unknown as {
          from: (t: string) => {
            insert: (r: Record<string, unknown>) => {
              select: (cols: string) => {
                single: () => Promise<{
                  data: { id: string } | null
                  error: { message?: string } | null
                }>
              }
            }
          }
        }
      )
        .from('subscriptions')
        .insert({
          user_id: userId,
          dog_id: dogId,
          interval_weeks: 4,
          coverage_weeks: coverageWeeks,
          status: 'active',
          next_delivery_date: nextDeliveryIso,
          total_deliveries: 0,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          // R84-D1: DB schema = zip/address/address_detail (no recipient_ prefix).
          zip: recipientZip,
          address: recipientAddress,
          address_detail: recipientAddressDetail,
          subtotal: subSubtotal,
          shipping_fee: subShipping,
          total_amount: subTotal,
          billing_customer_key: customerKey,
        })
        .select('id')
        .single()
      if (subErr || !sub) {
        setErr('정기배송을 신청하지 못했어요. 다시 시도해 주세요.')
        return
      }
      const itemRows = subscribable.map((it) => {
        const portionTag = it.line ? `${it.mealG}g 한 끼` : `${it.packG}g 팩`
        return {
          subscription_id: (sub as { id: string }).id,
          product_id: it.product.id,
          quantity: it.quantity,
          unit_price: it.pricePerPack,
          product_name: `${it.product.name} (${portionTag})`,
          product_image_url: it.product.image_url,
        }
      })
      const { error: itemErr } = await supabase
        .from('subscription_items')
        .insert(itemRows)
      if (itemErr) {
        // 롤백 — subscription 만 생성되고 items 가 비어있으면 cron 청구는
        // 정상가로 진행되지만 발송할 상품 정보가 없음 → orphan. 즉시 취소.
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            last_failed_charge_reason: 'item-insert-failed',
          })
          .eq('id', (sub as { id: string }).id)
          .eq('user_id', userId)
        setErr('주문 상품을 담지 못했어요. 다시 시도해 주세요.')
        return
      }
      // 사용자가 옵트인했으면 profiles 도 업데이트 — 다음 정기배송 / 단건
      // 주문에 자동 prefill. fire-and-forget (실패해도 구독은 계속).
      if (addressEdited && saveAddressToProfile) {
        void supabase
          .from('profiles')
          .update({
            name: recipientName,
            phone: recipientPhone,
            zip: recipientZip,
            address: recipientAddress,
            address_detail: recipientAddressDetail,
          })
          .eq('id', userId)
      }
      haptic('confirm')
      // GA4 — box 정기배송 신청
      if (typeof window !== 'undefined' && 'gtag' in window) {
        const gtag = (window as unknown as {
          gtag: (...a: unknown[]) => void
        }).gtag
        gtag('event', 'subscription_started', {
          dog_id: dogId,
          cycle_number: formula?.cycleNumber ?? null,
          interval_weeks: 4,
          coverage_weeks: coverageWeeks,
          item_count: subscribable.length,
          subtotal: subSubtotal,
          memo_provided: memo.trim().length > 0,
        })
      }
      toast.success('카드 등록 페이지로 이동할게요')
      router.push(
        `/subscribe/billing-auth?subscriptionId=${(sub as { id: string }).id}` +
          `&customerKey=${encodeURIComponent(customerKey)}`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : '정기배송 신청 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ord-page">
      <header className="ord-hero">
        <span className="ord-kicker">CUSTOM BOX · CYCLE {formula?.cycleNumber ?? '–'}</span>
        <h1>
          {dogName} 맞춤 박스<br />
          정기배송으로 시작할까요?
        </h1>
        <p>
          분석 결과 그대로 만든 박스를 한 달에 한 번 보내드려요. 분량은 우리
          아이에 맞게 자동으로 계산되고, 언제든 일시정지·해지할 수 있어요.
        </p>
      </header>

      {!formula && (
        <div className="ord-empty">
          <p>{err || '아직 박스 추천이 없어요.'}</p>
          <Link href={`/dogs/${dogId}/analysis`} className="ord-empty-cta">
            분석 보러가기 →
          </Link>
        </div>
      )}

      {formula && items.length > 0 && (
        <>
          {/* C2 (2026-06) — 췌장염 급성/중증 하드 게이트 surfacing. 결제 화면에
              "화식 부적합" 신호가 없어 부적합 식단을 정기구독할 수 있던 문제
              차단. firstBox priority-0 chip (pancreatitis-severe-unsuitable). */}
          {(() => {
            const gateChip = formula.reasoning?.find(
              (r) => r.ruleId === 'pancreatitis-severe-unsuitable',
            )
            if (!gateChip) return null
            return (
              <section
                role="alert"
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  margin: '0 0 16px',
                  padding: '14px 16px',
                  borderRadius: 4,
                  background:
                    'color-mix(in srgb, var(--terracotta) 9%, white)',
                  border:
                    '1px solid color-mix(in srgb, var(--terracotta) 38%, transparent)',
                }}
              >
                <AlertCircle
                  size={16}
                  strokeWidth={2.2}
                  color="var(--terracotta)"
                  style={{ marginTop: 1, flexShrink: 0 }}
                />
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  <strong style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                    이 박스는 권장하지 않아요
                  </strong>
                  <span
                    style={{
                      fontSize: 12,
                      lineHeight: 1.55,
                      color: 'var(--text)',
                    }}
                  >
                    {gateChip.action}
                  </span>
                </div>
              </section>
            )
          })()}

          {/* 한눈에 — 뭘·언제·얼마. 사장님 "난잡·이해 안됨" 개편: 스크롤 없이
              상단에서 핵심 3줄 즉시 파악. 값은 portion 선택에 반응(하단 상세
              요약과 동일 소스). 결제/계산 로직 불변 — 표시만. */}
          <section className="ord-glance" aria-label="주문 한눈에 보기">
            <div className="ord-glance-row">
              <span className="ord-glance-label">받는 것</span>
              <span className="ord-glance-val">
                {dogName} 맞춤 박스 ·{' '}
                {coverageWeeks === 4 ? '4주치 (한달)' : '2주치 (반달)'}
              </span>
            </div>
            <div className="ord-glance-row">
              <span className="ord-glance-label">첫 배송</span>
              <span className="ord-glance-val">
                {firstDeliveryAt !== null
                  ? `${new Date(firstDeliveryAt).toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })} · 이후 매월 자동`
                  : '신청 후 안내 · 매월 자동'}
              </span>
            </div>
            <div className="ord-glance-divide" />
            <div className="ord-glance-row">
              <span className="ord-glance-label">월 결제</span>
              <span className="ord-glance-price">
                {totalAmount.toLocaleString()}원
                <span className="ord-glance-per">/월</span>
              </span>
            </div>
          </section>

          {/* 신뢰 배지 row — AAFCO + 수의사 */}
          <section className="ord-trust">
            <span className="ord-trust-chip">
              <ShieldCheck size={11} strokeWidth={2.4} />
              AAFCO 2024 충족
            </span>
            <span className="ord-trust-chip">
              <Sparkles size={11} strokeWidth={2.4} />
              NRC · FEDIAF 기준
            </span>
            <span className="ord-trust-chip">
              <PackageOpen size={11} strokeWidth={2.4} />
              사료관리법 ±5% 정량
            </span>
          </section>

          {/* 한달 정기배송 portion 선택 — 2주치 / 4주치 */}
          <section className="ord-section">
            <h2 className="ord-section-h">
              <Repeat size={13} strokeWidth={2.2} color="var(--moss)" />
              한달 정기배송 · 분량 선택
            </h2>
            <div
              className="ord-interval-grid ord-portion-grid"
              role="radiogroup"
              aria-label="박스 분량 선택"
            >
              {PORTION_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  role="radio"
                  aria-checked={coverageWeeks === opt.value}
                  className={
                    'ord-interval-card' +
                    (coverageWeeks === opt.value ? ' ord-interval-on' : '')
                  }
                  onClick={() => {
                    haptic('tick')
                    setCoverageWeeks(opt.value)
                  }}
                >
                  <span className="ord-interval-label">{opt.label}</span>
                  <span className="ord-portion-sub">{opt.sub}</span>
                  <span className="ord-interval-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
            {coverageWeeks === 2 && (
              <div className="ord-hybrid-note" role="note">
                <Sparkles size={12} strokeWidth={2.4} color="var(--moss)" />
                <div>
                  <strong>화식 50% + 건식사료 50% 권장</strong>
                  <span>
                    2주치는 한 달의 절반만 화식 — 나머지는 평소 드시던 건식
                    사료와 섞어 주세요. 입문/가성비에 적합하고, 영양 균형은
                    화식 쪽이 책임집니다.
                  </span>
                </div>
              </div>
            )}
            {firstDeliveryAt !== null && (
              <p className="ord-interval-foot">
                <CalendarDays size={11} strokeWidth={2.2} color="var(--muted)" />
                <span>
                  첫 배송 예정 ·{' '}
                  {new Date(firstDeliveryAt).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                  {' · 이후 매월 같은 날 자동 청구'}
                </span>
              </p>
            )}
          </section>

          {/* 라인 + 토퍼 분량 카드 */}
          <h2 className="ord-section-h">
            <PackageOpen size={13} strokeWidth={2.2} color="var(--moss)" />
            추천 박스 구성
          </h2>
          <ul className="ord-list">
            {items.map((it) => {
              const meta = it.line ? FOOD_LINE_META[it.line] : null
              const label = meta
                ? `${meta.name} · ${meta.subtitle}`
                : it.topper === 'vegetable'
                  ? '야채 토퍼 · 동결건조'
                  : '육류 토퍼 · 동결건조'
              const color = meta ? meta.color : 'var(--moss)'
              const unitPrice = it.product.sale_price ?? it.product.price
              const strength = strengthLabel(it.pct)
              const isOOS = (it.product.stock ?? 0) <= 0
              const notSub = it.product.is_subscribable === false
              const lineTotal = it.pricePerPack * it.quantity
              const isMain = !!it.line
              return (
                <li
                  key={it.slug}
                  className={
                    'ord-item' +
                    (isOOS || notSub ? ' ord-item-oos' : '')
                  }
                >
                  <span className="ord-item-bar" style={{ background: color }} />
                  <div className="ord-item-body">
                    <div className="ord-item-head">
                      <span className="ord-item-name">{label}</span>
                      <span className="ord-item-pct" style={{ color }}>
                        {it.pct}%
                      </span>
                    </div>
                    <div className="ord-item-meta">
                      <span
                        className={'ord-strength ord-strength-' + strength.tone}
                      >
                        {strength.tier}
                      </span>
                      <span className="ord-divider" />
                      <span>
                        일일 {formatGrams(it.dailyG)}
                      </span>
                      {isMain && (
                        <>
                          <span className="ord-divider" />
                          <span>
                            한 끼 <strong>{it.mealG}g</strong>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="ord-item-portion">
                      <PackageOpen size={11} strokeWidth={2.2} color={color} />
                      {isMain ? (
                        <span>
                          {coverageWeeks === 4 ? '한달 (30일)' : '반달 (15일)'} ·{' '}
                          <strong>
                            {it.quantity}팩 ({it.mealG}g/끼)
                          </strong>
                          {' · 총 '}
                          {formatGrams(it.deliveredG)}
                        </span>
                      ) : (
                        <span>
                          {coverageWeeks === 4 ? '한달치' : '반달치'} 토퍼{' '}
                          <strong>{formatGrams(it.deliveredG)}</strong>
                          {' · '}
                          {it.quantity}팩 (100g/팩)
                        </span>
                      )}
                    </div>
                    <div className="ord-item-foot">
                      <span className="ord-item-sub">
                        {it.pricePerPack.toLocaleString()}원 × {it.quantity}팩
                        {isMain && (
                          <em className="ord-item-rate">
                            {' '}
                            ({unitPrice.toLocaleString()}원/100g)
                          </em>
                        )}
                      </span>
                      <span className="ord-item-total">
                        {lineTotal.toLocaleString()}원
                      </span>
                    </div>
                    {(isOOS || notSub) && (
                      <div className="ord-item-warn">
                        <Bell size={10} strokeWidth={2.4} />
                        <span>
                          {isOOS
                            ? '품절 — 신청 시 제외 (재입고 알림)'
                            : '정기배송 미지원 — 신청 시 제외'}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* 수령인 정보 */}
          <section className="ord-section">
            <h2 className="ord-section-h">
              <Truck size={13} strokeWidth={2.2} color="var(--moss)" />
              수령인 정보
            </h2>
            {profilePrefilled && !addressEdited && (
              <div className="ord-prefill-hint">
                <Check size={11} strokeWidth={2.4} color="var(--moss)" />
                <span>회원가입 정보로 자동 기입됐어요. 다르면 아래에서 수정.</span>
              </div>
            )}
            <div className="ord-form">
              <div className="ord-form-row">
                <input
                  type="text"
                  className="ord-input"
                  placeholder="이름"
                  value={recipientName}
                  onChange={(e) => {
                    setRecipientName(e.target.value)
                    setAddressEdited(true)
                  }}
                  autoComplete="name"
                />
                <input
                  type="tel"
                  className="ord-input"
                  placeholder="연락처"
                  value={recipientPhone}
                  onChange={(e) => {
                    setRecipientPhone(formatPhone(e.target.value))
                    setAddressEdited(true)
                  }}
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </div>
              <div className="ord-form-addr">
                <input
                  type="text"
                  className="ord-input ord-input-zip"
                  placeholder="우편번호"
                  value={recipientZip}
                  readOnly
                  onClick={openAddressSearch}
                />
                <button
                  type="button"
                  className="ord-addr-btn"
                  onClick={openAddressSearch}
                >
                  <Search size={12} strokeWidth={2.4} />
                  주소 찾기
                </button>
              </div>
              <input
                type="text"
                className="ord-input"
                placeholder="기본 주소"
                value={recipientAddress}
                readOnly
                onClick={openAddressSearch}
              />
              <input
                type="text"
                className="ord-input"
                placeholder="상세 주소 (동·호수)"
                value={recipientAddressDetail}
                onChange={(e) => {
                  setRecipientAddressDetail(e.target.value)
                  setAddressEdited(true)
                }}
              />
              <textarea
                className="ord-textarea"
                placeholder="배송 메모 (예: 부재 시 경비실, 강아지 알레르기 주의)"
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
              {addressEdited && (
                <label className="ord-save-toggle">
                  <input
                    type="checkbox"
                    checked={saveAddressToProfile}
                    onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                  />
                  <span>다음 주문에도 이 주소를 기본으로 사용</span>
                </label>
              )}
            </div>
          </section>

          {/* 결제 요약 */}
          <h2 className="ord-section-h">
            <CreditCard size={13} strokeWidth={2.2} color="var(--moss)" />
            결제 요약
          </h2>
          <section className="ord-summary">
            <div className="ord-summary-row">
              <span>
                월 배송 ({coverageWeeks === 4 ? '한달 30일' : '반달 15일'})
              </span>
              <strong className="ord-summary-strong-sm">
                {formatGrams(totalCycleG)}
                {' · '}
                {items.reduce((s, it) => s + it.quantity, 0)}팩
              </strong>
            </div>
            <div className="ord-summary-row">
              <span>상품 합계</span>
              <span>{subtotal.toLocaleString()}원</span>
            </div>
            <div className="ord-summary-divide" />
            <div className="ord-summary-row">
              <span>월 결제</span>
              <strong>{totalAmount.toLocaleString()}원</strong>
            </div>
            <div className="ord-summary-row ord-summary-info">
              <Sparkles size={11} strokeWidth={2.2} color="var(--moss)" />
              <span>
                알고리즘 v{formula.algorithmVersion} · {formula.dailyKcal} kcal/일
                · 매월 자동 청구 ({coverageWeeks}주치 portion)
              </span>
            </div>
            {(oosCount > 0 || nonSubscribableCount > 0) && (
              <div className="ord-summary-row ord-summary-info ord-summary-warn">
                <AlertCircle size={11} strokeWidth={2.2} color="var(--terracotta)" />
                <span>
                  {oosCount + nonSubscribableCount}개 상품은 신청 시 자동 제외
                </span>
              </div>
            )}
          </section>

          {err && (
            <div className="ord-err" role="alert">
              <AlertCircle size={13} strokeWidth={2.2} />
              <span style={{ whiteSpace: 'pre-line' }}>{err}</span>
            </div>
          )}

          <div className="ord-cta">
            <Link
              href={`/dogs/${dogId}/analysis`}
              className="ord-btn ord-btn-ghost"
            >
              뒤로
            </Link>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={submitting || items.length === 0}
              className="ord-btn ord-btn-prim"
            >
              {submitting ? (
                <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
              ) : (
                <CreditCard size={14} strokeWidth={2.4} color="#fff" />
              )}
              정기배송 신청 · 카드 등록
              <ArrowRight size={12} strokeWidth={2.4} color="#fff" />
            </button>
          </div>
          {/* R92-S (D7): 정기과금 명시 동의 — 전자상거래법 §13 / 콘텐츠산업
              진흥법 고지 의무. 신청 = 자동결제 동의 간주 근거. */}
          <p
            className="ord-foot"
            style={{ fontSize: 10.5, opacity: 0.85, marginTop: 6 }}
          >
            신청 · 카드 등록을 누르면 매월 자동결제에 동의하는 것으로
            간주됩니다.
          </p>
          <p className="ord-foot">
            <Check size={11} strokeWidth={2.6} color="var(--moss)" />
            언제든 마이페이지에서 주기 변경 · 일시정지 · 해지 가능 (위약금 없음)
          </p>
        </>
      )}
    </div>
  )
}
