import Link from 'next/link'
import { weekdayKo } from '@/lib/shipping-schedule'
import { groupRoundsByChargeDate } from '@/lib/payments/charge-projection'
import { PRICE_PHASE_LABEL, PRICE_RISE_LABEL } from '@/lib/payments/price-rise'
import type { UpcomingRound } from '@/lib/admin/upcoming-charges'

/**
 * 다가오는 결제 — 결제일별 **실제 나갈 금액**과 정가(2026-10-14 A2). 서버 컴포넌트에서도 쓰는 표시 부품 —
 * 점검 화면(/design-check-admin-money)이 예시 값으로 같은 부품을 그린다.
 *
 * 금액은 lib/admin/upcoming-charges(청구와 같은 함수)가 낸 값 그대로 — 여기서 다시 계산하지 않는다.
 * 합계는 실제 금액. 인상 동의가 없어 보류될 회차는 빨간색 '보류 예정'으로 보이고 합계에서 빠진다.
 */

function md(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${weekdayKo(iso)})`
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export default function UpcomingChargesView({
  rounds,
  days,
  error,
}: {
  rounds: UpcomingRound[]
  /** 며칠 앞까지 봤는지 — 제목용. */
  days: number
  error: string | null
}) {
  const groups = groupRoundsByChargeDate(rounds)
  const chargeTotal = groups.reduce((s, g) => s + g.chargeTotal, 0)
  const listTotal = groups.reduce((s, g) => s + g.listTotal, 0)
  const heldCount = groups.reduce((s, g) => s + g.heldCount, 0)
  const count = rounds.length - heldCount

  return (
    <section id="upcoming" className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-foreground">다가오는 결제 · {Math.round(days / 7)}주</h2>
        {!error && (
          <p className="text-[12px] text-muted-foreground">
            {count}건 · 실제 <b className="text-[14px] text-foreground tabular-nums">{won(chargeTotal)}</b>
            {listTotal !== chargeTotal && <span> (정가 {won(listTotal)})</span>}
            {heldCount > 0 && <span className="font-bold text-red-700"> · 보류 예정 {heldCount}건</span>}
          </p>
        )}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        결제일마다 카드에서 <b className="text-foreground">실제로 나갈 금액</b>이에요 — 서포터즈 100원은 100원, 등급·이벤트 할인은 뺀 값.
        원치 않는 결제가 보이면 그 전에 정기배송을 미루거나 멈춰 주세요.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
          다가오는 결제를 불러오지 못했어요 — 결제가 없는 게 아니라 조회 실패예요. 새로고침해 주세요.
        </p>
      ) : groups.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">이 기간에 나갈 결제가 없어요.</p>
      ) : (
        <ol className="mt-3 grid gap-3">
          {groups.map((g) => (
            <li key={g.chargeIso} className="rounded-lg border border-border">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
                <b className="text-[13px] text-foreground">💳 {md(g.chargeIso)}</b>
                <span className="text-[12px] text-muted-foreground">
                  {g.rounds.length - g.heldCount}건 · <b className="text-foreground tabular-nums">{won(g.chargeTotal)}</b>
                  {g.listTotal !== g.chargeTotal && ` (정가 ${won(g.listTotal)})`}
                </span>
              </div>
              <ul>
                {g.rounds.map((r) => (
                  <li
                    key={`${r.subId}-${r.shipIso}`}
                    className={`flex items-start justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0 ${r.held ? 'bg-red-50' : ''}`}
                  >
                    <span className="min-w-0 flex-1 text-[13px]">
                      <b className="text-foreground">{r.customerName ?? '(이름 없음)'}</b>
                      {r.dogName && <span className="text-muted-foreground"> · {r.dogName}</span>}
                      <span className="block text-[12px] text-muted-foreground">
                        발송 {md(r.shipIso)} · {r.label ?? PRICE_PHASE_LABEL[r.phase]}
                        {r.late && ' · 결제일 지남(다시 시도)'}
                      </span>
                      {r.held && r.rise && (
                        <span className="block text-[12px] font-bold text-red-700">
                          {PRICE_RISE_LABEL[r.rise]} 인상 동의 없음 — 보류 예정(청구 안 됨) ·{' '}
                          <Link href="/admin/trials" className="underline underline-offset-2">
                            동의 기록
                          </Link>
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <b className={`tabular-nums text-[14px] ${r.held ? 'text-red-700 line-through' : 'text-foreground'}`}>
                        {won(r.chargeAmount)}
                      </b>
                      {r.chargeAmount !== r.listAmount && (
                        <span className="block text-[11px] text-muted-foreground line-through">{won(r.listAmount)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
