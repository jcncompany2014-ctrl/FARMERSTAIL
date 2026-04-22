'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ProductData = {
  id?: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  price: number
  sale_price: number | null
  image_url: string | null
  category: string | null
  stock: number
  is_subscribable: boolean
  is_active: boolean
  sort_order: number
}

const EMPTY: ProductData = {
  name: '',
  slug: '',
  description: '',
  short_description: '',
  price: 0,
  sale_price: null,
  image_url: '',
  category: '',
  stock: 0,
  is_subscribable: false,
  is_active: true,
  sort_order: 0,
}

const CATEGORIES = ['체험팩', '정기배송', '간식', '화식', '기타']

export default function ProductForm({
  mode,
  initialData,
}: {
  mode: 'create' | 'edit'
  initialData?: ProductData
}) {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState<ProductData>(initialData ?? EMPTY)
  const [loading, setLoading] = useState(false)

  function update<K extends keyof ProductData>(key: K, value: ProductData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim() || !form.slug.trim()) {
      alert('상품명과 slug는 필수에요')
      return
    }
    if (form.price <= 0) {
      alert('가격은 0보다 커야 해요')
      return
    }

    setLoading(true)

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description?.trim() || null,
      short_description: form.short_description?.trim() || null,
      price: form.price,
      sale_price: form.sale_price || null,
      image_url: form.image_url?.trim() || null,
      category: form.category?.trim() || null,
      stock: form.stock,
      is_subscribable: form.is_subscribable,
      is_active: form.is_active,
      sort_order: form.sort_order,
    }

    if (mode === 'create') {
      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select('id')
        .single()

      setLoading(false)
      if (error) {
        alert('등록 실패: ' + error.message)
        return
      }
      router.push(`/admin/products/${data.id}`)
      router.refresh()
    } else {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', form.id!)

      setLoading(false)
      if (error) {
        alert('저장 실패: ' + error.message)
        return
      }
      alert('저장했어요')
      router.refresh()
    }
  }

  async function handleDelete() {
    if (mode !== 'edit' || !form.id) return
    if (!confirm('정말 삭제할까요? 되돌릴 수 없어요.')) return

    setLoading(true)
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', form.id)
    setLoading(false)

    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    router.push('/admin/products')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      {/* 왼쪽: 기본 정보 */}
      <div className="col-span-2 space-y-4">
        <Section title="기본 정보">
          <Field label="상품명 *">
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputClass}
              placeholder="예: 닭고기 베이직 화식"
            />
          </Field>
          <Field label="Slug * (URL에 쓰임)">
            <input
              type="text"
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              className={`${inputClass} font-mono text-xs`}
              placeholder="chicken-basic"
            />
          </Field>
          <Field label="짧은 설명">
            <input
              type="text"
              value={form.short_description ?? ''}
              onChange={(e) => update('short_description', e.target.value)}
              className={inputClass}
              placeholder="한 줄 요약"
            />
          </Field>
          <Field label="상세 설명">
            <textarea
              value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value)}
              rows={6}
              className={`${inputClass} font-mono text-xs`}
              placeholder="상품 상세 설명 (마크다운 가능)"
            />
          </Field>
          <Field label="이미지 URL">
            <input
              type="text"
              value={form.image_url ?? ''}
              onChange={(e) => update('image_url', e.target.value)}
              className={`${inputClass} font-mono text-xs`}
              placeholder="https://..."
            />
          </Field>
          {form.image_url && (
            <div className="mt-2">
              <p className="text-[10px] text-muted mb-1">미리보기</p>
              <div className="w-32 h-32 rounded-lg bg-bg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_url}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* 오른쪽: 가격 / 재고 / 상태 */}
      <div className="col-span-1 space-y-4">
        <Section title="가격 & 재고">
          <Field label="정가 (원) *">
            <input
              type="number"
              value={form.price}
              onChange={(e) => update('price', Number(e.target.value))}
              className={inputClass}
              min={0}
            />
          </Field>
          <Field label="할인가 (원)">
            <input
              type="number"
              value={form.sale_price ?? ''}
              onChange={(e) =>
                update(
                  'sale_price',
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className={inputClass}
              placeholder="없으면 비우기"
              min={0}
            />
          </Field>
          <Field label="재고">
            <input
              type="number"
              value={form.stock}
              onChange={(e) => update('stock', Number(e.target.value))}
              className={inputClass}
              min={0}
            />
          </Field>
        </Section>

        <Section title="분류 & 상태">
          <Field label="카테고리">
            <select
              value={form.category ?? ''}
              onChange={(e) => update('category', e.target.value || null)}
              className={inputClass}
            >
              <option value="">선택 안 함</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="정렬 순서 (낮을수록 위)">
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => update('sort_order', Number(e.target.value))}
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="accent-terracotta w-4 h-4"
            />
            활성화 (판매 중)
          </label>

          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_subscribable}
              onChange={(e) => update('is_subscribable', e.target.checked)}
              className="accent-terracotta w-4 h-4"
            />
            정기배송 가능
          </label>
        </Section>

        <div className="space-y-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-terracotta text-white text-sm font-semibold hover:bg-[#8A3822] transition disabled:opacity-50"
          >
            {loading ? '저장 중...' : mode === 'create' ? '등록하기' : '저장하기'}
          </button>

          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="w-full py-3 rounded-full bg-white text-sale border border-sale/40 text-xs font-semibold hover:border-sale transition disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-bg text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="p-5 rounded-2xl bg-white border border-rule">
      <h2 className="text-sm font-bold text-ink mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-text mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}