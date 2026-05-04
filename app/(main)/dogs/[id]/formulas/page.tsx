'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Loader2,
  Heart,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { FoodLine } from '@/lib/personalization/types'
import './formulas.css'

/**
 * /dogs/[id]/formulas — 강아지의 cycle 별 처방 히스토리 timeline.
 *
 * 가장 최근 cycle 위 → 첫 cycle 아래. 각 row 에 stacked bar + 핵심 reasoning
 * chip + cycle 적용 기간 + approval_status.
 *
 * # 데이터
 *   - dog_formulas (cycle_number desc) — 모든 cycle
 *   - 인접 cycle 비교는 inline (전 cycle 의 ratio 기억해 +X% 표시 가능하지만
 *     v1 은 단순 timeline)
 */

type FormulaRow = {
  id: string
  cycle_number: number
  approval_status: 'auto_applied' | 'pending_approval' | 'approved' | 'declined'
  formula: { lineRatios: Record<string, number>; toppers: { vegetable: number; protein: number } }
  reasoning: Array<{ chipLabel: string; ruleId: string }>
  daily_kcal: number
  daily_grams: number
  applied_from: string | null
  applied_until: string | null
  user_adjusted: boolean
  algorithm_version: string
  created_at: string
}

export default function FormulasHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const dogId = params.id as string

  const [loading, setLoading] = useState(true)
  const [dogName, setDogName] = useState('')
  const [rows, setRows] = useState<FormulaRow[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/dogs/${dogId}/formulas`)}`)
        return
      }
      const [{ data: dog }, { data: formulas }] = await Promise.all([
        supabase
          .from('dogs')
          .select('name')
          .eq('id', dogId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('dog_formulas')
          .select(
            'id, cycle_number, approval_status, formula, reasoning, ' +
              'daily_kcal, daily_grams, applied_from, applied_until, ' +
              'user_adjusted, algorithm_version, created_at',
          )
          .eq('dog_id', dogId)
          .eq('user_id', user.id)
          .order('cycle_number', { ascending: false }),
      ])
      if (cancelled) return
      if (!dog) {
        router.push('/dogs')
        return
      }
      setDogName((dog as { name: string }).name)
      setRows(((formulas ?? []) as unknown) as FormulaRow[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, router, supabase])

  if (loading) {
    return (
      <main className="fh-page">
        <div className="fh-state">
          <Loader2
            size={18}
            strokeWidth={2}
            color="var(--terracotta)"
            className="animate-spin"
          />
          박스 히스토리 불러오는 중...
        </div>
      </main>
    )
  }

  return (
    <main className="fh-page">
      <Link href={`/dogs/${dogId}`} className="fh-back">
        <ChevronLeft size={14} strokeWidth={2.2} />
        {dogName}이의 페이지
      </Link>

      <header className="fh-hero">
        <span className="fh-kicker">FORMULA HISTORY</span>
        <h1>
          {dogName}이의<br />
          박스 타임라인
        </h1>
        <p>
          매 cycle (보통 4주) 마다 알고리즘이 비율을 조정해요. 가장 최근부터
          순서대로 보여드려요.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="fh-empty">
          <p>아직 박스 기록이 없어요.</p>
          <Link href={`/dogs/${dogId}/analysis`} className="fh-empty-cta">
            첫 박스 추천 받기 →
          </Link>
        </div>
      ) : (
        <ol className="fh-timeline">
          {rows.map((row, i) => (
            <FormulaCard
              key={row.id}
              row={row}
              isLatest={i === 0}
              dogId={dogId}
            />
          ))}
        </ol>
      )}
    </main>
  )
}

