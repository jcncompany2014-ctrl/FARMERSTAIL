import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { rowToAddress, type AddressRow } from '@/lib/commerce/addresses'
import { isAppContextServer } from '@/lib/app-context'
import ProfileAppView from '@/components/v3/me/ProfileAppView'
import ProfileWebView from './ProfileWebView'

/**
 * /account/profile — 기본 프로필 편집.
 *
 * /account 의 hub 에서 진입. 로그인 필수. 이름/휴대폰을 편집할 수 있음.
 * (견주 생일 입력 폐기 2026-06-27 — 생일 할인은 강아지 생일 기준.)
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M01): 앱이면 ProfileAppView 를 그린다(조회는 아래 그대로 공유).
 * 2026-10-10 웹 리뉴얼: 웹은 ProfileWebView(웹 시안 WEB-A20 — 새 웹 가게 틀, ← 내 계정).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // 루트 template 이 '| 파머스테일' 을 붙인다 — 직접 쓰면 두 번 붙는다(2026-08-01 전수).
  title: '내 프로필',
  alternates: { canonical: '/account/profile' },
  robots: { index: false, follow: false },
}

export default async function ProfileEditPage() {
  const isApp = await isAppContextServer()

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

  if (isApp) {
    return (
      <AuthAwareShell>
        <ProfileAppView
          profile={profile ?? null}
          email={user.email ?? null}
          addresses={addresses}
          // 가입 방식 판정은 기존 정본(auth/callback·age-gate 의 app_metadata.provider) 그대로 — 새로 만들지 않는다.
          // 소셜(카카오·애플) 가입자는 비밀번호가 없어 재설정 메일 카드를 숨긴다(사장님 결정).
          canResetPassword={((user.app_metadata?.provider as string | undefined) ?? '') === 'email'}
        />
      </AuthAwareShell>
    )
  }

  // 웹 = 웹 시안 WEB-A20(2026-10-10 웹 리뉴얼) — ProfileWebView(새 웹 가게 틀). 예전 웹 판(FD 카드)은 git 이력.
  return (
    <ProfileWebView
      profile={profile ?? null}
      email={user.email ?? null}
      addresses={addresses}
      canResetPassword={((user.app_metadata?.provider as string | undefined) ?? '') === 'email'}
    />
  )
}
