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
import { snapBoxRatios } from '@/lib/personalization/boxComposition'
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
            <span className="fh-cycle-tag">{row.cycle_number}번째 박스</span>
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

        {/* ★박스로 스냅해서 그린다(2026-08-03, 사장님: "왜 또 네개 조합이야").
            이 화면은 제목이 "맞춤 박스 구성"이고 "배송은 2주마다 받고" 라고
            말하는데, **원시 임상 비율**을 그대로 그리고 있었다 — 오리50·한우30·
            치킨10·흑돼지10 처럼 4종이 뜬다. 실제로 담기는 박스는 최대 2종이다
            (boxComposition: 1종 100% / 2종 50:50, 2위가 20% 미만이면 1종).
            분석 카드(AnalysisView)와 플랜(PlanClient)은 이미 snapBoxLines 로
            스냅하는데 여기만 안 했다 — 같은 강아지인데 화면마다 박스가 달라 보였고,
            고객은 4종을 보고 2종을 받는다.
            원시 비율은 "왜 이 단백질인가"의 근거일 뿐 배송·표시용이 아니다
            (boxComposition.ts 첫 문단). 근거는 아래 reasoning 칩이 이미 보여준다. */}
        <MiniBar lineRatios={snapBoxRatios(row.formula.lineRatios as Record<FoodLine, number>)} />

        <div className="fh-legend">
          {(() => {
            const boxRatios = snapBoxRatios(
              row.formula.lineRatios as Record<FoodLine, number>,
            )
            return ALL_LINES.filter((l) => (boxRatios[l] ?? 0) > 0)
              .sort((a, b) => (boxRatios[b] ?? 0) - (boxRatios[a] ?? 0))
            .map((line) => (
              <span key={line} className="fh-legend-item">
                <span
                  className="fh-legend-dot"
                  style={{ background: FOOD_LINE_META[line as FoodLine].color }}
                />
                <span className="fh-legend-name">
                  {FOOD_LINE_META[line as FoodLine].nameKo}
                </span>
                <span className="fh-legend-pct">
                  {Math.round((boxRatios[line] ?? 0) * 100)}%
                </span>
              </span>
            ))
          })()}
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
          title={`${FOOD_LINE_META[line as FoodLine].nameKo} ${Math.round(
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
  // KST 기준 M.D. 서버는 UTC 라 raw getMonth/getDate 는 시간 성분 있는 값
  // (created_at 폴백)에서 하루 틀렸다 — 특히 progression 크론이 KST 05시(UTC 전날
  // 20시)에 만든 pending 처방의 created_at 이 전날로 표시됐다. +9h 시프트 후 UTC
  // 파트 읽기(datetime-kst 의 currentKstHour 와 같은 패턴). date-only 는 불변.
  const fmt = (iso: string) => {
    const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    return `${kst.getUTCMonth() + 1}.${kst.getUTCDate()}`
  }
  if (from && until) return `${fmt(from)} – ${fmt(until)}`
  if (from) return `${fmt(from)} ~`
  return fmt(fallback)
}
