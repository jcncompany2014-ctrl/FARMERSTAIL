import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NewArrivalsPanel from '@/components/admin/NewArrivalsPanel'
import type { NewArrivals } from '@/lib/admin/new-arrivals'

/**
 * /design-check-admin/arrivals — 어드민 홈 '새로 들어온 것'(2026-10-24 규칙314) 점검. 예시 값(땅콩·초코·보리) — 운영 데이터 아님.
 * **실제 사이트(production)에선 404**, noindex. ?s=errors 는 칸마다 '못 봄'.
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 새로 들어온 것',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

const NOW = Date.parse('2026-10-24T09:00:00+09:00')

const SAMPLE: NewArrivals = {
  since: '2026-10-17',
  newSubs: [
    {
      subscriptionId: '00000000-0000-4000-8000-0000000000a1',
      userId: '00000000-0000-4000-8000-000000000001',
      dogName: '땅콩',
      weightKg: 11.2,
      recipes: '치킨 + 한우',
      freshLabel: '반반',
      chargeAmount: 89000,
      chargeLabel: '나무 10%',
      storedAmount: 98900,
      chargeIso: '2026-10-31',
      shipIso: '2026-11-03',
      at: '2026-10-24T06:42:00Z',
      reRegistered: false,
    },
    {
      subscriptionId: '00000000-0000-4000-8000-0000000000a2',
      userId: '00000000-0000-4000-8000-000000000002',
      dogName: '초코',
      weightKg: 3.8,
      recipes: '흑돼지 + 오리',
      freshLabel: '곁들임',
      chargeAmount: 100,
      chargeLabel: '서포터즈 100원',
      storedAmount: 48000,
      chargeIso: '2026-10-27',
      shipIso: '2026-10-27',
      at: '2026-10-21T13:57:00Z',
      reRegistered: false,
    },
    {
      subscriptionId: '00000000-0000-4000-8000-0000000000a3',
      userId: '00000000-0000-4000-8000-000000000003',
      dogName: '룽지',
      weightKg: 6,
      recipes: '치킨',
      freshLabel: '완전',
      chargeAmount: 100,
      chargeLabel: null,
      storedAmount: 51500,
      chargeIso: '2026-10-27',
      shipIso: '2026-10-27',
      at: '2026-10-20T02:17:00Z',
      reRegistered: true,
    },
  ],
  store: [
    {
      orderId: '00000000-0000-4000-8000-0000000000b1',
      orderNumber: 'FTS-20261023-AAAAAA',
      who: '보호자님',
      amount: 14900,
      paidAt: '2026-10-23T05:00:00Z',
      shipIso: '2026-10-27',
      tracked: false,
    },
  ],
  failed: [
    {
      subscriptionId: '00000000-0000-4000-8000-0000000000a4',
      userId: '00000000-0000-4000-8000-000000000004',
      dogName: '보리',
      reason: '카드 한도 초과',
      at: '2026-10-24T00:10:00Z',
    },
  ],
  cancelled: [],
  failures: [],
}

const ERRORS: NewArrivals = { since: '2026-10-17', newSubs: null, store: null, failed: null, cancelled: null, failures: ['카드 등록 기록: 예시 오류'] }

export default async function DesignCheckArrivalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  return (
    <div className="admin-scope min-h-screen bg-background px-4 py-5 font-sans text-foreground antialiased">
      <NewArrivalsPanel data={sp.s === 'errors' ? ERRORS : SAMPLE} nowMs={NOW} />
    </div>
  )
}
