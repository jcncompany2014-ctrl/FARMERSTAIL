import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  Leaf,
  ShieldCheck,
  Soup,
  Snowflake,
  Check,
  Sparkles,
} from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  PhotoSlot,
  Section,
} from '@/components/web/fd/ui'
import { WEB_RECIPES, type WebRecipe } from '@/lib/web-recipes'
import { RECIPE_DETAIL } from '@/lib/recipe-detail'

/**
 * /recipe/[protein] — 제품 뒷면 QR 전용 레시피 상세 (2026-07-06, 사장님 지시).
 *
 * ★진입 = QR 만: 사이트 nav·푸터·내부 링크 어디에도 걸지 않고, robots.ts 에서
 * /recipe/ disallow + 아래 metadata noindex + sitemap 미등재. 제품 포장의 QR
 * 로만 도달. (역방향 /start CTA 는 허용 — 관심 생긴 사람을 설문으로.)
 *
 * 데이터 = lib/web-recipes(공개 최소) + lib/recipe-detail(마케팅 카피·초안).
 * ⚠️ 카피는 임의 초안 — 사장님 검토 후 조정. 효능 단정·질병 치료 표현 금지.
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

export default async function RecipeDetailPage({ params }: { params: Params }) {
  const { protein } = await params
  const key = protein as WebRecipe['protein']
  const recipe = WEB_RECIPES[key]
  const d = RECIPE_DETAIL[key]
  if (!recipe || !d) notFound()

  return (
    <WebChrome>
      <main>
        {/* ── Hero: 사진 + 페르소나 헤드라인 ── */}
        <Section bg="offwhite" pad="md">
          <Container size="lg">
            <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
              <div>
                <Eyebrow>{d.eyebrow}</Eyebrow>
                <Display as="h1" size="xl" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                  {d.headline[0]}
                  <br />
                  {d.headline[1]}
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
              <PhotoSlot
                label={d.displayName}
                src={d.heroImg}
                alt={`파머스테일 ${d.displayName} — 완성된 신선 화식과 원재료`}
                ratio="3 / 2"
                tone="cream"
                rounded={14}
                className="w-full"
              />
            </div>
          </Container>
        </Section>

        {/* ── 핵심 원물 3종 ── */}
        <Section bg="white" pad="md">
          <Container size="md">
            <div className="text-center">
              <Eyebrow>Key Ingredients · 핵심 원물</Eyebrow>
              <Display as="h2" size="lg" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                이 레시피의 주인공
              </Display>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-3 md:gap-6">
              {d.keyIngredients.map((ing, i) => (
                <div
                  key={ing.name}
                  className="text-center rounded-[12px] px-5 py-7 h-full"
                  style={{ background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                >
                  <div
                    className="mx-auto flex items-center justify-center"
                    style={{ width: 40, height: 40, borderRadius: 999, background: '#FFFFFF', color: 'var(--fd-coral)', fontWeight: 900, fontSize: 15 }}
                  >
                    {i + 1}
                  </div>
                  <div className="mt-4" style={{ fontSize: 17, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>
                    {ing.name}
                  </div>
                  <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fd-muted)' }}>
                    {ing.role}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </Section>

        {/* ── 왜 이 레시피 (3포인트) ── */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>Why · 이 레시피의 이유</Eyebrow>
            <ul className="mt-6 space-y-4">
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
                      <Check size={15} strokeWidth={3} />
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

        {/* ── 주재료 전체 ── */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Eyebrow>Full Ingredients · 전체 재료</Eyebrow>
            <div
              className="mt-4 rounded-[12px] px-6 py-6"
              style={{ background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
            >
              <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--fd-pine)', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
                {recipe.mainIngredients}
              </p>
              <p className="mt-3" style={{ fontSize: 13, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
                신선한 자연 원물을 우선하고, 자연으로 채우기 어려운 미네랄·비타민만
                전용 프리믹스로 보충했어요. 심장으로 자연 타우린을, 연어유로
                오메가-3를 더했어요.
              </p>
            </div>
          </Container>
        </Section>

        {/* ── 기준·특징 4카드 ── */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>Standard · 어떻게 만드나요</Eyebrow>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { Icon: ShieldCheck, t: '3중 영양 표준 충족', d: '미국(AAFCO)·유럽(FEDIAF)·한국(NIAS) 기준을 동시에 충족하고, 여기에 +15% 안전 마진을 더했어요.' },
                { Icon: Soup, t: '수비드 저온 조리', d: '고온 압출 대신 수비드(진공 저온)로 천천히 익혀 수분·영양·풍미를 지켜요.' },
                { Icon: Leaf, t: '사람이 먹는 등급 원물', d: '사람이 먹을 수 있는 등급의 재료를, 사람 식품과 같은 위생 기준으로 다뤄요.' },
                { Icon: Snowflake, t: '급속 냉동 · 콜드체인', d: '조리 직후 급속 냉동해, 문 앞까지 냉동 상태 그대로 보내드려요.' },
              ].map(({ Icon, t, d: dd }) => (
                <li key={t} className="rounded-[12px] px-5 py-5 h-full" style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
                  <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--fd-offwhite)', color: 'var(--fd-green)' }}>
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                  <div className="mt-3" style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fd-pine)' }}>{t}</div>
                  <p className="mt-1.5" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fd-muted)' }}>{dd}</p>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        {/* ── 보장성분 분석표 (라벨 확정 후 채움) ── */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Eyebrow>Analysis · 보장성분</Eyebrow>
            <div
              className="mt-4 rounded-[12px] px-6 py-8 text-center"
              style={{ background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
            >
              <div className="mx-auto flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 999, background: '#FFFFFF', color: 'var(--fd-green)' }}>
                <Sparkles size={22} strokeWidth={2.2} />
              </div>
              <p className="mt-3" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--fd-pine)' }}>
                성분 분석표 준비 중
              </p>
              <p className="mt-2" style={{ fontSize: 12.5, color: 'var(--fd-muted)', lineHeight: 1.6, maxWidth: 420, marginInline: 'auto' }}>
                조단백·조지방·수분·칼슘·인 등 공인 분석 결과를 이곳에 투명하게
                공개할 예정이에요.
              </p>
            </div>
          </Container>
        </Section>

        {/* ── 급여·보관 가이드 ── */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>Guide · 급여 · 보관</Eyebrow>
            <ul className="mt-4 space-y-3">
              {[
                ['급여량', '우리 아이의 체중·활동량에 맞춘 정확한 하루 급여량은 2분 무료 설문에서 계산해 드려요.'],
                ['전환', '기존 사료에서 바꿀 땐 7~10일에 걸쳐, 기존 사료에 조금씩 섞어가며 늘려 주세요. 아이마다 속도가 다르니 천천히요.'],
                ['해동', '급여 전날 냉장실로 옮겨 자연 해동하세요. 급할 땐 미온수 중탕으로 데워 주세요(전자레인지는 권하지 않아요).'],
                ['보관', '냉동(-18℃) 보관하고, 개봉 후엔 냉장 3일 이내 급여를 권해요.'],
              ].map(([t, dd]) => (
                <li
                  key={t}
                  className="grid"
                  style={{ gridTemplateColumns: '56px 1fr', gap: 12, alignItems: 'baseline', paddingBottom: 12, borderBottom: '1px solid var(--fd-line)' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fd-coral)', letterSpacing: '0.02em' }}>{t}</span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--fd-pine)' }}>{dd}</span>
                </li>
              ))}
            </ul>
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
                2분 무료 설문으로 우리 아이 체형·건강에 맞는 레시피와 하루 급여량을
                확인해 보세요. 첫 박스는 50% 할인이에요.
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
