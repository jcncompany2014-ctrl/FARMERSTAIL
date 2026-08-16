import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  Leaf,
  ShieldCheck,
  Soup,
  Snowflake,
  Check,
  FlaskConical,
  Thermometer,
  Refrigerator,
  CalendarDays,
} from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import WebMotion from '@/components/web/motion/WebMotion'
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
import { RECIPE_DETAIL, RECIPE_LEDGER } from '@/lib/recipe-detail'

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

/** 수비드 공정 — 실제 만드는 순서라 번호가 정보다. */
const PROCESS_STEPS = [
  {
    Icon: Leaf,
    t: '원물 손질',
    d: '사람이 먹을 수 있는 등급의 재료를 당일 손질해요. 뼈·연골처럼 위험한 부위는 이 단계에서 걸러져요.',
  },
  {
    Icon: FlaskConical,
    t: '진공 포장',
    d: '손질한 재료를 레시피 배합대로 담아 진공 포장해요. 공기를 빼면 산화가 멈추고, 조리 중 영양이 물에 녹아 빠져나가지 않아요.',
  },
  {
    Icon: Soup,
    t: '수비드 저온 조리',
    d: '높은 온도로 튀기거나 압출하는 대신, 낮은 온도에서 천천히 익혀요. 수분과 풍미가 그대로 남는 이유예요.',
  },
  {
    Icon: Snowflake,
    t: '급속 냉동 · 콜드체인',
    d: '조리 직후 급속 냉동해 문 앞까지 냉동 상태 그대로 보내드려요. 그래서 보존료가 필요 없어요.',
  },
] as const

/**
 * 처음 2주 전환 램프 — 기존 사료에 화식을 섞는 비중을 시각 막대로.
 * 숫자(%)는 쓰지 않는다 — 아이마다 속도가 다르고, 브랜드 보이스가 정확
 * 수치 단정을 피한다. 막대 채움(fill/4칸)만으로 "점점 늘린다"를 전한다.
 */
const TRANSITION_PHASES = [
  { day: '1~2일', fill: 1, label: '기존 사료에 한두 숟갈만 섞어 시작해요' },
  { day: '3~4일', fill: 2, label: '잘 먹고 변이 편안하면 절반씩 섞어요' },
  { day: '5~6일', fill: 3, label: '화식 위주로, 기존 사료는 조금만 남겨요' },
  { day: '7일~', fill: 4, label: '완전히 전환 — 이제 화식이 매일의 식사예요' },
] as const

/** 급여 순간의 질문들 — 파우치를 든 보호자가 실제로 검색하는 것. */
const FEEDING_FAQ = [
  {
    q: '처음인데 잘 안 먹으려고 해요',
    a: '냉장 해동 직후엔 향이 약할 수 있어요. 미온수에 봉투째 몇 분 담가 살짝만 데우면 향이 살아나 대부분 잘 먹어요. 전자레인지는 영양이 고르지 않게 데워져 권하지 않아요.',
  },
  {
    q: '하루에 얼마나 줘야 하나요?',
    a: '체중·나이·활동량에 따라 아이마다 달라요. 2분 설문을 마치면 우리 아이의 하루 급여량을 계산해 드리고, 정기배송 중이라면 앱 홈에서 언제나 확인할 수 있어요.',
  },
  {
    q: '박스에 온 두 레시피, 섞이거나 번갈아도 되나요?',
    a: '네. 박스에는 두 가지 레시피가 함께 담겨요 — 끼니마다 번갈아 주셔도, 한 봉투를 다 쓰고 다음으로 넘어가셔도 좋아요. 여러 단백질을 경험하는 것 자체가 도움이 돼요.',
  },
  {
    q: '개봉한 뒤엔 언제까지 줄 수 있나요?',
    a: '개봉 후엔 밀봉해 냉장 보관하고 3일 안에 급여해 주세요. 개봉 전엔 냉동(-18℃)에서 표기된 유통기한까지 보관할 수 있어요.',
  },
] as const

