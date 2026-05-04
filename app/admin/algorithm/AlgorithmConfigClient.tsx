'use client'

import { useMemo, useState } from 'react'
import { Loader2, Check, AlertCircle, Save } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { FoodLineRow, ChronicRow } from './page'

const LINE_LABELS: Record<FoodLineRow['line'], string> = {
  basic: 'Basic · 닭 균형식',
  weight: 'Weight · 오리 체중관리',
  skin: 'Skin · 연어 피부털',
  premium: 'Premium · 소 활력근육',
  joint: 'Joint · 돼지 관절시니어',
}

export default function AlgorithmConfigClient({
  initialFoodLines,
  initialChronic,
}: {
  initialFoodLines: FoodLineRow[]
  initialChronic: ChronicRow[]
}) {
  const supabase = createClient()
  const toast = useToast()
  const [foodLines, setFoodLines] = useState(initialFoodLines)
  const [chronic, setChronic] = useState(initialChronic)
  const [savingLine, setSavingLine] = useState<string | null>(null)
  const [savingCond, setSavingCond] = useState<string | null>(null)
  const [tab, setTab] = useState<'lines' | 'chronic'>('lines')

  const saveLine = async (row: FoodLineRow) => {
    setSavingLine(row.line)
    try {
      const { error } = await supabase
        .from('algorithm_food_lines')
        .update({
          kcal_per_100g: row.kcal_per_100g,
          protein_pct_dm: row.protein_pct_dm,
          fat_pct_dm: row.fat_pct_dm,
          calcium_pct_dm: row.calcium_pct_dm,
          phosphorus_pct_dm: row.phosphorus_pct_dm,
          sodium_pct_dm: row.sodium_pct_dm,
          subtitle_override: row.subtitle_override,
          benefit_override: row.benefit_override,
        })
        .eq('line', row.line)
      if (error) throw error
      toast.success(`${LINE_LABELS[row.line]} 저장됨`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSavingLine(null)
    }
  }

  const saveCond = async (row: ChronicRow) => {
    setSavingCond(row.condition)
    try {
      const { error } = await supabase
        .from('algorithm_chronic_severity')
        .update({
          default_severity: row.default_severity,
          protein_factor: row.protein_factor,
          fat_factor: row.fat_factor,
          notes: row.notes,
        })
        .eq('condition', row.condition)
      if (error) throw error
      toast.success(`${row.korean_label} 저장됨`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSavingCond(null)
    }
  }

  return (
    <div>
      {/* Tab 전환 */}
      <div className="flex gap-2 mb-5 border-b border-rule">
        <TabBtn active={tab === 'lines'} onClick={() => setTab('lines')}>
          라인 영양 ({foodLines.length})
        </TabBtn>
        <TabBtn active={tab === 'chronic'} onClick={() => setTab('chronic')}>
          만성질환 강도 ({chronic.length})
        </TabBtn>
      </div>

      {tab === 'lines' && (
        <section className="space-y-4">
          <Note>
            영양 단면 (DM% / 100g 당 kcal) 은 batch 별 영양 분석 보고서 평균.
            칼슘·인·나트륨은 IRIS CKD 인 제한, 심장병 저나트륨 검증에 사용.
            저장 즉시 다음 cycle compute 부터 반영. 비워두면 알고리즘은
            lines.ts 의 hardcoded 기본값으로 fallback.
          </Note>
          {foodLines.map((row) => (
            <LineEditor
              key={row.line}
              row={row}
              saving={savingLine === row.line}
              onChange={(next) =>
                setFoodLines((prev) =>
                  prev.map((r) => (r.line === row.line ? next : r)),
                )
              }
              onSave={() => saveLine(row)}
            />
          ))}
        </section>
      )}

      {tab === 'chronic' && (
        <section className="space-y-3">
          <Note>
            보호자가 진단 강도 미입력 시 적용되는 default. mild → moderate →
            severe 순으로 처방 강도가 강해짐. protein_factor / fat_factor 는
            v1.5+ 룰 분기에 사용 (현재는 기록만, default_severity 만 사용).
          </Note>
          {chronic.map((row) => (
            <ChronicEditor
              key={row.condition}
              row={row}
              saving={savingCond === row.condition}
              onChange={(next) =>
                setChronic((prev) =>
                  prev.map((r) =>
                    r.condition === row.condition ? next : r,
                  ),
                )
              }
              onSave={() => saveCond(row)}
            />
          ))}
        </section>
      )}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-bold py-2 px-3 transition-colors"
      style={{
        color: active ? 'var(--terracotta)' : 'var(--muted)',
        borderBottom: active ? '2px solid var(--terracotta)' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-2 text-[11px] leading-relaxed"
      style={{
        background: 'var(--bg-2)',
        color: 'var(--muted)',
        padding: '10px 12px',
        borderRadius: 10,
        marginBottom: 8,
      }}
    >
      <AlertCircle size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  )
}

function LineEditor({
  row,
  saving,
  onChange,
  onSave,
}: {
  row: FoodLineRow
  saving: boolean
  onChange: (r: FoodLineRow) => void
  onSave: () => void
}) {
  // weighted info chip — fat 18% 면 "고지방", 8% 면 "저지방"
  const fatTier = useMemo(() => {
    if (row.fat_pct_dm < 10) return { label: '저지방', color: 'var(--moss)' }
    if (row.fat_pct_dm < 16) return { label: '중지방', color: 'var(--gold)' }
    return { label: '고지방', color: 'var(--terracotta)' }
  }, [row.fat_pct_dm])

  return (
    <div
      className="bg-white border border-rule rounded-2xl"
      style={{ padding: 16 }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-bold text-[13.5px]" style={{ color: 'var(--ink)' }}>
          {LINE_LABELS[row.line]}
        </h3>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            color: fatTier.color,
            background: `color-mix(in oklab, ${fatTier.color} 12%, white)`,
          }}
        >
          {fatTier.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <NumField
          label="kcal/100g"
          value={row.kcal_per_100g}
          step={1}
          min={50}
          max={500}
          onChange={(v) => onChange({ ...row, kcal_per_100g: v })}
        />
        <NumField
          label="단백질 % DM"
          value={row.protein_pct_dm}
          step={0.5}
          min={5}
          max={60}
          onChange={(v) => onChange({ ...row, protein_pct_dm: v })}
        />
        <NumField
          label="지방 % DM"
          value={row.fat_pct_dm}
          step={0.5}
          min={2}
          max={40}
          onChange={(v) => onChange({ ...row, fat_pct_dm: v })}
        />
        <NumField
          label="칼슘 % DM"
          value={row.calcium_pct_dm ?? 0}
          step={0.05}
          min={0.1}
          max={5}
          onChange={(v) => onChange({ ...row, calcium_pct_dm: v })}
          allowNull
          isNull={row.calcium_pct_dm === null}
          onNullToggle={() =>
            onChange({
              ...row,
              calcium_pct_dm: row.calcium_pct_dm === null ? 1.0 : null,
            })
          }
        />
        <NumField
          label="인 % DM"
          value={row.phosphorus_pct_dm ?? 0}
          step={0.05}
          min={0.1}
          max={4}
          onChange={(v) => onChange({ ...row, phosphorus_pct_dm: v })}
          allowNull
          isNull={row.phosphorus_pct_dm === null}
          onNullToggle={() =>
            onChange({
              ...row,
              phosphorus_pct_dm: row.phosphorus_pct_dm === null ? 0.8 : null,
            })
          }
        />
        <NumField
          label="나트륨 % DM"
          value={row.sodium_pct_dm ?? 0}
          step={0.01}
          min={0.01}
          max={2}
          onChange={(v) => onChange({ ...row, sodium_pct_dm: v })}
          allowNull
          isNull={row.sodium_pct_dm === null}
          onNullToggle={() =>
            onChange({
              ...row,
              sodium_pct_dm: row.sodium_pct_dm === null ? 0.3 : null,
            })
          }
        />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span
          className="text-[10px]"
          style={{ color: 'var(--muted)' }}
        >
          마지막 업데이트:{' '}
          {new Date(row.updated_at).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-transform active:scale-95"
          style={{
            background: 'var(--terracotta)',
            color: '#fff',
            fontSize: 11.5,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <Loader2 size={12} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <Save size={12} strokeWidth={2.4} />
          )}
          저장
        </button>
      </div>
    </div>
  )
}

function ChronicEditor({
  row,
  saving,
  onChange,
  onSave,
}: {
  row: ChronicRow
  saving: boolean
  onChange: (r: ChronicRow) => void
  onSave: () => void
}) {
  return (
    <div className="bg-white border border-rule rounded-2xl" style={{ padding: 14 }}>
      <div className="flex items-baseline justify-between mb-2.5">
        <h3 className="font-bold text-[13px]" style={{ color: 'var(--ink)' }}>
          {row.korean_label}
          <span
            className="ml-2 font-mono text-[10px] font-normal"
            style={{ color: 'var(--muted)' }}
          >
            {row.condition}
          </span>
        </h3>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold transition-transform active:scale-95"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            fontSize: 10.5,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <Loader2 size={11} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <Check size={11} strokeWidth={2.4} />
          )}
          저장
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        {(['mild', 'moderate', 'severe'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange({ ...row, default_severity: s })}
            className="text-[11px] font-bold py-1.5 rounded-lg transition-all"
            style={{
              background:
                row.default_severity === s
                  ? s === 'mild'
                    ? 'var(--moss)'
                    : s === 'moderate'
                      ? 'var(--gold)'
                      : 'var(--terracotta)'
                  : 'var(--bg-2)',
              color: row.default_severity === s ? '#fff' : 'var(--muted)',
            }}
          >
            {s === 'mild' ? '경증 mild' : s === 'moderate' ? '중등 moderate' : '중증 severe'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="protein factor"
          value={row.protein_factor}
          step={0.05}
          min={0.3}
          max={2.0}
          onChange={(v) => onChange({ ...row, protein_factor: v })}
        />
        <NumField
          label="fat factor"
          value={row.fat_factor}
          step={0.05}
          min={0.3}
          max={2.0}
          onChange={(v) => onChange({ ...row, fat_factor: v })}
        />
      </div>

      {row.notes && (
        <p
          className="text-[10.5px] mt-2 leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          {row.notes}
        </p>
      )}
    </div>
  )
}

function NumField({
  label,
  value,
  step,
  min,
  max,
  onChange,
  allowNull,
  isNull,
  onNullToggle,
}: {
  label: string
  value: number
  step: number
  min: number
  max: number
  onChange: (v: number) => void
  allowNull?: boolean
  isNull?: boolean
  onNullToggle?: () => void
}) {
  return (
    <label className="block">
      <div
        className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.06em] mb-1"
        style={{ color: 'var(--muted)' }}
      >
        <span>{label}</span>
        {allowNull && (
          <button
            type="button"
            onClick={onNullToggle}
            className="text-[9px] font-mono underline"
            style={{ color: isNull ? 'var(--terracotta)' : 'var(--muted)' }}
          >
            {isNull ? 'NULL' : '값 있음'}
          </button>
        )}
      </div>
      <input
        type="number"
        value={isNull ? '' : value}
        step={step}
        min={min}
        max={max}
        disabled={isNull}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border outline-none transition-colors font-mono text-[12.5px]"
        style={{
          padding: '7px 10px',
          background: isNull ? 'var(--bg-2)' : '#fff',
          borderColor: 'var(--rule)',
          color: isNull ? 'var(--muted)' : 'var(--ink)',
        }}
      />
    </label>
  )
}
