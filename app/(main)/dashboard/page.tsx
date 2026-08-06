import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  GreetingSection,
  ActiveDogCard,
  ThisWeekSection,
  MyDogsSection,
  JournalSection,
  DeliveryStripCard,
  EmptyHomeNoDogs,
  type DogCardData,
  type WeekDay,
  type QuickAction,
  type JournalEntry,
} from '@/components/v3/home'
import { StreakRewards } from '@/components/v3'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import OnboardingTutorial from '@/components/dashboard/OnboardingTutorial'
import {
  computeDailyStreak,
  kstDayKeyFromTs,
} from '@/lib/dashboard/streaks'
import { daysSinceIso, isoDaysAgo } from '@/lib/persona'
import type { Json } from '@/lib/supabase/types'
// 배송 문구 정본 — next_delivery_date 는 **발송일**이다(도착 아님).
import { shipTimingLabel } from '@/lib/shipping-schedule'
import { subscriptionState } from '@/lib/subscription-state'
import Link from 'next/link'
import { dailyGramsOf } from '@/lib/personalization/dailyGrams'
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
      .select('onboarded_at')
      .eq('id', user.id)
      .maybeSingle(),
    // Phase D7.4 + D7.5 + P7 — 페르소나 + 맞춤도 계산용 dog meta.
    // snapshot RPC 가 select 안 하는 컬럼이라 별도 fetch.
    supabase
      .from('dogs')
      .select(
        'id, photo_url, allergies_source, weight_method, activity_method, feed_method, weight_measured_at, accuracy_user_boost, user_method_lock',
      )
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

  // 활성 구독 D-day 카운트.
  const upcomingDelivery =
    hasActiveSub && subscription?.next_delivery_date
      ? (() => {
          const targetIso = `${subscription.next_delivery_date}T00:00:00+09:00`
          // 같은 이유 — server component 의 의도된 시간 의존성.
          const todayKstStart = new Date(
            new Date(nowKstMs).toISOString().slice(0, 10) + 'T00:00:00+09:00',
          ).getTime()
          const days = Math.round(
            (new Date(targetIso).getTime() - todayKstStart) / 86_400_000,
          )
          const items = subscription.subscription_items ?? []
          const productLabel =
            items.length === 0
              ? '정기배송'
              : items.length === 1
                ? items[0]!.product_name
                : `${items[0]!.product_name} 외 ${items.length - 1}개`
          return { daysUntil: days, productLabel }
        })()
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
  const firstDogDailyGrams = firstDogFormulaRow
    ? dailyGramsOf(firstDogFormulaRow)
    : null
  const firstDogFreshRatio = firstDog
    ? ((dogSubRatios ?? []) as Array<{
        dog_id: string
        fresh_ratio: number | null
      }>).find((s) => s.dog_id === firstDog.id && s.fresh_ratio != null)
        ?.fresh_ratio ?? null
    : null
  const freshFeedGrams =
    firstDogDailyGrams != null
      ? Math.round((firstDogDailyGrams * (firstDogFreshRatio ?? 100)) / 100)
      : null

  // ── Phase D7.4 — 페르소나 추론 + 카드 ──────────────────────────────────
  // 첫 강아지의 photo / allergies 신호 + 챗봇·일지·체크인·분석 카운트로
  // 4-페르소나 점수 계산. dominant null 이면 카드 비표시 (신호 부족).
  type DogMetaRow = {
    id: string
    photo_url: string | null
    allergies_source:
      | 'self_suspected'
      | 'vet_diagnosed'
      | 'unknown'
      | null
    weight_method: string | null
    activity_method: string | null
    feed_method: string | null
    weight_measured_at: string | null
    accuracy_user_boost: number | null
    user_method_lock: Json | null
  }
  const dogMetaList = (dogMetaData ?? []) as DogMetaRow[]

  // [2026-06-11] 변수별 맞춤도(AccuracyBreakdown)는 홈에서 분리해 마이페이지
  // 전용 화면(/mypage/accuracy)으로 이동(사장님 지시 — 홈 시각 위계 정리).
  // 계산식은 동일하게 그 페이지에서 활성 강아지 기준으로 수행.

  // ── v3 데이터 매핑 (R3 - 2026-05-21) ───────────────────────────
  // 위에서 모은 데이터 → 아래 v3 sections 의 props 로 풀어 넣음. 비교
  // 옛 dashboard 의 NextActionCard/Streak/Persona/Accuracy/Milestone 카드는
  // 첫 cut 에서 빼고, handoff 의 v3 home sections (Greeting/ActiveDog/Today/
  // ThisWeek/MyDogs/ForToday/Delivery/Journal/FarmToTail) 로 교체.

  // FAMILY 카드 색 tint — 등록 순서 회전.
  const DOG_TONES = ['#d6c9aa', '#b7c4ad', '#e4bda0', '#c2b48a']

  const dogCards: DogCardData[] = dogs.map((d, i) => ({
    id: d.id,
    name: d.name,
    breed: d.breed ?? '품종 미입력',
    weightKg: d.weight ?? null,
    number: String(i + 1).padStart(2, '0'),
    toneBg: DOG_TONES[i % DOG_TONES.length] ?? '#d6c9aa',
    photoUrl: dogMetaList.find((m) => m.id === d.id)?.photo_url ?? null,
    active: i === 0,
  }))

  const activeDogMetaLine = firstDog
    ? [
        firstDog.breed ?? '품종',
        firstDog.weight != null ? formatKg(firstDog.weight) : null,
        userCreatedAt
          ? `${Math.max(0, daysSinceIso(userCreatedAt))}일 함께`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  // ── ThisWeek 7일 그리드 — 일별 기록(recordDayKeys) 기준 (2026-07-17).
  // 하루 한 번이라도 기록하면 그날 '완료'(full). 옛날엔 cycle 체크인 카운트로
  // full=2+/partial=1 을 따졌는데, 체크인이 2주마다라 그리드가 늘 비어 무의미했다.
  // KST 기준으로 오늘~6일 전을 센다(서버 UTC 로 '오늘'이 어긋나던 것도 함께 교정).
  function makeWeekDays(nowMs: number): WeekDay[] {
    const days: WeekDay[] = []
    const kstNow = nowMs + 9 * 3600 * 1000
    const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    for (let offset = 6; offset >= 0; offset--) {
      // KST 로 시프트한 epoch 를 UTC 로 읽어 KST 달력 날짜를 얻는다(KST 는 DST 없음).
      const d = new Date(kstNow - offset * 86_400_000)
      const key = d.toISOString().slice(0, 10)
      const isToday = offset === 0
      const recorded = recordDayKeys.has(key)
      const status: WeekDay['status'] = recorded
        ? 'full'
        : isToday
          ? 'today'
          : 'miss'
      days.push({
        date: d.getUTCDate(),
        weekday: WEEKDAY_LABELS[d.getUTCDay()] ?? '·',
        status,
      })
    }
    return days
  }
  // eslint-disable-next-line react-hooks/purity
  const weekDays = makeWeekDays(Date.now())

  const quickActions: QuickAction[] = [
    {
      label: '식사',
      sub: firstDog ? '오늘 기록' : '아이 등록 후',
      kind: 'meal',
      tone: 'sage',
      href: firstDog ? `/dogs/${firstDog.id}/health` : '/dogs/new',
    },
    {
      label: '산책',
      sub: firstDog ? '오늘 기록' : '아이 등록 후',
      kind: 'walk',
      tone: 'accent',
      href: firstDog ? `/dogs/${firstDog.id}/health` : '/dogs/new',
    },
    {
      label: '체중',
      sub: firstDog?.weight != null ? formatKg(firstDog.weight) : '미입력',
      kind: 'weight',
      tone: 'ink',
      href: firstDog ? `/dogs/${firstDog.id}?weight=open` : '/dogs/new',
    },
  ]

  // [2026-06-11] 홈 "○○를 위한 추천" 제품 섹션(ForTodaySection)은 사장님
  // 지시로 제거. 배송 D-day 정보는 아래 DeliveryStripCard 로 단독 노출.

  // Journal 엔트리 — first cut 에서는 비활성 (dog_diary fetch 는 R6 phase).
  const journalEntries: JournalEntry[] = []

  return (
    // ft-stagger: 홈 섹션들이 위에서 순서대로 떠오르는 진입 연출 (B9).
    <div className="pb-8 ft-stagger">
      {/* 가입 후 첫 진입 튜토리얼 — onboarded_at IS NULL + 강아지 아직 없을 때만.
          설문 퍼널로 온 유저는 이미 강아지가 등록돼 있어(설문=강아지 등록) '첫
          아이 등록' 튜토리얼이 중복·혼란 → 강아지 0마리일 때만 노출(2026-07-24). */}
      {showOnboarding && dogs.length === 0 && <OnboardingTutorial />}

      {/* 1. Greeting hero — 54px display + signature */}
      <GreetingSection
        userName={userName ?? '보호자'}
        familyCount={dogs.length}
      />

      {/* ★결제가 멈췄으면 홈에서 먼저 말한다 (2026-08-07).
          예전엔 홈에 결제 상태를 알려주는 자리가 한 곳도 없어서, 카드가
          깨진 고객이 "활성 · 정기배송" 만 보고 박스가 오는 줄 알았다. */}
      {billingAlert && (
        <div className="px-5 mt-1">
          <Link
            href="/mypage/subscriptions"
            className="flex items-center gap-2 rounded px-4 py-3 active:opacity-70"
            style={{
              background: 'color-mix(in srgb, var(--sale) 10%, var(--paper))',
              border: '1px solid color-mix(in srgb, var(--sale) 35%, transparent)',
            }}
          >
            <span className="min-w-0 flex-1">
              <span
                className="block text-[13px] font-bold"
                style={{ color: 'var(--ink)' }}
              >
                {billingAlert.text}
              </span>
              <span
                className="block text-[11.5px] mt-0.5"
                style={{ color: 'var(--sale)' }}
              >
                {billingAlert.cta} →
              </span>
            </span>
          </Link>
        </div>
      )}

      {/* 2. ActiveDog 카드 — 첫 강아지 spotlight */}
      {firstDog && (
        <ActiveDogCard
          dogName={firstDog.name}
          metaLine={activeDogMetaLine}
          photoUrl={
            dogMetaList.find((m) => m.id === firstDog.id)?.photo_url ?? null
          }
          statusLabel={hasActiveSub ? '활성 · 정기배송' : '활성'}
          statusTone="sage"
          metrics={[
            {
              key: '체중',
              value: firstDog.weight != null ? String(firstDog.weight) : '--',
              sub: 'kg',
              tone: 'ink',
            },
            {
              key: '연속',
              value: dailyStreak > 0 ? String(dailyStreak) : '0',
              sub: '일',
              tone: 'yellow',
            },
            {
              // 옛 '분석 N/전체'(의미 없던 지표) → '오늘 화식 급여량'(사장님 2026-07-17).
              // 4칸 mono 라벨이 좁아 'g' 단위와 함께 '오늘 화식'으로 표기.
              key: '오늘 화식',
              value: freshFeedGrams != null ? String(freshFeedGrams) : '--',
              sub: 'g',
              tone: 'sage',
            },
            {
              // 값+단위로 분리 — "D-14 예정"(4+2글자)이 metric 칸을 넘쳐 규격이
              // 깨지던 문제(사장님 2026-07-14).
              // 문구는 lib/shipping-schedule 정본 — 이 날짜는 **발송일**이다
              // (예전엔 '도착'이라고 써서 하루 앞당겨 약속했다, 2026-07-30).
              key: '배송',
              value: upcomingDelivery
                ? shipTimingLabel(upcomingDelivery.daysUntil).metric.value
                : '--',
              sub: upcomingDelivery
                ? shipTimingLabel(upcomingDelivery.daysUntil).metric.unit
                : '예정',
              tone: 'accent',
            },
          ]}
          href={`/dogs/${firstDog.id}`}
          priority
        />
      )}

      {/* R15-C28: Streak rewards — 7일 이상 연속일 때만 노출.
          R19: section spacing 통일 — 다른 home sections 와 동일 padding. */}
      {firstDog && dailyStreak >= 7 && (
        <section style={{ padding: '0 20px 30px' }}>
          <StreakRewards currentStreak={dailyStreak} />
        </section>
      )}

      {/* 4. 이번 주 7일 그리드 + Quick Actions */}
      {firstDog && (
        <ThisWeekSection
          dogId={firstDog.id}
          dogName={firstDog.name}
          streak={dailyStreak}
          days={weekDays}
          quickActions={quickActions}
          recordTodayHref={`/dogs/${firstDog.id}/health`}
        />
      )}

      {/* 5. 내 아이들 — 2마리 이상일 때만 (1마리면 위 spotlight 와 중복).
          강아지 0 이면 EmptyHomeNoDogs 안내. */}
      {dogs.length > 1 ? (
        <MyDogsSection
          dogs={dogCards}
          viewAllHref="/dogs"
          addDogHref="/dogs/new"
        />
      ) : dogs.length === 0 ? (
        <EmptyHomeNoDogs addDogHref="/dogs/new" />
      ) : null}

      {/* 다음 배송 D-N strip (구독 활성 시). */}
      {upcomingDelivery && (
        <DeliveryStripCard
          dLabel={shipTimingLabel(upcomingDelivery.daysUntil).dLabel}
          channelLabel="정기배송"
          // ★ 이 날짜는 발송일이다. 예전 문구("내일 새벽 도착")는 하루를 앞당기고
          //   우리가 알 수 없는 시각까지 단정했다 — 도착은 지역에 따라 다르다.
          timingLabel={shipTimingLabel(upcomingDelivery.daysUntil).detail}
          itemLabel={upcomingDelivery.productLabel}
          href="/mypage/subscriptions"
        />
      )}

      {/* 8. 저널 (현재 비활성 — dog_diary fetch 는 R6 phase) */}
      {firstDog && journalEntries.length > 0 && (
        <JournalSection
          dogName={firstDog.name}
          entries={journalEntries}
        />
      )}

    </div>
  )
}

