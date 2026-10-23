import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Phone, MessageSquare, User } from 'lucide-react'
import CopyField from '@/components/admin/CopyField'
import { LoadError } from '@/components/admin/ui'
import { weekdayKo } from '@/lib/shipping-schedule'
import { formatKstShortDateTime } from '@/lib/datetime-kst'
import { customerHref } from '@/lib/admin/customer-link'
import NotesPanel from '@/app/admin/users/[id]/NotesPanel'
import type { CustomerData, DogView, SubView } from '@/app/admin/users/[id]/_types'

/**
 * 정기배송 한 장 — 그리기만 (2026-10-24 규칙314). 조회는 고객 화면과 같은 정본(loadCustomerData)이고, 예시 값은
 * design-check-admin/subscription.
 *
 * 사장님 "오늘 구독 주문 들어왔는데 … 어드민에서 보기도 너무너무 불편하고". 새 정기배송 한 건을 보려면 목록 → 고객 화면 →
 * 긴 스크롤(배송지는 8칸 중 7번째)이었다. 폰(390폭) 첫 화면에 **누구·몇 kg·무슨 레시피·얼마·언제 결제→발송**을 다 놓고,
 * 한 번 내리면 받는 곳(전화·문자·복사)과 배송 메모가 나온다. 글씨는 13px 이상.
 * 칸마다 조회 실패를 따로 보인다 — '없음'과 '못 불러옴'을 같게 그리지 않는다(규칙1).
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
    text = `해지됨${sub.cancelledAt ? ` · ${md(sub.cancelledAt)}` : ''}`
    tone = 'off'
  } else if (sub.state === 'needs_card') {
    text = '카드 등록 전 — 결제·발송일은 카드를 등록할 때 잡혀요'
    tone = 'off'
  } else if (!u) {
    text = '다음 발송일 없음'
    tone = 'off'
  } else if (u.kind === 'in_progress') {
    if (u.shipIso < today) {
      text = `결제됨 · ${md(u.shipIso)} 발송일이 지났어요 — 송장을 확인해 주세요`
      tone = 'bad'
    } else {
      text = `결제됨 → ${md(u.shipIso)} 발송 · 조리·포장 차례`
    }
  } else if (u.kind === 'charge_check') {
    text = `${md(u.chargeIso)} 결제가 확인 안 됐어요 — ${md(u.shipIso)} 발송분 박스 보내지 마세요`
    tone = 'bad'
  } else if (sub.state === 'paused') {
    text = `일시정지 중 — 다시 시작하기 전엔 결제·발송 안 해요(원래 ${md(u.shipIso)} 발송)`
    tone = 'warn'
  } else if (sub.state === 'card_failed') {
    text = `카드 결제 실패 — 고객이 카드를 다시 등록해야 ${md(u.shipIso)} 박스가 나가요`
    tone = 'bad'
  } else if (heldNext) {
    text = `${u.chargeIso ? md(u.chargeIso) : ''} 결제 보류 예정 — 서포터즈 인상 동의가 없어요`
    tone = 'bad'
  } else if (u.chargeIso) {
    text = `결제 ${md(u.chargeIso)} 아침 → 발송 ${md(u.shipIso)}`
  } else {
    text = `발송 ${md(u.shipIso)} · 결제일 확인 못 함(서포터즈 정보를 못 읽음)`
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
  const packTotal = box ? box.packs.reduce((n, p) => n + p.count, 0) : 0
  // 하루 양 = 14일치 팩 g 합 ÷ 14(포장 목록·고객 화면과 같은 팩 정본에서).
  const dailyG = box && box.packs.length > 0 ? Math.round(box.packs.reduce((n, p) => n + p.packG * p.count, 0) / 14) : null
  const heldNext = !!data.supporterPlan?.next?.held
  const discounted = sub.chargeAmount != null && sub.chargeAmount !== sub.storedAmount
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

      {e.subs || e.trial ? (
        <div className="mt-3">
          <LoadError what="정기배송 일정" hint="결제일·금액이 틀려 보일 수 있어요 — 새로고침해 주세요." />
        </div>
      ) : (
        <WhenBand sub={sub} heldNext={heldNext} today={data.today} />
      )}

      {/* ── 박스 ── */}
      <Block title={packTotal > 0 ? `박스 · 14일치 ${packTotal}팩` : '박스'} right={box?.cycle != null ? `${box.cycle}회차` : undefined}>
        {e.box || e.surveys ? (
          <LoadError what="박스 구성" hint="팩 구성·알레르기를 못 읽었어요 — 새로고침해 주세요." />
        ) : !box ? (
          <p className="rounded-lg border border-border bg-card p-3 text-[14px] text-muted-foreground">
            {sub.state === 'cancelled' ? '해지된 정기배송이에요.' : '지금 식단(처방)이 없어 박스를 계산하지 않았어요.'}
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
                못 담은 몫 — {box.held.map((h) => `${h.name}(${h.reason})`).join(' · ')}. 포장 목록이 이 박스를 멈춰요.
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

      {/* ── 금액 — 이번에 실제로 결제될 금액 하나를 크게 ── */}
      <Block title={sub.state === 'cancelled' || sub.state === 'needs_card' ? '2주 금액' : '이번에 결제될 금액'}>
        {e.charge_preview ? (
          <LoadError what="이번 결제 금액" hint={`저장된 금액은 ${won(sub.storedAmount)}이에요 — 할인 계산을 못 했어요.`} />
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[26px] font-black tabular-nums">{won(sub.chargeAmount ?? sub.storedAmount)}</span>
              {discounted && (
                <span className="text-[14px] text-muted-foreground">
                  정가 <s>{won(sub.storedAmount)}</s>
                  {/* 서포터즈면 아래 줄(남은 구간)이 같은 말을 더 자세히 한다 — 두 번 말하지 않는다. */}
                  {sub.chargeLabel && !sub.supporterCaption ? ` · ${sub.chargeLabel}` : ''}
                </span>
              )}
            </p>
            <p className="text-[14px] text-muted-foreground">
              {[
                sub.cardLast4 ? `${sub.cardBrand ?? '카드'} 끝 ${sub.cardLast4}` : '카드 없음',
                `받은 박스 ${sub.totalDeliveries}회`,
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
        발송일 바꾸기·일시정지·해지는 정기배송 목록에서, 결제·변경 기록은 고객 전체 보기에서 해요.
      </p>
    </div>
  )
}
