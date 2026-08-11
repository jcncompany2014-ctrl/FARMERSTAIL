import { redirect } from 'next/navigation'
import { ToggleRight, ToggleLeft, AlertCircle } from 'lucide-react'
import { createClient, getRequestUser } from '@/lib/supabase/server'
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
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/invention-flags')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const flags = getAllFlags()

  const featureRows: Array<{
    key: keyof typeof flags
    label: string
    description: string
  }> = [
    // 라벨·설명은 **사장님이 읽는 문장**이다(2026-07-26 지적). 예전엔
    // 'master switch', 'Pearl framework do-calculus', 'algorithm_meta_weights
    // 적재' 처럼 개발자 용어 그대로였다. 모듈 기호(H·G·B)는 특허 서류와
    // 맞춰야 해서 괄호로만 남긴다.
    {
      key: 'core',
      label: '전체 켜고 끄기',
      description:
        '아래 기능 전부를 한 번에 끄는 스위치예요. 이게 꺼져 있으면 나머지도 전부 꺼져요.',
    },
    {
      key: 'meta_learning',
      label: '추천이 스스로 학습 (모듈 H)',
      description:
        '고객 반응을 모아서, 추천 계산에 쓰는 가중치를 주기적으로 자동으로 다듬어요.',
    },
    {
      key: 'counterfactual',
      label: '가정 비교 분석 (모듈 G)',
      description:
        '"다른 레시피였다면 어땠을까"를 통계로 비교해서 주간 기록을 남겨요.',
    },
    {
      key: 'persona',
      label: '보호자 유형별 화면',
      description:
        '보호자를 4가지 유형(데이터 중시·정서 중시·간편 중시·수의사 의존)으로 나눠 화면을 조금씩 다르게 보여줘요.',
    },
    {
      key: 'w_image',
      label: '사진 신뢰도 점수 (모듈 B)',
      description:
        '보내주신 사진의 각도·자세·털 길이를 보고, 사진으로 판단한 체형을 얼마나 믿을지 점수를 매겨요.',
    },
  ]

  return (
    <main className="px-5 pb-24 pt-6 max-w-2xl mx-auto">
      {/* 대개편 v2 T6 — 설정 그룹 탭 (뒤로가기·킥커 대체, serif 헤더 zinc 통일) */}
      <AdminTabs tabs={SETTINGS_TABS} active="/admin/invention-flags" />
      <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
        발명 기능 켜고 끄기
      </h1>
      <p className="text-[13px] text-zinc-500 mt-2 leading-relaxed">
        특허 출원 전이라, 핵심 알고리즘을 고객·외부에 안 보이게 가려두는
        스위치들의 현재 상태를 보는 곳이에요. 여기선 켜짐/꺼짐만 확인하고,
        실제 변경은 별도 설정(환경변수)에서만 돼요.
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
                      className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: on ? 'var(--moss)' : 'var(--muted)',
                        color: 'white',
                      }}
                    >
                      {on ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed mt-0.5 text-zinc-500">
                    {row.description}
                  </p>
                  <p className="text-[10.5px] mt-1 font-mono text-zinc-500">
                    설정 이름 {envVar} · 현재 {on ? '켜짐' : '꺼짐(또는 미설정)'}
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
            특허 출원 전에는 꺼두는 게 원칙이에요
          </p>
          <p className="mt-1 text-zinc-800/80">
            아무 설정도 안 하면 전부 꺼진 상태예요. 켜려면 설정값을 직접
            &lsquo;on&rsquo; 으로 바꿔야 해요. 특허를 낼지 정한 뒤,
            또는 공개해도 특허에 지장 없는 기간 안에서만 켜는 걸 권해요.
          </p>
        </div>
      </section>
    </main>
  )
}
