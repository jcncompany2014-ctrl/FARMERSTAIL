import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock, PauseCircle, X } from 'lucide-react'
import { formatKstShortDateTime as formatDateTime } from '@/lib/datetime-kst'
import { Badge } from '@/components/admin/ui'
import { isProblemCharge } from '@/lib/admin/charge-rows'
import { PRICE_RISE_LABEL, type PriceRise } from '@/lib/payments/price-rise'

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

export type ChargeListRow = ChargeRow & { detail: ChargeDetail | null }

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
              <b className="tabular-nums text-[14px] text-foreground">{row.amount.toLocaleString('ko-KR')}원</b>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
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
            <thead className="bg-secondary text-[11px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-bold">시도일</th>
                <th className="px-4 py-2.5 text-left font-bold">상태</th>
                <th className="px-4 py-2.5 text-right font-bold">금액</th>
                <th className="px-4 py-2.5 text-left font-bold">예정일</th>
                <th className="px-4 py-2.5 text-left font-bold">고객 · 사유</th>
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
                    {row.amount.toLocaleString('ko-KR')}원
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.scheduled_for}</td>
                  <td className="px-4 py-3">
                    {isProblemCharge(row.status) ? (
                      <ProblemDetail row={row} />
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
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
  return (
    <section className="rounded-xl border border-red-300 bg-red-50 p-4">
      <p className="flex items-center gap-1.5 text-[14px] font-bold text-red-800">
        <PauseCircle className="h-4 w-4" strokeWidth={2.5} />
        청구 보류 {holds.length}건 — 가격 인상 동의 기록이 없어요
      </p>
      <p className="mt-1 text-[12px] text-red-700">
        동의를 받아 체험단 화면에 기록하면 다음 아침 청구에서 결제돼요. 그 전엔 박스를 보내지 마세요.
      </p>
      <ul className="mt-3 grid gap-2">
        {holds.map((h) => (
          <li key={h.id} className="rounded-lg border border-red-200 bg-card px-3 py-2 text-[12.5px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-foreground">{[h.customerName ?? '(이름 없음)', h.dogName].filter(Boolean).join(' · ')}</b>
              {h.rise && <Badge tone="red">{PRICE_RISE_LABEL[h.rise as PriceRise] ?? h.rise}</Badge>}
            </div>
            <p className="mt-1 text-muted-foreground">
              발송 {h.shipDate} 박스 · 원래 결제일 {h.chargeDate}
              {h.chargeAmount != null && ` · ${h.chargeAmount.toLocaleString('ko-KR')}원`}
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
  )
}
