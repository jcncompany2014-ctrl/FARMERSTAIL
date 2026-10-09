import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { sendWelcomeEmailOnce } from '@/lib/welcome-email'
import HomeView, { type HomeBox, type HomeViewModel } from '@/components/v3/home/HomeView'
import type { WeekDay, QuickAction } from '@/components/v3/home/ThisWeekSection'
import type { DogMetric, DogStatusTone } from '@/components/v3/home/ActiveDogCard'
import { boxRecipes } from '@/lib/design/pouch'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import OnboardingTutorial from '@/components/dashboard/OnboardingTutorial'
import PushAutoRegister from '@/components/dashboard/PushAutoRegister'
import {
  computeDailyStreak,
  kstDayKeyFromTs,
} from '@/lib/dashboard/streaks'
import { daysSinceIso, isoDaysAgo } from '@/lib/persona'
// 배송 문구 정본 — next_delivery_date 는 **발송일**이다(도착 아님).
import { shipTimingLabel, describeUpcomingBox, paidBoxShipIso } from '@/lib/shipping-schedule'
import { getChargeTiming } from '@/lib/payments/charge-timing'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { boxStage, stageDetail } from '@/lib/commerce/box-progress'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { petName } from '@/lib/korean'
import { subscriptionState } from '@/lib/subscription-state'
import { dailyPortionTotalG } from '@/lib/personalization/boxPricing'
import type { FoodLine } from '@/lib/personalization/types'
import { formatKg } from '@/lib/korean'

/**
 * Dashboard — 로그인 후 홈 화면.
 *
 * ## 2026-04 Perf 리팩토 메모
 * 이전 구현은 전체가 `'use client'` 였다:
 *   1) auth.getUser()  → 대기
 *   2) profiles   → 대기
 *   3) dogs       → 대기
 *   4) products   → 대기
 *   5) subscriptions → 대기
 *   6) events     → 대기
 *   → 모든 단계 완료까지 풀페이지 스피너
 *
 * 6×RTT 직렬 + JS hydration 후에야 첫 유효 페인트였다. 지금은 서버 컴포넌트로
 * 전환 + Promise.all 로 병렬화. 인증은 서버 쿠키에서 한 번에 읽고, 5개 쿼리
 * 는 동시 실행. HTML 이 바로 내려와 LCP 가 크게 개선되고, JS 번들도 마스트
 * 헤드 / 카운트다운 / 캐러셀 섬 (`DashboardClientIslands.tsx`) 만 필요.
 */

export const metadata: Metadata = {
  title: '파머스테일',
  description: '파머스테일 대시보드',
  robots: { index: false, follow: false },
}

// 개인화된 페이지 — CDN 캐시 금지. 유저별 쿼리 결과를 공유하면 안 됨.
export const dynamic = 'force-dynamic'

type DogRow = {
  id: string
  name: string
  breed: string | null
  birth_date: string | null
  weight: number | null
}

type SubscriptionRow = {
  id: string
  status: string
  next_delivery_date: string | null
  /**
   * 결제 상태 판정용 (2026-08-08 마이그레이션으로 RPC 가 함께 돌려준다).
   *
   * 예전엔 이 세 칸이 오지 않아서 홈이 `subscriptionState()` 를 **부를 수가
   * 없었다** — 카드가 깨진 구독을 "활성 · 정기배송" 이라 말하고 D-day 까지
   * 붙였고, 3회 실패로 멈춘 구독은 RPC 필터에 걸려 홈에서 통째로 사라졌다.
   *
   * billing_key 값 자체는 내보내지 않는다(결제 자격증명). 있나 없나만 온다.
   */
  has_billing_key?: boolean
  failed_charge_count?: number
  requires_billing_key_renewal?: boolean
  subscription_items: { product_name: string }[]
}

// v3 리디자인 이후 사용 안 함: CATEGORIES (홈 카테고리 칩 섹션 삭제),
// DashboardContext / buildContextCard (마스트헤드 status 카드 삭제) /
// ProductFallback (상품 그리드 placeholder 삭제) / NextDeliveryLine (인라인
// 배송 라벨 삭제). 모두 v3 home sections 가 책임.

