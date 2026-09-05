'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import NumberInput from '@/components/admin/NumberInput'

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
  /** own=자사몰 구독(화식) / external=외부 채널(스마트스토어·쿠팡). 2026-07-19. */
  sales_channel: 'own' | 'external'
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
  sales_channel: 'external',
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
  const toast = useToast()

  const [form, setForm] = useState<ProductData>(initialData ?? EMPTY)
  const [loading, setLoading] = useState(false)
  // 사진 업로드 상태 — 블로그 커버와 같은 패턴 (2026-08-08 사장님 요청).
  // 업로드 라우트(/api/admin/products/upload)는 이미 있었는데 폼에 URL
  // 붙여넣기 칸만 있고 소비자가 없었다 — 실사 촬영본이 오면 여기로 올린다.
  const [imgUpload, setImgUpload] = useState<
    { status: 'idle' } | { status: 'uploading' } | { status: 'error'; message: string }
  >({ status: 'idle' })

  function update<K extends keyof ProductData>(key: K, value: ProductData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /**
   * ★옛 파일 정리는 **저장 성공 뒤에만** (2026-08-08 RC 재검증 F1).
   *
   * 첫 구현은 교체·X 즉시 Storage 를 지웠다 — 그러면 수정 모드에서 새 사진을
   * 올려보고 **저장 없이 이탈**하는 순간, DB 는 옛 URL 을 그대로 가리키는데
   * 파일은 사라져 고객 카탈로그 대표사진이 404 가 된다. 그래서:
   *  · DB 가 아는 파일(= 마운트 시점 image_url) → pendingDelete 에 쌓아 두고
   *    저장이 성공한 뒤에 지운다.
   *  · 저장된 적 없는 방금 업로드 파일 → 진짜 고아라 즉시 지워도 안전.
   * 외부 URL 은 서버가 버킷 마커 미스로 조용히 건너뛴다.
   */
  const dbImageUrl = initialData?.image_url ?? null
  const pendingDelete = useRef<string[]>([])

  function discardFile(url: string) {
    fetch('/api/admin/products/upload', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {})
  }

  function retireOldImage(previousUrl: string | null) {
    if (!previousUrl) return
    if (previousUrl === dbImageUrl) {
      if (!pendingDelete.current.includes(previousUrl)) {
        pendingDelete.current.push(previousUrl)
      }
    } else {
      discardFile(previousUrl) // 저장된 적 없는 업로드 — 즉시 정리 안전
    }
  }

  async function handleImageUpload(file: File) {
    setImgUpload({ status: 'uploading' })
    const previousUrl = form.image_url
    // ★try/catch — 네트워크 단절·JSON 파싱 실패가 throw 되면 'uploading' 에
    //  갇혀 버튼이 영구 비활성이 됐다(RC 재검증 F2).
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('slug', form.slug || 'product')
      const res = await fetch('/api/admin/products/upload', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          message?: string
        } | null
        setImgUpload({
          status: 'error',
          message: err?.message ?? '업로드에 실패했어요',
        })
        return
      }
      const data = (await res.json()) as { url: string }
      update('image_url', data.url)
      setImgUpload({ status: 'idle' })
      if (previousUrl && previousUrl !== data.url) retireOldImage(previousUrl)
    } catch {
      setImgUpload({
        status: 'error',
        message: '업로드에 실패했어요. 연결을 확인하고 다시 시도해 주세요',
      })
    }
  }

  /** 미리보기 X: 폼만 비운다 — Storage 정리는 저장 성공 뒤(retire 규칙). */
  function clearImage() {
    const previousUrl = form.image_url
    update('image_url', '')
    if (previousUrl) retireOldImage(previousUrl)
  }

  /** 저장이 성공했을 때만 부른다 — 미뤄 둔 옛 파일을 실제로 정리. */
  function flushRetiredImages() {
    for (const url of pendingDelete.current) {
      // ★저장된 최종 URL 과 같으면 지우지 않는다 (2026-08-09 재검토).
      //  X 로 지웠다가 같은 URL 을 직접 붙여넣고 저장하면, 방금 DB 가 다시
      //  가리키게 된 파일을 여기서 지워 404 를 만드는 극단 케이스가 있었다.
      if (url === form.image_url?.trim()) continue
      discardFile(url)
    }
    pendingDelete.current = []
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('상품명과 slug는 필수예요')
      return
    }
    if (form.price <= 0) {
      toast.error('가격은 0보다 커야 해요')
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
        toast.error(
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
      sales_channel: form.sales_channel,
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

    // audit #79: products schema-drift (admin form vs generated row).
    const productsClient = supabase as unknown as {
      from: (t: string) => {
        insert: (r: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null
              error: { message?: string } | null
            }>
          }
        }
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => Promise<{
            error: { message?: string } | null
          }>
        }
      }
    }

    if (mode === 'create') {
      const { data, error } = await productsClient
        .from('products')
        .insert(payload as Record<string, unknown>)
        .select('id')
        .single()

      setLoading(false)
      if (error) {
        toast.error('등록 실패: ' + (error.message ?? 'unknown'))
        return
      }
      toast.success('상품을 등록했어요')
      flushRetiredImages()
      router.push(`/admin/products/${data!.id}`)
      router.refresh()
    } else {
      const { error } = await productsClient
        .from('products')
        .update(payload as Record<string, unknown>)
        .eq('id', form.id!)

      setLoading(false)
      if (error) {
        toast.error('저장 실패: ' + error.message)
        return
      }
      toast.success('저장했어요')
      flushRetiredImages()
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
      toast.error('삭제 실패: ' + error.message)
      return
    }
    toast.success('삭제했어요')
    router.push('/admin/products')
    router.refresh()
  }

  // 폰에서 1열로 접힌다(2026-07-25 사장님 제보). 예전엔 프리픽스 없는
  // grid-cols-3 이라 390px 폰에서도 3열 → 오른쪽 사이드 칸이 130px 로 눌려
  // "외부 채널 상품은…" 안내가 한 단어씩 세로로 쪼개졌다. col-span 도 같이
  // 반응형이어야 한다 — 1열 그리드에서 col-span-2 는 암묵적 2번째 컬럼을
  // 만들어내서 접기가 무효가 된다.
  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {/* 왼쪽: 기본 정보 */}
      <div className="lg:col-span-2 space-y-4">
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
          <Field label="영문 주소(URL) *">
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
          <Field label="대표 사진">
            <div className="flex items-center gap-2">
              <label
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                  imgUpload.status === 'uploading'
                    ? 'bg-secondary text-muted-foreground cursor-wait'
                    : 'bg-zinc-900 text-white hover:bg-zinc-700'
                }`}
              >
                {imgUpload.status === 'uploading' ? '올리는 중...' : '사진 업로드'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                  className="hidden"
                  disabled={imgUpload.status === 'uploading'}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    // 같은 파일을 다시 골라도 change 가 뜨게 초기화.
                    e.target.value = ''
                    if (file) void handleImageUpload(file)
                  }}
                />
              </label>
              <span className="text-[10px] text-muted-foreground">
                JPG·PNG·WebP · 최대 8MB
              </span>
            </div>
            {imgUpload.status === 'error' && (
              <p role="alert" className="mt-1.5 text-[11px] font-semibold text-destructive">
                {imgUpload.message}
              </p>
            )}
            <input
              type="text"
              value={form.image_url ?? ''}
              onChange={(e) => update('image_url', e.target.value)}
              className={`${inputClass} font-mono text-xs mt-2`}
              placeholder="또는 이미지 URL 직접 입력 (https://...)"
            />
          </Field>
          {form.image_url && (
            <div className="mt-2">
              <p className="text-[10px] text-muted-foreground mb-1">미리보기</p>
              <div className="relative w-32 h-32 rounded-lg bg-secondary overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_url}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="사진 제거"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/70 text-white text-xs font-bold flex items-center justify-center hover:bg-foreground"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* 오른쪽: 가격 / 재고 / 상태 */}
      <div className="lg:col-span-1 space-y-4">
        <Section title="가격 & 재고">
          {form.category === '화식' && (
            <p className="text-[11px] leading-relaxed rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 mb-1">
              ⚠ 화식 가격은 <b>100g 단가</b>이고 실제 청구 계산의 정본이에요.
              여기서만 바꾸면 웹 비교표 등 코드에 적힌 표시가격과 어긋나요 —
              가격을 바꿀 땐 개발(Claude)에게 &ldquo;가격 바꿔줘&rdquo;라고
              말해서 코드와 함께 바꿔 주세요.
            </p>
          )}
          <Field label="정가 (원) *">
            <NumberInput
              value={form.price}
              onChange={(v) => update('price', v ?? 0)}
              emptyAs={0}
              className={inputClass}
              min={0}
            />
          </Field>
          <Field label="할인가 (원)">
            <NumberInput
              value={form.sale_price}
              onChange={(v) => update('sale_price', v)}
              className={inputClass}
              placeholder="없으면 비우기"
              min={0}
            />
          </Field>
          <Field label="재고">
            <NumberInput
              value={form.stock}
              onChange={(v) => update('stock', v ?? 0)}
              emptyAs={0}
              className={inputClass}
              min={0}
            />
          </Field>
        </Section>

        <Section title="분류 & 상태">
          <Field label="판매 채널">
            <select
              value={form.sales_channel}
              onChange={(e) =>
                update('sales_channel', e.target.value as 'own' | 'external')
              }
              className={inputClass}
            >
              <option value="own">🏠 자사몰 구독 (화식)</option>
              <option value="external">🛒 외부 채널 (스마트스토어·쿠팡)</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              외부 채널 상품은 자사몰·앱에 노출되지 않고, admin 목록에서 탭으로
              분리돼요.
            </p>
          </Field>
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
            <NumberInput
              value={form.sort_order}
              onChange={(v) => update('sort_order', v ?? 0)}
              emptyAs={0}
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            활성화 (판매 중)
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_subscribable}
              onChange={(e) => update('is_subscribable', e.target.checked)}
              className="accent-primary w-4 h-4"
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
                placeholder="예: 강원평창팜 / 수입원: 한국유통"
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
              <NumberInput
                min={0}
                value={form.shelf_life_days}
                onChange={(v) => update('shelf_life_days', v)}
                placeholder="예: 90"
                className={inputClass}
              />
            </Field>
            <Field label="용량 (g)">
              <NumberInput
                min={0}
                value={form.net_weight_g}
                onChange={(v) => update('net_weight_g', v)}
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

          <Field label="영양성분 (JSON 형식)">
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
              placeholder="예: 무농약 인증, USDA Grade A, 자가품질검사 통과"
              className={inputClass}
            />
          </Field>
        </Section>

        <div className="space-y-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? '저장 중...' : mode === 'create' ? '등록하기' : '저장하기'}
          </button>

          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="w-full py-3 rounded-full bg-card text-destructive border border-sale/40 text-xs font-semibold hover:border-sale transition disabled:opacity-50"
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
  'w-full px-3 py-2 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="p-5 rounded-xl bg-card border border-border shadow-sm">
      <h2 className="text-sm font-bold text-foreground mb-3">{title}</h2>
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
      <label className="block text-[11px] font-semibold text-foreground mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}