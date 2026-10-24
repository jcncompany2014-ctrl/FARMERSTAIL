import type { CustomerData } from '@/app/admin/users/[id]/_types'

/**
 * 어드민 고객 화면 점검 예시 값(2026-10-14 C1~C5). 운영 데이터가 아니다 — 예시 강아지 '땅콩', 고객 '보호자님'.
 * 금액·회차는 서포터즈 실제 흐름(100원 10/20·11/3·11/17 → 12/1 반값)과 같은 모양으로 맞췄다.
 */
const USER = '00000000-0000-4000-8000-000000000001'
const DOG = '00000000-0000-4000-8000-0000000000d1'
const SUB = '00000000-0000-4000-8000-0000000000a1'

const BASE: CustomerData = {
  userId: USER,
  today: '2026-10-14',
  profile: {
    name: '보호자님',
    email: 'guardian@kakao.com',
    phone: '010-0000-0000',
    createdAt: '2026-09-24T03:10:00Z',
    role: null,
  },
  account: { providerLabel: '카카오', lastSignInAt: '2026-10-13T11:42:00Z', extras: ['서포터즈'] },
  flags: ['old_app', 'bounced'],
  apps: {
    tokens: [{ platform: 'android', version: '1.0.10', updatedAt: '2026-10-13T11:42:00Z' }],
    webPushCount: 0,
  },
  emailBounced: true,
  dogs: [
    {
      id: DOG,
      name: '땅콩',
      breed: '셸티',
      weightKg: 11.2,
      ageLabel: '4살',
      survey: {
        id: '00000000-0000-4000-8000-0000000000e1',
        createdAt: '2026-10-14T02:05:00Z',
        allergies: ['닭·칠면조'],
        chronic: ['관절'],
        adminEdit: { at: '2026-10-14T02:05:00Z', prevAllergies: [], note: '10/14 카톡 — 닭 먹으면 긁는다고 함' },
        count: 3,
      },
      box: {
        recipe: [
          { name: '치킨', pct: 50 },
          { name: '한우', pct: 50 },
        ],
        dailyKcal: 612,
        cycle: 1,
        approvalLabel: '자동 적용',
        appliedFrom: null,
        freshRatio: 50,
        freshLabel: '반반',
        packs: [{ name: '한우 화식', packG: 150, count: 14 }],
        held: [{ name: '치킨 레시피', reason: '처방에 알레르기 레시피가 들어 있어요' }],
        note: null,
      },
      pendingProposal: null,
      liveSubId: SUB,
      liveActive: true,
      liveFreshRatio: 50,
    },
  ],
  subs: [
    {
      id: SUB,
      dogId: DOG,
      dogName: '땅콩',
      state: 'active',
      stateLabel: '구독 중',
      tone: 'on',
      freshRatio: 50,
      freshLabel: '반반',
      storedAmount: 51500,
      chargeAmount: 100,
      chargeLabel: '서포터즈 100원',
      chargeReason: 'trial_cheap',
      // 서포터즈 체험 구간은 발송일 아침 결제(chargeDateFor 'ship_day').
      nextChargeIso: '2026-10-20',
      paidBox: null,
      supporterCaption: '서포터즈 100원 구간 · 42일치 남음',
      upcoming: { kind: 'upcoming', shipIso: '2026-10-20', chargeIso: '2026-10-20' },
      timingKnown: true,
      cardBrand: '신한',
      cardLast4: '1234',
      totalDeliveries: 0,
      createdAt: '2026-09-24T03:20:00Z',
      cancelledAt: null,
      lastFailReason: null,
      nextDeliveryDate: '2026-10-20',
    },
  ],
  supporter: { cheapRemaining: 3, halfRemaining: 4, note: '1기 서포터즈' },
  orders: [],
  charges: [],
  refunds: [],
  events: [
    {
      id: 'ev3',
      kind: 'skip_undo',
      actor: 'customer',
      createdAt: '2026-10-06T10:15:00Z',
      label: '미룬 박스 되돌림',
      actorLabel: '고객',
      detail: '발송 11/3 → 10/20',
      dogName: '땅콩',
    },
    {
      id: 'ev2',
      kind: 'skip',
      actor: 'customer',
      createdAt: '2026-10-06T10:14:00Z',
      label: '다음 박스 2주 미룸',
      actorLabel: '고객',
      detail: '발송 10/20 → 11/3',
      dogName: '땅콩',
    },
    {
      id: 'ev1',
      kind: 'card',
      actor: 'customer',
      createdAt: '2026-09-24T03:22:00Z',
      label: '카드 등록·변경',
      actorLabel: '고객',
      detail: '구독 중 · 카드 끝 1234 · 발송 10/20',
      dogName: '땅콩',
    },
  ],
  notes: [
    {
      id: 'n2',
      notedOn: '2026-10-14',
      channel: 'kakao',
      body: '땅콩이 닭 먹으면 긁는다고 함 — 알레르기에 닭 넣음. 새 식단 제안 예약.',
      followUpOn: '2026-10-14',
      done: false,
      doneAt: null,
      createdAt: '2026-10-14T02:06:00Z',
    },
    {
      id: 'n1',
      notedOn: '2026-10-06',
      channel: 'kakao',
      body: '실수로 미루기 눌렀다고 문의 — 앱에서 되돌리기 안내, 해결.',
      followUpOn: null,
      done: true,
      doneAt: '2026-10-06T10:20:00Z',
      createdAt: '2026-10-06T10:10:00Z',
    },
  ],
  memo: '1기 서포터즈 · 후기 사진 올려 주기로 함',
  messages: {
    thread: [
      { id: 'm1', sender: 'admin', body: '첫 박스는 10/20(화)에 보내드려요!', createdAt: '2026-10-06T10:30:00Z' },
      { id: 'm2', sender: 'user', body: '네 감사합니다. 닭은 빼 주실 수 있나요?', createdAt: '2026-10-14T01:58:00Z' },
    ],
    push: [{ id: 'p1', title: '땅콩 첫 박스 준비 중이에요', sentAt: '2026-10-13T00:10:00Z', readAt: null }],
    awaitingReply: true,
  },
  address: {
    current: { name: '보호자님', phone: '010-0000-0000', zip: '03900', address: '서울특별시 마포구 월드컵북로 00', addressDetail: '3층' },
    source: 'default',
    pendingPaidBoxes: 0,
  },
  proposals: [{ dogId: DOG, requestedAt: '2026-10-14T02:06:00Z', processedAt: null, outcome: null }],
  errors: {},
}

