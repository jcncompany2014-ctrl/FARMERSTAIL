import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  Leaf,
  Soup,
  Snowflake,
  Check,
  Eye,
  FlaskConical,
  Thermometer,
  Refrigerator,
  CalendarDays,
} from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import WebMotion from '@/components/web/motion/WebMotion'
import AppTopBar from './AppTopBar'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  Hand,
  PhotoSlot,
  Section,
} from '@/components/web/fd/ui'
import { WEB_RECIPES, WEB_RECIPE_ORDER, type WebRecipe } from '@/lib/web-recipes'
import { FRESH_TIERS } from '@/lib/subscription/freshTier'
import { isAppContextServer } from '@/lib/app-context'
import {
  RECIPE_DETAIL,
  RECIPE_FAQ,
  RECIPE_LEDGER,
  RECIPE_STORY,
} from '@/lib/recipe-detail'

/**
 * /recipe/[protein] — 제품 뒷면 QR 전용 레시피 상세 (2026-07-06, 사장님 지시).
 *
 * ★진입 = QR 만: 사이트 nav·푸터·내부 링크 어디에도 걸지 않고, robots.ts 에서
 * /recipe/ disallow + 아래 metadata noindex + sitemap 미등재. 제품 포장의 QR
 * 로만 도달. (역방향 /start CTA 는 허용 — 관심 생긴 사람을 설문으로.
 * /recipe ↔ /recipe 상호 링크도 허용 — 어느 쪽이든 출발점이 QR 이어야만
 * 도달할 수 있으므로 "QR 전용 진입" 속성이 깨지지 않고, 박스에는 늘 2종
 * 레시피가 함께 오므로 다른 봉투의 이야기를 이어 읽는 동선이 자연스럽다.)
 *
 * # 2026-08-14 전면 업그레이드 — "봉투 뒷면 라벨을 에디토리얼로 뒤집는다"
 * 독자는 **방금 파우치를 손에 든 보호자**다(첫 박스 개봉 직후가 다수).
 * 페이지의 단일 임무: 이 봉투 안 음식이 무엇으로·어떻게 만들어졌는지를
 * 원장(ledger)처럼 투명하게 보여줘 신뢰를 만들고, 아직 설문 전인 보호자
 * (선물·가족 공유 박스)를 /start 로 보낸다. 구성:
 *   히어로(퀵팩트 4) → 원물 원장 → 왜 이 레시피 → kcal 스펙트럼(4종 정본)
 *   → 수비드 공정 → 기준·보장성분 → 처음 2주 가이드 → FAQ → 다른 레시피 → CTA
 *
 * 데이터 = lib/web-recipes(공개 최소) + lib/recipe-detail(마케팅 카피·원장).
 * ⚠️ 카피는 임의 초안 — 사장님 검토 후 조정. 효능 단정·질병 치료 표현 금지.
 * ⚠️ 영양소 % 는 어디에도 없다(성분% 노출 금지 — 정확 수치 대신 서술).
 *    유일한 숫자는 kcal/100g — SKU_MODEL 정본에서 오며 앱·웹이 같은 값이다.
 * 보장성분 분석표는 라벨 확정(미량영양소 분석) 후 채운다 — 지금은 자리만.
 *
 * ⚠️ QR 영구성: 이 URL 경로(/recipe/{protein})는 인쇄물에 박히면 못 바꾸므로
 * 절대 변경 금지. protein 키(chicken/duck/pork/beef)도 고정.
 */

export const dynamicParams = false // 4종 외 protein 은 404

type Params = Promise<{ protein: string }>

const PROTEINS: WebRecipe['protein'][] = ['chicken', 'duck', 'pork', 'beef']

export function generateStaticParams() {
  return PROTEINS.map((protein) => ({ protein }))
}

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
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
 * 수비드 공정 — 실제 만드는 순서라 번호가 정보다.
 * ★카피 근거: 전부 기존 승인 카피(our-food SOUS-VIDE 절·about 무첨가 표)에서
 * 가져오거나 그 수위로 맞췄다. "당일 손질"·"뼈를 걸러낸다" 같은 **검증 안 된
 * 공정 세부를 지어내지 않는다** — 단정 대신 "줄여요/늦춰요" 톤.
 */
const PROCESS_STEPS = [
  {
    Icon: Leaf,
    t: '원물 손질',
    d: '사람이 먹을 수 있는 등급의 재료를, 사람 식품과 같은 위생 기준으로 손질해요.',
  },
  {
    Icon: FlaskConical,
    t: '진공 포장',
    d: '손질한 재료를 레시피 배합대로 담아 진공 포장해요. 공기를 빼 산화를 늦추고, 조리 중 영양이 물에 씻겨 나가는 손실을 줄여요.',
  },
  {
    Icon: Soup,
    t: '수비드 저온 조리',
    d: '센 불에 빠르게 굽는 대신, 알맞은 저온에서 천천히 익혀요. 영양·수분·풍미 손실이 적은 이유예요.',
  },
  {
    Icon: Snowflake,
    t: '급속 냉동 · 콜드체인',
    d: '조리 후 신선하게 식혀 급속 냉동하고, 문 앞까지 냉동 상태 그대로 보내드려요. 보존제는 넣지 않아요.',
  },
] as const

