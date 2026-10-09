'use client'

/**
 * MypageClient — v3 reskin (2026-05-22, R9).
 *
 * 비즈니스 로직(로그아웃·tier·count)은 audit #101 유지.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 T09 내 정보 · T10 로그아웃 확인):
 *   · 맨 위 = 큰 이름(제목 글꼴 34) + "프로필 / 비밀번호 →". 이메일 줄·등급 알약 칩·발자국 장식은 뺐다(시안에 없다,
 *     알약 칩 금지). 소셜(카카오·애플) 가입자는 비밀번호가 없어 "프로필 →" 만 쓴다(프로필 화면의 비밀번호 카드도
 *     이메일 가입자에게만 — 사장님 결정).
 *   · 멤버십 카드(이 화면의 도장 그림자 한 곳) = 등급 이름 + "혜택 보기 →" + 도장판 10칸 + 한 줄 설명. 예전엔 등급
 *     수채화 카드와 스탬프 카드(StampCard — 웹 /account 와 같이 쓰는 부품)가 따로 있었다. 수채화 배경은 시안에 없다.
 *     칸 수는 StampCard 와 같은 정본(cardProgressFloored + 등급 floor)으로 센다 — 등급이 잠근 완성 판 위로만 현재 판이
 *     얹힌다(강등 없음 2026-07-22).
 *   · 주문·정기배송 두 칸 · 메뉴 묶음(위 1.5px 먹선 + 줄 사이 옅은 선) · 맨 아래 한 줄(약관 · 정책 / 로그아웃 · 회원 탈퇴).
 *   · 로그아웃 확인 = 가운데 창(시안 T10 — 제목 21 · 설명 17 · 두 칸 버튼 56). 예전 v3 Modal 대신 직접 그린다.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { tierMeta, resolveTierKey } from '@/lib/tiers'
import { cardProgressFloored, STAMP_CARD_SIZE, STAMP_REWARD_LABEL } from '@/lib/stamps'
import { V3, V3Radius } from '@/lib/design/tokens'
import { withHonorific } from '@/lib/korean'
import { cleanupPushOnLogout } from '@/lib/capacitor'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import AdminModeRow from '@/components/app/AdminModeRow'
import { MENU_LINE, SCRIM, SCREEN_ROOT, STAMP_CARD, StampGrid } from '@/components/v3/me/MeParts'
import {
  BellIcon,
  BoxIcon,
  ChartIcon,
  ChevronRightIcon,
  CrownIcon,
  DataDownIcon,
  DocIcon,
  HelpIcon,
} from '@/components/v3/me/MeIcons'

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
  /** 이메일로 가입했나(user.app_metadata.provider === 'email') — 소셜 가입자는 비밀번호가 없다. */
  emailSignup?: boolean
  /** 점검 화면(/design-check/me) 전용 — 로그아웃 확인 창을 열어 둔 채로 그린다. 실제 화면은 넘기지 않는다. */
  previewLogoutOpen?: boolean
}

