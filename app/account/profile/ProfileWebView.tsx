/**
 * ProfileWebView — /account/profile 의 **웹** 화면(웹 시안 WEB-A20, 2026-10-10 웹 리뉴얼). 새 웹 가게 틀.
 *
 * 조회·로그인 확인은 page.tsx 가 하고 여기는 받은 값으로 그리기만 한다(앱은 ProfileAppView — 같은 값).
 *  · 등급 띠 = 등급 색 네모 + 등급 이름 + 도장 개수·다음 등급까지(정본 lib/tiers — 앱과 같은 계산).
 *  · 기본 정보·비밀번호는 앱과 같은 새 부품(ProfileForm·PasswordChangeButton variant='app'). 비밀번호 카드는 이메일 가입자만
 *    (사장님 결정 — 카카오·애플 가입자는 비밀번호가 없다).
 *  · 배송지 추가·수정 폼은 앱 전용이라 웹에선 앱 안내(/app-required)로. 삭제·기본 설정은 여기서(AddressesClient look='web').
 */

import Link from 'next/link'
import ProfileForm from '@/components/account/ProfileForm'
import PasswordChangeButton from '@/components/account/PasswordChangeButton'
import AddressesClient from '@/app/(main)/mypage/addresses/AddressesClient'
import StoreShell from '@/components/store/StoreShell'
import { TierSquare } from '@/components/v3/me/MeParts'
import type { Address } from '@/lib/commerce/addresses'
import { nextTier, resolveTierKey, tierMeta, TIERS } from '@/lib/tiers'

const APP_ADDRESS_HREF = '/app-required?from=%2Fmypage%2Faddresses'

export default function ProfileWebView({
  profile,
  email,
  addresses,
  canResetPassword,
}: {
  profile: { name: string | null; phone: string | null; tier?: string | null; stamp_count?: number | null } | null
  email: string | null
  addresses: Address[]
  canResetPassword: boolean
}) {
  const stamps = profile?.stamp_count ?? 0
  const tier = tierMeta(resolveTierKey(profile?.tier ?? null, stamps))
  const next = tier ? nextTier(tier.key) : TIERS[0]
  return (
    <StoreShell>
      <section style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/account"
          style={{ alignSelf: 'flex-start', minHeight: 48, marginLeft: -6, paddingRight: 8, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#3D3D3D', textDecoration: 'none' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          내 계정
        </Link>
        <h1 className="d" style={{ margin: '4px 0 0', fontSize: 36, lineHeight: 1.1 }}>
          내 프로필
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>이름·연락처를 바꿀 수 있어요. 이메일을 바꾸면 새 주소로 인증 메일이 가요.</p>
        <div
          style={{
            marginTop: 18,
            minHeight: 56,
            boxSizing: 'border-box',
            padding: '0 16px',
            borderRadius: 4,
            background: '#F6F4F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tier && <TierSquare color={tier.bg} size={14} />}
            <strong style={{ fontSize: 17, fontWeight: 800 }}>{tier ? `${tier.label} 등급` : '멤버십 시작 전'}</strong>
          </span>
          <span style={{ fontSize: 15, color: '#595959', whiteSpace: 'nowrap' }}>
            도장 {stamps}개{next ? ` · ${next.label}까지 ${Math.max(0, next.threshold - stamps)}개` : ''}
          </span>
        </div>
      </section>

      <section aria-label="기본 정보" style={{ padding: '28px 20px 0' }}>
        <ProfileForm variant="app" initial={{ name: profile?.name ?? null, phone: profile?.phone ?? null, email }} />
      </section>

      {canResetPassword && (
        <section
          aria-labelledby="pw-title"
          style={{ margin: '28px 20px 0', padding: 18, borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <h2 id="pw-title" style={{ margin: 0, fontFamily: 'inherit', fontSize: 18, fontWeight: 800, letterSpacing: 'inherit' }}>
            비밀번호 변경
          </h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: '#3D3D3D', overflowWrap: 'anywhere' }}>가입 이메일({email})로 재설정 링크를 보내드려요.</p>
          <div style={{ marginTop: 8 }}>
            <PasswordChangeButton email={email ?? ''} variant="app" />
          </div>
        </section>
      )}

      <section aria-labelledby="addr-title" style={{ padding: '40px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="addr-title" className="d" style={{ margin: 0, fontSize: 24 }}>
            배송지
          </h2>
          {/* 배송지 추가·수정 폼(/mypage/addresses/*)은 앱 전용 — 웹은 앱 안내로("추가"라고 해 놓고 못 하던 것, 2026-07-31). */}
          <Link
            href={APP_ADDRESS_HREF}
            style={{ minHeight: 48, padding: '0 2px 0 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 17, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            추가
          </Link>
        </div>
        <div style={{ marginTop: 10 }}>
          {addresses.length === 0 ? (
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#595959' }}>저장된 배송지가 없어요. 앱에서 추가해 두면 주문할 때 알아서 채워져요.</p>
          ) : (
            <AddressesClient initial={addresses} isApp={false} look="web" />
          )}
        </div>
      </section>

      <p style={{ margin: '28px 20px 64px', fontSize: 16, lineHeight: 1.6, color: '#595959' }}>
        회원 탈퇴는{' '}
        <Link href="/mypage/delete" style={{ fontWeight: 800, color: '#141414' }}>
          계정 관리
        </Link>
        에서 할 수 있어요.
      </p>
    </StoreShell>
  )
}
