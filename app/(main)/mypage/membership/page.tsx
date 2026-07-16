import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Coins,
  Truck,
  Ticket,
  Crown,
  Gift,
  Sparkles,
  Cake,
  Lock,
  Check,
  Leaf,
  Flower2,
  Heart,
  PawPrint,
  Award,
} from 'lucide-react'
import StampCard from '@/components/account/StampCard'
import { cardProgress } from '@/lib/stamps'
import { createClient } from '@/lib/supabase/server'
import {
  TIERS,
  tierMeta,
  nextTier,
  stampsToNextTier,
  type TierBenefit,
  type TierMeta,
} from '@/lib/tiers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '멤버십',
  robots: { index: false, follow: false },
}

const ICON_MAP: Record<TierBenefit['Icon'], typeof Coins> = {
  coins: Coins,
  truck: Truck,
  ticket: Ticket,
  crown: Crown,
  gift: Gift,
  sparkles: Sparkles,
  cake: Cake,
  leaf: Leaf,
  flower: Flower2,
  heart: Heart,
  paw: PawPrint,
  certificate: Award,
}

/**
 * /mypage/membership — 멤버십 hub.
 *
 * 4단계 등급 시각화 + 현재 등급 hero + 도장 통계 + 다음 등급 진행률 + 등급별
 * detailed 혜택. /account/profile 의 작은 TierBadge 와 분리 — 매일 들어와도
 * 시인성 좋게.
 */
