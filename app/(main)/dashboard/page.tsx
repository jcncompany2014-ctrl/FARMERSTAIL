import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Soup,
  Cookie,
  PackageOpen,
  Repeat,
  ArrowRight,
  Dog,
  Plus,
  ChevronRight,
  Leaf,
  Truck,
  BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ReferralAutoRedeemer from '@/components/ReferralAutoRedeemer'
import { getActiveEvents } from '@/lib/events/data'
import {
  OngoingEvents,
  DashboardGreeting,
} from './DashboardClientIslands'

/**
 * Dashboard — 로그인 후 홈 화면.
 *
 * ## 2026-04 Perf 리팩토 메모
 * 이전 구현은 전체가 `'use client'` 였다:
 *   1) auth.getUser()  → 대기
 *   2) profiles   → 대기
 *   3) dogs       → 대기
 *   4) products   → 대기
 *   5) subscriptions → 대기
 *   6) events     → 대기
 *   → 모든 단계 완료까지 풀페이지 스피너
 *
 * 6×RTT 직렬 + JS hydration 후에야 첫 유효 페인트였다. 지금은 서버 컴포넌트로
 * 전환 + Promise.all 로 병렬화. 인증은 서버 쿠키에서 한 번에 읽고, 5개 쿼리
 * 는 동시 실행. HTML 이 바로 내려와 LCP 가 크게 개선되고, JS 번들도 마스트
 * 헤드 / 카운트다운 / 캐러셀 섬 (`DashboardClientIslands.tsx`) 만 필요.
 */

export const metadata: Metadata = {
  title: '파머스테일',
  description: '파머스테일 대시보드',
  robots: { index: false, follow: false },
}

// 개인화된 페이지 — CDN 캐시 금지. 유저별 쿼리 결과를 공유하면 안 됨.
export const dynamic = 'force-dynamic'

type DogRow = {
  id: string
  name: string
  breed: string | null
  birth_date: string | null
  weight: number | null
}

type ProductRow = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  category: string | null
  short_description: string | null
  is_subscribable: boolean
}

type SubscriptionRow = {
  id: string
  status: string
  next_delivery_date: string | null
  subscription_items: { product_name: string }[]
}

const CATEGORIES = [
  { key: '화식', label: '화식', Icon: Soup, desc: '건강한 한 끼' },
  { key: '간식', label: '간식', Icon: Cookie, desc: '특별한 보상' },
  { key: '체험팩', label: '체험팩', Icon: PackageOpen, desc: '처음이라면' },
] as const

/**
 * 헤더 chrome 에 이미 데이트라인 (`MON · 24 APR`) 이 박혀있으니 dashboard
 * 마스트헤드 자리는 날짜 대신 **개인화 status 카드** 를 보여준다. 매거진의
 * 큼직한 focal stat (D-3, 이름, 카테고리) + 콘텍스트 한 줄 + 화살표.
 *
 * 분기 우선순위:
 *   1) 활성 정기배송 → "D-3" / "오늘 도착" 등 큰 숫자 + 도착 예정일,
 *      /mypage/subscriptions
 *   2) 강아지 등록됨 → 첫 강아지 이름 + 나이/품종, /dogs/{id}
 *   3) 둘 다 없음 → "체험팩" + 안내 카피, /products?category=체험팩
 */
type DashboardContext = {
  /** 큰 focal text — D-3 / 강아지 이름 / "체험팩". 한 줄 inline 링크에 들어감. */
  primary: string
  /** dot/색 강조용 톤. */
  tone: 'moss' | 'terracotta' | 'gold'
  /** 클릭 시 이동할 경로. */
  href: string
  /** 작은 라벨 — 영문 표기 (mono uppercase). */
  enLabel: string
}

/**
 * KST 기준 두 날짜의 일수 차이. 문자열 'YYYY-MM-DD' 또는 ISO 둘 다 받는다.
 * 서버 timezone 이 UTC 라도 결과가 사용자 (KST) 의 "오늘" 기준으로 안정.
 */
