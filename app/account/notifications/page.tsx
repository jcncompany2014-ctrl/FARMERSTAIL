import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { isAppContextServer } from '@/lib/app-context'
import { Container, Display, Eyebrow } from '@/components/web/fd/ui'
import ConsentWebClient, { type ConsentHistoryRow } from './ConsentWebClient'

/**
 * /account/notifications — 웹 사용자용 광고·마케팅 수신 설정.
 *
 * # 왜 생겼나 (2026-07-31)
 * 모든 메일 푸터의 "수신 거부 · 알림 설정" 링크가 `/mypage/notifications` ·
 * `/mypage/consent` 를 가리켰다. 둘 다 proxy 의 APP_ONLY_PREFIXES 라서 **메일을
 * 브라우저로 열면 `/app-required`(앱 설치 안내)로 튕겼다** — 메일은 대부분
 * 브라우저에서 열린다. 그중 마케팅 푸터의 링크는 **정보통신망법 §50 근거의
 * 수신거부 수단**이라 닿지 않으면 법적으로 노출된 쪽이다.
 *
 * # 왜 `/mypage/consent` 를 웹에 열어주는 것으로 때우지 않았나
 * 그 화면은 `app/(main)/**` 안에 있고 `(main)/layout.tsx` 는 **분기 없이**
 * AppChrome(모바일 폰 프레임 + 하단 탭바)으로 감싼다. 데스크톱 브라우저에
 * 폰 프레임이 뜨는 건 app-only 게이트가 존재하는 이유 그 자체다.
 * → `/account/subscriptions` 와 같은 패턴: **웹 전용 client 를 따로 두고**
 *   서버 계약(set_marketing_consent RPC · consent_log)만 공유한다.
 *
 * # 범위 — 광고 수신 동의만
 * 푸시 설정(기기·카테고리·조용시간)은 넣지 않았다. 웹 푸시는 실측 구독자 0명이고
 * 사장님이 "웹 알림은 필요 없을 것 같다"고 하신 상태라(2026-07-31) 없어질 수 있는
 * 기능의 UI 를 웹에 새로 만드는 셈이 된다. 앱 푸시는 앱에서 관리한다고 안내만 한다.
 * 이 화면에 오는 사람은 **메일 수신을 끄러 온 사람**이다 — 그 일만 잘 되면 된다.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '알림 · 수신 설정 | 파머스테일',
  description: '광고·마케팅 정보 수신 여부를 채널별로 관리합니다.',
  alternates: { canonical: '/account/notifications' },
  robots: { index: false, follow: false },
}

export default async function AccountNotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/account/notifications')
  }

  const [profileRes, historyRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'agree_email, agree_sms, agree_email_at, agree_sms_at, marketing_policy_version',
      )
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('consent_log')
      .select('id, channel, granted, granted_at, policy_version, source')
      .eq('user_id', user.id)
      .order('granted_at', { ascending: false })
      .limit(10),
  ])

  const isApp = await isAppContextServer()

  /**
   * ★ 조회 실패로 토글을 그리지 않는다 (규칙1).
   *
   * `Boolean(profile?.agree_email)` 은 실패와 미동의를 **같은 false** 로 만든다.
   * 그러면 지금도 광고 메일을 받고 있는 사람에게 "현재 미동의" 가 뜬다 —
   * 수신거부하러 온 사람이 **이미 꺼져 있다고 믿고 그냥 나간다.** 메일은 계속
   * 가고, 본인은 껐다고 알고 있는 상태다. 그건 §50 위반 신고로 이어지는 모양이다.
   * 그래서 실패하면 토글 대신 안내를 띄운다.
   * (앱 화면 `app/(main)/notifications/page.tsx` 도 같은 이유로 함께 고쳤다.)
   */
  if (profileRes.error) {
    return (
      <AuthAwareShell>
        <main
          className="min-h-screen"
          style={{ background: 'var(--fd-offwhite)' }}
        >
          <div className="mx-auto max-w-2xl px-5 py-16">
            <div
              className="px-6 py-8 rounded-[14px]"
              style={{
                background: '#FFFFFF',
                boxShadow: 'inset 0 0 0 1px var(--fd-line)',
              }}
            >
              <h1
                className="text-[17px] font-bold"
                style={{ color: 'var(--fd-pine)' }}
              >
                수신 설정을 불러오지 못했어요
              </h1>
              <p
                className="mt-2 text-[13.5px] leading-relaxed"
                style={{ color: 'var(--fd-muted)' }}
              >
                지금 상태를 알 수 없어서 화면을 그리지 않았어요 — 잘못 보여드리면
                이미 껐다고 오해하실 수 있어서예요. 잠시 뒤 다시 열어봐 주세요.
                급하시면 <Link href="/contact" className="underline">문의</Link>
                주시면 저희가 바로 꺼드릴게요.
              </p>
            </div>
          </div>
        </main>
      </AuthAwareShell>
    )
  }

  const profile = profileRes.data as {
    agree_email: boolean | null
    agree_sms: boolean | null
    agree_email_at: string | null
    agree_sms_at: string | null
    marketing_policy_version: string | null
  } | null

  const history: ConsentHistoryRow[] = (
    (historyRes.data ?? []) as Array<{
      id: string
      channel: string
      granted: boolean
      granted_at: string
      policy_version: string | null
      source: string | null
    }>
  ).map((r) => ({
    id: r.id,
    channel: r.channel === 'sms' ? 'sms' : 'email',
    granted: Boolean(r.granted),
    granted_at: r.granted_at,
    policy_version: r.policy_version ?? null,
    source: r.source ?? null,
  }))

  return (
    <AuthAwareShell>
      <main
        className="pb-16 md:pb-24"
        style={{
          background: isApp ? 'var(--paper)' : 'var(--fd-offwhite)',
          minHeight: '72vh',
        }}
      >
        <Container size="lg" className={isApp ? 'pt-0' : 'pt-4 md:pt-6'}>
          {isApp ? (
            <header className="px-1 pt-5 pb-1">
              <p className="text-[13px] text-muted">
                광고·마케팅 정보 수신 여부를 채널별로 관리하세요
              </p>
            </header>
          ) : (
            <>
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
                <span style={{ color: 'var(--fd-pine)', fontWeight: 700 }}>
                  수신 설정
                </span>
              </nav>

              <header className="pt-8 md:pt-14 pb-7 md:pb-10">
                <Eyebrow>Notifications · 수신 설정</Eyebrow>
                <Display
                  as="h1"
                  size="md"
                  className="mt-3 md:mt-4"
                  style={{ color: 'var(--fd-pine)' }}
                >
                  알림 · 수신 설정
                </Display>
                <p
                  className="mt-4 text-[12.5px] md:text-[14px]"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  광고·마케팅 정보 수신 여부를 채널별로 관리하세요
                </p>
              </header>
            </>
          )}

          <ConsentWebClient
            initial={{
              agree_email: Boolean(profile?.agree_email),
              agree_sms: Boolean(profile?.agree_sms),
              agree_email_at: profile?.agree_email_at ?? null,
              agree_sms_at: profile?.agree_sms_at ?? null,
              marketing_policy_version:
                profile?.marketing_policy_version ?? null,
            }}
            history={history}
          />
        </Container>
      </main>
    </AuthAwareShell>
  )
}
