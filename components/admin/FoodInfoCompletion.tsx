import Link from 'next/link'

/**
 * FoodInfoCompletion — 상품의 식품정보고시 14개 항목 채움률.
 *
 * 출시 직전 운영자가 가장 자주 빠뜨리는 부분 = "어떤 상품에 어떤 항목이 비어
 * 있나". 이 카드는:
 *   1) 전체 채움률 % (한 줄 큰 숫자)
 *   2) 가장 많이 빠진 항목 Top 3
 *   3) 누락 가장 많은 상품 Top 3 (관리자 편집 페이지로 직링크)
 *
 * 전자상거래법 §13 + 사료관리법 §13 의무항목 — 누락 시 시정명령 + 과태료.
 *
 * 입력은 server component 가 products 한 번 select 해서 prop 으로 내려줌.
 * 100개 이하면 클라이언트 집계로도 충분 (현재 카탈로그 규모 가정).
 */

export type ProductInfoLite = {
  id: string
  name: string
  origin: string | null
  manufacturer: string | null
  manufacturer_address: string | null
  manufacture_date_policy: string | null
  shelf_life_days: number | null
  net_weight_g: number | null
  ingredients: string | null
  nutrition_facts: unknown
  allergens: string[] | null
  storage_method: string | null
  feeding_guide: string | null
  pet_food_class: string | null
  certifications: string[] | null
  country_of_packaging: string | null
}

const FIELDS: { key: keyof ProductInfoLite; label: string }[] = [
  { key: 'origin', label: '원산지' },
  { key: 'manufacturer', label: '제조원' },
  { key: 'manufacturer_address', label: '제조원 소재지' },
  { key: 'manufacture_date_policy', label: '제조 정책' },
  { key: 'shelf_life_days', label: '소비기한' },
  { key: 'net_weight_g', label: '용량' },
  { key: 'ingredients', label: '원재료명' },
  { key: 'nutrition_facts', label: '영양성분' },
  { key: 'allergens', label: '알레르기' },
  { key: 'storage_method', label: '보관 방법' },
  { key: 'feeding_guide', label: '급여 가이드' },
  { key: 'pet_food_class', label: '품목 분류' },
  { key: 'certifications', label: '인증' },
  { key: 'country_of_packaging', label: '포장 국가' },
]

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value) && value > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return Boolean(value)
}

export default function FoodInfoCompletion({
  products,
}: {
  products: ProductInfoLite[]
}) {
  if (products.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-2 text-[13px] font-bold">식품정보고시 채움률</h3>
        <p className="text-[13px] text-muted-foreground">상품이 없어요.</p>
      </section>
    )
  }

  // 항목별 누락 카운트.
  const missingByField = FIELDS.map((f) => {
    const missing = products.filter((p) => !isFilled(p[f.key])).length
    return { ...f, missing, ratio: missing / products.length }
  }).sort((a, b) => b.missing - a.missing)

  // 상품별 누락 항목 수 + Top 3 누락 상품.
  const missingByProduct = products
    .map((p) => {
      const missingFields = FIELDS.filter((f) => !isFilled(p[f.key]))
      return {
        id: p.id,
        name: p.name,
        missingCount: missingFields.length,
        missingFields,
      }
    })
    .filter((x) => x.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount)
    .slice(0, 3)

  // 전체 채움률.
  const totalCells = products.length * FIELDS.length
  const filledCells = products.reduce(
    (s, p) => s + FIELDS.filter((f) => isFilled(p[f.key])).length,
    0,
  )
  const completionPct = (filledCells / totalCells) * 100

  // 색상 — 50% 미만 destructive, 80% 미만 amber, 그 외 emerald.
  // (--adm- 팔레트 밖 시맨틱 3색은 refunds 등과 같은 Tailwind 표준 톤.)
  const toneText =
    completionPct < 50
      ? 'text-destructive'
      : completionPct < 80
        ? 'text-amber-600'
        : 'text-emerald-600'
  const toneBar =
    completionPct < 50
      ? 'bg-destructive'
      : completionPct < 80
        ? 'bg-amber-500'
        : 'bg-emerald-600'

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        {/* ★영문 kicker("Food Info ·") 제거 + 한글 uppercase/자간 정리
            (2026-08-10). 한글엔 uppercase 가 효과가 없고 tracking-widest 는
            자간만 벌려 "식 품 정 보"처럼 읽힌다. 영문 머리말은 템플릿 티만
            나고 뜻을 더하지 않는다. */}
        <h3 className="text-[13px] font-bold">식품정보고시 채움률</h3>
        <span className="text-[10.5px] text-muted-foreground">
          전자상거래법 §13 + 사료관리법
        </span>
      </div>

      {/* 큰 숫자 + progress bar */}
      <div className="flex items-baseline gap-3">
        <span
          className={`text-[32px] font-black tabular-nums ${toneText}`}
          style={{ letterSpacing: '-0.02em', lineHeight: 1 }}
        >
          {completionPct.toFixed(1)}%
        </span>
        <span className="text-[12px] text-muted-foreground">
          {filledCells} / {totalCells} 항목 채워짐
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${toneBar}`}
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {/* 누락 가장 많은 항목 Top 3 */}
      {(missingByField[0]?.missing ?? 0) > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11.5px] font-bold text-muted-foreground">
            가장 많이 빠진 항목
          </p>
          <ul className="space-y-1.5">
            {missingByField.slice(0, 3).map((f) => (
              <li
                key={f.key as string}
                className="flex items-center justify-between text-[12.5px]"
              >
                <span>{f.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {f.missing}개 ({(f.ratio * 100).toFixed(0)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 누락 많은 상품 Top 3 */}
      {missingByProduct.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11.5px] font-bold text-muted-foreground">
            먼저 채워야 할 상품
          </p>
          <ul className="space-y-1.5">
            {missingByProduct.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-[12.5px]"
              >
                <Link
                  href={`/admin/products/${p.id}`}
                  className="flex-1 truncate hover:text-primary"
                >
                  {p.name}
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                    p.missingCount >= 7 ? 'bg-destructive' : 'bg-amber-500'
                  }`}
                >
                  {p.missingCount}개 누락
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[10.5px] leading-relaxed text-muted-foreground">
        14개 의무항목이 모두 채워져야 시정명령·과태료 위험이 없어요. 항목별로
        admin 의 상품 편집 페이지에서 채울 수 있어요.
      </p>
    </section>
  )
}
