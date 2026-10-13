/**
 * 2026-10-13 점검 — 식단·영양 엔진과 그 표시 묶음(E1~E13). 규칙183~189.
 *
 * 문서에만 적으면 같은 날 또 어긴다 — 사장님 결정과 고친 동작을 여기서 잠근다.
 * 각 규칙은 고치기 전 코드(df28b40a)에서 빨간불, 지금 코드에서 초록불인지 검산했다(카나리아 — 보고서에 결과).
 *
 * 도우미(read·stripComments·walk)는 이 파일 안에 작게 다시 쓴다 — 다른 묶음이 lib/audit-rules.test.ts 를
 * 동시에 고치고 있어 그 파일에 기대지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// AUDIT_ROOT — 카나리아(옛 코드 사본에서 빨간불 확인)를 돌릴 때만 쓴다. 평소엔 저장소 루트.
const ROOT = process.env.AUDIT_ROOT ?? process.cwd()

function read(rel: string): string {
  return readFileSync(join(ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

// 판매 4종 — 라인 키 · 알레르기 라벨(설문 정본).
const SOLD = ['weight', 'basic', 'joint', 'premium'] as const
type Sold = (typeof SOLD)[number]
const LABEL: Record<Sold, string> = { weight: '닭·칠면조', basic: '오리', joint: '돼지고기', premium: '소고기' }

// ─────────────────────────────────────────────────────────────────────────────

test('규칙183: 판매 중지 대체가 알레르기 레시피로 가지 않는다 — 박스 계산은 강아지 알레르기를 필수로 받고, 대체가 없으면 확인 필요로 남긴다 (E1)', async () => {
  /**
   * # 왜 (2026-10-13 점검 E1)
   * computeBoxItems 가 gateAvailability 에 알레르기를 안 넘겨서, 판매 중지된 레시피를 대체(치킨↔오리, 그 외→오리)할 때
   * 알레르기 레시피로 옮길 수 있었다 — 주문 화면·신청 API·피킹 리스트·청구 대조가 전부 이 함수를 쓴다.
   * 판매 중지 4종 × 알레르기 16조합 × 처방 10가지 × 화식 3단계 = 1,920건 전부에서 알레르기 레시피 0번.
   */
  const bp = (await import('./personalization/boxPricing.ts')) as Record<string, unknown>
  const { LINE_TO_SLUG } = await import('./personalization/skuMap.ts')
  const computeBoxItems = bp.computeBoxItems as (i: unknown) => Array<{ line?: string }>
  const computeBoxPlan = bp.computeBoxPlan as
    | ((i: unknown) => { items: Array<{ line?: string }>; held: Array<{ line: string; reason: string }> })
    | undefined
  const product = (slug: string) => ({ slug, price: 2000, sale_price: 1700, stock: 50, is_subscribable: true, nutrition_facts: null })
  const formulas: Array<Partial<Record<Sold, number>>> = [
    ...SOLD.map((l) => ({ [l]: 1 })),
    ...SOLD.flatMap((a, i) => SOLD.slice(i + 1).map((b) => ({ [a]: 0.5, [b]: 0.5 }))),
  ]
  const bad: string[] = []
  let runs = 0
  for (const stopped of SOLD) {
    const products: Record<string, ReturnType<typeof product>> = {}
    for (const l of SOLD) if (l !== stopped) products[LINE_TO_SLUG[l]!] = product(LINE_TO_SLUG[l]!)
    for (let mask = 0; mask < 16; mask++) {
      const blocked = SOLD.filter((_, i) => mask & (1 << i))
      const blockedLines = [...blocked]
      for (const fr of formulas) {
        // 알레르기 레시피가 처방에 직접 있는 경우는 '확인 필요'로 남는 게 맞다 — 그 경우도 박스엔 0번이어야 한다.
        const lineRatios = { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0, ...fr }
        for (const fresh of [30, 50, 100]) {
          runs++
          const input = { formula: { lineRatios, toppers: { protein: 0, vegetable: 0 }, dailyKcal: 400 }, freshRatio: fresh, products, blockedLines }
          const tag = `중지=${stopped} 알레르기=[${blocked.join(',')}] 처방=${JSON.stringify(fr)} 화식=${fresh}`
          const items = computeBoxItems(input)
          for (const it of items) if (it.line && blocked.includes(it.line as Sold)) bad.push(`${tag} → 박스에 ${it.line}`)
          if (!computeBoxPlan) continue
          const plan = computeBoxPlan(input)
          // 조용히 비우지 않는다 — 박스가 비면 반드시 '확인 필요' 몫이 있다.
          if (plan.items.length === 0 && plan.held.length === 0) bad.push(`${tag} → 빈 박스인데 확인 필요 없음`)
          // 처방에 알레르기가 없고 안전한 판매 레시피가 남아 있으면 대체가 돼야 한다(멈추지 않는다).
          const formulaClean = Object.entries(fr).every(([l]) => !blocked.includes(l as Sold))
          const safeLeft = SOLD.some((l) => l !== stopped && !blocked.includes(l))
          if (formulaClean && safeLeft && (plan.held.length > 0 || plan.items.length === 0)) bad.push(`${tag} → 안전한 대체가 있는데 멈췄다`)
        }
      }
    }
  }
  assert.equal(runs, 1920, '스윕 크기가 바뀌었다 — 검사 대상 추출이 깨졌다(카나리아)')
  assert.deepEqual(bad.slice(0, 15), [], `${bad.length}건`)
  assert.ok(computeBoxPlan, 'computeBoxPlan(담지 않은 몫까지 돌려주는 박스 계산)이 없다')

  // 입력 타입이 알레르기를 **필수**로 받는다 — 선택이면 새 호출처가 또 빠뜨린다.
  const src = stripComments(read('lib/personalization/boxPricing.ts'))
  assert.match(src, /blockedLines: readonly FoodLine\[\]\n/, 'BoxInput.blockedLines 가 필수가 아니다')
  assert.match(src, /holdWhenNoSafeTarget: true/, '박스 계산이 안전한 대체가 없을 때 첫 판매 레시피(알레르기일 수 있음)로 옮긴다')
  // 서버 호출처는 최신 설문 알레르기를 같은 헬퍼로 읽는다(규칙1 — 실패면 멈춤).
  for (const f of [
    'app/api/subscriptions/[id]/fresh-ratio/route.ts',
    'app/api/personalization/approve/route.ts',
    'app/(main)/dogs/[id]/approve/page.tsx',
    'app/api/cron/subscription-charge/route.ts',
    'lib/subscription/orderPageData.ts',
  ]) {
    assert.match(stripComments(read(f)), /loadDogBlockedLines\(/, `${f}: 박스 계산에 강아지 알레르기를 넘기지 않는다`)
  }
  const pick = stripComments(read('app/admin/personalization/picking-list/page.tsx'))
  assert.match(pick, /loadBlockedLinesByDog\(createAdminClient\(\), dogIds\)/, '피킹 리스트가 알레르기를 service_role 로 읽지 않는다(쿠키 클라이언트는 0행 = 알레르기 없음으로 보인다)')
  assert.match(pick, /r\.held\.length > 0 && \(/, "피킹 리스트가 담지 않은 몫을 '확인 필요'로 보이지 않는다")
  assert.match(pick, /r\.missing\.length > 0 \|\|\s*r\.held\.length > 0/, "담지 않은 몫이 '확인 필요' 숫자에 안 잡힌다")
  const create = stripComments(read('app/api/subscriptions/create/route.ts'))
  assert.match(create, /blockedLines = blockedLinesForAllergies\(allergies\)/, '정기배송 신청이 최신 설문 알레르기로 박스를 계산하지 않는다')
  assert.match(create, /if \(plan\.held\.length > 0\) \{/, '정기배송 신청이 담지 못한 몫이 있어도 만든다')
  const order = stripComments(read('app/(main)/dogs/[id]/order/OrderClient.tsx'))
  assert.match(order, /computeBoxPlan\(\{ formula, freshRatio, products, blockedLines \}\)/, '주문 화면 박스 계산에 알레르기가 없다')
  assert.match(order, /heldShares\.length > 0/, '주문 화면이 담지 못한 몫이 있어도 결제 버튼을 연다')
  assert.match(stripComments(read('app/(main)/dogs/[id]/order/page.tsx')), /blockedLines=\{data\.blockedLines\}/, '주문 화면에 알레르기를 넘기지 않는다')
  const prog = stripComments(read('app/api/cron/personalization-progression/route.ts'))
  assert.match(prog, /reasoning: next\.reasoning,\s*blockedLines: allergyBlockedLines,/, '재제안 게이트가 알레르기를 안 본다')
  assert.match(prog, /products: activeProducts,\s*blockedLines: allergyBlockedLines,/, '재제안 금액 계산이 알레르기를 안 본다')
})

test('규칙184: 다음 박스 제안 — 레시피 이름·"바뀌었나" 판정은 실제 박스(2종 스냅) 기준 (E2)', async () => {
  /**
   * # 왜 (2026-10-13 점검 E2 — 11/3 첫 해당)
   * 알림·메일의 레시피 이름(recipeName)은 스냅 전 비율 상위 2개라 '오리 90 / 한우 10'을 '오리·한우 레시피'로 말했고,
   * diffFormulas 는 새 라인 10% 를 '의미 있는 변화'로 보고 동의를 요청했다. 실제 박스는 둘째가 20% 미만이면 빼서
   * 두 처방 모두 오리 한 가지다 — 안 바뀐 박스에 "구성이 바뀔 수 있어요"가 나갔다.
   */
  const { diffFormulas } = await import('./personalization/diff.ts')
  const { recipeName } = await import('./personalization/format.ts')
  const f = (lineRatios: Record<string, number>) => ({
    lineRatios: { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0, ...lineRatios },
    toppers: { protein: 0, vegetable: 0 },
    reasoning: [],
    transitionStrategy: 'gradual' as const,
    dailyKcal: 400,
    dailyGrams: 300,
    cycleNumber: 1,
    algorithmVersion: 'v2.0.0',
    userAdjusted: false,
  })
  const d = diffFormulas(f({ basic: 1 }), f({ basic: 0.9, premium: 0.1 }))
  assert.equal(d.meaningful, false, '오리 100% → 오리 90/한우 10 이 동의 요청이 된다(박스는 둘 다 오리 한 가지)')
  assert.equal(recipeName(f({ basic: 0.9, premium: 0.1 })), '오리 레시피', '알림 이름이 박스에 없는 한우를 말한다')
  // 박스가 정말 바뀌면 여전히 묻는다(둘째가 20% 이상 → 2종 반반).
  assert.equal(diffFormulas(f({ basic: 1 }), f({ basic: 0.7, premium: 0.3 })).meaningful, true)
  assert.equal(recipeName(f({ basic: 0.7, premium: 0.3 })), '오리·한우 레시피')
  // 열량 판정은 그대로(±10%).
  assert.equal(diffFormulas(f({ basic: 1 }), { ...f({ basic: 1 }), dailyKcal: 450 }).meaningful, true)
})

test('규칙185: 성장기 강아지는 과체중 경보에서 빼고, 마른·살 빠지는 아이에겐 비만 경향 견종 감산을 하지 않는다 (E3·E12)', async () => {
  /**
   * # 왜 (2026-10-13 점검 E3·E12)
   * intervention-alerts(6개월 추세 → 30일 안 과체중 경보)만 성장기를 빼지 않아, 자라는 아이에게 과체중 경보가 갔다.
   * 칼로리 엔진·첫 박스는 견종만 보고 '비만 경향' 감산·체중 관리 쪽 보정을 걸어, 이미 마르거나 살이 빠지는 아이의 양을 더 줄였다.
   */
  const alerts = stripComments(read('app/api/cron/intervention-alerts/route.ts'))
  assert.match(alerts, /\.select\('id, user_id, name, weight, age_value, age_unit'\)/, '경보 크론이 나이를 안 읽는다')
  assert.match(alerts, /isGrowingDog\(\{\s*ageValue: dog\.age_value,\s*ageUnit: dog\.age_unit,\s*latestStage: latestStageByDog\.get\(dog\.id\)/, '경보 크론이 성장기 강아지를 빼지 않는다')
  assert.match(alerts, /if \(stageErr\) \{[\s\S]{0,200}status: 500/, "분석 단계 조회 실패를 '성장기 아님'으로 읽는다(규칙1)")

  const engine = (await import('./calorie-v2/engine.ts')) as typeof import('./calorie-v2/engine.ts')
  const flags = { ...engine.breedToFlags('unknown'), obeseProne: true }
  const s = {
    ageYears: 4,
    isNeutered: true,
    bodyAssessment: { ribs: 'easy', waist: 'slight', abdomen: 'level' },
    activityIntensity: 'mid',
    activityEvidence: 'self_report',
    isVeryInactive: false,
    housing: 'indoor',
    coldExposure: false,
    isEasyKeeper: false,
  } as Parameters<typeof engine.calculateAdultFactor>[0]
  const has = (lines: Array<{ label: string }>) => lines.some((l) => /비만경향 견종/.test(l.label))
  assert.equal(has(engine.calculateAdultFactor(s, flags, 6).lines), true, '전제: 통통한 비만 경향 견종은 감산한다')
  assert.equal(has(engine.calculateAdultFactor(s, flags, 4).lines), false, '체형 4 이하인데 견종 비만 감산을 한다')
  assert.equal(has(engine.calculateAdultFactor({ ...s, isLosingWeight: true } as typeof s, flags, 6).lines), false, '살이 빠지는 중인데 견종 비만 감산을 한다')
  // 보호자가 직접 '쉽게 찌는 체질'이라 답한 건 그대로 감산한다(견종만 막는다).
  assert.equal(has(engine.calculateAdultFactor({ ...s, isEasyKeeper: true }, flags, 4).lines), true)
  const nut = stripComments(read('lib/nutrition.ts'))
  assert.match(nut, /breedFlags: ladderBcs <= 4 \? \{ \.\.\.breedFlags, obeseProne: false \} : breedFlags/, 'BCS 1(사다리엔 5로 넘김)이 견종 비만 감산을 받는다')
  assert.match(nut, /weightTrend6mo: answers\.weightTrend6mo,/, '체중 추세가 칼로리 엔진에 안 간다')

  const fb = (await import('./personalization/firstBox.ts')) as Record<string, unknown>
  const suppressed = fb.breedObesityAdjustSuppressed as ((i: { bcs: number | null; weightTrend6mo?: string | null }) => boolean) | undefined
  assert.ok(suppressed, '첫 박스에 견종 비만 보정 끄기 조건이 없다')
  assert.equal(suppressed({ bcs: 4, weightTrend6mo: 'stable' }), true)
  assert.equal(suppressed({ bcs: 7, weightTrend6mo: 'lost' }), true)
  assert.equal(suppressed({ bcs: 6, weightTrend6mo: 'stable' }), false)
  assert.match(stripComments(read('lib/personalization/firstBox.ts')), /if \(pred === 'obesity' && breedObesityAdjustSuppressed\(input\)\) continue/, '첫 박스 품종 보정이 마른 아이에게도 체중 관리 쪽으로 민다')
})

test("규칙186: '지금 먹는 식단'은 정본 하나 — 승인 대기·거절·시작 전 제외(홈·강아지 화면·재제안), 하루 g 는 화식 비율·간식 반영 (E4·E5)", async () => {
  /**
   * # 왜 (2026-10-13 점검 E4·E5)
   * 홈과 강아지 화면이 created_at 최신 1건(승인 대기·거절·시작 전 포함)을 '지금 식단'으로 보였고, 재제안 크론은
   * 거절된 제안을 다음 비교 기준·박스 카운트 시작점으로 썼다 — 거절안과 같은 새 제안이 '변화 없음'으로 동의 없이
   * 자동 적용될 수 있었다. 식단 기록의 '하루 g'는 화식 비율(곁들임 30%)을 무시했고, 분석 카드는 간식 빼기 전 열량을 썼다.
   */
  const mod = (await import('./personalization/servingFormula.ts').catch(() => null)) as
    | { currentServingFormula: (rows: Array<Record<string, unknown>>, d: string) => Record<string, unknown> | null }
    | null
  assert.ok(mod, "'지금 먹는 식단' 정본(lib/personalization/servingFormula)이 없다")
  const rows = [
    { id: 'served', approval_status: 'auto_applied', applied_from: null, created_at: '2026-08-01T00:00:00Z' },
    { id: 'declined', approval_status: 'declined', applied_from: null, created_at: '2026-09-01T00:00:00Z' },
    { id: 'pending', approval_status: 'pending_approval', applied_from: null, created_at: '2026-10-01T00:00:00Z' },
    { id: 'future', approval_status: 'approved', applied_from: '2026-10-20', created_at: '2026-10-05T00:00:00Z' },
  ]
  assert.equal(mod.currentServingFormula(rows, '2026-10-13')?.id, 'served')

  const dash = stripComments(read('app/(main)/dashboard/page.tsx'))
  assert.match(dash, /currentServingFormula\(/, '홈이 최신 처방 1건(승인 대기·거절 포함)을 오늘 식단으로 쓴다')
  assert.match(dash, /approval_status, applied_from'\)/, '홈이 승인 상태·시작일을 안 읽는다')
  const dog = stripComments(read('app/(main)/dogs/[id]/page.tsx'))
  assert.match(dog, /const currentFormula = currentServingFormula\(formulaRows, todayKstIsoDate\(\)\)/, '강아지 화면이 최신 처방 1건을 지금 식단으로 쓴다')
  assert.doesNotMatch(dog, /\.limit\(1\)\s*\.maybeSingle\(\),\s*supabase\s*\.from\('subscriptions'\)/, '강아지 화면이 처방을 1건만 읽는다')
  const prog = stripComments(read('app/api/cron/personalization-progression/route.ts'))
  assert.match(prog, /const serving = currentServingFormula\(/, '재제안 크론이 먹는 식단을 정본으로 고르지 않는다')
  assert.match(prog, /lineRatios: serving\.formula\.lineRatios,/, '재제안 비교 기준이 거절·대기 제안일 수 있다')
  assert.match(prog, /const since = boxCountSince\(serving\.applied_from, serving\.created_at\)/, '재제안 박스 카운트가 거절된 제안부터 센다')
  assert.match(prog, /cycleNumber: cur\.cycle_number \+ 1,/, '다음 회차 번호는 최신 행에서 잇는다(번호 충돌 방지)')
  assert.match(prog, /if \(cur\.approval_status === 'pending_approval'\) \{/, '답하지 않은 제안 위에 새 제안을 겹친다')

  const hist = stripComments(read('app/(main)/dogs/[id]/formulas/page.tsx'))
  assert.match(hist, /dailyPortionTotalG\(ratios, row\.daily_kcal, freshRatio\)/, "식단 기록 '하루 g'가 화식 비율을 무시한다")
  assert.match(hist, /\.from\('subscriptions'\)[\s\S]{0,120}fresh_ratio/, '식단 기록이 구독의 화식 비율을 안 읽는다')
  const ana = stripComments(read('app/(main)/dogs/[id]/analysis/AnalysisView.tsx'))
  assert.match(ana, /const boxKcal = formula\?\.dailyKcal && formula\.dailyKcal > 0 \? formula\.dailyKcal : analysis\.mer/, '분석 카드 박스 열량이 간식 빼기 전(mer)이다')
  assert.match(ana, /lineDailyGrams\(line, ratio, boxKcal\)/, '분석 카드 하루 g 가 처방 열량을 안 쓴다')
})

test("규칙187: 팩 이름은 사실대로(하루 한 팩) · 하지 않은 조정을 '했어요'라고 쓰지 않는다 · 질환 효능 칩 대신 고른 이유 (E6·E7·E10)", async () => {
  /**
   * # 왜 (2026-10-13 점검 E6·E7·E10)
   * 정기배송 품목명 '(185g 한 끼)' — 실제론 1종 박스의 팩 하나가 하루치다(2종이면 레시피별 한 팩씩 하루 두 팩).
   * 분석 화면 '꼭 확인하세요'가 '인을 낮추고 오메가-3를 더했어요'·'지방을 크게 낮췄어요'처럼 하지 않은 조정을 말했고,
   * 신장 칩은 '저단백'이라 했다(레시피 4종 모두 고단백). 사장님 결정: '심장 케어·관절 보강·비만 예방' 같은 질환·효능
   * 칩 대신 '○○ 레시피를 골랐어요' 같은 고른 이유로.
   */
  const { itemDisplayName } = await import('./personalization/subscriptionItems.ts')
  const it = (pct: number) =>
    ({ slug: 'beef-premium', line: 'premium', pct, product: { id: 'p', name: '한우 화식', image_url: null, slug: 'beef-premium', price: 1, sale_price: 1, stock: 1, is_subscribable: true }, quantity: 14, packG: 165, dailyG: 165, mealG: 165, cycleG: 0, deliveredG: 0, cycleTotal: 0, listCycleTotal: 0, pricePerPack: 0, listPricePerPack: 0 }) as Parameters<typeof itemDisplayName>[0]
  assert.equal(itemDisplayName(it(100)), '한우 화식 (165g · 하루 한 팩)')
  assert.equal(itemDisplayName(it(50)), '한우 화식 (165g · 하루 두 팩 중 하나)')
  assert.doesNotMatch(stripComments(read('app/app/page.tsx')), /한 끼/, "앱 소개 화면이 아직 '한 끼씩'이라고 말한다")

  const { RISK_FLAG_INFO } = await import('./nutrition/risk-flags.ts')
  // 레시피 4종은 고정 — 아이마다 성분을 바꾸지 않는다. 열량(하루 양)·레시피 고르기만 실제로 한다.
  const FALSE_ADJUST = /(인|나트륨|지방|탄수화물|식이섬유|미네랄|단백질|오메가-3|칼슘|아연|타우린)[^.]{0,14}(낮췄|낮추고|줄였|줄이고|늘렸|늘리고|더했|보강|조절했|맞췄)/
  const bad = Object.entries(RISK_FLAG_INFO)
    .filter(([, v]) => FALSE_ADJUST.test(v.desc) || /케어/.test(v.label))
    .map(([k, v]) => `${k}: ${v.label} — ${v.desc}`)
  assert.deepEqual(bad, [], `하지 않은 조정·질환 효능을 말한다:\n${bad.join('\n')}`)
  assert.doesNotMatch(RISK_FLAG_INFO.LACTATING!.desc, /언제든/, "고객 문구 금지어 '언제든'")

  const { decideFirstBox } = await import('./personalization/firstBox.ts')
  const base = {
    dogId: 'd', dogName: '땅콩', ageMonths: 48, weightKg: 8, neutered: true, activityLevel: 'medium' as const, bcs: 5 as const,
    allergies: [] as string[], chronicConditions: [] as string[], pregnancy: 'none' as const, careGoal: 'general_upgrade' as const,
    homeCookingExperience: 'occasional' as const, currentDietSatisfaction: 3 as const, weightTrend6mo: 'stable' as const,
    giSensitivity: 'rare' as const, preferredProteins: [] as string[], indoorActivity: 'moderate' as const, dailyWalkMinutes: 30,
    pregnancyWeek: null, litterSize: null, expectedAdultWeightKg: null, irisStage: null, breed: null, dailyKcal: 400, dailyGrams: 300,
    availableLines: ['basic', 'weight', 'premium', 'joint'] as Array<'basic' | 'weight' | 'premium' | 'joint'>,
  }
  const EFFICACY = /케어|보강|예방|저단백|저지방|고섬유|구리 제한|나트륨 낮춤|골격 보호|성장기 맞춤/
  const conds = ['kidney', 'cardiac', 'mmvd', 'diabetes', 'liver', 'arthritis', 'allergy_skin', 'cognitive_decline', 'long_term_steroid', 'epi', 'hypothyroid', 'cushings', 'ivdd', 'urinary_stone', 'pancreatitis', 'ibd']
  const chips: string[] = []
  for (const c of conds) for (const bcs of [3, 5, 8] as const) for (const stage of [null, 1, 3, 4] as const) {
    const f = decideFirstBox({ ...base, chronicConditions: [c], bcs, irisStage: stage } as Parameters<typeof decideFirstBox>[0])
    for (const r of f.reasoning) if (EFFICACY.test(r.chipLabel)) chips.push(`${c}/bcs${bcs}: ${r.ruleId} → ${r.chipLabel}`)
    if (c === 'kidney') for (const r of f.reasoning) if (/^chronic-kidney/.test(r.ruleId)) assert.match(r.action, /저단백·저인 식단이 아니에요/, '신장 문구가 사실(고단백 레시피)을 말하지 않는다')
  }
  assert.deepEqual([...new Set(chips)].slice(0, 10), [], '질환·효능 칩이 남아 있다')
  // 옛 저장 처방의 효능 칩은 고객 화면에서 빠진다(엔진 문구만 바꾸면 쌓인 기록은 그대로라서).
  const { isCustomerVisibleReason } = (await import('./personalization/plain-reason.ts')) as { isCustomerVisibleReason?: (r: { ruleId: string; chipLabel: string }) => boolean }
  assert.ok(isCustomerVisibleReason, '옛 효능 칩을 고객 화면에서 거르는 함수가 없다')
  assert.equal(isCustomerVisibleReason({ ruleId: 'chronic-cardiac', chipLabel: '심장 케어 · 나트륨 낮춤' }), false)
  assert.equal(isCustomerVisibleReason({ ruleId: 'chronic-arthritis', chipLabel: '흑돼지 레시피를 골랐어요' }), true)
  for (const f of ['components/analysis/magazine/BoxMixCard.tsx', 'app/(main)/dogs/[id]/approve/ApproveClient.tsx', 'app/(main)/dogs/[id]/formulas/FormulasView.tsx']) {
    assert.match(stripComments(read(f)), /isCustomerVisibleReason/, `${f}: 옛 효능 칩·성장기 칩을 거르지 않는다`)
  }
  assert.doesNotMatch(stripComments(read('app/science/page.tsx')), /만성질환에 맞춰[^']*조정해요/, "/science 가 하지 않는 '질환에 맞춰 조정'을 말한다")
})

test('규칙188: 급성·중증 췌장염은 결제 전에 상담으로, 만성 췌장염 첫 박스는 지방이 가장 적은 레시피가 좋아하는 고기보다 먼저 (E8)', async () => {
  /**
   * # 왜 (2026-10-13 점검 E8 — 사장님 결정 "급성은 막기 + 낮은 지방 우선")
   * 급성·중증 췌장염은 경고 칩만 띄우고 주문·결제가 그대로 됐다. 만성 췌장염은 첫 박스가 '좋아하는 고기'(예: 한우 —
   * 지방이 가장 많은 편)로 접혀도 'DM 지방 ○%로 최대한 낮췄어요'가 접기 전 혼합 비율로 남았다.
   */
  const { decideFirstBox } = await import('./personalization/firstBox.ts')
  const base = {
    dogId: 'd', dogName: '땅콩', ageMonths: 48, weightKg: 8, neutered: true, activityLevel: 'medium' as const, bcs: 5 as const,
    allergies: [] as string[], chronicConditions: ['pancreatitis'], pregnancy: 'none' as const, careGoal: 'general_upgrade' as const,
    homeCookingExperience: 'occasional' as const, currentDietSatisfaction: 3 as const, weightTrend6mo: 'stable' as const,
    giSensitivity: 'rare' as const, preferredProteins: ['beef'], indoorActivity: 'moderate' as const, dailyWalkMinutes: 30,
    pregnancyWeek: null, litterSize: null, expectedAdultWeightKg: null, irisStage: null, breed: null, dailyKcal: 400, dailyGrams: 300,
    availableLines: ['basic', 'weight', 'premium', 'joint'] as Array<'basic' | 'weight' | 'premium' | 'joint'>,
  }
  const f1 = decideFirstBox(base as Parameters<typeof decideFirstBox>[0])
  assert.equal(f1.firstBoxLine, 'weight', '만성 췌장염인데 첫 박스가 좋아하는 고기(한우)로 접힌다 — 지방이 가장 적은 치킨이 먼저')
  const r1 = f1.reasoning.find((r) => r.ruleId === 'chronic-pancreatitis')
  assert.ok(r1 && /치킨/.test(r1.chipLabel) && !/DM|\d+(\.\d+)?%/.test(`${r1.action}${r1.chipLabel}`), '췌장염 문구가 최종 박스 기준이 아니거나 % 를 쓴다')
  // 닭 알레르기면 남은 것 중 지방이 가장 적은 흑돼지.
  const f2 = decideFirstBox({ ...base, allergies: ['닭·칠면조'] } as Parameters<typeof decideFirstBox>[0])
  assert.equal(f2.firstBoxLine, 'joint', '알레르기를 피하면서 지방이 가장 적은 레시피를 고르지 않는다')

  const compute = stripComments(read('app/api/personalization/compute/route.ts'))
  assert.match(compute, /const needsConsultation = allergyConsult \|\| severePancreatitis/, '급성·중증 췌장염이 상담 게이트(needsConsultation)에 없다')
  assert.match(compute, /pancreatitisGate = !stored\.needsConsultation && hasPancreatitisGate\(formula\.reasoning\)/, '옛 저장 처방(칩만 있음)의 급성 췌장염이 결제로 간다')
  const create = stripComments(read('app/api/subscriptions/create/route.ts'))
  assert.match(create, /hasPancreatitisGate\(f\.reasoning\) \|\|\s*isSeverePancreatitis\(/, '정기배송 신청 API 가 급성 췌장염을 막지 않는다')
  assert.match(stripComments(read('lib/subscription/orderPageData.ts')), /f\.formula\.needsConsultation \|\| hasPancreatitisGate\(f\.reasoning\)/, '주문 화면이 급성 췌장염을 상담으로 돌리지 않는다')
  assert.match(stripComments(read('app/(main)/dogs/[id]/order/OrderClient.tsx')), /disabled=\{submitting \|\| items\.length === 0 \|\| heldShares\.length > 0 \|\| pancreatitisGate\}/, '주문 화면 결제 버튼이 급성 췌장염에도 열린다')
  assert.match(stripComments(read('components/analysis/RecommendationBox.tsx')), /state\.reason === PANCREATITIS_CONSULT_REASON/, '분석 화면 상담 카드가 췌장염을 알레르기 문장으로 덮는다')
})

test('규칙189: 닭 알레르기여도 오리는 권함 · 아기·임신·수유는 추천 앞에서 수의사 상담 안내(성장기 칩 없음) · 웹 결과는 앱 차단표와 같게 (E9·E11·E13)', async () => {
  /**
   * # 왜 (2026-10-13 점검 E9·E11·E13 — 사장님 결정)
   * E9: 앱은 닭 알레르기에 오리를 '비슷한 단백질 주의'로 표시하고 가게는 대체 추천에서 오리를 뺐는데, 웹·매거진은 "닭·소가
   *     안 맞는 아이도 편하게"라고 말했다 — '권함'으로 통일.
   * E11: 성견 유지용 화식인데 '아기 강아지 · 성장기 맞춤'·'대형견 아기 · 골격 보호' 칩을 붙였다 — 칩은 빼고 추천 앞에 안내.
   * E13: 웹 설문 결과(selectSafeRecipes)가 영문 키를 레시피 키와만 비교해 양고기 알레르기에 한우를 추천했다.
   */
  const { SKU_MODEL } = await import('./personalization/skuModel.ts')
  assert.ok(!SKU_MODEL.duck.crossReactWith.includes('닭·칠면조'), "오리에 아직 '닭·칠면조 교차 반응'이 걸려 있다")
  assert.ok(SKU_MODEL.chicken.blockingAllergies.includes('닭·칠면조'), '닭 알레르기 차단(치킨)은 그대로여야 한다')
  const { alternativeRecipes } = await import('./store/catalog.ts')
  assert.ok(alternativeRecipes('chicken').includes('duck'), '가게가 닭이 안 맞는 아이에게 오리를 권하지 않는다')
  const { RECIPE_FAQ } = await import('./recipe-detail.ts')
  const chickenAllergy = RECIPE_FAQ.chicken.find((q) => /닭 알레르기/.test(q.q))?.a ?? ''
  assert.match(chickenAllergy, /오리/, '닭 알레르기 답이 오리를 권하지 않는다')

  const { HIDDEN_CUSTOMER_RULES, isCustomerVisibleReason } = (await import('./personalization/plain-reason.ts')) as {
    HIDDEN_CUSTOMER_RULES?: ReadonlySet<string>
    isCustomerVisibleReason?: (r: { ruleId: string; chipLabel: string }) => boolean
  }
  assert.ok(HIDDEN_CUSTOMER_RULES?.has('age-puppy') && HIDDEN_CUSTOMER_RULES.has('age-puppy-large-breed'), '성장기 칩을 고객 화면에서 빼지 않는다')
  assert.equal(isCustomerVisibleReason?.({ ruleId: 'age-puppy', chipLabel: '오리·한우 레시피를 골랐어요' }), false)
  assert.doesNotMatch(stripComments(read('lib/personalization/firstBox.ts')), /성장기 맞춤|골격 보호/, "첫 박스가 아직 '성장기 맞춤'·'골격 보호'라고 말한다")
  const mag = stripComments(read('app/(main)/dogs/[id]/analysis/_components/AnalysisMagazineSection.tsx'))
  const noticeAt = mag.search(/needsLifeStageVetNotice\(stage, riskFlags\)/)
  const boxAt = mag.search(/<MagBoxMix\b/)
  assert.ok(noticeAt > 0 && boxAt > noticeAt, '아기·임신·수유 안내가 추천 레시피 앞에 없다')

  const { selectSafeRecipes } = await import('./web-recipes.ts')
  assert.ok(!selectSafeRecipes(['lamb'], 4).some((r) => r.protein === 'beef'), '웹 결과가 양고기 알레르기에 한우를 추천한다(앱 차단표: 한우 = 소고기·양고기)')
  assert.ok(!selectSafeRecipes(['소고기'], 4).some((r) => r.protein === 'beef'), '웹 결과가 한글 라벨 알레르기를 못 읽는다')
  assert.match(stripComments(read('lib/start-teaser.ts')), /isWebRecipeBlocked\(/, '같은 결과 화면의 추천 단백질 줄이 다른 차단표를 쓴다')
})
