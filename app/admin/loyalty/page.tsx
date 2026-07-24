import { createClient } from '@/lib/supabase/server'
import { AdminHeader, StatCard, HelpTip } from '@/components/admin/ui'
import { TIERS, tierMeta, resolveTierKey } from '@/lib/tiers'
import { cardProgressFloored, STAMP_CARD_SIZE } from '@/lib/stamps'

export const dynamic = 'force-dynamic'

/**
 * /admin/loyalty — 멤버십 · 스탬프 현황 (사장님 2026-07-22).
 *
 * 사장님 요청: "스탬프 7개 넘어가는 손님들은 자동으로 필터링돼서 누구누구인지,
 * 어떤 멤버십이 몇 명인지 다 뜨게." → 스탬프 7개 이상만 뽑아 등급별 인원 요약 +
 * 손님 리스트(이름·이메일·등급·현재 판)를 보여준다.
 *
 * # 왜 7개인가
 * 씨앗(첫 등급)이 10개다. 7~9개는 **곧 씨앗이 될 손님**(현재 판을 거의 채운) —
 * 이들을 미리 보이게 해 챙길 수 있게. 10개 이상은 이미 등급이 있는 손님.
 *
 * # 등급 정본 = profiles.tier(ratcheted, 강등 없음). resolveTierKey 로 앱 화면과 일치.
 * stamp_count = 잠긴 것(등급 만든 스탬프) + 살아있는 느슨한 것. 매일 크론이 만료 반영.
 */

const MIN_STAMPS = 7
const LIST_LIMIT = 1000

