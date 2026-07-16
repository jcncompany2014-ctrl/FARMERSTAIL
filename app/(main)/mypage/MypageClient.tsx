'use client'

/**
 * MypageClient — v3 reskin (2026-05-22, R9).
 *
 * 변경:
 *   - 헤더: serif → sans 800 + Mono kicker.
 *   - 프로필 카드: paperHi + 1px rule + radius 4.
 *   - 등급 hero: 등급별 수채화 배경 + 혜택 한 줄 (포인트 폐기 2026-07-16).
 *   - StatCard: 4-col mini metric strip 패턴 (ActiveDogCard 와 동일 톤).
 *   - MenuGroup: kicker (Mono) + paperHi 카드 + ink rule.
 *   - MenuItem: chevron / badge 톤은 V3.accent.
 *
 * 비즈니스 로직(로그아웃·tier·count)은 audit #101 유지.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Package,
  Repeat,
  Bell,
  MapPin,
  ChevronRight,
  LogOut,
  Sprout,
  Mail,
  HelpCircle,
  FileText,
  Shield,
  Crown,
  Sparkles,
  Gauge,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import StampCard from '@/components/account/StampCard'
import { tierMeta, stampsToFirstTier } from '@/lib/tiers'
import { V3, V3FontSize, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import { Mono, Modal, Badge } from '@/components/v3'
import DogPawMark from '@/components/DogPawMark'

type Profile = {
  name: string | null
  phone: string | null
  tier?: string | null
  stamp_count?: number | null
}

type Props = {
  email: string | null
  profile: Profile | null
  orderCount: number
  subCount: number
}

export default function MypageClient({
  email,
  profile,
  orderCount,
  subCount,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  // browser confirm() → v3 Modal — 톤 통일 + accessibility 강화 (focus trap).
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function performLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName =
    profile?.name || (email ? email.split('@')[0] : null) || '보호자'
  // 등급 메타. **null = 아직 등급 없음**(스탬프 10개 미만, 2026-07-16 사장님 확정).
  const tierMetaOrNull = tierMeta(profile?.tier)
  // 수채화 배경 키 — 등급 없으면 씨앗 그림을 옅게 쓴다(빈 액자 대신 '앞으로 될 모습').
  const tierKey = tierMetaOrNull?.key ?? 'seed'
  const stamps = profile?.stamp_count ?? 0

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* ──────────────────────────────────────────────────────────────
          내 정보 헤더 — 박스 없이 큰 이름(27 black)으로 "여기가 내 정보"임을
          한눈에. 상단 'My Account/마이페이지' 헤더 제거 후 이름이 곧 헤더 역할.
          ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '30px 20px 4px', position: 'relative', overflow: 'hidden' }}>
        {/* 빈 공간 — 발자국 트레일(배열 그대로). 이름정보와 씨앗 칩 사이 정가운데
            정렬: 섹션 중앙(50%) + 칩쪽 약간 바이어스. 폭 달라도 가운데 유지. 클릭 통과. */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'calc(50% + 34px)', width: 0 }}>
            <span style={{ position: 'absolute', left: -96, top: 30, opacity: 0.07, transform: 'rotate(20deg)' }}>
              <DogPawMark size={18} color={V3.ink} />
            </span>
            <span style={{ position: 'absolute', left: -44, top: 52, opacity: 0.08, transform: 'rotate(30deg)' }}>
              <DogPawMark size={21} color={V3.ink} />
            </span>
            <span style={{ position: 'absolute', left: 14, top: 26, opacity: 0.06, transform: 'rotate(18deg)' }}>
              <DogPawMark size={18} color={V3.ink} />
            </span>
            <span style={{ position: 'absolute', left: 76, top: 48, opacity: 0.07, transform: 'rotate(28deg)' }}>
              <DogPawMark size={21} color={V3.ink} />
            </span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 12, position: 'relative' }}>
          <Link href="/account/profile" className="flex-1 min-w-0">
            <div
              className="truncate"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 27,
                fontWeight: V3FontWeight.black,
                color: V3.ink,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
              }}
            >
              {displayName}님
            </div>
            <div
              className="truncate"
              style={{
                fontSize: 13,
                color: V3.inkMute,
                marginTop: 4,
              }}
            >
              {email ?? '—'}
            </div>
            <Mono
              color="accent"
              size="xs"
              weight={600}
              letterSpacing="0.1em"
              style={{ marginTop: 8, display: 'inline-block' }}
            >
              프로필 / 비밀번호 →
            </Mono>
          </Link>
          {profile?.tier && (
            <Link
              href="/mypage/membership"
              aria-label="멤버십 등급 보기"
              className="shrink-0 active:scale-95 transition"
            >
              <TierChip tier={profile.tier} />
            </Link>
          )}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          등급 hero — 등급별 수채화 배경(씨앗→나무).
          2026-07-16: '포인트 잔액' hero 였는데 포인트를 전면 폐기하면서 등급 카드로
          전환. 수채화 배경과 등급 여정은 그대로 살리고 P 숫자만 뺐다. 우리 혜택은
          이제 자동할인이라, 모아둔 숫자보다 "지금 등급이 뭐고 뭘 받는지"가 맞다.
          ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '12px 20px 0' }}>
        <Link
          href="/mypage/membership"
          className="relative block overflow-hidden"
          style={{
            borderRadius: V3Radius.sm,
            padding: '18px 20px',
            textDecoration: 'none',
            color: V3.ink,
            border: `1px solid ${V3.rule}`,
            backgroundColor: V3.paperHi,
            backgroundImage: `linear-gradient(95deg, rgba(252,251,247,0.95) 0%, rgba(252,251,247,0.66) 40%, rgba(252,251,247,0.10) 70%), url(/tiers/${tierKey}.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'right center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="relative">
            <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
              <Sprout size={14} color={V3.accentDeep} strokeWidth={2} />
              <Mono color={V3.accentDeep} size="xxs" weight={600}>
                Membership
              </Mono>
            </div>
            <div className="flex items-baseline" style={{ gap: 7 }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: 30,
                  color: V3.ink,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {tierMetaOrNull?.label ?? '멤버십 시작 전'}
              </span>
              <Mono color="inkMute" size="sm" weight={600} letterSpacing="0.08em">
                {tierMetaOrNull?.en ?? `${stampsToFirstTier(stamps)} TO GO`}
              </Mono>
            </div>
            <div
              className="flex items-center"
              style={{
                marginTop: 14,
                gap: 10,
                padding: '8px 12px',
                borderRadius: V3Radius.xs,
                background: 'rgba(255,255,255,0.68)',
                border: `1px solid ${V3.rule}`,
              }}
            >
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: V3FontWeight.bold,
                    color: V3.ink,
                  }}
                >
                  {tierMetaOrNull?.benefit ??
                    `스탬프 ${stampsToFirstTier(stamps)}개만 더 모으면 씨앗으로 시작해요`}
                </div>
              </div>
              <ChevronRight size={14} color={V3.inkMute} strokeWidth={2} />
            </div>
          </div>
        </Link>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          스탬프 카드 — 멤버십 화면을 눌러야만 보이던 걸 밖으로 꺼냈다(사장님 2026-07-16).
          등급의 기준이 스탬프 개수라, 등급 카드 바로 밑이 제자리다.
          ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '12px 20px 0' }}>
        <StampCard stampCount={profile?.stamp_count} variant="app" />
      </section>

      {/* ──────────────────────────────────────────────────────────────
          Stat grid — orders / subs / dogs (3-col).
          (쿠폰·찜 열은 그 기능들이 폐지되며 사라졌다 — 2026-07-16 주석 정정)
          ────────────────────────────────────────────────────────────── */}
      {(orderCount > 0 || subCount > 0) && (
        <section style={{ padding: '10px 20px 0' }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 0,
              background: V3.paperHi,
              border: `1px solid ${V3.rule}`,
              borderRadius: V3Radius.sm,
              overflow: 'hidden',
            }}
          >
            <StatCell
              href="/mypage/orders"
              kicker="Orders"
              value={orderCount}
              unit="건"
              tone="ink"
              isFirst
            />
            <StatCell
              href="/mypage/subscriptions"
              kicker="Subs"
              value={subCount}
              unit="건"
              tone="sage"
            />
          </div>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────────
          Menu groups — kicker + paperHi 카드 + ink rule
          ────────────────────────────────────────────────────────────── */}
      <MenuGroup kicker="Orders · 주문 & 배송" topPad={28}>
        <MenuItem href="/mypage/orders" Icon={Package} label="주문 내역" />
        <MenuItem
          href="/mypage/subscriptions"
          Icon={Repeat}
          label="정기배송 관리"
        />
        <MenuItem href="/mypage/addresses" Icon={MapPin} label="배송지 관리" last />
      </MenuGroup>

      <MenuGroup kicker="Benefits · 혜택" topPad={20}>
        <MenuItem href="/mypage/membership" Icon={Crown} label="멤버십 등급" last />
      </MenuGroup>

      <MenuGroup kicker="Settings · 설정" topPad={20}>
        {/* 변수별 분석 맞춤도 — 홈에서 분리해 이쪽으로 이동(2026-06-11). */}
        <MenuItem href="/mypage/accuracy" Icon={Gauge} label="분석 맞춤도" />
        {/* R-feel: 상단 헤더에서 알림 종을 강아지 칩으로 교체 → 알림함 진입을
            마이페이지로 이동(고립 방지). */}
        <MenuItem href="/notifications" Icon={Bell} label="받은 알림" />
        <MenuItem
          href="/mypage/notifications"
          Icon={Bell}
          label="알림 받기 · 화면 테마"
        />
        <MenuItem href="/mypage/consent" Icon={Mail} label="광고 수신 설정" />
        <MenuItem
          href="/mypage/privacy"
          Icon={Shield}
          label="내 데이터 (열람·다운로드)"
          last
        />
      </MenuGroup>

      <MenuGroup kicker="Help · 도움말" topPad={20}>
        <MenuItem href="/chat" Icon={Sparkles} label="AI 영양 상담" />
        <MenuItem href="/business" Icon={HelpCircle} label="고객센터" />
        <MenuItem href="/faq" Icon={FileText} label="자주 묻는 질문" last />
      </MenuGroup>

      {/* 약관·정책 */}
      <section style={{ padding: '24px 20px 8px' }}>
        <Mono color="inkMute" size="xxs" weight={500} letterSpacing="0.12em">
          <Link href="/legal" style={{ color: V3.inkMute, textDecoration: 'none' }}>
            약관 · 정책
          </Link>
        </Mono>
      </section>

      {/* 로그아웃 */}
      <section style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center justify-center transition active:scale-[0.98]"
          style={{
            gap: 8,
            padding: '14px 16px',
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            fontWeight: V3FontWeight.semibold,
            color: V3.inkMute,
          }}
        >
          <LogOut size={16} strokeWidth={2} />
          로그아웃
        </button>
      </section>

      {/* Logout 확인 modal — confirm() 대체. */}
      <Modal
        open={logoutOpen}
        onClose={() => !loggingOut && setLogoutOpen(false)}
        title="로그아웃 하시겠어요?"
        dismissOnBackdrop={!loggingOut}
        showClose={!loggingOut}
      >
        <Modal.Body>
          저장된 정보는 그대로 유지돼요. 다시 로그인하면 똑같이 사용할 수 있어요.
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setLogoutOpen(false)}
            disabled={loggingOut}
            style={{
              padding: '10px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              background: V3.paperHi,
              color: V3.inkMute,
              border: `1px solid ${V3.rule}`,
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              opacity: loggingOut ? 0.5 : 1,
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={performLogout}
            disabled={loggingOut}
            style={{
              padding: '10px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              background: V3.ink,
              color: V3.paperHi,
              border: 'none',
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              opacity: loggingOut ? 0.7 : 1,
            }}
          >
            {loggingOut ? '로그아웃 중…' : '로그아웃'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* 탈퇴 */}
      <section style={{ padding: '12px 20px 0', textAlign: 'center' }}>
        <Link
          href="/mypage/delete"
          style={{
            fontSize: 10.5,
            color: V3.inkMute,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          회원 탈퇴
        </Link>
      </section>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// TierChip — 5단계 등급 시스템 (씨앗/새싹/꽃/열매/단짝)
// ──────────────────────────────────────────────────────────────
function TierChip({ tier }: { tier: string }) {
  const meta = tierMeta(tier)
  // 등급이 없으면 칩을 아예 안 그린다 — 빈 칩보다 없는 게 낫다.
  if (!meta) return null
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 4,
        fontFamily: 'var(--font-sans)',
        fontSize: 10.5,
        fontWeight: V3FontWeight.black,
        padding: '4px 10px',
        borderRadius: V3Radius.pill,
        background: meta.bg,
        color: meta.ink,
        letterSpacing: '-0.01em',
        border: `1px solid ${V3.rule}`,
      }}
    >
      {meta.label}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────
// StatCell — 4-col 메트릭 strip 한 cell
// ──────────────────────────────────────────────────────────────
function StatCell({
  href,
  kicker,
  value,
  unit,
  tone,
  isFirst,
}: {
  href: string
  kicker: string
  value: number
  unit: string
  tone: 'ink' | 'sage' | 'accent' | 'yellow'
  isFirst?: boolean
}) {
  const toneColor: Record<typeof tone, string> = {
    ink: V3.ink,
    sage: V3.sage,
    accent: V3.accent,
    yellow: V3.yellow,
  }
  return (
    <Link
      href={href}
      style={{
        padding: '12px 10px',
        borderLeft: isFirst ? 'none' : `1px solid ${V3.rule}`,
        textDecoration: 'none',
        display: 'block',
      }}
    >
      <Mono color="inkMute" size="xxs" weight={500}>
        {kicker}
      </Mono>
      <div className="flex items-baseline" style={{ marginTop: 6, gap: 3 }}>
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 22,
            color: toneColor[tone],
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <Mono color="inkMute" size="xxs" weight={500} letterSpacing="0.04em">
          {unit}
        </Mono>
      </div>
    </Link>
  )
}

// ──────────────────────────────────────────────────────────────
// MenuGroup — kicker label + paperHi 카드 wrapper
// ──────────────────────────────────────────────────────────────
function MenuGroup({
  kicker,
  topPad,
  children,
}: {
  kicker: string
  topPad: number
  children: React.ReactNode
}) {
  return (
    <section style={{ padding: `${topPad}px 20px 0` }}>
      <div style={{ marginBottom: 8, paddingLeft: 2 }}>
        <Mono color="inkMute" size="xxs" weight={500}>
          {kicker}
        </Mono>
      </div>
      <div
        style={{
          background: V3.paperHi,
          border: `1px solid ${V3.rule}`,
          borderRadius: V3Radius.sm,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </section>
  )
}

// ──────────────────────────────────────────────────────────────
// MenuItem — 단일 row (icon + label + chevron, optional badge)
// ──────────────────────────────────────────────────────────────
function MenuItem({
  href,
  Icon,
  label,
  comingSoon,
  last,
  badge,
}: {
  href?: string
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  label: string
  comingSoon?: boolean
  last?: boolean
  badge?: number
}) {
  const borderBottom = last ? 'none' : `1px solid ${V3.rule}`

  if (comingSoon || !href) {
    return (
      <div
        className="flex items-center justify-between"
        style={{
          padding: '14px 16px',
          borderBottom,
        }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <Icon size={18} color={V3.inkMute} strokeWidth={1.5} />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: V3FontSize.base,
              fontWeight: V3FontWeight.semibold,
              color: V3.inkMute,
            }}
          >
            {label}
          </span>
        </div>
        <Mono
          color="inkMute"
          size="xxs"
          weight={500}
          letterSpacing="0.08em"
          style={{
            padding: '2px 8px',
            background: V3.paper,
            borderRadius: V3Radius.xs,
          }}
        >
          준비 중
        </Mono>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="flex items-center justify-between transition active:opacity-60"
      style={{
        padding: '14px 16px',
        borderBottom,
        textDecoration: 'none',
      }}
    >
      <div className="flex items-center min-w-0" style={{ gap: 12 }}>
        <Icon size={18} color={V3.ink} strokeWidth={1.5} />
        <span
          className="truncate"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: V3FontSize.base,
            fontWeight: V3FontWeight.semibold,
            color: V3.ink,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </span>
        {typeof badge === 'number' && badge > 0 && (
          <Badge tone="accent" filled size="sm">
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
      </div>
      <ChevronRight size={16} color={V3.inkMute} strokeWidth={2} />
    </Link>
  )
}
