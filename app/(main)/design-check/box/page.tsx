import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { V3 } from '@/lib/design/tokens'
import FormulasView from '../../dogs/[id]/formulas/FormulasView'
import { DOG_ID, DOG_NAME, FORMULA_ROWS, SCREENS } from './_fixtures'

/**
 * /design-check/box — 앱 새 디자인('A 포스터') 묶음 ③-C(맞춤 박스 기록·새 식단 확인·체크인) 점검 화면 (2026-10-09).
 *
 * 실제 화면은 로그인해야 열려서, 실제와 같은 부품(FormulasView·ApproveClient·CheckinClient·FirstCheckinClient)에
 * 예시 값을 넣어 로그인 없이 시안(캔버스 S20~S28·I03)과 나란히 본다. **실제 사이트(Vercel production)에선 404.**
 * 손님 화면이 아니라 문구·데이터는 예시다 — 버튼을 눌러도 로그인이 없어 저장되지 않는다.
 *
 * 승인·체크인은 실제 화면처럼 윗줄·아래 탭이 없는 몰입 화면이라(AppChrome FOCUS_PATHS — 주소에 '/approve'·'/checkin')
 * 하위 주소 /design-check/box/approve · /design-check/box/checkin 에서 그린다. 여기(목록·맞춤 박스 기록)의 윗줄 제목은
 * 이 주소의 것이라 실제 화면과 다르다. 실제 맞춤 박스 기록엔 강아지 위 탭(개요·기록·분석)도 붙는다([id]/layout).
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 맞춤 박스',
  robots: { index: false, follow: false },
}

export default async function DesignCheckBoxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''

  const rows = FORMULA_ROWS[s]
  if (rows) return <FormulasView dogId={DOG_ID} dogName={DOG_NAME} rows={rows} />
  return <Index />
}

function Index() {
  return (
    <div style={{ padding: '20px 20px 32px' }}>
      <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>디자인 점검 · 맞춤 박스</h1>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: V3.inkMute, lineHeight: 1.5 }}>
        미리보기 전용 화면이에요. 실제 화면과 같은 부품에 예시 값을 넣었어요.
      </p>
      <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {SCREENS.map(([k, title, mock, path]) => (
          <li key={k}>
            <Link
              href={`${path}?s=${k}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                minHeight: 56,
                padding: '10px 14px',
                borderRadius: 4,
                background: V3.soft,
                color: V3.ink,
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
              <span style={{ fontSize: 13, color: V3.inkMute, flexShrink: 0 }}>{mock}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
