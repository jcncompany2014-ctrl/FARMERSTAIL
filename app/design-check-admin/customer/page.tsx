import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CustomerView from '@/app/admin/users/[id]/CustomerView'
import { CUSTOMER_FIXTURES } from './_fixtures'

/**
 * /design-check-admin/customer — 어드민 고객 한 명 화면(/admin/users/[id], 2026-10-14 C1~C5) 점검.
 *
 * 어드민은 로그인·관리자 권한·운영 데이터가 있어야 열린다. 그리는 부분(CustomerView)을 예시 값으로 띄워 폰 폭(390)에서
 * 확인한다. **실제 사이트(production)에선 404**, noindex. 버튼(기록·배송지·알레르기)은 저장하지 않는다(demo).
 *  · ?s=full    서포터즈 100원 구간 + 알레르기 관리자 수정(지금 박스 멈춤) + 옛 앱·메일 반송 배지 + 답 안 한 문의
 *  · ?s=flags   카드 재등록 필요 + 알림 기기 없음 + 결제 확인 안 됨 + 고객 답 기다리는 식단 제안 + 발송 대기 박스
 *  · ?s=empty   막 가입한 회원(강아지·구독 없음)
 *  · ?s=errors  칸마다 조회 실패 — '없음'이 아니라 '못 불러옴'
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 어드민 고객',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function DesignCheckAdminCustomerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''
  const data = CUSTOMER_FIXTURES[s]
  return (
    <div className="admin-scope min-h-screen bg-background px-4 py-5 font-sans text-foreground antialiased">
      {data ? (
        <CustomerView data={data} demo />
      ) : (
        <main className="flex flex-col gap-2.5">
          <h1 className="text-[22px] font-bold">어드민 고객 화면 점검</h1>
          {Object.keys(CUSTOMER_FIXTURES).map((k) => (
            <Link key={k} href={`/design-check-admin/customer?s=${k}`} className="text-primary underline">
              {k}
            </Link>
          ))}
        </main>
      )}
    </div>
  )
}
