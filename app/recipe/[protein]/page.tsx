import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import '@/components/store/store.css'
import AppTopBar from './AppTopBar'
import { WEB_RECIPES, WEB_RECIPE_ORDER, type WebRecipe } from '@/lib/web-recipes'
import { isAppContextServer } from '@/lib/app-context'
import { RECIPE_DETAIL, RECIPE_FAQ, RECIPE_STORY, recipeLedger } from '@/lib/recipe-detail'
import { fullIngredientNames } from '@/lib/recipe-ingredients'
import { RECIPE_BAND, RECIPE_REAL_IMG, RECIPE_STUDIO_IMG, SUBSCRIPTION_DISCOUNT_PCT, storeItem } from '@/lib/store/catalog'
import type { FoodLine } from '@/lib/personalization/types'

/** 레시피 키 → 추천 라인(원재료 정본 조회용). weight=닭·basic=오리·joint=돼지·premium=소. */
const PROTEIN_LINE: Record<WebRecipe['protein'], FoodLine> = {
  chicken: 'weight',
  duck: 'basic',
  pork: 'joint',
  beef: 'premium',
}

/**
 * /recipe/[protein] — 제품 뒷면 QR 전용 레시피 상세 (2026-07-06, 사장님 지시).
 *
 * ★진입 = QR 만: 사이트 메뉴·푸터·내부 링크 어디에도 걸지 않고, robots.ts 에서
 * /recipe/ disallow + 아래 metadata noindex + sitemap 미등재. 제품 포장의 QR
 * 로만 도달. /recipe ↔ /recipe 상호 링크는 허용 — 어느 쪽이든 출발점이 QR 이어야만
 * 도달할 수 있으므로 "QR 전용 진입" 속성이 깨지지 않는다.
 *
 * # 2026-10-10 웹 리뉴얼 — 웹 시안 WEB-C01
 * 웹 = 가게 틀(StoreShell) 안에서 위에서부터:
 *   히어로(머리말·제목·소개·태그) → 실제 사진 + 겹친 요약 4칸 → 이 레시피 사기(/store/[recipe], 웹만)
 *   → 탄생 이야기 → 주요 재료(정본) + 전체 원재료 → 4종 열량 막대 → 만드는 과정 → 등록성분
 *   → 처음 일주일 + 보관 → 자주 묻는 것 → 다른 레시피 → 앱 띠(웹만)
 * 앱 = 같은 내용을 앱 윗줄(← + 레시피 이름) 아래에. 앱은 단품을 팔지 않으므로(/store 는 앱에서 앱 홈으로 간다)
 *   '이 레시피 사기' 줄과 '앱에서 15% 할인' 띠는 웹에만 둔다.
 *
 * ⚠️ 숫자는 kcal/100g(SKU_MODEL 정본 — 앱 하루 양 계산과 같은 값)과 500g 가격(lib/store/catalog)뿐이다.
 *    등록성분은 검사 결과 전까지 숫자를 싣지 않는다 — 가게 상품 화면과 같은 말(성분 % 노출 금지).
 * ⚠️ 효능 단정·질병 치료 표현 금지(표시광고). 공정 설명은 "줄여요/늦춰요" 톤 — 검증 안 된 세부를 지어내지 않는다.
 * ⚠️ QR 영구성: 이 URL 경로(/recipe/{protein})는 인쇄물에 박히면 못 바꾸므로
 *    절대 변경 금지. protein 키(chicken/duck/pork/beef)도 고정.
 */

export const dynamicParams = false // 4종 외 protein 은 404

type Params = Promise<{ protein: string }>

const PROTEINS: WebRecipe['protein'][] = ['chicken', 'duck', 'pork', 'beef']

