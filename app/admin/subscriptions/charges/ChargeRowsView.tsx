import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock, PauseCircle, X } from 'lucide-react'
import { formatKstShortDateTime as formatDateTime } from '@/lib/datetime-kst'
import { Badge } from '@/components/admin/ui'
import { isProblemCharge } from '@/lib/admin/charge-rows'
import { subscriptionHref } from '@/lib/admin/customer-link'
import { HOLD_CLOSE_REASON_LABEL, PRICE_RISE_LABEL, type HoldCloseReason, type PriceRise } from '@/lib/payments/price-rise'

/**
 * 자동결제 이력 목록 — 폰(카드)·넓은 화면(표) 두 모양을 같은 데이터로 그린다(2026-10-14 A2).
 * 서버 컴포넌트에서도 쓰는 순수 표시 부품 — 점검 화면(/design-check-admin-money)이 예시 값으로 같은 부품을 그린다.
 *
 * 실패·보류·결과 불명(pending) 행엔 고객·강아지·카드 끝 4자리·쉬운 말 사유·다음 재시도 시각·'고객 보기'를 붙인다.
 * '고객 보기'는 고객 화면(/admin/users/[id])으로 간다.
 */

export type ChargeRow = {
  id: string
  subscription_id: string
  user_id: string
  scheduled_for: string
  status: 'pending' | 'succeeded' | 'failed' | 'skipped'
  payment_key: string | null
  order_id: string | null
  amount: number
  error_code: string | null
  error_message: string | null
  attempted_at: string
  completed_at: string | null
}

/** 문제 행에 붙는 설명 — 고객 정보 조회가 실패하면 null(행은 그대로 보인다). */
export type ChargeDetail = {
  customerName: string | null
  dogName: string | null
  cardLast4: string | null
  nextRetryAt: string | null
  subStatus: string | null
  /** chargeProblemReason — 쉬운 말 사유. */
  reason: string
}

/** 줄마다 누구 — 강아지·보호자·할인 이름·시험 딱지(2026-10-24 2묶음 2-7). 고객 조회가 실패하면 null. */
export type ChargeWho = { dogName: string | null; customerName: string | null; discount: string | null; test: boolean }

export type ChargeListRow = ChargeRow & { detail: ChargeDetail | null; who: ChargeWho | null }

/** '태리 · 이나현님 · 이벤트 할인 · 시험' 한 줄 — 누르면 정기배송 한 장. */
function WhoLine({ row }: { row: ChargeListRow }) {
  const w = row.who
  if (!w) return <span className="text-[12px] font-semibold text-destructive">누구인지 불러오지 못했어요</span>
  return (
    <Link href={subscriptionHref(row.subscription_id)} className="inline-flex flex-wrap items-center gap-x-1.5 text-[14px] hover:underline">
      <b>{w.dogName ?? '(강아지 미상)'}</b>
      {w.customerName && <span className="text-muted-foreground">· {w.customerName}님</span>}
      {w.discount && <span className="font-semibold text-violet-700">· {w.discount}</span>}
      {w.test && (
        <span className="rounded-full border border-dashed border-slate-400 bg-slate-100 px-1.5 text-[12px] font-bold text-slate-700">시험</span>
      )}
    </Link>
  )
}

export type OpenHold = {
  id: string
  subscriptionId: string
  userId: string
  shipDate: string
  chargeDate: string
  rise: string | null
  chargeAmount: number | null
  listAmount: number | null
  firstHeldAt: string
  customerName: string | null
  dogName: string | null
  /**
   * 더는 맞지 않는 보류(해지·정지·발송일 변경) — 청구 크론의 정리와 같은 판정(lib/payments/price-rise staleHoldReason).
   * 있으면 '보내지 마세요' 무리에서 빼 흐리게(다음 아침 정리 때 닫힌다). 없거나 null = 아직 보류 중.
   */
  stale?: HoldCloseReason | null
}

const STATUS_CONFIG: Record<ChargeRow['status'], { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: '결과 확인 중', color: '#b45309', icon: Clock },
  succeeded: { label: '성공', color: '#047857', icon: CheckCircle2 },
  failed: { label: '실패', color: 'var(--adm-destructive)', icon: AlertTriangle },
  skipped: { label: '건너뜀', color: '#57534e', icon: X },
}