export default async function MembershipPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/membership')

  const [{ data: profile }, { count: orderCount }, { data: dogs }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('tier, stamp_count, tier_updated_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('payment_status', 'paid'),
      // 단짝 등급일 때 강아지 등록증 CTA list 용. 다른 등급은 사용 안 함.
      supabase
        .from('dogs')
        .select('id, name, breed, photo_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ])

  const tier = (profile?.tier as string | null) ?? 'seed'
  // 등급 기준 = 살아 있는 도장 개수 (2026-07-16 사장님 확정. 이전엔 누적 결제액 —
  // 금액 기준이면 강아지 덩치 큰 집이 자동으로 높은 등급을 먹었다).
  const stampCount =
    typeof profile?.stamp_count === 'number' ? profile.stamp_count : 0
  const card = cardProgress(stampCount)
  const meta = tierMeta(tier)
  const next = nextTier(tier)
  const remain = stampsToNextTier(stampCount, tier)

  const lower = meta.threshold
  const upper = next?.threshold ?? meta.threshold
  const progress =
    upper > lower
      ? Math.min(
          100,
          Math.max(0, ((stampCount - lower) / (upper - lower)) * 100),
        )
      : 100

  return (
    <div className="pb-12">
      {/* HERO 카드 — 등급 색 기반, 도장 + 진행률 + 다음 등급 */}
      <section className="px-5 pt-6">
        <div
          className="relative overflow-hidden rounded-[12px] px-6 pt-6 pb-7"
          style={{ background: meta.bg, color: meta.ink }}
        >
          <div
            aria-hidden
            className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          />
          <div
            aria-hidden
            className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />

          <div className="relative">
            <div className="flex items-start gap-4">
              <div
                className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background:
                    meta.key === 'mate'
                      ? meta.ink
                      : 'rgba(255,255,255,0.15)',
                  color: meta.key === 'mate' ? meta.bg : meta.ink,
                }}
              >
                {meta.key === 'mate' ? (
                  <Crown className="w-5 h-5" strokeWidth={2} />
                ) : (
                  <Sparkles className="w-5 h-5" strokeWidth={2} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-mono text-[10.5px] tracking-[0.22em] uppercase"
                  style={{ opacity: 0.8 }}
                >
                  Member · {meta.en}
                </div>
                <h1
                  className="font-sans mt-1 leading-tight"
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {meta.label} 등급
                </h1>
              </div>
            </div>

            {/* 도장 + 다음 등급 */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div
                className="rounded px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <div
                  className="text-[10.5px] font-bold uppercase tracking-widest"
                  style={{ opacity: 0.7 }}
                >
                  모은 도장
                </div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span
                    className="font-sans font-black leading-none tabular-nums"
                    style={{ fontSize: 22, letterSpacing: '-0.02em' }}
                  >
                    {stampCount}
                  </span>
                  <span className="text-[10.5px]" style={{ opacity: 0.85 }}>
                    개 · {card.cardNumber}번째 판
                  </span>
                </div>
              </div>
              <div
                className="rounded px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <div
                  className="text-[10.5px] font-bold uppercase tracking-widest"
                  style={{ opacity: 0.7 }}
                >
                  주문 수
                </div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span
                    className="font-sans font-black leading-none tabular-nums"
                    style={{ fontSize: 22, letterSpacing: '-0.02em' }}
                  >
                    {orderCount ?? 0}
                  </span>
                  <span className="text-[10.5px]" style={{ opacity: 0.85 }}>
                    건
                  </span>
                </div>
              </div>
            </div>

            {/* 다음 등급 progress */}
            <div className="mt-5">
              {next ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10.5px] font-bold"
                      style={{ opacity: 0.85 }}
                    >
                      {next.label}까지
                    </span>
                    <span
                      className="text-[10.5px] font-bold tabular-nums"
                      style={{ opacity: 0.95 }}
                    >
                      {remain.toLocaleString('ko-KR')}원 남음
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.22)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        background:
                          meta.key === 'mate' ? meta.ink : '#FFFFFF',
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4" strokeWidth={2} />
                  <span className="text-[12px] font-bold">
                    최고 등급 도달!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 도장판 — 등급 기준이 도장 개수라 그 근거가 히어로 바로 밑에 와야 한다. */}
      <section className="px-5 mt-5">
        <StampCard stampCount={stampCount} variant="app" />
      </section>

      {/* 단짝 등록증 CTA — mate 등급 + 강아지 1마리 이상일 때만 */}
      {meta.key === 'mate' && (dogs?.length ?? 0) > 0 && (
        <section className="px-5 mt-5">
          <div className="flex items-center gap-2 mb-2.5">
            <span
              aria-hidden
              style={{
                width: 16,
                height: 1.5,
                background: 'var(--terracotta)',
              }}
            />
            <span className="kicker">Certificate</span>
          </div>
          <div
            className="rounded px-5 py-5"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
            }}
          >
            <p className="text-[12px] leading-relaxed" style={{ opacity: 0.85 }}>
              나무 등급 도달의 증표로 강아지 등록증을 받으실 수 있어요. 저장
              해서 보관하거나 SNS 에 공유해 보세요.
            </p>
            <div className="mt-4 space-y-2">
              {(dogs ?? []).map((d) => (
                <Link
                  key={d.id}
                  href={`/mypage/certificate/${d.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded transition active:scale-[0.99]"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.12)' }}
                  >
                    {d.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.photo_url}
                        alt={d.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span style={{ fontSize: 16 }}>🐾</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold truncate">
                      {d.name}
                    </div>
                    {d.breed && (
                      <div
                        className="text-[10.5px] truncate"
                        style={{ opacity: 0.7 }}
                      >
                        {d.breed}
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[10.5px] font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: 'var(--gold)',
                      color: 'var(--ink)',
                    }}
                  >
                    등록증 보기
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 현재 등급 혜택 list */}
      <section className="px-5 mt-5">
        <div className="flex items-center gap-2 mb-2.5">
          <span
            aria-hidden
            style={{ width: 16, height: 1.5, background: 'var(--terracotta)' }}
          />
          <span className="kicker">My Benefits</span>
        </div>
        <ul className="bg-bg-3 rounded border border-rule overflow-hidden">
          {meta.benefits.map((b, i) => {
            const Icon = ICON_MAP[b.Icon]
            return (
              <li
                key={`${meta.key}-${i}`}
                className={`flex items-start gap-3 px-4 py-3.5 ${
                  i < meta.benefits.length - 1 ? 'border-b border-rule' : ''
                }`}
              >
                <div
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: 'color-mix(in srgb, var(--terracotta) 10%, white)',
                  }}
                >
                  <Icon
                    className="w-4 h-4 text-terracotta"
                    strokeWidth={2}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-text">
                    {b.label}
                  </div>
                  <div className="text-[10.5px] text-muted mt-0.5 leading-relaxed">
                    {b.detail}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 모든 등급 비교 */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2.5">
          <span
            aria-hidden
            style={{ width: 16, height: 1.5, background: 'var(--terracotta)' }}
          />
          <span className="kicker">All Tiers</span>
        </div>
        <div className="space-y-2">
          {TIERS.map((t) => (
            <TierRow
              key={t.key}
              t={t}
              currentTier={meta.key}
              stampCount={stampCount}
            />
          ))}
        </div>
      </section>

      {/* 등급 산정 안내 */}
      <section className="px-5 mt-5">
        <div className="rounded bg-bg-2 px-4 py-3.5 text-[10.5px] text-text leading-relaxed">
          <p className="font-bold text-text mb-1.5">등급 산정 안내</p>
          <ul className="space-y-1 text-text/80">
            <li>· 정기배송 결제 1회마다 도장 1개 — 결제 즉시 반영</li>
            <li>· 결제 금액과 무관해요. 아이 덩치가 아니라 함께한 횟수예요</li>
            <li>· 도장 10개마다 도장판 한 장 완성 → 특별보상</li>
            <li>· 도장은 찍힌 날부터 2년간 유효해요</li>
            <li>· 결제가 취소·환불되면 그 도장은 회수돼요</li>
          </ul>
          {profile?.tier_updated_at && (
            <p className="text-[10.5px] text-muted mt-2">
              마지막 등급 업데이트: {formatDate(profile.tier_updated_at)}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function TierRow({
  t,
  currentTier,
  stampCount,
}: {
  t: TierMeta
  currentTier: string
  stampCount: number
}) {
  const reached = stampCount >= t.threshold
  const isCurrent = currentTier === t.key
  return (
    <div
      className="rounded px-4 py-3 transition"
      style={{
        background: isCurrent
          ? 'color-mix(in srgb, ' + t.bg + ' 8%, white)'
          : 'white',
        border: `1px solid ${isCurrent ? t.bg : 'var(--rule)'}`,
        opacity: reached || isCurrent ? 1 : 0.85,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: reached ? t.bg : 'var(--bg-2)',
            color: reached ? t.ink : 'var(--muted)',
          }}
        >
          {reached ? (
            t.key === 'mate' ? (
              <Crown className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            )
          ) : (
            <Lock className="w-3 h-3" strokeWidth={2} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[12px] font-black"
              style={{ color: reached ? 'var(--ink)' : 'var(--muted)' }}
            >
              {t.label}
            </span>
            {isCurrent && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--terracotta)',
                  color: 'white',
                }}
              >
                NOW
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-muted mt-0.5">
            {t.threshold === 0 ? '가입 즉시' : `도장 ${t.threshold}개`}
          </div>
        </div>
        {/* '적립률' → '달성 여부' (2026-07-16 포인트 폐기). 우리 혜택은 자동할인
            이라 등급마다 보여줄 숫자가 적립률이 아니다. */}
        {reached && (
          <span
            className="text-[10.5px] font-bold"
            style={{ color: t.bg }}
          >
            달성
          </span>
        )}
      </div>
      <p className="text-[10.5px] text-muted mt-2 leading-relaxed pl-11">
        {t.benefit}
      </p>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  })
}
