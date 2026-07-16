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
  Soup,
  ArrowRight,
  Sparkles,
  PackageOpen,
  Truck,
  Search,
  CalendarDays,
  ChevronDown,
  CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { haptic } from '@/lib/haptic'
import { formatPhone } from '@/lib/formatters'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import {
  nextShipDate,
  weekdayKo,
  SHIP_WEEK,
  SHIP_WHY,
} from '@/lib/shipping-schedule'
import {
  buildTransitionPlan,
  groupTransitionPhases,
} from '@/lib/transition-plan'
import { petName } from '@/lib/korean'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'
import {
  LINE_TO_SLUG,
  TOPPER_TO_SLUG,
  deriveAvailableLines,
  deriveAvailableToppers,
  gateAvailability,
} from '@/lib/personalization/skuMap'
import { snapBoxRatios } from '@/lib/personalization/boxComposition'
import './order.css'

/**
 * /dogs/[id]/order client 부분 — 분량/가격 계산, 주소 form, Toss billing-auth
 * redirect 까지. 서버에서 prefetch 한 dog/formula/products/profile 을 prop 으로
 * 받는다.
 *
 * # 흐름
 *  1. (server) 강아지 ownership + 최신 dog_formulas + profile + products fetch
 *  2. (client) 5 라인 + 2 토퍼 → SKU 매핑 (slug 기준), net_weight_g 로 팩 수 산정
 *  3. 화식 비율 (곁들임 30 / 반반 60 / 완전 100) 선택 — 배송·결제는 무조건
 *     2주마다. 매 끼 화식 비율만큼 섞어 급여, 나머지는 보호자 사료.
 *     사료관리법 ±5% 허용 오차 내 팩 수 산정 (95% 이상 deliver 시 floor).
 *  4. 주소·수령인 (profile pre-fill, 없으면 daum postcode)
 *  5. CTA "카드 등록하고 시작하기" → subscriptions + subscription_items insert →
 *     /subscribe/billing-auth (Toss 카드 등록) 으로 redirect
 *
 * # 법적 근거
 *  - 사료관리법 시행규칙 별표 4 (사료 표시기준) — 표시 정량 ±5% 허용 오차
 *  - 식품등의 표시·광고에 관한 법률 (사료가 식품 분류는 아니지만 동일 정량 관행)
 *  - cycle(14일) 분량 = ratio × 일일 kcal / kcalPer100g × freshRatio × 14
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
 * 화식 비율 3티어 (사장님 2026-07-13 갈아엎기).
 * 배송은 무조건 2주마다 고정. 사용자는 "얼마나 화식으로" 만 선택하고, 나머지
 * 칼로리는 보호자 기존 사료로 매 끼 섞어 급여(매끼섞기 모델). value = 화식 비율%.
 *  - 곁들임(30%) 추천 — 화식 입문
 *  - 반반(60%)
 *  - 완전 화식(100%)
 * 카피는 분석 결과 카드(RecommendationBox)와 동일 문구.
 */
const FRESH_TIERS = [
  {
    value: 30 as const,
    label: '곁들임',
    badge: '추천',
    copy: '작은 비용으로 떼는 첫걸음, 기호성과 영양을 더해요',
    note: '화식이 처음이라면, 익숙해질 때까지 건사료와 섞어 급여하는 걸 권장해요',
  },
  {
    value: 60 as const,
    label: '반반',
    copy: '화식 반 사료 반, 부담은 낮추고 균형은 챙겨요',
  },
  {
    value: 100 as const,
    label: '완전 화식',
    copy: '매일 그릇 가득, 완벽한 영양과 행복을 담아요',
  },
]
type FreshRatio = (typeof FRESH_TIERS)[number]['value']


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
  /** 1팩 단가 (구독가 = sale_price ?? price 기준 — 실청구). */
  pricePerPack: number
  /** 1팩 정가 (products.price 기준) — "정가→구독 할인" 시각화용. 표시 전용. */
  listPricePerPack: number
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
  /** 분석 카드 CTA 의 ?fresh=30|60|100 (화식 비율 초기 선택). 없으면 30(곁들임). */
  initialFresh?: number
}

