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
import { createClient } from '@/lib/supabase/server'
import {
  TIERS,
  tierMeta,
  tierFromStamps,
  stampsToFirstTier,
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
 * 4단계 등급 시각화 + 현재 등급 hero + 스탬프 통계 + 다음 등급 진행률 + 등급별
 * detailed 혜택. /account/profile 의 작은 TierBadge 와 분리 — 매일 들어와도
 * 시인성 좋게.
 */
export default async function MembershipPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/membership')

  const [{ data: profile }, { data: dogs }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('tier, stamp_count, tier_updated_at')
        .eq('id', user.id)
        .maybeSingle(),
      // 단짝 등급일 때 강아지 등록증 CTA list 용. 다른 등급은 사용 안 함.
      supabase
        .from('dogs')
        .select('id, name, breed, photo_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ])

  // 등급 기준 = 살아 있는 스탬프 개수 (2026-07-16 사장님 확정. 이전엔 누적 결제액 —
  // 금액 기준이면 강아지 덩치 큰 집이 자동으로 높은 등급을 먹었다).
  // ★ profiles.tier 컬럼(stale·null→'seed' 강제 오표시)이 아니라 stamp_count 에서 파생.
  const stampCount =
    typeof profile?.stamp_count === 'number' ? profile.stamp_count : 0
  const meta = tierMeta(tierFromStamps(stampCount))

  return (
    <div className="pb-12">
      {/* Stamp — 등급의 기준이 스탬프 개수라 이 페이지의 첫 화면. 사장님 확정
          2026-07-16: 큰 등급 히어로 카드를 걷어내고 Stamp → My Benefits →
          All Tiers 순서로. 껍데기는 아래 두 섹션과 같은 박스로 통일. */}
      <section className="px-5 pt-6">
        <div className="flex items-center gap-2 mb-2.5">
          <span
            aria-hidden
            style={{ width: 16, height: 1.5, background: 'var(--terracotta)' }}
          />
          <span className="kicker">Stamp</span>
        </div>
        <StampCard stampCount={stampCount} variant="app" />
      </section>

      {/* 현재 등급 혜택 list */}
      <section className="px-5 mt-5">
        <div className="flex items-center gap-2 mb-2.5">
          <span
            aria-hidden
            style={{ width: 16, height: 1.5, background: 'var(--terracotta)' }}
          />
          <span className="kicker">My Benefits</span>
        </div>
        {/* 등급이 없으면(스탬프 10개 미만) 혜택 목록 대신 유도 — 사장님 확정
            2026-07-16. 빈 목록을 보여주느니 "채우면 시작된다"고 말하는 게 낫다. */}
        {!meta ? (
          <div className="bg-bg-3 rounded border border-dashed border-rule px-4 py-5 text-center">
            <p className="text-[12px] font-bold text-text">아직 혜택이 없어요</p>
            <p className="text-[10.5px] text-muted mt-1.5 leading-relaxed">
              스탬프 {TIERS[0]!.threshold}개를 모으면 <b>{TIERS[0]!.label}</b>으로
              멤버십이 시작돼요.
              <br />
              {stampsToFirstTier(stampCount)}개 남았어요.
            </p>
          </div>
        ) : (
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
        )}
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
              currentTier={meta?.key ?? null}
              stampCount={stampCount}
            />
          ))}
        </div>
      </section>

      {/* 단짝 등록증 CTA — mate 등급 + 강아지 1마리 이상일 때만 */}
      {meta?.key === 'mate' && (dogs?.length ?? 0) > 0 && (
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

      {/* 등급 산정 안내 */}
      <section className="px-5 mt-5">
        <div className="rounded bg-bg-2 px-4 py-3.5 text-[10.5px] text-text leading-relaxed">
          <p className="font-bold text-text mb-1.5">등급 산정 안내</p>
          <ul className="space-y-1 text-text/80">
            <li>· 정기배송 결제 1회마다 스탬프 1개 — 결제 즉시 반영</li>
            <li>· 결제 금액과 무관해요. 아이 덩치가 아니라 함께한 횟수예요</li>
            <li>· 스탬프 10개마다 스탬프 카드 한 장 완성 → 특별보상</li>
            <li>· 스탬프는 찍힌 날부터 2년간 유효해요</li>
            <li>· 결제가 취소·환불되면 그 스탬프는 회수돼요</li>
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
  /** 지금 등급. **null = 아직 등급 없음**(스탬프 10개 미만). */
  currentTier: string | null
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
            {t.threshold === 0 ? '가입 즉시' : `스탬프 ${t.threshold}개`}
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
