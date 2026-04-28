import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import ProfileForm from '@/components/account/ProfileForm'
import { isAppContextServer } from '@/lib/app-context'

/**
 * /account/profile — 기본 프로필 편집.
 *
 * /account 의 hub 에서 진입. 로그인 필수. 이름/휴대폰/생일을 편집할 수 있음.
 * 생일 (월/일) 을 채우면 생일 당일 자동으로 환영 쿠폰 메일이 발송됨
 * (cron + 마케팅 수신 동의 조건).
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
    .select('name, phone, birth_year, birth_month, birth_day, agree_email')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <AuthAwareShell>
      <main
        className="pb-12 md:pb-20 mx-auto"
        style={{ background: 'var(--bg)', maxWidth: 880 }}
      >
        <div className="px-5 md:px-8 pt-4 md:pt-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-[11px] md:text-[12px] hover:opacity-70 transition"
            style={{ color: 'var(--muted)' }}
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={2.5} />
            {backLabel}
          </Link>
          <nav
            aria-label="현재 위치"
            className="flex items-center gap-1 text-[11px] md:text-[12px] mt-2"
            style={{ color: 'var(--muted)' }}
          >
            <Link href="/" className="hover:text-terracotta transition">
              홈
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
            <Link href={backHref} className="hover:text-terracotta transition">
              {backLabel}
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
            <span style={{ color: 'var(--ink)', fontWeight: 700 }}>프로필</span>
          </nav>
        </div>

        <section className="px-5 md:px-8 pt-6 md:pt-10 pb-4 md:pb-6">
          <span
            className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
            style={{ color: 'var(--terracotta)' }}
          >
            Profile · 내 프로필
          </span>
          <h1
            className="font-serif mt-2 md:mt-3 text-[24px] md:text-[36px]"
            style={{
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
            }}
          >
            내 프로필
          </h1>
          <p
            className="mt-2 text-[12px] md:text-[14px]"
            style={{ color: 'var(--muted)' }}
          >
            이름·연락처·생일을 변경할 수 있어요. 이메일은 변경 시 별도 인증
            절차가 필요해요.
          </p>
        </section>

        <section className="px-5 md:px-8">
          <div
            className="rounded-2xl p-5 md:p-7"
            style={{
              background: 'var(--bg)',
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            <ProfileForm
              initial={{
                name: profile?.name ?? null,
                phone: profile?.phone ?? null,
                birth_year: profile?.birth_year ?? null,
                birth_month: profile?.birth_month ?? null,
                birth_day: profile?.birth_day ?? null,
              }}
            />
          </div>

          {!profile?.agree_email && (
            <p
              className="mt-4 text-[11.5px] md:text-[12.5px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              ※ 생일 쿠폰 메일을 받으시려면{' '}
              <Link
                href="/mypage/consent"
                className="font-bold underline underline-offset-2"
                style={{ color: 'var(--terracotta)' }}
              >
                마케팅 수신 동의
              </Link>{' '}
              가 필요해요.
            </p>
          )}
        </section>

        <section className="px-5 md:px-8 mt-8 md:mt-12">
          <p
            className="text-[11.5px] md:text-[12.5px]"
            style={{ color: 'var(--muted)' }}
          >
            이메일 / 비밀번호 변경, 회원 탈퇴는{' '}
            <Link
              href="/mypage/delete"
              className="font-bold underline underline-offset-2"
              style={{ color: 'var(--terracotta)' }}
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
