import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Mono } from '@/components/v3'
import { V3, V3FontWeight, V3FontSize, V3Radius } from '@/lib/design/tokens'
import AccuracyBreakdown, {
  type AccuracyVar,
} from '@/components/dashboard/AccuracyBreakdown'
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
    <div style={{ paddingBottom: 32 }}>
      <section style={{ padding: '18px 20px 4px' }}>
        <Mono color="accent" size="xs" weight={600}>
          Accuracy
        </Mono>
        <p
          style={{
            fontSize: V3FontSize.base,
            lineHeight: 1.55,
            color: V3.inkMute,
            marginTop: 8,
          }}
        >
          체중·활동·급여를 어떻게 측정했는지에 따라 맞춤 분석의 정밀도가
          달라져요. 약한 항목의 측정 도구를 바꾸면 더 정확한 추천을 받을 수
          있어요.
        </p>
      </section>

      {accuracyVars.length > 0 && dogMeta ? (
        <AccuracyBreakdown
          variables={accuracyVars}
          dogId={activeDog?.id ?? null}
          userBoost={userBoost}
          userMethodLock={dogMeta.user_method_lock ?? null}
          defaultOpen
        />
      ) : (
        <section style={{ padding: '20px 20px 0' }}>
          <div
            className="text-center"
            style={{
              borderRadius: V3Radius.sm,
              border: `1.5px dashed ${V3.rule}`,
              padding: '40px 24px',
              background: V3.paperHi,
            }}
          >
            <div
              className="mx-auto flex items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                marginBottom: 14,
              }}
            >
              <Sparkles size={22} color={V3.accent} strokeWidth={1.5} />
            </div>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: V3FontSize.md,
                color: V3.ink,
                letterSpacing: '-0.02em',
              }}
            >
              아직 보여드릴 맞춤도가 없어요
            </h3>
            <p
              style={{
                fontSize: V3FontSize.sm,
                color: V3.inkMute,
                marginTop: 8,
                lineHeight: 1.55,
              }}
            >
              우리 아이를 등록하고 맞춤 분석을 한 번 받으면
              변수별 정밀도를 여기서 확인할 수 있어요
            </p>
            <Link
              href={activeDog ? `/dogs/${activeDog.id}/survey` : '/dogs/new'}
              className="inline-flex items-center active:scale-[0.98] transition"
              style={{
                marginTop: 20,
                gap: 6,
                padding: '12px 22px',
                fontSize: V3FontSize.sm,
                fontWeight: V3FontWeight.bold,
                borderRadius: V3Radius.pill,
                background: V3.ink,
                color: V3.paperHi,
                textDecoration: 'none',
              }}
            >
              {activeDog ? '분석 시작하기' : '우리 아이 등록하기'}
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
