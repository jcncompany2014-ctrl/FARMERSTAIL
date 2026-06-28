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
import { createClient } from '@/lib/supabase/server'
import OnboardingTutorial from '@/components/dashboard/OnboardingTutorial'
import { currentMilestone } from '@/lib/dashboard/milestones'
import { computeStreak, type CheckinRow } from '@/lib/dashboard/streaks'
import {
  computePersona,
  daysSinceIso,
  isoDaysAgo,
  personaCardSpec,
} from '@/lib/persona'
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
    { data: dogAnalysesData },
    { data: onboardData },
    { data: checkinsData },
    { data: dogMetaData },
    { count: chatCount },
    { count: diaryCount },
    { data: pastSnapshotData },
  ] = await Promise.all([
    supabase.rpc('dashboard_user_snapshot', { p_user_id: user.id }),
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
  const hasActiveSub =
    subscription !== null && subscription.next_delivery_date !== null

  // 강아지 ID set — ActiveDog 카드의 "분석 N/전체" 메트릭용.
  const dogIdsWithAnalyses = new Set(
    ((dogAnalysesData ?? []) as Array<{ dog_id: string }>).map(
      (a) => a.dog_id,
    ),
  )

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

  // [2026-06-11] 변수별 맞춤도(AccuracyBreakdown)는 홈에서 분리해 마이페이지
  // 전용 화면(/mypage/accuracy)으로 이동(사장님 지시 — 홈 시각 위계 정리).
  // 계산식은 동일하게 그 페이지에서 활성 강아지 기준으로 수행.

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
      sub: firstDog?.weight != null ? `${firstDog.weight}kg` : '미입력',
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
      {/* 가입 후 첫 진입 튜토리얼 — onboarded_at IS NULL 인 경우만 1회. */}
      {showOnboarding && <OnboardingTutorial />}

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
          dogId={firstDog.id}
          dogName={firstDog.name}
          streak={streak.currentStreak}
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

      {/* persona / milestone — 후속 라운드에서 v3 surface 로
          재도입 예정. lint 침묵 위해 noop reference. */}
      <span style={{ display: 'none' }} aria-hidden>
        {milestone ? '·' : ''}
        {personaSpec ? '·' : ''}
        {pastSnapshotData ? '·' : ''}
        {hasAnyAnalysis ? '1' : '0'}
      </span>
    </div>
  )
}