function daysUntilKST(target: string): number {
  const targetIso =
    target.length === 10 ? `${target}T00:00:00+09:00` : target
  const targetMs = new Date(targetIso).getTime()
  const nowKstStr = new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
  const todayMs = new Date(`${nowKstStr}T00:00:00+09:00`).getTime()
  return Math.round((targetMs - todayMs) / 86_400_000)
}

function buildContextCard(opts: {
  hasActiveSub: boolean
  nextDeliveryDate: string | null
  dogs: DogRow[]
}): DashboardContext {
  if (opts.hasActiveSub && opts.nextDeliveryDate) {
    const days = daysUntilKST(opts.nextDeliveryDate)
    const primary =
      days < 0
        ? '곧 도착'
        : days === 0
          ? '오늘 도착'
          : days === 1
            ? '내일 도착'
            : `D-${days}`
    return {
      enLabel: 'NEXT DELIVERY',
      primary,
      tone: 'moss',
      href: '/mypage/subscriptions',
    }
  }
  if (opts.dogs.length > 0) {
    return {
      enLabel: 'FAMILY',
      primary: opts.dogs[0].name,
      tone: 'terracotta',
      href: `/dogs/${opts.dogs[0].id}`,
    }
  }
  return {
    enLabel: 'GET STARTED',
    primary: '체험팩',
    tone: 'gold',
    href: '/products?category=체험팩',
  }
}

