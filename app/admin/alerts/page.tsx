import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { AdminHeader, FilterChip, LoadError, SectionTitle, Hl } from '@/components/admin/ui'
import { ALERT_GROUP_LABEL, type AlertGroup } from '@/lib/admin/alert-kinds'
import { toAlertView, sortAlertViews, type AlertRow } from '@/lib/admin/alert-view'
import { keyExpiryStates } from '@/lib/admin/key-expiry'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { tossKeyStatus, describeTossKeyStatus } from '@/lib/payments/key-mode'
import AlertsView from './AlertsView'
import KeyExpiryPanel from './KeyExpiryPanel'

export const dynamic = 'force-dynamic'

/**
 * /admin/alerts — 운영 경보함 (2026-10-14 어드민 B1·B4, 규칙247·248·252).
 *
 * 사장님이 직접 처리해야 하는 경보(lib/admin/alert-kinds 정본 목록)가 Sentry 와 함께 여기에도 쌓인다 — Sentry 메일은 Gmail 로
 * 오지 않는다. 안 본 것(처리 전)이 위, 종류별 필터, 각 경보에서 해당 주문·구독·고객으로 바로, '처리함'(메모).
 * 아래 칸은 외부 키 만료(설정일 적기) — 만료 7·3·1일 전에 아침 브리핑과 이 경보함에 뜬다.
 *
 * 읽기는 쿠키 클라이언트(관리자 읽기 정책 is_admin) — 쓰기는 API 라우트가 관리자 확인 뒤 service_role 로.
 */
export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>
}) {
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/alerts')
  if (!(await isAdmin(supabase, user))) redirect('/dashboard')

  const sp = await searchParams
  const groups = Object.keys(ALERT_GROUP_LABEL) as AlertGroup[]
  const g = groups.includes(sp.g as AlertGroup) ? (sp.g as AlertGroup) : null

  const [openRes, doneRes, keysRes] = await Promise.all([
    supabase
      .from('admin_alerts')
      .select(
        'id, kind, severity, message, occurrences, first_seen_at, last_seen_at, resolved_at, resolved_note, order_id, subscription_id, user_id, dog_id, context',
      )
      .is('resolved_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(300),
    supabase
      .from('admin_alerts')
      .select(
        'id, kind, severity, message, occurrences, first_seen_at, last_seen_at, resolved_at, resolved_note, order_id, subscription_id, user_id, dog_id, context',
      )
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(30),
    supabase.from('admin_key_expiry').select('key_name, set_on, expires_on'),
  ])

  const rows = [...((openRes.data ?? []) as AlertRow[]), ...((doneRes.data ?? []) as AlertRow[])]
  // 구독·강아지 → 그 주인 고객(바로 가기 링크용). 조회 실패면 링크만 '구독 목록'으로 떨어진다(경보 자체는 그대로 보인다).
  const subIds = [...new Set(rows.map((r) => r.subscription_id).filter((x): x is string => !!x))]
  const dogIds = [...new Set(rows.map((r) => r.dog_id).filter((x): x is string => !!x))]
  const [subsRes, dogsRes] = await Promise.all([
    subIds.length > 0 ? supabase.from('subscriptions').select('id, user_id').in('id', subIds) : Promise.resolve({ data: [], error: null }),
    dogIds.length > 0 ? supabase.from('dogs').select('id, user_id').in('id', dogIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (subsRes.error) console.error('[admin-alerts] 구독 주인 조회 실패:', subsRes.error.message)
  if (dogsRes.error) console.error('[admin-alerts] 강아지 주인 조회 실패:', dogsRes.error.message)
  const userBySub = new Map(((subsRes.data ?? []) as Array<{ id: string; user_id: string }>).map((s) => [s.id, s.user_id]))
  const userByDog = new Map(((dogsRes.data ?? []) as Array<{ id: string; user_id: string }>).map((d) => [d.id, d.user_id]))

  const allViews = sortAlertViews(rows.map((r) => toAlertView(r, { userBySub, userByDog })))
  const views = g ? allViews.filter((v) => v.group === g) : allViews
  const openCount = allViews.filter((v) => !v.resolvedAt).length
  const openByGroup = new Map<string, number>()
  for (const v of allViews) if (!v.resolvedAt) openByGroup.set(v.group, (openByGroup.get(v.group) ?? 0) + 1)

  const today = todayKstIsoDate()
  const keyStates = keyExpiryStates(
    keysRes.error ? [] : ((keysRes.data ?? []) as Array<{ key_name: string; set_on: string | null; expires_on: string | null }>),
    today,
  )
  const tossStatus = tossKeyStatus(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY, process.env.TOSS_SECRET_KEY)

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-5">
      <AdminHeader
        title="경보함"
        sub={
          <>
            <Hl>사장님이 직접 처리해야 하는 일</Hl>만 모았어요 — 결과 불명 결제·환불 실패·알레르기 누출 같은 것. 처리했으면
            &lsquo;처리함&rsquo;에 무엇을 했는지 적어 주세요. 같은 일이 24시간 안에 또 생기면 새 줄 없이 횟수만 올라가요.
          </>
        }
      />

      {(openRes.error || doneRes.error) && (
        <div className="mb-4">
          <LoadError what="경보" hint="경보함을 읽지 못했어요 — 경보가 없는 게 아니라 조회가 실패한 상태예요. 새로고침해 주세요." />
        </div>
      )}

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <FilterChip label={`전체 ${openCount}`} active={!g} href="/admin/alerts" />
        {groups.map((k) => (
          <FilterChip
            key={k}
            label={`${ALERT_GROUP_LABEL[k]} ${openByGroup.get(k) ?? 0}`}
            active={g === k}
            href={`/admin/alerts?g=${k}`}
          />
        ))}
      </div>

      {!(openRes.error || doneRes.error) && <AlertsView views={views} />}

      <section id="keys" className="mt-8 scroll-mt-20">
        <SectionTitle
          title="외부 키 만료"
          desc="만료일을 알 수 있는 곳이 없어서(응답·환경값에 만료 정보 없음) 새로 받은 날을 여기 적어요. 만료 7·3·1일 전에 아침 브리핑과 경보함에 떠요."
        />
        {keysRes.error && (
          <div className="mb-3">
            <LoadError what="키 만료일" hint="만료일 표를 읽지 못했어요 — 아래는 '모름'으로 보여요. 새로고침해 주세요." />
          </div>
        )}
        <KeyExpiryPanel states={keyStates} toss={{ live: tossStatus.isLive, title: describeTossKeyStatus(tossStatus).title }} />
      </section>
    </main>
  )
}
