import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { isAppContextServer } from '@/lib/app-context'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { Container, Display, Eyebrow } from '@/components/web/fd/ui'
import SubscriptionsWebClient from './SubscriptionsWebClient'
import { subscriptionState } from '@/lib/subscription-state'
import type { Subscription } from './types'
import { recipeName, friendlyChangeReason } from '@/lib/personalization/format'
import type { Formula } from '@/lib/personalization/types'
import type { PriceChangeProposal } from './PriceChangeConsentModal'

/**
 * /account/subscriptions — 웹 사용자용 정기배송 관리.
 *
 * (main)/mypage/subscriptions 의 풀 관리 기능(일시정지·재개·해지·배송알림·
 * 카드재등록)을 **웹에서도 동일하게** 제공 (사장님 2026-06-27 "앱과 동일 풀관리").
 * 단 시각은 AppChrome 폰프레임 v3 가 아니라 FD 톤으로 — 그래서 앱 컴포넌트를
 * 재사용하지 않고 web 전용 client 를 별도로 둔다.
 *
 * ★2026-07-31 — 이 주석이 "주기변경·화식 비율 변경"도 제공한다고 적고 있었는데
 *   **둘 다 어디에도 없다.** 확인 결과:
 *    · 주기 = 2주 하나로 고정(박스가 14일치라 다른 주기가 성립하지 않는다).
 *      선택기는 2026-07 에 폐지됐는데 주석만 남았다.
 *    · 화식 비율 = **앱에도 변경 UI 가 없다.** 저장소 전체에서 fresh_ratio 는
 *      전부 `freshTierLabel()` 표시용이고, 값을 정하는 곳은 구독 신청 화면
 *      (dogs/[id]/order) 하나뿐이다. 변경 API 도 없다(app/api/subscriptions/
 *      에는 create 만).
 *   웹에 없는 게 아니라 **만든 적이 없는 기능**이다 — 주석을 사실에 맞춘다.
 *   (없는 기능을 있다고 적은 주석은 코드가 없는 것보다 위험하다. AGENTS.md 규칙4.)
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

  const { data, error: subsErr } = await supabase
    .from('subscriptions')
    .select('*, subscription_items(*), dogs(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  /**
   * ★ 조회 실패를 '구독 없음' 으로 그리지 않는다 (2026-07-31).
   *
   * error 를 안 받으면 실패와 빈 결과가 같은 모양(`data === null`)이 된다.
   * 그러면 **결제가 걸려 매주 돈이 빠져나가는 고객에게** "아직 정기배송이
   * 없어요 · 시작해 보세요" 가 뜬다 — 이미 하고 있는 걸 권하는 화면이고,
   * 중복 신청까지 유도할 수 있다.
   * 앱 화면(/mypage/subscriptions)은 2026-07-30 에 같은 이유로 먼저 고쳤다.
   * 이 화면은 웹 전용이라 그때 빠졌다 — 같은 결함의 나머지 절반.
   */
  if (subsErr) {
    return (
      <AuthAwareShell>
        <main className="min-h-screen" style={{ background: 'var(--fd-offwhite)' }}>
          <div className="mx-auto max-w-2xl px-5 py-16">
            <div
              className="px-6 py-8 rounded-[var(--fd-r-card,14px)]"
              style={{
                background: '#FFFFFF',
                boxShadow: 'inset 0 0 0 1px var(--fd-line)',
              }}
            >
              <h1
                className="text-[17px] font-bold"
                style={{ color: 'var(--fd-pine)' }}
              >
                정기배송 정보를 불러오지 못했어요
              </h1>
              <p
                className="mt-2 text-[13.5px] leading-relaxed"
                style={{ color: 'var(--fd-muted)' }}
              >
                잠시 뒤에 다시 열어봐 주세요. 계속 이러면 알려주세요 — 진행 중인
                정기배송은 그대로 있어요.
              </p>
              <Link
                href="/mypage/orders"
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-bold"
                style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
              >
                결제·주문 내역 보기
              </Link>
            </div>
          </div>
        </main>
      </AuthAwareShell>
    )
  }

  const initialSubs = (data ?? []) as Subscription[]
  // ★ '유령 활성'(카드 없이 status=active) 제외 — subscriptionState 로 진짜 진행 중만.
  const activeCount = initialSubs.filter(
    (s) => subscriptionState(s) === 'active',
  ).length

  // 앱(PWA)에선 웹 breadcrumb·FD hero 를 숨기고 앱 톤 헤더로 — 앱 chrome 안에서 웹
  // 마스트헤드가 겹쳐 어색하던 것 정리(사장님 2026-07-16 "앱 디자인 개박살").
  const isApp = await isAppContextServer()

  // 금액이 바뀌는 다음-박스 제안(pending)이 있으면 구독페이지 동의 모달을 띄운다.
  // cron 이 formula.priceChange 표식을 남긴 pending_approval row 를 감지 — 알림
  // 링크가 아니라 상태로 뜨므로 페이지 방문마다 뜬다(사장님 2026-07-23).
  let priceProposal: PriceChangeProposal | null = null
  {
    const { data: pendingRows, error: pendingErr } = await supabase
      .from('dog_formulas')
      .select('dog_id, cycle_number, formula, reasoning')
      .eq('user_id', user.id)
      .eq('approval_status', 'pending_approval')
      .order('created_at', { ascending: false })
    // 이 조회가 실패하면 **금액 변경 동의 모달이 조용히 사라진다** — 동의 없이
    // 금액이 바뀔 수 있는 상태다. 화면은 계속 그리되 사람이 알 수 있게 올린다
    // (앱 화면은 2026-07-30 에 같은 처리를 넣었다 — 웹만 빠져 있었다).
    if (pendingErr) {
      captureBusinessEvent('error', 'subscription.price_consent.query_failed', {
        userId: user.id,
        surface: 'web',
        dbError: pendingErr.message,
      })
    }
    type PendingRow = {
      dog_id: string
      cycle_number: number
      formula: {
        lineRatios: Formula['lineRatios']
        toppers: Formula['toppers']
        priceChange?: { from: number; to: number; forced: boolean }
      }
      reasoning: Array<{ ruleId: string }> | null
    }
    const hit = ((pendingRows ?? []) as unknown as PendingRow[]).find(
      (r) => r.formula?.priceChange,
    )
    if (hit?.formula.priceChange) {
      const { data: dogRow } = await supabase
        .from('dogs')
        .select('name')
        .eq('id', hit.dog_id)
        .maybeSingle()
      const dogName = (dogRow as { name?: string } | null)?.name ?? '우리 아이'
      priceProposal = {
        dogId: hit.dog_id,
        dogName,
        cycleNumber: hit.cycle_number,
        recipeLabel: recipeName(hit.formula as unknown as Formula),
        reason: friendlyChangeReason(
          hit.reasoning ?? [],
          hit.formula.priceChange.forced,
        ),
        forced: hit.formula.priceChange.forced,
        priceFrom: hit.formula.priceChange.from,
        priceTo: hit.formula.priceChange.to,
      }
    }
  }

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
          //
          // 계획 C2(2026-07-25) — 색에 이어 **모서리 반경**도 스왑한다.
          // 본문이 쓰던 14/10/8/18px 은 FD 웹 값이라 앱에서 유독 둥글어 웹 화면
          // 처럼 보였다(사장님 "앱 느낌 최우선"). v3 앱 스케일은 카드·행=4(sm
          // signature), 바텀시트=12(md). 웹 기본값은 그대로 두고 앱일 때만 바꾼다.
          '--fd-r-card': '14px',
          '--fd-r-row': '10px',
          '--fd-r-thumb': '8px',
          '--fd-r-sheet': '18px',
          ...(isApp
            ? {
                '--fd-pine': 'var(--ink)',
                '--fd-muted': 'var(--muted)',
                '--fd-line': 'var(--rule)',
                '--fd-r-card': '4px',
                '--fd-r-row': '4px',
                '--fd-r-thumb': '4px',
                '--fd-r-sheet': '12px',
              }
            : {}),
        }}
      >
        <Container size="lg" className={isApp ? 'pt-0' : 'pt-4 md:pt-6'}>
          {isApp ? (
            // AppChrome 상단 헤더(← 정기배송)가 이미 제목을 보여줘 본문 큰 제목은
            // 중복(사장님 2026-07-23) — 킥커·h1 제거하고 짧은 안내만. (FAQ 와 동일 정리.)
            <header className="px-1 pt-5 pb-1">
              <p className="text-[13px] text-muted">
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
            priceProposal={priceProposal}
            isApp={isApp}
          />
        </Container>
      </main>
    </AuthAwareShell>
  )
}
