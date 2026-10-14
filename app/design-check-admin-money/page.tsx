import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import TrialsClient from '@/app/admin/trials/TrialsClient'
import { ChargeRowsView, OpenHoldsView } from '@/app/admin/subscriptions/charges/ChargeRowsView'
import UpcomingChargesView from '@/app/admin/subscriptions/calendar/UpcomingChargesView'
import { AdminHeader } from '@/components/admin/ui'
import { CHARGE_ROWS, FX_TODAY, OPEN_HOLDS, trialRowsFixture, upcomingFixture } from './_fixtures'

/**
 * /design-check-admin-money — 어드민 '돈·서포터즈' 화면 점검(2026-10-14 A1·A2). **실제 사이트(production)에선 404.**
 *
 * 어드민 화면은 로그인·관리자 권한이 필요해서, 실제와 같은 부품(TrialsClient·ChargeRowsView·UpcomingChargesView)에
 * 예시 값을 넣어 로그인 없이 폰 폭으로 본다. 일정·금액은 실제와 같은 정본 함수로 펼친 값이다(_fixtures).
 * 버튼을 눌러도 로그인이 없어 저장되지 않는다.
 *  · ?s=trials (기본) — 체험단: 회차 일정표·다음 가격 전환일·동의 상태(받음 초록 / 30일 안 빨강 / 아직 노랑)
 *  · ?s=charges — 자동결제 이력: 보류 회차 상자 + 실패·결과 확인 중·건너뜀 행의 고객·카드·사유·재시도·고객 보기
 *  · ?s=upcoming — 배송 캘린더의 다가오는 결제: 결제일별 실제 금액과 정가, 보류 예정
 */
export const metadata: Metadata = { title: '어드민 점검 · 돈', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const SCREENS = [
  { s: 'trials', label: '체험단' },
  { s: 'charges', label: '자동결제 이력' },
  { s: 'upcoming', label: '다가오는 결제' },
] as const

export default async function DesignCheckAdminMoney({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : 'trials'

  return (
    <div className="admin-scope min-h-screen bg-background font-sans text-foreground antialiased">
      <main id="main" className="mx-auto max-w-3xl px-4 py-5">
        <nav className="mb-4 flex flex-wrap gap-2 text-[12px]">
          {SCREENS.map((x) => (
            <Link
              key={x.s}
              href={`?s=${x.s}`}
              className={`rounded-full border px-3 py-1 font-bold ${x.s === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}
            >
              {x.label}
            </Link>
          ))}
          <span className="self-center text-muted-foreground">예시 오늘 {FX_TODAY}</span>
        </nav>

        {s === 'charges' ? (
          <>
            <AdminHeader title="자동결제 이력" sub="실패·보류·결과 확인 중 행에 고객·카드·사유·재시도를 붙였어요(예시)." />
            <div className="mb-4">
              <OpenHoldsView holds={OPEN_HOLDS} loadFailed={false} />
            </div>
            <ChargeRowsView rows={CHARGE_ROWS} loadFailed={false} />
          </>
        ) : s === 'upcoming' ? (
          <>
            <AdminHeader title="배송 캘린더" sub="다가오는 결제 — 실제 나갈 금액(예시)." />
            <UpcomingChargesView rounds={upcomingFixture()} days={56} error={null} />
          </>
        ) : (
          <>
            <AdminHeader title="체험단" sub="도장 찍기 · 3단 가격 회차 일정 · 가격 인상 동의 기록(예시)" />
            <TrialsClient initial={trialRowsFixture()} today={FX_TODAY} />
          </>
        )}
      </main>
    </div>
  )
}
