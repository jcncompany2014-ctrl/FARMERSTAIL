import type { ReactNode } from 'react'
import Link from 'next/link'
import { weekdayKo } from '@/lib/shipping-schedule'
import { formatKstShortDateTime, kstDateOf } from '@/lib/datetime-kst'
import { subscriptionHref } from '@/lib/admin/customer-link'
import { adminDiscountLabel } from '@/lib/commerce/discount-reason'
import type { NewArrivals, NewSubArrival } from '@/lib/admin/new-arrivals'

/**
 * 어드민 홈 맨 위 '새로 들어온 것'(최근 7일) — 그리기만 (2026-10-24 규칙314). 숫자·판정은 lib/admin/new-arrivals.
 * 줄을 누르면 정기배송 한 장(subscriptionHref) — 사장님 폰 알림도 같은 한 장을 연다. 48시간 안이면 '새'.
 * 칸마다 못 읽었으면 '못 봄'을 빨갛게 — 0건으로 접지 않는다(규칙1).
 *
 * 새 정기배송 금액(2026-10-24 어드민 금액 말 정리): 첫 박스가 결제됐으면 '결제함 ○원'을 크게(정가·할인 이름은 작게) +
 * '결제일 결제함 → 발송일 발송', 다음 결제는 넷째 줄 회색. 결제 전이면 '다음 결제 ○원'. 결제가 끝나자 첫 박스 대신 다음
 * 회차 금액이 떠서 78,500원 카드가 128,500원으로 바뀌어 보였다.
 */

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${weekdayKo(iso.slice(0, 10))})`

function Group({ title, count, children, good = false }: { title: string; count: number | null; children: ReactNode; good?: boolean }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className={`mb-1.5 text-[13px] font-bold ${good ? 'text-emerald-700' : 'text-muted-foreground'}`}>
        {title} {count == null ? <span className="text-destructive">확인 못 함</span> : `${count}건`}
      </p>
      {children}
    </div>
  )
}

function Unread() {
  return <p className="rounded-md bg-destructive/5 px-3 py-2 text-[13px] font-semibold text-destructive">불러오지 못했어요 — 없는 게 아니에요. 새로고침해 주세요.</p>
}

/** 다음 결제 한 줄 — '다음 결제 11/7(토) 128,500원'. 결제일을 모르면 날짜 없이(지어내지 않는다). */
function nextChargeText(s: NewSubArrival): string {
  const amount = won(s.chargeAmount ?? s.storedAmount)
  return s.chargeIso ? `다음 결제 ${md(s.chargeIso)} ${amount}` : `다음 결제 ${amount} · 결제일 확인 못 함`
}

export default function NewArrivalsPanel({ data, nowMs }: { data: NewArrivals; nowMs: number }) {
  const fresh = (iso: string | null) => !!iso && nowMs - Date.parse(iso) < 48 * 60 * 60 * 1000
  const subs = data.newSubs
  const brandNew = subs?.filter((s) => !s.reRegistered) ?? null
  const resumed = subs?.filter((s) => s.reRegistered) ?? []
  const nothing =
    !!subs && subs.length === 0 && data.store?.length === 0 && data.failed?.length === 0 && data.cancelled?.length === 0

  return (
    <section className="rounded-xl border-2 border-foreground bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-black tracking-tight">새로 들어온 것</h2>
        <span className="text-[13px] text-muted-foreground">최근 7일 · 시험 계정 제외</span>
      </div>

      {nothing ? (
        <p className="text-[14px] text-muted-foreground">최근 7일 동안 새로 들어온 정기배송·가게 주문이 없고, 결제 실패·해지도 없어요.</p>
      ) : (
        <>
          <Group title="새 정기배송" count={brandNew ? brandNew.length : null}>
            {brandNew == null ? (
              <Unread />
            ) : brandNew.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">없어요</p>
            ) : (
              <ul className="space-y-2">
                {brandNew.map((s) => {
                  const fp = s.firstPaid
                  const nextDiscounted = s.chargeAmount != null && s.chargeAmount !== s.storedAmount
                  return (
                    <li key={s.subscriptionId}>
                      <Link
                        href={subscriptionHref(s.subscriptionId)}
                        className="block rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2.5 shadow-[inset_3px_0_0_rgb(4_120_87)] transition active:bg-emerald-100"
                      >
                        {/* 한 줄: 누구·몇 kg ↔ 결제함(결제 전이면 다음 결제) 금액 / 두 줄: 레시피·단계·정가·할인 이름 ↔ 들어온 시각 /
                            세 줄: 결제 → 발송 / 넷째 줄(결제됐을 때만): 다음 결제 회색 */}
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-[17px] font-black">
                            {s.dogName}
                            {s.weightKg != null && <span className="ml-1 text-[15px] font-bold text-muted-foreground">{s.weightKg}kg</span>}
                            {fresh(s.at) && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 align-[2px] text-[12px] font-black text-white">새</span>}
                          </span>
                          <b className="shrink-0 text-[16px] tabular-nums">
                            {fp ? `결제함 ${won(fp.amount)}` : `다음 결제 ${won(s.chargeAmount ?? s.storedAmount)}`} ›
                          </b>
                        </div>
                        <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[13px]">
                          {/* 줄바꿈 허용 — 정가·할인 이름이 폰 폭에서 '이벤…'으로 잘렸다(2026-10-24 점검) */}
                          <span className="min-w-0 break-keep text-muted-foreground">
                            {[s.recipes, s.freshLabel].filter(Boolean).join(' · ')}
                            {fp ? (
                              fp.discount > 0 ? (
                                <span className="font-semibold text-violet-700">
                                  {' '}
                                  · 정가 {won(fp.list)} · {adminDiscountLabel(fp.reason)}
                                </span>
                              ) : null
                            ) : nextDiscounted ? (
                              <span className="font-semibold text-violet-700">
                                {' '}
                                · 정가 {won(s.storedAmount)} · {adminDiscountLabel(s.chargeReason)}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[12px] text-muted-foreground">{formatKstShortDateTime(s.at)}</span>
                        </div>
                        <p className="mt-1 text-[14px] font-bold">
                          {fp
                            ? `${md(kstDateOf(fp.paidAt))} 결제함 → ${md(fp.shipIso)} 발송`
                            : s.shipIso
                              ? s.chargeIso
                                ? `결제 ${md(s.chargeIso)} → 발송 ${md(s.shipIso)}`
                                : `발송 ${md(s.shipIso)} · 결제일 확인 못 함`
                              : '발송일 없음'}
                        </p>
                        {fp && <p className="mt-0.5 text-[13px] text-muted-foreground">{nextChargeText(s)}</p>}
                        {!fp && s.paidUnknown && (
                          <p className="mt-0.5 text-[13px] font-semibold text-destructive">결제됐는지 확인 못 했어요 — 새로고침해 주세요</p>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Group>

          {/* 결제 실패 뒤 카드를 바꿔 다시 이어진 것 — 좋은 소식이라 초록(2026-10-24 어드민 금액 말 정리). */}
          {resumed.length > 0 && (
            <Group title="카드 바꿔서 다시 이어짐" count={resumed.length} good>
              <ul className="space-y-1">
                {resumed.map((s) => (
                  <li key={s.subscriptionId}>
                    <Link href={subscriptionHref(s.subscriptionId)} className="flex items-baseline justify-between gap-2 rounded-md px-1 py-1 text-[14px] hover:bg-secondary">
                      <span className="min-w-0 truncate">
                        <b>{s.dogName}</b> {s.shipIso ? `· 발송 ${md(s.shipIso)}` : ''}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted-foreground">{formatKstShortDateTime(s.at)} ›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Group>
          )}

          <Group title="새 가게 주문" count={data.store ? data.store.length : null}>
            {data.store == null ? (
              <Unread />
            ) : data.store.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">없어요</p>
            ) : (
              <ul className="space-y-1.5">
                {data.store.map((o) => (
                  <li key={o.orderId}>
                    <Link href={`/admin/orders/${o.orderId}`} className="block rounded-lg border border-border px-3 py-2 hover:border-ring">
                      <div className="flex items-baseline justify-between gap-2 text-[14px]">
                        <b className="min-w-0 truncate">
                          {o.who}
                          {fresh(o.paidAt) && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 align-[2px] text-[12px] font-black text-white">새</span>}
                        </b>
                        <b className="shrink-0 tabular-nums">{won(o.amount)} ›</b>
                      </div>
                      <p className={`text-[13px] ${o.tracked ? 'text-muted-foreground' : 'font-semibold text-amber-800'}`}>
                        {md(o.shipIso)}에 보내요 · {o.tracked ? '송장 넣었어요' : '송장 아직 안 넣었어요'}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Group>

          {(data.failed == null || data.failed.length > 0) && (
            <Group title="결제 실패" count={data.failed ? data.failed.length : null}>
              {data.failed == null ? (
                <Unread />
              ) : (
                <ul className="space-y-1.5">
                  {data.failed.map((f) => (
                    <li key={f.subscriptionId}>
                      <Link
                        href={subscriptionHref(f.subscriptionId)}
                        className="block rounded-lg border border-red-300 bg-red-50/60 px-3 py-2 shadow-[inset_3px_0_0_rgb(185_28_28)]"
                      >
                        <div className="flex items-baseline justify-between gap-2 text-[14px]">
                          <b className="min-w-0 truncate text-red-800">{f.dogName}</b>
                          <span className="shrink-0 text-[12px] text-muted-foreground">{f.at ? formatKstShortDateTime(f.at) : ''} ›</span>
                        </div>
                        <p className="text-[13px] text-red-800 break-keep">{f.reason} — 결제될 때까지 박스는 보내지 마세요</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Group>
          )}

          {(data.cancelled == null || data.cancelled.length > 0) && (
            <Group title="해지" count={data.cancelled ? data.cancelled.length : null}>
              {data.cancelled == null ? (
                <Unread />
              ) : (
                <ul className="space-y-1">
                  {data.cancelled.map((c) => (
                    <li key={c.subscriptionId}>
                      <Link href={subscriptionHref(c.subscriptionId)} className="flex items-baseline justify-between gap-2 rounded-md px-1 py-1 text-[14px] hover:bg-secondary">
                        <b className="min-w-0 truncate">{c.dogName}</b>
                        <span className="shrink-0 text-[12px] text-muted-foreground">{formatKstShortDateTime(c.at)} ›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Group>
          )}
        </>
      )}

      {data.failures.length > 0 && (
        <p className="mt-3 text-[12px] text-destructive">일부 정보를 불러오지 못했어요(새로고침해 주세요): {data.failures.join(' · ')}</p>
      )}
    </section>
  )
}