/**
 * 처음 2주 전환 램프 — 기존 사료에 화식을 섞는 비중을 시각 막대로.
 * 막대 채움(fill/4칸)만으로 "점점 늘린다"를 전한다.
 *
 * ★도착점 = '완전 화식'이 아니라 **내가 신청한 비율** (2026-09-05 사장님
 * 지적). 구독은 곁들임 30% · 반반 50% · 완전 화식 100% 세 비율 중 하나로
 * 오는데, 예전 카피는 무조건 "이제 완전히 전환"으로 끝나 곁들임·반반
 * 구독자에게 틀린 안내였다. 티어 정본 = lib/subscription/freshTier.
 */
const TRANSITION_PHASES = [
  { day: '1~2일', fill: 1, label: '기존 사료에 한두 숟갈만 섞어 시작해요' },
  { day: '3~4일', fill: 2, label: '잘 먹고 변이 편안하면 조금씩 늘려요' },
  { day: '5~6일', fill: 3, label: '신청한 비율 가까이 — 변 상태를 보며 조절해요' },
  { day: '7일~', fill: 4, label: '내 박스의 비율로 안착. 여기가 우리 아이의 매일이에요' },
] as const

/**
 * 파우치 스튜디오 컷 — 레시피별 패키지 목업(2026-08 앱 자산 정본과 동일 원본).
 * 상세페이지 중간의 시각 브레이크 요소(2026-09-05 사장님 요청).
 */
const POUCH_IMG: Record<WebRecipe['protein'], string> = {
  chicken: '/pouch-chicken.webp',
  duck: '/pouch-duck.webp',
  pork: '/pouch-blackpork.webp',
  beef: '/pouch-hanwoo.webp',
}

/**
 * 급여 순간의 질문들 — 파우치를 든 보호자가 실제로 검색하는 것.
 * 공통 8문항 + 레시피별 2문항(RECIPE_FAQ)이 이어 붙는다.
 */
const FEEDING_FAQ = [
  {
    q: '처음인데 잘 안 먹으려고 해요',
    a: '냉장 해동 직후엔 향이 약할 수 있어요. 미온수에 봉투째 몇 분 담가 살짝만 데워 보세요. 그러면 향이 살아나요. 전자레인지는 고르게 데워지지 않아 권하지 않아요. 그래도 낯설어하면 기존 사료 위에 화식을 조금만 얹어 향부터 익히게 해 주세요. 며칠에 걸쳐 비중을 늘리면 대부분 자연스럽게 넘어와요.',
  },
  {
    q: '하루에 얼마나 줘야 하나요?',
    a: '체중·나이·중성화 여부·활동량·체형에 따라 아이마다 달라요. 같은 5kg이라도 활발한 두 살과 조용한 열 살의 하루 필요 열량은 꽤 다르거든요. 2분 설문을 마치면 우리 아이 기준의 하루 급여량을 그램 단위로 계산해 드리고, 정기배송 중이라면 앱 홈에서 늘 확인할 수 있어요.',
  },
  {
    q: '박스에 온 두 레시피, 섞이거나 번갈아도 되나요?',
    a: '네. 박스에는 두 가지 레시피가 함께 담겨요. 끼니마다 번갈아 주셔도 되고, 한 봉투를 다 쓰고 다음으로 넘어가셔도 좋아요. 한 가지 단백질만 오래 먹는 것보다 여러 단백질을 경험하는 편이 좋아요. 어느 쪽을 더 잘 먹는지 지켜보는 것도 다음 박스를 고르는 좋은 힌트가 돼요.',
  },
  {
    q: '개봉한 뒤엔 언제까지 줄 수 있나요?',
    a: '개봉 후엔 밀봉해 냉장 보관하고 3일 안에 급여해 주세요. 개봉 전엔 냉동(-18℃)에서 봉투에 표기된 유통기한까지 보관할 수 있어요. 한 번 해동한 봉투를 다시 얼리는 건 권하지 않아요. 품질도 식감도 떨어지거든요.',
  },
  {
    q: '전환하고 나서 변이 달라졌어요',
    a: '식단이 바뀌면 변도 함께 바뀌는 게 자연스러워요. 화식은 소화 흡수율이 높아 변 양 자체가 줄고 색이 진해지는 경우가 많아요. 전환기 며칠간 살짝 무른 정도는 지켜봐도 괜찮지만, 물설사·구토가 함께 오거나 며칠 넘게 이어지면 급여를 멈추고 수의사와 상의해 주세요.',
  },
  {
    q: '물을 예전보다 덜 마시는 것 같아요',
    a: '화식은 건사료보다 수분이 훨씬 많아요. 밥에서 이미 수분을 섭취하니 물그릇 찾는 횟수가 줄어드는 건 흔한 변화예요. 다만 물그릇은 늘 신선하게 채워 두세요. 마시는 양은 줄어도 마실 수 있어야 하니까요.',
  },
  {
    q: '간식은 계속 줘도 되나요?',
    a: '주셔도 돼요. 다만 간식은 하루 칼로리의 10% 이내로 유지해 주세요. 그 이상이 되면 애써 맞춘 식단의 균형이 간식 쪽으로 기울어요. 설문에서 간식 급여 빈도를 알려주시면 급여량 계산에 반영해 드려요.',
  },
  {
    q: '사람이 먹어도 되는 건가요?',
    a: '재료는 사람이 먹을 수 있는 등급을 쓰고 사람 식품과 같은 위생 기준으로 다루지만, 간은 하지 않고 영양 균형이 강아지 기준으로 설계돼 있어요. 그러니 한 입 맛보셔도 큰일은 없지만, 맛은 심심하실 거예요. 이 밥의 주인공은 따로 있으니까요.',
  },
] as const

