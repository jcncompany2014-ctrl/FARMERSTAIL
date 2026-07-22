import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import BetaCohortPrintButton from './BetaCohortPrintButton'
import { HelpTip } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '베타 테스트 현황 — Admin',
  robots: { index: false, follow: false },
}

/**
 * /admin/beta-cohort — Round F2 (2026-05-20): 출시 전 30두 베타 cohort 관리.
 *
 * # 목적
 *   · cohort_id='closed_beta_2026_q3' dog 리스트 한눈에
 *   · 각 dog: 입회일 / 박스 N개 / outcome 횟수 / 별점 / 환불·해지 여부
 *   · 인쇄 (window.print()) → PDF 저장 → 정부 PT / 수의영양사 sign-off
 *
 * # 데이터
 *   feeding_outcomes + dogs + orders 조합.
 *   service_role 우회 (cross-user select).
 */
export default async function BetaCohortPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/beta-cohort')
  if (!(await isAdmin(supabase, user))) redirect('/admin')

  const COHORT_ID = 'closed_beta_2026_q3'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 베타 cohort 의 feeding_outcomes 전수 fetch.
  // 30두 × 박스 N개 × outcome N개 = max 수천 row. limit 10k.
  type OutcomeRow = {
    id: string
    dog_id: string
    user_id: string
    cohort_id: string
    source: string
    rating_stars: number | null
    reason_category: string | null
    sku_code: string | null
    weight_kg: number | null
    created_at: string
  }

  const { data: outcomesRaw } = await admin
    .from('feeding_outcomes')
    .select(
      'id, dog_id, user_id, cohort_id, source, rating_stars, reason_category, sku_code, weight_kg, created_at',
    )
    .eq('cohort_id', COHORT_ID)
    .order('created_at', { ascending: true })
    .limit(10000)

  const outcomes = (outcomesRaw ?? []) as OutcomeRow[]

  // dog 별 묶기
  const dogIds = Array.from(new Set(outcomes.map((o) => o.dog_id)))

  type DogMeta = {
    id: string
    name: string
    breed: string | null
    user_id: string
    user_name: string | null
  }

  const dogMetaMap = new Map<string, DogMeta>()
  if (dogIds.length > 0) {
    const { data: dogsRaw } = await admin
      .from('dogs')
      .select('id, name, breed, user_id')
      .in('id', dogIds)
    const dogs = (dogsRaw ?? []) as Array<{
      id: string
      name: string
      breed: string | null
      user_id: string
    }>

    const userIds = Array.from(new Set(dogs.map((d) => d.user_id)))
    const { data: profilesRaw } = await admin
      .from('profiles')
      .select('id, name')
      .in('id', userIds)
    const profiles = (profilesRaw ?? []) as Array<{
      id: string
      name: string | null
    }>
    const profileMap = new Map(profiles.map((p) => [p.id, p.name]))

    for (const d of dogs) {
      dogMetaMap.set(d.id, {
        id: d.id,
        name: d.name,
        breed: d.breed,
        user_id: d.user_id,
        user_name: profileMap.get(d.user_id) ?? null,
      })
    }
  }

  // dog 별 outcome summary 계산
  const dogSummaries = dogIds.map((dogId) => {
    const meta = dogMetaMap.get(dogId)
    const rows = outcomes.filter((o) => o.dog_id === dogId)
    const firstOrderAt = rows.find((o) => o.source === 'first_order')?.created_at
    const ratings = rows
      .filter((o) => o.source === 'box_rating' && o.rating_stars != null)
      .map((o) => o.rating_stars as number)
    const ratingAvg = ratings.length > 0
      ? ratings.reduce((s, n) => s + n, 0) / ratings.length
      : null
    const refundCount = rows.filter((o) => o.source === 'refund').length
    const cancelledFlag = rows.some((o) => o.source === 'subscription_cancel')
    const checkinDone = rows.some((o) => o.source === 'first_box_checkin')
    const reorderCount = rows.filter((o) => o.source === 'reorder').length
    return {
      dogId,
      meta,
      firstOrderAt,
      boxCount: 1 + reorderCount,
      ratingAvg,
      ratingN: ratings.length,
      refundCount,
      cancelled: cancelledFlag,
      checkinDone,
      totalOutcomes: rows.length,
    }
  })

  // 정렬: 활성 → 해지/환불 순. 그 안에서 박스 ↓.
  dogSummaries.sort((a, b) => {
    if (a.cancelled !== b.cancelled) return a.cancelled ? 1 : -1
    return b.boxCount - a.boxCount
  })

  const activeCount = dogSummaries.filter((d) => !d.cancelled).length
  const totalBoxes = dogSummaries.reduce((s, d) => s + d.boxCount, 0)
  const allRatings = outcomes
    .filter((o) => o.source === 'box_rating' && o.rating_stars != null)
    .map((o) => o.rating_stars as number)
  const avgRating = allRatings.length > 0
    ? allRatings.reduce((s, n) => s + n, 0) / allRatings.length
    : 0

  return (
    <div className="px-5 py-6 print:px-0 print:py-0">
      <style>
        {`@media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }`}
      </style>

      <div className="flex items-end justify-between mb-6 no-print">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text font-semibold mb-3"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
            대시보드
          </Link>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-moss" strokeWidth={2} />
            <h1 className="font-bold tracking-tight text-2xl text-ink">
              베타 테스트 현황
            </h1>
          </div>
          <p className="text-[12px] text-muted mt-1">
            2026 비공개 베타 — 강아지 30마리 진행 관리 + 정부 발표·수의영양사
            검수 자료
          </p>
        </div>
        <BetaCohortPrintButton />
      </div>

      {/* 인쇄용 헤더 */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold text-ink">파머스테일 베타 그룹 리포트</h1>
        <p className="text-sm text-muted mt-1">
          대상: 2026 비공개 베타 · 생성일{' '}
          {new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:break-inside-avoid">
        <Kpi
          label="등록 마리"
          value={`${dogSummaries.length}`}
          sub={`/ 30 목표`}
          help="베타 테스트에 등록된 강아지 수예요. 목표는 30마리."
        />
        <Kpi
          label="현재 활성"
          value={`${activeCount}`}
          sub="해지·환불 제외"
          help="지금도 구독을 유지 중인 베타 강아지 수예요(해지·환불 뺀 수)."
        />
        <Kpi
          label="누적 박스"
          value={`${totalBoxes}`}
          sub="첫 박스 + 재주문"
          help="베타 기간 동안 배송된 전체 박스 수예요(첫 박스 + 재주문 합계)."
        />
        <Kpi
          label="별점 평균"
          value={avgRating > 0 ? avgRating.toFixed(2) : '—'}
          sub={`${allRatings.length}건`}
          help="베타 고객이 남긴 별점(5점 만점)의 평균이에요."
        />
      </div>

      {/* dog 별 표 */}
      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 print:break-inside-avoid">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
          강아지별 진행 상황
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-muted border-b border-zinc-200">
                <th className="py-2 pr-3 font-bold">강아지</th>
                <th className="py-2 px-2 font-bold">보호자</th>
                <th className="py-2 px-2 font-bold">견종</th>
                <th className="py-2 px-2 font-bold">입회일</th>
                <th className="py-2 px-2 font-bold text-right">박스</th>
                <th className="py-2 px-2 font-bold text-right">별점</th>
                <th className="py-2 px-2 font-bold text-center">체크인</th>
                <th className="py-2 px-2 font-bold text-center">환불</th>
                <th className="py-2 pl-2 font-bold text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {dogSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-muted">
                    아직 베타 cohort 데이터 없음
                  </td>
                </tr>
              ) : (
                dogSummaries.map((d) => (
                  <tr key={d.dogId} className="border-b border-zinc-200/40">
                    <td className="py-2 pr-3 text-ink font-bold">
                      {d.meta?.name ?? '—'}
                    </td>
                    <td className="py-2 px-2 text-text">
                      {d.meta?.user_name ?? '—'}
                    </td>
                    <td className="py-2 px-2 text-muted text-[10.5px]">
                      {d.meta?.breed ?? '—'}
                    </td>
                    <td className="py-2 px-2 text-muted font-mono text-[10.5px]">
                      {d.firstOrderAt
                        ? d.firstOrderAt.slice(0, 10)
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                      {d.boxCount}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-ink">
                      {d.ratingAvg != null
                        ? `${d.ratingAvg.toFixed(1)} (${d.ratingN})`
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {d.checkinDone ? '✓' : '—'}
                    </td>
                    <td className="py-2 px-2 text-center font-mono tabular-nums text-ink">
                      {d.refundCount > 0 ? `${d.refundCount}건` : '—'}
                    </td>
                    <td className="py-2 pl-2 text-center">
                      {d.cancelled ? (
                        <span className="text-[10px] font-bold text-sale">해지</span>
                      ) : (
                        <span className="text-[10px] font-bold text-moss">활성</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[10.5px] text-muted mt-6 leading-relaxed print:break-inside-avoid">
        ※ 2026 비공개 베타 그룹의 반응 데이터를 자동 집계했어요. 정부 R&D
        평가 / 수의영양사 검수 자료로 활용하세요. 인쇄해서 PDF 로 저장할 수
        있어요.
      </p>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  help,
}: {
  label: string
  value: string
  sub: string
  help?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3.5 print:break-inside-avoid">
      <p className="flex items-center text-[10px] font-bold uppercase tracking-widest text-muted">
        {label}
        {help && <HelpTip text={help} />}
      </p>
      <p className="text-2xl font-bold tracking-tight text-ink tabular-nums mt-1">
        {value}
      </p>
      <p className="text-[10.5px] font-mono text-muted mt-0.5">{sub}</p>
    </div>
  )
}
