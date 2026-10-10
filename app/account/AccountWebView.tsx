/**
 * 웹 내 계정 허브 그리기(웹 시안 WEB-A19, 2026-10-10 웹 리뉴얼) — 조회는 app/account/page.tsx, 여기는 받은 값으로 그리기만.
 * 등급·도장판 계산은 정본(lib/tiers·lib/stamps — 앱 내 정보와 같은 식). 점검 화면(/design-check-store?s=account)이 예시 값으로 그린다.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import LogoutButton from '@/components/account/LogoutButton'
import StoreShell from '@/components/store/StoreShell'
import { StampGrid, TierSquare } from '@/components/v3/me/MeParts'
import { withHonorific } from '@/lib/korean'
import { nextTier, resolveTierKey, tierMeta, TIERS } from '@/lib/tiers'
import { cardProgressFloored, STAMP_CARD_SIZE, STAMP_REWARD_LABEL } from '@/lib/stamps'

type LinkItem = { href: string; icon: ReactNode; label: string; description: string; badge?: number }

export default function AccountWebView({
  name,
  email,
  stamps,
  tierRaw,
  totalOrders,
  pendingOrders,
  activeSubs,
  dogCount,
}: {
  name: string
  email: string
  /** 살아 있는 도장 수(profiles.stamp_count). */
  stamps: number
  /** profiles.tier — 강등 없는 등급 바닥. */
  tierRaw: string | null
  totalOrders: number
  pendingOrders: number
  activeSubs: number
  dogCount: number
}) {
  // 등급 — null = 아직 등급 없음(도장 10개 미만). 배지 정본 = profiles.tier(강등 없음) — resolveTierKey 가 높은 쪽을 고른다.
  const tier = tierMeta(resolveTierKey(tierRaw, stamps))
  const next = tier ? nextTier(tier.key) : TIERS[0]
  const floor = tier?.threshold ?? 0
  const progress = next ? Math.min(100, Math.max(0, Math.round(((stamps - floor) / (next.threshold - floor)) * 100))) : 100
  const card = cardProgressFloored(stamps, floor)

  const items: LinkItem[] = [
    {
      href: '/mypage/orders',
      icon: <BoxIcon />,
      label: '주문 내역',
      description: pendingOrders ? `진행 중 ${pendingOrders}건` : '결제부터 배송까지 한눈에',
      badge: totalOrders,
    },
    {
      href: '/account/subscriptions',
      icon: <RepeatIcon />,
      label: '정기배송 관리',
      description: activeSubs ? `구독 중 ${activeSubs}건 · 화식 비율·해지` : '화식 비율 변경 · 일시정지 · 해지',
      badge: activeSubs,
    },
    {
      href: '/account/dogs',
      icon: <PawIcon />,
      label: '우리 아이',
      description: dogCount ? `${dogCount}마리` : '등록한 반려견',
      badge: dogCount,
    },
    { href: '/account/profile', icon: <UserIcon />, label: '내 프로필', description: '이름·연락처' },
    { href: '/account/notifications', icon: <BellIcon />, label: '알림 · 수신 설정', description: '광고·마케팅 정보 수신 여부' },
  ]

  return (
    <StoreShell>
      <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h1 className="d" style={{ margin: 0, fontSize: 40, lineHeight: 1.12, overflowWrap: 'anywhere' }}>
          {withHonorific(name)},
          <br />
          오늘도 좋은 한 끼.
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 17, color: '#595959', overflowWrap: 'anywhere' }}>{email}</p>
      </section>

      <section aria-labelledby="tier-title" style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tier && <TierSquare color={tier.bg} />}
            <strong id="tier-title" style={{ fontSize: 20, fontWeight: 800 }}>
              {tier ? `${tier.label} 등급` : '멤버십 시작 전'}
            </strong>
          </span>
          <span style={{ fontSize: 15, color: '#595959', whiteSpace: 'nowrap' }}>
            도장 {stamps}개{next ? ` · ${next.label}까지 ${Math.max(0, next.threshold - stamps)}개` : ''}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={next ? `${next.label} 등급까지 채운 정도` : '가장 높은 등급'}
          style={{ marginTop: 10, height: 8, background: '#EFEDEE' }}
        >
          <div style={{ width: `${progress}%`, height: 8, background: '#141414' }} />
        </div>

        <div style={{ marginTop: 18, border: '2px solid #141414', boxShadow: '4px 4px 0 #141414', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>도장판</span>
                <span style={{ whiteSpace: 'nowrap' }}>
                  <span className="n" style={{ fontSize: 40, lineHeight: 1 }}>
                    {card.filled}
                  </span>
                  <span className="n" style={{ fontSize: 22, color: '#595959' }}>
                    {' '}
                    / {STAMP_CARD_SIZE}
                  </span>
                </span>
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#3D3D3D' }}>{card.cardNumber}번째 판</span>
            </div>
            <StampGrid
              filled={card.filled}
              emptyBorder="#BDBDBD"
              size={STAMP_CARD_SIZE}
              label={`도장 ${card.filled}개, ${STAMP_CARD_SIZE}개 중. ${card.remaining}개 더 모으면 ${STAMP_REWARD_LABEL}.`}
            />
          </div>
          <p style={{ margin: 0, padding: '12px 16px 14px', borderTop: '1px solid #E5E5E5', fontSize: 15, lineHeight: 1.55, color: '#3D3D3D' }}>
            정기배송 결제 1번에 도장 하나가 찍혀요. {STAMP_CARD_SIZE}개를 모으면 {STAMP_REWARD_LABEL}을 드려요. 도장은 찍힌 날부터 1년 동안
            유효해요(등급은 내려가지 않아요).
          </p>
        </div>
      </section>

      <section aria-labelledby="go-title" style={{ padding: '44px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="go-title" className="d" style={{ margin: 0, fontSize: 24 }}>
          바로가기
        </h2>
        <nav aria-labelledby="go-title" style={{ marginTop: 12, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              style={{
                minHeight: 76,
                boxSizing: 'border-box',
                padding: '12px 0',
                borderBottom: '1px solid #E5E5E5',
                display: 'grid',
                gridTemplateColumns: '44px 1fr 18px',
                columnGap: 14,
                alignItems: 'center',
                color: '#141414',
                textDecoration: 'none',
              }}
            >
              <span aria-hidden style={{ width: 44, height: 44, borderRadius: 22, background: '#F6F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {it.icon}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{it.label}</span>
                  {!!it.badge && (
                    <span
                      style={{
                        minWidth: 24,
                        height: 24,
                        boxSizing: 'border-box',
                        padding: '0 6px',
                        borderRadius: 4,
                        background: '#141414',
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {it.badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 15, color: '#595959' }}>{it.description}</span>
              </span>
              <Chevron />
            </Link>
          ))}
        </nav>
      </section>

      {/* 앱 전용 안내 — 일일 케어·분석은 앱에서(앱 세계 표시 = 숲색). */}
      <section style={{ margin: '40px 20px 0', padding: '26px 20px 22px', borderRadius: 4, background: '#1D3B2F', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#A9C4B2' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" />
          </svg>
          앱에서만
        </span>
        <h2 className="d" style={{ margin: '8px 0 0', fontSize: 28, lineHeight: 1.15 }}>
          일일 케어는 앱에서
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.6, color: '#C9D6CD' }}>일일 케어 기록, 산책·영양 분석은 모바일 앱에서 더 빠르게 도와드려요.</p>
        <Link
          href="/app-required"
          style={{
            marginTop: 16,
            minHeight: 64,
            boxSizing: 'border-box',
            padding: '10px 14px',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.10)',
            display: 'grid',
            gridTemplateColumns: '1fr 18px',
            columnGap: 10,
            alignItems: 'center',
            color: '#FFFFFF',
            textDecoration: 'none',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>일일 케어 · 분석</span>
            <span style={{ fontSize: 15, color: '#C9D6CD' }}>기록 · 산책 · 영양 분석</span>
          </span>
          <Chevron />
        </Link>
      </section>

      <section aria-labelledby="help-title" style={{ padding: '40px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="help-title" style={{ margin: 0, fontFamily: 'inherit', fontSize: 17, fontWeight: 800, letterSpacing: 'inherit', color: '#595959' }}>
          도움말
        </h2>
        <nav aria-labelledby="help-title" style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
          {[
            { href: '/contact', label: '1:1 문의' },
            { href: '/faq', label: '자주 묻는 질문' },
            { href: '/legal/refund', label: '환불 정책' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ minHeight: 56, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 17, color: '#3D3D3D', textDecoration: 'none' }}
            >
              {l.label}
              <Chevron />
            </Link>
          ))}
        </nav>
      </section>

      <section style={{ padding: '28px 20px 64px' }}>
        <LogoutButton look="web" />
      </section>
    </StoreShell>
  )
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

const ICON = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: '#141414', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function BoxIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </svg>
  )
}

function RepeatIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 9a7 7 0 0 1 12.5-3.5L19 8" />
      <path d="M19 3.5V8h-4.5" />
      <path d="M20 15a7 7 0 0 1-12.5 3.5L5 16" />
      <path d="M5 20.5V16h4.5" />
    </svg>
  )
}

function PawIcon() {
  return (
    <svg {...ICON}>
      <circle cx="7" cy="9" r="1.8" />
      <circle cx="12" cy="6.5" r="1.8" />
      <circle cx="17" cy="9" r="1.8" />
      <path d="M12 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.3 2.3 2.8 2.3 1.2 0 1.8-.6 2.7-.6s1.5.6 2.7.6c1.5 0 2.8-.7 2.8-2.3C17.5 15 15 12 12 12z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg {...ICON}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  )
}