export default function OrderClient({
  dogId,
  userId,
  dogName,
  formula,
  products,
  profile,
  initialFresh,
}: OrderClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  // 정기배송 입력 — 배송·결제 무조건 2주마다, 화식 비율(30/60/100)만 선택.
  // 분석 카드 CTA 의 ?fresh=30|60|100 를 server 가 initialFresh 로 내려줌.
  const [freshRatio, setFreshRatio] = useState<FreshRatio>(
    initialFresh === 60 ? 60 : initialFresh === 100 ? 100 : 30,
  )
  const selectedTier = (FRESH_TIERS.find((t) => t.value === freshRatio) ??
    FRESH_TIERS[0]) as (typeof FRESH_TIERS)[number]
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
  // 요청사항 2칸 — 둘 다 자유 입력 (사장님 2026-07-15).
  //  · 프리셋 칩 폐기: 고른 뒤 '직접 입력'을 또 눌러야 쓸 수 있어서, 결국 하고
  //    싶은 말이 있는 사람은 두 번 일했다. 그냥 쓰게 둔다.
  //  · 공동현관 출입 칸 폐기: 비밀번호를 폼에 적게 하는 건 받고 싶지 않은
  //    정보고(우리가 보관하게 된다), 필요하면 배송 요청사항에 쓰면 된다.
  //  · 주문 요청사항 신설: 배송(택배기사에게)과 주문(우리에게)은 받는 사람이
  //    다르다 — 포장·급여 관련 요청이 배송 메모에 섞이면 기사에게 갈 뿐이다.
  const [orderRequest, setOrderRequest] = useState('')
  const [deliveryRequest, setDeliveryRequest] = useState('')

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

  // 첫 발송일 — '오늘 + 5일' 어림짐작이었는데 실제 발송은 화요일 하루뿐이라
  // 화면과 실제가 어긋났다(7/20 월요일 같은 날짜가 떴음). 이제 스케줄 단일
  // 진실(lib/shipping-schedule)에서 뽑는다. billing-issue 가 카드 등록 시점에
  // 같은 함수로 next_delivery_date 를 잡으므로 여기 표시와 정확히 일치한다.
  // 렌더 중 Date.now() 를 피하려고 mount 후 1회 계산(SSR/CSR 하이드레이션 안전).
  const [firstShipIso, setFirstShipIso] = useState<string | null>(null)
  useEffect(() => {
    setFirstShipIso(nextShipDate())
  }, [])

  // ── 라인 + 토퍼 → 항목 빌드 (freshRatio 변경 시 자동 재계산) ────────
  //
  // 박스 정기배송 모델 (2026-07-13 갈아엎기 — 무조건 2주마다 배송·결제)
  //   · 사이클 = 14일치 (biweekly). 매 끼 화식 비율(freshRatio)만큼 섞어 급여 →
  //     하루 화식 분량 = 100% 분량 × freshRatio/100. 나머지는 보호자 사료.
  //   · 메인 5종 — 1팩 = 1일 화식 분량(10g 단위 ceil 반올림), 14일 = 14팩.
  //   · 토퍼 — 100g 동결건조 고정 팩, 사이클 총 필요량 ±5% tolerance.
  //
  // 가격 — product.price 는 100g 단위 단가 (예: 소 7,000원/100g)
  //   · 메인 1팩 = mealG / 100 × unitPrice (100원 단위 반올림) → 총액이 화식
  //     비율에 비례(곁들임 30% ≈ 풀 화식의 30% 가격).
  const cycleDays = 14
  const freshFactor = freshRatio / 100
  const items: LineItem[] = []

  if (formula) {
    const dailyKcal = formula.dailyKcal
    // 가용성 게이트 — 활성 제품 없는 라인/토퍼(연어 보류 등)를 가용 라인으로
    // 재분배. 저장된 formula 가 게이트 전 버전이어도 박스는 항상 100% 충족.
    const gated = gateAvailability(formula.lineRatios, formula.toppers, {
      availableLines: deriveAvailableLines(Object.keys(products)),
      availableToppers: deriveAvailableToppers(Object.keys(products)),
    })
    // 박스는 SKU 최대 2종 (1종 100% / 2종 50:50) — 배송 라인은 스냅 후 사용
    // (사장님 2026-07-13). 토퍼는 별개 add-on 이라 대상 아님.
    const boxRatios = snapBoxRatios(gated.lineRatios)
    for (const line of ALL_LINES) {
      const ratio = boxRatios[line] ?? 0
      if (ratio <= 0) continue
      const slug = LINE_TO_SLUG[line]
      if (!slug) continue
      const product = products[slug]
      if (!product) continue

      const meta = FOOD_LINE_META[line]
      const kcalPer100g = meta.kcalPer100g
      // 매끼섞기 — 하루 화식 분량 = 100% 분량 × 화식 비율.
      const dailyG = ((ratio * dailyKcal) / kcalPer100g) * 100 * freshFactor
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
        listPricePerPack: pricePerPack(product.price, mealG),
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
      const dailyG = ((ratio * dailyKcal) / topperKcal100g) * 100 * freshFactor
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
        listPricePerPack: product.price,
      })
    }
  }

  const subtotal = items.reduce(
    (sum, it) => sum + it.pricePerPack * it.quantity,
    0,
  )
  // 정가 합계 — "500g 팩 정가 앵커에서 구독 15% 할인" 시각화용(표시 전용, 청구 무관).
  const listSubtotal = items.reduce(
    (sum, it) => sum + it.listPricePerPack * it.quantity,
    0,
  )
  const subDiscount = Math.max(0, listSubtotal - subtotal)
  const shippingFee = 0
  const totalAmount = subtotal + shippingFee
  const totalCycleG = items.reduce((s, it) => s + it.deliveredG, 0)

  const oosCount = items.filter((it) => (it.product.stock ?? 0) <= 0).length
  const nonSubscribableCount = items.filter(
    (it) => it.product.is_subscribable === false,
  ).length

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

      const customerKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`

      // 요청사항 2칸 → delivery_memo 하나로 합쳐 저장. 라벨을 붙여 둬야 나중에
      // 어느 쪽에 쓴 말인지 구분된다(주문=우리, 배송=기사).
      const memoParts: string[] = []
      if (orderRequest.trim()) memoParts.push(`[주문] ${orderRequest.trim()}`)
      if (deliveryRequest.trim()) memoParts.push(`[배송] ${deliveryRequest.trim()}`)
      const deliveryMemo = memoParts.length ? memoParts.join(' · ') : null

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
          // 무조건 2주마다 배송·결제. coverage_weeks=2 = 크론 biweekly 판정 키.
          interval_weeks: 2,
          coverage_weeks: 2,
          // 화식 비율 티어 (30/60/100) — 표시·관리용.
          fresh_ratio: freshRatio,
          status: 'active',
          // 카드 등록 전 = 배송 일정 없음(null). 카드 등록(billing-issue) 성공 시
          // +14일로 스케줄. 홈 hasActiveSub 가 next_delivery_date 로 판정하므로,
          // 카드 없는 구독이 '결제됨/활성'으로 잘못 뜨던 문제 차단(사장님 2026-07-14).
          next_delivery_date: null,
          total_deliveries: 0,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          // R84-D1: DB schema = zip/address/address_detail (no recipient_ prefix).
          zip: recipientZip,
          address: recipientAddress,
          address_detail: recipientAddressDetail,
          delivery_memo: deliveryMemo,
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
          interval_weeks: 2,
          fresh_ratio: freshRatio,
          item_count: subscribable.length,
          subtotal: subSubtotal,
          memo_provided: deliveryMemo != null,
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

  // 접힌 상태에서 보여줄 한 줄 요약 — "치킨 100% · 하루 160g · 완전 화식".
  // 펼치지 않아도 뭘 받는지는 알 수 있어야 접어둘 수 있다.
  const boxSummary = (() => {
    if (items.length === 0) return '레시피를 고르면 여기에 표시돼요'
    const names = items
      .filter((it) => it.line)
      .map((it) => `${FOOD_LINE_META[it.line!].nameKo} ${it.pct}%`)
      .join(' · ')
    const totalG = Math.round(items.reduce((sum, it) => sum + it.dailyG, 0))
    const tier = FRESH_TIERS.find((t) => t.value === freshRatio)
    return `${names} · 하루 ${totalG}g · ${tier?.label ?? ''}`
  })()

  return (
    <div className="ord-page">
      {/* 스텝 — 레시피(플랜)→배송(현재)→결제(카드등록). 플랜 페이지와 동일 흐름. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--muted)',
          marginBottom: 14,
        }}
      >
        <span>① 레시피</span>
        <span style={{ width: 14, height: 1, background: 'var(--rule)' }} />
        <span style={{ color: 'var(--terracotta)' }}>② 배송</span>
        <span style={{ width: 14, height: 1, background: 'var(--rule)' }} />
        <span>③ 결제</span>
      </div>

      <header className="ord-hero">
        <span className="ord-kicker">CUSTOM BOX · CYCLE {formula?.cycleNumber ?? '–'}</span>
        <h1>
          {dogName} 맞춤 박스<br />
          배송 정보를 입력해주세요
        </h1>
        {/* 3줄 → 1줄. 이 화면에서 해야 할 일 하나만 말한다(사장님 2026-07-15
            "상단에 메인 폰트들만"). 분량 자동계산·일시정지 안내는 아래 요약과
            결제 바가 이미 말하고 있어 여기서 반복할 필요가 없다. */}
        <p>받을 주소만 확인하면 마지막 결제 단계예요.</p>
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

          {/* 받는 박스 — 기본 접힘. 이 페이지의 목적은 **배송지 입력**인데 박스
              내역·배송 리듬이 먼저 꽉 차 있어서 주소창까지 스크롤이 너무 길었다
              (사장님 2026-07-15 "배송지 입력까지 너무 오래걸려"). 레시피는 이미
              플랜에서 골랐으니 여기선 한 줄 확인이면 충분하고, 바꾸고 싶은 사람만
              펼친다. <details> 라 키보드·스크린리더 동작이 공짜로 따라온다. */}
          <details className="ord-boxcard ord-fold">
            <summary className="ord-fold-sum">
              <PackageOpen size={14} strokeWidth={2.2} color="var(--moss)" />
              <span className="ord-fold-txt">
                <b>받는 박스</b>
                <span className="ord-fold-desc">{boxSummary}</span>
              </span>
              <span className="ord-fold-more">
                자세히
                <ChevronDown size={12} strokeWidth={2.4} />
              </span>
            </summary>

            <div className="ord-fold-body">
            <div className="ord-boxcard-head">
              <span className="ord-boxcard-title">담긴 레시피</span>
              <Link
                href={`/dogs/${dogId}/plan?fresh=${freshRatio}`}
                className="ord-boxcard-edit"
              >
                레시피 변경
                <ArrowRight size={11} strokeWidth={2.4} />
              </Link>
            </div>

            <div className="ord-boxcard-recipes">
              {items.map((it) => {
                const meta = it.line ? FOOD_LINE_META[it.line] : null
                // 이름은 한글 표시명(치킨/흑돼지…), 한 줄은 '프레시 OO 레시피'
                // (사장님 2026-07-15). 영문명(Chicken)은 여기선 안 쓴다.
                const label = meta ? meta.nameKo : '토퍼'
                const sub = meta ? meta.subtitle : '동결건조'
                const color = meta ? meta.color : 'var(--moss)'
                const isOOS = (it.product.stock ?? 0) <= 0
                const notSub = it.product.is_subscribable === false
                const kcalPer100g = it.line
                  ? FOOD_LINE_META[it.line].kcalPer100g
                  : TOPPER_KCAL_PER_100G
                const dailyKcal = Math.round((it.dailyG / 100) * kcalPer100g)
                return (
                  <div
                    key={it.slug}
                    className={
                      'ord-recipe' + (isOOS || notSub ? ' ord-recipe-off' : '')
                    }
                  >
                    <span
                      className="ord-recipe-slot"
                      style={{
                        background: `color-mix(in srgb, ${color} 14%, transparent)`,
                        boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 26%, transparent)`,
                      }}
                      aria-hidden
                    >
                      🍲
                    </span>
                    <div className="ord-recipe-body">
                      <div className="ord-recipe-name">
                        {label}
                        <span className="ord-recipe-pct" style={{ color }}>
                          {it.pct}%
                        </span>
                      </div>
                      <div className="ord-recipe-sub">{sub}</div>
                    </div>
                    <div className="ord-recipe-portion">
                      <span className="ord-recipe-plbl">하루</span>
                      <span className="ord-recipe-pval">
                        {Math.round(it.dailyG)}g · {dailyKcal}kcal
                      </span>
                    </div>
                    {(isOOS || notSub) && (
                      <span className="ord-recipe-offtag">
                        {isOOS ? '품절' : '제외'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 화식 비율 — 컴팩트 세그먼트. 탭하면 분량·가격 즉시 갱신. */}
            <div className="ord-fresh">
              <div className="ord-fresh-lbl">얼마나 화식으로</div>
              <div
                className="ord-fresh-seg"
                role="radiogroup"
                aria-label="화식 비율 선택"
              >
                {FRESH_TIERS.map((t) => {
                  const on = freshRatio === t.value
                  return (
                    <button
                      type="button"
                      key={t.value}
                      role="radio"
                      aria-checked={on}
                      className={'ord-fresh-btn' + (on ? ' is-on' : '')}
                      onClick={() => {
                        haptic('tick')
                        setFreshRatio(t.value)
                      }}
                    >
                      <span className="ord-fresh-btn-name">{t.label}</span>
                      <span className="ord-fresh-btn-sub">화식 {t.value}%</span>
                    </button>
                  )
                })}
              </div>
            </div>
            </div>
          </details>

          {/* 배송 리듬 — "첫 배송 7/20(월) 이후 2주마다" 한 줄을 걷어내고 한 주가
              어떻게 돌아가는지 그대로 보여준다(사장님 2026-07-15). 요일을 하루로
              조이는 게 제약이 아니라 신선함의 이유라는 걸 납득시키는 자리.
              날짜·요일은 lib/shipping-schedule 단일 진실에서 나온다. */}
          <ShipRhythmCard firstShipIso={firstShipIso} />

          {/* 첫 2주 급여 안내 — 화식 전환 실패의 1번 원인이 '급하게 바꿔서 배탈'이고,
              그러면 보호자는 음식이 안 맞는다고 오해하고 그만둔다. 알고리즘이 이미
              전환 전략(화식 경험·장 예민도)을 계산해 두고도 고객에게 한 번도 안
              보여줬다 → 여기서 날짜별 급여표로 푼다(2026-07-16). */}
          {formula && (
            <TransitionCard
              strategy={formula.transitionStrategy}
              targetPct={freshRatio}
              dogName={dogName}
            />
          )}

          {/* 배송지 */}
          <section className="ord-section">
            <h2 className="ord-section-h">
              <Truck size={13} strokeWidth={2.2} color="var(--moss)" />
              배송지
            </h2>
            {profilePrefilled && !addressEdited && (
              <div className="ord-prefill-hint">
                <Check size={11} strokeWidth={2.4} color="var(--moss)" />
                <span>회원가입 정보로 자동 기입됐어요. 다르면 아래에서 수정하세요.</span>
              </div>
            )}
            <div className="ord-form">
              {/* 받는 분 · 연락처 */}
              <div className="ord-form-row">
                <div className="ord-field">
                  <label className="ord-label" htmlFor="ord-name">받는 분</label>
                  <input
                    id="ord-name"
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
                </div>
                <div className="ord-field">
                  <label className="ord-label" htmlFor="ord-phone">연락처</label>
                  <input
                    id="ord-phone"
                    type="tel"
                    className="ord-input"
                    placeholder="010-0000-0000"
                    value={recipientPhone}
                    onChange={(e) => {
                      setRecipientPhone(formatPhone(e.target.value))
                      setAddressEdited(true)
                    }}
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* 주소 — 탭 한 번으로 우편번호 검색, 선택 주소를 카드로 표시 */}
              <div className="ord-field">
                <label className="ord-label">주소</label>
                <button
                  type="button"
                  className="ord-addr-search"
                  onClick={openAddressSearch}
                  aria-label="주소 검색"
                >
                  {recipientAddress ? (
                    <span className="ord-addr-search-val">
                      <span className="ord-addr-zip">{recipientZip}</span>
                      {recipientAddress}
                    </span>
                  ) : (
                    <span className="ord-addr-search-ph">주소를 검색해주세요</span>
                  )}
                  <span className="ord-addr-search-icon" aria-hidden>
                    <Search size={14} strokeWidth={2.4} />
                  </span>
                </button>
                <input
                  type="text"
                  className="ord-input ord-input-detail"
                  placeholder="상세 주소 (동·호수)"
                  value={recipientAddressDetail}
                  onChange={(e) => {
                    setRecipientAddressDetail(e.target.value)
                    setAddressEdited(true)
                  }}
                />
              </div>

              {/* 요청사항 2칸 — 받는 사람이 다르다 (사장님 2026-07-15).
                  주문 = 우리(포장·급여 관련), 배송 = 택배기사. 프리셋 칩을 없애고
                  둘 다 그냥 쓰게 뒀다 — 칩을 고른 뒤 '직접 입력'을 또 눌러야 쓸 수
                  있던 구조라 할 말 있는 사람은 두 번 일했다. */}
              <div className="ord-field">
                <label className="ord-label" htmlFor="ord-order-req">
                  주문 요청사항 <span className="ord-label-opt">선택</span>
                </label>
                <textarea
                  id="ord-order-req"
                  className="ord-textarea"
                  placeholder="포장이나 급여에 관해 저희에게 남기실 말씀이 있다면 적어주세요"
                  rows={2}
                  value={orderRequest}
                  onChange={(e) => setOrderRequest(e.target.value)}
                />
              </div>

              <div className="ord-field">
                <label className="ord-label" htmlFor="ord-delivery-req">
                  배송 요청사항 <span className="ord-label-opt">선택</span>
                </label>
                <textarea
                  id="ord-delivery-req"
                  className="ord-textarea"
                  placeholder="예) 문 앞에 놓아주세요"
                  rows={2}
                  value={deliveryRequest}
                  onChange={(e) => setDeliveryRequest(e.target.value)}
                />
              </div>

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
          <section className="ord-summary">
            <h2 className="ord-section-h" style={{ marginBottom: 12 }}>
              <CreditCard size={13} strokeWidth={2.2} color="var(--moss)" />
              결제 요약
            </h2>
            <div className="ord-summary-row">
              <span>2주 배송 (14일)</span>
              <strong className="ord-summary-strong-sm">
                {formatGrams(totalCycleG)}
                {' · '}
                {items.reduce((s, it) => s + it.quantity, 0)}팩
              </strong>
            </div>
            {/* 정가 앵커 → 구독 15% 할인 시각화 (2026-07-11 확정 가격표). 표시 전용 —
                청구는 sale_price 기반 subtotal 그대로. */}
            {subDiscount > 0 && (
              <>
                <div className="ord-summary-row">
                  <span>정가</span>
                  <span style={{ textDecoration: 'line-through', opacity: 0.55 }}>
                    {listSubtotal.toLocaleString()}원
                  </span>
                </div>
                <div className="ord-summary-row">
                  <span>구독 할인 ({SUBSCRIPTION_DISCOUNT_PCT}%)</span>
                  <span style={{ color: 'var(--sage)', fontWeight: 700 }}>
                    −{subDiscount.toLocaleString()}원
                  </span>
                </div>
              </>
            )}
            <div className="ord-summary-row">
              <span>상품 합계</span>
              <span>{subtotal.toLocaleString()}원</span>
            </div>
            <div className="ord-summary-row">
              <span>배송비</span>
              <span style={{ color: 'var(--sage)', fontWeight: 700 }}>
                무료 · 파머스테일 부담
              </span>
            </div>
            <div className="ord-summary-divide" />
            <div className="ord-summary-row">
              <span>2주 결제</span>
              <strong>{totalAmount.toLocaleString()}원</strong>
            </div>
            <div className="ord-summary-row ord-summary-info">
              <Sparkles size={11} strokeWidth={2.2} color="var(--moss)" />
              <span>
                {formula.dailyKcal} kcal/일 · 2주마다 자동 청구 · 화식{' '}
                {selectedTier.label}
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

          {/* R92-S (D7): 정기과금 명시 동의 — 전자상거래법 §13 / 콘텐츠산업
              진흥법 고지 의무. 결제하기 = 자동결제 동의 간주 근거. */}
          <p className="ord-foot ord-foot-consent">
            결제하기를 누르면 2주마다 자동결제에 동의하는 것으로 간주돼요.
          </p>
          <p className="ord-foot">
            <Check size={11} strokeWidth={2.6} color="var(--moss)" />
            언제든 주기 변경 · 일시정지 · 해지 가능 (위약금 없음)
          </p>

          {/* 하단 고정 결제 바 (다크) — 레시피→배송→결제 흐름 통일. 실제 결제(카드
              등록)는 billing-auth 로. 상세 시트 없음 — 늘 노출. */}
          <div className="ord-paybar">
            <div className="ord-paybar-info">
              <span className="ord-paybar-cap">
                첫 박스 · 2주마다 · 언제든 해지
              </span>
              <span className="ord-paybar-price">
                {totalAmount.toLocaleString()}원
                <span className="ord-paybar-badge">구독가</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={submitting || items.length === 0}
              className="ord-paybar-btn"
            >
              {submitting ? (
                <Loader2 size={15} strokeWidth={2.4} className="animate-spin" />
              ) : (
                <>
                  결제하기
                  <ArrowRight size={15} strokeWidth={2.4} />
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * ShipRhythmCard — 한 주가 어떻게 돌아가는지.
 *
 * 사장님 2026-07-15: "첫 배송 7월 20일 이후 2주마다' 이런 식으로 쓰지 말고
 * 일주일짜리 달력에 각 요일마다 어떤 일을 하는지(원료 입고, 제품 제작 등)
 * 자세하게 써놔줘. 그렇게 하는 이유는 늘 신선한 원료로 신선하게 배송드리기
 * 위해 배송일을 정하고 있다, 양해 부탁한다 이런 식으로."
 *
 * 요일을 하루로 조이는 건 고객 입장에선 제약이다. 그 제약을 숨기지 않고 이유와
 * 함께 먼저 보여준다 — 결제 전에 납득시키는 게 결제 후 문의를 받는 것보다 낫다.
 */
function ShipRhythmCard({ firstShipIso }: { firstShipIso: string | null }) {
  const firstLabel = firstShipIso
    ? `첫 발송 ${Number(firstShipIso.slice(5, 7))}월 ${Number(
        firstShipIso.slice(8, 10),
      )}일(${weekdayKo(firstShipIso)})`
    : '첫 발송일 계산 중'
  return (
    // 기본 접힘 — 한 주 리듬은 '읽고 납득하는' 내용이라 결제 전에 한 번 보면
    // 충분하다. 매번 펼쳐두면 배송지까지 스크롤만 길어진다(사장님 2026-07-15).
    // 접힌 줄에 발송 요일과 첫 발송일이 이미 다 있어서 안 펼쳐도 손해가 없다.
    <details className="ord-rhythm ord-fold">
      <summary className="ord-fold-sum">
        <CalendarDays size={13} strokeWidth={2.2} color="var(--moss)" />
        <span className="ord-fold-txt">
          <b>배송은 매주 화요일 하루</b>
          <span className="ord-fold-desc">{firstLabel} · 이후 2주마다</span>
        </span>
        <span className="ord-fold-more">
          왜요?
          <ChevronDown size={12} strokeWidth={2.4} />
        </span>
      </summary>

      <div className="ord-fold-body">
      <ol className="ord-week" aria-label="한 주 배송 리듬">
        {SHIP_WEEK.map((d) => (
          <li
            key={d.dow}
            className={
              'ord-day' +
              (d.isShip ? ' is-ship' : '') +
              (d.isArrive ? ' is-arrive' : '') +
              (d.isOff ? ' is-off' : '')
            }
          >
            <span className="ord-day-ko">{d.ko}</span>
            <span className="ord-day-what">{d.what}</span>
          </li>
        ))}
      </ol>

      <p className="ord-rhythm-why">{SHIP_WHY}</p>
      <p className="ord-rhythm-cycle">
        받아보신 뒤로는 <b>2주마다 같은 화요일</b>에 보내드려요.
      </p>
      </div>
    </details>
  )
}

/**
 * TransitionCard — "처음 2주, 이렇게 바꿔주세요".
 *
 * 숫자는 lib/transition-plan 의 순수 함수에서 나온다 — 살아 있는 동물이 먹을 양이라
 * AI 에 맡기지 않는다(그 원칙은 transition-plan.ts 주석 참고).
 * 기본 접힘 — 배송지 입력을 막지 않되, 결제 전에 "천천히 바꿔야 한다"는 사실은
 * 접힌 줄에서 이미 읽힌다.
 */
function TransitionCard({
  strategy,
  targetPct,
  dogName,
}: {
  strategy: Formula['transitionStrategy']
  targetPct: number
  dogName: string
}) {
  const plan = buildTransitionPlan(strategy, targetPct)
  const phases = groupTransitionPhases(plan)
  return (
    <details className="ord-rhythm ord-fold">
      <summary className="ord-fold-sum">
        <Soup size={13} strokeWidth={2.2} color="var(--moss)" />
        <span className="ord-fold-txt">
          <b>처음 {plan.totalDays}일은 섞어서 천천히</b>
          <span className="ord-fold-desc">{plan.headline} · 배탈 없이 적응해요</span>
        </span>
        <span className="ord-fold-more">
          급여표
          <ChevronDown size={12} strokeWidth={2.4} />
        </span>
      </summary>

      <div className="ord-fold-body">
        <p className="ord-trans-why">{plan.why}</p>

        <ol className="ord-trans-steps" aria-label="날짜별 급여 비율">
          {phases.map((p) => (
            <li key={p.fromDay} className="ord-trans-step">
              <span className="ord-trans-day">
                {p.fromDay === p.toDay
                  ? `${p.fromDay}일차`
                  : `${p.fromDay}~${p.toDay}일차`}
              </span>
              <span className="ord-trans-bar" aria-hidden>
                <i style={{ width: `${p.newPct}%` }} />
              </span>
              <span className="ord-trans-mix">
                화식 <b>{p.newPct}%</b>
                {p.oldPct > 0 && (
                  <span className="ord-trans-old"> · 기존 {p.oldPct}%</span>
                )}
              </span>
            </li>
          ))}
        </ol>

        <p className="ord-trans-watch">
          <AlertCircle size={11} strokeWidth={2.4} />
          {plan.watchFor}
        </p>
        <p className="ord-trans-foot">
          {petName(dogName)}의 화식 경험과 장 예민도를 보고 정한 속도예요.
        </p>
      </div>
    </details>
  )
}
