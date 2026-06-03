import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { SKU_META, type SkuKey } from '@/lib/allergy-sku-matrix'
import LabelPrintButton from './LabelPrintButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '라벨 PDF — Admin',
  robots: { index: false, follow: false },
}

/**
 * /admin/label/[sku] — Round G3 (2026-05-20): 사료관리법 별표 15의2 라벨
 * 자동 PDF 생성. (2026-06-03 개정: products SSOT 연동)
 *
 * # 9 의무 항목 (사료관리법 시행규칙 별표 15의2)
 *   1. 제품명  2. 원료명 및 함량  3. 영양성분(보장 분석치)
 *   4. 제조연월일/유통기한  5. 보관방법  6. 제조원(이름·소재지·전화)
 *   7. 사용 대상 동물  8. 급여량 안내  9. 영업등록번호
 *
 * # 데이터 출처 — products 테이블 (단일 진실)
 *   영양성분·원재료·급여·보관·제조원·분류는 모두 products 행에서 읽는다.
 *   (이전: sku-nutrition-matrix DM 하드코딩 + 별도 INGREDIENT/FEEDING 상수 →
 *   고객 PDP·정부 등록값과 drift. 이제 마이그레이션 hwasik_product_labels 가
 *   채운 as-fed 값을 그대로 사용 → 라벨 = 등록 = PDP 일치, 실측 갱신 시 자동
 *   반영.) 영업등록번호만 ENV/상수.
 *
 * # 영양성분 = as-fed (제품 100g 기준)
 *   습식 화식의 보장성분은 as-fed 로 표시 (정부 토퍼 등록과 동일 기준).
 *   조단백·칼슘·인 = 최소 보증 / 조지방·조섬유·조회분·수분 = 최대 보증.
 *   출시 전 7대 성분 의뢰검사 실측으로 nutrition_facts 갱신 시 자동 반영.
 *
 * # PDF
 *   window.print() — 브라우저 print → "PDF 저장". @media print.
 */

// SKU 코드 → product slug. 연어(S03)는 제품 보류라 매핑은 두되 active 행이
// 없으면 notFound (라벨 생성 불가).
const SKU_TO_SLUG: Record<SkuKey, string> = {
  C01: 'chicken-basic',
  D02: 'duck-weight',
  S03: 'salmon-skin',
  P04: 'pork-joint',
  B05: 'beef-premium',
}

type GuaranteedAnalysis = {
  protein_pct?: number
  fat_pct?: number
  fiber_pct?: number
  ash_pct?: number
  moisture_pct?: number
  calcium_pct?: number
  phosphorus_pct?: number
  calories_kcal_per_100g?: number
}

type LabelProduct = {
  name: string
  net_weight_g: number | null
  ingredients: string | null
  allergens: string[] | null
  feeding_guide: string | null
  storage_method: string | null
  manufacturer: string | null
  manufacturer_address: string | null
  shelf_life_days: number | null
  manufacture_date_policy: string | null
  origin: string | null
  pet_food_class: string | null
  nutrition_facts: GuaranteedAnalysis | null
}

