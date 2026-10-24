import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Phone, MessageSquare, User } from 'lucide-react'
import CopyField from '@/components/admin/CopyField'
import { LoadError } from '@/components/admin/ui'
import { weekdayKo } from '@/lib/shipping-schedule'
import { formatKstShortDateTime, kstDateOf } from '@/lib/datetime-kst'
import { customerHref } from '@/lib/admin/customer-link'
import { adminDiscountLabel } from '@/lib/commerce/discount-reason'
import NotesPanel from '@/app/admin/users/[id]/NotesPanel'
import type { CustomerData, DogView, PaidBoxView, SubView } from '@/app/admin/users/[id]/_types'

/**
 * 정기배송 한 장 — 그리기만 (2026-10-24 규칙314). 조회는 고객 화면과 같은 정본(loadCustomerData)이고, 예시 값은
 * design-check-admin/subscription.
 *
 * 사장님 "오늘 구독 주문 들어왔는데 … 어드민에서 보기도 너무너무 불편하고". 새 정기배송 한 건을 보려면 목록 → 고객 화면 →
 * 긴 스크롤(배송지는 8칸 중 7번째)이었다. 폰(390폭) 첫 화면에 **누구·몇 kg·무슨 레시피·얼마·언제 결제→발송**을 다 놓고,
 * 한 번 내리면 받는 곳(전화·문자·복사)과 배송 메모가 나온다. 글씨는 13px 이상.
 * 칸마다 조회 실패를 따로 보인다 — '없음'과 '못 불러옴'을 같게 그리지 않는다(규칙1).
 *
 * 금액 칸은 둘(2026-10-24 어드민 금액 말 정리 — 사장님 "실결제 내역이랑 주문 내역 가격이 달라"). 맨 위 띠는 '결제 완료 ·
 * 10/27 발송'인데 바로 밑 '이번' 금액 칸에 11/7 결제분 128,500원이 떠서, 이미 낸 78,500원이 안 보였다.
 *  ① 이번 박스 — 결제됐고 아직 안 나간 박스(주문 표 값 그대로): 결제한 금액 · 정가 · 할인 이름 −금액 · 주문 보기.
 *  ② 다음 결제 · 날짜 — 청구와 같은 함수(resolveAutoDiscount)로 낸 금액. 해지·카드 등록 전은 '정가(2주)'.
 */

const won = (n: number | null | undefined) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '—')

