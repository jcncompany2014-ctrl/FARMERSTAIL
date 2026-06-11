/**
 * /mypage/integrations — 외부 서비스 연동 hub (R33, 42 deferred #1).
 *
 * 현재는 Tractive 1종. Fi / Whistle 등은 향후 동일 패턴으로 추가.
 * Mock mode (TRACTIVE_CLIENT_ID 미셋) 시 "준비 중" badge 표시 + 연동
 * 버튼은 mock URL 로 redirect → UI 테스트 가능, 실제 OAuth 진입 X.
 */
import { redirect } from 'next/navigation'
import { ExternalLink, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  tractiveMode,
  TRACTIVE_LABEL,
  TRACTIVE_HINT_MOCK,
  TRACTIVE_HINT_REAL,
} from '@/lib/integrations/tractive'
import IntegrationDisconnectButton from './IntegrationDisconnectButton'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  ok?: string
  error?: string
  mock?: string
}>

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/integrations')

  // user_integrations 타입은 types.ts 에 아직 반영 X — cast 로 우회.
  const ui = supabase.from('user_integrations' as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: string) => Promise<{
        data: Array<{
          provider: string
          status: string
          last_synced_at: string | null
        }> | null
      }>
    }
  }
  const { data: rows } = await ui
    .select('provider, status, last_synced_at')
    .eq('user_id', user.id)

  const tractive = (rows ?? []).find((r) => r.provider === 'tractive') ?? null
  const isMock = tractiveMode() === 'mock'
  const isConnected = tractive?.status === 'active'

  return (
    <div className="pb-20 max-w-md mx-auto" data-form-tone="app">
      <header className="px-5 pt-6 pb-6">
        <span
          className="inline-block font-mono text-[10.5px] font-semibold uppercase"
          style={{ letterSpacing: '0.16em', wordSpacing: '-0.12em', color: 'var(--terracotta)' }}
        >
          Integrations
        </span>
        <h1
          className="mt-2"
          style={{
            fontFamily: 'var(--font-sans), Pretendard, sans-serif',
            fontWeight: 800,
            fontSize: 32,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.25,
          }}
        >
          외부 서비스 연동
        </h1>
        <p
          className="mt-2 text-[13.5px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          만보계나 GPS tracker 를 연동하면 활동량을 자동으로 추적해 더
          정확한 케어가 가능해요.
        </p>
      </header>

      {/* Status banner — OAuth callback 결과 */}
      {sp.ok === 'tractive' && (
        <div
          className="mx-5 mb-4 rounded p-3 text-[12px]"
          style={{
            background: 'color-mix(in srgb, var(--moss) 12%, white)',
            border: '1px solid color-mix(in srgb, var(--moss) 28%, transparent)',
            color: 'var(--ink)',
          }}
        >
          <Check className="inline w-4 h-4 mr-1.5" strokeWidth={2.4} />
          Tractive 연동이 완료됐어요.
        </div>
      )}
      {sp.error && (
        <div
          className="mx-5 mb-4 rounded p-3 text-[12px]"
          style={{
            background: '#FFF5F2',
            border: '1px solid color-mix(in srgb, var(--terracotta) 22%, transparent)',
            color: '#8A3923',
          }}
        >
          연동 중 문제가 있었어요 ({sp.error}). 다시 시도해 주세요.
        </div>
      )}
      {sp.mock === '1' && (
        <div
          className="mx-5 mb-4 rounded p-3 text-[12px]"
          style={{
            background: 'color-mix(in srgb, var(--gold) 10%, white)',
            border: '1px solid color-mix(in srgb, var(--gold) 24%, transparent)',
            color: 'var(--ink)',
          }}
        >
          연동이 준비 중이에요. Tractive 와의 정식 파트너십 협의가 끝나면
          자동으로 활성화돼요.
        </div>
      )}

      {/* Tractive 카드 */}
      <section className="px-5">
        <div
          className="rounded p-4"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--rule)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[13.5px] font-bold"
                  style={{ color: 'var(--ink)' }}
                >
                  {TRACTIVE_LABEL}
                </span>
                {isMock && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: 'color-mix(in srgb, var(--gold) 16%, white)',
                      color: '#7A5B1B',
                      letterSpacing: '0.08em',
                    }}
                  >
                    준비 중
                  </span>
                )}
                {isConnected && !isMock && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: 'color-mix(in srgb, var(--moss) 16%, white)',
                      color: '#566729',
                      letterSpacing: '0.08em',
                    }}
                  >
                    연동 중
                  </span>
                )}
              </div>
              <p
                className="mt-1.5 text-[12px] leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                {isMock ? TRACTIVE_HINT_MOCK : TRACTIVE_HINT_REAL}
              </p>
              {tractive?.last_synced_at && (
                <p
                  className="mt-1 text-[10.5px] font-mono"
                  style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}
                >
                  마지막 동기화 {new Date(tractive.last_synced_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {isConnected ? (
              <IntegrationDisconnectButton provider="tractive" />
            ) : (
              <a
                href="/api/integrations/tractive/connect"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold"
                style={{
                  background: 'var(--terracotta)',
                  color: '#fff',
                  border: '1px solid rgba(178, 58, 26, 0.6)',
                  boxShadow:
                    '0 6px 20px -8px rgba(220, 83, 42, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
                }}
              >
                연동하기
                <ExternalLink className="w-3 h-3" strokeWidth={2.4} />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* 향후 추가 예정 — Fi / Whistle / 만보계 일반 */}
      <section className="px-5 mt-3">
        <div
          className="rounded p-4 text-center"
          style={{
            background: 'var(--bg-2)',
            border: '1px dashed var(--rule-2)',
          }}
        >
          <p
            className="text-[12px] font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            Fi · Whistle · 일반 만보계 연동 곧 추가돼요.
          </p>
        </div>
      </section>
    </div>
  )
}