function FormulaCard({
  row,
  isLatest,
  dogId,
}: {
  row: FormulaRow
  isLatest: boolean
  dogId: string
}) {
  const isPending = row.approval_status === 'pending_approval'
  const isDeclined = row.approval_status === 'declined'
  const dateRange = formatDateRange(row.applied_from, row.applied_until, row.created_at)

  return (
    <li
      className={
        'fh-card ' +
        (isPending ? 'fh-pending ' : '') +
        (isDeclined ? 'fh-declined ' : '') +
        (isLatest ? 'fh-latest ' : '')
      }
    >
      <div className="fh-marker">
        <span className="fh-marker-dot" />
        {!isLatest && <span className="fh-marker-line" />}
      </div>

      <div className="fh-body">
        <div className="fh-head">
          <div className="fh-head-left">
            <span className="fh-cycle-tag">CYCLE {row.cycle_number}</span>
            {isLatest && <span className="fh-tag fh-tag-latest">최신</span>}
            {row.user_adjusted && (
              <span className="fh-tag fh-tag-adjusted">직접 조정</span>
            )}
            {isPending && (
              <span className="fh-tag fh-tag-pending">동의 필요</span>
            )}
            {isDeclined && (
              <span className="fh-tag fh-tag-declined">유지됨</span>
            )}
          </div>
          <span className="fh-date">{dateRange}</span>
        </div>

        <MiniBar lineRatios={row.formula.lineRatios} />

        <div className="fh-legend">
          {ALL_LINES.filter((l) => row.formula.lineRatios[l] > 0)
            .sort(
              (a, b) => row.formula.lineRatios[b] - row.formula.lineRatios[a],
            )
            .map((line) => (
              <span key={line} className="fh-legend-item">
                <span
                  className="fh-legend-dot"
                  style={{ background: FOOD_LINE_META[line as FoodLine].color }}
                />
                <span className="fh-legend-name">
                  {FOOD_LINE_META[line as FoodLine].name}
                </span>
                <span className="fh-legend-pct">
                  {Math.round(row.formula.lineRatios[line] * 100)}%
                </span>
              </span>
            ))}
        </div>

        <div className="fh-meta">
          <span>
            <strong>{row.daily_kcal}</strong> kcal
          </span>
          <span className="fh-divider" />
          <span>
            <strong>{row.daily_grams}</strong>g/일
          </span>
          {(row.formula.toppers.vegetable > 0 ||
            row.formula.toppers.protein > 0) && (
            <>
              <span className="fh-divider" />
              <span>
                + 토퍼{' '}
                <strong>
                  {Math.round(
                    (row.formula.toppers.vegetable +
                      row.formula.toppers.protein) *
                      100,
                  )}
                  %
                </strong>
              </span>
            </>
          )}
        </div>

        {row.reasoning.length > 0 && (
          <div className="fh-chips">
            {row.reasoning.slice(0, 4).map((r, i) => (
              <span key={i} className="fh-chip">
                {r.chipLabel}
              </span>
            ))}
            {row.reasoning.length > 4 && (
              <span className="fh-chip fh-chip-more">
                +{row.reasoning.length - 4}
              </span>
            )}
          </div>
        )}

        {isPending && (
          <Link
            href={`/dogs/${dogId}/approve?cycle=${row.cycle_number}`}
            className="fh-cta"
          >
            <AlertCircle size={12} strokeWidth={2.4} />새 비율 확인하기
            <ArrowRight size={11} strokeWidth={2.4} />
          </Link>
        )}

        <div className="fh-foot">
          <span className="fh-version">{row.algorithm_version}</span>
          {row.approval_status === 'auto_applied' && (
            <span className="fh-status fh-status-auto">
              <Sparkles size={10} strokeWidth={2.2} />
              자동 적용
            </span>
          )}
          {row.approval_status === 'approved' && (
            <span className="fh-status fh-status-approved">
              <Check size={10} strokeWidth={2.6} />
              사용자 승인
            </span>
          )}
          {isDeclined && (
            <span className="fh-status fh-status-declined">
              <Heart size={10} strokeWidth={2.2} />
              이전 유지 선택
            </span>
          )}
        </div>
      </div>
    </li>
  )
}

function MiniBar({ lineRatios }: { lineRatios: Record<string, number> }) {
  return (
    <div className="fh-bar">
      {ALL_LINES.filter((l) => lineRatios[l] > 0).map((line) => (
        <i
          key={line}
          style={{
            width: `${Math.round(lineRatios[line] * 100)}%`,
            background: FOOD_LINE_META[line as FoodLine].color,
          }}
          title={`${FOOD_LINE_META[line as FoodLine].name} ${Math.round(
            lineRatios[line] * 100,
          )}%`}
        />
      ))}
    </div>
  )
}

function formatDateRange(
  from: string | null,
  until: string | null,
  fallback: string,
): string {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}.${d.getDate()}`
  }
  if (from && until) return `${fmt(from)} – ${fmt(until)}`
  if (from) return `${fmt(from)} ~`
  return fmt(fallback)
}
