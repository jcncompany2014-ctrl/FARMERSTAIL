import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import AuthDemo from './AuthDemo'

/**
 * /design-check-auth — 로그인·가입 앱 화면(앱 새 디자인 'A 포스터' 묶음⑤, 캔버스 W07~W13·W25·W26) 점검(2026-10-09).
 *
 * 이 화면들은 앱 틀(AppChrome) 밖에서 그려지므로 (main)/design-check 가 아니라 여기서 띄운다. 메일을 보낸 뒤·링크로
 * 들어온 뒤·로그인한 뒤에만 보이는 상태를 예시 값으로 보여 준다. **실제 사이트(production)에선 404**, noindex.
 * 실제 주소로 볼 수 있는 상태(/login · /login?reset=1 · /forgot-password · /reset-password(링크 없음 = 만료) ·
 * /auth/confirmed · /offline)는 그 주소를 앱 쿠키로 연다.
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 로그인',
  robots: { index: false, follow: false },
}

// first = 새 첫 화면(시안 Y1~Y6) — &step=0~6 · &fresh=1(빈 초안) · &photo=1(사진 고른 뒤).
const SCREENS = ['forgot', 'forgot-sent', 'reset', 'reset-expired', 'reset-done', 'age-gate', 'age-gate-under14', 'first'] as const

export default async function DesignCheckAuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''
  if ((SCREENS as readonly string[]).includes(s))
    return (
      <Suspense fallback={null}>
        <AuthDemo s={s} fresh={sp.fresh === '1'} photo={sp.photo === '1'} />
      </Suspense>
    )
  return (
    <main style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>로그인·가입 앱 화면 점검</h1>
      {SCREENS.map((k) => (
        <Link key={k} href={`/design-check-auth?s=${k}`}>
          {k}
        </Link>
      ))}
    </main>
  )
}
