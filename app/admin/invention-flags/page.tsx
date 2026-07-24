import { redirect } from 'next/navigation'
import { ToggleRight, ToggleLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { getAllFlags, envVarFor } from '@/lib/invention-flags'
import { AdminTabs } from '@/components/admin/ui'
import { SETTINGS_TABS } from '@/components/admin/tabGroups'

export const dynamic = 'force-dynamic'

/**
 * /admin/invention-flags — 발명 핵심 feature flag 모니터링.
 *
 * PCT 출원 전 알고리즘 노출 방지용 kill switch. 환경변수 한 줄 변경 +
 * Vercel redeploy 로 즉시 OFF. 이 페이지에서 현재 상태만 확인 (변경 X —
 * Vercel dashboard 에서만 변경 가능).
 */
export default async function InventionFlagsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/invention-flags')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const flags = getAllFlags()

  const featureRows: Array<{
    key: keyof typeof flags
    label: string
    description: string
  }> = [
    {
      key: 'core',
      label: 'Core',
      description:
        '전체 발명 기능 master switch. OFF 면 sub feature 모두 자동 OFF.',
    },
    {
      key: 'meta_learning',
      label: 'Meta Learning (모듈 H)',
      description:
        '메타학습 가중치 갱신 cron + algorithm_meta_weights 적재.',
    },
    {
      key: 'counterfactual',
      label: 'Counterfactual (모듈 G)',
      description:
        'Pearl framework do-calculus sensitivity analysis + 주간 snapshot cron.',
    },
    {
      key: 'persona',
      label: '4 페르소나 클러스터링',
      description:
        'data_lover / emotional / convenience / vet_dependent 분기 UI.',
    },
    {
      key: 'w_image',
      label: 'W_image (모듈 B)',
      description:
        '이미지 신뢰도 점수 산출 (촬영 각도·자세·털길이 가중치).',
    },
  ]

  return (
    <main className="px-5 pb-24 pt-6 max-w-2xl mx-auto">
      {/* 대개편 v2 T6 — 설정 그룹 탭 (뒤로가기·킥커 대체, serif 헤더 zinc 통일) */}
      <AdminTabs tabs={SETTINGS_TABS} active="/admin/invention-flags" />
      <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
        발명 기능 켜고 끄기
      </h1>
      <p className="text-[12.5px] mt-2 leading-relaxed text-text/75">
        특허 출원 전 핵심 알고리즘을 가리기 위한 스위치예요. 이 페이지에서는
        상태만 볼 수 있고, 변경은 별도 설정(환경변수)에서만 가능해요.
      </p>

      <section className="mt-5 rounded-lg border bg-white p-5" style={{ borderColor: 'var(--rule)' }}>
        <div className="space-y-3">
          {featureRows.map((row) => {
            const on = flags[row.key]
            const envVar = envVarFor(row.key)
            return (
              <div
                key={row.key}
                className="flex items-start gap-3 rounded-xl border px-4 py-3"
                style={{
                  borderColor: on
                    ? 'color-mix(in srgb, var(--moss) 30%, transparent)'
                    : 'var(--rule)',
                  background: on
                    ? 'color-mix(in srgb, var(--moss) 6%, white)'
                    : 'var(--bg)',
                }}
              >
                <span
                  className="shrink-0 mt-0.5"
                  style={{ color: on ? 'var(--moss)' : 'var(--muted)' }}
                  aria-label={on ? 'ON' : 'OFF'}
                >
                  {on ? (
                    <ToggleRight className="w-5 h-5" strokeWidth={2} />
                  ) : (
                    <ToggleLeft className="w-5 h-5" strokeWidth={2} />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[13px] font-bold"
                      style={{ color: 'var(--ink)' }}
                    >
                      {row.label}
                    </span>
                    <span
                      className="text-[10.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        background: on ? 'var(--moss)' : 'var(--muted)',
                        color: 'white',
                      }}
                    >
                      {on ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed mt-0.5 text-muted">
                    {row.description}
                  </p>
                  <p className="text-[10.5px] mt-1 font-mono text-muted">
                    {envVar}={on ? 'on' : 'off / unset'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section
        className="mt-4 rounded-lg px-5 py-4 flex items-start gap-2"
        style={{
          background: 'color-mix(in srgb, var(--gold) 10%, white)',
          border: '1px solid color-mix(in srgb, var(--gold) 28%, transparent)',
        }}
      >
        <AlertCircle
          className="w-4 h-4 shrink-0 mt-0.5"
          strokeWidth={2}
          style={{ color: 'var(--gold)' }}
        />
        <div className="flex-1 text-[12px] leading-relaxed">
          <p className="font-bold" style={{ color: 'var(--ink)' }}>
            PCT 출원 전 정책
          </p>
          <p className="mt-1 text-text/80">
            default 모두 OFF. 명시적 <code className="font-mono">on</code>{' '}
            으로 설정해야 동작. PCT 출원 결정 후 또는 신규성 grace period
            내에서만 ON 권장.
          </p>
        </div>
      </section>
    </main>
  )
}
