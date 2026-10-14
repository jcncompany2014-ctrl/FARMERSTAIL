/**
 * 어드민 고객 화면(/admin/users/[id]) 데이터 모양 — 조회(_data.ts)와 그리기(CustomerView.tsx)를 가른다.
 * 그리기를 나눈 이유: 운영 데이터 없이 예시 값으로 같은 화면을 띄워 점검한다(app/design-check-admin/customer).
 * 전부 직렬화 가능한 값만(클라이언트 부품에 그대로 넘긴다).
 */
import type { CustomerFlagKey } from '@/lib/admin/customer-flags'
import type { SubState, SubStateTone } from '@/lib/subscription-state'
import type { UpcomingBox } from '@/lib/shipping-schedule'
import type { ShippingTarget } from '@/lib/commerce/shipping-target'
import type { AdminAllergyEditMark } from '@/lib/admin/allergy-edit'

/** 화면 칸 — 칸마다 따로 실패를 보인다(한 조회 실패가 화면 전체를 지우거나 '없음'으로 보이지 않게, 규칙1). */
export type SectionKey =
  | 'account'
  | 'flags'
  | 'dogs'
  | 'surveys'
  | 'box'
  | 'subs'
  | 'trial'
  | 'charge_preview'
  | 'paid_box'
  | 'orders'
  | 'charges'
  | 'refunds'
  | 'events'
  | 'notes'
  | 'memo'
  | 'messages'
  | 'address'
  | 'proposals'
  | 'checkin'
  | 'trial_plan'

export type BoxView = {
  /** 레시피 구성(라인 이름·비율 %). */
  recipe: Array<{ name: string; pct: number }>
  dailyKcal: number
  cycle: number | null
  approvalLabel: string
  appliedFrom: string | null
  freshRatio: number | null
  freshLabel: string
  /** 담기는 팩(정본 computeBoxPlan → subscribableItems). 비율을 모르면 빈 배열 + note. */
  packs: Array<{ name: string; packG: number; count: number }>
  /** 담지 못한 몫 — 있으면 포장 목록이 이 박스를 멈춘다. */
  held: Array<{ name: string; reason: string }>
  note: string | null
}

export type DogView = {
  id: string
  name: string
  breed: string | null
  weightKg: number | null
  ageLabel: string | null
  /** 최신 설문 — 알레르기·기저질환은 여기가 정본. null = 설문 없음. */
  survey: {
    id: string
    createdAt: string
    /** null = 설문에 알레르기 답이 없음(모름) · [] = 없다고 답함. */
    allergies: string[] | null
    chronic: string[] | null
    adminEdit: AdminAllergyEditMark | null
    count: number
  } | null
  /** 진행 중 정기배송의 지금 박스(정본 servingFormula + computeBoxPlan). */
  box: BoxView | null
  /** 고객 답을 기다리는 식단 제안. */
  pendingProposal: { cycle: number; createdAt: string; priceFrom: number | null; priceTo: number | null } | null
  liveSubId: string | null
  liveActive: boolean
  liveFreshRatio: number | null
  /**
   * 첫 박스 체크인 답(feeding_outcomes · 규칙270). undefined = 이 화면이 안 읽음(예시 값) · null = 아직 답 없음.
   * needsOwner = 사장님이 볼 답('잘 안 먹어요' 또는 메모 있는 '조금 가렸어요' — lib/first-checkin 판정).
   */
  firstCheckin?: { label: string; comment: string | null; answeredAt: string; needsOwner: boolean; poor: boolean } | null
}

export type SubView = {
  id: string
  dogId: string | null
  dogName: string
  state: SubState
  stateLabel: string
  tone: SubStateTone
  freshRatio: number | null
  freshLabel: string
  /** subscriptions.total_amount — 할인 전 저장 금액(청구 기준). */
  storedAmount: number
  /** 다음 결제 때 실제로 나갈 금액(정본 resolveAutoDiscount). null = 못 냄(해지·조회 실패). */
  chargeAmount: number | null
  chargeLabel: string | null
  supporterCaption: string | null
  upcoming: UpcomingBox | null
  /** 결제 시점(서포터즈 여부)을 알았나 — 모르면 결제일을 단정하지 않는다. */
  timingKnown: boolean
  cardBrand: string | null
  cardLast4: string | null
  totalDeliveries: number
  createdAt: string
  cancelledAt: string | null
  lastFailReason: string | null
  nextDeliveryDate: string | null
}

