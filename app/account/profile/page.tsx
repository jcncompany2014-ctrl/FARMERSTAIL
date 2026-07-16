import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, ArrowLeft, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import ProfileForm from '@/components/account/ProfileForm'
import PasswordChangeButton from '@/components/account/PasswordChangeButton'
import TierBadge from '@/components/account/TierBadge'
import AddressesClient from '@/app/(main)/mypage/addresses/AddressesClient'
import { rowToAddress, type AddressRow } from '@/lib/commerce/addresses'
import { isAppContextServer } from '@/lib/app-context'
import { Eyebrow } from '@/components/web/fd/ui'

/**
 * /account/profile — 기본 프로필 편집.
 *
 * /account 의 hub 에서 진입. 로그인 필수. 이름/휴대폰을 편집할 수 있음.
 * (견주 생일 입력 폐기 2026-06-27 — 생일 할인은 강아지 생일 기준.)
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '내 프로필 | 파머스테일',
  alternates: { canonical: '/account/profile' },
  robots: { index: false, follow: false },
}

export default async function ProfileEditPage() {
  const isApp = await isAppContextServer()
  // 앱 사용자는 /mypage hub 에서 진입했으니 뒤로가기/breadcrumb 도 거기로.
  // 웹 사용자는 /account hub 에서 진입.
  const backHref = isApp ? '/mypage' : '/account'
  const backLabel = isApp ? '마이페이지' : '내 계정'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/profile')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, tier, stamp_count')
    .eq('id', user.id)
    .maybeSingle()

  // 배송지 — 별도 페이지(/mypage/addresses) 없애고 프로필로 편입(사장님 2026-07-16).
  // 저장/삭제/기본설정 로직·API·체크아웃은 그대로. 여기선 목록만 보여준다.
  const { data: addrRows } = await supabase
    .from('addresses')
    .select(
      'id, user_id, label, recipient_name, phone, zip, address, address_detail, is_default, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  const addresses = ((addrRows ?? []) as AddressRow[]).map(rowToAddress)

  return (
    <AuthAwareShell>
      <main
        className="pb-12 md:pb-20 mx-auto"
        style={{ background: 'var(--fd-offwhite)', maxWidth: 880 }}
      >
        {/* 앱: 상단 ← 헤더가 뒤로가기를 담당 → 본문 뒤로가기 + 브레드크럼(웹
            패턴) 숨김. 웹: per-screen 헤더 없음 → editorial 뒤로가기/브레드크럼 유지. */}
        {!isApp && (
        <div className="px-5 md:px-8 pt-4 md:pt-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-[11px] md:text-[12px] hover:opacity-70 transition"
            style={{ color: 'var(--fd-muted)' }}
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={2.5} />
            {backLabel}
          </Link>
          <nav
            aria-label="현재 위치"
            className="flex items-center gap-1 text-[11px] md:text-[12px] mt-2"
            style={{ color: 'var(--fd-muted)' }}
          >
            <Link href="/" className="hover:opacity-70 transition">
              홈
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
            <Link href={backHref} className="hover:opacity-70 transition">
              {backLabel}
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
            <span style={{ color: 'var(--fd-pine)', fontWeight: 700 }}>프로필</span>
          </nav>
        </div>
        )}

        <section className="px-5 md:px-8 pt-6 md:pt-10 pb-4 md:pb-6">
          <Eyebrow>Profile · 내 프로필</Eyebrow>
          <h1
            className="mt-2 md:mt-3 text-[24px] md:text-[36px]"
            style={{
              fontWeight: 800,
              color: 'var(--fd-pine)',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
            }}
          >
            내 프로필
          </h1>
          <p
            className="mt-2 text-[12px] md:text-[14px]"
            style={{ color: 'var(--fd-muted)' }}
          >
            이름·연락처를 변경할 수 있어요. 이메일은 변경 시 별도 인증
            절차가 필요해요.
          </p>
        </section>

        {/* 등급 카드 */}
        <section className="px-5 md:px-8 pb-2">
          <TierBadge
            stampCount={
              (profile as { stamp_count?: number | null } | null)?.stamp_count ?? 0
            }
          />
        </section>

        <section className="px-5 md:px-8">
          <div
            className="rounded-lg p-5 md:p-7"
            style={{
              background: '#FFFFFF',
              boxShadow: 'inset 0 0 0 1px var(--fd-line)',
            }}
          >
            <ProfileForm
              initial={{
                name: profile?.name ?? null,
                phone: profile?.phone ?? null,
                email: user.email ?? null,
              }}
            />
          </div>

          {/* 비밀번호 변경 — 별도 카드. 직접 update 가 아니라 reset 메일 발송. */}
          <div
            className="mt-4 rounded-lg p-5"
            style={{
              background: 'var(--fd-cream)',
              boxShadow: 'inset 0 0 0 1px var(--fd-line)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div
                  className="text-[12px] font-bold"
                  style={{ color: 'var(--fd-pine)' }}
                >
                  비밀번호 변경
                </div>
                <p
                  className="text-[11px] mt-1 leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  가입 이메일 ({user.email}) 로 재설정 링크를 보내드려요.
                </p>
              </div>
            </div>
            <PasswordChangeButton email={user.email ?? ''} />
          </div>

        </section>

        {/* 배송지 — 별도 페이지 대신 프로필에서 관리(2026-07-16). 추가/수정은 폼 라우트. */}
        <section className="px-5 md:px-8 mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold" style={{ color: 'var(--fd-pine)' }}>
              배송지
            </h2>
            <Link
              href="/mypage/addresses/new"
              className="inline-flex items-center gap-1 text-[11.5px] font-bold"
              style={{ color: 'var(--fd-coral-text)' }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              추가
            </Link>
          </div>
          {addresses.length === 0 ? (
            <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--fd-muted)' }}>
              저장된 배송지가 없어요. 추가하면 체크아웃에서 자동 선택돼요.
            </p>
          ) : (
            <AddressesClient initial={addresses} />
          )}
        </section>

        <section className="px-5 md:px-8 mt-8 md:mt-12">
          <p
            className="text-[11.5px] md:text-[12.5px]"
            style={{ color: 'var(--fd-muted)' }}
          >
            이메일 / 비밀번호 변경, 회원 탈퇴는{' '}
            <Link
              href="/mypage/delete"
              className="font-bold underline underline-offset-2"
              style={{ color: 'var(--fd-coral-text)' }}
            >
              계정 관리
            </Link>{' '}
            에서 진행하실 수 있어요.
          </p>
        </section>
      </main>
    </AuthAwareShell>
  )
}
