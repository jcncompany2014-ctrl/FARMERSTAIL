import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import CheckinClient from '../../../dogs/[id]/checkin/CheckinClient'
import FirstCheckinClient from '../../../dogs/[id]/first-checkin/FirstCheckinClient'
import { CHECKIN_PREVIEW, DOG_ID, DOG_NAME } from '../_fixtures'
import BoxToastDemo from '../BoxToastDemo'

/**
 * /design-check/box/checkin?s=… — 2·4주차 체크인과 첫 박스 체크인 점검(2026-10-09, 시안 S23~S28).
 * 실제 화면과 같은 CheckinClient·FirstCheckinClient 에 예시 값(preview). 주소에 '/checkin' 이 들어 있어
 * 윗줄·아래 탭 없는 몰입 화면이 된다 — 실제 체크인과 같다. 첫 박스 체크인(/first-checkin)은 실제 주소엔
 * '/checkin' 이 없어 지금은 윗줄·탭이 붙는다(시안엔 없다 — 보고서에 AppChrome FOCUS_PATHS 추가 필요로 적음).
 * **실제 사이트(Vercel production)에선 404.** 버튼을 눌러도 로그인이 없어 저장되지 않는다.
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 체크인',
  robots: { index: false, follow: false },
}

export default async function DesignCheckCheckinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''

  if (s === 'first' || s === 'first-done') {
    return (
      <>
        <FirstCheckinClient
          dogId={DOG_ID}
          dogName={DOG_NAME}
          userId="00000000-0000-4000-8000-0000000000aa"
          preview={s === 'first' ? { choice: 'great' } : { done: true }}
        />
        {s === 'first-done' && <BoxToastDemo message="좋은 의견 고마워요. 다음 박스에 반영할게요." />}
      </>
    )
  }

  const fx = CHECKIN_PREVIEW[s]
  if (!fx) redirect('/design-check/box')
  return <CheckinClient dogId={DOG_ID} cycleNumber={1} checkpoint={fx.checkpoint} preview={fx.preview} />
}
