'use client'

/**
 * QuickActionChips — 대시보드 "이번 주" 아래 식사·산책·체중 빠른 입력 칩.
 *
 * ThisWeekSection(서버 컴포넌트)에서 분리한 client island. 서버→client 직렬화
 * 제약상 lucide 아이콘 컴포넌트를 prop 으로 못 받으므로, kind(meal/walk/weight)
 * 만 받아 아이콘은 여기서 매핑한다.
 *
 * **식사·산책·체중 칩 모두 = 페이지 이동 대신 그 자리에서 바텀시트를 띄운다**
 * (meal→QuickChipSheet, walk→QuickWalkSheet, weight→QuickWeightSheet). dogId
 * 가 없을 때만 href Link(없으면 div)로 폴백.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Soup, Footprints, Scale, Check, type LucideIcon } from 'lucide-react'
import { V3, V3FontWeight, V3FontSize } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'
import { createClient } from '@/lib/supabase/client'
import QuickWeightSheet from '@/components/v3/sheet/QuickWeightSheet'
import QuickChipSheet, { type ChipOpt } from '@/components/v3/sheet/QuickChipSheet'
import QuickWalkSheet from '@/components/v3/sheet/QuickWalkSheet'

export type QuickActionKind = 'meal' | 'walk' | 'weight'

export interface QuickAction {
  kind: QuickActionKind
  /** 라벨 — 식사 / 산책 / 체중. */
  label: string
  /** 보조 텍스트 — "오늘 기록", "11kg" 등. */
  sub: string
  tone: 'sage' | 'accent' | 'ink' | 'yellow'
  /** 강아지가 없을 때(dogId 없음)의 이동 경로 — 보통 /dogs/new. dogId 가 있으면
   *  세 액션(식사·산책·체중) 모두 그 자리에서 시트를 열어 href 는 미사용(render 참조). */
  href?: string
}

const KIND_ICON: Record<QuickActionKind, LucideIcon> = {
  meal: Soup,
  walk: Footprints,
  weight: Scale,
}

const TONE_COLOR: Record<QuickAction['tone'], string> = {
  sage: V3.sage,
  accent: V3.accent,
  ink: V3.ink,
  yellow: V3.yellow,
}

const CARD_CLASS = 'ft-card-v3 transition active:scale-[0.98]'

// 식사=식욕 칩 (health_logs.appetite — 기존 폼 호환). 산책은 QuickWalkSheet.
const APPETITE_OPTS: ChipOpt[] = [['good', '좋음'], ['normal', '보통'], ['low', '적음'], ['none', '거부']]

export default function QuickActionChips({
  dogId,
  dogName,
  actions,
}: {
  dogId?: string
  dogName?: string
  actions: QuickAction[]
}) {
  const [weightOpen, setWeightOpen] = useState(false)
  const [mealOpen, setMealOpen] = useState(false)
  const [walkOpen, setWalkOpen] = useState(false)

  // 오늘 이미 기록했는지 — 마운트 시 조회 + 저장 시 낙관적 갱신.
  const [mealDone, setMealDone] = useState(false)
  const [walkDone, setWalkDone] = useState(false)
  const [weightDone, setWeightDone] = useState(false)

  useEffect(() => {
    if (!dogId) return
    let cancelled = false
    const supabase = createClient()
    const today = new Date(Date.now() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)
    const dayStart = `${today}T00:00:00+09:00`
    void supabase
      .from('health_logs')
      .select('id')
      .eq('dog_id', dogId)
      .eq('logged_at', today)
      .not('appetite', 'is', null)
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data && data.length > 0) setMealDone(true)
      })
    void supabase
      .from('activity_logs')
      .select('id')
      .eq('dog_id', dogId)
      .eq('activity_type', 'walk')
      .gte('occurred_at', dayStart)
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data && data.length > 0) setWalkDone(true)
      })
    void supabase
      .from('weight_logs')
      .select('id')
      .eq('dog_id', dogId)
      .gte('measured_at', dayStart)
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data && data.length > 0) setWeightDone(true)
      })
    return () => {
      cancelled = true
    }
  }, [dogId])

  const doneFor = (kind: QuickActionKind) =>
    kind === 'meal' ? mealDone : kind === 'walk' ? walkDone : weightDone

  function chipInner(a: QuickAction, isDone: boolean) {
    const Icon = KIND_ICON[a.kind]
    return (
      <div className="flex items-center" style={{ gap: 10 }}>
        <span
          className="flex items-center justify-center"
          style={{ width: 32, height: 32, background: V3.paper, borderRadius: 4 }}
        >
          <Icon size={18} color={TONE_COLOR[a.tone]} strokeWidth={1.75} />
        </span>
        <span className="flex flex-col items-start min-w-0">
          <Mono color="inkMute" size="xxs" weight={500}>
            {a.label}
          </Mono>
          <span
            className="ft-nowrap flex items-center"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.bold,
              fontSize: V3FontSize.base,
              color: isDone ? V3.sage : V3.ink,
              marginTop: 2,
              gap: 3,
            }}
          >
            {isDone && <Check size={12} color={V3.sage} strokeWidth={2.6} />}
            {isDone && a.kind !== 'weight' ? '기록함' : a.sub}
          </span>
        </span>
      </div>
    )
  }

  return (
    <>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${actions.length}, 1fr)`,
          gap: 8,
          marginTop: 10,
        }}
      >
        {actions.map((a) => {
          const isDone = doneFor(a.kind)
          // dogId 있으면 식사·산책·체중 모두 그 자리에서 시트. (없으면 href/Div 폴백.)
          const openSheet =
            a.kind === 'weight'
              ? () => setWeightOpen(true)
              : a.kind === 'meal'
                ? () => setMealOpen(true)
                : a.kind === 'walk'
                  ? () => setWalkOpen(true)
                  : null
          if (openSheet && dogId) {
            return (
              <button
                key={a.kind}
                type="button"
                onClick={openSheet}
                className={CARD_CLASS}
                style={{
                  padding: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  font: 'inherit',
                  color: 'inherit',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                }}
              >
                {chipInner(a, isDone)}
              </button>
            )
          }
          return a.href ? (
            <Link key={a.kind} href={a.href} className={CARD_CLASS} style={{ padding: 12 }}>
              {chipInner(a, isDone)}
            </Link>
          ) : (
            <div key={a.kind} className={CARD_CLASS} style={{ padding: 12 }}>
              {chipInner(a, isDone)}
            </div>
          )
        })}
      </div>

      {dogId && (
        <>
          <QuickWeightSheet
            open={weightOpen}
            onClose={() => setWeightOpen(false)}
            dogId={dogId}
            dogName={dogName}
            onSaved={() => setWeightDone(true)}
          />
          <QuickChipSheet
            open={mealOpen}
            onClose={() => setMealOpen(false)}
            dogId={dogId}
            column="appetite"
            title={`${dogName ? `${dogName} ` : ''}오늘 밥 어땠나요?`}
            hint="해당하는 것만 탭하세요 · 1초면 끝"
            options={APPETITE_OPTS}
            onSaved={() => setMealDone(true)}
          />
          <QuickWalkSheet
            open={walkOpen}
            onClose={() => setWalkOpen(false)}
            dogId={dogId}
            dogName={dogName}
            onSaved={() => setWalkDone(true)}
          />
        </>
      )}
    </>
  )
}
