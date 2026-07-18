import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { isAppContextServer } from '@/lib/app-context'
import { Container, Display, Eyebrow } from '@/components/web/fd/ui'
import SubscriptionsWebClient from './SubscriptionsWebClient'
import { subscriptionState } from '@/lib/subscription-state'
import type { Subscription } from './types'

/**
 * /account/subscriptions — 웹 사용자용 정기배송 관리.
 *
 * (main)/mypage/subscriptions 의 풀 관리 기능(일시정지·재개·주기변경·해지·
 * 배송알림·카드재등록)을 **웹에서도 동일하게** 제공 (사장님 2026-06-27 "앱과 동일
 * 풀관리"). 단 시각은 AppChrome 폰프레임 v3 가 아니라 FD 톤으로 — 그래서 앱
 * 컴포넌트를 재사용하지 않고 web 전용 client 를 별도로 둔다.
 *
 * # 결제 안전
 * 모든 액션은 RLS 보호 `subscriptions` 테이블 update + (카드재등록만) 기존 웹
 * 라우트 `/subscribe/billing-auth` redirect. 별도 결제 API 없음 → 앱과 동일 경로.
 * 위험한 KST 날짜 로직은 공용 헬퍼(lib/datetime-kst) 재사용 — 중복 0.
 *
 * 라우트 '/account/subscriptions' 는 proxy app-only prefix 와 매칭 안 됨(/account/*).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '정기배송 관리',
  description: '구독 현황 확인, 화식 비율 변경, 일시정지, 해지를 한 곳에서.',
  alternates: { canonical: '/account/subscriptions' },
  robots: { index: false, follow: false },
}

export default async function AccountSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/account/subscriptions')
  }

  const { data } = await supabase
    .from('subscriptions')
    .select('*, subscription_items(*), dogs(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const initialSubs = (data ?? []) as Subscription[]
  // ★ '유령 활성'(카드 없이 status=active) 제외 — subscriptionState 로 진짜 진행 중만.
  const activeCount = initialSubs.filter(
    (s) => subscriptionState(s) === 'active',
  ).length

  // 앱(PWA)에선 웹 breadcrumb·FD hero 를 숨기고 앱 톤 헤더로 — 앱 chrome 안에서 웹
  // 마스트헤드가 겹쳐 어색하던 것 정리(사장님 2026-07-16 "앱 디자인 개박살").
  const isApp = await isAppContextServer()

  return (
    <AuthAwareShell>
      <main
        className="pb-16 md:pb-24"
        style={{
          background: isApp ? 'var(--paper)' : 'var(--fd-offwhite)',
          minHeight: '72vh',
          // 앱 컨텍스트: 본문(SubscriptionsWebClient)이 쓰는 웹 FD 텍스트/보더
          // 토큰을 앱 톤으로 스코프 스왑 — 로직 무손상, presentation만(2026-07-18).
          // 실제로 다른 값은 이 3개뿐(pine 초록↔ink 고동, muted 회녹↔회갈, line).
          // 배경·크림·코랄(offwhite/cream/coral)은 앱/웹 동일 hex라 스왑 불필요.
          ...(isApp
            ? {
                '--fd-pine': 'var(--ink)',
                '--fd-muted': 'var(--muted)',
                '--fd-line': 'var(--rule)',
              }
            : {}),
        }}
      >
        <Container size="lg" className={isApp ? 'pt-0' : 'pt-4 md:pt-6'}>
          {isApp ? (
            <header className="px-1 pt-6 pb-3">
              <span className="kicker">Subscriptions</span>
              <h1
                className="font-sans mt-1.5"
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                정기배송 관리
              </h1>
              <p className="text-[12px] text-muted mt-1.5">
                {activeCount > 0
                  ? `구독 중 ${activeCount}건 · 화식 비율·일정·해지를 직접 관리하세요`
                  : '화식 비율 변경, 일시정지, 해지를 한 곳에서'}
              </p>
            </header>
          ) : (
            <>
              {/* breadcrumb (웹 전용) */}
              <nav
                aria-label="현재 위치"
                className="flex items-center gap-1 text-[11px] md:text-[12px]"
                style={{ color: 'var(--fd-muted)' }}
              >
                <Link href="/" className="hover:opacity-70 transition">
                  홈
                </Link>
                <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
                <Link href="/account" className="hover:opacity-70 transition">
                  내 계정
                </Link>
                <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
                <span style={{ color: 'var(--fd-pine)', fontWeight: 700 }}>정기배송</span>
              </nav>

              {/* Hero (웹 전용) */}
              <header className="pt-8 md:pt-14 pb-7 md:pb-10">
                <Eyebrow>Subscriptions · 정기배송</Eyebrow>
                <Display as="h1" size="md" className="mt-3 md:mt-4" style={{ color: 'var(--fd-pine)' }}>
                  정기배송 관리
                </Display>
                <p
                  className="mt-4 text-[12.5px] md:text-[14px]"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  {activeCount > 0
                    ? `구독 중 ${activeCount}건 · 화식 비율·일정·해지를 직접 관리하세요`
                    : '화식 비율 변경, 일시정지, 해지를 한 곳에서'}
                </p>
              </header>
            </>
          )}

          <SubscriptionsWebClient
            initialSubs={initialSubs}
            focusSubId={sp.focus ?? null}
          />
        </Container>
      </main>
    </AuthAwareShell>
  )
}