const KST_DATE = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
function formatDate(iso: string | null): string {
  if (!iso) return '-'
  const parts = KST_DATE.formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}.${get('month')}.${get('day')}`
}

type Row = {
  id: string
  name: string | null
  email: string | null
  tier: string | null
  stamp_count: number | null
  tier_updated_at: string | null
}

export default async function AdminLoyaltyPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, tier, stamp_count, tier_updated_at')
    .gte('stamp_count', MIN_STAMPS)
    .order('stamp_count', { ascending: false })
    .limit(LIST_LIMIT)

  const rows = (data ?? []) as Row[]

  // 등급별 인원 — TIERS 순서(씨앗→나무) + '곧 씨앗'(7~9, 등급 없음) 버킷.
  // 등급 임계가 10개라 tiered 손님은 전부 7+ 리스트에 포함된다.
  const perTier = new Map<string, number>()
  let approaching = 0 // 7~9개, 아직 등급 없음
  for (const r of rows) {
    const key = resolveTierKey(r.tier, r.stamp_count ?? 0)
    if (key == null) approaching += 1
    else perTier.set(key, (perTier.get(key) ?? 0) + 1)
  }
  const tieredTotal = rows.length - approaching

  return (
    <div>
      <AdminHeader
        title="멤버십 · 스탬프"
        sub={`구독 결제 1번 = 도장 1개, 도장 개수로 등급이 올라가요(씨앗 10 ~ 나무 50). 할인은 나무 등급의 매 주문 10%뿐이에요. 도장을 모아가는 손님과 등급별 인원을 여기서 봐요. — 스탬프 ${MIN_STAMPS}개 이상 ${rows.length.toLocaleString()}명 · 등급 보유 ${tieredTotal.toLocaleString()}명`}
      />

      {/* 등급별 인원 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <StatCard
          label={<>곧 씨앗<HelpTip text="스탬프 7~9개 — 아직 등급은 없지만 곧 씨앗(10개)이 될 손님이에요. 현재 판을 거의 채웠어요." /></>}
          value={approaching.toLocaleString()}
          sub="7~9개"
          tone={approaching > 0 ? 'amber' : 'neutral'}
        />
        {TIERS.map((t) => (
          <StatCard
            key={t.key}
            label={`${t.label} (${t.en})`}
            value={(perTier.get(t.key) ?? 0).toLocaleString()}
            sub={`${t.threshold}개~`}
          />
        ))}
      </div>

      {/* 손님 리스트 */}
      <div className="md:p-6 md:rounded-lg md:bg-white md:border md:border-zinc-200">
        {error ? (
          <div>
            <p className="text-sale text-sm">멤버십 정보를 불러오지 못했어요.</p>
            <p className="text-xs text-muted mt-2">
              잠시 후 다시 시도해 주세요. 계속 안 되면 개발 담당에게 알려주세요.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            스탬프 {MIN_STAMPS}개 이상인 손님이 아직 없어요.
          </p>
        ) : (
          <>
            {/* 모바일: 카드 리스트 */}
            <div className="md:hidden space-y-2.5">
              {rows.map((r) => (
                <LoyaltyMobileCard key={r.id} r={r} />
              ))}
            </div>

            {/* 데스크톱: 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-muted border-b border-zinc-200">
                    <th className="text-left py-2 font-medium">이름</th>
                    <th className="text-left py-2 font-medium">이메일</th>
                    <th className="text-center py-2 font-medium">등급</th>
                    <th className="text-right py-2 font-medium">스탬프</th>
                    <th className="text-left py-2 font-medium pl-4">현재 판</th>
                    <th className="text-right py-2 font-medium">등급 갱신</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const sc = r.stamp_count ?? 0
                    const meta = tierMeta(resolveTierKey(r.tier, sc))
                    const card = cardProgressFloored(sc, meta?.threshold ?? 0)
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-zinc-200/50 hover:bg-bg transition"
                      >
                        <td className="py-3 text-ink font-medium">
                          {r.name ?? '(이름 미등록)'}
                        </td>
                        <td className="py-3 text-[11px] text-text">
                          {r.email ?? '-'}
                        </td>
                        <td className="py-3 text-center">
                          <TierPill meta={meta} />
                        </td>
                        <td className="py-3 text-right font-bold text-zinc-900 tabular-nums">
                          {sc}
                        </td>
                        <td className="py-3 pl-4 text-[11px] text-text tabular-nums">
                          {card.cardNumber}판 · {card.filled}/{STAMP_CARD_SIZE}
                        </td>
                        <td className="py-3 text-right text-[11px] text-muted">
                          {formatDate(r.tier_updated_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 p-4 rounded-xl bg-bg border border-zinc-200">
        <p className="text-[11px] text-text leading-relaxed">
          ℹ️ 등급은 <b>한번 올라가면 내려가지 않아요</b>(2026-07-22). 스탬프는 찍힌 날부터
          1년 유효하지만, 등급을 만든 스탬프(판을 완성한 것)는 잠겨서 만료되지 않아요.
          오래 쉬면 현재 판의 스탬프만 빠지고(카드가 비고) 등급은 유지돼요. 만료 반영은
          매일 자동으로 돌아요.
        </p>
      </div>
    </div>
  )
}

function TierPill({ meta }: { meta: ReturnType<typeof tierMeta> }) {
  if (!meta) return <span className="text-[11px] text-muted">곧 씨앗</span>
  return (
    <span
      className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: meta.bg, color: meta.ink }}
    >
      {meta.label}
    </span>
  )
}

function LoyaltyMobileCard({ r }: { r: Row }) {
  const sc = r.stamp_count ?? 0
  const meta = tierMeta(resolveTierKey(r.tier, sc))
  const card = cardProgressFloored(sc, meta?.threshold ?? 0)
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-zinc-900 text-[13px] truncate">
            {r.name ?? '(이름 미등록)'}
          </p>
          <p className="text-[11px] text-zinc-400 truncate">{r.email ?? '-'}</p>
        </div>
        <TierPill meta={meta} />
      </div>
      <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          스탬프 <strong className="text-zinc-800">{sc}개</strong> ·{' '}
          {card.cardNumber}판 {card.filled}/{STAMP_CARD_SIZE}
        </span>
        <span>{formatDate(r.tier_updated_at)} 갱신</span>
      </div>
    </div>
  )
}
