import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { selectInChunks } from '@/lib/supabase/in-chunks'
import { chargeProblemReason, isProblemCharge } from '@/lib/admin/charge-rows'
import { AdminTabs, StatCard, Hl, Em, FilterChip, LoadError } from '@/components/admin/ui'
import { SUBS_TABS } from '@/components/admin/tabGroups'
import {
  ChargeRowsView,
  OpenHoldsView,
  type ChargeDetail,
  type ChargeListRow,
  type ChargeRow,
  type OpenHold,
} from './ChargeRowsView'

export const dynamic = 'force-dynamic'

/**
 * /admin/subscriptions/charges
 *
 * 정기배송 자동결제 시도 이력 모니터링. cron (subscription-charge) 가
 * 매일 아침(KST 09:10) 시도하는 결과를 한눈에 본다.
 *
 * # 핵심 요약 카드 (상단)
 *   - 오늘 시도 / 성공 / 실패 / 일시중단
 *   - 최근 30일 성공률
 *   - 누적 매출 (success 만)
 *
 * # 문제 행 (가장 중요) — 2026-10-14 A2
 *   - 실패·보류(건너뜀)·결과 불명(pending) 행에 고객 이름·강아지 이름·카드 끝 4자리·쉬운 말 사유
 *     (lib/admin/charge-rows — 토스 코드는 고객 화면과 같은 describeBillingError)·다음 재시도 시각·'고객 보기'를 붙인다.
 *   - '실패만 보기'·'확인 필요'(실패+보류+결과 불명) 필터. 폰에선 카드 목록(표는 가로로 넘친다).
 *   - 가격 인상 동의가 없어 청구 크론이 보류한 회차(subscription_charge_holds)를 맨 위에 빨간 상자로.
 *
 * # 전체 이력
 *   - status 필터 + 페이지네이션 (간단 form). 운영 초기엔 쿼리 스트링
 *     기반 페이징, 트래픽 늘면 cursor 로 전환.
 */

type StatusFilter = ChargeRow['status'] | 'problem'

function todayKstIsoDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export default async function SubscriptionChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect('/login')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const sp = await searchParams
  const status: StatusFilter | undefined = (['pending', 'succeeded', 'failed', 'skipped', 'problem'] as const).find(
    (s) => s === sp.status,
  )
  const pageNum = Math.max(1, Number(sp.page ?? '1') || 1)
  const PAGE_SIZE = 50

  // 최근 30일 집계.
  // server component (async) 라 매 요청마다 한 번만 실행 — React 19
  // `react-hooks/purity` 룰의 client-side 가정이 적용되지 않는다. 룰의 매칭은
  // `Date.now()` 가 위치한 단일 라인 단위라 변수로 추출해 disable 댓글을 정확히
  // 그 라인에 붙여 둔다.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString()
  const today = todayKstIsoDate()

  const listQuery = () => {
    const base = supabase.from('subscription_charges').select('*')
    if (status === 'problem') return base.in('status', ['failed', 'pending', 'skipped'])
    if (status) return base.eq('status', status)
    return base
  }

  const [todayRes, last30dRes, listRes] = await Promise.all([
    // 오늘 시도들
    supabase
      .from('subscription_charges')
      .select('status, amount')
      .eq('scheduled_for', today),
    // 30일 시도들 (성공률 + 누적 매출용)
    supabase
      .from('subscription_charges')
      .select('status, amount')
      .gte('attempted_at', thirtyDaysAgo),
    // 리스트 — 필터 적용
    listQuery()
      .order('attempted_at', { ascending: false })
      .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1),
  ])

  type AggRow = { status: ChargeRow['status']; amount: number }
  const todayRows = (todayRes.data ?? []) as AggRow[]
  const last30dRows = (last30dRes.data ?? []) as AggRow[]
  const list = (listRes.data ?? []) as ChargeRow[]
  // 규칙1 — 집계·리스트 조회 실패를 "0건/결과 없음"으로 위장하지 않는다.
  const statsLoadFailed = Boolean(todayRes.error || last30dRes.error)
  const listLoadFailed = Boolean(listRes.error)

  /**
   * 문제 행 설명 붙이기 — 고객·강아지·카드 끝 4자리·다음 재시도. 다른 고객의 프로필·강아지를 읽으므로
   * 관리자 확인(위) 뒤 service_role 로 읽고, 범위는 이 페이지의 행으로 코드가 묶는다.
   * 실패하면 행은 그대로 보이고 '고객 정보를 불러오지 못했어요'로 표시한다(없는 것처럼 보이지 않게).
   */
  const admin = createAdminClient()
  const problemRows = list.filter((r) => isProblemCharge(r.status))
  const detailBySub = new Map<string, Omit<ChargeDetail, 'reason'>>()
  let enrichError: string | null = null
  const subIds = [...new Set(problemRows.map((r) => r.subscription_id))]
  if (subIds.length > 0) {
    const subsRes = await selectInChunks(subIds, (chunk) =>
      admin
        .from('subscriptions')
        .select('id, user_id, dog_id, status, billing_card_last4, next_retry_at')
        .in('id', chunk),
    )
    if (subsRes.error) {
      enrichError = subsRes.error.message
    } else {
      const subs = subsRes.data
      const userIds = [...new Set(subs.map((s) => s.user_id))]
      const dogIds = [...new Set(subs.map((s) => s.dog_id).filter((x): x is string => !!x))]
      const [profRes, dogRes] = await Promise.all([
        selectInChunks(userIds, (chunk) => admin.from('profiles').select('id, name').in('id', chunk)),
        selectInChunks(dogIds, (chunk) => admin.from('dogs').select('id, name').in('id', chunk)),
      ])
      if (profRes.error || dogRes.error) enrichError = (profRes.error ?? dogRes.error)!.message
      const nameByUser = new Map((profRes.data ?? []).map((p) => [p.id, p.name as string | null]))
      const nameByDog = new Map((dogRes.data ?? []).map((d) => [d.id, d.name as string | null]))
      for (const s of subs) {
        detailBySub.set(s.id, {
          customerName: nameByUser.get(s.user_id) ?? null,
          dogName: s.dog_id ? (nameByDog.get(s.dog_id) ?? null) : null,
          cardLast4: s.billing_card_last4 ?? null,
          nextRetryAt: s.next_retry_at ?? null,
          subStatus: s.status ?? null,
        })
      }
    }
  }
  const rows: ChargeListRow[] = list.map((r) => {
    if (!isProblemCharge(r.status)) return { ...r, detail: null }
    const d = detailBySub.get(r.subscription_id)
    // 조회가 실패해 모르는 것과 구독이 지워져 없는 것을 가른다 — 실패면 '불러오지 못했어요'(detail null).
    if (!d && enrichError) return { ...r, detail: null }
    const empty = { customerName: null, dogName: null, cardLast4: null, nextRetryAt: null, subStatus: null }
    return { ...r, detail: { ...empty, ...d, reason: chargeProblemReason(r) } }
  })

  // 가격 인상 동의가 없어 보류된 회차(열린 것) — 20261014200100.
  const holdsRes = await admin
    .from('subscription_charge_holds')
    .select('id, subscription_id, user_id, ship_date, charge_date, rise, charge_amount, list_amount, first_held_at')
    .is('resolved_at', null)
    .order('first_held_at', { ascending: false })
    .limit(100)
  let holds: OpenHold[] = []
  let holdsFailed = Boolean(holdsRes.error)
  if (!holdsRes.error && (holdsRes.data ?? []).length > 0) {
    const hs = holdsRes.data ?? []
    const [hSubs, hProf] = await Promise.all([
      selectInChunks([...new Set(hs.map((h) => h.subscription_id))], (chunk) =>
        admin.from('subscriptions').select('id, dog_id').in('id', chunk),
      ),
      selectInChunks([...new Set(hs.map((h) => h.user_id))], (chunk) =>
        admin.from('profiles').select('id, name').in('id', chunk),
      ),
    ])
    const dogIds = [...new Set((hSubs.data ?? []).map((s) => s.dog_id).filter((x): x is string => !!x))]
    const hDogs = await selectInChunks(dogIds, (chunk) => admin.from('dogs').select('id, name').in('id', chunk))
    if (hSubs.error || hProf.error || hDogs.error) holdsFailed = true
    const dogBySub = new Map((hSubs.data ?? []).map((s) => [s.id, s.dog_id as string | null]))
    const dogName = new Map((hDogs.data ?? []).map((d) => [d.id, d.name as string | null]))
    const userName = new Map((hProf.data ?? []).map((p) => [p.id, p.name as string | null]))
    holds = hs.map((h) => {
      const dogId = dogBySub.get(h.subscription_id) ?? null
      return {
        id: h.id,
        subscriptionId: h.subscription_id,
        userId: h.user_id,
        shipDate: h.ship_date,
        chargeDate: h.charge_date,
        rise: h.rise,
        chargeAmount: h.charge_amount,
        listAmount: h.list_amount,
        firstHeldAt: h.first_held_at,
        customerName: userName.get(h.user_id) ?? null,
        dogName: dogId ? (dogName.get(dogId) ?? null) : null,
      }
    })
  }

  const todayCounts = {
    total: todayRows.length,
    succeeded: todayRows.filter((r) => r.status === 'succeeded').length,
    failed: todayRows.filter((r) => r.status === 'failed').length,
    pending: todayRows.filter((r) => r.status === 'pending').length,
  }

  const last30dSuccess = last30dRows.filter((r) => r.status === 'succeeded')
  const last30dFailed = last30dRows.filter((r) => r.status === 'failed')
  const successRate =
    last30dSuccess.length + last30dFailed.length === 0
      ? 100
      : (last30dSuccess.length /
          (last30dSuccess.length + last30dFailed.length)) *
        100
  const last30dRevenue = last30dSuccess.reduce((s, r) => s + r.amount, 0)

  const filterLink = (s: StatusFilter | undefined): string => {
    const params = new URLSearchParams()
    if (s) params.set('status', s)
    const qs = params.toString()
    return qs
      ? `/admin/subscriptions/charges?${qs}`
      : '/admin/subscriptions/charges'
  }

  return (
    <div>
      {/* 대개편 v2 T1 — 정기배송 그룹 탭 + 헤더 zinc 통일 */}
      <AdminTabs tabs={SUBS_TABS} active="/admin/subscriptions/charges" />
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">
          자동결제 이력
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          <Hl>정기배송 카드 자동결제가 언제 성공·실패했는지</Hl> 보는 곳이에요.
          실패한 결제는 <Em>자동으로 재시도</Em>되고, 계속 실패하면 대시보드
          처리 대기에 떠요. 앞으로 나갈 결제는{' '}
          <Link href="/admin/subscriptions/calendar" className="font-bold text-primary underline underline-offset-2">
            배송 캘린더의 &lsquo;다가오는 결제&rsquo;
          </Link>
          에서 봐요.
        </p>
      </div>

      {statsLoadFailed && (
        <div className="mb-4">
          <LoadError
            what="결제 집계"
            hint="아래 요약 카드 숫자는 실제보다 적게 보일 수 있어요. 새로고침해 주세요."
          />
        </div>
      )}

      <div className="mb-4">
        <OpenHoldsView holds={holds} loadFailed={holdsFailed} />
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="오늘 시도"
          value={todayCounts.total}
          unit="건"
          sub={`성공 ${todayCounts.succeeded} · 실패 ${todayCounts.failed}`}
        />
        <StatCard
          label="30일 성공률"
          value={`${successRate.toFixed(1)}%`}
          sub={`${last30dSuccess.length} / ${
            last30dSuccess.length + last30dFailed.length
          }건`}
          tone={successRate >= 95 ? 'green' : successRate >= 85 ? 'amber' : 'red'}
        />
        <StatCard
          label="30일 누적 매출"
          value={last30dRevenue.toLocaleString()}
          unit="원"
          sub="성공 건만 합산"
        />
        <StatCard
          label="30일 실패"
          value={last30dFailed.length}
          unit="건"
          sub="후속 조치 필요"
          tone={last30dFailed.length > 0 ? 'red' : 'green'}
        />
      </div>

      {/* 필터 칩 */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <FilterChip href={filterLink(undefined)} active={!status} label="전체" />
        <FilterChip href={filterLink('failed')} active={status === 'failed'} label="실패만 보기" />
        <FilterChip href={filterLink('problem')} active={status === 'problem'} label="확인 필요(실패·보류·확인 중)" />
        <FilterChip href={filterLink('pending')} active={status === 'pending'} label="결과 확인 중" />
        <FilterChip href={filterLink('succeeded')} active={status === 'succeeded'} label="성공" />
        <FilterChip href={filterLink('skipped')} active={status === 'skipped'} label="건너뜀" />
      </div>

      {enrichError && (
        <div className="mb-4">
          <LoadError
            what="문제 결제의 고객 정보"
            hint="결제 행은 그대로 보여요. 고객 이름·카드 끝 4자리·재시도 시각만 비어 있어요 — 새로고침해 주세요."
          />
        </div>
      )}

      <ChargeRowsView rows={rows} loadFailed={listLoadFailed} />

      {/* 페이지네이션 — 단순 prev/next */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11.5px] text-muted-foreground">
          페이지 {pageNum} · {list.length}건 표시 · 페이지당 {PAGE_SIZE}건
        </p>
        <div className="flex gap-2">
          {pageNum > 1 && (
            <Link
              href={`${filterLink(status)}${
                filterLink(status).includes('?') ? '&' : '?'
              }page=${pageNum - 1}`}
              className="px-3 py-1.5 rounded-lg border border-border text-[12px] font-bold hover:border-primary hover:text-primary transition"
            >
              ← 이전
            </Link>
          )}
          {list.length === PAGE_SIZE && (
            <Link
              href={`${filterLink(status)}${
                filterLink(status).includes('?') ? '&' : '?'
              }page=${pageNum + 1}`}
              className="px-3 py-1.5 rounded-lg border border-border text-[12px] font-bold hover:border-primary hover:text-primary transition"
            >
              다음 →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// 로컬 FilterChip 제거(계획 B5-1, 2026-07-25) — ui.tsx 공통 컴포넌트로 통합.
// 활성색이 여기만 웜 토큰 `bg-foreground` 였는데 admin 정본인 zinc-900 으로 맞춰졌다.