export default async function LabelPdfPage({
  params,
}: {
  params: Promise<{ sku: string }>
}) {
  const { sku } = await params
  const skuKey = sku.toUpperCase() as SkuKey

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/admin/label/${sku}`)
  if (!(await isAdmin(supabase, user))) redirect('/admin')

  const meta = SKU_META[skuKey]
  const slug = meta ? SKU_TO_SLUG[skuKey] : undefined
  if (!meta || !slug) notFound()

  const { data: productRow } = await supabase
    .from('products')
    .select(
      'name, net_weight_g, ingredients, allergens, feeding_guide, ' +
        'storage_method, manufacturer, manufacturer_address, shelf_life_days, ' +
        'manufacture_date_policy, origin, pet_food_class, nutrition_facts',
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  // 제품 미등록(연어 등) 또는 비활성 → 라벨 생성 불가.
  if (!productRow) notFound()
  const product = productRow as unknown as LabelProduct
  const n = product.nutrition_facts ?? {}

  // R38b (#31) — 영업등록번호만 ENV/상수 (products 컬럼 아님).
  // 제조원·소재지는 products 우선, 없으면 ENV/상수 fallback.
  const business = {
    name:
      product.manufacturer ||
      process.env.NEXT_PUBLIC_BUSINESS_NAME ||
      "파머스테일 (Farmer's Tail)",
    address:
      product.manufacturer_address ||
      process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ||
      '인천광역시 연수구 송도과학로28번길 28, 송도더샵트리플타워 W동 121호',
    phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? '[전화번호 등록 후 입력]',
    biz_reg_no: process.env.NEXT_PUBLIC_FEED_BIZ_REG_NO ?? '243-06-03606',
  }

  // 원재료 — products.ingredients 문자열(함량 많은 순, "원료 N%, ...")을 분리.
  const ingredients = (product.ingredients ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const shelfLabel = product.shelf_life_days
    ? `제조일로부터 냉동 보관 시 ${product.shelf_life_days}일`
    : '제조일로부터 냉동 보관 시 6개월'

  return (
    <div className="px-5 py-6 print:px-0 print:py-0">
      <style>
        {`@media print {
          @page { size: A4; margin: 18mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }`}
      </style>

      <div className="flex items-end justify-between mb-6 no-print">
        <div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text font-semibold mb-3"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
            제품 관리
          </Link>
          <h1 className="font-['Archivo_Black'] text-2xl text-ink">
            {meta.code} 라벨 PDF
          </h1>
          <p className="text-[12px] text-muted mt-1">
            사료관리법 별표 15의2 — 9 의무 항목 · products 연동
          </p>
        </div>
        <LabelPrintButton />
      </div>

      {/* 라벨 본문 — 인쇄 영역 */}
      <article
        className="bg-white border-2 border-ink mx-auto"
        style={{ maxWidth: 720, padding: '24px 32px' }}
      >
        {/* 1. 제품명 */}
        <header className="border-b-2 border-ink pb-3 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            제품명
          </p>
          <h2 className="font-['Archivo_Black'] text-2xl text-ink mt-0.5">
            파머스테일 {product.name}
            <span className="text-base font-mono text-muted ml-2">
              ({meta.code})
            </span>
          </h2>
          <p className="text-[11.5px] text-muted mt-1">
            {product.pet_food_class ?? '배합사료(애완동물용)'} · 사용 대상: 개
            (성견 유지 단계)
            {product.net_weight_g
              ? ` · 내용량 ${product.net_weight_g.toLocaleString()}g`
              : ''}
          </p>
        </header>

        {/* 2. 원료명 및 함량 */}
        <Section title="원료명 및 함량 (Ingredient List)">
          {ingredients.length > 0 ? (
            <ol className="space-y-0.5 text-[11.5px] text-text list-decimal pl-5">
              {ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ol>
          ) : (
            <p className="text-[11.5px] text-muted">[원재료 입력 필요]</p>
          )}
          {product.origin && (
            <p className="text-[10.5px] text-muted mt-2">
              원산지: {product.origin}
            </p>
          )}
        </Section>

        {/* 3. 영양성분 (보장 분석치, as-fed) */}
        <Section title="영양성분 보장 분석치 (Guaranteed Analysis, 제품 100g 기준)">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11.5px]">
            <NutritionLine
              label="조단백 (Crude Protein)"
              value={pct(n.protein_pct, '최소')}
            />
            <NutritionLine
              label="조지방 (Crude Fat)"
              value={pct(n.fat_pct, '최대')}
            />
            <NutritionLine
              label="조섬유 (Crude Fiber)"
              value={pct(n.fiber_pct, '최대')}
            />
            <NutritionLine
              label="조회분 (Crude Ash)"
              value={pct(n.ash_pct, '최대')}
            />
            <NutritionLine
              label="칼슘 (Ca)"
              value={pct(n.calcium_pct, '최소')}
            />
            <NutritionLine label="인 (P)" value={pct(n.phosphorus_pct, '최소')} />
            <NutritionLine label="수분" value={pct(n.moisture_pct, '최대')} />
            <NutritionLine
              label="대사에너지"
              value={
                n.calories_kcal_per_100g != null
                  ? `${n.calories_kcal_per_100g} kcal/100g`
                  : '—'
              }
            />
          </div>
          {product.allergens && product.allergens.length > 0 && (
            <p className="text-[10.5px] text-muted mt-2">
              알레르기 유발성분: {product.allergens.join(', ')}
            </p>
          )}
        </Section>

        {/* 4. 제조연월일 / 유통기한 */}
        <Section title="제조연월일 / 유통기한">
          <p className="text-[11.5px] text-text">
            제조연월일: {product.manufacture_date_policy ?? '제품 포장 표기'}{' '}
            (YYYY-MM-DD)
          </p>
          <p className="text-[11.5px] text-text mt-1">유통기한: {shelfLabel}</p>
        </Section>

        {/* 5. 보관방법 */}
        <Section title="보관방법">
          <p className="text-[11.5px] text-text leading-relaxed">
            {product.storage_method ??
              '영하 18℃ 이하 냉동 보관. 해동 후 냉장 보관 시 3일 이내 급여. 재냉동 금지.'}
          </p>
        </Section>

        {/* 6. 제조원 */}
        <Section title="제조원 (Manufacturer)">
          <p className="text-[11.5px] text-text">{business.name}</p>
          <p className="text-[11.5px] text-text">{business.address}</p>
          <p className="text-[11.5px] text-text">전화: {business.phone}</p>
        </Section>

        {/* 7. 사용 대상 동물 */}
        <Section title="사용 대상 동물">
          <p className="text-[11.5px] text-text">개 (성견 / 유지)</p>
        </Section>

        {/* 8. 급여량 안내 */}
        <Section title="급여량 안내 (체중대 1일 기준)">
          <p className="text-[11.5px] text-text leading-relaxed">
            {product.feeding_guide ??
              '체중·활동량에 따라 1일 급여량을 조절하세요. /dogs/[id]/analysis 에서 정밀 산출.'}
          </p>
        </Section>

        {/* 9. 영업등록번호 */}
        <footer className="border-t-2 border-ink pt-3 mt-4 flex items-center justify-between">
          <p className="text-[10px] text-muted">
            영업등록번호:{' '}
            <span className="font-mono text-text">{business.biz_reg_no}</span>
          </p>
          <p className="text-[10px] text-muted">사료관리법 별표 15의2 준수</p>
        </footer>
      </article>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

/** as-fed % 표시 — 값 없으면 '—'. 방향(최소/최대) 접두. */
function pct(value: number | undefined, dir: '최소' | '최대'): string {
  if (value == null) return '—'
  return `${dir} ${value}%`
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-4 print:break-inside-avoid">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted border-b border-rule pb-1 mb-2">
        {title}
      </h3>
      {children}
    </section>
  )
}

function NutritionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-rule/40 py-1">
      <span className="text-text">{label}</span>
      <span className="font-mono tabular-nums text-text">{value}</span>
    </div>
  )
}
