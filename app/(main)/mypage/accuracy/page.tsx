import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Sprout } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { onboardingPhase } from '@/lib/onboarding/grace-period'
import { petName } from '@/lib/korean'
import { V3 } from '@/lib/design/tokens'
import AccuracyBreakdown, {
  type AccuracyVar,
} from '@/components/dashboard/AccuracyBreakdown'
import AccuracyIntro from './AccuracyIntro'
import {
  feedReliability,
  activityReliability,
  weightReliability,
} from '@/lib/personalization/reliability'
import {
  getAvgDailyFeedG,
  formatAutoIntakeLabel,
} from '@/lib/feeding/auto-intake'
import type { Json } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '분석 맞춤도',
  robots: { index: false, follow: false },
}

/**
 * /mypage/accuracy — 변수별 분석 맞춤도.
 *
 * 이전엔 홈(대시보드) 맨 아래에 "변수별 맞춤도 자세히" 접이식으로 있었으나,
 * 홈의 시각 위계를 정리하면서 마이페이지 전용 화면으로 이동(사장님 지시).
 * 활성 강아지(헤더 칩에서 고른 아이, 쿠키) 기준으로 체중·활동·급여 측정의
 * 정밀도를 보여준다. 계산식은 대시보드와 동일(lib/personalization/reliability).
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 캔버스 A14): 머리는 AccuracyIntro, 맞춤도 카드는 AccuracyBreakdown(머스타드 도장
 * 그림자 카드). 첫 주·빈 상태 카드도 같은 결(회색 면·점선 테두리)로. 조회·계산은 그대로.
 */
type DogRow = { id: string; name: string }
type SnapshotShape = {
  profile: { name: string | null } | null
  dogs: DogRow[]
  subscription: { next_delivery_date: string | null } | null
}
type DogMetaRow = {
  id: string
  weight_method: string | null
  activity_method: string | null
  feed_method: string | null
  weight_measured_at: string | null
  accuracy_user_boost: number | null
  user_method_lock: Json | null
}

export default async function AccuracyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/accuracy')

  const [{ data: snapshotData }, { data: dogMetaData }] = await Promise.all([
    supabase.rpc('dashboard_user_snapshot', { p_user_id: user.id }),
    supabase
      .from('dogs')
      .select(
        'id, weight_method, activity_method, feed_method, weight_measured_at, accuracy_user_boost, user_method_lock',
      )
      .eq('user_id', user.id),
  ])

  const snapshot = (snapshotData ?? {
    profile: null,
    dogs: [],
    subscription: null,
  }) as SnapshotShape
  const dogs = (snapshot.dogs ?? []) as DogRow[]
  const subscription = snapshot.subscription
  const hasActiveSub =
    subscription !== null && subscription.next_delivery_date !== null

  // 활성 강아지(헤더 칩 선택, 쿠키) 우선 — 없으면 첫째.
  const cookieStore = await cookies()
  const activeId = cookieStore.get('ft_active_dog')?.value ?? null
  const activeDog = dogs.find((d) => d.id === activeId) ?? dogs[0] ?? null

  // 첫 4주 보호(grace period, lib/onboarding/grace-period) — 1주차(silent)엔 정밀도
  // 노출 보류. 신규 이탈방어(첫 4주 이탈 60%): 시스템 정확도보다 안심감 우선.
  // 앵커=가입 경과일(user.created_at). [[project-legacy-sweep]] [[project_recipe_v31]]
  const inSilentGrace = onboardingPhase(user.created_at) === 'silent'
  const graceDogName = activeDog ? petName(activeDog.name) : null

  const dogMetaList = (dogMetaData ?? []) as DogMetaRow[]
  const dogMeta = activeDog
    ? dogMetaList.find((m) => m.id === activeDog.id) ?? null
    : null

  // 급여 신뢰도: 활성 구독자는 자동 측정(auto_delivery)으로 간주 — 발명 차별화.
  const autoIntakeAvgG = hasActiveSub
    ? await getAvgDailyFeedG(supabase, user.id, 30)
    : null
  const autoIntakeLabel = formatAutoIntakeLabel(autoIntakeAvgG, 30)

  const weightR = dogMeta
    ? weightReliability(dogMeta.weight_method, dogMeta.weight_measured_at)
    : null
  const activityR = dogMeta
    ? activityReliability(dogMeta.activity_method)
    : null
  const feedR = dogMeta
    ? feedReliability(hasActiveSub ? 'auto_delivery' : dogMeta.feed_method)
    : null
  const userBoost = dogMeta?.accuracy_user_boost ?? 0

  const accuracyVars: AccuracyVar[] =
    dogMeta && weightR != null && activityR != null && feedR != null
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
            hint: hasActiveSub
              ? (autoIntakeLabel ?? '다음 박스부터 자동 추적이 시작돼요')
              : '정기배송을 이용하면 자동 추적이 가능해요',
          },
        ]
      : []

  return (
    // 줄 높이는 시안과 같은 기본값(normal).
    <div style={{ paddingBottom: 28, color: V3.ink, lineHeight: 'normal' }}>
      <AccuracyIntro silent={inSilentGrace} />

      {inSilentGrace ? (
        <section
          style={{
            margin: '22px 20px 0',
            padding: '36px 22px',
            borderRadius: 4,
            background: V3.soft,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sprout size={24} color={V3.ink} strokeWidth={2} />
          </span>
          <h2 style={{ margin: '16px 0 0', fontSize: 24, lineHeight: 1.2 }}>첫 주는 천천히, 편하게</h2>
          <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
            {graceDogName ? `${graceDogName}의 ` : ''}맞춤 데이터가 조금 쌓이면 변수별 정밀도를 여기서 보여드릴게요. 첫
            주는 부담 없이 둘러보세요.
          </p>
        </section>
      ) : accuracyVars.length > 0 && dogMeta ? (
        <AccuracyBreakdown
          variables={accuracyVars}
          dogId={activeDog?.id ?? null}
          userBoost={userBoost}
          userMethodLock={dogMeta.user_method_lock ?? null}
          defaultOpen
        />
      ) : (
        <section
          style={{
            margin: '22px 20px 0',
            padding: '36px 22px 28px',
            border: `1.5px dashed ${V3.inkFaint}`,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: V3.soft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={24} color={V3.ink} strokeWidth={2} />
          </span>
          <h2 style={{ margin: '16px 0 0', fontSize: 24, lineHeight: 1.2 }}>아직 보여드릴 맞춤도가 없어요</h2>
          <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
            우리 아이를 등록하고 맞춤 분석을 한 번 받으면 변수별 정밀도를 여기서 확인할 수 있어요
          </p>
          <Link
            href={activeDog ? `/dogs/${activeDog.id}/survey` : '/dogs/new'}
            className="transition active:scale-[0.98]"
            style={{
              marginTop: 22,
              alignSelf: 'stretch',
              height: 56,
              borderRadius: 4,
              background: V3.ink,
              color: '#FFFFFF',
              fontSize: 17,
              fontWeight: 800,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeDog ? '분석 시작하기' : '우리 아이 등록하기'}
          </Link>
        </section>
      )}
    </div>
  )
}