/** 카드 결제가 깨진 고객 + 알림 기기 없음 — 맨 위 배지 넷 중 둘. 결제 실패·발송 대기 박스·주문 기록. */
const FLAGS: CustomerData = {
  ...BASE,
  flags: ['card_renewal', 'no_push'],
  apps: { tokens: [], webPushCount: 0 },
  emailBounced: false,
  profile: { ...BASE.profile, email: 'guardian@example.com' },
  dogs: [
    {
      ...BASE.dogs[0]!,
      survey: { ...BASE.dogs[0]!.survey!, allergies: [], adminEdit: null, chronic: [] },
      box: {
        ...BASE.dogs[0]!.box!,
        packs: [
          { name: '치킨 화식', packG: 150, count: 7 },
          { name: '한우 화식', packG: 150, count: 7 },
        ],
        held: [],
      },
      pendingProposal: { cycle: 2, createdAt: '2026-10-12T01:10:00Z', priceFrom: 51500, priceTo: 54300 },
    },
  ],
  subs: [
    {
      ...BASE.subs[0]!,
      state: 'card_failed',
      stateLabel: '결제 확인 필요',
      tone: 'bad',
      chargeAmount: 51500,
      chargeLabel: null,
      chargeReason: 'none',
      // 카드 문제는 다시 등록해야 결제일이 정해진다 — 날짜를 단정하지 않는다(_data.ts 와 같은 규칙).
      nextChargeIso: null,
      paidBox: null,
      supporterCaption: null,
      upcoming: { kind: 'charge_check', shipIso: '2026-10-13', chargeIso: '2026-10-10' },
      lastFailReason: '한도 초과',
      totalDeliveries: 2,
    },
  ],
  supporter: null,
  charges: [
    { id: 'c3', scheduledFor: '2026-10-10', status: 'failed', amount: 51500, errorMessage: '한도 초과', attemptedAt: '2026-10-10T00:10:00Z' },
    { id: 'c2', scheduledFor: '2026-09-26', status: 'succeeded', amount: 51500, errorMessage: null, attemptedAt: '2026-09-26T00:10:00Z' },
  ],
  orders: [
    {
      id: '00000000-0000-4000-8000-0000000000f2',
      orderNumber: 'FT-20260926-0007',
      createdAt: '2026-09-26T00:10:00Z',
      totalAmount: 51500,
      refundedAmount: 0,
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      isSubscription: true,
      trackingNumber: '000000000000',
    },
  ],
  address: { ...BASE.address, pendingPaidBoxes: 1 },
  notes: [],
  proposals: [],
  messages: { thread: [], push: [], awaitingReply: false },
}

