import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { AdminHeader, AdminCard, Badge, LoadError, StatCard } from '@/components/admin/ui'
import {
  describeAnalysis,
  describeBox,
  surveyChips,
  surveyOrigin,
  ORIGIN_LABEL,
  type SurveyOrigin,
} from '@/lib/survey/labels'
import { loadSurveyRecords, fmtKst, dogLine, type SurveyRecord } from './_data'

/**
 * /admin/surveys — 설문 기록 (2026-09-24 사장님: "고객 한 명의 설문 답변을 보는 화면이
 * 없다 → 이때까지 설문한 것 전부, 그걸로 나온 추천 박스까지").
 *
 * 한 카드 = 설문 1건: 강아지·보호자 → 답변 요약 칩 → 분석(하루 kcal·급여량·계수) →
 * 추천 박스(레시피·비율·근거 칩). 카드를 누르면 답변 전체가 한글로 펼쳐진다.
 * 라벨 변환은 lib/survey/labels.ts(순수·테스트), 데이터 조립은 ./_data.ts.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '설문 기록',
  robots: { index: false, follow: false },
}

const ORIGIN_FILTERS: Array<{ key: SurveyOrigin | 'all'; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'app_v4', label: '앱 (새 설문)' },
  { key: 'app_v3', label: '앱 (이전)' },
  { key: 'web', label: '웹 1분 설문' },
]

export default async function AdminSurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; origin?: string }>
}) {
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/surveys')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const sp = await searchParams
  const q = (sp.q ?? '').trim().toLowerCase()
  const origin = (ORIGIN_FILTERS.some((f) => f.key === sp.origin) ? sp.origin : 'all') as SurveyOrigin | 'all'

  const admin = createAdminClient()
  const loaded = await loadSurveyRecords(admin)
  if (!loaded.ok) {
    return (
      <div>
        <AdminHeader title="설문 기록" />
        <LoadError what="설문 기록" hint={loaded.message} />
      </div>
    )
  }

  const all = loaded.records
  const rows = all.filter((r) => {
    if (origin !== 'all' && r.origin !== origin) return false
    if (!q) return true
    const hay = [r.dog?.name, r.dog?.breed, r.owner?.email, r.owner?.name].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })

  // 서버 컴포넌트 — Date.now() 는 impure 로 막혀 new Date() 사용(다른 어드민 페이지와 동일).
  const now = new Date().getTime()
  const week = all.filter((r) => now - new Date(r.created_at).getTime() < 7 * 86400000).length
  const withSub = new Set(all.filter((r) => r.subscriptionStatus === 'active').map((r) => r.dog_id)).size
  const dogs = new Set(all.map((r) => r.dog_id)).size

  return (
    <div>
      <AdminHeader
        title="설문 기록"
        sub="고객이 설문에 누른 답 그대로, 그 답으로 나온 분석과 추천 박스까지. 카드를 누르면 전체가 펼쳐져요."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="설문 전체" value={all.length} unit="건" sub={`강아지 ${dogs}마리`} />
        <StatCard label="최근 7일" value={week} unit="건" tone={week > 0 ? 'green' : 'neutral'} />
        <StatCard label="새 설문(v4) 비율" value={all.length ? Math.round((all.filter((r) => r.origin === 'app_v4').length / all.length) * 100) : 0} unit="%" sub="화면당 질문 하나 버전" />
        <StatCard label="정기배송 중" value={withSub} unit="마리" sub="설문한 강아지 중" tone={withSub > 0 ? 'green' : 'neutral'} />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="강아지 이름 · 견종 · 보호자 이메일"
          className="h-9 flex-1 min-w-[220px] rounded-lg border border-input bg-card px-3 text-[13px] text-foreground"
        />
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-secondary p-1">
          {ORIGIN_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/surveys?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(f.key === 'all' ? {} : { origin: f.key }) }).toString()}`}
              className={`px-3 py-1.5 rounded-md text-[12.5px] font-bold transition ${
                origin === f.key ? 'border border-border bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <button type="submit" className="h-9 rounded-lg border border-border bg-card px-3 text-[12.5px] font-bold text-foreground">
          검색
        </button>
      </form>

      {rows.length === 0 ? (
        <AdminCard>
          <p className="text-[13px] text-muted-foreground">조건에 맞는 설문이 없어요.</p>
        </AdminCard>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <SurveyCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function SurveyCard({ r }: { r: SurveyRecord }) {
  const chips = surveyChips(r.answers, r.meta)
  const analysis = describeAnalysis(r.analysis)
  const box = describeBox(r.formula)
  const originTone = r.origin === 'app_v4' ? 'green' : r.origin === 'web' ? 'blue' : 'neutral'
  return (
    <Link href={`/admin/surveys/${r.id}`} className="block group">
      <AdminCard className="transition group-hover:border-foreground/30">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] font-bold text-foreground">{r.dog?.name ?? '(강아지 삭제됨)'}</span>
              <span className="text-[12px] text-muted-foreground">{dogLine(r.dog)}</span>
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              {r.owner?.name ? `${r.owner.name} · ` : ''}
              {r.owner?.email ?? '이메일 없음'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={originTone}>{ORIGIN_LABEL[surveyOrigin(r.answers)]}</Badge>
            {r.subscriptionStatus === 'active' ? (
              <Badge tone="green">정기배송 중</Badge>
            ) : r.subscriptionStatus ? (
              <Badge tone="amber">구독 {r.subscriptionStatus}</Badge>
            ) : (
              <Badge>구독 없음</Badge>
            )}
            <span className="text-[11px] text-muted-foreground tabular-nums">{fmtKst(r.created_at)}</span>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-secondary px-2.5 py-1 text-[12px] font-semibold text-foreground">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-secondary px-3 py-2.5">
            <div className="text-[10.5px] font-bold text-muted-foreground">분석 결과</div>
            {analysis ? (
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[20px] font-bold tabular-nums text-foreground">
                  {analysis.mer ?? '—'} <span className="text-[12px] font-semibold text-muted-foreground">kcal/일</span>
                </span>
                <span className="text-[13px] tabular-nums text-foreground">{analysis.feedG ?? '—'} g/일</span>
                <span className="text-[12px] text-muted-foreground tabular-nums">계수 {analysis.factor ?? '—'}</span>
                {analysis.vetConsult && <Badge tone="amber">수의사 상담 권장</Badge>}
                {analysis.riskFlags.map((f) => (
                  <Badge key={f} tone="red">{f}</Badge>
                ))}
              </div>
            ) : (
              <div className="mt-1 text-[12px] text-muted-foreground">분석 없음</div>
            )}
          </div>
          <div className="rounded-lg bg-secondary px-3 py-2.5">
            <div className="text-[10.5px] font-bold text-muted-foreground">추천 박스</div>
            {box && box.picks.length > 0 ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {box.picks.map((p) => (
                  <span key={p.protein + p.name} className="rounded-md bg-card border border-border px-2 py-1 text-[13px] font-bold text-foreground">
                    {p.name} {Math.round(p.ratio * 100)}%
                  </span>
                ))}
                {box.dailyGrams != null && (
                  <span className="text-[12px] text-muted-foreground tabular-nums">{box.dailyGrams} g/일</span>
                )}
                {box.chips.slice(0, 3).map((c) => (
                  <span key={c} className="text-[11px] text-muted-foreground">· {c}</span>
                ))}
              </div>
            ) : (
              <div className="mt-1 text-[12px] text-muted-foreground">아직 추천 박스 없음 (분석 화면을 열면 계산돼요)</div>
            )}
          </div>
        </div>
      </AdminCard>
    </Link>
  )
}
