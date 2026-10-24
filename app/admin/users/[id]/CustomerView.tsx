import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  BellOff,
  ClipboardList,
  CreditCard,
  History,
  Mail,
  MessageCircle,
  PawPrint,
  Repeat,
  Smartphone,
  Truck,
} from 'lucide-react'
import { LoadError } from '@/components/admin/ui'
import { CUSTOMER_FLAG_HINT, CUSTOMER_FLAG_LABEL, type CustomerFlagKey } from '@/lib/admin/customer-flags'
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus, type PaymentStatus } from '@/lib/commerce/order-fsm'
import { weekdayKo, type UpcomingBox } from '@/lib/shipping-schedule'
import { formatKstDate, formatKstShortDateTime } from '@/lib/datetime-kst'
import AdminNoteCard from './message/AdminNoteCard'
import NotesPanel from './NotesPanel'
import AddressEditor from './AddressEditor'
import AllergyEditor from './AllergyEditor'
import { subscriptionHref } from '@/lib/admin/customer-link'
import { adminDiscountLabel } from '@/lib/commerce/discount-reason'
import type { CustomerData, DogView, SectionKey, SubView } from './_types'

/**
 * 어드민 고객 한 명 화면 — 그리기만(2026-10-14 C1, 규칙253). 조회는 _data.ts(서버), 예시 값은 design-check-admin.
 *
 * 폰으로 운영한다(390폭) — 한 줄 세로 흐름에 급한 것부터: 챙길 신호 → 정기배송(다음 발송·실제 나갈 금액) →
 * 강아지(알레르기·박스) → 문의 기록 → 변경 기록 → 결제·주문 → 배송지 → 알림·1:1 문의. 넓은 화면은 두 줄.
 * 칸마다 조회 실패를 따로 보인다 — '없음'과 '못 불러옴'을 같게 그리지 않는다(규칙1).
 */

const won = (n: number | null | undefined) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '—')

function dayLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  const [, m, dd] = d.split('-')
  return `${Number(m)}/${Number(dd)}(${weekdayKo(d)})`
}

const TONE_CLS: Record<string, string> = {
  on: 'bg-emerald-100 text-emerald-800',
  wait: 'bg-amber-100 text-amber-800',
  bad: 'bg-red-100 text-red-700',
  off: 'bg-secondary text-muted-foreground',
}

const FLAG_ICON: Record<CustomerFlagKey, ReactNode> = {
  card_renewal: <CreditCard className="size-4" strokeWidth={2.2} />,
  old_app: <Smartphone className="size-4" strokeWidth={2.2} />,
  no_push: <BellOff className="size-4" strokeWidth={2.2} />,
  bounced: <Mail className="size-4" strokeWidth={2.2} />,
}