/**
 * 첫 박스를 이벤트 할인으로 결제한 직후(2026-10-24 어드민 금액 말 정리) — 이번 박스 '결제함 78,500원' · 정가 128,500원 ·
 * 이벤트 할인 −50,000원(50% · 최대 5만원),
 * 다음 결제 11/7(토)은 정가(이벤트 할인은 첫 박스만). 금액 모양은 10/24 실제 흐름과 같게, 이름·번호는 예시.
 */
const PAID: CustomerData = {
  ...BASE,
  today: '2026-10-24',
  account: { providerLabel: '카카오', lastSignInAt: '2026-10-24T01:00:00Z', extras: ['행사 가입 약국 봉투'] },
  flags: [],
  emailBounced: false,
  supporter: null,
  supporterPlan: null,
  dogs: [{ ...BASE.dogs[0]!, box: { ...BASE.dogs[0]!.box!, packs: [{ name: '한우 화식', packG: 130, count: 14 }], held: [] } }],
  subs: [
    {
      ...BASE.subs[0]!,
      storedAmount: 128500,
      chargeAmount: 128500,
      chargeLabel: null,
      chargeReason: 'none',
      nextChargeIso: '2026-11-07',
      paidBox: {
        orderId: '00000000-0000-4000-8000-0000000000f3',
        orderNumber: 'FT-20261024-AAAAAA',
        amount: 78500,
        list: 128500,
        discountAmount: 50000,
        discountReason: 'promotion',
        paidAt: '2026-10-24T00:10:00Z',
        shipIso: '2026-10-27',
      },
      supporterCaption: null,
      upcoming: { kind: 'in_progress', shipIso: '2026-10-27' },
      totalDeliveries: 1,
      createdAt: '2026-10-21T13:57:00Z',
      nextDeliveryDate: '2026-11-10',
    },
  ],
  orders: [
    {
      id: '00000000-0000-4000-8000-0000000000f3',
      orderNumber: 'FT-20261024-AAAAAA',
      createdAt: '2026-10-24T00:10:00Z',
      totalAmount: 78500,
      refundedAmount: 0,
      paymentStatus: 'paid',
      orderStatus: 'preparing',
      isSubscription: true,
      trackingNumber: null,
    },
  ],
  charges: [{ id: 'c1', scheduledFor: '2026-10-24', status: 'succeeded', amount: 78500, errorMessage: null, attemptedAt: '2026-10-24T00:10:00Z' }],
  address: { ...BASE.address, pendingPaidBoxes: 1 },
  events: [],
  proposals: [],
}

/** 막 가입한 회원 — 강아지·구독 없음. */
const EMPTY: CustomerData = {
  ...BASE,
  profile: { ...BASE.profile, email: 'new@example.com' },
  account: { providerLabel: '이메일', lastSignInAt: '2026-10-14T01:00:00Z', extras: [] },
  flags: ['no_push'],
  apps: { tokens: [], webPushCount: 0 },
  emailBounced: false,
  dogs: [],
  subs: [],
  supporter: null,
  events: [],
  notes: [],
  memo: null,
  messages: { thread: [], push: [], awaitingReply: false },
  address: { current: null, source: null, pendingPaidBoxes: 0 },
  proposals: [],
}

/** 칸마다 조회 실패 — '없음'이 아니라 '못 불러옴'으로 보이는지. */
const ERRORS: CustomerData = {
  ...BASE,
  flags: null,
  apps: null,
  emailBounced: null,
  events: [],
  notes: [],
  errors: {
    flags: 'timeout',
    events: 'relation "subscription_events" does not exist',
    notes: 'relation "admin_customer_notes" does not exist',
    charges: 'timeout',
  },
}

export const CUSTOMER_FIXTURES: Record<string, CustomerData> = {
  full: BASE,
  flags: FLAGS,
  paid: PAID,
  empty: EMPTY,
  errors: ERRORS,
}
