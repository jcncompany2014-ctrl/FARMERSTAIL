import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowRight, Leaf, ShieldCheck, Soup, Snowflake } from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  Section,
} from '@/components/web/fd/ui'
import { WEB_RECIPES, type WebRecipe } from '@/lib/web-recipes'

/**
 * /recipe/[protein] — 제품 뒷면 QR 전용 레시피 상세 (2026-07-06, 사장님 지시).
 *
 * ★진입 = QR 만: 사이트 nav·푸터·내부 링크 어디에도 걸지 않고, robots.ts 에서
 * /recipe/ disallow + 아래 metadata noindex + sitemap 미등재. 제품 포장의 QR
 * 로만 도달. (역방향 /start CTA 는 허용 — 관심 생긴 사람을 설문으로.)
 *
 * 데이터 = lib/web-recipes(마케팅 공개 수준). 보장성분 분석표는 라벨 확정(미량
 * 영양소 추가 분석) 후 이 페이지에 별도 섹션으로 채운다 — 지금은 자리만.
 *
 * ⚠️ QR 영구성: 이 URL 경로(/recipe/{protein})는 인쇄물에 박히면 못 바꾸므로
 * 절대 변경 금지. protein 키(chicken/duck/pork/beef)도 고정.
 */

export const dynamicParams = false // 4종 외 protein 은 404

type Params = Promise<{ protein: string }>

const PROTEINS: WebRecipe['protein'][] = ['chicken', 'duck', 'pork', 'beef']

// 검정증명서 제품 명칭과 정합 — 흑돼지·한우 표기.
const DISPLAY_NAME: Record<WebRecipe['protein'], string> = {
  chicken: '치킨 레시피',
  duck: '오리 레시피',
  pork: '흑돼지 레시피',
  beef: '한우 레시피',
}

export function generateStaticParams() {
  return PROTEINS.map((protein) => ({ protein }))
}

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { protein } = await params
  const recipe = WEB_RECIPES[protein as WebRecipe['protein']]
  const title = recipe ? `${DISPLAY_NAME[recipe.protein]} · 레시피 정보` : '레시피 정보'
  return {
    title,
    // ★QR 전용 — 검색 색인·팔로우 전부 차단.
    robots: { index: false, follow: false, nocache: true },
  }
}

export default async function RecipeDetailPage({ params }: { params: Params }) {
  const { protein } = await params
  const recipe = WEB_RECIPES[protein as WebRecipe['protein']]
  if (!recipe) notFound()

  const name = DISPLAY_NAME[recipe.protein]

  return (
    <WebChrome>
      <main>
        {/* Hero */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>Recipe · 레시피 정보</Eyebrow>
            <Display as="h1" size="xl" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
              파머스테일
              <br />
              {name}
            </Display>
            <p
              className="mt-5 text-[15px] md:text-[17px]"
              style={{ maxWidth: 520, lineHeight: 1.7, color: 'var(--fd-muted)' }}
            >
              {recipe.concept} · {recipe.recommendedFor}를 위한 신선 화식이에요.
              사람이 먹을 수 있는 등급의 재료를 수의영양 기준에 맞춰 수비드로
              조리했어요.
            </p>
          </Container>
        </Section>

        {/* 주재료 */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Eyebrow>Ingredients · 주재료</Eyebrow>
            <div
              className="mt-4 rounded-[12px] px-6 py-6"
              style={{ background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
            >
              <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--fd-pine)', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
                {recipe.mainIngredients}
              </p>
              <p className="mt-3" style={{ fontSize: 13, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
                신선한 자연 원물 위주로 구성하고, 자연으로 채우기 어려운 미네랄·
                비타민만 전용 프리믹스로 보충했어요. 심장으로 타우린을, 연어유로
                오메가-3를 더했어요.
              </p>
            </div>
          </Container>
        </Section>

        {/* 기준·특징 */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>Standard · 영양 기준</Eyebrow>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                {
                  Icon: ShieldCheck,
                  t: '3중 영양 표준 충족',
                  d: 'AAFCO 2024 · FEDIAF 2024 · NIAS 2024를 동시에 충족하고, 여기에 +15% 안전 마진을 더했어요.',
                },
                {
                  Icon: Soup,
                  t: '수비드 저온 조리',
                  d: '고온 압출 대신 수비드(진공 저온)로 천천히 익혀 수분·영양·풍미를 지켜요.',
                },
                {
                  Icon: Leaf,
                  t: '완성품 열량',
                  d: `100g당 약 ${recipe.kcalPer100g} kcal 기준으로 설계했어요. (실측 분석으로 최종 확정)`,
                },
                {
                  Icon: Snowflake,
                  t: '급속 냉동 · 콜드체인',
                  d: '조리 직후 급속 냉동해 문 앞까지 냉동 상태로 보내드려요.',
                },
              ].map(({ Icon, t, d }) => (
                <li
                  key={t}
                  className="rounded-[12px] px-5 py-5 h-full"
                  style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--fd-offwhite)', color: 'var(--fd-green)' }}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                  <div className="mt-3" style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fd-pine)' }}>{t}</div>
                  <p className="mt-1.5" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fd-muted)' }}>{d}</p>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        {/* 보장성분 분석표 — 라벨 확정 후 채움(자리) */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Eyebrow>Analysis · 보장성분</Eyebrow>
            <div
              className="mt-4 rounded-[12px] px-6 py-7 text-center"
              style={{ background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
            >
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--fd-pine)' }}>
                성분 분석표 준비 중
              </p>
              <p className="mt-2" style={{ fontSize: 12.5, color: 'var(--fd-muted)', lineHeight: 1.6, maxWidth: 420, marginInline: 'auto' }}>
                조단백·조지방·수분·칼슘·인 등 공인 분석 결과를 이곳에 투명하게
                공개할 예정이에요.
              </p>
            </div>
          </Container>
        </Section>

        {/* 급여·보관 안내 */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>Guide · 급여 · 보관</Eyebrow>
            <ul className="mt-4 space-y-3">
              {[
                ['급여량', '우리 아이의 체중·활동량에 맞춘 정확한 하루 급여량은 2분 무료 설문에서 계산해 드려요.'],
                ['전환', '기존 사료에서 바꿀 땐 7~10일에 걸쳐 조금씩 섞어가며 늘려 주세요.'],
                ['보관', '냉동(-18℃) 보관, 급여 전날 냉장실로 옮겨 자연 해동하세요. 개봉 후엔 냉장 3일 이내 급여를 권해요.'],
              ].map(([t, d]) => (
                <li
                  key={t}
                  className="grid"
                  style={{ gridTemplateColumns: '64px 1fr', gap: 12, alignItems: 'baseline', paddingBottom: 12, borderBottom: '1px solid var(--fd-line)' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fd-coral)', letterSpacing: '0.02em' }}>{t}</span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--fd-pine)' }}>{d}</span>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        {/* CTA — 역방향(설문)만 허용 */}
        <Section bg="pine" pad="lg">
          <Container size="sm">
            <div className="text-center">
              <Eyebrow color="rgba(255,255,255,0.72)">For Your Dog</Eyebrow>
              <Display as="h2" size="lg" className="mt-3" style={{ color: '#FFFFFF' }}>
                우리 아이에게 맞을까요?
              </Display>
              <p className="mx-auto mt-4 max-w-[38ch] text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                2분 무료 설문으로 우리 아이 체형·건강에 맞는 레시피와 하루 급여량을
                확인해 보세요.
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
