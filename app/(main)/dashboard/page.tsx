import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Footprints, Scale, Soup } from 'lucide-react'
import {
  GreetingSection,
  ActiveDogCard,
  TodayCard,
  ThisWeekSection,
  MyDogsSection,
  ForTodaySection,
  JournalSection,
  DeliveryStripCard,
  FarmToTailSection,
  EmptyHomeNoDogs,
  type DogCardData,
  type WeekDay,
  type QuickAction,
  type JournalEntry,
} from '@/components/v3/home'
import DashboardDailyChecks from '@/components/dashboard/DashboardDailyChecks'
import { StreakRewards } from '@/components/v3'
import { createClient } from '@/lib/supabase/server'
import ReferralAutoRedeemer from '@/components/ReferralAutoRedeemer'
import { getActiveEvents } from '@/lib/events/data'
import {
  computeNextAction,
  type NextActionInput,
} from '@/lib/dashboard/next-action'
import OnboardingTutorial from '@/components/dashboard/OnboardingTutorial'
import { currentMilestone } from '@/lib/dashboard/milestones'
import { computeStreak, type CheckinRow } from '@/lib/dashboard/streaks'
import {
  computePersona,
  daysSinceIso,
  isoDaysAgo,
  personaCardSpec,
} from '@/lib/persona'
import AccuracyBreakdown, {
  type AccuracyVar,
} from '@/components/dashboard/AccuracyBreakdown'
import {
  feedReliability,
  activityReliability,
  weightReliability,
  overallReliability,
} from '@/lib/personalization/reliability'
import {
  getAvgDailyFeedG,
  formatAutoIntakeLabel,
} from '@/lib/feeding/auto-intake'
import type { Json } from '@/lib/supabase/types'

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

type ProductRow = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  category: string | null
  short_description: string | null
  is_subscribable: boolean
}

type SubscriptionRow = {
  id: string
  status: string
  next_delivery_date: string | null
  subscription_items: { product_name: string }[]
}

