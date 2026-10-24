import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SubscriptionSheet from '@/app/admin/subscriptions/[id]/SubscriptionSheet'
import { CUSTOMER_FIXTURES } from '../customer/_fixtures'

/**
 * /design-check-admin/subscription — 정기배송 한 장(/admin/subscriptions/[id], 2026-10-24 규칙314) 점검.
 *
 * 고객 화면 점검과 같은 예시 값(땅콩·보호자님)을 한 장으로 띄워 폰 폭(390)에서 첫 화면에 '결제→발송'·금액·몸무게가 다
 * 들어오는지 본다. **실제 사이트(production)에선 404**, noindex. 메모 버튼은 저장하지 않는다(demo).
 *  · ?s=full    서포터즈 100원 구간 + 알레르기로 못 담은 몫
 *  · ?s=flags   카드 재등록 필요 · 결제 확인 안 됨
 *  · ?s=paid    첫 박스 결제 직후 — ① 이번 박스 결제함(이벤트 할인) ② 다음 결제 · 날짜(정가)(2026-10-24 어드민 금액 말 정리)
 *  · ?s=errors  칸마다 조회 실패
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 정기배송 한 장',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function DesignCheckAdminSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''
  const data = CUSTOMER_FIXTURES[s]
  const sub = data?.subs[0]
  const dog = sub ? (data.dogs.find((d) => d.id === sub.dogId) ?? null) : null
  return (
    <div className="admin-scope min-h-screen bg-background px-4 py-5 font-sans text-foreground antialiased">
      {data && sub ? (
        <SubscriptionSheet data={data} sub={{ ...sub, deliveryMemo: sub.deliveryMemo ?? '문 앞에 두고 벨 눌러 주세요' }} dog={dog} isNew demo />
      ) : (
        <main className="flex flex-col gap-2.5">
          <h1 className="text-[22px] font-bold">정기배송 한 장 점검</h1>
          {Object.keys(CUSTOMER_FIXTURES)
            .filter((k) => CUSTOMER_FIXTURES[k]!.subs.length > 0)
            .map((k) => (
              <Link key={k} href={`/design-check-admin/subscription?s=${k}`} className="text-primary underline">
                {k}
              </Link>
            ))}
        </main>
      )}
    </div>
  )
}