function md(iso: string): string {
  const d = iso.slice(0, 10)
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${weekdayKo(d)})`
}

/** 전화 링크용 숫자만(010-1234-5678 → 01012345678). */
const telDigits = (p: string) => p.replace(/[^0-9+]/g, '')

const TONE_CLS: Record<string, string> = {
  on: 'bg-emerald-100 text-emerald-800',
  wait: 'bg-amber-100 text-amber-800',
  bad: 'bg-red-100 text-red-700',
  off: 'bg-secondary text-muted-foreground',
}

/** 결제 → 발송 띠 — 이 정기배송이 지금 어디쯤인지 한 줄. 색은 할 일의 급함(초록 = 그대로 두면 됨 · 빨강 = 손봐야 함). */
function WhenBand({ sub, heldNext, today }: { sub: SubView; heldNext: boolean; today: string }) {
  const u = sub.upcoming
  let text: ReactNode
  let tone: 'ok' | 'warn' | 'bad' | 'off' = 'ok'
  if (sub.state === 'cancelled') {
    text = `해지됨${sub.cancelledAt ? ` · ${md(kstDateOf(sub.cancelledAt))}` : ''}`
    tone = 'off'
  } else if (sub.state === 'needs_card') {
    text = '아직 카드 등록 전이에요 — 카드를 등록하면 결제일·발송일이 정해져요'
    tone = 'off'
  } else if (!u) {
    text = '다음 발송일 없음'
    tone = 'off'
  } else if (u.kind === 'in_progress') {
    // 결제된 박스 문구 하나 — '결제됨 · ○/○(화) 발송'(2026-10-24 어드민 금액 말 정리, 기획서 상태 배지 표와 같게).
    if (u.shipIso < today) {
      text = `결제됨 · ${md(u.shipIso)} 발송일이 지났어요 — 보냈는지(송장) 확인해 주세요`
      tone = 'bad'
    } else {
      text = `결제됨 · ${md(u.shipIso)} 발송`
    }
  } else if (u.kind === 'charge_check') {
    text = `${md(u.chargeIso)} 결제가 아직 안 됐어요 — ${md(u.shipIso)} 박스는 보내지 마세요`
    tone = 'bad'
  } else if (sub.state === 'paused') {
    text = '일시정지 중이에요 — 다시 시작할 때까지 결제도 발송도 안 해요'
    tone = 'warn'
  } else if (sub.state === 'card_failed') {
    text = `카드 결제가 실패했어요 — 고객이 카드를 다시 등록해야 ${md(u.shipIso)} 박스를 보낼 수 있어요`
    tone = 'bad'
  } else if (heldNext) {
    text = `서포터즈 가격이 오르는 회차인데 고객 동의가 없어요 — ${u.chargeIso ? `${md(u.chargeIso)} ` : ''}결제를 하지 않아요`
    tone = 'bad'
  } else if (u.chargeIso) {
    text = `결제 ${md(u.chargeIso)} 아침 → 발송 ${md(u.shipIso)}`
  } else {
    text = `${md(u.shipIso)}에 보내요 · 결제일은 확인 못 했어요(새로고침해 주세요)`
    tone = 'warn'
  }
  const cls =
    tone === 'bad'
      ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
        : tone === 'off'
          ? 'bg-secondary text-muted-foreground'
          : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
  return <p className={`mt-3 rounded-lg px-3 py-2.5 text-[15px] font-bold leading-snug break-keep ${cls}`}>{text}</p>
}

function Block({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-bold text-muted-foreground">{title}</h2>
        {right != null && <span className="text-[13px] text-muted-foreground">{right}</span>}
      </div>
      {children}
    </section>
  )
}

function Allergy({ dog }: { dog: DogView }) {
  const s = dog.survey
  if (!s) return <span className="text-muted-foreground">설문 없음</span>
  if (s.allergies === null) return <span className="text-muted-foreground">설문에 답 없음(모름)</span>
  if (s.allergies.length === 0) return <span className="text-emerald-700">없다고 답함</span>
  return <span className="font-bold text-red-700">{s.allergies.join(', ')}</span>
}

/** ① 이번 박스 — 이미 결제한 금액을 크게, 정가·할인 이름은 작게, 주문으로 가는 길. 값은 주문 표 그대로(다시 계산하지 않는다). */
function PaidBoxCard({ pb }: { pb: PaidBoxView }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[26px] font-black tabular-nums">{won(pb.amount)}</span>
        <span className="text-[14px] font-bold text-emerald-800">결제함 {md(kstDateOf(pb.paidAt))}</span>
      </p>
      <p className="text-[14px] text-muted-foreground break-keep">
        {pb.discountAmount > 0 ? (
          <>
            정가 <s>{won(pb.list)}</s> ·{' '}
            <span className="font-semibold text-violet-700">
              {adminDiscountLabel(pb.discountReason)} −{won(pb.discountAmount)}
            </span>
          </>
        ) : (
          `정가 ${won(pb.list)} · 할인 없음`
        )}
      </p>
      <Link
        href={`/admin/orders/${encodeURIComponent(pb.orderId)}`}
        className="mt-1.5 inline-block text-[14px] font-bold text-primary underline-offset-2 hover:underline"
      >
        주문 보기 → <span className="font-normal text-muted-foreground">{pb.orderNumber}</span>
      </Link>
    </div>
  )
}

/** ② 다음 결제 제목 — 날짜를 같이 쓴다. 날짜를 정할 수 없으면 왜 없는지 한 줄로(결제일을 지어내지 않는다). */
function nextChargeTitle(sub: SubView, today: string): string {
  if (sub.state === 'cancelled' || sub.state === 'needs_card') return '정가(2주)'
  if (sub.nextChargeIso) {
    return sub.nextChargeIso < today
      ? `다음 결제 · ${md(sub.nextChargeIso)} — 결제일이 지났는데 아직 안 됐어요`
      : `다음 결제 · ${md(sub.nextChargeIso)} 아침`
  }
  if (sub.state === 'paused') return '다음 결제 · 다시 시작하면 정해져요'
  if (sub.state === 'card_failed') return '다음 결제 · 카드를 다시 등록하면 정해져요'
  if (!sub.timingKnown) return '다음 결제 · 날짜 확인 못 함'
  return '다음 결제'
}

export default function SubscriptionSheet({
  data,
  sub,
  dog,
  isTest = false,
  isNew = false,
  demo = false,
}: {
  data: CustomerData
  sub: SubView
  /** 이 정기배송의 강아지 — 강아지가 지워졌으면 null. */
  dog: DogView | null
  /** 시험 계정(사장님·푸린네) — 맨 위에 딱지(규칙313). */
  isTest?: boolean
  /** 신청 48시간 안 — '새' 배지(서버가 지금 시각으로 판정해 넘긴다). */
  isNew?: boolean
  /** 디자인 점검 화면 — 버튼은 보이되 저장하지 않는다. */
  demo?: boolean
}) {
  const e = data.errors
  const box = dog?.box ?? null
  // 하루 양 = 14일치 팩 g 합 ÷ 14(포장 목록·고객 화면과 같은 팩 정본에서).
  const dailyG = box && box.packs.length > 0 ? Math.round(box.packs.reduce((n, p) => n + p.packG * p.count, 0) / 14) : null
  const heldNext = !!data.supporterPlan?.next?.held
  const discounted = sub.chargeAmount != null && sub.chargeAmount !== sub.storedAmount
  const pb = sub.paidBox ?? null
  // 다음 결제 할인 이름 — 어드민 이름표(adminDiscountLabel). 예시 값이 이유를 안 주면 고객용 이름으로.
  const nextDiscountName = !discounted ? null : sub.chargeReason !== undefined ? adminDiscountLabel(sub.chargeReason) : sub.chargeLabel
  // 첫 박스 한 번만 붙는 할인(이벤트·이웃)이 이번 박스에서 쓰여 다음 결제가 정가로 돌아갔으면 한 줄로 알린다
  // — 78,500원 다음에 128,500원이 나오면 '왜 올랐지'로 읽힌다.
  const oneTimeEnded =
    !!pb &&
    pb.discountAmount > 0 &&
    (pb.discountReason === 'promotion' || pb.discountReason === 'neighbor') &&
    sub.chargeAmount != null &&
    sub.chargeAmount === sub.storedAmount
  const ship = data.address.current
  const deleted = !!data.profile.deletedAt
  const who = data.profile.name || ship?.name || '보호자'

  return (
    <div className="mx-auto max-w-[640px] text-foreground">
      <Link href="/admin/subscriptions" className="inline-flex items-center gap-1 text-[14px] font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" strokeWidth={2.2} /> 정기배송
      </Link>

      {/* ── 머리: 강아지·몸무게·상태 ── */}
      <div className="mt-2 flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-[26px] font-black leading-tight tracking-tight break-keep">
          {sub.dogName}
          {dog?.weightKg != null && <span className="ml-1.5 text-[22px] font-bold text-muted-foreground">{dog.weightKg}kg</span>}
        </h1>
        <span className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${TONE_CLS[sub.tone] ?? TONE_CLS.off}`}>{sub.stateLabel}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] text-muted-foreground">
        {isTest && <span className="rounded border border-dashed border-slate-400 bg-slate-100 px-1.5 text-[13px] font-bold text-slate-700">시험</span>}
        <span>{[dog?.breed, dog?.ageLabel, who].filter(Boolean).join(' · ')}</span>
        <span>· 신청 {formatKstShortDateTime(sub.createdAt)}</span>
        {isNew && <span className="rounded-full bg-red-600 px-2 text-[12px] font-black text-white">새</span>}
      </p>

      {/* 결제된 박스를 못 읽으면 띠가 다음 회차를 이번 박스처럼 말한다 — 같이 '못 불러옴'으로. */}
      {e.subs || e.trial || e.paid_box ? (
        <div className="mt-3">
          <LoadError what="정기배송 일정" hint="결제일·금액이 틀려 보일 수 있어요 — 새로고침해 주세요." />
        </div>
      ) : (
        <WhenBand sub={sub} heldNext={heldNext} today={data.today} />
      )}

      {/* ── 박스 ── */}
      <Block title="박스 · 14일치" right={box?.cycle != null ? `${box.cycle}번째 식단` : undefined}>
        {e.box || e.surveys ? (
          <LoadError what="박스 구성" hint="팩 구성·알레르기를 못 읽었어요 — 새로고침해 주세요." />
        ) : !box ? (
          <p className="rounded-lg border border-border bg-card p-3 text-[14px] text-muted-foreground">
            {sub.state === 'cancelled' ? '해지된 정기배송이에요.' : '아직 정해진 식단이 없어서 박스 구성을 보여 드릴 수 없어요.'}
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-card p-3">
            {box.packs.length > 0 ? (
              <ul className="divide-y divide-border/70">
                {box.packs.map((p) => (
                  <li key={p.name} className="flex items-baseline justify-between gap-2 py-1.5 text-[15px]">
                    <b className="min-w-0 break-keep">{p.name}</b>
                    <span className="shrink-0 tabular-nums">
                      {p.packG}g × {p.count}팩
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted-foreground">{box.note ?? '담을 팩이 없어요'}</p>
            )}
            {box.held.length > 0 && (
              <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-[14px] font-bold text-red-700 break-keep">
                넣지 못한 레시피가 있어요 — {box.held.map((h) => `${h.name}(${h.reason})`).join(' · ')}. 이 박스는 포장 목록에서 멈춰 있어요.
              </p>
            )}
            <p className="mt-2 text-[14px] text-muted-foreground break-keep">
              {[
                dailyG != null ? `하루 ${dailyG}g` : null,
                box.freshLabel + (box.freshRatio != null ? `(화식 ${box.freshRatio}%)` : ''),
                `하루 ${box.dailyKcal.toLocaleString('ko-KR')}kcal`,
                box.recipe.length > 0 ? box.recipe.map((r) => `${r.name} ${r.pct}%`).join(' + ') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {dog && (
              <p className="mt-1 text-[14px]">
                <span className="text-muted-foreground">알레르기 </span>
                <Allergy dog={dog} />
                {dog.survey?.chronic && dog.survey.chronic.length > 0 && (
                  <>
                    <span className="text-muted-foreground"> · 기저질환 </span>
                    <b>{dog.survey.chronic.join(', ')}</b>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </Block>

      {/* ── 금액 ① 이번 박스(이미 결제함) — 결제된 박스가 있을 때만 ── */}
      {e.paid_box ? (
        <Block title="이번 박스">
          <LoadError what="이번 박스 결제" hint="결제된 박스를 확인하지 못했어요 — 이미 낸 금액이 안 보일 수 있어요. 새로고침해 주세요." />
        </Block>
      ) : (
        pb && (
          <Block title={`이번 박스 · ${md(pb.shipIso)} 발송`}>
            <PaidBoxCard pb={pb} />
          </Block>
        )
      )}

      {/* ── 금액 ② 다음 결제 · 날짜 — 청구와 같은 함수로 낸 금액(해지·카드 등록 전은 정가) ── */}
      <Block title={nextChargeTitle(sub, data.today)}>
        {e.charge_preview ? (
          <LoadError what="다음 결제 금액" hint={`할인을 계산하지 못했어요. 정가는 ${won(sub.storedAmount)}이에요.`} />
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className={`${pb ? 'text-[22px]' : 'text-[26px]'} font-black tabular-nums`}>{won(sub.chargeAmount ?? sub.storedAmount)}</span>
              {discounted && (
                <span className="text-[14px] text-muted-foreground">
                  정가 <s>{won(sub.storedAmount)}</s>
                  {/* 서포터즈면 아래 줄(남은 구간)이 같은 말을 더 자세히 한다 — 두 번 말하지 않는다. */}
                  {nextDiscountName && !sub.supporterCaption
                    ? ` · ${nextDiscountName} −${won(sub.storedAmount - (sub.chargeAmount ?? sub.storedAmount))}`
                    : ''}
                </span>
              )}
            </p>
            {oneTimeEnded && pb && (
              <p className="text-[14px] text-muted-foreground break-keep">
                {adminDiscountLabel(pb.discountReason)}은 첫 박스만이라 다음부터 정가예요
              </p>
            )}
            <p className="text-[14px] text-muted-foreground">
              {[
                sub.cardLast4 ? `${sub.cardBrand ?? '카드'} 끝 ${sub.cardLast4}` : '카드 없음',
                `결제된 박스 ${sub.totalDeliveries}회`,
                sub.supporterCaption,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {sub.state === 'card_failed' && sub.lastFailReason && (
              <p className="mt-1 text-[14px] font-bold text-red-700">마지막 실패: {sub.lastFailReason}</p>
            )}
          </>
        )}
      </Block>

      {/* ── 받는 곳 — 전화·문자·복사 ── */}
      <Block title="받는 곳">
        {e.address ? (
          <LoadError what="배송지" />
        ) : !ship ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[14px] font-bold text-red-700">배송지가 비어 있어요 — 고객 화면에서 넣어 주세요.</p>
        ) : (
          <div className="rounded-lg border border-border bg-card p-3 text-[15px]">
            <p>
              <b>{ship.name}</b> · <span className="tabular-nums">{ship.phone}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={`tel:${telDigits(ship.phone)}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-[14px] font-bold text-background"
              >
                <Phone className="size-4" strokeWidth={2.4} /> 전화
              </a>
              <a
                href={`sms:${telDigits(ship.phone)}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[14px] font-bold"
              >
                <MessageSquare className="size-4" strokeWidth={2.4} /> 문자
              </a>
              <CopyField value={ship.phone} label="번호 복사" className="h-10 rounded-full border border-border px-4 text-[14px] font-bold" />
            </div>
            <p className="mt-3 break-keep">
              ({ship.zip}) {ship.address}
              {ship.addressDetail ? `, ${ship.addressDetail}` : ''}
            </p>
            <div className="mt-2">
              <CopyField
                value={`${ship.address}${ship.addressDetail ? ` ${ship.addressDetail}` : ''}`}
                label="주소 복사"
                className="h-10 rounded-full border border-border px-4 text-[14px] font-bold"
              />
            </div>
            {sub.deliveryMemo !== undefined && (
              <p className="mt-3 text-[14px]">
                <span className="text-muted-foreground">배송 메모 </span>
                {sub.deliveryMemo ? <b className="break-keep">{sub.deliveryMemo}</b> : <span className="text-muted-foreground">없음</span>}
              </p>
            )}
          </div>
        )}
      </Block>

      {/* ── 운영 메모 ── */}
      <Block title="운영 메모">
        {e.notes ? (
          <LoadError what="운영 메모" />
        ) : (
          <NotesPanel userId={data.userId} notes={data.notes} today={data.today} demo={demo} readOnly={deleted} />
        )}
      </Block>

      {/* ── 다음 할 것 ── */}
      <div className="mt-6 flex flex-wrap gap-2">
        {!deleted && (
          <Link
            href={`/admin/users/${encodeURIComponent(data.userId)}/message`}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[14px] font-bold text-primary-foreground"
          >
            <MessageCircle className="size-4" strokeWidth={2.4} /> 1:1 메시지
          </Link>
        )}
        <Link
          href={customerHref(data.userId)}
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border px-5 text-[14px] font-bold"
        >
          <User className="size-4" strokeWidth={2.4} /> 고객 전체 보기
        </Link>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground break-keep">
        발송일 바꾸기·일시정지·해지는 정기배송 목록에서 할 수 있어요. 결제 기록은 &lsquo;고객 전체 보기&rsquo;에 있어요.
      </p>
    </div>
  )
}
