import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { V3 } from '@/lib/design/tokens'
import SurveyClient from '../../dogs/[id]/survey/SurveyClient'
import SurveyLoading from '../../dogs/[id]/survey/loading'
import { CASES, DOG_ID, REFINE_SEED } from './_fixtures'

/**
 * /design-check/survey — 앱 새 디자인('A 포스터') 묶음 ⑥ 앱 설문(새 틀) 점검 화면 (2026-10-09).
 *
 * 실제 설문은 로그인·강아지가 있어야 열려서, 실제와 같은 부품(SurveyClient)에 점검 전용 preview 값을 넣어
 * 로그인 없이 시안(캔버스 '설문 (새 틀)' E01~E18 · F22~F32 · L19~L35)과 나란히 본다.
 * **실제 사이트(Vercel production)에선 404.** 손님 화면이 아니라 답은 예시다 — '다음'·'결과 보기'를 눌러도
 * 로그인이 없어 저장되지 않는다(제출은 로그인 화면으로 보낸다). 주소에 '/survey' 가 들어 있어 실제 설문처럼
 * 앱 윗줄·아래 탭이 없는 몰입 화면으로 뜬다(AppChrome FOCUS_PATHS).
 * 창(체중 잰 방법·간식 칼로리·나가기 확인)은 목록 오른쪽에 적힌 버튼을 눌러 띄운다.
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 설문',
  robots: { index: false, follow: false },
}

export default async function DesignCheckSurveyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''
  // 설문 주소로 들어갈 때 서버가 준비되는 동안 뜨는 뼈대(loading.tsx) — 시안 보드는 없다.
  if (s === 'route-loading') return <SurveyLoading />
  const c = CASES.find((x) => x.key === s)
  if (!c) return <Index />
  return (
    <SurveyClient
      key={c.key}
      dogId={DOG_ID}
      previous={c.previous ?? null}
      refineFrom={c.refine ? REFINE_SEED : null}
      preview={c.preview}
    />
  )
}

function Index() {
  return (
    <div style={{ padding: '24px 20px 40px', lineHeight: 'normal' }}>
      <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>디자인 점검 · 설문</h1>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: V3.inkMute, lineHeight: 1.5 }}>
        미리보기 전용 화면이에요. 실제 설문과 같은 부품에 예시 값을 넣었어요.
      </p>
      <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {CASES.map((c) => (
          <li key={c.key}>
            <Link
              href={`/design-check/survey?s=${c.key}`}
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
              <span style={{ fontSize: 16, fontWeight: 700 }}>{c.title}</span>
              <span style={{ fontSize: 13, color: V3.inkMute, flexShrink: 0, textAlign: 'right' }}>
                {c.mock}
                {c.click ? ` · '${c.click}' 누르기` : ''}
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/design-check/survey?s=route-loading"
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
            <span style={{ fontSize: 16, fontWeight: 700 }}>주소 들어갈 때 뼈대</span>
            <span style={{ fontSize: 13, color: V3.inkMute, flexShrink: 0 }}>—</span>
          </Link>
        </li>
      </ul>
    </div>
  )
}
