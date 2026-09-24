import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { AdminHeader, AdminCard, Badge, LoadError, SectionTitle } from '@/components/admin/ui'
import {
  APPROVAL_KR,
  describeAnalysis,
  describeBox,
  describeSurvey,
  ORIGIN_LABEL,
  type LabelTone,
} from '@/lib/survey/labels'
import { loadSurveyRecords, fmtKst, dogLine } from '../_data'

/**
 * /admin/surveys/[id] — 설문 1건 상세: 답변 전체(한글) · 분석 계산 근거 · 추천 박스.
 * 사장님이 고객 캡처를 받았을 때 "이 아이가 뭐라고 답했지"를 30초 안에 보는 화면.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '설문 상세',
  robots: { index: false, follow: false },
}

const TONE_CLASS: Record<LabelTone, string> = {
  warn: 'text-amber-700 font-bold',
  good: 'text-emerald-700 font-semibold',
  muted: 'text-muted-foreground',
}

export default async function AdminSurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect(`/login?next=/admin/surveys/${id}`)
  if (!(await isAdmin(supabase, user))) redirect('/')

  const loaded = await loadSurveyRecords(createAdminClient(), id)
  if (!loaded.ok) {
    return (
      <div>
        <AdminHeader title="설문 상세" />
        <LoadError what="설문 기록" hint={loaded.message} />
      </div>
    )
  }
  const r = loaded.records[0]
  if (!r) {
    return (
      <div>
        <AdminHeader title="설문 상세" />
        <AdminCard>
          <p className="text-[13px] text-muted-foreground">이 설문을 찾을 수 없어요.</p>
          <Link href="/admin/surveys" className="mt-2 inline-block text-[12.5px] font-bold text-primary underline underline-offset-2">← 설문 기록으로</Link>
        </AdminCard>
      </div>
    )
  }

  const sections = describeSurvey(r.answers, r.meta)
  const analysis = describeAnalysis(r.analysis)
  const box = describeBox(r.formula)

  return (
    <div>
      <div className="mb-3">
        <Link href="/admin/surveys" className="text-[12.5px] font-bold text-muted-foreground hover:text-foreground">← 설문 기록</Link>
      </div>
      <AdminHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {r.dog?.name ?? '(강아지 삭제됨)'}
            <span className="text-[14px] font-semibold text-muted-foreground">{dogLine(r.dog)}</span>
          </span>
        }
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span>{r.owner?.name ? `${r.owner.name} · ` : ''}{r.owner?.email ?? '이메일 없음'}</span>
            <span>·</span>
            <span>설문 {fmtKst(r.created_at)}</span>
            <Badge tone={r.origin === 'app_v4' ? 'green' : r.origin === 'web' ? 'blue' : 'neutral'}>{ORIGIN_LABEL[r.origin]}</Badge>
            {r.subscriptionStatus === 'active' ? <Badge tone="green">정기배송 중</Badge> : r.subscriptionStatus ? <Badge tone="amber">구독 {r.subscriptionStatus}</Badge> : <Badge>구독 없음</Badge>}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* ── 답변 ── */}
        <div className="space-y-4">
          {sections.length === 0 ? (
            <AdminCard>
              <p className="text-[13px] text-muted-foreground">읽을 수 있는 답변이 없어요. 아래 원본을 확인해 주세요.</p>
            </AdminCard>
          ) : (
            sections.map((sec) => (
              <AdminCard key={sec.title}>
                <SectionTitle title={sec.title} />
                <dl className="divide-y divide-border">
                  {sec.items.map((it) => (
                    <div key={it.label} className="grid grid-cols-[130px_1fr] gap-3 py-2">
                      <dt className="text-[12.5px] text-muted-foreground">{it.label}</dt>
                      <dd className={`text-[13.5px] leading-snug ${it.tone ? TONE_CLASS[it.tone] : 'text-foreground'}`}>{it.value}</dd>
                    </div>
                  ))}
                </dl>
              </AdminCard>
            ))
          )}
          <details className="rounded-xl border border-border bg-card">
            <summary className="cursor-pointer px-5 py-3 text-[12.5px] font-bold text-muted-foreground">원본 답변 JSON</summary>
            <pre className="overflow-x-auto px-5 pb-4 text-[11px] leading-relaxed text-foreground">{JSON.stringify(r.answers, null, 2)}</pre>
          </details>
        </div>

        {/* ── 분석 · 추천 박스 ── */}
        <div className="space-y-4">
          <AdminCard>
            <SectionTitle title="분석 결과" desc={r.analysis ? `계산 ${fmtKst(r.analysis.created_at)}` : undefined} />
            {analysis ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-[30px] font-bold tabular-nums text-foreground">{analysis.mer ?? '—'}</span>
                  <span className="text-[13px] font-semibold text-muted-foreground">kcal / 하루</span>
                </div>
                <div className="mt-1 text-[13px] text-foreground tabular-nums">
                  급여량 <b>{analysis.feedG ?? '—'} g/일</b>
                  {analysis.stage ? ` · ${analysis.stage}` : ''}
                  {analysis.bcs != null ? ` · 체형 ${analysis.bcs}/9` : ''}
                </div>
                <div className="mt-3 rounded-lg bg-secondary px-3 py-2.5">
                  <div className="text-[10.5px] font-bold text-muted-foreground">계산식</div>
                  <div className="mt-1 text-[13px] tabular-nums text-foreground">
                    RER {analysis.rer ?? '—'} × 계수 {analysis.factor ?? '—'} = {analysis.mer ?? '—'} kcal
                  </div>
                  {analysis.ladder.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {analysis.ladder.map((l, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="text-foreground">{l.label}</span>
                          <span className={`tabular-nums font-bold ${l.delta < 0 ? 'text-amber-700' : 'text-foreground'}`}>
                            {l.delta > 0 && i > 0 ? '+' : ''}{l.delta}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {analysis.macros && <div className="mt-3 text-[12.5px] text-foreground">{analysis.macros}</div>}
                {(analysis.vetConsult || analysis.riskFlags.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {analysis.vetConsult && <Badge tone="amber">수의사 상담 권장</Badge>}
                    {analysis.riskFlags.map((f) => <Badge key={f} tone="red">{f}</Badge>)}
                  </div>
                )}
                {analysis.supplements.length > 0 && (
                  <div className="mt-3 text-[12px] text-muted-foreground">보충제: {analysis.supplements.join(' · ')}</div>
                )}
                {analysis.nextReview && (
                  <div className="mt-1 text-[12px] text-muted-foreground">다음 분석 권장: {analysis.nextReview}</div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">이 설문으로 만든 분석이 없어요.</p>
            )}
          </AdminCard>

          <AdminCard>
            <SectionTitle
              title="추천 박스"
              desc={
                box
                  ? `${box.cycle != null ? `${box.cycle}번째 박스 · ` : ''}${box.computedAt ? `계산 ${fmtKst(box.computedAt)}` : ''}${r.formulaIsLater ? ' · 이 설문 이후 계산본이 없어 강아지의 최신 처방을 표시' : ''}`
                  : undefined
              }
            />
            {box && box.picks.length > 0 ? (
              <>
                <div className="grid gap-2">
                  {box.picks.map((p) => (
                    <div key={p.protein + p.name} className="rounded-lg border border-border bg-card px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-bold text-foreground">{p.name}</span>
                        <span className="text-[15px] font-bold tabular-nums text-foreground">{Math.round(p.ratio * 100)}%</span>
                      </div>
                      {(box.dailyGrams != null || p.kcalPer100g != null) && (
                        <div className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
                          {box.dailyGrams != null ? `${Math.round(box.dailyGrams * p.ratio)} g/일` : ''}
                          {p.kcalPer100g != null ? ` · ${p.kcalPer100g} kcal/100g` : ''}
                        </div>
                      )}
                      {p.claims.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {p.claims.map((c) => (
                            <li key={c} className="text-[12px] text-foreground">· {c}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[13px] text-foreground tabular-nums">
                  하루 <b>{box.dailyKcal ?? '—'} kcal</b> · <b>{box.dailyGrams ?? '—'} g</b>
                  {box.approvalStatus ? ` · ${APPROVAL_KR[box.approvalStatus] ?? box.approvalStatus}` : ''}
                  {box.userAdjusted ? ' · 고객이 직접 조정' : ''}
                </div>
                {box.needsConsultation && (
                  <div className="mt-2"><Badge tone="red">수의 상담 필요 (화식 부적합 가능)</Badge></div>
                )}
                {box.reasons.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10.5px] font-bold text-muted-foreground mb-1.5">왜 이렇게 골랐나</div>
                    <ul className="space-y-1.5">
                      {box.reasons.map((x, i) => (
                        <li key={i} className="text-[12.5px] leading-snug">
                          <span className="mr-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-foreground">{x.chip}</span>
                          <span className="text-muted-foreground">{x.action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {box.waitlist.length > 0 && (
                  <div className="mt-2 text-[12px] text-muted-foreground">준비 중인 보완: {box.waitlist.join(' · ')}</div>
                )}
                {(box.trace.length > 0 || box.engineDraft) && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[12px] font-bold text-muted-foreground">계산 과정 {box.trace.length}단계</summary>
                    {box.engineDraft && (
                      <p className="mt-1.5 text-[12px] text-muted-foreground">
                        엔진 초안은 {box.engineDraft} 였고, 규칙(보호자가 고른 잘 먹는 고기 · 알레르기 · 첫 박스는 한 가지)을 거쳐 위 박스로 확정됐어요. 초안 비율은 배송·고객 화면에 쓰이지 않아요.
                      </p>
                    )}
                    <ol className="mt-1.5 space-y-1 pl-4 list-decimal text-[12px] text-foreground">
                      {box.trace.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                  </details>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">아직 추천 박스가 없어요. 고객이 분석 화면을 열면 계산돼요.</p>
            )}
          </AdminCard>

          {r.dog && (
            <AdminCard>
              <SectionTitle title="바로 가기" />
              <div className="flex flex-wrap gap-2 text-[12.5px]">
                <Link href={`/admin/users?q=${encodeURIComponent(r.owner?.email ?? '')}`} className="font-bold text-primary underline underline-offset-2">고객 목록에서 보기</Link>
                <Link href={`/admin/surveys?q=${encodeURIComponent(r.dog.name)}`} className="font-bold text-primary underline underline-offset-2">이 강아지의 다른 설문</Link>
              </div>
            </AdminCard>
          )}
        </div>
      </div>
    </div>
  )
}
