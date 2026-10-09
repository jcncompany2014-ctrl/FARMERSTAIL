import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ApproveClient from '../../../dogs/[id]/approve/ApproveClient'
import { APPROVE_PENDING, APPROVE_PREVIOUS, APPROVE_PRICING, DOG_ID, DOG_NAME } from '../_fixtures'

/**
 * /design-check/box/approve?s=… — 새 식단 확인(승인) 화면 점검(2026-10-09, 시안 S22-approve).
 * 실제 화면과 같은 ApproveClient 에 예시 값. 주소에 '/approve' 가 들어 있어 실제처럼 윗줄·아래 탭 없는 몰입 화면이 된다.
 * **실제 사이트(Vercel production)에선 404.** 버튼을 눌러도 로그인이 없어 저장되지 않는다.
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 새 식단 확인',
  robots: { index: false, follow: false },
}

export default async function DesignCheckApprovePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''
  if (!(s in APPROVE_PRICING)) redirect('/design-check/box')

  return (
    <ApproveClient
      dogId={DOG_ID}
      dogName={DOG_NAME}
      cycleNumber={2}
      pending={s === 'approve-missing' ? null : APPROVE_PENDING}
      previous={APPROVE_PREVIOUS}
      pricing={APPROVE_PRICING[s] ?? null}
    />
  )
}
