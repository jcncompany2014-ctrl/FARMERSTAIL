'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  const [value, setValue] = useState(initialValue)
  const [editing, setEditing] = useState(false)

  async function save() {
    if (value === initialValue) {
      setEditing(false)
      return
    }
    if (value < 0) {
      alert('재고는 0 이상이어야 해요')
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
      alert('저장 실패: ' + error.message)
      setValue(initialValue)
      return
    }

    // 0 → >0 전이 — 재입고 알림 dispatch.
    // 실수로 0 을 건드린 게 아니라 실제 재고가 들어온 경우에만 의미가 있으므로
    // "0 → N" 만 트리거. value>0 → value>0 의 증감에는 반응하지 않는다.
    // fire-and-forget: 발송 결과는 토스트로만 확인하고 UI 를 막지 않는다.
    if (initialValue === 0 && value > 0) {
      fetch('/api/admin/restock/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, variantId: null }),
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json().catch(() => null)) as
            | { matched?: number; notified?: number }
            | null
          if (data?.matched && data.matched > 0) {
            // 관리자에게 간단 확인. 모달이나 정식 토스트를 붙이기 전까지 alert 로.
            alert(
              `재입고 알림을 ${data.notified ?? 0}/${data.matched}명에게 발송했어요.`,
            )
          }
        })
        .catch(() => {})
    }

    setEditing(false)
    startTransition(() => router.refresh())
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
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

  const color =
    initialValue === 0
      ? 'text-sale'
      : initialValue < 10
      ? 'text-terracotta'
      : 'text-ink'

  return (
    <button
      onClick={() => setEditing(true)}
      className={`w-full text-center text-sm font-semibold hover:bg-rule rounded px-2 py-1 transition ${color}`}
    >
      {initialValue}
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
      alert('저장 실패: ' + error.message)
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