export function generateStaticParams() {
  return PROTEINS.map((protein) => ({ protein }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { protein } = await params
  const d = RECIPE_DETAIL[protein as WebRecipe['protein']]
  const title = d ? `${d.displayName} · 레시피 정보` : '레시피 정보'
  return {
    title,
    description: d?.lede,
    // ★QR 전용 — 검색 색인·팔로우 전부 차단.
    robots: { index: false, follow: false, nocache: true },
  }
}

/**
 * 만드는 과정 — 실제 만드는 순서라 번호가 정보다.
 * ★카피 근거: 기존 승인 카피(our-food 수비드 절·about 무첨가 표)의 수위 그대로. "당일 손질" 같은 검증 안 된
 * 공정 세부를 지어내지 않는다 — 단정 대신 "줄여요/늦춰요" 톤.
 */
const PROCESS_STEPS = [
  { t: '원물 손질', d: '사람이 먹을 수 있는 등급의 재료를, 사람 식품과 같은 위생 기준으로 손질해요.' },
  { t: '진공 포장', d: '공기를 빼 산화를 늦추고, 익히는 동안 영양이 물에 씻겨 나가는 걸 줄여요.' },
  { t: '수비드 저온 조리', d: '센 불 대신 알맞은 저온에서 천천히 익혀 수분과 풍미를 지켜요.' },
  { t: '급속 냉동', d: '식혀서 바로 얼리고, 얼린 채로 보내드려요. 보존제는 넣지 않아요.' },
] as const

/**
 * 처음 일주일 — 기존 사료에 섞는 비중을 채움 칸(1~4/4)으로.
 * ★도착점은 '완전 화식'이 아니라 **정한 양**이다(2026-09-05 사장님 지적 — 곁들임·반반으로 먹이는 집도 있다).
 */
const TRANSITION_PHASES = [
  { day: '1~2일', fill: 1, label: '기존 사료에 한두 숟갈만 섞어 시작해요' },
  { day: '3~4일', fill: 2, label: '잘 먹고 변이 편안하면 조금씩 늘려요' },
  { day: '5~6일', fill: 3, label: '정한 양 가까이, 변 상태를 보며 조절해요' },
  { day: '7일~', fill: 4, label: '정한 양으로 자리 잡아요' },
] as const

/**
 * 먹이는 순간의 질문들 — 봉투를 든 보호자가 실제로 찾는 것. 공통 8문항 + 레시피별 2문항(RECIPE_FAQ).
 * 하루 양·간식은 앱이 계산한다(웹 설문은 2026-10-10 앱으로 옮겼다). 비율은 %로 말하지 않는다.
 */
const FEEDING_FAQ = [
  {
    q: '처음인데 잘 안 먹으려고 해요',
    a: '녹인 직후엔 향이 약할 수 있어요. 미온수에 봉투째 몇 분 담가 살짝 데우면 향이 살아나요. 그래도 낯설어하면 사료 위에 조금만 얹어 주세요.',
  },
  {
    q: '하루에 얼마나 줘야 하나요?',
    a: '체중·나이·중성화 여부·활동량·체형에 따라 아이마다 달라요. 같은 5kg이라도 활발한 두 살과 조용한 열 살은 하루에 필요한 열량이 꽤 다르거든요. 파머스테일 앱에 우리 아이 정보를 넣으면 하루 양을 그램 단위로 계산해 드려요.',
  },
  {
    q: '다른 레시피와 번갈아 줘도 되나요?',
    a: '네. 끼니마다 번갈아 주셔도 되고, 한 봉투를 다 쓰고 다음으로 넘어가셔도 좋아요. 한 가지 단백질만 오래 먹는 것보다 여러 단백질을 경험하는 편이 좋아요. 어느 쪽을 더 잘 먹는지 지켜보면 다음에 고를 때 좋은 힌트가 돼요.',
  },
  {
    q: '개봉한 뒤엔 언제까지 줄 수 있나요?',
    a: '녹인 뒤에는 냉장실에 두고 3일 안에 주세요. 얼린 채로는 냉동실(-18℃)에서 봉투에 적힌 유통기한까지 둘 수 있어요. 한 번 녹인 봉투는 다시 얼리지 마세요. 품질도 식감도 떨어져요.',
  },
  {
    q: '바꾸고 나서 변이 달라졌어요',
    a: '식단이 바뀌면 변도 함께 바뀌는 게 자연스러워요. 화식은 소화 흡수율이 높아 변 양이 줄고 색이 진해지는 경우가 많아요. 바꾸는 며칠 동안 살짝 무른 정도는 지켜봐도 괜찮지만, 물설사·구토가 함께 오거나 며칠 넘게 이어지면 멈추고 수의사와 상의해 주세요.',
  },
  {
    q: '물을 예전보다 덜 마시는 것 같아요',
    a: '화식은 건사료보다 수분이 훨씬 많아요. 밥에서 이미 수분을 먹으니 물그릇을 찾는 횟수가 줄어드는 건 흔한 변화예요. 다만 물그릇은 늘 신선하게 채워 두세요. 마시는 양은 줄어도 마실 수 있어야 하니까요.',
  },
  {
    q: '간식은 계속 줘도 되나요?',
    a: '주셔도 돼요. 다만 간식이 많아지면 애써 맞춘 식단의 균형이 간식 쪽으로 기울어요. 간식 열량이 하루 열량의 열에 하나를 넘지 않게 해 주세요. 앱에 간식을 얼마나 자주 주는지 알려 주시면 하루 양 계산에 넣어 드려요.',
  },
  {
    q: '사람이 먹어도 되는 건가요?',
    a: '재료는 사람이 먹을 수 있는 등급을 쓰고 사람 식품과 같은 위생 기준으로 다루지만, 간은 하지 않고 영양 균형이 강아지 기준으로 맞춰져 있어요. 한 입 맛보셔도 큰일은 없지만, 맛은 심심하실 거예요. 이 밥의 주인공은 따로 있으니까요.',
  },
] as const

const won = (n: number) => n.toLocaleString('ko-KR')

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** 섹션 제목(시안 C01 — 포스터 글꼴 30px). */
function H2({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 className="d" style={{ margin: 0, fontSize: 30, lineHeight: 1.12, ...style }}>
      {children}
    </h2>
  )
}

const FACT_DT: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#595959' }

export default async function RecipeDetailPage({ params }: { params: Params }) {
  const { protein } = await params
  const key = protein as WebRecipe['protein']
  const recipe = WEB_RECIPES[key]
  const d = RECIPE_DETAIL[key]
  const story = RECIPE_STORY[key]
  const extraFaq = RECIPE_FAQ[key]
  if (!recipe || !d || !story || !extraFaq) notFound()

  const band = RECIPE_BAND[key]
  const ledger = recipeLedger(key)
  const item500 = storeItem(`${key}-500g`)

  // 4종 열량 막대 — 정본(kcal/100g). 0 기준 폭이라 과장이 없다(서로 비슷한 값이고, 그 "비슷하지만 다르다"가
  // 하루 양이 달라지는 이유). 이름은 이 화면의 제품 표기명(RECIPE_DETAIL.displayName)과 통일한다.
  const kcalRows = WEB_RECIPE_ORDER.map((p) => ({
    p,
    name: RECIPE_DETAIL[p].displayName.replace(' 레시피', ''),
    kcal: WEB_RECIPES[p].kcalPer100g,
  }))
  const kcalMax = Math.max(...kcalRows.map((r) => r.kcal))
  const others = WEB_RECIPE_ORDER.filter((p) => p !== key)

  // ★앱(Capacitor) 진입이면 가게 틀 대신 앱 윗줄 — 같은 내용에서 웹 전용 두 줄(사기·앱 띠)만 뺀다.
  const isApp = await isAppContextServer()

  // 줄 높이 기본값 = 시안(normal). 사이트 기본(1.5)을 물려받으면 칸·줄마다 조금씩 길어진다 — 여러 줄 글은 각자 값을 준다.
  const body = (
    <div style={{ lineHeight: 'normal' }}>
      {/* ── 히어로 — 머리말(레시피 색 네모) · 제목 · 소개 · 이런 아이에게 ── */}
      <section style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#3D3D3D' }}>
          <span aria-hidden style={{ width: 12, height: 12, flexShrink: 0, background: band }} />
          {d.displayName} · {d.kicker}
        </span>
        <h1 className="d" style={{ margin: '10px 0 0', fontSize: 40, lineHeight: 1.1 }}>
          {d.headline[0]}
          <br />
          {d.headline[1]}
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>{d.lede}</p>
        <div aria-label="이런 아이에게" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {d.forWho.map((w) => (
            <span
              key={w}
              style={{ height: 36, padding: '0 12px', borderRadius: 4, border: '1px solid #BDBDBD', boxSizing: 'border-box', display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700 }}
            >
              {w}
            </span>
          ))}
        </div>
      </section>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={RECIPE_REAL_IMG[key]}
        alt={`나무 식탁 위 ${d.displayName} 한 그릇과 팩`}
        width={1200}
        height={800}
        fetchPriority="high"
        style={{ marginTop: 22, width: '100%', aspectRatio: '390 / 224', objectFit: 'cover', objectPosition: '50% 62%', display: 'block' }}
      />

      <section style={{ padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
        {/* 요약 4칸 — 봉투에서 가장 먼저 궁금한 것. 사진 위로 28px 겹친다. */}
        <dl
          style={{
            margin: '-28px 0 0',
            position: 'relative',
            zIndex: 2,
            background: '#FFFFFF',
            border: '2px solid #141414',
            boxShadow: '4px 4px 0 #141414',
            borderRadius: 4,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
          }}
        >
          <div style={{ padding: '14px 16px', borderRight: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <dt style={FACT_DT}>열량</dt>
            <dd style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
              <span className="n" style={{ fontSize: 30, lineHeight: 1.05 }}>
                {recipe.kcalPer100g}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>kcal</span>
              <span style={{ fontSize: 13, color: '#595959' }}>100g</span>
            </dd>
          </div>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <dt style={FACT_DT}>단백질원</dt>
            <dd className="d" style={{ margin: 0, fontSize: 22, lineHeight: 1.4 }}>
              {key === 'duck' ? '오리 단일' : d.displayName.replace(' 레시피', '')}
            </dd>
          </div>
          <div style={{ padding: '14px 16px', borderRight: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <dt style={FACT_DT}>조리</dt>
            <dd style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>수비드 저온</dd>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <dt style={FACT_DT}>배송</dt>
            <dd style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>얼린 채로</dd>
          </div>
        </dl>

        {/* 이 레시피 사기 — 웹 가게 상품으로(기획서 §5.1 "상세에 한 줄만 추가"). 앱은 단품을 팔지 않는다. */}
        {!isApp && (
          <Link
            href={`/store/${key}`}
            style={{ marginTop: 22, minHeight: 64, borderTop: '2px solid #141414', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: '#141414', textDecoration: 'none' }}
          >
            <span style={{ fontSize: 18, fontWeight: 800 }}>이 레시피 사기</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 15, color: '#595959' }}>스토어 · 500g</span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <span className="n" style={{ fontSize: 22 }}>
                  {won(item500.price)}
                </span>
                <span className="d" style={{ fontSize: 15 }}>
                  원
                </span>
              </span>
              <Chevron />
            </span>
          </Link>
        )}
      </section>

      {/* ── 탄생 이야기 — 스펙보다 "왜 만들었나"부터 ── */}
      <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>탄생 이야기</span>
        <H2 style={{ marginTop: 6 }}>{story.hand} 만들었어요</H2>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {story.paragraphs.map((para, i) => (
            <p key={i} style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: '#3D3D3D' }}>
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* ── 주요 재료 — 이름은 정본(lib/recipe-ingredients), 아래 전체 원재료도 같은 정본 ── */}
      <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <H2>이 봉투의 주요 재료</H2>
        <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: '#595959' }}>신선한 원물을 먼저 쓰고, 원물로 채우기 어려운 것만 조금 보충해요.</p>
        <dl style={{ margin: '16px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          {ledger.map((row) => (
            <div
              key={row.label}
              style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '84px 1fr', columnGap: 8, alignItems: 'baseline' }}
            >
              <dt style={FACT_DT}>{row.label}</dt>
              <dd style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ fontSize: 18, fontWeight: 800 }}>{row.name}</strong>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: '#3D3D3D' }}>{row.note}</span>
              </dd>
            </div>
          ))}
        </dl>
        {/* ★전체 원재료 — 정본(등록 서류·DB 와 같은 목록) 그대로. 위는 이야기가 있는 주요 재료만이라 '모든 것'이라 부르지 않는다. */}
        <div style={{ marginTop: 14, padding: 16, borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 16, fontWeight: 800 }}>전체 원재료</strong>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: '#3D3D3D' }}>{fullIngredientNames(PROTEIN_LINE[key]).join(', ')}</p>
          <span style={{ fontSize: 14, color: '#595959' }}>배합 비율은 봉투 라벨의 표기를 따라요.</span>
        </div>
      </section>

      {/* ── 4종 열량 — 이 레시피만 레시피 색, 나머지는 회색 ── */}
      <section style={{ marginTop: 48, padding: '40px 20px 36px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
        <H2>
          같은 100g이라도
          <br />
          레시피마다 열량이 달라요
        </H2>
        <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: '#595959' }}>열량이 진할수록 같은 양에서 하루에 주는 양이 줄어요.</p>
        <div
          role="img"
          aria-label={`레시피 4종의 100g당 열량 — ${kcalRows.map((r) => `${r.name} ${r.kcal}`).join(', ')}킬로칼로리`}
          style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {kcalRows.map((r) => {
            const active = r.p === key
            return (
              <div key={r.p} style={{ display: 'grid', gridTemplateColumns: '62px 1fr 76px', columnGap: 10, alignItems: 'center' }}>
                <span className={active ? 'd' : undefined} style={active ? { fontSize: 18 } : { fontSize: 16, fontWeight: 600, color: '#595959' }}>
                  {r.name}
                </span>
                <span style={{ height: 16, background: '#FFFFFF' }}>
                  <span style={{ display: 'block', width: `${(r.kcal / kcalMax) * 100}%`, height: 16, background: active ? band : '#CFCFCF' }} />
                </span>
                <span
                  style={{ textAlign: 'right', whiteSpace: 'nowrap', ...(active ? { fontSize: 17, fontWeight: 900 } : { fontSize: 16, fontWeight: 600, color: '#595959' }) }}
                >
                  {r.kcal}kcal
                </span>
              </div>
            )
          })}
        </div>
        <span style={{ marginTop: 14, fontSize: 14, color: '#595959' }}>100g 기준 · 앱의 하루 양 계산과 같은 숫자예요</span>
      </section>

      {/* ── 만드는 과정 — 실제 순서(번호가 곧 정보) ── */}
      <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <H2>
          천천히 익히는 데
          <br />
          이유가 있어요
        </H2>
        <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>
          고온·고압으로 찍어내면 열에 약한 영양과 수분이 함께 빠져요. 그래서 진공 저온으로 천천히 익혀요.
        </p>
        <ol style={{ margin: '18px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          {PROCESS_STEPS.map((s, i) => (
            <li
              key={s.t}
              style={{ padding: '16px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '44px 1fr', columnGap: 10, alignItems: 'start' }}
            >
              <span className="d" aria-hidden style={{ width: 32, height: 32, background: '#141414', color: '#FFFFFF', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i + 1}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <strong style={{ fontSize: 18, fontWeight: 800 }}>{s.t}</strong>
                <span style={{ fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 등록성분 — 검사 결과 전까지 숫자 없이(가게 상품 화면과 같은 말). 성분 % 는 싣지 않는다. ── */}
      <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <H2>등록성분</H2>
        <p style={{ margin: '12px 0 0', padding: 16, borderRadius: 4, background: '#F6F4F5', fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>
          공인 기관의 검사 결과가 나오는 대로 이 자리에 그대로 올려요. 그 전까지는 봉투 뒷면 라벨의 표기가 기준이에요.
        </p>
      </section>

      {/* ── 처음 일주일 + 보관 ── */}
      <section style={{ marginTop: 48, padding: '40px 20px 36px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
        <H2>
          천천히 바꿔야
          <br />
          편하게 적응해요
        </H2>
        <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>기존 사료에 조금씩 섞어 일주일에 걸쳐 늘려 주세요.</p>
        <ol style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TRANSITION_PHASES.map((ph) => (
            <li
              key={ph.day}
              style={{ padding: '12px 14px', background: '#FFFFFF', display: 'grid', gridTemplateColumns: '62px 1fr', columnGap: 10, rowGap: 6, alignItems: 'center' }}
            >
              <span className="d" style={{ fontSize: 19 }}>
                {ph.day}
              </span>
              <span aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} style={{ height: 10, background: n <= ph.fill ? band : '#EFEDEE' }} />
                ))}
              </span>
              <span style={{ gridColumn: '1 / 3', fontSize: 16, lineHeight: 1.5 }}>{ph.label}</span>
            </li>
          ))}
        </ol>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, textAlign: 'center' }}>
          {[
            ['보관', '냉동실'],
            ['해동', '전날 냉장실'],
            ['녹인 봉투', '3일 안에'],
          ].map(([k, v]) => (
            <span key={k} style={{ padding: '12px 4px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, color: '#595959' }}>{k}</span>
              <strong style={{ fontSize: 16 }}>{v}</strong>
            </span>
          ))}
        </div>
        <span style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: '#595959' }}>
          전자레인지는 고르게 데워지지 않아 권하지 않아요. 한 번 녹인 봉투는 다시 얼리지 마세요.
        </span>
      </section>

      {/* ── 자주 묻는 것 — details 라 JS 없이 열고 닫는다. 첫 질문만 열어 둔다. ── */}
      <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <H2>
          먹이기 전에
          <br />
          자주 묻는 것들
        </H2>
        <div style={{ marginTop: 14, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          {[...FEEDING_FAQ, ...extraFaq].map((f, i) => (
            <details key={f.q} open={i === 0} style={{ borderBottom: '1px solid #E5E5E5' }}>
              <summary style={{ minHeight: 56, padding: '10px 0', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>
                {f.q}
                <span aria-hidden className="fts-acc-plus" style={{ fontSize: 26, fontWeight: 300 }}>
                  +
                </span>
                <span aria-hidden className="fts-acc-minus" style={{ fontSize: 26, fontWeight: 300 }}>
                  −
                </span>
              </summary>
              <p style={{ margin: '0 0 18px', fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── 다른 레시피 — QR 화면끼리만 잇는다(팩 사진 + 레시피 색 띠) ── */}
      <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <H2 style={{ fontSize: 26, marginBottom: 6 }}>다른 레시피도 궁금하다면</H2>
        {others.map((p) => (
          <Link
            key={p}
            href={`/recipe/${p}`}
            style={{ minHeight: 80, borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '60px 1fr 18px', columnGap: 14, alignItems: 'center', color: '#141414', textDecoration: 'none' }}
          >
            <span style={{ position: 'relative', width: 60, height: 60, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={RECIPE_STUDIO_IMG[p]} alt="" width={120} height={120} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: RECIPE_BAND[p] }} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="d" style={{ fontSize: 19 }}>
                {RECIPE_DETAIL[p].displayName}
              </span>
              <span style={{ fontSize: 15, color: '#595959' }}>{WEB_RECIPES[p].concept}</span>
            </span>
            <Chevron />
          </Link>
        ))}
      </section>

      {/* ── 앱 띠 — 웹만. 하루 양·정기배송은 앱(웹엔 '맞춤' 상품이 없다 — 앱을 가리킬 때만 쓴다). ── */}
      {isApp ? (
        <div aria-hidden style={{ height: 'calc(48px + env(safe-area-inset-bottom, 0px))' }} />
      ) : (
        <section style={{ padding: '40px 20px 48px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>나이·체형까지 본 하루 양은 앱에서 알려드려요</span>
          <Link
            href="/app"
            style={{ minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, color: '#141414', textDecoration: 'none' }}
          >
            <span>
              우리 아이 맞춤 정기배송은 <strong style={{ fontWeight: 800, color: '#1D3B2F' }}>앱에서 {SUBSCRIPTION_DISCOUNT_PCT}% 할인</strong>
            </span>
            <Chevron />
          </Link>
        </section>
      )}
    </div>
  )

  if (isApp) {
    return (
      <div className="fts">
        <AppTopBar title={d.displayName} />
        <main className="fts-col">{body}</main>
      </div>
    )
  }

  return <StoreShell>{body}</StoreShell>
}
