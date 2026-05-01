'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Save, Trash2 } from 'lucide-react'

export type FeatureFlagRow = {
  key: string
  description: string | null
  enabled: boolean
  variants: Array<{ key: string; weight: number; payload?: unknown }>
  default_variant: string
  created_at: string
  updated_at: string
}

/**
 * Feature flags admin UI.
 *
 * 각 flag 카드:
 *   - on/off 토글
 *   - description / default_variant 인라인 편집
 *   - variants JSON textarea (가벼운 편집기. weight 합계 100 권장 안내)
 *   - 저장 / 삭제 버튼
 *
 * 신규 flag: 상단 "+" 카드. key + description 만 입력 후 insert. variants
 * 는 빈 배열로 시작 (boolean flag). 추후 편집.
 */
export default function FeatureFlagsClient({
  initialRows,
}: {
  initialRows: FeatureFlagRow[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [rows, setRows] = useState<FeatureFlagRow[]>(initialRows)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // 신규 flag form
  const [newKey, setNewKey] = useState('')
  const [newDescription, setNewDescription] = useState('')

  async function createFlag() {
    if (!/^[a-z0-9_]{3,40}$/.test(newKey)) {
      alert('키는 영소문자/숫자/_ 로 3~40자 이내')
      return
    }
    setSavingKey(newKey)
    const { error } = await supabase.from('feature_flags').insert({
      key: newKey,
      description: newDescription.trim() || null,
      enabled: false,
      variants: [],
      default_variant: 'control',
    })
    setSavingKey(null)
    if (error) {
      alert('생성 실패: ' + error.message)
      return
    }
    setNewKey('')
    setNewDescription('')
    router.refresh()
  }

  async function saveRow(row: FeatureFlagRow) {
    setSavingKey(row.key)
    const { error } = await supabase
      .from('feature_flags')
      .update({
        description: row.description,
        enabled: row.enabled,
        variants: row.variants,
        default_variant: row.default_variant,
      })
      .eq('key', row.key)
    setSavingKey(null)
    if (error) {
      alert('저장 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  async function deleteFlag(key: string) {
    if (!confirm(`flag '${key}' 를 삭제할까요?`)) return
    setSavingKey(key)
    const { error } = await supabase.from('feature_flags').delete().eq('key', key)
    setSavingKey(null)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  function patchRow(key: string, patch: Partial<FeatureFlagRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-4">
      {/* 신규 flag */}
      <section className="bg-white rounded-xl border border-rule p-5">
        <h2 className="text-[12px] font-bold text-muted uppercase tracking-widest mb-3">
          새 Flag 추가
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-text mb-1">
              key (snake_case)
            </label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toLowerCase())}
              placeholder="new_checkout_flow"
              className="w-full px-3 py-2 rounded-lg bg-bg border border-rule text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text mb-1">
              설명
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="신규 결제 흐름 A/B"
              className="w-full px-3 py-2 rounded-lg bg-bg border border-rule text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={createFlag}
          disabled={!newKey || savingKey === newKey}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink text-white text-[12px] font-bold disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          {savingKey === newKey ? '생성 중...' : 'Flag 추가'}
        </button>
      </section>

      {/* 기존 flags */}
      {rows.length === 0 ? (
        <section className="bg-white rounded-xl border border-rule p-8 text-center text-muted">
          아직 flag 가 없어요. 위에서 추가해 주세요.
        </section>
      ) : (
        rows.map((row) => (
          <FlagCard
            key={row.key}
            row={row}
            saving={savingKey === row.key}
            onSave={() => saveRow(row)}
            onDelete={() => deleteFlag(row.key)}
            onPatch={(p) => patchRow(row.key, p)}
          />
        ))
      )}

      <p className="text-[10.5px] text-muted leading-relaxed">
        flag 변경은 서버 캐시 60s 후 모든 사용자에게 반영. 즉시 테스트가 필요하면
        Vercel Functions 재시작 (deployment redeploy 또는 환경변수 trigger).
      </p>
    </div>
  )
}

function FlagCard({
  row,
  saving,
  onSave,
  onDelete,
  onPatch,
}: {
  row: FeatureFlagRow
  saving: boolean
  onSave: () => void
  onDelete: () => void
  onPatch: (patch: Partial<FeatureFlagRow>) => void
}) {
  // variants JSON 편집 — textarea 로 raw JSON 노출. 사용자가 직접 수정 후
  // blur 시 parse 시도. parse 실패 시 alert 후 원래 값 복원.
  const [variantsText, setVariantsText] = useState(() =>
    JSON.stringify(row.variants, null, 2),
  )
  const [variantsErr, setVariantsErr] = useState<string | null>(null)

  function applyVariants() {
    try {
      const parsed = JSON.parse(variantsText)
      if (!Array.isArray(parsed)) throw new Error('배열이어야 함')
      onPatch({ variants: parsed })
      setVariantsErr(null)
    } catch (e) {
      setVariantsErr(e instanceof Error ? e.message : '잘못된 JSON')
    }
  }

  const totalWeight = row.variants.reduce((s, v) => s + (v.weight ?? 0), 0)

  return (
    <section className="bg-white rounded-xl border border-rule overflow-hidden">
      <header className="px-5 py-4 border-b border-rule flex items-center gap-3">
        <code className="text-[14px] font-bold text-ink font-mono">
          {row.key}
        </code>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-md"
          style={{
            background: row.enabled ? 'var(--moss)' : 'var(--rule)',
            color: row.enabled ? 'white' : 'var(--muted)',
          }}
        >
          {row.enabled ? 'ON' : 'OFF'}
        </span>
        <button
          type="button"
          onClick={() => onPatch({ enabled: !row.enabled })}
          className="ml-auto text-[12px] font-bold underline underline-offset-2 text-terracotta"
        >
          {row.enabled ? '비활성화' : '활성화'}
        </button>
      </header>

      <div className="px-5 py-4 space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-text mb-1">
            설명
          </label>
          <input
            type="text"
            value={row.description ?? ''}
            onChange={(e) => onPatch({ description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-bg border border-rule text-sm"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-text mb-1">
            default variant
          </label>
          <input
            type="text"
            value={row.default_variant}
            onChange={(e) => onPatch({ default_variant: e.target.value })}
            placeholder="control"
            className="w-full px-3 py-2 rounded-lg bg-bg border border-rule text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-text mb-1">
            variants (JSON 배열)
          </label>
          <textarea
            value={variantsText}
            onChange={(e) => setVariantsText(e.target.value)}
            onBlur={applyVariants}
            rows={6}
            className="w-full px-3 py-2 rounded-lg bg-bg border border-rule text-[12px] font-mono"
            spellCheck={false}
          />
          {variantsErr && (
            <p className="text-[11px] text-sale font-bold mt-1">
              JSON 오류: {variantsErr}
            </p>
          )}
          {!variantsErr && row.variants.length > 0 && (
            <p className="text-[10.5px] text-muted mt-1">
              총 weight: {totalWeight}
              {totalWeight !== 100 &&
                ` (100 이 아니면 비례 정규화. ${row.variants.length}개 variant 자동 분배)`}
            </p>
          )}
        </div>
      </div>

      <footer className="px-5 py-3 border-t border-rule bg-bg-2/40 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink text-white text-[12px] font-bold disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" strokeWidth={2.5} />
          {saving ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11.5px] font-bold text-sale border border-sale/30 hover:border-sale transition disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" strokeWidth={2} />
          삭제
        </button>
      </footer>
    </section>
  )
}
