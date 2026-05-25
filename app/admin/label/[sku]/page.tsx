import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { SKU_META, type SkuKey } from '@/lib/allergy-sku-matrix'
import { SKU_NUTRITION } from '@/lib/sku-nutrition-matrix'
import LabelPrintButton from './LabelPrintButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '라벨 PDF — Admin',
  robots: { index: false, follow: false },
}

/**
 * /admin/label/[sku] — Round G3 (2026-05-20): 사료관리법 별표 15의2 라벨
 * 자동 PDF 생성.
 *
 * # 9 의무 항목 (사료관리법 시행규칙 별표 15의2)
 *   1. 제품명
 *   2. 원료명 및 함량
 *   3. 영양성분 (보장 분석치, DM 기준)
 *   4. 제조연월일 / 유통기한
 *   5. 보관방법
 *   6. 제조원 (이름·소재지·전화번호)
 *   7. 사용 대상 동물 (개)
 *   8. 급여량 안내 (체중대 1일 기준)
 *   9. 영업등록번호
 *
 * # 데이터
 *   SKU 메타 (allergy-sku-matrix) + 영양 매트릭스 (sku-nutrition-matrix) +
 *   사업자 정보 (ENV 또는 상수).
 *
 * # PDF
 *   window.print() — 브라우저 print → "PDF 저장" 선택. 별도 PDF 라이브러리
 *   없이 인쇄 친화 HTML + @media print.
 */
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
  const nutrition = SKU_NUTRITION[skuKey]
  if (!meta || !nutrition) notFound()

  // R38b (#31) — 사업자 정보 ENV 우선. 미설정 시 placeholder fallback.
  // 사용자가 사업자 등록·사료영업등록 완료 후 Vercel env 셋팅하면 즉시 반영.
  // 별표 15의2 의무 항목 6 (제조원 이름·소재지·전화번호) + 9 (영업등록번호).
  const business = {
    name: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "파머스테일 (Farmer's Tail)",
    address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? '서울특별시 [등록 후 입력]',
    phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? '[전화번호 등록 후 입력]',
    biz_reg_no:
      process.env.NEXT_PUBLIC_FEED_BIZ_REG_NO ?? '[사료영업등록번호 미발급]',
  }

  // 원료 매핑 — SKU 별 대표 원료 (R&D 명세 기반 단순화).
  const ingredients = INGREDIENT_BY_SKU[skuKey] ?? []

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
            사료관리법 별표 15의2 — 9 의무 항목 자동 반영
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
            파머스테일 {meta.name_ko} 화식
            <span className="text-base font-mono text-muted ml-2">
              ({meta.code})
            </span>
          </h2>
          <p className="text-[11.5px] text-muted mt-1">
            사용 대상: 개 (성견 유지 단계). FEDIAF 2024 / NRC 2006 기준 완전식.
          </p>
        </header>

        {/* 2. 원료명 및 함량 */}
        <Section title="원료명 및 함량 (Ingredient List)">
          <ol className="space-y-0.5 text-[11.5px] text-text list-decimal pl-5">
            {ingredients.length > 0 ? (
              ingredients.map((ing, i) => (
                <li key={i}>
                  {ing.name} <span className="text-muted">— {ing.pct}%</span>
                </li>
              ))
            ) : (
              <li className="text-muted">[R&D 명세 입력 필요]</li>
            )}
          </ol>
        </Section>

        {/* 3. 영양성분 (보장 분석치) */}
        <Section title="영양성분 보장 분석치 (Guaranteed Analysis, DM 기준)">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11.5px]">
            <NutritionLine label="조단백 (Crude Protein)" value={`최소 ${nutrition.protein_pct.toFixed(1)}%`} />
            <NutritionLine label="조지방 (Crude Fat)" value={`최소 ${nutrition.fat_pct.toFixed(1)}%`} />
            <NutritionLine label="조섬유 (Crude Fiber)" value="최대 5.0%" />
            <NutritionLine label="회분 (Crude Ash)" value="최대 8.0%" />
            <NutritionLine label="칼슘 (Ca)" value="최소 1.0%" />
            <NutritionLine label="인 (P)" value="최소 0.8%" />
            <NutritionLine label="Ca : P 비율" value={`${nutrition.ca_p_ratio.toFixed(1)} : 1`} />
            <NutritionLine label="EPA + DHA" value={`${nutrition.epa_dha_pct.toFixed(2)}%`} />
            <NutritionLine label="셀레늄 (Se)" value={`${nutrition.selenium_mcg_per_kg} mcg/kg`} />
            <NutritionLine label="수분" value="최대 78%" />
          </div>
        </Section>

        {/* 4. 제조연월일 / 유통기한 */}
        <Section title="제조연월일 / 유통기한">
          <p className="text-[11.5px] text-text">
            제조연월일: 박스 옆면 인쇄 (YYYY-MM-DD)
          </p>
          <p className="text-[11.5px] text-text mt-1">
            유통기한: 제조일로부터 냉동 보관 시 6개월
          </p>
        </Section>

        {/* 5. 보관방법 */}
        <Section title="보관방법">
          <p className="text-[11.5px] text-text leading-relaxed">
            영하 18°C 이하 냉동 보관. 해동 후 냉장 보관 시 3일 이내 급여.
            재냉동 금지.
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
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted border-b border-ink">
                  <th className="py-1.5 pr-3 font-bold">체중 (kg)</th>
                  <th className="py-1.5 pl-3 font-bold">1일 권장량 (g)</th>
                </tr>
              </thead>
              <tbody>
                {FEEDING_GUIDE.map((row) => (
                  <tr key={row.weight_kg} className="border-b border-rule/60">
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-text">
                      {row.weight_kg}
                    </td>
                    <td className="py-1.5 pl-3 font-mono tabular-nums text-text">
                      {row.daily_g}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            ※ 활동량·중성화 여부에 따라 ±15% 조정. /dogs/[id]/analysis 에서
            정밀 산출.
          </p>
        </Section>

        {/* 9. 영업등록번호 */}
        <footer className="border-t-2 border-ink pt-3 mt-4 flex items-center justify-between">
          <p className="text-[10px] text-muted">
            영업등록번호: <span className="font-mono text-text">{business.biz_reg_no}</span>
          </p>
          <p className="text-[10px] text-muted">
            사료관리법 별표 15의2 준수
          </p>
        </footer>
      </article>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

// SKU 별 대표 원료. R&D 명세 확정 시 갱신. 현재는 단순화된 데이터.
const INGREDIENT_BY_SKU: Partial<Record<SkuKey, Array<{ name: string; pct: number }>>> = {
  C01: [
    { name: '닭고기 (살코기·간·심장)', pct: 60 },
    { name: '현미·귀리·고구마', pct: 25 },
    { name: '브로콜리·시금치·당근', pct: 10 },
    { name: '연어유 (EPA/DHA)', pct: 3 },
    { name: '비타민·미네랄 프리믹스', pct: 2 },
  ],
  D02: [
    { name: '오리고기 (살코기·심장)', pct: 60 },
    { name: '귀리·녹두', pct: 22 },
    { name: '호박·아스파라거스', pct: 13 },
    { name: '아마씨유', pct: 3 },
    { name: '비타민·미네랄 프리믹스', pct: 2 },
  ],
  S03: [
    { name: '연어 (살·뼈 제외)', pct: 58 },
    { name: '고구마·완두', pct: 22 },
    { name: '시금치·블루베리', pct: 12 },
    { name: '연어유 (EPA/DHA)', pct: 5 },
    { name: '타우린 + 비타민·미네랄 프리믹스', pct: 3 },
  ],
  P04: [
    { name: '돼지고기 (살코기·간)', pct: 60 },
    { name: '귀리·메밀', pct: 22 },
    { name: '브로콜리·당근', pct: 13 },
    { name: '아마씨유', pct: 3 },
    { name: '비타민·미네랄 프리믹스', pct: 2 },
  ],
  B05: [
    { name: '한우 (살코기·간·심장)', pct: 60 },
    { name: '현미·귀리·고구마', pct: 24 },
    { name: '시금치·당근·호박', pct: 11 },
    { name: '연어유 (EPA/DHA)', pct: 3 },
    { name: '비타민·미네랄 프리믹스', pct: 2 },
  ],
}

// 체중대 급여 가이드 — calculateNutrition 평균치 기반.
const FEEDING_GUIDE = [
  { weight_kg: 2, daily_g: 80 },
  { weight_kg: 3, daily_g: 110 },
  { weight_kg: 5, daily_g: 160 },
  { weight_kg: 7, daily_g: 200 },
  { weight_kg: 10, daily_g: 260 },
  { weight_kg: 15, daily_g: 360 },
  { weight_kg: 20, daily_g: 440 },
  { weight_kg: 25, daily_g: 520 },
  { weight_kg: 30, daily_g: 590 },
  { weight_kg: 40, daily_g: 720 },
]
