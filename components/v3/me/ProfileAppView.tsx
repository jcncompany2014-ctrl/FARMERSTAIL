/**
 * ProfileAppView — /account/profile 의 **앱** 화면 (2026-10-09 앱 새 디자인 'A 포스터', 시안 M01).
 *
 * /account/profile 은 웹·앱이 같이 쓰는 주소다. 웹 마크업은 page.tsx 에 그대로 두고(한 픽셀도 안 바뀜),
 * 앱일 때만 이 화면을 그린다(AGENTS.md R14 — isAppContextServer 분기). 조회·로그인 확인은 page.tsx 가 그대로 하고
 * 여기는 받은 값으로 그리기만 한다 — 점검 화면(/design-check/me)이 예시 값으로 같은 화면을 그린다.
 * 파일은 app/account 밖(앱 전용 components/v3)에 둔다 — app/account/** 는 웹 사용자용 화면이라 앱 전용 경로
 * (/mypage/addresses/new 등) 링크를 분기 없이 두면 규칙21 이 막는다. 이 화면은 앱일 때만 그려진다.
 *
 *  · 등급 카드(이 화면의 도장 그림자 한 곳) = 등급 색 네모 + 등급 이름 + 혜택 한 줄 + 도장 개수 + 다음 등급까지 + 막대.
 *    등급 정본은 profiles.tier(ratcheted floor) — resolveTierKey(강등 없음 2026-07-22, TierBadge 와 같은 계산).
 *  · 비밀번호 변경 카드는 **이메일 가입자에게만**(사장님 결정) — 카카오·애플 가입자는 비밀번호가 없다.
 *    가입 방식 판정은 page.tsx 가 기존 정본(user.app_metadata.provider)으로 한다.
 *  · 맨 아래 옛 문구 "이메일 / 비밀번호 변경, 회원 탈퇴는 계정 관리에서" 는 사실과 달랐다(이메일·비밀번호는 이 화면,
 *    링크는 탈퇴 화면) — 앱은 실제 위치인 '회원 탈퇴 ›' 줄로 바꿨다(시안 M01).
 */

import Link from 'next/link'
import ProfileForm from '@/components/account/ProfileForm'
import PasswordChangeButton from '@/components/account/PasswordChangeButton'
import AddressesClient from '@/app/(main)/mypage/addresses/AddressesClient'
import type { Address } from '@/lib/commerce/addresses'
import { TIERS, tierMeta, resolveTierKey, nextTier, stampsToNextTier, stampsToFirstTier } from '@/lib/tiers'
import { V3, V3Radius } from '@/lib/design/tokens'
import { MeCss, PlainTitle, SCREEN_ROOT, STAMP_CARD, SectionTitle, TierSquare } from '@/components/v3/me/MeParts'