export default async function DashboardPage() {
  const supabase = await createClient()

  const user = await getSafeUser(supabase)

  if (!user) redirect('/login')

  // 3개 쿼리 동시 실행. user-scoped (profile + dogs + active subscription) 는
  // dashboard_user_snapshot RPC 로 1-shot, 글로벌 (products / events) 만 별도.
  // 이전엔 5개 라운드트립이었는데 RPC 합쳐 3개로 — auth/RLS 평가도 1회만 발생.
  //
  // Error 처리 방침: 개별 쿼리 실패해도 대시보드는 "빈 상태" 로 렌더한다.
  //   - UX: 한 섹션 실패로 모든 영역을 블록하는 건 과잉 반응.
  //   - 가시성: Sentry 로 보내서 운영자는 인지. 사용자 경로는 유지.
  const [
    { data: snapshotData, error: snapshotErr },
    { data: onboardData },
    { data: dogMetaData },
    { data: healthLogDates },
    { data: activityLogDates },
    { data: weightLogDates },
    { data: dogFormulaGrams },
    { data: dogSubRatios },
  ] = await Promise.all([
    supabase.rpc('dashboard_user_snapshot', { p_user_id: user.id }),
    // 가입 후 첫 진입 튜토리얼 노출 여부 — onboarded_at IS NULL 이면 모달 띄움.
    supabase
      .from('profiles')
      .select('onboarded_at, welcome_email_sent_at')
      .eq('id', user.id)
      .maybeSingle(),
    // 강아지 사진 — snapshot RPC 가 select 안 하는 컬럼이라 별도 fetch.
    // (옛 페르소나·맞춤도 칸은 홈에서 쓰지 않아 뺐다 — 맞춤도는 /mypage/accuracy, 2026-06-11.)
    supabase
      .from('dogs')
      .select('id, photo_url')
      .eq('user_id', user.id),
    // ── 일별 기록 스트릭/그리드 (2026-07-17) — 식사·산책·체중 중 하나라도 남긴
    // 날을 '완료'로 센다. cycle 체크인(2주마다)이 아니라 실제 일상 기록 기준.
    // firstDog 은 아직 미확정(쿠키 재정렬 후)이라 user-scope 로 받고 메모리 필터.
    // 날짜 컬럼만 60일치 — 가벼움.
    supabase
      .from('health_logs')
      .select('dog_id, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', isoDaysAgo(60)),
    supabase
      .from('activity_logs')
      .select('dog_id, occurred_at')
      .eq('user_id', user.id)
      .gte('occurred_at', isoDaysAgo(60)),
    supabase
      .from('weight_logs')
      .select('dog_id, measured_at')
      .eq('user_id', user.id)
      .gte('measured_at', isoDaysAgo(60)),
    // '오늘 화식 급여량' 메트릭 — 최신 처방에서 **다시 계산**한다(2026-08-03).
    // 저장된 daily_grams 는 읽지 않는다: 그 칸은 만들어질 당시의 kcal 밀도로
    // 굳어 있어서, 밀도가 v4.0 으로 바뀐 뒤에도 옛 숫자가 그대로 나왔다
    // (푸린: 저장 160g vs 실제 142g — 같은 184kcal 인데 1.15 vs 1.30 kcal/g).
    // 계산은 lib/personalization/dailyGrams 하나 — 주문 화면·피킹 리스트와
    // 같은 dailyGramsFromMix 를 쓴다.
    supabase
      .from('dog_formulas')
      .select('dog_id, cycle_number, daily_kcal, formula, created_at')
      .eq('user_id', user.id)
      // ★created_at 정렬 — 회차 번호가 큰 것이 최신이 아니다(2026-07-30 감사).
      // 청구·피킹 리스트와 같은 처방을 가리켜야 급여량이 실제 박스와 맞는다.
      .order('created_at', { ascending: false }),
    // 화식 비율(30/50/100) — 구독에서. 없으면 완전화식(100%) 기준으로 표기.
    supabase
      .from('subscriptions')
      .select('dog_id, fresh_ratio, created_at')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false }),
  ])

  const showOnboarding =
    onboardData != null && (onboardData as { onboarded_at: string | null }).onboarded_at === null

  // ★가입 환영 메일 — 첫 홈 진입에서 한 통 (2026-09-15). 이 메일은 서비스
  //   시작부터 한 통도 안 나갔다: 템플릿은 있는데 부르는 코드가 없었다.
  //   after() 로 응답 뒤에 돌려 홈 렌더를 안 늦춘다. 선점·중복·실패 재시도는
  //   sendWelcomeEmailOnce 가 맡는다. welcome_email_sent_at 이 이미 있으면
  //   여기서 걸러져 서버 왕복도 없다.
  const welcomePending =
    onboardData != null &&
    (onboardData as { welcome_email_sent_at: string | null }).welcome_email_sent_at === null
  if (welcomePending) {
    after(async () => {
      try {
        await sendWelcomeEmailOnce(user.id)
      } catch (err) {
        console.error('[dashboard] 환영 메일 발화 실패:', err)
      }
    })
  }

  if (snapshotErr) {
    console.error('[dashboard] user_snapshot rpc failed', snapshotErr)
  }

  // RPC 가 JSONB 로 { profile, dogs, subscription } 반환. 실패시 모두 null/[].
  type SnapshotShape = {
    profile: { name: string | null } | null
    dogs: DogRow[]
    subscription: SubscriptionRow | null
    /**
     * 조치가 필요한 구독 하나 (20260808000000 에서 추가).
     * 옵셔널인 이유: 마이그레이션 적용 전 RPC 는 이 키를 안 준다.
     * subscription_items 는 배너에 안 쓰므로 RPC 도 보내지 않는다 —
     * 타입이 실제 payload 보다 넓으면 없는 필드를 있다고 믿게 된다.
     */
    attention?: {
      id: string
      status: string
      has_billing_key?: boolean
      failed_charge_count?: number
      requires_billing_key_renewal?: boolean
      next_delivery_date: string | null
    } | null
  }
  const snapshot = (snapshotData ?? {
    profile: null,
    dogs: [],
    subscription: null,
    attention: null,
  }) as SnapshotShape

  // UI audit H4: email 에서 derive 한 userName 이 너무 길면 (예: 'park.jieun.kim')
  // 28px h1 + `<br/>` 강제 줄바꿈 패턴에서 3줄로 늘어남. 12자 cap + ellipsis.
  // profile.name (사용자 직접 입력) 은 보통 짧으니 그대로.
  const rawUserName =
    snapshot.profile?.name || user.email?.split('@')[0] || null
  const userName =
    rawUserName && rawUserName.length > 12
      ? `${rawUserName.slice(0, 12)}…`
      : rawUserName
  const userCreatedAt = user.created_at ?? null
  // 헤더 강아지 칩에서 선택한 활성 강아지(쿠키)를 맨 앞으로 올린다. 홈의
  // spotlight 섹션들은 모두 firstDog = dogs[0] 기반이라, 이 한 번의 재정렬로
  // 인사·활성카드·이번주·맞춤추천이 전부 선택한 아이 기준으로 전환된다.
  // 쿠키 없거나 해당 강아지가 없으면 등록 순서(기본) 유지.
  const cookieStore = await cookies()
  const activeDogIdCookie = cookieStore.get('ft_active_dog')?.value ?? null
  const dogs = (() => {
    const list = (snapshot.dogs ?? []) as DogRow[]
    if (!activeDogIdCookie) return list
    const idx = list.findIndex((d) => d.id === activeDogIdCookie)
    if (idx <= 0) return list
    return [list[idx]!, ...list.slice(0, idx), ...list.slice(idx + 1)]
  })()
  const subscription = snapshot.subscription

  /**
   * ★배송 정보와 조치 알림은 **서로 다른 질문**이라 RPC 가 따로 돌려준다
   * (20260808000000). 한 행으로 답하려 했더니, 강아지 두 마리 중 하나가
   * 멈춰 있으면 **살아 있는 다른 아이의 배송이 홈에서 사라졌다.**
   *
   * `subscription` = 실제로 청구가 도는 구독(배송 D-day 용)
   * `attention`    = 고객이 손을 써야 하는 구독(배너용). 없으면 null.
   */
  const attention = snapshot.attention ?? null

  // ★마이그레이션 적용 전에도 홈이 깨지지 않게 한다.
  //  RPC 가 아직 판정 칸을 안 주면 `has_billing_key` 가 undefined 인데, 그걸
  //  '카드 없음' 으로 읽으면 **모든 구독자에게 "결제수단을 등록해 주세요"** 가
  //  뜨고 배송 D-day 가 통째로 사라진다(2026-08-08 검토에서 잡힘).
  //  칸이 안 오면 판정을 하지 않는다 — 모르는 것을 단정하지 않는다.
  const hasBillingFields =
    subscription != null && subscription.has_billing_key !== undefined

  const attentionState = attention
    ? subscriptionState({
        status:
          attention.status === 'active' || attention.status === 'paused'
            ? attention.status
            : 'cancelled',
        // SubLike 는 string|null 을 받는다 — 실제 키는 서버 밖으로 내보내지
        // 않으므로 존재 여부만 그 모양으로 넘긴다.
        billing_key: attention.has_billing_key ? 'set' : null,
        next_delivery_date: attention.next_delivery_date ?? null,
        failed_charge_count: attention.failed_charge_count ?? 0,
        requires_billing_key_renewal:
          attention.requires_billing_key_renewal ?? false,
      })
    : null

  // "활성" = 청구가 실제로 도는 구독이 있고 배송일이 잡혀 있다.
  //  판정 칸이 없는 옛 RPC 에서는 예전처럼 배송일 유무로만 본다.
  const hasActiveSub = hasBillingFields
    ? subscription?.next_delivery_date != null &&
      subscription.has_billing_key === true &&
      subscription.requires_billing_key_renewal !== true
    : subscription != null && subscription.next_delivery_date != null

  // 고객이 손을 써야 하는 상태 — 홈 상단에 한 줄로 알린다.
  const billingAlert =
    attentionState === 'needs_card'
      ? {
          text: '정기배송을 시작하려면 결제수단을 등록해 주세요.',
          cta: '결제수단 등록하기',
        }
      : attentionState === 'card_failed'
        ? {
            text: '결제가 확인되지 않아 정기배송이 멈춰 있어요.',
            cta: '결제수단 확인하기',
          }
        : attentionState === 'paused'
          ? {
              text: '정기배송이 일시정지 상태예요.',
              cta: '정기배송 보기',
            }
          : null

  // Server component 는 매 요청마다 실행돼 Date.now() 사용이 정상이지만
  // react-hooks/purity 룰이 hook 가정으로 잡음. 이 컴포넌트는 force-dynamic
  // 으로 캐시 안 됨 — 의도된 동작. (배송 D-day 계산용.)
  // eslint-disable-next-line react-hooks/purity
  const nowKstMs = Date.now() + 9 * 3600 * 1000

  // ── 결제된 박스 진행(2026-10-01 사장님 — 발송 준비 → 발송 → 배송 중 → 배송 완료) ─────────────────
  // 일정이 토·일 조리 → 월 포장 → 화 발송으로 바뀌어 일반 고객은 토요일 아침에 결제되고 박스는 사흘 뒤 나간다.
  // 결제됐는데 아무 소식이 없는 구간을 홈 카드가 채운다. 판정·문구 정본 = lib/commerce/box-progress.
  // 조회 실패는 카드만 안 뜬다(돈·버튼과 무관한 표시) — 대신 남긴다.
  const todayKst = todayKstIsoDate()
  const [{ data: boxOrderRows, error: boxOrdersErr }, chargeTiming] = await Promise.all([
    supabase
      .from('orders')
      .select('id, subscription_id, order_status, payment_status, paid_at, shipped_at, delivered_at, tracking_number, carrier, created_at')
      .eq('user_id', user.id)
      .not('subscription_id', 'is', null)
      .in('payment_status', PAID_STATUSES)
      .in('order_status', ['preparing', 'shipping', 'delivered'])
      .gte('created_at', new Date(nowKstMs - 9 * 3600 * 1000 - 21 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
    getChargeTiming(user.id),
  ])
  if (boxOrdersErr) console.error('[dashboard] 박스 진행 주문 조회 실패', boxOrdersErr.message)
  type BoxOrderRow = {
    id: string
    subscription_id: string | null
    order_status: string | null
    payment_status: string | null
    paid_at: string | null
    shipped_at: string | null
    delivered_at: string | null
    tracking_number: string | null
    carrier: string | null
    created_at: string
  }
  const boxOrders = ((boxOrderRows ?? []) as BoxOrderRow[]).filter((o) => boxStage(o, todayKst) !== null)
  const boxSubIds = [...new Set(boxOrders.map((o) => o.subscription_id).filter((x): x is string => !!x))]
  const boxSubs = new Map<
    string,
    { dog_id: string | null; next_delivery_date: string | null; items: { name: string; quantity: number | null }[] }
  >()
  if (boxSubIds.length > 0) {
    const { data: bsRows, error: bsErr } = await supabase
      .from('subscriptions')
      .select('id, dog_id, next_delivery_date, subscription_items(product_name, quantity)')
      .in('id', boxSubIds)
    if (bsErr) console.error('[dashboard] 박스 진행 구독 조회 실패', bsErr.message)
    for (const r of (bsRows ?? []) as Array<{
      id: string
      dog_id: string | null
      next_delivery_date: string | null
      subscription_items: { product_name: string; quantity: number | null }[] | null
    }>) {
      boxSubs.set(r.id, {
        dog_id: r.dog_id,
        next_delivery_date: r.next_delivery_date,
        items: (r.subscription_items ?? []).map((it) => ({ name: it.product_name, quantity: it.quantity })),
      })
    }
  }
  // 구독마다 가장 최근 박스 하나.
  const seenBoxSub = new Set<string>()
  // 강아지 사진(박스 카드 줄머리·고르기 탭·강아지 카드). dogs 메타는 위 Promise.all 에서 받았다.
  const photoOf = (id: string | undefined) =>
    ((dogMetaData ?? []) as Array<{ id: string; photo_url: string | null }>).find((m) => m.id === id)?.photo_url ?? null
  const boxCards: HomeBox[] = []
  for (const o of boxOrders) {
    if (!o.subscription_id || seenBoxSub.has(o.subscription_id)) continue
    seenBoxSub.add(o.subscription_id)
    const stage = boxStage(o, todayKst)!
    const sub = boxSubs.get(o.subscription_id)
    const dog = dogs.find((d) => d.id === sub?.dog_id)
    // 발송 준비 중인 박스의 발송일 — 결제 시각 기준 정본(paidBoxShipIso). next − 14 만 보면 결제 뒤 '2주 미루기'에
    // 이번 박스를 2주 늦게 말한다(실제로는 그대로 나간다).
    const shipIso =
      stage === 'preparing' ? paidBoxShipIso(sub?.next_delivery_date ?? null, o.paid_at ?? o.created_at) : null
    const tracking = !!(o.tracking_number && o.carrier) && stage !== 'preparing'
    // 레시피 → 한 줄("닭고기 · 흑돼지 화식") + 파우치 색 순서(lib/design/pouch — 팩 많은 레시피가 바탕).
    const recipes = boxRecipes(sub?.items ?? [])
    boxCards.push({
      key: o.id,
      dogLabel: dog ? petName(dog.name) : '우리 아이',
      photoUrl: photoOf(dog?.id),
      stage,
      detail: stageDetail(stage, shipIso, todayKst),
      itemLabel: recipes.label,
      lines: recipes.lines,
      href: tracking ? `/mypage/orders/${o.id}/track` : `/mypage/orders/${o.id}`,
      linkLabel: tracking ? '배송 조회' : '자세히',
    })
  }

  // 활성 구독 D-day 카운트 — 화면용 박스 판정(lib/shipping-schedule describeUpcomingBox).
  // ★토요일 결제 뒤엔 next_delivery_date 가 다음 주기라 그대로 세면 사흘 뒤 나갈 박스를 두고 "17일 후 발송"이라
  //   말한다(2026-10-01). 결제됐고 아직 안 나간 박스가 있으면 그 박스, 결제일이 지났는데 결제 증거가 없으면 '확인 중'.
  const upcomingDelivery =
    hasActiveSub && subscription?.next_delivery_date
      ? (() => {
          // 최신순 조회라 첫 행이 가장 최근 결제 박스.
          const paidPreparing = ((boxOrderRows ?? []) as BoxOrderRow[]).find(
            (o) => o.subscription_id === subscription.id && o.order_status === 'preparing',
          )
          const box = describeUpcomingBox({
            nextDeliveryDate: subscription.next_delivery_date,
            timing: chargeTiming,
            hasPaidPreparingOrder: !!paidPreparing,
            paidAt: paidPreparing ? (paidPreparing.paid_at ?? paidPreparing.created_at) : null,
            today: todayKst,
          })
          if (!box) return null
          const days = Math.round(
            (Date.parse(`${box.shipIso}T00:00:00Z`) - Date.parse(`${todayKst}T00:00:00Z`)) / 86_400_000,
          )
          // 레시피 → 한 줄 + 파우치 색(lib/design/pouch). 이 조회엔 팩 수가 없어 같은 순서 규칙(닭 → 흑돼지 → 한우 → 오리).
          const recipes = boxRecipes((subscription.subscription_items ?? []).map((it) => ({ name: it.product_name })))
          return {
            daysUntil: days,
            shipIso: box.shipIso,
            itemLabel: recipes.label,
            lines: recipes.lines,
            chargeCheck: box.kind === 'charge_check',
          }
        })()
      : null
  // 결제 확인 중이면 발송을 약속하지 않는다.
  const deliveryTiming = upcomingDelivery
    ? upcomingDelivery.chargeCheck
      ? {
          dLabel: '확인 중',
          detail: '결제를 확인하고 있어요. 확인되면 박스를 준비해 보내드려요.',
          metric: { value: '확인', unit: '중' },
        }
      : shipTimingLabel(upcomingDelivery.daysUntil)
    : null

  const firstDog = dogs[0]

  // ── 일별 기록 연속/그리드 (2026-07-17) ────────────────────────────────
  // 첫 강아지의 식사(health_logs)·산책(activity_logs)·체중(weight_logs) 기록이
  // 있는 KST 날짜를 하나의 Set 으로 합친다. "하루 한 번이라도 남기면 완료".
  const recordDayKeys = new Set<string>()
  if (firstDog) {
    for (const r of (healthLogDates ?? []) as Array<{
      dog_id: string
      logged_at: string | null
    }>) {
      // logged_at 은 이미 KST 달력 date('YYYY-MM-DD') — 변환 없이 slice.
      if (r.dog_id === firstDog.id && r.logged_at)
        recordDayKeys.add(r.logged_at.slice(0, 10))
    }
    for (const r of (activityLogDates ?? []) as Array<{
      dog_id: string
      occurred_at: string | null
    }>) {
      if (r.dog_id === firstDog.id && r.occurred_at)
        recordDayKeys.add(kstDayKeyFromTs(r.occurred_at))
    }
    for (const r of (weightLogDates ?? []) as Array<{
      dog_id: string
      measured_at: string | null
    }>) {
      if (r.dog_id === firstDog.id && r.measured_at)
        recordDayKeys.add(kstDayKeyFromTs(r.measured_at))
    }
  }
  // force-dynamic 서버 컴포넌트 — Date.now() 는 매 요청 실행이라 정상(purity 예외).
  // eslint-disable-next-line react-hooks/purity
  const dailyStreak = computeDailyStreak(recordDayKeys, Date.now())

  // ── '오늘 화식 급여량' (g) — 최신 처방 daily_grams × 화식비율/100 ──────────
  // OrderClient 의 박스 "하루 Xg" 와 같은 식(daily_grams×freshRatio/100). 구독
  // 전이면 완전화식(100%) 기준. 처방이 없으면(첫 설문 전) null → '--'.
  const firstDogFormulaRow = firstDog
    ? ((dogFormulaGrams ?? []) as Array<{
        dog_id: string
        daily_kcal: number | null
        formula: { lineRatios: Record<string, number> } | null
      }>).find((f) => f.dog_id === firstDog.id) ?? null
    : null
  const firstDogFreshRatio = firstDog
    ? ((dogSubRatios ?? []) as Array<{
        dog_id: string
        fresh_ratio: number | null
      }>).find((s) => s.dog_id === firstDog.id && s.fresh_ratio != null)
        ?.fresh_ratio ?? null
    : null
  // ★처방=팩=화면 한 숫자 (사장님 2026-08-24): 정확값 반올림이 아니라 **팩
  //   규격의 합**(dailyPortionTotalG = 라인별 mealPortionG 합)을 보여준다.
  //   주문 화면·실제 팩과 같은 숫자가 나온다 — 총량×비율 반올림은 42 vs 팩 40
  //   처럼 갈라졌다(사장님 제보).
  const freshFeedGrams =
    firstDogFormulaRow?.daily_kcal && firstDogFormulaRow.formula?.lineRatios
      ? dailyPortionTotalG(
          firstDogFormulaRow.formula.lineRatios as Record<FoodLine, number>,
          firstDogFormulaRow.daily_kcal,
          firstDogFreshRatio ?? 100,
        )
      : null

  // [2026-06-11] 변수별 맞춤도(AccuracyBreakdown)는 홈에서 분리해 마이페이지
  // 전용 화면(/mypage/accuracy)으로 이동(사장님 지시 — 홈 시각 위계 정리).
  // 계산식은 동일하게 그 페이지에서 활성 강아지 기준으로 수행.

  // ── 화면 값 (앱 새 디자인 'A 포스터', 2026-10-09) ─────────────────────────
  // 배치는 components/v3/home/HomeView(그리기만) — 여기서는 위에서 판정한 값을 넘긴다.
  // 점검 화면(/design-check)이 같은 HomeView 에 예시 값을 넣어 로그인 없이 모든 상태를 본다.

  // 강아지 카드 상태 — 정기배송 중 / 배송 멈춤 / 일시정지 / 정기배송 전(구독 전·카드 등록 전).
  // 결정 문서 3번: 구독 전 상태 이름 "활성" → "정기배송 전".
  const dogStatus: { label: string; tone: DogStatusTone } = hasActiveSub
    ? { label: '정기배송 중', tone: 'active' }
    : attentionState === 'card_failed'
      ? { label: '배송 멈춤', tone: 'stopped' }
      : attentionState === 'paused'
        ? { label: '일시정지', tone: 'idle' }
        : { label: '정기배송 전', tone: 'idle' }

  // "247일 함께" — 막 가입한 날은 "0일 함께" 대신 "오늘부터 함께"(결정 문서 3번).
  const togetherDays = userCreatedAt ? Math.max(0, daysSinceIso(userCreatedAt)) : null
  const activeDogMetaLine = firstDog
    ? [
        firstDog.breed ?? '품종',
        firstDog.weight != null ? formatKg(firstDog.weight) : null,
        togetherDays == null ? null : togetherDays === 0 ? '오늘부터 함께' : `${togetherDays}일 함께`,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  // 수치 띠 4칸 — 체중 · 연속 · 오늘 화식 · 배송. 배송 칸은 좁아 단위를 줄인다("일 후 발송" → "일 후").
  const deliveryMetric = deliveryTiming
    ? {
        value: deliveryTiming.metric.value,
        sub: deliveryTiming.metric.unit === '일 후 발송' ? '일 후' : deliveryTiming.metric.unit,
      }
    : { value: '--', sub: '예정' }
  const metrics: DogMetric[] = [
    { key: '체중', value: firstDog?.weight != null ? String(firstDog.weight) : '--', sub: 'kg' },
    { key: '연속', value: String(Math.max(0, dailyStreak)), sub: '일' },
    // 옛 '분석 N/전체'(의미 없던 지표) → '오늘 화식 급여량'(사장님 2026-07-17).
    { key: '오늘 화식', value: freshFeedGrams != null ? String(freshFeedGrams) : '--', sub: 'g' },
    // 문구는 lib/shipping-schedule 정본 — 이 날짜는 **발송일**이다(예전 '도착'은 하루 앞당긴 약속, 2026-07-30).
    { key: '배송', value: deliveryMetric.value, sub: deliveryMetric.sub },
  ]

  // ── 이번 주 7칸 — 일~토 달력 한 주(KST). 기록한 날 = 완료, 오늘(아직) = 점선, 지난 빈 날 = 미기록, 남은 날 = 예정.
  // 하루 한 번이라도 기록하면 그날 '완료'(2026-07-17). 제목이 "이번 주"라 지난 7일이 아니라 이번 주로(2026-10-09 시안).
  function makeWeekDays(nowMs: number): WeekDay[] {
    const days: WeekDay[] = []
    const kstNow = new Date(nowMs + 9 * 3600 * 1000)
    // 요일은 한글로 — 영문 약자(M/T/W)는 어르신이 못 읽는다(2026-09-22).
    const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
    const todayKey = kstNow.toISOString().slice(0, 10)
    const dow = kstNow.getUTCDay()
    for (let i = 0; i < 7; i++) {
      // KST 로 시프트한 epoch 를 UTC 로 읽어 KST 달력 날짜를 얻는다(KST 는 DST 없음).
      const d = new Date(kstNow.getTime() + (i - dow) * 86_400_000)
      const key = d.toISOString().slice(0, 10)
      const isToday = key === todayKey
      const recorded = recordDayKeys.has(key)
      const status: WeekDay['status'] = recorded ? 'full' : isToday ? 'today' : key > todayKey ? 'future' : 'miss'
      days.push({ date: d.getUTCDate(), weekday: WEEKDAY_LABELS[d.getUTCDay()] ?? '·', status, isToday })
    }
    return days
  }
  // eslint-disable-next-line react-hooks/purity
  const weekDays = makeWeekDays(Date.now())

  const quickActions: QuickAction[] = [
    { label: '식사', sub: firstDog ? '오늘 기록' : '아이 등록 후', kind: 'meal', href: firstDog ? `/dogs/${firstDog.id}/health` : '/dogs/new' },
    { label: '산책', sub: firstDog ? '오늘 기록' : '아이 등록 후', kind: 'walk', href: firstDog ? `/dogs/${firstDog.id}/health` : '/dogs/new' },
    { label: '체중', sub: firstDog ? '오늘 기록' : '아이 등록 후', kind: 'weight', href: firstDog ? `/dogs/${firstDog.id}?weight=open` : '/dogs/new' },
  ]

  // 다음 정기배송 카드 — 결제된 박스가 움직이는 중이면 같은 이야기라 숨긴다.
  const nextDelivery: HomeViewModel['nextDelivery'] =
    upcomingDelivery && deliveryTiming && boxCards.length === 0
      ? upcomingDelivery.chargeCheck || upcomingDelivery.daysUntil < 0
        ? {
            daysUntil: null,
            shipDateLabel: null,
            checkDetail: deliveryTiming.detail,
            itemLabel: upcomingDelivery.itemLabel,
            lines: upcomingDelivery.lines,
          }
        : {
            daysUntil: upcomingDelivery.daysUntil,
            // "10월 13일 (화)" — 발송일(도착 아님).
            shipDateLabel: (() => {
              const d = new Date(`${upcomingDelivery.shipIso}T00:00:00Z`)
              const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()]
              return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${wd})`
            })(),
            checkDetail: null,
            itemLabel: upcomingDelivery.itemLabel,
            lines: upcomingDelivery.lines,
          }
      : null

  const model: HomeViewModel = {
    userName: userName ?? '보호자',
    dogCount: dogs.length,
    // ★조회 실패를 '0마리'로 그리지 않는다 — 구독 고객에게 "첫 아이를 등록해주세요"가 떴다(2026-09-26).
    loadFailed: !!snapshotErr,
    billingAlert: billingAlert
      ? { ...billingAlert, tone: attentionState === 'paused' ? 'notice' : 'danger' }
      : null,
    boxes: boxCards,
    nextDelivery,
    dogTabs: dogs.map((d) => ({ id: d.id, name: d.name, photoUrl: photoOf(d.id) })),
    activeDog: firstDog
      ? {
          id: firstDog.id,
          name: firstDog.name,
          metaLine: activeDogMetaLine,
          photoUrl: photoOf(firstDog.id),
          statusLabel: dogStatus.label,
          statusTone: dogStatus.tone,
          metrics,
        }
      : null,
    streak: dailyStreak,
    weekDays,
    quickActions,
  }

  return (
    <>
      {/* 앱이면 푸시 토큰 자동 등록 — 2026-09-15 전까지는 설정 화면에서 직접 켜야만 등록됐다 */}
      <PushAutoRegister />
      {/* 가입 후 첫 진입 튜토리얼 — onboarded_at IS NULL + 강아지 아직 없을 때만.
          설문 퍼널로 온 유저는 이미 강아지가 등록돼 있어(설문=강아지 등록) '첫
          아이 등록' 튜토리얼이 중복·혼란 → 강아지 0마리일 때만 노출(2026-07-24). */}
      {showOnboarding && dogs.length === 0 && <OnboardingTutorial />}
      <HomeView model={model} />
    </>
  )

}