function StatusPill({ status }: { status: ChargeRow['status'] }) {
  const c = STATUS_CONFIG[status]
  const Icon = c.icon
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold"
      style={{ background: c.color, color: 'white' }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {c.label}
    </span>
  )
}

/**
 * 금액 칸 — 성공한 시도만 '결제한 금액'이다(2026-10-24 어드민 금액 말 정리). 실패·건너뜀은 받지 못한 돈이라 흐리게
 * '못 받은 금액', 결과 확인 중은 받았는지 아직 모르니 '확인 중'. 폰 카드엔 칸 이름이 없어 성공에 '결제함'을 붙인다.
 */
function ChargeAmount({ row, layout }: { row: ChargeRow; layout: 'card' | 'table' }) {
  const won = `${row.amount.toLocaleString('ko-KR')}원`
  if (row.status === 'succeeded') {
    return layout === 'card' ? <b className="tabular-nums text-[14px] text-foreground">결제함 {won}</b> : <>{won}</>
  }
  return (
    <span className="tabular-nums text-[12px] text-muted-foreground">
      {row.status === 'pending' ? '확인 중' : '못 받은 금액'} {won}
    </span>
  )
}

function who(d: ChargeDetail | null): string {
  if (!d) return '고객 정보를 불러오지 못했어요'
  return [d.customerName ?? '(이름 없음)', d.dogName].filter(Boolean).join(' · ')
}

/** 문제 행 아래 붙는 설명 — 카드·표 둘 다 같은 내용. */
function ProblemDetail({ row }: { row: ChargeListRow }) {
  const d = row.detail
  return (
    <div className="grid gap-1 text-[12px]">
      <p className="font-bold text-foreground">{who(d)}</p>
      {d && <p className="text-foreground">{d.reason}</p>}
      <p className="text-muted-foreground">
        {d?.cardLast4 ? `카드 끝 ${d.cardLast4}` : '카드 정보 없음'}
        {' · '}
        {d?.nextRetryAt
          ? `다음 재시도 ${formatDateTime(d.nextRetryAt)}`
          : d?.subStatus === 'paused'
            ? '정기배송 일시정지 — 카드를 다시 등록하면 다시 시작돼요'
            : row.status === 'pending'
              ? '다음 실행(아침 9:10)에서 확인'
              : '자동 재시도 예정 없음'}
      </p>
      {/* 고객 화면(C 갈래가 만든다) — 링크만. */}
      <Link href={`/admin/users/${row.user_id}`} className="w-fit font-bold text-primary underline underline-offset-2">
        고객 보기 →
      </Link>
    </div>
  )
}