export default function MypageClient({
  email,
  profile,
  orderCount,
  subCount,
  emailSignup = true,
  previewLogoutOpen,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  // browser confirm() → 확인 창 — 톤 통일 + 접근성(포커스 가둠·Esc·하드웨어 뒤로가기는 useModalA11y).
  const [logoutOpen, setLogoutOpen] = useState(previewLogoutOpen ?? false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function performLogout() {
    setLoggingOut(true)
    // 푸시 정리(네이티브 토큰 + 웹 구독) — signOut 후엔 세션이 없어 못 지운다.
    await cleanupPushOnLogout()
    // ★서버 로그아웃이 실패해도(오프라인 등) 이 기기 세션은 확실히 지운다(2026-09-26 점검 7차).
    //   예전엔 오류를 안 봐서 로그인 화면으로 보냈는데 세션이 살아 있었다(푸시 토큰만 지워진 채).
    const { error: signOutErr } = await supabase.auth.signOut()
    if (signOutErr) await supabase.auth.signOut({ scope: 'local' })
    router.push('/login')
    router.refresh()
  }

  const displayName =
    profile?.name || (email ? email.split('@')[0] : null) || '보호자'
  // 등급 메타. **null = 아직 등급 없음**(스탬프 10개 미만, 2026-07-16 사장님 확정).
  // ★ 배지 정본 = profiles.tier(ratcheted floor, 강등 없음 2026-07-22). resolveTierKey 가
  //   profiles.tier 와 stamp_count 파생 중 높은 쪽을 취해 만료로 인한 오강등을 막는다.
  const stamps = profile?.stamp_count ?? 0
  const tierMetaOrNull = tierMeta(resolveTierKey(profile?.tier, stamps))
  // 도장판 현재 판 — 등급 floor(도달 등급 임계값) 위로만 얹힌다(StampCard 와 같은 정본).
  const card = cardProgressFloored(stamps, tierMetaOrNull?.threshold ?? 0)

  return (
    <div style={SCREEN_ROOT}>
      {/* 큰 이름 = 이 화면의 머리. 누르면 프로필(이름·연락처·비밀번호·배송지). */}
      <Link
        href="/account/profile"
        style={{
          margin: '22px 20px 0',
          color: V3.ink,
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span
          className="ft-poster"
          style={{ fontSize: 34, lineHeight: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {withHonorific(displayName)}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: V3.inkSoft, flexShrink: 0 }}>
          {emailSignup ? '프로필 / 비밀번호 →' : '프로필 →'}
        </span>
      </Link>

      {/* 멤버십 카드 — 등급 + 도장판. 스탬프 카드를 멤버십 화면 밖으로 꺼낸 자리(사장님 2026-07-16) —
          등급의 기준이 도장 개수라 등급 바로 밑이 제자리다. */}
      <Link
        href="/mypage/membership"
        aria-label="멤버십 등급 보기"
        style={{
          ...STAMP_CARD,
          margin: '18px 20px 0',
          padding: '18px 18px 16px',
          color: V3.ink,
          textDecoration: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: V3.cream,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>멤버십</span>
            {/* 등급 전(도장 10개 미만)엔 등급 이름 대신 '멤버십 시작 전' — 아무것도 안 한 사람에게 등급을 주지 않는다. */}
            <span className="ft-poster" style={{ fontSize: tierMetaOrNull ? 30 : 24, lineHeight: 1 }}>
              {tierMetaOrNull?.label ?? '멤버십 시작 전'}
            </span>
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, flexShrink: 0 }}>혜택 보기 →</span>
        </span>
        <StampGrid
          filled={card.filled}
          emptyBorder="#D9C4A3"
          size={STAMP_CARD_SIZE}
          label={`도장 ${STAMP_CARD_SIZE}칸 중 ${card.filled}개. ${card.remaining}개 더 모으면 ${STAMP_REWARD_LABEL}.`}
        />
        <span style={{ fontSize: 15, lineHeight: 1.5, color: V3.inkMute }}>
          정기배송 결제 한 번에 도장 하나. {STAMP_CARD_SIZE}칸을 채우면 보상을 드려요.
        </span>
      </Link>

      {/* 주문 / 정기배송 두 칸. 열 수 3 → 2(2026-07-30): 셀은 2개인데 3열이라 빈 칸이 남았었다.
          (쿠폰·찜 열은 그 기능들이 폐지되며 사라졌다 — 2026-07-16) */}
      {(orderCount > 0 || subCount > 0) && (
        <div style={{ margin: '16px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatCell href="/mypage/orders" label="주문" value={orderCount} band={V3.mustard} />
          <StatCell href="/mypage/subscriptions" label="정기배송" value={subCount} band={V3.ink} />
        </div>
      )}

      <MenuSection title="주문 · 배송">
        {/* '주문 내역' + '정기배송 관리' 를 한 줄로 합쳤다(사장님 2026-07-30).
            목적지는 정기배송 화면 — 거기서 다음 결제·진행 중 구독을 보여주고
            맨 아래 '결제·주문 내역' 줄로 /mypage/orders 로 넘어간다. 두 줄이
            나란히 있으면 어느 쪽을 눌러야 하는지 매번 고민하게 된다. */}
        <MenuRow href="/mypage/subscriptions" icon={<BoxIcon size={24} />} label="정기배송 · 주문 내역" last />
        {/* 배송지 관리는 프로필(/account/profile)로 편입(2026-07-16). */}
      </MenuSection>

      <MenuSection title="혜택">
        <MenuRow href="/reports" icon={<ChartIcon size={24} />} label="건강 리포트" />
        <MenuRow href="/mypage/membership" icon={<CrownIcon size={24} />} label="멤버십 등급" last />
      </MenuSection>

      <MenuSection title="설정">
        {/* 분석 맞춤도 — 사장님 2026-07-16 "나중에 쓸 수도 있어서 일단 숨김".
            페이지(/mypage/accuracy)는 남겨두고 메뉴 진입만 숨긴다. */}
        {/* 받은 알림·알림 설정·광고 수신 3개를 '알림' 한 페이지(탭)로 통합(2026-07-16). */}
        <MenuRow href="/notifications" icon={<BellIcon size={24} />} label="알림" last />
      </MenuSection>

      <MenuSection title="도움말">
        {/* AI 영양 상담 — 사장님 2026-07-16 "나중에 쓸 수도 있어서 일단 숨김". 페이지(/chat)는 남겨두고 메뉴만 숨긴다. */}
        <MenuRow href="/help" icon={<HelpIcon size={24} />} label="고객센터" />
        <MenuRow href="/faq" icon={<DocIcon size={24} />} label="자주 묻는 질문" />
        {/* 내 데이터(열람·다운로드) — PIPA §35 열람권은 고객센터 경로로도 충족돼
            메인 '설정'에서 '도움말' 하단으로 내림(사장님 2026-07-24, 눈에 덜 띄게).
            단 삭제/차단이 아니라 접근성은 유지 = 다크패턴 회피. */}
        <MenuRow href="/mypage/privacy" icon={<DataDownIcon size={24} />} label="내 데이터 (열람·다운로드)" last />
      </MenuSection>

      {/* 관리자 모드 — 운영자에게만(2026-10-09 윗줄 강아지 칩 메뉴에서 이리로 옮김) */}
      <AdminModeRow />

      {/* 맨 아래 한 줄 — 약관 · 정책 / 로그아웃 · 회원 탈퇴 */}
      <div style={{ margin: '26px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/legal"
          style={{ minHeight: 48, display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700, color: V3.inkSoft, textDecoration: 'underline' }}
        >
          약관 · 정책
        </Link>
        <span style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            style={{
              minHeight: 48,
              padding: '0 8px',
              border: 0,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 700,
              color: V3.inkSoft,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            로그아웃
          </button>
          <Link
            href="/mypage/delete"
            style={{ minHeight: 48, padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700, color: V3.inkMute, textDecoration: 'underline' }}
          >
            회원 탈퇴
          </Link>
        </span>
      </div>

      {logoutOpen && (
        <LogoutDialog
          busy={loggingOut}
          onCancel={() => !loggingOut && setLogoutOpen(false)}
          onConfirm={performLogout}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// LogoutDialog — 가운데 확인 창(시안 T10). 닫기 = 취소 버튼 · 바탕 누르기 · Esc · 하드웨어 뒤로가기.
// 우상단 X 는 아래 "취소" 와 중복이라 두지 않는다(사장님 2026-07-19).
// ──────────────────────────────────────────────────────────────
function LogoutDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  useModalA11y({ open: true, onClose: onCancel, containerRef: panelRef, preventEscape: busy })
  const button = {
    height: 56,
    boxSizing: 'border-box' as const,
    borderRadius: V3Radius.sm,
    fontFamily: 'inherit',
    fontSize: 17,
    fontWeight: 800,
    cursor: busy ? 'not-allowed' : 'pointer',
  }
  return (
    <>
      <div aria-hidden onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 145, background: SCRIM }} />
      <section
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ft-logout-title"
        aria-describedby="ft-logout-body"
        style={{
          position: 'fixed',
          zIndex: 150,
          left: 20,
          right: 20,
          top: 280,
          maxWidth: 440,
          margin: '0 auto',
          padding: '24px 20px 20px',
          background: '#FFFFFF',
          borderRadius: 8,
          boxShadow: '0 16px 40px rgba(20,20,20,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          lineHeight: 'normal',
          color: V3.ink,
        }}
      >
        <h2 id="ft-logout-title" style={{ margin: 0, fontFamily: 'inherit', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>
          로그아웃 하시겠어요?
        </h2>
        <p id="ft-logout-body" style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: V3.inkSoft }}>
          저장된 정보는 그대로 유지돼요. 다시 로그인하면 똑같이 사용할 수 있어요.
        </p>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{ ...button, border: `1.5px solid ${V3.ink}`, background: '#FFFFFF', color: V3.ink, opacity: busy ? 0.5 : 1 }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{ ...button, border: 0, background: V3.ink, color: '#FFFFFF', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? '로그아웃 중…' : '로그아웃'}
          </button>
        </div>
      </section>
    </>
  )
}

// ──────────────────────────────────────────────────────────────
// StatCell — 회색 면 + 위 6px 색 띠(주문 = 머스타드, 정기배송 = 먹색) + 큰 숫자(Anton 30).
// ──────────────────────────────────────────────────────────────
function StatCell({ href, label, value, band }: { href: string; label: string; value: number; band: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: '14px 16px',
        color: V3.ink,
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderRadius: V3Radius.sm,
        background: V3.soft,
        borderTop: `6px solid ${band}`,
        boxSizing: 'content-box',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>
        <span className="ft-num" style={{ fontSize: 30 }}>
          {value}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800 }}> 건</span>
      </span>
    </Link>
  )
}

// ──────────────────────────────────────────────────────────────
// MenuSection · MenuRow — 회색 소제목 + 위 1.5px 먹선 + 줄(높이 60 · 아이콘 24 · 글자 17 · 꺾쇠).
// ──────────────────────────────────────────────────────────────
function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ margin: '28px 20px 0' }}>
      <h2 style={{ margin: '0 0 4px', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, color: V3.inkMute, letterSpacing: '-0.02em' }}>
        {title}
      </h2>
      <div style={{ borderTop: `1.5px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  )
}

function MenuRow({ href, icon, label, last }: { href: string; icon: ReactNode; label: string; last?: boolean }) {
  return (
    <Link
      href={href}
      className="transition active:opacity-60"
      style={{
        minHeight: 60,
        padding: '0 4px',
        boxSizing: 'content-box',
        borderBottom: last ? 0 : `1px solid ${MENU_LINE}`,
        color: V3.ink,
        textDecoration: 'none',
        display: 'grid',
        gridTemplateColumns: '28px 1fr 20px',
        columnGap: 12,
        alignItems: 'center',
      }}
    >
      {icon}
      <span style={{ fontSize: 17, fontWeight: 700, minWidth: 0 }}>{label}</span>
      <ChevronRightIcon size={20} color={V3.inkMute} strokeWidth={2.2} />
    </Link>
  )
}
