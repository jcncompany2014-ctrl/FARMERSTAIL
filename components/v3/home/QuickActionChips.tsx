'use client'

/**
 * QuickActionChips — 홈 "이번 주" 아래 식사·산책·체중 빠른 기록 3칸.
 *
 * ThisWeekSection(서버 컴포넌트)에서 분리한 client island.
 * **세 칸 모두 = 페이지 이동 대신 그 자리에서 바텀시트를 띄운다**
 * (meal→QuickChipSheet, walk→QuickWalkSheet, weight→QuickWeightSheet). dogId 가 없을 때만 href Link 로 폴백.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 AppHome·T01): 회색 칸 + 위 6px 색 띠(식사 머스타드 · 산책 청록 ·
 *   체중 먹색 — 가운데 기록 메뉴의 색 띠와 같은 차례). 오늘 남겼으면 무엇을 남겼는지 보여 준다:
 *   식사 "✓ 잘 먹었어요" · 산책 "✓ 45분"(오늘 합) · 체중 "✓ 11.2kg"(오늘 잰 값). 안 남겼으면 "오늘 기록".
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { V3 } from '@/lib/design/tokens'
import { createClient } from '@/lib/supabase/client'
import { formatKg } from '@/lib/korean'
import QuickWeightSheet from '@/components/v3/sheet/QuickWeightSheet'
import QuickChipSheet, { type ChipOpt } from '@/components/v3/sheet/QuickChipSheet'
import QuickWalkSheet from '@/components/v3/sheet/QuickWalkSheet'

export type QuickActionKind = 'meal' | 'walk' | 'weight'

export interface QuickAction {
  kind: QuickActionKind
  /** 라벨 — 식사 / 산책 / 체중. */
  label: string
  /** 안 남겼을 때 보조 텍스트 — "오늘 기록" 등. */
  sub: string
  /** (옛 색 지정 — 새 디자인은 kind 별 띠 색을 쓴다) */
  tone?: 'sage' | 'accent' | 'ink' | 'yellow'
  /** 강아지가 없을 때(dogId 없음)의 이동 경로 — 보통 /dogs/new. */
  href?: string
}

/** 칸 위 색 띠 — 가운데 기록 메뉴(BottomTabBar)와 같은 차례·색. */
const BAND: Record<QuickActionKind, string> = {
  meal: V3.mustard,
  walk: '#2F8F8B',
  weight: '#2E3338',
}

// 식사 = 식욕 칩 (health_logs.appetite — 기존 폼 호환).
const APPETITE_OPTS: ChipOpt[] = [['good', '좋음'], ['normal', '보통'], ['low', '적음'], ['none', '거부']]
/** 오늘 남긴 식욕 → 칸에 보일 한마디. */
const APPETITE_DONE: Record<string, string> = {
  good: '잘 먹었어요',
  normal: '평소만큼 먹었어요',
  low: '조금 먹었어요',
  none: '안 먹었어요',
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

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

  // 오늘 남긴 것 — 마운트 시 조회, 저장하면 다시 조회(refresh 증가).
  const [meal, setMeal] = useState<string | null>(null)
  const [walkMin, setWalkMin] = useState<number | null>(null)
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!dogId) return
    let cancelled = false
    const supabase = createClient()
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    const dayStart = `${today}T00:00:00+09:00`
    void supabase
      .from('health_logs')
      .select('appetite, created_at')
      .eq('dog_id', dogId)
      .eq('logged_at', today)
      .not('appetite', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled || error) return
        const a = (data?.[0] as { appetite: string | null } | undefined)?.appetite
        if (a) setMeal(APPETITE_DONE[a] ?? '기록했어요')
      })
    void supabase
      .from('activity_logs')
      .select('duration_min')
      .eq('dog_id', dogId)
      .eq('activity_type', 'walk')
      .gte('occurred_at', dayStart)
      .then(({ data, error }) => {
        if (cancelled || error || !data || data.length === 0) return
        const sum = (data as { duration_min: number | null }[]).reduce((s, r) => s + (r.duration_min ?? 0), 0)
        setWalkMin(sum)
      })
    void supabase
      .from('weight_logs')
      .select('weight, measured_at')
      .eq('dog_id', dogId)
      .gte('measured_at', dayStart)
      .order('measured_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled || error) return
        const w = (data?.[0] as { weight: number | null } | undefined)?.weight
        if (w != null) setWeightKg(w)
      })
    return () => {
      cancelled = true
    }
  }, [dogId, refresh])

  function doneText(kind: QuickActionKind): string | null {
    if (kind === 'meal') return meal
    if (kind === 'walk') return walkMin != null && walkMin > 0 ? fmtMinutes(walkMin) : walkMin === 0 ? '기록했어요' : null
    return weightKg != null ? formatKg(weightKg) : null
  }

  function inner(a: QuickAction) {
    const done = doneText(a.kind)
    return (
      <>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{a.label}</span>
        {done ? (
          <span style={{ fontSize: 14, fontWeight: 700, color: V3.ink, whiteSpace: 'nowrap' }}>✓ {done}</span>
        ) : (
          <span style={{ fontSize: 14, color: V3.inkMute }}>{a.sub}</span>
        )}
      </>
    )
  }

  const cardStyle = (kind: QuickActionKind) =>
    ({
      height: 72,
      borderRadius: 4,
      border: 0,
      borderTop: `6px solid ${BAND[kind]}`,
      background: V3.soft,
      color: V3.ink,
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      cursor: 'pointer',
      textDecoration: 'none',
      padding: '0 4px',
      minWidth: 0,
    }) as const

  return (
    <>
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))`, gap: 8 }}>
        {actions.map((a) => {
          const openSheet =
            a.kind === 'weight' ? () => setWeightOpen(true) : a.kind === 'meal' ? () => setMealOpen(true) : () => setWalkOpen(true)
          if (dogId) {
            return (
              <button
                key={a.kind}
                type="button"
                onClick={openSheet}
                aria-label={`${a.label} 기록하기`}
                className="transition active:scale-[0.98]"
                style={cardStyle(a.kind)}
              >
                {inner(a)}
              </button>
            )
          }
          return a.href ? (
            <Link key={a.kind} href={a.href} className="transition active:scale-[0.98]" style={cardStyle(a.kind)}>
              {inner(a)}
            </Link>
          ) : (
            <div key={a.kind} style={cardStyle(a.kind)}>
              {inner(a)}
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
            onSaved={() => setRefresh((n) => n + 1)}
          />
          <QuickChipSheet
            open={mealOpen}
            onClose={() => setMealOpen(false)}
            dogId={dogId}
            column="appetite"
            title={`${dogName ? `${dogName} ` : ''}오늘 밥 어땠나요?`}
            hint="해당하는 것만 누르세요 · 1초면 끝나요"
            label="식욕"
            options={APPETITE_OPTS}
            onSaved={() => setRefresh((n) => n + 1)}
          />
          <QuickWalkSheet
            open={walkOpen}
            onClose={() => setWalkOpen(false)}
            dogId={dogId}
            dogName={dogName}
            onSaved={() => setRefresh((n) => n + 1)}
          />
        </>
      )}
    </>
  )
}
