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
  // 식품정보고시 / 사료관리법 표시 14개 항목 — 모두 nullable, 점진 입력.
  origin: string | null
  manufacturer: string | null
  manufacturer_address: string | null
  manufacture_date_policy: string | null
  shelf_life_days: number | null
  net_weight_g: number | null
  ingredients: string | null
  nutrition_facts: string | null // 텍스트 JSON 입력 — submit 시 parse
  allergens: string | null // 콤마 구분 입력 — submit 시 split
  storage_method: string | null
  feeding_guide: string | null
  pet_food_class: string | null
  certifications: string | null // 콤마 구분 — submit 시 split
  country_of_packaging: string | null
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
  origin: null,
  manufacturer: null,
  manufacturer_address: null,
  manufacture_date_policy: null,
  shelf_life_days: null,
  net_weight_g: null,
  ingredients: null,
  nutrition_facts: null,
  allergens: null,
  storage_method: null,
  feeding_guide: null,
  pet_food_class: '반려동물용 자가소비 사료',
  certifications: null,
  country_of_packaging: null,
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

    // 식품정보고시 textarea 들 → DB 형식 변환.
    // - allergens / certifications: 콤마 구분 → text[]
    // - nutrition_facts: 사용자 입력 JSON → JSONB. 파싱 실패 시 저장 안 함 (alert).
    const allergensArr = form.allergens
      ? form.allergens
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null
    const certificationsArr = form.certifications
      ? form.certifications
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null
    let nutritionParsed: unknown = null
    if (form.nutrition_facts && form.nutrition_facts.trim()) {
      try {
        nutritionParsed = JSON.parse(form.nutrition_facts)
      } catch {
        alert(
          '영양성분 JSON 형식이 올바르지 않아요. 예: {"protein_pct":35,"fat_pct":12}',
        )
        setLoading(false)
        return
      }
    }

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
      // 식품정보고시 14개 항목
      origin: form.origin?.trim() || null,
      manufacturer: form.manufacturer?.trim() || null,
      manufacturer_address: form.manufacturer_address?.trim() || null,
      manufacture_date_policy: form.manufacture_date_policy?.trim() || null,
      shelf_life_days: form.shelf_life_days,
      net_weight_g: form.net_weight_g,
      ingredients: form.ingredients?.trim() || null,
      nutrition_facts: nutritionParsed,
      allergens: allergensArr,
      storage_method: form.storage_method?.trim() || null,
      feeding_guide: form.feeding_guide?.trim() || null,
      pet_food_class: form.pet_food_class?.trim() || null,
      certifications: certificationsArr,
      country_of_packaging: form.country_of_packaging?.trim() || null,
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

        {/*
          식품정보고시 / 사료관리법 표시 14개 — 전자상거래법 §13 의무 항목.
          누락 시 공정위 시정명령 + 과태료 500만원. 각 상품마다 충실히 채워야
          PDP 의 "정보 준비 중" 라벨이 사라짐.
        */}
        <Section title="식품·사료 표시 정보 (필수)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="원산지">
              <input
                type="text"
                value={form.origin ?? ''}
                onChange={(e) => update('origin', e.target.value)}
                placeholder="예: 국내산 (전라남도 강진군)"
                className={inputClass}
              />
            </Field>
            <Field label="제조원 / 수입원">
              <input
                type="text"
                value={form.manufacturer ?? ''}
                onChange={(e) => update('manufacturer', e.target.value)}
                placeholder="예: (주)강진팜 / 수입원: ABC 무역"
                className={inputClass}
              />
            </Field>
            <Field label="제조원 소재지">
              <input
                type="text"
                value={form.manufacturer_address ?? ''}
                onChange={(e) => update('manufacturer_address', e.target.value)}
                placeholder="예: 전라남도 강진군 ..."
                className={inputClass}
              />
            </Field>
            <Field label="포장 국가 (수입품)">
              <input
                type="text"
                value={form.country_of_packaging ?? ''}
                onChange={(e) => update('country_of_packaging', e.target.value)}
                placeholder="예: 대한민국"
                className={inputClass}
              />
            </Field>
            <Field label="제조 정책">
              <input
                type="text"
                value={form.manufacture_date_policy ?? ''}
                onChange={(e) =>
                  update('manufacture_date_policy', e.target.value)
                }
                placeholder="예: 주문 후 7일 내 제조"
                className={inputClass}
              />
            </Field>
            <Field label="소비기한 (제조일 기준 일수)">
              <input
                type="number"
                min="0"
                value={form.shelf_life_days ?? ''}
                onChange={(e) =>
                  update(
                    'shelf_life_days',
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder="예: 90"
                className={inputClass}
              />
            </Field>
            <Field label="용량 (g)">
              <input
                type="number"
                min="0"
                value={form.net_weight_g ?? ''}
                onChange={(e) =>
                  update(
                    'net_weight_g',
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder="예: 200"
                className={inputClass}
              />
            </Field>
            <Field label="보관 방법">
              <input
                type="text"
                value={form.storage_method ?? ''}
                onChange={(e) => update('storage_method', e.target.value)}
                placeholder="예: 냉동 보관 · 해동 후 48h 내 급여"
                className={inputClass}
              />
            </Field>
            <Field label="품목 분류 (사료관리법)">
              <input
                type="text"
                value={form.pet_food_class ?? ''}
                onChange={(e) => update('pet_food_class', e.target.value)}
                placeholder="기본: 반려동물용 자가소비 사료"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="원재료명 (전체)">
            <textarea
              value={form.ingredients ?? ''}
              onChange={(e) => update('ingredients', e.target.value)}
              placeholder="예: 닭가슴살(국내산) 35%, 단호박 20%, 현미 ..."
              rows={3}
              className={inputClass}
            />
          </Field>

          <Field label="알레르기 유발성분 (콤마 구분)">
            <input
              type="text"
              value={form.allergens ?? ''}
              onChange={(e) => update('allergens', e.target.value)}
              placeholder="예: 닭, 계란, 유제품"
              className={inputClass}
            />
          </Field>

          <Field label="영양성분 JSON">
            <textarea
              value={form.nutrition_facts ?? ''}
              onChange={(e) => update('nutrition_facts', e.target.value)}
              placeholder={`{"protein_pct":35,"fat_pct":12,"fiber_pct":4,"ash_pct":2,"moisture_pct":12,"calories_kcal_per_100g":140,"calcium_pct":1.2,"phosphorus_pct":0.9}`}
              rows={3}
              className={inputClass}
              style={{ fontFamily: 'monospace' }}
            />
          </Field>

          <Field label="급여 가이드">
            <textarea
              value={form.feeding_guide ?? ''}
              onChange={(e) => update('feeding_guide', e.target.value)}
              placeholder="예: 체중 5kg 기준 1일 100g, 2회 분할 급여 권장"
              rows={3}
              className={inputClass}
            />
          </Field>

          <Field label="인증 / 검사 (콤마 구분)">
            <input
              type="text"
              value={form.certifications ?? ''}
              onChange={(e) => update('certifications', e.target.value)}
              placeholder="예: HACCP 인증, USDA Grade A, 자가품질검사 통과"
              className={inputClass}
            />
          </Field>
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