/**
 * ProductFoodInfo — PDP 의 식품정보고시 / 사료관리법 표시 섹션.
 *
 * 전자상거래법 §13 제2항 (공정위 고시 별표 1 식품류) + 사료관리법 시행규칙
 * 별표 1 표시기준의 14개 의무항목을 한 표에 노출. DB 컬럼은 점진적으로 채울
 * 수 있고, 값이 없는 항목은 자동으로 "정보 준비 중" 표시 — 누락이 명확히
 * 보이게.
 *
 * # 의무항목 vs 컬럼 매핑
 *   1. 품목명/제품명         → product.name
 *   2. 식품유형/분류         → product.pet_food_class
 *   3. 제조원/수입원         → product.manufacturer
 *   4. 제조원 소재지         → product.manufacturer_address
 *   5. 원산지                → product.origin
 *   6. 제조연월일/소비기한   → product.manufacture_date_policy + shelf_life_days
 *   7. 용량(g)               → product.net_weight_g
 *   8. 원재료명              → product.ingredients
 *   9. 영양성분              → product.nutrition_facts (JSONB)
 *  10. 알레르기 유발성분     → product.allergens
 *  11. 보관 방법             → product.storage_method
 *  12. 급여 방법/주의        → product.feeding_guide
 *  13. 인증 / 검사 성적      → product.certifications
 *  14. 소비자상담실          → 회사 단위 — SiteFooter 의 business.email/phone.
 *
 * 표시기준 누락은 공정위 시정명령 + 과태료 500만원 대상이라 PDP 마운트 시
 * 자동으로 "준비 중" 라벨이 보여 운영자가 빠진 항목을 즉시 인지할 수 있게.
 */

export type NutritionFacts = {
  protein_pct?: number
  fat_pct?: number
  fiber_pct?: number
  ash_pct?: number
  moisture_pct?: number
  calories_kcal_per_100g?: number
  calcium_pct?: number
  phosphorus_pct?: number
}

export type ProductFoodInfoProps = {
  origin?: string | null
  manufacturer?: string | null
  manufacturerAddress?: string | null
  manufactureDatePolicy?: string | null
  shelfLifeDays?: number | null
  netWeightG?: number | null
  ingredients?: string | null
  nutritionFacts?: NutritionFacts | null
  allergens?: string[] | null
  storageMethod?: string | null
  feedingGuide?: string | null
  petFoodClass?: string | null
  certifications?: string[] | null
  countryOfPackaging?: string | null
  // 회사 정보 (소비자상담실) 는 SiteFooter 가 표시하므로 여기선 안내문만.
}

const PLACEHOLDER = '정보 준비 중'

function or(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return PLACEHOLDER
  return String(value)
}

function nutritionRow(label: string, value: number | undefined, suffix: string) {
  if (value === undefined || value === null) return null
  return (
    <li className="flex justify-between text-[12px]">
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 700 }}>
        {value}
        {suffix}
      </span>
    </li>
  )
}