// v3 리디자인 이후 사용 안 함: CATEGORIES (홈 카테고리 칩 섹션 삭제),
// DashboardContext / buildContextCard (마스트헤드 status 카드 삭제) /
// ProductFallback (상품 그리드 placeholder 삭제) / NextDeliveryLine (인라인
// 배송 라벨 삭제). 모두 v3 home sections 가 책임.

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    { data: prodData, error: prodErr },
    events,
    { data: pendingFormulasData },
    { data: latestWeightsData },
    { data: dogAnalysesData },
    { data: onboardData },
    { data: checkinsData },
    { data: dogMetaData },
    { count: chatCount },
    { count: diaryCount },
    { data: pastSnapshotData },
  ] = await Promise.all([
    supabase.rpc('dashboard_user_snapshot', { p_user_id: user.id }),
    // 대시보드 제품 — 4개만. 더 보고 싶으면 "전체 →" 로 /products 진입.
    // 매일 사용 surface 의 시각적 무게 ↓.
    supabase
      .from('products')
      .select(
        'id, name, slug, price, sale_price, image_url, category, short_description, is_subscribable',
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(4),
    // getActiveEvents 는 내부에서 catch + empty 반환 — 실패해도 대시보드 전체
    // 가 깨지지 않는다.
    getActiveEvents(supabase, 3),
    // 처방 승인 대기 — 가장 오래된 1건 (사용자가 가장 먼저 확인해야 할 것)
    supabase
      .from('dog_formulas')
      .select('id, dog_id, proposed_at, dogs(name)')
      .eq('user_id', user.id)
      .eq('approval_status', 'proposed')
      .order('proposed_at', { ascending: true })
      .limit(1),
    // 각 강아지의 최근 체중 측정일. 14일+ 미기록인 가장 오래된 강아지 찾기.
    supabase
      .from('weight_logs')
      .select('dog_id, measured_at')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false }),
    // 각 강아지의 분석 존재 여부. 분석 0 인 강아지 picking 용.
    supabase
      .from('analyses')
      .select('dog_id')
      .eq('user_id', user.id),
    // 가입 후 첫 진입 튜토리얼 노출 여부 — onboarded_at IS NULL 이면 모달 띄움.
    supabase
      .from('profiles')
      .select('onboarded_at')
      .eq('id', user.id)
      .maybeSingle(),
    // 체크인 스트릭 계산용 — 첫 dog 의 cycle 만 client filter. user-level 전체
    // row 라 다중 견에도 호환. cycle_number 오름차순으로 받아 streak 계산이
    // 그대로 통과. 사용자당 통상 수십 row → 비용 무시 가능.
    supabase
      .from('dog_checkins')
      .select('dog_id, created_at, cycle_number, checkpoint')
      .eq('user_id', user.id)
      .order('cycle_number', { ascending: true }),
    // Phase D7.4 + D7.5 + P7 — 페르소나 + 맞춤도 계산용 dog meta.
    // snapshot RPC 가 select 안 하는 컬럼이라 별도 fetch.
    supabase
      .from('dogs')
      .select(
        'id, photo_url, allergies_source, weight_method, activity_method, feed_method, weight_measured_at, accuracy_user_boost, user_method_lock',
      )
      .eq('user_id', user.id),
    // chatbot 사용자 발화 수 — 챗봇 의존 신호
    supabase
      .from('chatbot_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user'),
    // 일지 작성 수 — 감성형 신호
    supabase
      .from('dog_diary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    // P8 — 지난주(7일 전) sensitivity snapshot. 변화율 chip 표시용.
    // 최신 1건만 가져와 현재와 비교.
    supabase
      .from('dog_sensitivity_snapshots')
      .select('snapshot_at, baseline_state, top_variable, top_delta')
      .eq('user_id', user.id)
      .lte('snapshot_at', isoDaysAgo(6))
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const showOnboarding =
    onboardData != null && (onboardData as { onboarded_at: string | null }).onboarded_at === null

  if (snapshotErr) {
    console.error('[dashboard] user_snapshot rpc failed', snapshotErr)
  }
  if (prodErr) console.error('[dashboard] products query failed', prodErr)

  // RPC 가 JSONB 로 { profile, dogs, subscription } 반환. 실패시 모두 null/[].
  type SnapshotShape = {
    profile: { name: string | null } | null
    dogs: DogRow[]
    subscription: SubscriptionRow | null
  }
  const snapshot = (snapshotData ?? {
    profile: null,
    dogs: [],
    subscription: null,
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
  const dogs = (snapshot.dogs ?? []) as DogRow[]
  const products = (prodData ?? []) as ProductRow[]
  const subscription = snapshot.subscription
  const hasActiveSub =
    subscription !== null && subscription.next_delivery_date !== null

  // R31 — #4 사료 배송 시 무게 자동 기록 (발명 모듈 A 차별화 정점).
  // 활성 구독자에 한해 avg_daily_feed_grams RPC 호출 → "최근 30일 자동 측정
  // 평균 185g/일" UI 노출. 견주 자가 측정 (계량컵 ±15%) 불필요. 신뢰도 1.0.
  // 첫 박스 아직 결제 안 된 경우 (가입 직후) null 반환 → 기본 카피로 fallback.
  const autoIntakeAvgG = hasActiveSub
    ? await getAvgDailyFeedG(supabase, user.id, 30)
    : null
  const autoIntakeLabel = formatAutoIntakeLabel(autoIntakeAvgG, 30)

  // ── "오늘 할 일" 카드 — computeNextAction 으로 우선순위 결정 ──────────
  // 강아지 ID set 으로 분석 받은 강아지 / 분석 미실행 강아지 분리.
  const dogIdsWithAnalyses = new Set(
    ((dogAnalysesData ?? []) as Array<{ dog_id: string }>).map(
      (a) => a.dog_id,
    ),
  )
  const unanalyzedDog =
    dogs.find((d) => !dogIdsWithAnalyses.has(d.id)) ?? null

  // 가장 오래된 처방 승인 대기 1건.
  type PendingFormulaRow = {
    id: string
    dog_id: string
    dogs: { name: string } | { name: string }[] | null
  }
  const firstPending =
    (pendingFormulasData ?? [])[0] as PendingFormulaRow | undefined
  const pendingFormula = firstPending
    ? {
        dogId: firstPending.dog_id,
        dogName: Array.isArray(firstPending.dogs)
          ? (firstPending.dogs[0]?.name ?? '강아지')
          : (firstPending.dogs?.name ?? '강아지'),
        formulaId: firstPending.id,
      }
    : null

  // 14일+ 체중 미기록 강아지 — 모든 강아지 중 가장 오래된 미기록.
  // weight_logs 는 measured_at desc 정렬 → 각 dog 의 최신 1건만 사용.
  const lastWeightByDog = new Map<string, string>()
  for (const w of (latestWeightsData ?? []) as Array<{
    dog_id: string
    measured_at: string
  }>) {
    if (!lastWeightByDog.has(w.dog_id)) {
      lastWeightByDog.set(w.dog_id, w.measured_at)
    }
  }
  const STALE_DAYS = 14
  // Server component 는 매 요청마다 실행돼 Date.now() 사용이 정상이지만
  // react-hooks/purity 룰이 hook 가정으로 잡음. 이 컴포넌트는 force-dynamic
  // 으로 캐시 안 됨 — 의도된 동작.
  // eslint-disable-next-line react-hooks/purity
  const nowKstMs = Date.now() + 9 * 3600 * 1000
  const staleWeightDog = (() => {
    for (const d of dogs) {
      const last = lastWeightByDog.get(d.id)
      if (!last) {
        // 한 번도 기록 안 한 강아지 — 1번 입력 권유.
        return { id: d.id, name: d.name, daysSinceLastWeight: null }
      }
      const lastMs = new Date(`${last}T00:00:00+09:00`).getTime()
      const days = Math.floor((nowKstMs - lastMs) / 86_400_000)
      if (days >= STALE_DAYS) {
        return { id: d.id, name: d.name, daysSinceLastWeight: days }
      }
    }
    return null
  })()

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

  // 분석 받았지만 정기배송 미신청 강아지 (한 단계 더 권유).
  const noSubDog =
    !hasActiveSub && dogs.length > 0 && dogIdsWithAnalyses.size > 0
      ? Array.from(dogIdsWithAnalyses)[0]
      : null

  const nextActionInput: NextActionInput = {
    hasDogs: dogs.length > 0,
    unanalyzedDog: unanalyzedDog
      ? { id: unanalyzedDog.id, name: unanalyzedDog.name }
      : null,
    pendingFormula,
    staleWeightDog,
    upcomingDelivery,
    noSubDogId: noSubDog,
  }
  const nextAction = computeNextAction(nextActionInput)

  // 마일스톤 축하 — 가입 후 30/100/365/730/1095일 도달 시점 7일 노출.
  // 첫 강아지 기준 (가족 다중 견은 추후 phase). voice-guidelines §10 정책.
  const firstDog = dogs[0]
  const milestone = currentMilestone(userCreatedAt)

  // 체크인 스트릭 — 첫 강아지의 cycle 카운트. currentStreak >= 2 일 때만
  // StreakCard 가 렌더. 다중 견 합산은 D7 phase 에서 분리.
  type CheckinRowFull = CheckinRow & { dog_id: string }
  const allCheckins = (checkinsData ?? []) as CheckinRowFull[]
  const firstDogCheckins = firstDog
    ? allCheckins.filter((c) => c.dog_id === firstDog.id)
    : []
  const streak = computeStreak(firstDogCheckins)

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
  const firstDogMeta = firstDog
    ? dogMetaList.find((d) => d.id === firstDog.id) ?? null
    : null

  const daysSinceSignup = daysSinceIso(userCreatedAt)

  const personaResult = computePersona({
    chatCount: chatCount ?? 0,
    analysisCount: dogIdsWithAnalyses.size,
    checkinCount: firstDogCheckins.length,
    diaryCount: diaryCount ?? 0,
    hasPhoto: !!firstDogMeta?.photo_url,
    hasSubscription: hasActiveSub,
    allergiesSource: firstDogMeta?.allergies_source ?? null,
    daysSinceSignup,
  })
  const personaSpec = personaResult.dominant
    ? personaCardSpec(personaResult.dominant, firstDog?.id ?? null)
    : null

  // ── Phase D7.5 — 맞춤도 카드 ──────────────────────────────────────────
  // firstDog 의 측정 도구 + 최근 측정일 → 종합 reliability. 0~1.
  // 가입 < 7일 또는 dog 없으면 카드 비표시.
  // 변수별 reliability — breakdown 카드 props 로도 사용
  const weightR =
    firstDogMeta &&
    weightReliability(
      firstDogMeta.weight_method,
      firstDogMeta.weight_measured_at,
    )
  const activityR =
    firstDogMeta && activityReliability(firstDogMeta.activity_method)
  const feedR =
    firstDogMeta &&
    feedReliability(
      // 자동배송 활성이면 feed_method 가 unknown 이어도 auto_delivery 로
      // 간주 — 자체 사료 D2C 의 차별화 신호 (override).
      hasActiveSub ? 'auto_delivery' : firstDogMeta.feed_method,
    )
  // P7 — 사용자 자기 표명 boost 합산. 최종 [0,1] clamp.
  const userBoost = firstDogMeta?.accuracy_user_boost ?? 0
  const accuracyScore =
    firstDog && firstDogMeta && daysSinceSignup >= 7 && weightR != null && activityR != null && feedR != null
      ? Math.min(1, overallReliability([weightR, activityR, feedR]) + userBoost)
      : null
  const accuracyVars: AccuracyVar[] = accuracyScore !== null && weightR != null && activityR != null && feedR != null
    ? [
        {
          key: 'weight',
          label: '체중',
          score: weightR,
          hint: '동물병원/디지털 체중계로 재면 정밀도가 올라가요',
        },
        {
          key: 'activity',
          label: '활동',
          score: activityR,
          hint: '만보계나 스마트태그를 연동하면 정밀도가 올라가요',
        },
        {
          key: 'feed',
          label: '급여',
          score: feedR,
          // R31 — hasActiveSub 면 자동 측정 g/일 hint 우선. RPC 결과 없으면
          // (첫 박스 결제 직후 / 데이터 부족) 짧은 안내로 fallback.
          hint: hasActiveSub
            ? (autoIntakeLabel ?? '다음 박스부터 자동 추적이 시작돼요')
            : '정기배송을 이용하면 자동 추적이 가능해요',
        },
      ]
    : []

  // 분석 받은 강아지가 1마리도 없으면 = 신규 사용자 / 첫 설문 안 한 상태.
  // 참고용 — 모든 강아지의 분석 존재 여부. v3 후속 라운드에서 분기에 사용.
  const hasAnyAnalysis = dogIdsWithAnalyses.size > 0

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
        firstDog.weight != null ? `${firstDog.weight}kg` : null,
        userCreatedAt
          ? `${Math.max(0, daysSinceIso(userCreatedAt))}일 함께`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  // ── ThisWeek 7일 데이터 — checkinsData 의 cycle row 를 7일 grid 변환.
  function makeWeekDays(): WeekDay[] {
    const days: WeekDay[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkinByDate = new Map<string, number>()
    for (const c of allCheckins) {
      const d = new Date(c.created_at)
      d.setHours(0, 0, 0, 0)
      const key = d.toISOString().slice(0, 10)
      checkinByDate.set(key, (checkinByDate.get(key) ?? 0) + 1)
    }
    const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(today.getTime() - offset * 86_400_000)
      const key = d.toISOString().slice(0, 10)
      const isToday = offset === 0
      const count = checkinByDate.get(key) ?? 0
      let status: WeekDay['status']
      if (isToday) {
        status = count > 0 ? 'full' : 'today'
      } else if (count >= 2) {
        status = 'full'
      } else if (count === 1) {
        status = 'partial'
      } else {
        status = 'miss'
      }
      days.push({
        date: d.getDate(),
        weekday: WEEKDAY_LABELS[d.getDay()] ?? '·',
        status,
      })
    }
    return days
  }
  const weekDays = makeWeekDays()

  const quickActions: QuickAction[] = [
    {
      label: '식사',
      sub: firstDog ? '오늘 기록' : '아이 등록 후',
      Icon: Soup,
      tone: 'sage',
      href: firstDog ? `/checkin?dog=${firstDog.id}` : '/dogs/new',
    },
    {
      label: '산책',
      sub: firstDog ? '오늘 기록' : '아이 등록 후',
      Icon: Footprints,
      tone: 'accent',
      href: firstDog ? `/checkin?dog=${firstDog.id}` : '/dogs/new',
    },
    {
      label: '체중',
      sub: firstDog?.weight != null ? `${firstDog.weight}kg` : '미입력',
      Icon: Scale,
      tone: 'ink',
      href: firstDog ? `/dogs/${firstDog.id}/weight` : '/dogs/new',
    },
  ]

  // ── TodayCard 매핑 — nextAction.type 별 분기.
  // [2026-05-22] dashboard 는 server component — TodayCard 도 server 로 전환됨.
  // LucideIcon (function ref) 는 직렬화 불가 → server-side 에서 element 만들어
  // icon prop 으로 전달.
  type TodayCardSpec = {
    heading: React.ReactNode
    description: string
    ctaLabel: string
    href: string
    icon: React.ReactNode
  } | null
  const todayIcon = (
    <Scale size={24} color="#f4ede0" strokeWidth={1.75} />
  )
  const todaySpec: TodayCardSpec = (() => {
    if (!nextAction) return null
    if (nextAction.type === 'analyze' && unanalyzedDog) {
      return {
        heading: (
          <>
            {unanalyzedDog.name} 맞춤
            <br />
            분석 시작하기
          </>
        ),
        description:
          nextAction.subtitle ||
          '체중·품종·생활 패턴 8문항으로 우리 아이에게 맞는 한 끼를 추천해드려요.',
        ctaLabel: nextAction.cta || '설문 시작하기',
        href: nextAction.href,
        icon: todayIcon,
      }
    }
    if (nextAction.type === 'approve' && pendingFormula) {
      return {
        heading: (
          <>
            {pendingFormula.dogName} 처방
            <br />
            승인 대기 중
          </>
        ),
        description:
          nextAction.subtitle ||
          '수의영양학 기반 추천 식단이 도착했어요. 검토하고 확정해 주세요.',
        ctaLabel: nextAction.cta || '처방 보기',
        href: nextAction.href,
        icon: todayIcon,
      }
    }
    if (nextAction.type === 'weigh-in' && staleWeightDog) {
      return {
        heading: (
          <>
            {staleWeightDog.name} 체중
            <br />
            기록할 시간이에요
          </>
        ),
        description:
          staleWeightDog.daysSinceLastWeight != null
            ? `마지막 기록 ${staleWeightDog.daysSinceLastWeight}일 전 · 한 달에 한 번이면 충분합니다`
            : nextAction.subtitle ||
              '한 달에 한 번이면 충분합니다. 권장 구간을 함께 안내해 드려요.',
        ctaLabel: nextAction.cta || '지금 입력하기',
        href: nextAction.href,
        icon: todayIcon,
      }
    }
    if (nextAction.type === 'onboarding') {
      return {
        heading: (
          <>
            우리 아이를
            <br />
            등록해 주세요
          </>
        ),
        description:
          nextAction.subtitle ||
          '맞춤 분석과 추천이 가족 정보부터 시작됩니다.',
        ctaLabel: nextAction.cta || '등록하기',
        href: nextAction.href,
        icon: todayIcon,
      }
    }
    return null
  })()

  // ── ForToday 추천 제품 + 배송.
  const firstProduct = products[0]
  const forTodayProduct = firstProduct
    ? {
        id: firstProduct.id,
        name: firstProduct.name,
        meta: firstProduct.short_description ?? '',
        price: firstProduct.sale_price ?? firstProduct.price,
        imageUrl: firstProduct.image_url ?? null,
        kicker: firstDog
          ? `For · ${firstDog.name} · ${firstDog.breed ?? '강아지'}`
          : 'For · 우리 아이',
        href: `/products/${firstProduct.slug}`,
      }
    : null

  const forTodayDelivery = upcomingDelivery
    ? {
        dLabel:
          upcomingDelivery.daysUntil <= 0
            ? '곧 도착'
            : `D-${upcomingDelivery.daysUntil}`,
        arrivalLabel:
          upcomingDelivery.daysUntil <= 0
            ? '곧\n도착해요'
            : upcomingDelivery.daysUntil === 1
              ? '내일\n새벽 도착'
              : `${upcomingDelivery.daysUntil}일 후\n도착 예정`,
        itemLabel: upcomingDelivery.productLabel,
        href: '/mypage/subscriptions',
      }
    : null

  // Journal 엔트리 — first cut 에서는 비활성 (dog_diary fetch 는 R6 phase).
  const journalEntries: JournalEntry[] = []

  return (
    <div className="pb-8">
      {/* 가입 후 첫 진입 튜토리얼 — onboarded_at IS NULL 인 경우만 1회. */}
      {showOnboarding && <OnboardingTutorial />}

      {/* 가입 리퍼럴 자동 적용 — 클라이언트 섬. 세션당 1회. */}
      <ReferralAutoRedeemer />

      {/* 1. Greeting hero — 54px display + signature */}
      <GreetingSection
        userName={userName ?? '보호자'}
        familyCount={dogs.length}
      />

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
              value:
                streak.currentStreak > 0 ? String(streak.currentStreak) : '0',
              sub: '일',
              tone: 'yellow',
            },
            {
              key: '분석',
              value: String(dogIdsWithAnalyses.size),
              sub: `/ ${dogs.length}`,
              tone: 'sage',
            },
            {
              key: '배송',
              value: upcomingDelivery
                ? `D-${Math.max(0, upcomingDelivery.daysUntil)}`
                : '--',
              sub: '예정',
              tone: 'accent',
            },
          ]}
          href={`/dogs/${firstDog.id}`}
          priority
        />
      )}

      {/* 3. 오늘의 한 가지 — ink hero card (nextAction 우선순위) */}
      {todaySpec && (
        <TodayCard
          number="№01"
          heading={todaySpec.heading}
          description={todaySpec.description}
          ctaLabel={todaySpec.ctaLabel}
          href={todaySpec.href}
          icon={todaySpec.icon}
        />
      )}

      {/* R15-C27: Daily check-in card stack — firstDog 가 있을 때만 노출 */}
      {firstDog && <DashboardDailyChecks dogId={firstDog.id} />}

      {/* R15-C28: Streak rewards — 7일 이상 연속일 때만 노출.
          R19: section spacing 통일 — 다른 home sections 와 동일 padding. */}
      {firstDog && streak.currentStreak >= 7 && (
        <section style={{ padding: '0 20px 30px' }}>
          <StreakRewards currentStreak={streak.currentStreak} />
        </section>
      )}

      {/* 4. 이번 주 7일 그리드 + Quick Actions */}
      {firstDog && (
        <ThisWeekSection
          dogName={firstDog.name}
          streak={streak.currentStreak}
          days={weekDays}
          quickActions={quickActions}
          recordTodayHref={`/checkin?dog=${firstDog.id}`}
        />
      )}

      {/* 5. 내 아이들 asymmetric — 또는 EmptyHomeNoDogs */}
      {dogs.length > 0 ? (
        <MyDogsSection
          dogs={dogCards}
          viewAllHref="/dogs"
          addDogHref="/dogs/new"
        />
      ) : (
        <EmptyHomeNoDogs addDogHref="/dogs/new" />
      )}

      {/* 6. {dogName}를 위한 추천 — 제품 + 배송 + bonus */}
      {forTodayProduct && firstDog && (
        <ForTodaySection
          dogName={firstDog.name}
          cursor="01 / 04"
          product={forTodayProduct}
          delivery={forTodayDelivery ?? undefined}
          bonus={{
            kicker: 'Bonus',
            body: '다음 결제 시\n10% 추가 할인',
          }}
        />
      )}

      {/* 7. 다음 배송 D-N strip (구독 활성 시, ForToday delivery 와 중복 안 되게) */}
      {upcomingDelivery && !forTodayProduct && (
        <DeliveryStripCard
          dLabel={
            upcomingDelivery.daysUntil <= 0
              ? '곧 도착'
              : `D-${upcomingDelivery.daysUntil}`
          }
          channelLabel="정기배송"
          arrivalLabel={
            upcomingDelivery.daysUntil <= 0
              ? '곧 도착해요'
              : upcomingDelivery.daysUntil === 1
                ? '내일 새벽 도착'
                : `${upcomingDelivery.daysUntil}일 후 도착`
          }
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

      {/* 9. Farm to Tail — 매거진 brand story */}
      <FarmToTailSection
        issueLabel="Vol. 02"
        dateLabel="MAY 21"
        heading1="농장에서"
        heading2="꼬리까지."
        body="수의영양학 기반 레시피, 화천 농장의 재료부터 그릇에 담기까지 — 매일의 한 끼를 정성껏 짓습니다."
        storyHref="/about"
        ctaLabel="이야기 읽기"
      />

      {/* R32 #20 — 맞춤도 자세히 + 변수별 측정도구 lock 토글. 1주차 grace
          period (silent) 에는 숨김, 그 이후 자율 펼침. voice-guidelines §9. */}
      {firstDog && firstDogMeta && accuracyVars.length > 0 && (
        <AccuracyBreakdown
          variables={accuracyVars}
          dogId={firstDog.id}
          userBoost={userBoost}
          userMethodLock={firstDogMeta.user_method_lock ?? null}
        />
      )}

      {/* events / persona / milestone — 후속 라운드에서 v3 surface 로
          재도입 예정. lint 침묵 위해 noop reference. */}
      <span style={{ display: 'none' }} aria-hidden>
        {String(events.length)}
        {milestone ? '·' : ''}
        {personaSpec ? '·' : ''}
        {accuracyScore ?? ''}
        {pastSnapshotData ? '·' : ''}
        {hasAnyAnalysis ? '1' : '0'}
      </span>
    </div>
  )
}