function ProductFallback({ category }: { category: string | null }) {
  const Icon =
    category === '간식' ? Cookie : category === '체험팩' ? PackageOpen : Soup
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Icon
        className="w-10 h-10"
        style={{ color: 'var(--muted)' }}
        strokeWidth={1.2}
      />
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 3개 쿼리 동시 실행. user-scoped (profile + dogs + active subscription) 는
  // dashboard_user_snapshot RPC 로 1-shot, 글로벌 (products / events) 만 별도.
  // 이전엔 5개 라운드트립이었는데 RPC 합쳐 3개로 — auth/RLS 평가도 1회만 발생.
  //
  // Error 처리 방침: 개별 쿼리 실패해도 대시보드는 "빈 상태" 로 렌더한다.
  //   - UX: 한 섹션 실패로 모든 영역을 블록하는 건 과잉 반응.
  //   - 가시성: Sentry 로 보내서 운영자는 인지. 사용자 경로는 유지.
  const [
    { data: snapshotData, error: snapshotErr },
    { data: prodData, error: prodErr },
    events,
  ] = await Promise.all([
    supabase.rpc('dashboard_user_snapshot', { p_user_id: user.id }),
    supabase
      .from('products')
      .select(
        'id, name, slug, price, sale_price, image_url, category, short_description, is_subscribable',
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(10),
    // getActiveEvents 는 내부에서 catch + empty 반환 — 실패해도 대시보드 전체
    // 가 깨지지 않는다.
    getActiveEvents(supabase, 3),
  ])

  if (snapshotErr) {
    console.error('[dashboard] user_snapshot rpc failed', snapshotErr)
  }
  if (prodErr) console.error('[dashboard] products query failed', prodErr)

  // RPC 가 JSONB 로 { profile, dogs, subscription } 반환. 실패시 모두 null/[].
  type SnapshotShape = {
    profile: { name: string | null } | null
    dogs: DogRow[]
    subscription: SubscriptionRow | null
  }
  const snapshot = (snapshotData ?? {
    profile: null,
    dogs: [],
    subscription: null,
  }) as SnapshotShape

  const userName =
    snapshot.profile?.name || user.email?.split('@')[0] || null
  const userCreatedAt = user.created_at ?? null
  const dogs = (snapshot.dogs ?? []) as DogRow[]
  const products = (prodData ?? []) as ProductRow[]
  const subscription = snapshot.subscription
  const hasActiveSub =
    subscription !== null && subscription.next_delivery_date !== null

  // 헤더에 이미 날짜가 있어 마스트헤드 자리는 큰 status 카드로 대체.
  // 우선순위: 정기배송 D-day → 강아지 → 시작 유도.
  const ctx = buildContextCard({
    hasActiveSub,
    nextDeliveryDate: subscription?.next_delivery_date ?? null,
    dogs,
  })

  return (
    <main className="pb-8">
      {/* 가입 리퍼럴 자동 적용 — 클라이언트 섬. 세션당 1회. */}
      <ReferralAutoRedeemer />

      {/* ── 인사 — kicker + serif h1 ─────────────────────────── */}
      <section className="relative grain grain-soft px-5 pt-4 pb-5 overflow-hidden">
        {/* 듀얼 라이트 글로우 — flat 한 베이지 배경에 깊이감. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 420px 260px at 108% -12%, rgba(160,69,46,0.20) 0%, transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 300px 180px at -8% 110%, rgba(212,169,74,0.14) 0%, transparent 60%)',
          }}
        />

        {/* terracotta tick + kicker — hairline 살짝 두껍게 (1 → 1.5px),
            terracotta dot 추가로 magazine masthead 시그니처 강조. */}
        <div className="relative flex items-center gap-2.5">
          <span
            aria-hidden
            style={{
              width: 24,
              height: 1.5,
              background: 'var(--terracotta)',
              flexShrink: 0,
            }}
          />
          <span className="kicker">Good day · 오늘의 한 끼</span>
          <span
            aria-hidden
            style={{
              width: 4,
              height: 4,
              borderRadius: 1,
              background: 'var(--terracotta)',
              flexShrink: 0,
              marginLeft: 'auto',
            }}
          />
        </div>

        {/* 인사말 — 이름 (ink) + 시간대 인사 (terracotta italic serif) 로
            계조 강조. 한 줄 안에서 두 톤이 교차하면서 매거진 풍 hierarchy. */}
        <h1
          className="relative font-serif mt-3.5 leading-[1.15]"
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
          }}
        >
          {userName ? `${userName}님,` : ''}
          <br />
          <span
            className="italic"
            style={{
              fontWeight: 600,
              color: 'var(--terracotta)',
              letterSpacing: '-0.02em',
            }}
          >
            <DashboardGreeting />
          </span>
        </h1>

        {/* 부제 — 마지막 단어를 italic terracotta 로 강조해서 brand voice
            (정성, 한 그릇) 을 매번 살짝 빛내준다. */}
        <p
          className="relative mt-3 leading-relaxed"
          style={{
            fontSize: 12.5,
            color: 'var(--text)',
            letterSpacing: '-0.005em',
          }}
        >
          오늘도 건강한 한 끼를{' '}
          <span
            className="font-serif italic"
            style={{
              fontWeight: 700,
              color: 'var(--terracotta)',
            }}
          >
            정성스럽게.
          </span>
        </p>

        {/* Next-action 한 줄 — 활성 구독자는 바로 아래 다음 배송 히어로 카드
            가 이어받으니 표시 안 함. 비구독자에게만 가벼운 텍스트 링크로 다음
            행동 유도 (chip 보다 가볍고 매거진톤). */}
        {!hasActiveSub && (
          <Link
            href={ctx.href}
            className="relative inline-flex items-center gap-1.5 mt-4 group"
          >
            <span
              aria-hidden
              style={{
                width: 12,
                height: 1,
                background: `var(--${ctx.tone})`,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: `var(--${ctx.tone})`,
                textTransform: 'uppercase',
              }}
            >
              {ctx.enLabel}
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {ctx.primary}
            </span>
            <ArrowRight
              className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
              style={{ color: 'var(--ink)' }}
              strokeWidth={2.25}
            />
          </Link>
        )}

        {/* 섹션 하단 에디토리얼 rule — 양쪽 terracotta 정사각형으로 magazine
            ornament. 가운데가 비어 light + breath 표현. */}
        <div
          aria-hidden
          className="relative mt-6 flex items-center gap-2"
        >
          <span
            style={{
              width: 4,
              height: 4,
              background: 'var(--terracotta)',
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              height: 1,
              background:
                'linear-gradient(to right, var(--rule) 0%, var(--rule) 92%, transparent 100%)',
            }}
          />
          <span
            style={{
              width: 4,
              height: 4,
              background: 'var(--terracotta)',
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
        </div>
      </section>

      {/* ── 다음 배송 히어로 (D-N 강조) ── */}
      {hasActiveSub && (
        <section className="px-5 mt-4">
          <Link
            href="/mypage/subscriptions"
            className="block rounded-2xl px-5 py-5 shadow-sm hover:shadow-md transition-all"
            style={{
              background:
                'linear-gradient(to bottom right, var(--moss), #556828)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Truck
                  className="w-3.5 h-3.5 text-white/80"
                  strokeWidth={2}
                />
                <span className="kicker kicker-white">Next Delivery</span>
              </div>
              <Repeat className="w-4 h-4 text-white/60" strokeWidth={2} />
            </div>
            <NextDeliveryLine
              nextDate={subscription!.next_delivery_date!}
              items={subscription!.subscription_items}
            />
          </Link>
        </section>
      )}

      {/* ── 내 강아지 ── */}
      <section className="px-5 mt-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-serif"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            내 아이들
          </h2>
          {dogs.length > 0 && (
            <Link
              href="/dogs"
              className="text-[11px] font-semibold"
              style={{ color: 'var(--muted)' }}
            >
              전체보기 →
            </Link>
          )}
        </div>

        {dogs.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {dogs.map((dog) => (
              <Link
                key={dog.id}
                href={`/dogs/${dog.id}`}
                className="flex-shrink-0 bg-white rounded-2xl hover:shadow-sm transition-all"
                style={{
                  width: '120px',
                  border: '1px solid var(--rule)',
                }}
              >
                <div className="flex flex-col items-center py-4 px-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-2.5"
                    style={{ background: 'var(--bg)' }}
                  >
                    <Dog
                      className="w-5 h-5"
                      style={{ color: 'var(--muted)' }}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div
                    className="font-bold text-[13px] truncate w-full text-center"
                    style={{ color: 'var(--ink)' }}
                  >
                    {dog.name}
                  </div>
                  <div
                    className="text-[10px] mt-1 truncate w-full text-center"
                    style={{ color: 'var(--muted)' }}
                  >
                    {[dog.breed, dog.weight ? `${dog.weight}kg` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </Link>
            ))}
            <Link
              href="/dogs/new"
              className="flex-shrink-0 rounded-2xl border border-dashed transition-all"
              style={{
                width: '120px',
                borderColor: 'var(--rule-2)',
              }}
            >
              <div className="flex flex-col items-center justify-center py-4 px-3 h-full">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-2.5"
                  style={{ background: 'var(--bg)' }}
                >
                  <Plus
                    className="w-5 h-5"
                    style={{ color: 'var(--muted)' }}
                    strokeWidth={1.5}
                  />
                </div>
                <div
                  className="text-[11px] font-semibold"
                  style={{ color: 'var(--muted)' }}
                >
                  추가하기
                </div>
              </div>
            </Link>
          </div>
        ) : (
          <Link href="/dogs/new" className="block">
            <div
              className="relative overflow-hidden rounded-2xl border border-dashed px-5 py-9 text-center transition-all hover:shadow-sm"
              style={{
                background: 'var(--bg-2)',
                borderColor: 'var(--rule-2)',
              }}
            >
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--rule-2)',
                }}
              >
                <Dog
                  className="w-6 h-6"
                  style={{ color: 'var(--terracotta)' }}
                  strokeWidth={1.5}
                />
              </div>
              <span className="kicker">First Dog · 시작하기</span>
              <div
                className="font-serif mt-2"
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                }}
              >
                우리 아이를 등록해 보세요
              </div>
              <div
                className="text-[11px] mt-2 leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                맞춤 영양 분석과 제품 추천을 받을 수 있어요
              </div>
              <div
                className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-bold px-5 py-2.5 rounded-full"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  letterSpacing: '-0.01em',
                }}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                등록 시작하기
              </div>
            </div>
          </Link>
        )}
      </section>

      {/* ── 카테고리 ── */}
      <section className="px-5 mb-8">
        <div className="mb-2.5">
          <span className="kicker kicker-muted">Categories</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {CATEGORIES.map(({ key, label, Icon, desc }) => (
            <Link
              key={key}
              href={`/products?category=${encodeURIComponent(key)}`}
              className="bg-white rounded-2xl py-5 px-2 text-center transition-all"
              style={{ border: '1px solid var(--rule)' }}
            >
              <Icon
                className="w-6 h-6 mx-auto mb-3"
                style={{ color: 'var(--ink)' }}
                strokeWidth={1.5}
              />
              <div
                className="text-[12px] font-bold"
                style={{ color: 'var(--ink)' }}
              >
                {label}
              </div>
              <div
                className="text-[9px] mt-0.5"
                style={{ color: 'var(--muted)' }}
              >
                {desc}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 진행중인 이벤트 (클라이언트 섬 — 가로 스냅 캐러셀) ── */}
      <OngoingEvents events={events} userCreatedAt={userCreatedAt} />

      {/* ── 전체 상품 (2열 그리드) ── */}
      <section className="px-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-serif"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            전체 상품
          </h2>
          <Link
            href="/products"
            className="text-[11px] font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            전체보기 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {products.slice(0, 6).map((p) => {
            const hasSale = p.sale_price !== null
            const discount = hasSale
              ? Math.round(
                  ((p.price - (p.sale_price ?? p.price)) / p.price) * 100,
                )
              : 0
            return (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group bg-white rounded-2xl overflow-hidden transition-all hover:shadow-sm"
                style={{ border: '1px solid var(--rule)' }}
              >
                <div
                  className="aspect-square relative overflow-hidden"
                  style={{ background: 'var(--bg)' }}
                >
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 224px"
                      loading="lazy"
                      className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <ProductFallback category={p.category} />
                  )}
                  {/* 좌상단 — 할인율 + 정기배송 (frosted glass for 정기) */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                    {hasSale && discount > 0 && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          padding: '3px 7px',
                          borderRadius: 4,
                          background: 'var(--sale)',
                          color: 'var(--bg)',
                        }}
                      >
                        −{discount}%
                      </span>
                    )}
                    {p.is_subscribable && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          padding: '3px 7px',
                          borderRadius: 4,
                          background: 'rgba(245,240,230,0.92)',
                          color: 'var(--moss)',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)',
                        }}
                      >
                        정기배송
                      </span>
                    )}
                  </div>
                </div>
                {/* 텍스트 패널 — 동일 typography 시스템:
                    label (mono terracotta) → name (serif ink) → price (serif ink/sale). */}
                <div className="px-3.5 pt-3 pb-3.5">
                  {p.category && (
                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 1,
                          background: 'var(--terracotta)',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 8.5,
                          fontWeight: 700,
                          letterSpacing: '0.18em',
                          color: 'var(--terracotta)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {p.category}
                      </span>
                    </div>
                  )}
                  <h3
                    className="font-serif mt-1.5 line-clamp-2"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--ink)',
                      letterSpacing: '-0.015em',
                      lineHeight: 1.25,
                      minHeight: 35,
                    }}
                  >
                    {p.name}
                  </h3>
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1">
                      <span
                        className="font-serif"
                        style={{
                          fontSize: 19,
                          fontWeight: 800,
                          color: hasSale ? 'var(--sale)' : 'var(--ink)',
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        {(p.sale_price ?? p.price).toLocaleString()}
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 600,
                          color: 'var(--muted)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        원
                      </span>
                    </div>
                    {hasSale && (
                      <span
                        className="line-through"
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: 'var(--muted)',
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {p.price.toLocaleString()}원
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── 매거진 CTA ── */}
      <section className="px-5 mb-6">
        <Link
          href="/blog"
          className="group block bg-white rounded-2xl transition overflow-hidden"
          style={{ border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-4 px-5 py-5">
            <div
              className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg)' }}
            >
              <BookOpen
                className="w-5 h-5"
                style={{ color: 'var(--terracotta)' }}
                strokeWidth={1.75}
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="kicker">Magazine</span>
              <div
                className="font-serif mt-1 leading-snug"
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                }}
              >
                반려견 영양·건강 이야기
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: 'var(--muted)' }}
              >
                파머스테일이 전하는 케어 가이드
              </div>
            </div>
            <ChevronRight
              className="w-4 h-4 group-hover:translate-x-0.5 transition"
              style={{ color: 'var(--muted)' }}
              strokeWidth={2.25}
            />
          </div>
        </Link>
      </section>

      {/* ── 영양 분석 CTA ── */}
      {dogs.length > 0 && (
        <section className="px-5 mb-6">
          <Link href="/dogs" className="block">
            <div
              className="rounded-2xl px-7 py-7"
              style={{ background: 'var(--ink)' }}
            >
              <span className="kicker kicker-gold">Nutrition Analysis</span>
              <div
                className="font-serif text-white leading-snug mt-2"
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '-0.015em',
                }}
              >
                우리 아이에게 딱 맞는
                <br />
                영양 밸런스를 확인해 보세요
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 bg-white/15 text-white text-[11px] font-bold px-4 py-2 rounded-full">
                분석 시작하기
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── 브랜드 소개 ── */}
      {/* 브랜드 stamp — 클릭 가능 카드처럼 보이지 않게, 박스/그림자 없이
          좌측 얇은 액센트 라인만 두는 editorial 톤. */}
      <section className="px-6 mt-6 mb-4">
        <div
          className="pl-3"
          style={{ borderLeft: '2px solid var(--moss)' }}
        >
          <div className="flex items-center gap-2">
            <Leaf
              className="w-3 h-3"
              style={{ color: 'var(--moss)' }}
              strokeWidth={1.5}
            />
            <span
              className="font-mono text-[9.5px] tracking-[0.2em] uppercase font-bold"
              style={{ color: 'var(--moss)' }}
            >
              Farm to Tail
            </span>
          </div>
          <p
            className="font-serif mt-2"
            style={{
              fontSize: 14.5,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            농장에서 꼬리까지.
          </p>
          <p
            className="text-[10.5px] mt-1.5 leading-relaxed"
            style={{ color: 'var(--muted)' }}
          >
            수의영양학 기반 레시피로 만든 프리미엄 반려견 식품. 건강한 매일을
            파머스테일이 함께합니다.
          </p>
        </div>
      </section>
    </main>
  )
}

/**
 * D-N 라벨 렌더. 서버 시각 기준이 KST 와 어긋날 수 있어서 매우 가벼운
 * 순수 함수로만 계산 — 타임존 드리프트는 ±1일 오차 허용 (배송 라벨 용도).
 * 하이드레이션 mismatch 가 없도록 서버/클라 모두 같은 Date 연산만 사용.
 */
function NextDeliveryLine({
  nextDate,
  items,
}: {
  nextDate: string
  items: { product_name: string }[]
}) {
  const target = new Date(nextDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  const label =
    diff === 0 ? '오늘' : diff > 0 ? `D-${diff}` : `${Math.abs(diff)}일 경과`
  const dateStr = target.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  return (
    <>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span
          className="font-serif text-white leading-none"
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          {label}
        </span>
        <span className="text-white/70 text-[11px] font-semibold">
          {dateStr}
        </span>
      </div>
      <div className="mt-2 text-white/80 text-[11px] truncate">
        {items?.[0]?.product_name}
        {items?.length > 1 && ` 외 ${items.length - 1}개`}
      </div>
    </>
  )
}
