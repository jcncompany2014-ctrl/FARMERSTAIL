import { createClient } from '@/lib/supabase/server'
import {
  ANTIBIOTIC_FREE_MAIN,
  ONE_KG_DISCOUNT_PCT,
  PACK_G,
  RECIPE_PRODUCT_NAME,
  SIZE_PACKS,
  STORE_RECIPES,
  SUBSCRIPTION_DISCOUNT_PCT,
  TRIAL_ITEM,
  TRIAL_PACK_G,
  fullIngredients,
  kcalPer100g,
  storeItem,
} from '@/lib/store/catalog'
import { FREE_SHIPPING_MIN, SHIPPING_FEE, STORE_SHIP_WEEKDAYS } from '@/lib/store/shipping'
import { storeSalesPaused } from '@/lib/store/toss-widget'
import { SMARTSTORE_URL } from '@/lib/links'
import { business } from '@/lib/business'
import { SITE_URL } from '@/lib/seo/jsonld'

/**
 * /llms.txt — AI 검색(챗GPT·퍼플렉시티·구글 AI 요약 등)이 읽어 가는 사이트 안내서(llmstxt.org 형식).
 *
 * 2026-10-11 사장님 "seo geo 최적화": AI 가 우리 가게를 설명할 때 화면을 긁어 추측하지 않고 이 사실표를 인용하게 한다.
 * ★숫자는 전부 정본에서 읽는다(가격 = lib/store/catalog, 배송 = lib/store/shipping, 재료 = lib/recipe-ingredients 경유) —
 *   여기 숫자를 손으로 적으면 가격이 바뀌는 날 AI 가 옛 값을 퍼뜨린다(규칙180이 지킨다).
 * 문구 규칙은 화면과 같다: 처방·영양소 %·질병 효과·"언제든"·도착 요일 약속·웹 상품에 '맞춤' 금지.
 */
export const dynamic = 'force-dynamic'

const won = (n: number) => n.toLocaleString('ko-KR')
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

function recipeLines(): string[] {
  return STORE_RECIPES.map((r) => {
    const ing = fullIngredients(r)
    const main = ANTIBIOTIC_FREE_MAIN[r] ? `무항생제 ${ing[0]}` : ing[0]
    const p500 = storeItem(`${r}-500g`)
    const p1k = storeItem(`${r}-1kg`)
    return `- ${RECIPE_PRODUCT_NAME[r]}: 500g ${won(p500.price)}원 · 1kg ${won(p1k.price)}원 · 100g당 ${kcalPer100g(r)}kcal · 원재료 ${[main, ...ing.slice(1)].join(', ')}`
  })
}

/**
 * 지금 원칙(질병 효과·약 이름·%·영어 용어 금지 — docs/MAGAZINE_PLAN_2026_10)으로 쓴 글만 AI 안내서에 싣는다.
 * 그 전 글(다이어트 % 감량·환절기 약 이름 등)은 고쳐 쓰기 대기라 AI 가 인용하면 안 된다 — 고쳐 쓸 때 게시일을 새로 찍으면 저절로 들어온다.
 */
const MAGAZINE_RULES_FROM = '2026-10-11T00:00:00+09:00'

async function magazineLines(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, published_at')
    .eq('is_published', true)
    .gte('published_at', MAGAZINE_RULES_FROM)
    .order('published_at', { ascending: false })
    .limit(30)
  // 조회 실패를 '글 없음'으로 읽지 않는다(AGENTS 규칙1) — 기록만 남기고 매거진 칸은 비운다.
  if (error) {
    console.error('[llms.txt] blog_posts 조회 실패', error.message)
    return []
  }
  return (data ?? []).map((p) => `- [${p.title}](${SITE_URL}/blog/${p.slug})${p.excerpt ? `: ${p.excerpt}` : ''}`)
}