export default async function RecipeDetailPage({ params }: { params: Params }) {
  const { protein } = await params
  const key = protein as WebRecipe['protein']
  const recipe = WEB_RECIPES[key]
  const d = RECIPE_DETAIL[key]
  const ledger = RECIPE_LEDGER[key]
  if (!recipe || !d || !ledger) notFound()

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

  return (
    <WebChrome>
      <WebMotion />
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
                <PhotoSlot
                  label={d.displayName}
                  src={d.heroImg}
                  alt={`파머스테일 ${d.displayName} — 완성된 신선 화식과 원재료`}
                  ratio="3 / 2"
                  tone="cream"
                  rounded={14}
                  className="w-full"
                  motion
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
                        className="grid sm:grid-cols-[180px_1fr] gap-x-6 gap-y-1 py-5 sm:py-6"
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
                  골랐어요 — <Hand style={{ fontSize: '1.35em' }}>수비드</Hand>,
                  진공 저온으로 천천히.
                </p>
                <PhotoSlot
                  label="주방 — 수비드 조리"
                  src="/kitchen-cooking.jpg"
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

        {/* ── 기준 + 보장성분(정직한 자리) ── */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Eyebrow>Standard · 지키는 기준</Eyebrow>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { Icon: ShieldCheck, t: '3중 영양 표준 충족', dd: '미국(AAFCO)·유럽(FEDIAF)·한국(NIAS) 기준을 동시에 충족하고, 여기에 15% 안전 마진을 더했어요.' },
                { Icon: Leaf, t: '사람이 먹는 등급 원물', dd: '사람이 먹을 수 있는 등급의 재료를, 사람 식품과 같은 위생 기준으로 다뤄요.' },
              ].map(({ Icon, t, dd }) => (
                <li key={t} className="rounded-[12px] px-5 py-5 h-full" style={{ background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
                  <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: '#FFFFFF', color: 'var(--fd-green)' }}>
                    <Icon size={20} strokeWidth={2.2} aria-hidden />
                  </div>
                  <div className="mt-3" style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fd-pine)' }}>{t}</div>
                  <p className="mt-1.5" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fd-muted)' }}>{dd}</p>
                </li>
              ))}
            </ul>
            <div
              className="mt-4 rounded-[12px] px-6 py-6"
              style={{ background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
            >
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 999, background: '#FFFFFF', color: 'var(--fd-green)' }}>
                  <FlaskConical size={19} strokeWidth={2.2} aria-hidden />
                </span>
                <div>
                  <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--fd-pine)' }}>
                    보장성분 분석표는 공인 검사 결과가 나오는 대로 이 자리에 공개해요
                  </p>
                  <p className="mt-1.5" style={{ fontSize: 12.5, color: 'var(--fd-muted)', lineHeight: 1.65 }}>
                    조단백·조지방·수분·칼슘·인 — 추정치를 먼저 적는 대신, 실측
                    결과를 기다려요. 봉투 라벨의 표기가 언제나 기준이에요.
                  </p>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        {/* ── 처음 2주 가이드 — 전환 램프 + 해동·보관 ── */}
        <Section bg="cream" pad="md">
          <Container size="md">
            <div className="text-center">
              <Eyebrow>First 2 Weeks · 처음 2주</Eyebrow>
              <Display as="h2" size="lg" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                천천히 바꿔야
                <br />
                편하게 적응해요
              </Display>
              <p className="mx-auto mt-4" style={{ maxWidth: 440, fontSize: 14, lineHeight: 1.7, color: 'var(--fd-muted)' }}>
                갑자기 바꾸면 좋은 음식도 배탈이 나요. 기존 사료에 조금씩 섞어
                일주일에 걸쳐 늘려 주세요. 아이마다 속도가 다르니, 변 상태를
                보며 한 단계씩요.
              </p>
            </div>
            {/* 전환 램프 — %는 쓰지 않는다. 채움 칸(1~4/4)만으로 "점점"을 전한다. */}
            <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TRANSITION_PHASES.map((ph) => (
                <li key={ph.day} className="rounded-[12px] px-5 py-5" style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
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
                          background: n <= ph.fill ? 'var(--fd-coral)' : 'var(--fd-offwhite)',
                          boxShadow: n <= ph.fill ? undefined : 'inset 0 0 0 1px var(--fd-line)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-3" style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--fd-muted)' }}>{ph.label}</p>
                </li>
              ))}
            </ol>
            {/* 해동 · 보관 */}
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { Icon: Thermometer, t: '해동', dd: '급여 전날 냉장실로 옮겨 자연 해동하세요. 급할 땐 미온수에 봉투째 담가 데워 주세요 — 전자레인지는 권하지 않아요.' },
                { Icon: Refrigerator, t: '보관', dd: '개봉 전엔 냉동(-18℃), 개봉 후엔 밀봉해 냉장 3일 이내 급여를 권해요.' },
              ].map(({ Icon, t, dd }) => (
                <li key={t} className="rounded-[12px] px-5 py-5 flex items-start gap-3" style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
                  <span className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--fd-offwhite)', color: 'var(--fd-green)' }}>
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

        {/* ── FAQ — 파우치를 든 순간의 질문들. details/summary 라 JS 불필요. ── */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>FAQ · 자주 묻는 질문</Eyebrow>
            <Display as="h2" size="md" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
              급여 전에 자주 묻는 것들
            </Display>
            <div className="mt-6 space-y-3">
              {FEEDING_FAQ.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-[12px] overflow-hidden"
                  style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
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
    </WebChrome>
  )
}