/**
 * 시기별 관찰 포인트 — "이런 효과가 있어요" 가 아니라 **"이런 점을 지켜봐
 * 주세요"**. 효능 단정 없이 보호자에게 관찰 프레임만 준다.
 */
const OBSERVE_TIMELINE = [
  {
    period: '첫 일주일',
    points: [
      '변 상태: 전환기엔 살짝 무를 수 있어요. 물설사가 아니면 지켜봐 주세요.',
      '먹는 속도: 향을 맡는 시간이 길어도 괜찮아요. 새 음식 앞의 신중함이에요.',
      '물 마시는 양: 수분 많은 밥이라 자연스럽게 줄 수 있어요.',
    ],
  },
  {
    period: '2주 ~ 한 달',
    points: [
      '변이 자리를 잡는지: 모양과 주기가 일정해지는 시기예요.',
      '밥그릇 앞 태도: 밥시간을 기다리기 시작하는 아이가 많아요.',
      '체중: 2주에 한 번 기록해 주세요. 앱이 변화에 맞춰 급여량을 다시 살펴요.',
    ],
  },
  {
    period: '그 후로',
    points: [
      '모질과 피부: 식단의 변화가 겉으로 드러나기까지는 털갈이 주기만큼 시간이 걸려요. 조급해하지 않아도 돼요.',
      '활력: 산책 때의 걸음, 놀이의 지속력 같은 일상의 신호를 봐 주세요.',
      '기록: 앱 일기에 남겨 두시면 다음 박스 추천이 더 정확해져요.',
    ],
  },
] as const