const CHARGE_STATUS: Record<string, { label: string; cls: string }> = {
  succeeded: { label: '성공', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700' },
  pending: { label: '진행', cls: 'bg-amber-100 text-amber-800' },
  skipped: { label: '건너뜀', cls: 'bg-secondary text-muted-foreground' },
}

function Section({
  id,
  icon,
  title,
  desc,
  action,
  children,
}: {
  id?: string
  icon: ReactNode
  title: string
  desc?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[16px] font-bold text-foreground">
            <span className="text-primary">{icon}</span>
            {title}
          </h2>
          {desc != null && <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{desc}</p>}
        </div>
        {action != null && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-[14px] font-semibold text-foreground break-keep">{children}</dd>
    </div>
  )
}

function SectionError({ errors, keys, what }: { errors: CustomerData['errors']; keys: SectionKey[]; what: string }) {
  const hit = keys.find((k) => errors[k])
  if (!hit) return null
  return (
    <div className="mb-3">
      <LoadError what={what} hint="비어 보여도 없는 게 아니에요 — 조회가 실패했어요. 새로고침해 주세요." />
    </div>
  )
}

function UpcomingLine({ sub }: { sub: SubView }) {
  const u: UpcomingBox | null = sub.upcoming
  if (sub.state === 'cancelled') return <span className="text-muted-foreground">해지됨</span>
  if (sub.state === 'needs_card') return <span className="text-muted-foreground">카드 등록 전 — 발송일 없음</span>
  if (!u) return <span className="text-muted-foreground">다음 발송일 없음</span>
  if (u.kind === 'in_progress') {
    // 결제된 박스 문구 하나 — '결제됨 · ○/○(화) 발송'(2026-10-24 어드민 금액 말 정리, 정기배송 한 장 띠와 같게).
    return (
      <span>
        <b>결제됨 · {dayLabel(u.shipIso)} 발송</b>
      </span>
    )
  }
  if (u.kind === 'charge_check') {
    return (
      <span className="text-red-700">
        {dayLabel(u.shipIso)} 발송분 — 결제일 {dayLabel(u.chargeIso)} 지났는데 결제 확인 안 됨
      </span>
    )
  }
  return (
    <span>
      <b>{dayLabel(u.shipIso)} 발송</b>
      {sub.state === 'paused'
        ? ' · 일시정지 중(결제 안 함)'
        : u.chargeIso
          ? ` · ${dayLabel(u.chargeIso)} 결제`
          : sub.timingKnown
            ? ''
            : ' · 결제일 확인 못 함'}
    </span>
  )
}

/**
 * 정기배송 카드 금액 말(2026-10-24 어드민 금액 말 정리) — 예전 두 줄(DB 저장값·다음 결제값)은 날짜가 없어 10/27 박스가
 * 128,500원처럼 읽혔다. 이번 박스(이미 결제함) → 다음 결제 · 날짜 → 정가(2주) 순서로, 할인은 어드민 이름표로.
 */
function SubCard({ sub, today }: { sub: SubView; today: string }) {
  const discounted = sub.chargeAmount != null && sub.chargeAmount !== sub.storedAmount
  const pb = sub.paidBox ?? null
  const nextDiscountName = !discounted ? null : sub.chargeReason !== undefined ? adminDiscountLabel(sub.chargeReason) : sub.chargeLabel
  const nextLabel = sub.nextChargeIso
    ? `다음 결제 · ${dayLabel(sub.nextChargeIso)}${sub.nextChargeIso < today ? '(지남)' : ''}`
    : '다음 결제'
  return (
    <div className={`rounded-lg border p-3 ${sub.state === 'cancelled' ? 'border-border opacity-60' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[15px] font-bold text-foreground">
          {sub.dogName} <span className="text-[12px] font-semibold text-muted-foreground">{sub.freshLabel}{sub.freshRatio ? ` ${sub.freshRatio}%` : ''}</span>
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${TONE_CLS[sub.tone] ?? TONE_CLS.off}`}>{sub.stateLabel}</span>
      </div>
      <p className="mt-1.5 text-[14px] text-foreground">
        <UpcomingLine sub={sub} />
      </p>
      <dl className="mt-2">
        {pb && (
          <Row label="이번 박스">
            <Link href={`/admin/orders/${encodeURIComponent(pb.orderId)}`} className="underline-offset-2 hover:underline">
              결제함 {won(pb.amount)}
              {pb.discountAmount > 0 ? (
                <span className="ml-1 text-[12px] font-semibold text-violet-700">({adminDiscountLabel(pb.discountReason)})</span>
              ) : null}
            </Link>
          </Row>
        )}
        <Row label={nextLabel}>
          {sub.chargeAmount == null ? (
            <span className="text-muted-foreground">{sub.state === 'cancelled' || sub.state === 'needs_card' ? '—' : '계산 못 함'}</span>
          ) : (
            <span className={discounted ? 'text-violet-700' : ''}>
              {won(sub.chargeAmount)}
              {nextDiscountName ? <span className="ml-1 text-[12px] font-semibold">({nextDiscountName})</span> : null}
            </span>
          )}
        </Row>
        <Row label="정가(2주)">{won(sub.storedAmount)}</Row>
        {sub.supporterCaption && <Row label="서포터즈">{sub.supporterCaption}</Row>}
        <Row label="카드">
          {sub.cardLast4 ? `${sub.cardBrand ?? '카드'} 끝 ${sub.cardLast4}` : <span className="text-muted-foreground">등록 안 됨</span>}
        </Row>
        <Row label="결제된 박스">{sub.totalDeliveries}회</Row>
        <Row label="신청">
          {formatKstDate(sub.createdAt)}
          {sub.cancelledAt ? ` · 해지 ${formatKstDate(sub.cancelledAt)}` : ''}
        </Row>
        {sub.lastFailReason && sub.state === 'card_failed' && <Row label="마지막 실패">{sub.lastFailReason}</Row>}
      </dl>
      <Link href={subscriptionHref(sub.id)} className="mt-2 inline-block text-[13px] font-bold text-primary underline-offset-2 hover:underline">
        정기배송 한 장으로 보기 →
      </Link>
    </div>
  )
}

const RISE_STATUS: Record<string, { text: string; cls: string }> = {
  recorded: { text: '동의 받음', cls: 'bg-emerald-100 text-emerald-800' },
  urgent: { text: '동의 없음 — 이대로면 청구 보류', cls: 'bg-red-100 text-red-700' },
  waiting: { text: '동의 아직(30일 넘게 남음)', cls: 'bg-amber-100 text-amber-800' },
  none: { text: '해당 회차 없음', cls: 'bg-secondary text-muted-foreground' },
}

/**
 * 서포터즈 인상 동의·보류 — 읽기 전용(2026-10-15 F-b, 규칙278). 판정은 체험단 화면과 같은 정본(loadChargeProjection →
 * trialPlanView)이고, 동의 기록은 체험단 화면에서 한다(여기서 쓰지 않는다).
 */
function SupporterPlanBlock({ plan }: { plan: NonNullable<CustomerData['supporterPlan']> }) {
  const rises = plan.rises.filter((r) => r.status !== 'none' || r.consentedOn)
  return (
    <div className="mb-2 rounded-md border border-violet-200 bg-card p-2.5">
      <p className="text-[13px] font-bold text-foreground">서포터즈 가격 인상·동의</p>
      {plan.openHolds.length > 0 && (
        <p className="mt-1 rounded bg-red-50 px-2 py-1 text-[13px] font-bold text-red-700">
          청구 보류 중 — {plan.openHolds.map((h) => `${dayLabel(h.shipDate)} 발송분`).join(', ')}: 동의가 없어 결제하지 않았어요(박스 보내지 마세요)
        </p>
      )}
      {plan.next && (
        <p className="mt-1 text-[13px] text-foreground">
          다음 결제 {dayLabel(plan.next.chargeIso)} · {won(plan.next.amount)}
          {plan.next.held ? <span className="font-bold text-red-700"> — 동의 없으면 보류돼요</span> : null}
        </p>
      )}
      {rises.length === 0 ? (
        <p className="mt-1 text-[13px] text-muted-foreground">앞으로 오르는 회차가 없어요.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {rises.map((r) => {
            const st = RISE_STATUS[r.status] ?? RISE_STATUS.none!
            return (
              <li key={r.label} className="flex flex-wrap items-center justify-between gap-1.5 text-[13px]">
                <span className="text-foreground">
                  {r.label}
                  {r.chargeIso ? ` · ${dayLabel(r.chargeIso)} 결제` : ''}
                  {r.amount != null ? ` · ${r.prevAmount != null ? `${won(r.prevAmount)} → ` : ''}${won(r.amount)}` : ''}
                  {r.consentedOn ? ` · ${dayLabel(r.consentedOn)} 받음` : ''}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${st.cls}`}>{st.text}</span>
              </li>
            )
          })}
        </ul>
      )}
      <Link href="/admin/trials" className="mt-1.5 inline-block text-[13px] font-bold text-primary underline-offset-2 hover:underline">
        체험단 화면에서 동의 기록하기 →
      </Link>
    </div>
  )
}

function AllergyChips({ list }: { list: string[] | null }) {
  if (list === null) return <span className="text-[13px] text-muted-foreground">설문에 답 없음(모름)</span>
  if (list.length === 0) return <span className="text-[13px] font-semibold text-emerald-700">없음</span>
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {list.map((a) => (
        <span key={a} className="rounded-full bg-red-100 px-2 py-0.5 text-[12px] font-bold text-red-700">
          {a}
        </span>
      ))}
    </span>
  )
}

function DogCard({ dog, data, demo }: { dog: DogView; data: CustomerData; demo: boolean }) {
  const s = dog.survey
  const req = data.proposals.find((p) => p.dogId === dog.id && !p.processedAt)
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[16px] font-bold text-foreground">{dog.name}</p>
        <p className="text-[13px] text-muted-foreground">
          {[dog.breed, dog.ageLabel, dog.weightKg != null ? `${dog.weightKg}kg` : null].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <dl className="mt-2">
        <Row label="알레르기">
          {s ? <AllergyChips list={s.allergies} /> : <span className="text-[13px] text-muted-foreground">설문 없음</span>}
        </Row>
        <Row label="기저질환">
          {!s ? (
            '—'
          ) : s.chronic === null ? (
            <span className="text-[13px] text-muted-foreground">모름</span>
          ) : s.chronic.length === 0 ? (
            <span className="text-[13px] font-semibold text-emerald-700">없음</span>
          ) : (
            s.chronic.join(', ')
          )}
        </Row>
        {dog.firstCheckin !== undefined && (
          <Row label="첫 박스 반응">
            {dog.firstCheckin === null ? (
              <span className="text-[13px] text-muted-foreground">아직 답 없음</span>
            ) : (
              <span className={`text-[13px] ${dog.firstCheckin.poor ? 'text-red-700' : dog.firstCheckin.needsOwner ? 'text-amber-800' : ''}`}>
                <b>{dog.firstCheckin.label}</b> · {formatKstDate(dog.firstCheckin.answeredAt)}
                {dog.firstCheckin.comment ? <span className="block font-normal break-keep">&ldquo;{dog.firstCheckin.comment}&rdquo;</span> : null}
              </span>
            )}
          </Row>
        )}
        {s && (
          <Row label="최신 설문">
            <span className="text-[13px]">
              {formatKstDate(s.createdAt)}
              {s.adminEdit ? ' · 관리자 수정' : ''} · 총 {s.count}번{' '}
              <Link href={`/admin/surveys/${s.id}`} className="font-bold text-primary underline-offset-2 hover:underline">
                설문 보기
              </Link>
            </span>
          </Row>
        )}
      </dl>
      {s?.adminEdit && (
        <p className="mt-1 text-[12px] text-muted-foreground">
          관리자 수정 전 알레르기: {s.adminEdit.prevAllergies.join(', ') || '없음'}
          {s.adminEdit.note ? ` · ${s.adminEdit.note}` : ''}
        </p>
      )}

      {/* 지금 박스 — 정본 servingFormula + computeBoxPlan */}
      {dog.box ? (
        <div className="mt-3 rounded-md bg-secondary/60 p-2.5">
          <p className="text-[13px] font-bold text-foreground">
            지금 식단 · {dog.box.recipe.map((r) => `${r.name} ${r.pct}%`).join(' + ') || '—'}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            하루 {dog.box.dailyKcal}kcal · {dog.box.freshLabel}
            {dog.box.freshRatio ? ` ${dog.box.freshRatio}%` : ''} · {dog.box.approvalLabel}
            {dog.box.cycle != null ? ` · ${dog.box.cycle}회차` : ''}
            {dog.box.appliedFrom ? ` · ${dayLabel(dog.box.appliedFrom)}부터` : ''}
          </p>
          {dog.box.note ? (
            <p className="mt-1.5 text-[13px] font-semibold text-amber-800">{dog.box.note}</p>
          ) : (
            <ul className="mt-1.5 space-y-0.5">
              {dog.box.packs.map((p) => (
                <li key={p.name} className="text-[13px] text-foreground">
                  · {p.name} {p.packG}g × {p.count}팩
                </li>
              ))}
            </ul>
          )}
          {dog.box.held.length > 0 && (
            <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2">
              <p className="text-[13px] font-bold text-red-700">알레르기 확인 필요 — 포장 목록에서 이 박스가 멈춰요</p>
              {dog.box.held.map((h) => (
                <p key={h.name} className="text-[12px] text-red-700">
                  · {h.name} — {h.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : dog.liveSubId ? (
        <p className="mt-3 text-[13px] text-muted-foreground">지금 먹는 식단을 찾지 못했어요(승인 대기·시작 전만 있음).</p>
      ) : null}

      {dog.pendingProposal && (
        <p className="mt-2 rounded-md border border-violet-300 bg-violet-50 p-2 text-[13px] text-violet-900">
          고객 답을 기다리는 새 식단 제안 ({dog.pendingProposal.cycle}회차 · {formatKstDate(dog.pendingProposal.createdAt)})
          {dog.pendingProposal.priceFrom != null && dog.pendingProposal.priceTo != null
            ? ` — 2주 ${won(dog.pendingProposal.priceFrom)} → ${won(dog.pendingProposal.priceTo)}`
            : ''}
        </p>
      )}
      {req && (
        <p className="mt-2 text-[12px] font-semibold text-violet-800">
          새 식단 제안 예약됨({formatKstShortDateTime(req.requestedAt)}) — 다음 재제안(매일 아침 10시)에 고객에게 가요.
        </p>
      )}

      {data.profile.deletedAt ? null : (
      <div className="mt-3">
        <AllergyEditor
          userId={data.userId}
          dogId={dog.id}
          dogName={dog.name}
          current={s?.allergies ?? null}
          hasSurvey={!!s}
          demo={demo}
        />
      </div>
      )}
    </div>
  )
}

export default function CustomerView({ data, demo = false }: { data: CustomerData; demo?: boolean }) {
  const { profile, errors } = data
  const liveSubs = data.subs.filter((s) => s.state !== 'cancelled')
  const pastSubs = data.subs.filter((s) => s.state === 'cancelled')
  const flags = data.flags ?? []
  // 탈퇴한 회원(규칙275) — 표시만 남기고 고치기·메모·메시지를 숨긴다(서버도 409).
  const deleted = !!profile.deletedAt

  return (
    <div className="mx-auto max-w-5xl">
      {/* 머리 */}
      <div className="mb-4">
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-3.5" strokeWidth={2.2} />
          회원 목록
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">
              {profile.name ?? '(이름 없음)'}
              {deleted && (
                <span className="ml-2 align-middle rounded-full bg-secondary px-2 py-0.5 text-[12px] font-bold text-muted-foreground">
                  탈퇴한 회원 · {formatKstDate(profile.deletedAt)}
                </span>
              )}
              {profile.role === 'admin' && (
                <span className="ml-2 align-middle rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background">관리자</span>
              )}
            </h1>
            <p className="mt-1 break-all text-[13px] text-muted-foreground">
              {profile.email ?? '메일 없음'} · {profile.phone ?? '전화 없음'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!deleted && (
            <Link
              href={`/admin/users/${data.userId}/message`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-bold text-primary-foreground"
            >
              <MessageCircle className="size-3.5" strokeWidth={2.2} />
              1:1 메시지
            </Link>
            )}
          </div>
        </div>
      </div>

      {/* 챙길 손님(C4) — 맨 위 */}
      {errors.flags ? (
        <div className="mb-4">
          <LoadError what="챙길 신호(메일 반송·알림 기기·카드)" />
        </div>
      ) : flags.length > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-amber-900">
            <AlertTriangle className="size-4" strokeWidth={2.4} />
            챙길 손님 — 먼저 연락이 필요해요
          </p>
          <ul className="space-y-1.5">
            {flags.map((k) => (
              <li key={k} className="flex items-start gap-2 text-[13px] text-amber-900">
                <span className="mt-0.5 shrink-0">{FLAG_ICON[k]}</span>
                <span>
                  <b>{CUSTOMER_FLAG_LABEL[k]}</b> — {CUSTOMER_FLAG_HINT[k]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 왼쪽 */}
        <div className="space-y-4">
          <Section icon={<Repeat className="size-4" strokeWidth={2.2} />} title="정기배송" desc="상태·다음 발송·결제일·금액은 청구와 같은 함수로 계산해요.">
            <SectionError errors={errors} keys={['subs']} what="정기배송" />
            <SectionError errors={errors} keys={['trial', 'charge_preview', 'paid_box']} what="서포터즈·다음 결제 금액·결제된 박스" />
            {data.supporter && (
              <p className="mb-2 rounded-md bg-violet-50 px-2.5 py-1.5 text-[13px] text-violet-900">
                서포터즈 — 100원 {data.supporter.cheapRemaining}회 · 반값 {data.supporter.halfRemaining}회 남음
                {data.supporter.note ? ` · ${data.supporter.note}` : ''}
              </p>
            )}
            <SectionError errors={errors} keys={['trial_plan']} what="서포터즈 인상 동의·보류" />
            {data.supporterPlan && <SupporterPlanBlock plan={data.supporterPlan} />}
            {liveSubs.length === 0 && !errors.subs ? (
              <p className="text-[13px] text-muted-foreground">진행 중인 정기배송이 없어요.</p>
            ) : (
              <div className="space-y-2">
                {liveSubs.map((s) => (
                  <SubCard key={s.id} sub={s} today={data.today} />
                ))}
              </div>
            )}
            {pastSubs.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[13px] font-semibold text-muted-foreground">지난 정기배송 {pastSubs.length}건</summary>
                <div className="mt-2 space-y-2">
                  {pastSubs.map((s) => (
                    <SubCard key={s.id} sub={s} today={data.today} />
                  ))}
                </div>
              </details>
            )}
            {liveSubs.length > 0 && (
              <p className="mt-3 rounded-md border border-border bg-secondary/50 p-2.5 text-[12px] leading-relaxed text-muted-foreground">
                화식 비율·금액은 여기서 바꾸지 않아요 — 금액이 바뀌는 변경은 고객 동의가 필요해요. 고객이 비율을 바꾸고 싶어 하면{' '}
                <Link href={`/admin/users/${data.userId}/message?preset=ratio`} className="font-bold text-primary underline-offset-2 hover:underline">
                  비율 변경 안내 보내기
                </Link>
                (고객이 앱에서 새 금액을 보고 직접 고른다), 알레르기 때문이면 강아지 칸의 &lsquo;새 식단 제안&rsquo;을 써요.
              </p>
            )}
          </Section>

          <Section id="dogs" icon={<PawPrint className="size-4" strokeWidth={2.2} />} title="강아지" desc="알레르기·기저질환은 최신 설문이 정본이에요.">
            <SectionError errors={errors} keys={['dogs']} what="강아지" />
            <SectionError errors={errors} keys={['checkin']} what="첫 박스 체크인 답" />
            <SectionError errors={errors} keys={['surveys']} what="설문(알레르기·기저질환)" />
            <SectionError errors={errors} keys={['box', 'proposals']} what="식단·박스 구성" />
            {data.dogs.length === 0 && !errors.dogs ? (
              <p className="text-[13px] text-muted-foreground">등록한 강아지가 없어요.</p>
            ) : (
              <div className="space-y-2">
                {data.dogs.map((d) => (
                  <DogCard key={d.id} dog={d} data={data} demo={demo} />
                ))}
              </div>
            )}
          </Section>

          <Section
            id="notes"
            icon={<ClipboardList className="size-4" strokeWidth={2.2} />}
            title="문의 기록"
            desc="카톡·전화로 온 문의를 날짜순으로. '다시 볼 날'이 오늘이면 어드민 홈 할 일에 떠요."
          >
            <SectionError errors={errors} keys={['memo']} what="운영 메모" />
            {!errors.memo && !deleted && (
              <div className="-mx-1 mb-1">
                <AdminNoteCard userId={data.userId} initial={data.memo} />
              </div>
            )}
            {errors.notes ? (
              <LoadError what="문의 기록" hint="기록을 불러오지 못했어요 — 새로고침해 주세요(표가 아직 없으면 마이그레이션 적용 전이에요)." />
            ) : (
              <NotesPanel userId={data.userId} notes={data.notes} today={data.today} demo={demo} readOnly={deleted} />
            )}
          </Section>
        </div>

        {/* 오른쪽 */}
        <div className="space-y-4">
          <Section icon={<Smartphone className="size-4" strokeWidth={2.2} />} title="기본">
            <SectionError errors={errors} keys={['account']} what="가입 정보" />
            <dl>
              <Row label="가입 경로">
                {data.account ? [data.account.providerLabel, ...data.account.extras].join(' · ') : '—'}
              </Row>
              <Row label="가입일">{formatKstDate(profile.createdAt)}</Row>
              <Row label="마지막 접속">{data.account?.lastSignInAt ? formatKstShortDateTime(data.account.lastSignInAt) : '—'}</Row>
              <Row label="앱">
                {data.apps === null ? (
                  <span className="text-muted-foreground">확인 못 함</span>
                ) : data.apps.tokens.length === 0 ? (
                  <span className="text-muted-foreground">
                    앱 알림 기기 없음{data.apps.webPushCount > 0 ? ` · 웹 알림 ${data.apps.webPushCount}대` : ''}
                  </span>
                ) : (
                  <span className="flex flex-col items-end gap-0.5">
                    {data.apps.tokens.map((t, i) => (
                      <span key={i} className="text-[13px]">
                        {t.platform === 'ios' ? '아이폰' : t.platform === 'android' ? '안드로이드' : t.platform} {t.version ?? '버전 모름'}
                        <span className="ml-1 font-normal text-muted-foreground">({formatKstDate(t.updatedAt)})</span>
                      </span>
                    ))}
                  </span>
                )}
              </Row>
              <Row label="메일">
                {data.emailBounced === null ? (
                  <span className="text-muted-foreground">확인 못 함</span>
                ) : data.emailBounced ? (
                  <span className="text-red-700">반송됨 — 메일 안 감</span>
                ) : (
                  '정상'
                )}
              </Row>
            </dl>
          </Section>

          <Section icon={<History className="size-4" strokeWidth={2.2} />} title="정기배송 변경 기록" desc="고객이 직접 한 건너뛰기·일시정지·해지·비율·카드 변경과 관리자·자동 변경.">
            <SectionError errors={errors} keys={['events']} what="변경 기록" />
            {data.events.length === 0 && !errors.events ? (
              <p className="text-[13px] text-muted-foreground">아직 기록이 없어요(10/14부터 쌓여요).</p>
            ) : (
              <ol className="space-y-2">
                {data.events.map((e) => (
                  <li key={e.id} className="border-l-2 border-border pl-3">
                    <p className="text-[12px] text-muted-foreground">
                      {formatKstShortDateTime(e.createdAt)} · {e.actorLabel}
                      {e.dogName ? ` · ${e.dogName}` : ''}
                    </p>
                    <p className="text-[14px] font-bold text-foreground">{e.label}</p>
                    {e.detail && <p className="text-[13px] text-foreground">{e.detail}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section icon={<CreditCard className="size-4" strokeWidth={2.2} />} title="결제·주문·환불">
            <SectionError errors={errors} keys={['charges']} what="결제 시도" />
            {data.charges.length > 0 && (
              <>
                <p className="mb-1 text-[12px] font-bold text-muted-foreground">정기 결제 시도</p>
                <ul className="mb-3 space-y-1">
                  {data.charges.map((c) => {
                    const st = CHARGE_STATUS[c.status] ?? { label: c.status, cls: 'bg-secondary text-muted-foreground' }
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="text-foreground">
                          {dayLabel(c.scheduledFor)} · {won(c.amount)}
                          {c.errorMessage && c.status === 'failed' ? <span className="ml-1 text-red-700">({c.errorMessage})</span> : null}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            <SectionError errors={errors} keys={['orders']} what="주문" />
            {data.orders.length === 0 && !errors.orders ? (
              <p className="text-[13px] text-muted-foreground">주문이 없어요.</p>
            ) : (
              <ul className="space-y-1">
                {data.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-[13px] hover:bg-secondary/50">
                      <span className="min-w-0 truncate text-foreground">
                        {formatKstDate(o.createdAt)} · {o.isSubscription ? '정기' : '가게'} · {won(o.totalAmount)}
                        {o.refundedAmount > 0 ? <span className="text-red-700"> (환불 {won(o.refundedAmount)})</span> : null}
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">
                        {PAYMENT_STATUS_LABEL[o.paymentStatus as PaymentStatus] ?? o.paymentStatus} ·{' '}
                        {ORDER_STATUS_LABEL[o.orderStatus as OrderStatus] ?? o.orderStatus}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <SectionError errors={errors} keys={['refunds']} what="환불" />
            {data.refunds.length > 0 && (
              <>
                <p className="mb-1 mt-3 text-[12px] font-bold text-muted-foreground">환불</p>
                <ul className="space-y-1">
                  {data.refunds.map((r) => (
                    <li key={r.id} className="text-[13px] text-foreground">
                      {formatKstDate(r.refundedAt)} · {won(r.amount)}
                      {r.reason ? <span className="text-muted-foreground"> · {r.reason}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section
            icon={<Truck className="size-4" strokeWidth={2.2} />}
            title="배송지"
            desc="결제·포장 라벨과 같은 순서(기본 배송지 → 프로필 → 신청서)로 정한 지금 주소예요."
          >
            <SectionError errors={errors} keys={['address']} what="배송지" />
            {data.address.current ? (
              <div className="mb-3 text-[14px] text-foreground">
                <p className="font-bold">
                  {data.address.current.name} · {data.address.current.phone}
                </p>
                <p>
                  ({data.address.current.zip}) {data.address.current.address} {data.address.current.addressDetail ?? ''}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {data.address.source === 'default'
                    ? '기본 배송지'
                    : data.address.source === 'profile'
                      ? '프로필 주소(기본 배송지 없음)'
                      : '구독 신청서 주소(기본 배송지·프로필 없음)'}
                  {data.address.pendingPaidBoxes > 0 ? ` · 결제된 발송 대기 박스 ${data.address.pendingPaidBoxes}개는 주문에 적힌 주소로 나가요` : ''}
                </p>
              </div>
            ) : (
              !errors.address &&
              (deleted ? (
                <p className="mb-3 text-[13px] text-muted-foreground">탈퇴하며 주소를 지웠어요.</p>
              ) : (
                <p className="mb-3 text-[13px] text-red-700">배송지가 없어요 — 결제가 건너뛰어질 수 있어요.</p>
              ))
            )}
            {/* 결제된 발송 대기 박스를 못 읽었으면 '같이 바꾸기'가 조용히 사라진다 — 고치기를 막고 이유를 말한다(규칙277). */}
            {!errors.address && !deleted && errors.paid_box && (
              <p className="text-[13px] font-semibold text-amber-800">
                결제된 발송 대기 박스를 확인하지 못했어요 — 새로고침한 뒤 배송지를 고쳐 주세요(안 그러면 그 박스가 옛 주소로 나갈 수 있어요).
              </p>
            )}
            {!errors.address && !deleted && !errors.paid_box && (
              <AddressEditor
                userId={data.userId}
                current={data.address.current}
                pendingPaidBoxes={data.address.pendingPaidBoxes}
                demo={demo}
              />
            )}
          </Section>

          <Section
            icon={<MessageCircle className="size-4" strokeWidth={2.2} />}
            title="앱 알림·1:1 문의"
            action={
              deleted ? undefined : (
                <Link href={`/admin/users/${data.userId}/message`} className="text-[13px] font-bold text-primary">
                  열기 →
                </Link>
              )
            }
          >
            <SectionError errors={errors} keys={['messages']} what="알림·문의" />
            {data.messages.awaitingReply && (
              <p className="mb-2 rounded-md bg-red-50 px-2.5 py-1.5 text-[13px] font-bold text-red-700">답 안 한 문의가 있어요</p>
            )}
            {data.messages.thread.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {data.messages.thread.map((m) => (
                  <li key={m.id} className={`text-[13px] ${m.sender === 'admin' ? 'text-muted-foreground' : 'text-foreground'}`}>
                    <b>{m.sender === 'admin' ? '관리자' : '고객'}</b> {formatKstShortDateTime(m.createdAt)} — <span className="break-keep">{m.body}</span>
                  </li>
                ))}
              </ul>
            )}
            {data.messages.push.length > 0 ? (
              <>
                <p className="mb-1 text-[12px] font-bold text-muted-foreground">최근 보낸 앱 알림</p>
                <ul className="space-y-1">
                  {data.messages.push.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate text-foreground">{p.title}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatKstShortDateTime(p.sentAt)} {p.readAt ? '· 읽음' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              !errors.messages && <p className="text-[13px] text-muted-foreground">보낸 앱 알림이 없어요.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
