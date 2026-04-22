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