export default async function RecipeDetailPage({ params }: { params: Params }) {
  const { protein } = await params
  const key = protein as WebRecipe['protein']
  const recipe = WEB_RECIPES[key]
  const d = RECIPE_DETAIL[key]
  const ledger = RECIPE_LEDGER[key]
  const story = RECIPE_STORY[key]
  const extraFaq = RECIPE_FAQ[key]
  if (!recipe || !d || !ledger || !story || !extraFaq) notFound()

  // kcal 스펙트럼 — 4종 정본(kcal/100g)을 막대로. 0 기준 폭이라 과장이 없다
  // (실제로 서로 비슷한 값이고, 그 "비슷하지만 다르다"가 급여량이 달라지는 이유).
  // 이름은 이 페이지의 제품 표기명(RECIPE_DETAIL.displayName)과 통일한다 —
  // WEB_RECIPES.name('오리 화식')을 쓰면 한 화면에 명명이 두 벌이 된다.
  const kcalRows = WEB_RECIPE_ORDER.map((p) => ({
    p,
    name: RECIPE_DETAIL[p].displayName.replace(' 레시피', ''),
    kcal: WEB_RECIPES[p].kcalPer100g,
  }))
  const kcalMax = Math.max(...kcalRows.map((r) => r.kcal))

  const others = WEB_RECIPE_ORDER.filter((p) => p !== key)

  // ★앱(PWA/Capacitor) 진입이면 웹 chrome(내비·푸터) 없이 콘텐츠만 렌더 —
  //   좌상단 고정 ← 버튼 하나로 나간다(2026-09-05 사장님: 앱에서 "웹화면이
  //   다 보이는 느낌"). 콘텐츠 자체는 웹과 동일(QR 라벨 페이지 속성 유지).
  const isApp = await isAppContextServer()

  const content = (
      <main>
        {/* ── Hero: 페르소나 헤드라인 + 사진 + 퀵팩트 ── */}
        <Section bg="offwhite" pad="md" className="overflow-hidden">
          <Container size="lg">
            <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
              <div>
                <Eyebrow>{d.eyebrow}</Eyebrow>
                <Display as="h1" size="xl" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                  {/* 글자 스태거 등장(WebMotion). JS·reduced-motion 실패 시엔 평문 그대로. */}
                  <span data-gsap="hero-title" className="block">
                    {d.headline[0]}
                    <br />
                    {d.headline[1]}
                  </span>
                </Display>
                <p
                  className="mt-5 text-[15px] md:text-[17px]"
                  style={{ maxWidth: 520, lineHeight: 1.75, color: 'var(--fd-muted)' }}
                >
                  {d.lede}
                </p>
                {/* 이런 아이에게 — 페르소나 태그 */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {d.forWho.map((w) => (
                    <span
                      key={w}
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--fd-pine)',
                        background: '#FFFFFF',
                        border: '1px solid var(--fd-line)',
                        borderRadius: 999,
                        padding: '7px 14px',
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                {/* motion 제거(2026-09-02) — 실촬영 3:2 원본이 슬롯 비율과 정확히
                    일치하는 완성 구도(파우치+그릇)다. data-gsap-img 의 확대
                    (PC 1.14/모바일 1.26)가 가장자리 파우치를 잘라먹었다. */}
                <PhotoSlot
                  label={d.displayName}
                  src={d.heroImg}
                  alt={`파머스테일 ${d.displayName} — 완성된 신선 화식과 원재료`}
                  ratio="3 / 2"
                  tone="cream"
                  rounded={14}
                  className="w-full"
                  eager
                />
                {/* 퀵팩트 — 봉투에서 가장 먼저 궁금한 4가지.
                    kcal 은 SKU_MODEL 정본(앱과 같은 숫자). 영양소 % 는 싣지 않는다. */}
                <dl
                  className="mt-4 grid grid-cols-2 sm:grid-cols-4 rounded-[12px] overflow-hidden"
                  style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                >
                  {[
                    ['열량', `${recipe.kcalPer100g} kcal`, '100g 기준'],
                    ['단백질원', key === 'duck' ? '오리 단일' : d.displayName.replace(' 레시피', '')],
                    ['조리', '수비드 저온'],
                    ['배송', '냉동 콜드체인'],
                  ].map(([t, v, sub], i) => (
                    <div
                      key={t}
                      className="px-4 py-3.5 text-center"
                      style={{
                        borderLeft: i % 2 === 1 ? '1px solid var(--fd-line)' : undefined,
                        borderTop: i >= 2 ? '1px solid var(--fd-line)' : undefined,
                      }}
                    >
                      <dt style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--fd-muted)' }}>
                        {t}
                      </dt>
                      <dd className="mt-1" style={{ fontSize: 14.5, fontWeight: 900, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>
                        {v}
                        {sub && (
                          <span className="block" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--fd-muted)', marginTop: 1 }}>
                            {sub}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Container>
        </Section>

        {/* ── 탄생 이야기 — 페르소나 서사. 스펙이 아니라 "왜 만들었나"부터. ── */}
        <Section bg="cream" pad="md">
          <Container size="sm">
            <div className="text-center">
              <Eyebrow>Our Story · 탄생 이야기</Eyebrow>
              <Hand
                className="block mt-4"
                style={{ fontSize: 'clamp(26px, 5vw, 36px)' }}
              >
                {story.hand}
              </Hand>
            </div>
            <div className="mt-8 space-y-6">
              {story.paragraphs.map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: 15,
                    lineHeight: 1.9,
                    color: 'var(--fd-pine)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          </Container>
        </Section>

        {/* ── 원물 원장 — 이 페이지의 시그니처.
             봉투 뒷면 라벨을 에디토리얼로: 전 재료를 카테고리 원장으로 편다.
             카테고리(주단백질/내장/토핑/채소·곡물/오일·보충)가 곧 구조 —
             "무엇이 왜 들어갔는지"를 행 단위로 답한다. ── */}
        <Section bg="white" pad="md">
          <Container size="md">
            <div className="text-center">
              <Eyebrow>Full Ingredients · 원물 원장</Eyebrow>
              <Display as="h2" size="lg" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                이 봉투에 들어간
                <br />
                모든 것
              </Display>
              <p className="mx-auto mt-4" style={{ maxWidth: 460, fontSize: 14, lineHeight: 1.7, color: 'var(--fd-muted)' }}>
                숨긴 재료가 없어요. 신선한 자연 원물을 우선하고, 자연으로 채우기
                어려운 것만 최소한으로 보충해요.
              </p>
            </div>
            <div className="mt-10">
              {ledger.map((group) => (
                <div key={group.label} className="grid sm:grid-cols-[140px_1fr] gap-x-8">
                  <div
                    className="pt-5 sm:pt-6"
                    style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--fd-coral-text)' }}
                  >
                    {group.label}
                  </div>
                  <div>
                    {group.rows.map((row) => (
                      <div
                        key={row.name}
                        className="grid sm:grid-cols-[220px_1fr] gap-x-6 gap-y-1 py-5 sm:py-6"
                        style={{ borderBottom: '1px solid var(--fd-line)' }}
                      >
                        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--fd-pine)', letterSpacing: '-0.015em', lineHeight: 1.3 }}>
                          {row.name}
                        </div>
                        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--fd-muted)', alignSelf: 'center' }}>
                          {row.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center" style={{ fontSize: 12, color: 'var(--fd-muted)' }}>
              배합 비율은 우리 아이 맞춤 설계의 영역이라 봉투 라벨의 표기를
              따라요.
            </p>
          </Container>
        </Section>

        {/* ── 왜 이 레시피 (3포인트) ── */}
        <Section bg="cream" pad="md">
          <Container size="md">
            <Eyebrow>Why · 이 레시피의 이유</Eyebrow>
            <Display as="h2" size="md" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
              {d.displayName}가 살피는 것
            </Display>
            <ul className="mt-7 space-y-4">
              {d.points.map((p) => (
                <li
                  key={p.title}
                  className="rounded-[12px] px-6 py-6"
                  style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex items-center justify-center shrink-0"
                      style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--fd-offwhite)', color: 'var(--fd-green)', marginTop: 1 }}
                    >
                      <Check size={15} strokeWidth={3} aria-hidden />
                    </span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>{p.title}</div>
                      <p className="mt-1.5" style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--fd-muted)' }}>{p.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        {/* ── kcal 스펙트럼 — 4종 가운데 이 레시피의 자리.
             숫자는 kcal/100g 하나뿐이고 SKU_MODEL 정본에서 온다(앱과 동일).
             0 기준 막대라 차이가 과장되지 않는다 — "비슷하지만 다르고,
             그래서 급여량 계산이 달라진다"가 전하려는 사실이다. ── */}
        <Section bg="pine" pad="md">
          <Container size="md">
            <Eyebrow color="var(--fd-gold)">Energy · 4종 가운데 이 레시피</Eyebrow>
            <Display as="h2" size="md" className="mt-3" style={{ color: '#FFFFFF' }}>
              같은 100g, 레시피마다
              <br />
              다른 열량
            </Display>
            <p className="mt-4" style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)' }}>
              열량이 진한 레시피일수록 같은 양에서 하루 급여량이 줄어요. 설문이
              레시피마다 급여량을 따로 계산하는 이유예요.
            </p>
            <div className="mt-8 space-y-4" role="img" aria-label={`레시피 4종의 100g당 열량 — ${kcalRows.map((r) => `${r.name} ${r.kcal}킬로칼로리`).join(', ')}`}>
              {kcalRows.map((r) => {
                const active = r.p === key
                return (
                  <div key={r.p} className="grid grid-cols-[86px_1fr_74px] items-center gap-3">
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: active ? 900 : 700,
                        color: active ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {r.name}
                    </span>
                    <div style={{ height: 14, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(r.kcal / kcalMax) * 100}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: active ? 'var(--fd-coral)' : 'rgba(255,255,255,0.28)',
                        }}
                      />
                    </div>
                    <span
                      className="text-right"
                      style={{
                        fontSize: 13.5,
                        fontWeight: active ? 900 : 700,
                        color: active ? 'var(--fd-gold)' : 'rgba(255,255,255,0.55)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {r.kcal} kcal
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-6" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              100g 기준 · 앱의 급여량 계산과 같은 숫자예요.
            </p>
          </Container>
        </Section>

        {/* ── 파우치 — 이 이야기가 담기는 실제 봉투(스튜디오 컷).
             긴 정보 섹션 사이의 시각 브레이크(2026-09-05 사장님 요청). ── */}
        <Section bg="offwhite" pad="md">
          <Container size="sm">
            <div className="text-center">
              <Eyebrow>The Pouch · 봉투 그대로</Eyebrow>
              <Hand className="block mt-4" style={{ fontSize: 'clamp(24px, 4.5vw, 32px)' }}>
                이 이야기가 담기는 봉투
              </Hand>
            </div>
            <PhotoSlot
              label={`${d.displayName} 파우치`}
              src={POUCH_IMG[key]}
              alt={`파머스테일 ${d.displayName} 파우치 패키지`}
              ratio="1 / 1"
              tone="offwhite"
              rounded={14}
              className="mx-auto mt-7 w-full max-w-[380px]"
            />
            <p className="mx-auto mt-4 text-center" style={{ maxWidth: 380, fontSize: 12.5, lineHeight: 1.6, color: 'var(--fd-muted)' }}>
              지금 손에 든 그 봉투예요. 뒷면 라벨의 QR이 이 페이지로 이어져요.
            </p>
          </Container>
        </Section>

        {/* ── 영양 설계 — 기준·마진·급여량이 정해지는 방식을 풀어서 ── */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Eyebrow>Formulation · 영양 설계</Eyebrow>
            <Display as="h2" size="lg" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
              감이 아니라 기준으로
              <br />
              설계했어요
            </Display>
            <p
              className="mt-5"
              style={{ maxWidth: 560, fontSize: 14.5, lineHeight: 1.8, color: 'var(--fd-muted)' }}
            >
              &ldquo;몸에 좋은 재료를 넣었다&rdquo;와 &ldquo;완전한 한 끼&rdquo;는
              다른 말이에요. 좋은 재료를 모아도 영양 균형이 어긋나면 매일 먹는
              주식이 될 수 없어요. 그래서 이 레시피는 재료 선정보다 먼저,
              충족해야 할 기준부터 정해 두고 시작했어요.
            </p>
            <div className="mt-9 space-y-0">
              {[
                {
                  k: '기준',
                  t: '세 나라의 표준을 동시에',
                  b:
                    '반려동물 영양 표준은 나라마다 조금씩 달라요. 미국 AAFCO, 유럽 FEDIAF, 한국 NIAS. 어느 하나만 맞추는 대신 셋을 겹쳐 놓고, 세 기준을 전부 통과하는 영역 안에서만 설계해요. 기준끼리 어긋나는 항목은 더 엄격한 쪽을 따라요.',
                },
                {
                  k: '여유',
                  t: '기준선이 아니라 +15% 위에서',
                  b:
                    '표준의 최소치에 턱걸이로 맞추면, 조리·보관 과정의 자연스러운 변동만으로도 기준 아래로 내려갈 수 있어요. 그래서 필수 영양소는 기준보다 15% 여유를 두고 설계해요. 서류상 합격이 아니라, 실제 그릇에서의 합격이 목표니까요.',
                },
                {
                  k: '급여량',
                  t: '레시피가 아니라 아이 기준으로',
                  b:
                    '하루 급여량은 이 봉투가 아니라 우리 아이가 정해요. 체중·나이·중성화 여부·활동량·체형에서 하루 필요 열량을 계산하고, 그걸 이 레시피의 열량 밀도로 나눠 그램이 나와요. 위 스펙트럼에서 보셨듯 레시피마다 열량이 달라서, 같은 아이라도 레시피가 바뀌면 급여량이 함께 바뀌어요.',
                },
                {
                  k: '원칙',
                  t: '원물 먼저, 보충은 최소한',
                  b:
                    '타우린이 필요하면 타우린 분말이 아니라 심장을 넣는다. 이 주방의 순서는 그래요. 자연 원물로 채울 수 있는 건 원물로 먼저 채우고, 그래도 남는 미량 영양소만 전용 프리믹스로 메워요. 봉투 뒷면 원재료 목록이 짧고 읽기 쉬운 이유예요.',
                },
              ].map((row) => (
                <div
                  key={row.k}
                  className="grid sm:grid-cols-[92px_1fr] gap-x-8 gap-y-1 py-6"
                  style={{ borderBottom: '1px solid var(--fd-line)' }}
                >
                  <div
                    style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--fd-coral-text)', paddingTop: 4 }}
                  >
                    {row.k}
                  </div>
                  <div>
                    <div style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>
                      {row.t}
                    </div>
                    <p className="mt-2" style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--fd-muted)' }}>
                      {row.b}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </Section>

        {/* ── 수비드 공정 — 실제 만드는 순서(번호가 곧 정보) ── */}
        <Section bg="offwhite" pad="md">
          <Container size="lg">
            <div className="grid gap-10 md:grid-cols-2 md:gap-14 items-center">
              <div>
                <Eyebrow>Sous-vide · 만드는 과정</Eyebrow>
                <Display as="h2" size="lg" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                  천천히 익히는 데
                  <br />
                  이유가 있어요
                </Display>
                <p className="mt-4" style={{ maxWidth: 480, fontSize: 14.5, lineHeight: 1.75, color: 'var(--fd-muted)' }}>
                  사료처럼 고온·고압으로 찍어내면 오래 보관하기는 쉽지만, 열에
                  약한 영양과 수분이 함께 사라져요. 우리는 반대 방향을
                  골랐어요. <Hand style={{ fontSize: '1.35em' }}>수비드</Hand>,
                  진공 저온으로 천천히.
                </p>
                {/* ★kitchen-cooking.jpg 는 남의 주방을 "파머스테일 주방"이라고
                    주장하던 AI/스톡 컷 — 실촬영 수비드 컷으로 교체(2026-09-02). */}
                <PhotoSlot
                  label="주방 — 수비드 조리"
                  src="/kitchen-sousvide.jpg"
                  alt="파머스테일 주방에서 수비드로 조리하는 모습"
                  ratio="4 / 3"
                  tone="cream"
                  rounded={14}
                  className="mt-7 w-full max-w-[420px]"
                />
              </div>
              <ol className="space-y-0">
                {PROCESS_STEPS.map(({ Icon, t, d: dd }, i) => (
                  <li
                    key={t}
                    className="grid grid-cols-[44px_1fr] gap-x-4 py-6"
                    style={{ borderBottom: i < PROCESS_STEPS.length - 1 ? '1px solid var(--fd-line)' : undefined }}
                  >
                    <span
                      className="flex items-center justify-center"
                      style={{ width: 44, height: 44, borderRadius: 999, background: '#FFFFFF', color: 'var(--fd-green)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                    >
                      <Icon size={20} strokeWidth={2.2} aria-hidden />
                    </span>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--fd-coral-text)', fontVariantNumeric: 'tabular-nums' }}>
                          {i + 1}
                        </span>
                        <span style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>{t}</span>
                      </div>
                      <p className="mt-1.5" style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--fd-muted)' }}>{dd}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Container>
        </Section>

        {/* ── 보장성분 — 정직한 자리 + 읽는 법 안내(숫자 없이도 내용이 있게) ── */}
        <Section bg="cream" pad="md">
          <Container size="md">
            <Eyebrow>Analysis · 보장성분</Eyebrow>
            <Display as="h2" size="md" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
              추정치 대신,
              <br />
              실측을 기다려요
            </Display>
            <p className="mt-4" style={{ maxWidth: 560, fontSize: 14, lineHeight: 1.75, color: 'var(--fd-muted)' }}>
              보장성분 분석표는 공인 기관의 검사 결과가 나오는 대로 이 자리에
              그대로 공개할 거예요. 계산상 추정치를 먼저 적어 둘 수도 있지만
              그러지 않기로 했어요. 숫자는 실측이어야 숫자니까요.
              봉투 라벨의 표기가 언제나 기준이에요.
            </p>
            <div
              className="mt-7 rounded-[12px] px-6 py-6"
              style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
            >
              <div className="flex items-center gap-2.5">
                <FlaskConical size={17} strokeWidth={2.2} style={{ color: 'var(--fd-green)' }} aria-hidden />
                <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--fd-pine)' }}>
                  분석표가 오면, 이렇게 읽으시면 돼요
                </span>
              </div>
              <dl className="mt-4 space-y-3">
                {[
                  ['조단백', '단백질의 총량이에요. 근육과 모질의 재료가 돼요.'],
                  ['조지방', '에너지원이자 피부와 모질의 윤기 재료예요. 많다고 좋은 게 아니라 아이에게 맞아야 해요.'],
                  ['수분', '화식이 사료와 가장 다른 지점이에요. 갓 지은 밥처럼 수분이 살아 있거든요.'],
                  ['칼슘 · 인', '뼈를 지키는 두 미네랄이에요. 양보다 두 값의 균형이 중요해서 함께 봐요.'],
                ].map(([t, dd]) => (
                  <div key={t} className="grid grid-cols-[64px_1fr] gap-x-4">
                    <dt style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--fd-coral-text)' }}>{t}</dt>
                    <dd style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--fd-muted)' }}>{dd}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Container>
        </Section>

        {/* ── 처음 2주 가이드 — 전환 램프 + 해동·보관 ── */}
        <Section bg="white" pad="md">
          <Container size="md">
            <div className="text-center">
              <Eyebrow>First 2 Weeks · 처음 2주</Eyebrow>
              <Display as="h2" size="lg" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                천천히 바꿔야
                <br />
                편하게 적응해요
              </Display>
              <p className="mx-auto mt-4" style={{ maxWidth: 480, fontSize: 14, lineHeight: 1.7, color: 'var(--fd-muted)' }}>
                갑자기 바꾸면 좋은 음식도 배탈이 날 수 있어요. 기존 사료에
                조금씩 섞어 일주일에 걸쳐 늘려 주세요. 도착점은 &lsquo;전부
                화식&rsquo;이 아니라 <b style={{ color: 'var(--fd-pine)' }}>내가 신청한 비율</b>이에요
                — 파머스테일 밥은 세 가지 비율 중 설문에서 고른 만큼만 매일
                그릇에 담겨요.
              </p>
            </div>

            {/* 화식 비율 3단계 — 정본(lib/subscription/freshTier)에서 그대로.
                이 페이지의 전환 안내가 "무조건 완전 화식"으로 읽히지 않게,
                내 박스가 어느 비율로 오는지부터 보여준다(2026-09-05). */}
            <div className="mx-auto mt-8 grid max-w-[720px] gap-3 sm:grid-cols-3">
              {FRESH_TIERS.map((t) => (
                <div
                  key={t.key}
                  className="rounded-[12px] px-5 py-4"
                  style={{ background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                >
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontSize: 15.5, fontWeight: 900, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>
                      {t.label}
                    </span>
                    {'badge' in t && t.badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: 'var(--fd-coral-text)',
                          background: '#FFFFFF',
                          border: '1px solid var(--fd-line)',
                          borderRadius: 999,
                          padding: '2px 8px',
                        }}
                      >
                        처음이라면
                      </span>
                    )}
                  </div>
                  <div className="mt-1" style={{ fontSize: 12, fontWeight: 800, color: 'var(--fd-coral-text)' }}>
                    {t.sub}
                  </div>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-3 text-center" style={{ maxWidth: 480, fontSize: 12.5, lineHeight: 1.6, color: 'var(--fd-muted)' }}>
              화식이 처음이라면 곁들임부터 시작해, 아이가 잘 적응하면 다음
              박스에서 비율을 올려도 좋아요. 아이마다 속도가 다르니 변 상태를
              보며 한 단계씩요.
            </p>

            {/* 전환 램프 — 채움 칸(1~4/4)으로 "내 비율까지 점점"을 전한다. */}
            <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TRANSITION_PHASES.map((ph) => (
                <li key={ph.day} className="rounded-[12px] px-5 py-5" style={{ background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
                  <div className="flex items-center gap-2">
                    <CalendarDays size={15} strokeWidth={2.4} style={{ color: 'var(--fd-green)' }} aria-hidden />
                    <span style={{ fontSize: 13.5, fontWeight: 900, color: 'var(--fd-pine)' }}>{ph.day}</span>
                  </div>
                  <div className="mt-3 flex gap-1" aria-hidden>
                    {[1, 2, 3, 4].map((n) => (
                      <span
                        key={n}
                        style={{
                          height: 8,
                          flex: 1,
                          borderRadius: 999,
                          background: n <= ph.fill ? 'var(--fd-coral)' : '#FFFFFF',
                          boxShadow: n <= ph.fill ? undefined : 'inset 0 0 0 1px var(--fd-line)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-3" style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--fd-muted)' }}>{ph.label}</p>
                </li>
              ))}
            </ol>
            {/* 해동 · 보관 — 매일의 루틴이 되도록 구체적으로 */}
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  Icon: Thermometer,
                  t: '해동',
                  dd: '전날 밤, 다음 날 먹일 봉투를 냉장실로 옮겨 두세요. 저녁 산책 다녀와서 옮기는 걸 루틴으로 만들면 잊지 않아요. 급할 땐 미온수에 봉투째 담가 데워 주세요. 전자레인지는 고르게 데워지지 않아 권하지 않고, 한 번 해동한 봉투는 다시 얼리지 않아요.',
                },
                {
                  Icon: Refrigerator,
                  t: '보관',
                  dd: '박스가 도착하면 바로 냉동실(-18℃)로 옮겨 주세요. 2주 분량이 들어갈 자리를 미리 비워 두시면 편해요. 개봉 전엔 봉투에 표기된 유통기한까지, 개봉 후엔 밀봉해 냉장 3일 이내 급여를 권해요.',
                },
              ].map(({ Icon, t, dd }) => (
                <li key={t} className="rounded-[12px] px-5 py-5 flex items-start gap-3" style={{ background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
                  <span className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 999, background: '#FFFFFF', color: 'var(--fd-green)' }}>
                    <Icon size={19} strokeWidth={2.2} aria-hidden />
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fd-pine)' }}>{t}</div>
                    <p className="mt-1" style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--fd-muted)' }}>{dd}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        {/* ── 관찰 포인트 — 효능 약속이 아니라 지켜볼 것들 ── */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>What to Watch · 지켜봐 주세요</Eyebrow>
            <Display as="h2" size="md" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
              몸은 천천히,
              <br />
              정직하게 답해요
            </Display>
            <p className="mt-4" style={{ maxWidth: 540, fontSize: 14, lineHeight: 1.75, color: 'var(--fd-muted)' }}>
              새 식단의 답은 하루 만에 오지 않아요. 대신 아이의 몸이 곳곳에서
              신호를 보내요. 무엇을 언제 지켜보면 되는지 정리했어요. 앱 일기에
              기록해 두시면 다음 박스 추천이 그만큼 정확해져요.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {OBSERVE_TIMELINE.map((stage) => (
                <div
                  key={stage.period}
                  className="rounded-[12px] px-5 py-5"
                  style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                >
                  <div className="flex items-center gap-2">
                    <Eye size={15} strokeWidth={2.4} style={{ color: 'var(--fd-green)' }} aria-hidden />
                    <span style={{ fontSize: 13.5, fontWeight: 900, color: 'var(--fd-pine)' }}>
                      {stage.period}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {stage.points.map((pt) => (
                      <li
                        key={pt}
                        className="grid grid-cols-[10px_1fr] gap-x-2"
                        style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--fd-muted)' }}
                      >
                        <span aria-hidden style={{ color: 'var(--fd-coral)', fontWeight: 900 }}>·</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Container>
        </Section>

        {/* ── FAQ — 파우치를 든 순간의 질문들(공통 8 + 레시피별 2).
             details/summary 라 JS 불필요. ── */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Eyebrow>FAQ · 자주 묻는 질문</Eyebrow>
            <Display as="h2" size="md" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
              급여 전에 자주 묻는 것들
            </Display>
            <div className="mt-6 space-y-3">
              {[...FEEDING_FAQ, ...extraFaq].map((f) => (
                <details
                  key={f.q}
                  className="group rounded-[12px] overflow-hidden"
                  style={{ background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                >
                  <summary
                    className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                    style={{ fontSize: 15, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}
                  >
                    {f.q}
                    <span
                      className="shrink-0 transition-transform group-open:rotate-45"
                      style={{ fontSize: 20, fontWeight: 400, color: 'var(--fd-coral)', lineHeight: 1 }}
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-6 pb-5 -mt-1" style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--fd-muted)' }}>
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </Container>
        </Section>

        {/* ── 다른 레시피 — 박스에는 늘 2종이 함께 온다. QR-land 내부 링크. ── */}
        <Section bg="green" pad="md">
          <Container size="lg">
            <div className="text-center">
              <Eyebrow color="rgba(255,255,255,0.72)">More Recipes · 함께 온 봉투</Eyebrow>
              <Display as="h2" size="md" className="mt-3" style={{ color: '#FFFFFF' }}>
                박스 속 다른 레시피도
                <br />
                궁금하다면
              </Display>
            </div>
            <div className="mt-9 grid gap-5 sm:grid-cols-3">
              {others.map((p) => {
                const od = RECIPE_DETAIL[p]
                return (
                  <a
                    key={p}
                    href={`/recipe/${p}`}
                    className="group block rounded-[14px] overflow-hidden no-underline transition hover:-translate-y-1"
                    style={{ background: '#FFFFFF' }}
                  >
                    <PhotoSlot
                      label={od.displayName}
                      src={od.heroImg}
                      alt={`파머스테일 ${od.displayName}`}
                      ratio="4 / 3"
                      tone="cream"
                      rounded={0}
                      className="w-full"
                    />
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <div style={{ fontSize: 15.5, fontWeight: 900, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>
                          {od.displayName}
                        </div>
                        <div className="mt-0.5" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fd-muted)' }}>
                          {WEB_RECIPES[p].concept}
                        </div>
                      </div>
                      <ArrowRight size={17} strokeWidth={2.4} className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--fd-coral)' }} aria-hidden />
                    </div>
                  </a>
                )
              })}
            </div>
          </Container>
        </Section>

        {/* ── CTA — 역방향(설문)만 허용 ── */}
        <Section bg="pine" pad="lg">
          <Container size="sm">
            <div className="text-center">
              <Eyebrow color="rgba(255,255,255,0.72)">For Your Dog</Eyebrow>
              <Display as="h2" size="lg" className="mt-3" style={{ color: '#FFFFFF' }}>
                우리 아이에게 맞을까요?
              </Display>
              <p className="mx-auto mt-4 max-w-[40ch] text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                2분 무료 설문으로 우리 아이 체형·건강에 맞는 레시피와 하루
                급여량을 확인해 보세요. 부담 없이 시작할 수 있어요.
              </p>
              <div className="mt-7 flex justify-center">
                <Button href="/start" tone="cream" size="lg">
                  무료 맞춤 분석 시작하기
                  <ArrowRight size={18} strokeWidth={2.4} />
                </Button>
              </div>
            </div>
          </Container>
        </Section>
      </main>
  )

  if (isApp) {
    return (
      <div>
        <AppTopBar />
        <WebMotion />
        {content}
      </div>
    )
  }

  return (
    <WebChrome>
      <WebMotion />
      {content}
    </WebChrome>
  )
}
