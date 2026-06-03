/**
 * 라인/토퍼 → 제품 slug 매핑 + 가용성 게이트 (단일 SSOT).
 *
 * # 왜 필요한가
 * 이전엔 order/page.tsx 와 OrderClient.tsx 가 각자 LINE_TO_SLUG 사본을 들고
 * 있었고, 박스 빌더는 제품이 없으면 그 라인을 조용히 skip 했다. 카탈로그가
 * 바뀌면(연어 보류, 토퍼 미오픈) "못 사는 라인" 비율이 박스에서 증발 →
 * 일일 칼로리 미달(과소급여). 여기로 매핑을 통합하고 gateAvailability 로
 * 비율을 가용 라인에 재분배해 그 버그를 차단한다.
 *
 * # 모듈화 (자동 합류)
 * 연어 제품(slug 'salmon-skin') 이나 토퍼 제품을 admin 이 is_active=true 로
 * 켜는 순간, deriveAvailableLines / deriveAvailableToppers 가 자동 인식 →
 * 코드 수정 없이 추천 알고리즘에 합류한다. (연어 시니어 라인 추후 출시 대비.)
 */
import type { FoodLine, Ratio, Reasoning } from './types.ts'
import { ALL_LINES, FOOD_LINE_META } from './lines.ts'
import { SKU_MODEL, LEGACY_LINE_TO_PROTEIN } from './skuModel.ts'

export type TopperAxis = 'vegetable' | 'protein'

/**
 * 라인 → 대표 제품 slug — **skuModel 파생** (③-A 리바인드 자동 반영).
 * 예: weight 키 = 닭 → 'chicken-basic'. 연어(salmon-skin)는 보류 — 그 slug 로
 * 출시 시 자동 합류.
 */
export const LINE_TO_SLUG: Record<FoodLine, string | null> = Object.fromEntries(
  ALL_LINES.map((line) => [line, SKU_MODEL[LEGACY_LINE_TO_PROTEIN[line]].slug]),
) as Record<FoodLine, string | null>

/** 토퍼 axis → 제품 slug. */
export const TOPPER_TO_SLUG: Record<TopperAxis, string> = {
  // 육류 동결건조 믹스(활성).
  protein: 'farm-protein-mix',
  // 가든레이어케이크(출시 전 — 가격 입력 후 활성화 시 게이트가 자동 해제).
  vegetable: 'garden-layer-cake-summer',
}

/** slug → 라인 역맵 (활성 제품 slug 로 availableLines 도출). */
export const SLUG_TO_LINE: Record<string, FoodLine> = Object.fromEntries(
  (Object.entries(LINE_TO_SLUG) as Array<[FoodLine, string | null]>)
    .filter((e): e is [FoodLine, string] => e[1] !== null)
    .map(([line, slug]) => [slug, line]),
)

/** 활성 제품 slug 집합 → 추천 가능한 라인. */
export function deriveAvailableLines(activeSlugs: Iterable<string>): FoodLine[] {
  const set = activeSlugs instanceof Set ? activeSlugs : new Set(activeSlugs)
  return ALL_LINES.filter((l) => {
    const slug = LINE_TO_SLUG[l]
    return slug !== null && set.has(slug)
  })
}

/** 활성 제품 slug 집합 → 추천 가능한 토퍼 axis. */
export function deriveAvailableToppers(
  activeSlugs: Iterable<string>,
): TopperAxis[] {
  const set = activeSlugs instanceof Set ? activeSlugs : new Set(activeSlugs)
  return (['vegetable', 'protein'] as TopperAxis[]).filter((t) =>
    set.has(TOPPER_TO_SLUG[t]),
  )
}

/**
 * 제품 없는 라인의 비율을 옮길 1순위 대체 라인.
 * skin(연어) → weight(오리): 연어유 함량 최다 → 오메가-3 연속성 보존.
 * 그 외 → basic(닭): 가장 균형 잡힌 기본 라인.
 */
const LINE_FALLBACK: Record<FoodLine, FoodLine> = {
  basic: 'weight',
  weight: 'basic',
  // 연어 → 오리(=basic 키, omega3 0.33 최다) : 오메가-3 연속성.
  skin: 'basic',
  premium: 'basic',
  joint: 'basic',
}

export type GateResult = {
  lineRatios: Record<FoodLine, Ratio>
  toppers: { protein: Ratio; vegetable: Ratio }
}

/**
 * 가용성 게이트 — 활성 제품 없는 라인/토퍼 비율을 재분배.
 *
 * - 라인: 제품 없는 라인의 비율을 fallback(연어→오리)으로 이동. fallback 도
 *   불가하면 basic, 그것도 불가하면 첫 가용 라인. 합은 1.0 유지 → 박스가
 *   "못 사는 라인" 때문에 칼로리 미달되지 않음.
 * - 토퍼: 제품 없는 axis 는 0 (add-on 이라 메인 화식이 이미 100% kcal 충족).
 *
 * availableLines === undefined → 전부 가용(no-op, 테스트/하위호환).
 * pure function. reasoning 주면 사유 chip push.
 */
export function gateAvailability(
  lineRatios: Record<FoodLine, Ratio>,
  toppers: { protein: Ratio; vegetable: Ratio },
  opts: {
    availableLines?: FoodLine[]
    availableToppers?: TopperAxis[]
    reasoning?: Reasoning[]
  } = {},
): GateResult {
  const lines: Record<FoodLine, Ratio> = { ...lineRatios }
  const outToppers = { ...toppers }

  // ── 라인 게이트 ──
  if (opts.availableLines && opts.availableLines.length > 0) {
    const avail = new Set(opts.availableLines)
    for (const line of ALL_LINES) {
      if (lines[line] <= 0 || avail.has(line)) continue
      const moved = lines[line]
      lines[line] = 0
      // fallback 체인: 1순위 대체 → basic → 첫 가용 라인.
      let target: FoodLine = opts.availableLines[0]!
      for (const cand of [LINE_FALLBACK[line], 'basic' as FoodLine]) {
        if (avail.has(cand)) {
          target = cand
          break
        }
      }
      lines[target] += moved
      opts.reasoning?.push({
        trigger: `${FOOD_LINE_META[line].name} 라인 준비중`,
        action: `${FOOD_LINE_META[line].name} ${Math.round(moved * 100)}% → ${FOOD_LINE_META[target].name} 로 이동. 해당 제품 출시 시 자동 반영.`,
        chipLabel: `${FOOD_LINE_META[line].name} → ${FOOD_LINE_META[target].name}`,
        priority: 1,
        ruleId: `gate-line-${line}`,
      })
    }
  }

  // ── 토퍼 게이트 ──
  if (opts.availableToppers) {
    const availT = new Set(opts.availableToppers)
    for (const t of ['vegetable', 'protein'] as TopperAxis[]) {
      if (outToppers[t] > 0 && !availT.has(t)) {
        opts.reasoning?.push({
          trigger: `${t === 'vegetable' ? '야채' : '단백질'} 토퍼 준비중`,
          action:
            '토퍼 0% (제품 미오픈) — 메인 화식이 칼로리 100% 충족. 출시 시 자동 추가.',
          chipLabel: `${t === 'vegetable' ? '야채' : '단백질'} 토퍼 준비중`,
          priority: 7,
          ruleId: `gate-topper-${t}`,
        })
        outToppers[t] = 0
      }
    }
  }

  return { lineRatios: lines, toppers: outToppers }
}