export type OrderView = {
  id: string
  orderNumber: string
  createdAt: string
  totalAmount: number
  refundedAmount: number
  paymentStatus: string
  orderStatus: string
  isSubscription: boolean
  trackingNumber: string | null
}

export type ChargeView = {
  id: string
  scheduledFor: string | null
  status: string
  amount: number | null
  errorMessage: string | null
  attemptedAt: string | null
}

export type RefundView = {
  id: string
  orderId: string | null
  amount: number
  reason: string | null
  status: string | null
  refundedAt: string | null
}

export type EventView = {
  id: string
  kind: string
  actor: string
  createdAt: string
  label: string
  actorLabel: string
  detail: string
  dogName: string | null
}

export type NoteView = {
  id: string
  notedOn: string
  channel: string
  body: string
  followUpOn: string | null
  done: boolean
  doneAt: string | null
  createdAt: string
}

export type CustomerData = {
  userId: string
  today: string
  profile: {
    name: string | null
    email: string | null
    phone: string | null
    createdAt: string | null
    role: string | null
    /** 탈퇴 시각(profiles.deleted_at) — 있으면 '탈퇴한 회원': 고치기·메모·메시지를 숨기고 서버도 409(규칙275). */
    deletedAt?: string | null
  }
  /**
   * 서포터즈 가격 인상 — 체험단 화면과 같은 정본(loadChargeProjection → trialPlanView)으로 읽기만(규칙278).
   * undefined = 이 화면이 안 읽음(예시 값) · null = 서포터즈 아님.
   */
  supporterPlan?: {
    /** 다음 결제(일정표 첫 회차). */
    next: { chargeIso: string; amount: number; label: string | null; held: boolean } | null
    rises: Array<{
      label: string
      status: 'recorded' | 'urgent' | 'waiting' | 'none'
      chargeIso: string | null
      amount: number | null
      prevAmount: number | null
      consentedOn: string | null
      channel: string | null
    }>
    /** 열린 청구 보류(subscription_charge_holds) — 동의가 없어 결제를 멈춘 회차. */
    openHolds: Array<{ shipDate: string; chargeDate: string; rise: string | null }>
  } | null
  account: {
    providerLabel: string
    lastSignInAt: string | null
    /** 가입 경로 덧붙임 — 행사 코드·이웃 할인·서포터즈. */
    extras: string[]
  } | null
  flags: CustomerFlagKey[] | null
  apps: {
    tokens: Array<{ platform: string; version: string | null; updatedAt: string | null }>
    webPushCount: number
  } | null
  emailBounced: boolean | null
  dogs: DogView[]
  subs: SubView[]
  supporter: { cheapRemaining: number; halfRemaining: number; note: string | null } | null
  orders: OrderView[]
  charges: ChargeView[]
  refunds: RefundView[]
  events: EventView[]
  notes: NoteView[]
  memo: string | null
  messages: {
    thread: Array<{ id: string; sender: 'admin' | 'user'; body: string; createdAt: string }>
    push: Array<{ id: string; title: string; sentAt: string; readAt: string | null }>
    /** 마지막 메시지가 고객 것이면 아직 답 안 한 문의. */
    awaitingReply: boolean
  }
  address: {
    current: ShippingTarget | null
    source: 'default' | 'profile' | 'subscription' | null
    /** 결제됐고 발송 대기 중인 정기배송 박스 수 — 주소를 바꾸면 이것도 같이 바꿀지 묻는다. */
    pendingPaidBoxes: number
  }
  proposals: Array<{ dogId: string; requestedAt: string; processedAt: string | null; outcome: string | null }>
  errors: Partial<Record<SectionKey, string>>
}
