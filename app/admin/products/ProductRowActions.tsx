'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import NumberInput from '@/components/admin/NumberInput'

type Props =
  | {
      productId: string
      field: 'stock'
      initialValue: number
    }
  | {
      productId: string
      field: 'is_active'
      initialValue: boolean
    }

export default function ProductRowActions(props: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  if (props.field === 'stock') {
    return <StockEditor {...props} loading={loading} setLoading={setLoading} startTransition={startTransition} router={router} supabase={supabase} />
  }
  return <ActiveToggle {...props} loading={loading} setLoading={setLoading} startTransition={startTransition} router={router} supabase={supabase} />
}

type SharedProps = {
  productId: string
  loading: boolean
  setLoading: (b: boolean) => void
  startTransition: (fn: () => void) => void
  router: ReturnType<typeof useRouter>
  supabase: ReturnType<typeof createClient>
}

function StockEditor({
  productId,
  initialValue,
  loading,
  setLoading,
  startTransition,
  router,
  supabase,
}: SharedProps & { initialValue: number }) {
  const toast = useToast()
  const [value, setValue] = useState(initialValue)
  const [editing, setEditing] = useState(false)

  async function save() {
    if (value === initialValue) {
      setEditing(false)
      return
    }
    if (value < 0) {
      toast.error('재고는 0 이상이어야 해요')
      setValue(initialValue)
      return
    }

    setLoading(true)
    const { error } = await supabase
      .from('products')
      .update({ stock: value })
      .eq('id', productId)
    setLoading(false)

    if (error) {
      toast.error('저장 실패: ' + error.message)
      setValue(initialValue)
      return
    }

    setEditing(false)
    startTransition(() => router.refresh())
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1">
        {/* NumberInput 사용 — 예전 raw <input> 은 칸을 비우면 Number('')=0 이라
            0 이 박혀 지워지지 않았다(2026-07-26 사장님 제보). */}
        <NumberInput
          value={value}
          onChange={(v) => setValue(v ?? 0)}
          emptyAs={0}
          min={0}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') {
              setValue(initialValue)
              setEditing(false)
            }
          }}
          autoFocus
          disabled={loading}
          className="w-16 px-2 py-1 text-center text-xs rounded border border-terracotta focus:outline-none"
        />
      </div>
    )
  }

  // 계획 A-F3 — 빠른 조정. 조리 후 재고 보충이 잦은데 매번 클릭→타이핑→저장은
  // 번거롭다. 델타 버튼은 현재 값 기준으로 즉시 저장(0 미만은 0으로 클램프).
  async function bump(delta: number) {
    const next = Math.max(0, initialValue + delta)
    if (next === initialValue) return
    // ±10 은 오탭했을 때 되돌리기가 번거롭다(다시 정확히 -10 을 눌러야 한다).
    // ±1 은 확인 없이 — 확인을 다 붙이면 빠른 조정의 의미가 사라진다.
    if (Math.abs(delta) >= 10) {
      if (!confirm(`재고를 ${initialValue} → ${next} 로 바꿀까요?`)) return
    }
    setLoading(true)
    const { error } = await supabase
      .from('products')
      .update({ stock: next })
      .eq('id', productId)
    setLoading(false)
    if (error) {
      toast.error('재고 변경 실패: ' + error.message)
      return
    }
    toast.success(`재고 ${initialValue} → ${next}`)
    startTransition(() => router.refresh())
  }

  const color =
    initialValue === 0
      ? 'text-sale'
      : initialValue < 10
      ? 'text-terracotta'
      : 'text-zinc-900'

  return (
    <div className="group flex items-center justify-center gap-0.5">
      <QuickBump label="−10" onClick={() => bump(-10)} disabled={loading} />
      <QuickBump label="−1" onClick={() => bump(-1)} disabled={loading} />
      <button
        onClick={() => setEditing(true)}
        disabled={loading}
        title="클릭해서 직접 입력"
        className={`inline-flex items-center justify-center min-w-[2.5rem] min-h-[36px] text-sm font-semibold hover:bg-zinc-100 rounded px-2 transition ${color}`}
      >
        {initialValue}
      </button>
      <QuickBump label="+1" onClick={() => bump(1)} disabled={loading} />
      <QuickBump label="+10" onClick={() => bump(10)} disabled={loading} />
    </div>
  )
}

/**
 * 재고 델타 버튼.
 *
 * # 왜 hover 의존을 뺐나 (2026-08-07 어드민 감사)
 * 평소 `text-zinc-300`, 행 hover 시에만 `group-hover:text-zinc-500` 로 또렷해지는
 * 구조였다. 그런데 **폰에는 hover 가 없다** — 이 어드민은 폰 운영용으로 만든
 * 것이고(드로어화), 폰에서는 이 버튼들이 끝까지 흐린 채였다. 크기도
 * px-1.5 py-1 = 약 22×24px 라 손가락으로 정확히 누르기 어려웠다.
 *
 * 44px 는 표가 너무 시끄러워지므로 36px 로 타협하고(표 행 안의 보조 액션),
 * 색은 항상 읽히는 zinc-500 으로 고정한다.
 */
function QuickBump({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`재고 ${label}`}
      className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] rounded text-[12px] font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 disabled:opacity-40"
    >
      {label}
    </button>
  )
}

function ActiveToggle({
  productId,
  initialValue,
  loading,
  setLoading,
  startTransition,
  router,
  supabase,
}: SharedProps & { initialValue: boolean }) {
  const toast = useToast()
  const [active, setActive] = useState(initialValue)

  async function toggle() {
    const next = !active
    setLoading(true)
    setActive(next)

    const { error } = await supabase
      .from('products')
      .update({ is_active: next })
      .eq('id', productId)

    setLoading(false)

    if (error) {
      toast.error('저장 실패: ' + error.message)
      setActive(!next)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex justify-center">
      <button
        onClick={toggle}
        disabled={loading}
        className={`relative w-10 h-6 rounded-full transition ${
          active ? 'bg-moss' : 'bg-rule'
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
            active ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}