export async function GET() {
  const shipDays = STORE_SHIP_WEEKDAYS.map((d) => WEEKDAY_KO[d]).join('·')
  const freeMan = FREE_SHIPPING_MIN / 10_000
  const posts = await magazineLines()
  // ★자사몰 결제 막음(규칙177) 동안엔 "웹 가게에서 판다"가 거짓이다 — 화면과 같은 판정 함수로(2026-10-12 점검).
  const paused = storeSalesPaused()

  const lines = [
    "# 파머스테일 (Farmer's Tail)",
    '',
    `> 국내산 원물을 진공 포장해 낮은 온도에서 천천히 익히는 수비드로 만든 강아지 화식(익힌 신선식) 브랜드예요. ${
      paused
        ? '웹 가게는 지금 결제를 준비 중이라 레시피 4종 단품은 네이버 스마트스토어에서 팔고'
        : '웹 가게에서는 레시피 4종의 500g·1kg과 4종 체험팩을 팔고'
    }, 파머스테일 앱에서는 강아지 몸무게에 맞춘 하루 양을 2주마다 보내는 정기배송을 해요.`,
    '',
    '## 핵심 사실',
    `- 레시피 4종: ${STORE_RECIPES.map((r) => RECIPE_PRODUCT_NAME[r]).join(', ')}. 4종 모두 고기는 한 가지 동물에서만 가져와요(살코기 + 같은 동물의 간·염통).`,
    `- 무항생제 원료: ${STORE_RECIPES.filter((r) => ANTIBIOTIC_FREE_MAIN[r]).map((r) => fullIngredients(r)[0]).join('·')}. (그 밖의 고기에는 무항생제라고 하지 않아요.)`,
    '- 사람이 먹는 등급의 원료, 익히자마자 급속 냉동, 보존료 없음.',
    '- 레시피 4종 모두 공개된 개 영양 기준(성견 유지)에 맞춰 한 끼로 완전하고 균형 있게 설계했어요(근거와 기준: /science).',
    // 팩 무게는 상품마다 다르다 — 단품 100g · 체험팩 50g · 앱 정기배송은 하루 양에 맞춰(팩 하나 = 하루 양이 아니다).
    `- 포장(웹 가게): 단품은 ${PACK_G}g 팩(500g = ${SIZE_PACKS['500g']}팩, 1kg = ${SIZE_PACKS['1kg']}팩), 체험팩은 ${TRIAL_PACK_G}g 팩 ${TRIAL_ITEM.packs}개. 얼린 채로 보내요. 앱 정기배송은 하루 양에 맞춰 나눠 담아요.`,
    '- 보관: 냉동 180일(제조일부터). 먹이기 전날 냉장실에서 녹이고, 녹인 팩은 3일 안에 줘요. 다시 얼리지 않아요.',
    '',
    '## 레시피와 가격(웹 가게, 원)',
    ...(paused
      ? [`- 지금은 웹 결제를 준비 중이에요. 단품은 네이버 스마트스토어(${SMARTSTORE_URL})에서 살 수 있고, 4종 체험팩은 웹 결제가 열리면 팔아요.`]
      : []),
    ...recipeLines(),
    `- ${TRIAL_ITEM.name}: ${won(TRIAL_ITEM.price)}원 (4종을 ${TRIAL_PACK_G}g씩 — 어떤 고기를 잘 먹는지 먼저 볼 때)`,
    `- 1kg은 500g 두 봉보다 ${ONE_KG_DISCOUNT_PCT}% 낮아요.`,
    '',
    '## 웹 가게 배송·환불',
    `- 배송비 ${won(SHIPPING_FEE)}원, 상품 금액 ${freeMan}만 원 이상이면 무료.`,
    `- 출고: ${shipDays}요일, 냉동으로. 출고 전날 밤 12시까지 주문하면 그 출고일에 나가요. 출고 후 지역에 따라 하루나 이틀이면 받아요.`,
    '- 환불: 받은 날부터 7일 안, 뜯지 않은 상품. 상품에 문제가 있으면 사진을 보내 주면 다시 보내거나 환불해요.',
    '- 주문은 회원만(카카오로 간편 가입). 웹 가게와 앱은 같은 계정이에요.',
    '',
    '## 앱 정기배송',
    '- 파머스테일 앱에 강아지를 등록하면 몸무게·나이·체형으로 하루 양을 그램 단위로 계산하고, 그 양에 맞춰 팩을 나눠 담아 2주마다 화요일에 보내요. 받으면 녹여서 주면 돼요.',
    `- 값: 정가보다 ${SUBSCRIPTION_DISCOUNT_PCT}% 낮고, 배송비는 정기배송 값에 들어 있어요.`,
    '- 주는 방법: 건사료에 곁들여서 · 반반 · 화식만 중에서 골라요.',
    '- 약정·위약금 없음. 다음 결제 전까지 앱에서 미루거나 그만둘 수 있어요. 결제가 끝난 박스는 그대로 보내요.',
    '',
    '## 주요 페이지',
    `- [스토어](${SITE_URL}/store): 레시피 4종과 체험팩, 하루 양 계산기`,
    `- [우리 음식](${SITE_URL}/our-food): 원료·수비드 조리·영양 설계·자주 묻는 질문`,
    `- [왜 화식인가](${SITE_URL}/why-fresh): 화식과 건사료가 어떻게 다른지`,
    `- [영양 근거](${SITE_URL}/science): 어떤 영양 기준을 어떻게 적용했는지`,
    `- [브랜드 이야기](${SITE_URL}/brand): 농장에서 꼬리까지 — 만드는 사람과 원칙`,
    `- [앱 정기배송](${SITE_URL}/app): 하루 양에 맞춰 나눈 정기배송`,
    `- [자주 묻는 질문](${SITE_URL}/faq)`,
    `- [환불 정책](${SITE_URL}/legal/refund) · [이용약관](${SITE_URL}/legal/terms)`,
    ...(posts.length > 0 ? ['', '## 매거진', ...posts] : []),
    '',
    '## 문의',
    `- 고객센터 ${business.phone} · 이메일 ${business.email}${business.kakaoChannelUrl ? ` · 카카오톡 채널 ${business.kakaoChannelUrl}` : ''}`,
    `- 사업자 정보: ${SITE_URL}/business`,
    '',
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