export function ChargeRowsView({ rows, loadFailed }: { rows: ChargeListRow[]; loadFailed: boolean }) {
  if (loadFailed) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-[13px] font-bold text-destructive">
        결제 이력을 불러오지 못했어요 — 새로고침해 주세요 (없는 게 아니라 조회 실패예요)
      </p>
    )
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-[13px] text-muted-foreground">
        결과가 없어요
      </p>
    )
  }
  return (
    <>
      {/* 폰 — 카드 목록(표는 가로로 넘쳐 오른쪽 칸이 안 보인다). */}
      <ul className="grid gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`rounded-xl border bg-card p-3 shadow-sm ${isProblemCharge(row.status) ? 'border-red-200' : 'border-border'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusPill status={row.status} />
              <ChargeAmount row={row} layout="card" />
            </div>
            <div className="mt-1.5">
              <WhoLine row={row} />
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {formatDateTime(row.attempted_at)} 시도 · 예정일 {row.scheduled_for}
            </p>
            {isProblemCharge(row.status) && (
              <div className="mt-2 border-t border-border pt-2">
                <ProblemDetail row={row} />
              </div>
            )}
            {row.order_id && (
              <Link href={`/admin/orders/${row.order_id}`} className="mt-2 inline-block text-[12px] text-primary hover:underline">
                주문 보기 →
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* 넓은 화면 — 표. */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="bg-secondary text-[12px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-bold">시도일</th>
                <th className="px-4 py-2.5 text-left font-bold">상태</th>
                <th className="px-4 py-2.5 text-right font-bold">결제한 금액</th>
                <th className="px-4 py-2.5 text-left font-bold">예정일</th>
                <th className="px-4 py-2.5 text-left font-bold">누구 · 사유</th>
                <th className="px-4 py-2.5 text-left font-bold">주문</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border align-top hover:bg-secondary/40">
                  <td className="whitespace-nowrap px-4 py-3 text-foreground">{formatDateTime(row.attempted_at)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums">
                    <ChargeAmount row={row} layout="table" />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.scheduled_for}</td>
                  <td className="px-4 py-3">
                    <WhoLine row={row} />
                    {isProblemCharge(row.status) && (
                      <div className="mt-1">
                        <ProblemDetail row={row} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.order_id ? (
                      <Link href={`/admin/orders/${row.order_id}`} className="text-[12px] text-primary hover:underline">
                        주문 보기 →
                      </Link>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/** 인상 동의가 없어 청구 크론이 보류한 회차 — subscription_charge_holds 의 열린 행. */
export function OpenHoldsView({ holds, loadFailed }: { holds: OpenHold[]; loadFailed: boolean }) {
  if (loadFailed) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] font-bold text-red-700">
        보류 중인 회차를 불러오지 못했어요 — 없는 게 아니라 조회 실패예요. 새로고침해 주세요.
      </p>
    )
  }
  if (holds.length === 0) return null
  // 해지·정지·발송일이 바뀐 보류는 '보내지 마세요' 무리가 아니다 — 따로 흐리게(다음 아침 청구 크론 정리가 닫는다, 규칙262).
  const live = holds.filter((h) => !h.stale)
  const stale = holds.filter((h) => !!h.stale)
  return (
    <div className="grid gap-3">
      {live.length > 0 && (
        <section className="rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="flex items-center gap-1.5 text-[14px] font-bold text-red-800">
            <PauseCircle className="h-4 w-4" strokeWidth={2.5} />
            청구 보류 {live.length}건 — 가격 인상 동의 기록이 없어요
          </p>
          <p className="mt-1 text-[12px] text-red-700">
            동의를 받아 체험단 화면에 기록하면 다음 아침 청구에서 결제돼요. 그 전엔 박스를 보내지 마세요.
          </p>
          <ul className="mt-3 grid gap-2">
            {live.map((h) => (
              <li key={h.id} className="rounded-lg border border-red-200 bg-card px-3 py-2 text-[12.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-foreground">{[h.customerName ?? '(이름 없음)', h.dogName].filter(Boolean).join(' · ')}</b>
                  {h.rise && <Badge tone="red">{PRICE_RISE_LABEL[h.rise as PriceRise] ?? h.rise}</Badge>}
                </div>
                <p className="mt-1 text-muted-foreground">
                  발송 {h.shipDate} 박스 · 원래 결제일 {h.chargeDate}
                  {/* 이름 없는 금액 금지(2026-10-24 어드민 금액 말 정리) — 보류 회차는 동의가 기록돼야 결제된다. */}
                  {h.chargeAmount != null && ` · 동의하면 결제될 금액 ${h.chargeAmount.toLocaleString('ko-KR')}원`}
                  {' · '}보류 시작 {formatDateTime(h.firstHeldAt)}
                </p>
                <div className="mt-1 flex gap-3">
                  <Link href="/admin/trials" className="font-bold text-primary underline underline-offset-2">
                    동의 기록하러 가기 →
                  </Link>
                  <Link href={`/admin/users/${h.userId}`} className="font-bold text-primary underline underline-offset-2">
                    고객 보기 →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {stale.length > 0 && (
        <section className="rounded-xl border border-border bg-secondary p-4">
          <p className="text-[13px] font-bold text-foreground">정리 예정 보류 {stale.length}건 — 이 날짜 회차는 더는 보류 대상이 아니에요</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            해지·일시정지·발송일 변경으로 이 날짜 회차는 청구되지 않아요(발송일을 바꿨으면 새 날짜에서 다시 판정해요). 다음 아침
            자동결제 때 자동으로 닫혀요.
          </p>
          <ul className="mt-2 grid gap-1.5">
            {stale.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                <span>
                  {[h.customerName ?? '(이름 없음)', h.dogName].filter(Boolean).join(' · ')} · 발송 {h.shipDate} 박스
                </span>
                <Badge tone="neutral">{h.stale ? HOLD_CLOSE_REASON_LABEL[h.stale] : ''}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