export default function ProfileAppView({
  profile,
  email,
  addresses,
  canResetPassword,
}: {
  profile: { name: string | null; phone: string | null; tier?: string | null; stamp_count?: number | null } | null
  email: string | null
  addresses: Address[]
  /** 이메일 가입자인가 — 소셜 가입자에겐 비밀번호 카드를 숨긴다. */
  canResetPassword: boolean
}) {
  return (
    <div style={SCREEN_ROOT}>
      <MeCss />
      <p style={{ margin: '20px 20px 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
        이름과 연락처를 바꿀 수 있어요. 이메일은 바꾸면 새 주소로 가는 인증 메일을 한 번 더 확인해야 해요.
      </p>

      <TierCard stampCount={profile?.stamp_count ?? 0} tier={profile?.tier ?? null} />

      <section aria-labelledby="pf-basic" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionTitle id="pf-basic" size={24}>
          기본 정보
        </SectionTitle>
        <ProfileForm
          variant="app"
          initial={{
            name: profile?.name ?? null,
            phone: profile?.phone ?? null,
            email,
          }}
        />
      </section>

      {/* 비밀번호 변경 — 직접 update 가 아니라 reset 메일 발송. 이메일 가입자에게만. */}
      {canResetPassword && (
        <section
          aria-labelledby="pf-pw"
          style={{
            margin: '28px 20px 0',
            padding: 18,
            borderRadius: V3Radius.sm,
            background: V3.soft,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <PlainTitle id="pf-pw">비밀번호 변경</PlainTitle>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
            가입 이메일({email})로 재설정 링크를 보내드려요.
          </p>
          <PasswordChangeButton email={email ?? ''} variant="app" />
        </section>
      )}

      {/* 배송지 — 별도 페이지 대신 프로필에서 관리(2026-07-16). 추가/수정은 폼 라우트(앱 전용). */}
      <section aria-labelledby="pf-addr" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle id="pf-addr" size={24}>
            배송지
          </SectionTitle>
          <Link
            href="/mypage/addresses/new"
            style={{
              height: 44,
              padding: '0 14px',
              boxSizing: 'border-box',
              borderRadius: V3Radius.sm,
              border: `1.5px solid ${V3.ink}`,
              display: 'flex',
              alignItems: 'center',
              fontSize: 15,
              fontWeight: 800,
              color: V3.ink,
              textDecoration: 'none',
            }}
          >
            + 추가
          </Link>
        </div>
        {addresses.length === 0 ? (
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkMute }}>
            저장된 배송지가 없어요. 추가하면 주문할 때 자동으로 선택돼요.
          </p>
        ) : (
          <AddressesClient initial={addresses} isApp />
        )}
      </section>

      <Link
        href="/mypage/delete"
        style={{
          margin: '28px 20px 0',
          minHeight: 56,
          boxSizing: 'content-box',
          borderTop: `1px solid ${V3.rule}`,
          borderBottom: `1px solid ${V3.rule}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 16,
          fontWeight: 700,
          color: V3.inkMute,
          textDecoration: 'none',
        }}
      >
        회원 탈퇴<span aria-hidden>›</span>
      </Link>
    </div>
  )
}

/** 멤버십 등급 카드(시안 M01) — TierBadge(웹 /account 용)의 계산을 그대로 따른다. */
function TierCard({ stampCount, tier }: { stampCount: number; tier: string | null }) {
  const stamps = stampCount
  const meta = tierMeta(resolveTierKey(tier, stamps))
  const card = {
    margin: '20px 20px 0',
    padding: '18px 18px 16px',
    ...STAMP_CARD,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    background: V3.cream,
    color: V3.ink,
  }
  const bar = (pct: number) => (
    <span aria-hidden style={{ height: 8, background: 'rgba(20,20,20,0.10)', display: 'block' }}>
      <span style={{ display: 'block', width: `${pct}%`, height: 8, background: V3.mustard }} />
    </span>
  )

  // 아직 등급이 없다(도장 10개 미만) — 등급 카드를 억지로 채우지 않는다(사장님 확정 2026-07-16).
  if (!meta) {
    const first = TIERS[0]!
    return (
      <section aria-label="멤버십 등급" style={card}>
        <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>멤버십 등급</span>
        <span className="ft-poster" style={{ fontSize: 30, lineHeight: 1.1 }}>
          아직 등급이 없어요
        </span>
        <span style={{ fontSize: 15, color: V3.inkMute }}>
          도장 {first.threshold}개를 모으면 {first.label} 등급으로 멤버십이 시작돼요.
        </span>
        <span style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <StampCount stamps={stamps} />
          <span style={{ fontSize: 15, fontWeight: 800 }}>
            {first.label} 등급까지 {stampsToFirstTier(stamps)}개
          </span>
        </span>
        {bar(Math.min(100, (stamps / first.threshold) * 100))}
      </section>
    )
  }

  const next = nextTier(meta.key)
  const remain = stampsToNextTier(stamps, meta.key)
  // progress: (현재 등급 임계 + 다음까지) 사이 위치 — TierBadge 와 같은 식.
  const lower = meta.threshold
  const upper = next?.threshold ?? meta.threshold
  const progress =
    upper > lower ? Math.min(100, Math.max(0, ((stamps - lower) / (upper - lower)) * 100)) : 100

  return (
    <section aria-label="멤버십 등급" style={card}>
      <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>멤버십 등급</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <TierSquare color={meta.bg} />
        <span className="ft-poster" style={{ fontSize: 30, lineHeight: 1.1 }}>
          {meta.label} 등급
        </span>
      </span>
      <span style={{ fontSize: 15, color: V3.inkMute }}>{meta.benefit}</span>
      <span style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <StampCount stamps={stamps} />
        <span style={{ fontSize: 15, fontWeight: 800 }}>
          {next ? `${next.label} 등급까지 ${remain}개` : '가장 높은 등급이에요'}
        </span>
      </span>
      {bar(progress)}
    </section>
  )
}

function StampCount({ stamps }: { stamps: number }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>도장 </span>
      <span className="ft-num" style={{ fontSize: 30, lineHeight: 1 }}>
        {stamps}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700 }}>개</span>
    </span>
  )
}
