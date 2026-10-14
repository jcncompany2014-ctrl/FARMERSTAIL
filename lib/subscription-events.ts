/**
 * 정기배송 변경 기록(subscription_events) — 종류·이름·한 줄 설명. 순수 함수(2026-10-14 C3, 규칙255).
 *
 * 기록은 두 갈래다(마이그 20261014220100 머리말):
 *  · 로그인 쓰기(고객 앱·웹의 건너뛰기·일시정지·재개·해지, 어드민 구독 화면) → DB 트리거.
 *  · 서버 쓰기(화식 비율 변경·카드 등록·신청·금액 동의·크론) → 코드가 lib/subscription-events-record 로 직접.
 * 종류 이름은 DB check 제약과 같아야 한다 — 여기 목록이 정본이고 테스트가 마이그레이션과 맞춘다.
 *
 * `@/` 값 import 없음 — node 테스트가 그대로 읽는다.
 */

export const SUBSCRIPTION_EVENT_KINDS = [
  'create',
  'skip',
  'skip_undo',
  'reschedule',
  'pause',
  'resume',
  'cancel',
  'fresh_ratio',
  'amount',
  'card',
  'status',
] as const
export type SubscriptionEventKind = (typeof SUBSCRIPTION_EVENT_KINDS)[number]

export const SUBSCRIPTION_EVENT_ACTORS = ['customer', 'admin', 'cron', 'system'] as const
export type SubscriptionEventActor = (typeof SUBSCRIPTION_EVENT_ACTORS)[number]

export const SUBSCRIPTION_EVENT_LABEL: Record<SubscriptionEventKind, string> = {
  create: '정기배송 신청',
  skip: '다음 박스 2주 미룸',
  skip_undo: '미룬 박스 되돌림',
  reschedule: '발송일 변경',
  pause: '일시정지',
  resume: '다시 시작',
  cancel: '해지',
  fresh_ratio: '화식 비율 변경',
  amount: '2주 금액 변경',
  card: '카드 등록·변경',
  status: '상태 변경',
}

export const SUBSCRIPTION_EVENT_ACTOR_LABEL: Record<SubscriptionEventActor, string> = {
  customer: '고객',
  admin: '관리자',
  cron: '자동(크론)',
  system: '서버',
}

export type SubscriptionEventRow = {
  id: string
  subscription_id: string
  actor: string
  kind: string
  before: unknown
  after: unknown
  created_at: string
}

type Obj = Record<string, unknown>

function obj(v: unknown): Obj {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {}
}

const STATUS_KO: Record<string, string> = { active: '구독 중', paused: '일시정지', cancelled: '해지' }

function dateKo(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return '없음'
  const [, m, d] = v.slice(0, 10).split('-')
  return `${Number(m)}/${Number(d)}`
}

function won(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? `${v.toLocaleString('ko-KR')}원` : '?'
}

/** 칸 하나 — 전·후가 다 있으면 "전 → 후", 후만 있으면 후만(카드 등록처럼 전 값을 모르는 서버 기록). */
function field(b: Obj, a: Obj, key: string, fmt: (v: unknown) => string): string | null {
  const inB = key in b
  const inA = key in a
  if (!inA && !inB) return null
  if (inA && !inB) return fmt(a[key])
  if (inB && !inA) return `${fmt(b[key])} → ?`
  const from = fmt(b[key])
  const to = fmt(a[key])
  return from === to ? to : `${from} → ${to}`
}

/**
 * 한 줄 설명 — "발송 10/21 → 11/4" 처럼 바뀐 값만. 모르는 모양이면 빈 문자열(이름만 보인다).
 */
export function describeSubscriptionEvent(e: Pick<SubscriptionEventRow, 'kind' | 'before' | 'after'>): string {
  const b = obj(e.before)
  const a = obj(e.after)
  const parts: string[] = []
  const status = field(b, a, 'status', (v) => STATUS_KO[String(v)] ?? String(v ?? '—'))
  if (status) parts.push(status)
  const ship = field(b, a, 'next_delivery_date', dateKo)
  if (ship) parts.push(`발송 ${ship}`)
  const ratio = field(b, a, 'fresh_ratio', (v) => (typeof v === 'number' ? `${v}%` : '?'))
  if (ratio) parts.push(`화식 ${ratio}`)
  const amount = field(b, a, 'total_amount', won)
  if (amount) parts.push(`2주 ${amount}`)
  const card = field(b, a, 'card_last4', (v) => (typeof v === 'string' && v ? `끝 ${v}` : '없음'))
  if (card) parts.push(`카드 ${card}`)
  if (typeof a.note === 'string' && a.note) parts.push(a.note)
  return parts.join(' · ')
}

export function eventKindLabel(kind: string): string {
  return (SUBSCRIPTION_EVENT_LABEL as Record<string, string>)[kind] ?? kind
}

export function eventActorLabel(actor: string): string {
  return (SUBSCRIPTION_EVENT_ACTOR_LABEL as Record<string, string>)[actor] ?? actor
}