export default function ProductFoodInfo(props: ProductFoodInfoProps) {
  const n = props.nutritionFacts ?? null
  const hasAnyNutrition =
    n &&
    (n.protein_pct !== undefined ||
      n.fat_pct !== undefined ||
      n.fiber_pct !== undefined ||
      n.ash_pct !== undefined ||
      n.moisture_pct !== undefined ||
      n.calories_kcal_per_100g !== undefined ||
      n.calcium_pct !== undefined ||
      n.phosphorus_pct !== undefined)

  return (
    <section
      id="food-info"
      className="ft-anchor-under-chrome px-5 md:px-6 mt-10 md:mt-14"
    >
      <div
        className="rounded-2xl px-5 py-6 md:px-8 md:py-10"
        style={{
          background: 'var(--bg)',
          boxShadow: 'inset 0 0 0 1px var(--rule)',
        }}
      >
        <div className="flex items-center gap-2 mb-4 md:mb-6">
          <span
            className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] uppercase"
            style={{ color: 'var(--muted)' }}
          >
            Food Info · 식품·사료 표시정보
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
        </div>

        {/* 14개 의무항목 표 */}
        <dl className="space-y-2.5 text-[12px] md:text-[13px]">
          <Row label="품목 분류" value={or(props.petFoodClass)} />
          <Row label="원산지" value={or(props.origin)} />
          <Row label="제조원" value={or(props.manufacturer)} />
          <Row
            label="제조원 소재지"
            value={or(props.manufacturerAddress)}
          />
          {props.countryOfPackaging && (
            <Row label="포장 국가" value={props.countryOfPackaging} />
          )}
          <Row
            label="제조 / 소비기한"
            value={
              props.manufactureDatePolicy && props.shelfLifeDays
                ? `${props.manufactureDatePolicy} · 제조일 기준 ${props.shelfLifeDays}일`
                : or(props.manufactureDatePolicy ?? props.shelfLifeDays)
            }
          />
          <Row
            label="용량"
            value={
              props.netWeightG ? `${props.netWeightG.toLocaleString()}g` : PLACEHOLDER
            }
          />
          <Row label="보관 방법" value={or(props.storageMethod)} />
          <Row
            label="알레르기 유발성분"
            value={
              props.allergens && props.allergens.length > 0
                ? props.allergens.join(', ')
                : PLACEHOLDER
            }
          />
          <Row
            label="인증 / 검사"
            value={
              props.certifications && props.certifications.length > 0
                ? props.certifications.join(' · ')
                : PLACEHOLDER
            }
          />
        </dl>

        {/* 원재료 — 별도 블록 (긴 텍스트) */}
        <div className="mt-6">
          <p
            className="text-[10px] md:text-[11px] tracking-[0.22em] uppercase mb-2"
            style={{ color: 'var(--muted)' }}
          >
            Ingredients · 원재료명
          </p>
          <p
            className="text-[12px] md:text-[13px] leading-relaxed"
            style={{ color: 'var(--text)' }}
          >
            {props.ingredients ?? PLACEHOLDER}
          </p>
        </div>

        {/* 영양성분 (있을 때만) */}
        {hasAnyNutrition && n && (
          <div className="mt-6">
            <p
              className="text-[10px] md:text-[11px] tracking-[0.22em] uppercase mb-2"
              style={{ color: 'var(--muted)' }}
            >
              Nutrition · 영양성분 (100g 기준)
            </p>
            <ul className="space-y-1.5">
              {nutritionRow('조단백질', n.protein_pct, '%')}
              {nutritionRow('조지방', n.fat_pct, '%')}
              {nutritionRow('조섬유', n.fiber_pct, '%')}
              {nutritionRow('조회분', n.ash_pct, '%')}
              {nutritionRow('수분', n.moisture_pct, '%')}
              {nutritionRow('칼슘', n.calcium_pct, '%')}
              {nutritionRow('인', n.phosphorus_pct, '%')}
              {nutritionRow('칼로리', n.calories_kcal_per_100g, ' kcal')}
            </ul>
          </div>
        )}

        {/* 급여 가이드 */}
        {props.feedingGuide && (
          <div className="mt-6">
            <p
              className="text-[10px] md:text-[11px] tracking-[0.22em] uppercase mb-2"
              style={{ color: 'var(--muted)' }}
            >
              Feeding · 급여 가이드
            </p>
            <p
              className="text-[12px] md:text-[13px] leading-relaxed"
              style={{ color: 'var(--text)' }}
            >
              {props.feedingGuide}
            </p>
          </div>
        )}

        {/* 소비자 상담실 — 사이트 푸터로 안내 */}
        <p
          className="mt-7 text-[10.5px] md:text-[11.5px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          소비자 상담실 / 환불·교환 문의는 페이지 하단의 고객센터 정보를
          참고해 주세요.
        </p>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const isPlaceholder = value === PLACEHOLDER
  return (
    <div className="flex items-start gap-3">
      <dt
        className="shrink-0 w-[112px] md:w-[140px] text-[11px] md:text-[12px]"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </dt>
      <dd
        className="flex-1 text-[12px] md:text-[13px]"
        style={{
          color: isPlaceholder ? 'var(--muted)' : 'var(--text)',
          fontStyle: isPlaceholder ? 'italic' : 'normal',
          fontWeight: isPlaceholder ? 400 : 600,
        }}
      >
        {value}
      </dd>
    </div>
  )
}
