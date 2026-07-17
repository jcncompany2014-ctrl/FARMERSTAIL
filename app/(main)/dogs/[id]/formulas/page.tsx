// audit #101 — /dogs/[id]/formulas server component. interactivity 0 (timeline
// read-only). 이전 client 버전은 loading spinner + useEffect 한 번 후 render.
// 이제 server fetch + 즉시 페인트.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Heart,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { petName } from '@/lib/korean'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { FoodLine } from '@/lib/personalization/types'
import './formulas.css'

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

export default async function FormulasHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dogs/${dogId}/formulas`)}`)
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

  if (!dog) {
    redirect('/dogs')
  }

  const dogName = (dog as { name: string }).name
  const rows = ((formulas ?? []) as unknown) as FormulaRow[]

  return (
    <div className="fh-page">
      <header className="fh-hero">
        <span className="fh-kicker">MY BOX · 맞춤 박스</span>
        <h1>
          {petName(dogName)}의<br />
          맞춤 박스 구성
        </h1>
        <p>
          분석 결과로 만든 우리 아이 전용 레시피예요. 배송은 2주마다 받고,
          체크인 기록이 쌓이면 알고리즘이 비율을 다듬어 다음 박스에 반영해요.
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
    </div>
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
          {ALL_LINES.filter((l) => (row.formula.lineRatios[l] ?? 0) > 0)
            .sort(
              (a, b) => (row.formula.lineRatios[b] ?? 0) - (row.formula.lineRatios[a] ?? 0),
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
                  {Math.round((row.formula.lineRatios[line] ?? 0) * 100)}%
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
      {ALL_LINES.filter((l) => (lineRatios[l] ?? 0) > 0).map((line) => (
        <i
          key={line}
          style={{
            width: `${Math.round((lineRatios[line] ?? 0) * 100)}%`,
            background: FOOD_LINE_META[line as FoodLine].color,
          }}
          title={`${FOOD_LINE_META[line as FoodLine].name} ${Math.round(
            (lineRatios[line] ?? 0) * 100,
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
