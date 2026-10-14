/**
 * 외부 키 만료 — 판정 정본(순수 함수) (2026-10-14 어드민 B4, 규칙252).
 *
 * # 근거 조사 (2026-10-14)
 *  · 배송조회 키(tracker.delivery 무료): 21일마다 만료. 환경값엔 값만 있고 API 는 만료 전엔 아무 말이 없다가 만료되면
 *    HTTP 200 + UNAUTHENTICATED(lib/tracking isTrackerAuthError). → 만료일을 알 근거 = 설정일 + 21일.
 *  · 인스타 DM 장기 토큰: 60일. 별도 프로젝트(farmerstail-insta)의 Vercel 환경값 — 이 앱에서 읽을 수 없다. → 설정일 + 60일.
 *  · 토스 결제 키: 만료 없음. 심사 중이라 '라이브 전환 안 됨'만 본다(lib/payments/key-mode tossKeyStatus — 접두사 판정).
 * 그래서 사장님이 적는 설정일(admin_key_expiry, 마이그 20261014210100)이 근거다. 키 값은 어디에도 없다 — 날짜만.
 *
 * # 경보
 * 7·3·1일 전 그리고 만료 뒤에 아침 브리핑과 경보함(ops.key_expiring)에 올린다. 한 단계는 한 번만 적는다(대상 열쇠에
 * 만료일·단계가 들어가 있어, 키를 새로 받아 만료일이 바뀌면 다시 7일 전부터 센다).
 */
import { addDaysKst, diffDaysKst } from '../datetime-kst.ts'

export type ExternalKeyName = 'delivery_tracker' | 'instagram_dm'

export type ExternalKeyDef = {
  label: string
  /** 발급(설정)일로부터 며칠 뒤 만료되나. */
  lifetimeDays: number
  /** 어디에 들어 있나 — 값이 아니라 위치만. */
  where: string
  /** 새로 받는 법. */
  renew: string
}

export const EXTERNAL_KEYS: Record<ExternalKeyName, ExternalKeyDef> = {
  delivery_tracker: {
    label: '배송조회 키(tracker.delivery 무료)',
    lifetimeDays: 21,
    where: 'Vercel 환경값 DELIVERY_TRACKER_CLIENT_ID · SECRET',
    renew: 'console.tracker.delivery 에서 다시 받아 환경값을 바꿔 주세요',
  },
  instagram_dm: {
    label: '인스타 DM 장기 토큰',
    lifetimeDays: 60,
    where: '별도 프로젝트 farmerstail-insta 의 Vercel 환경값',
    renew: '인스타 키 등록 스크립트로 토큰을 갱신해 주세요',
  },
}

export const EXTERNAL_KEY_NAMES = Object.keys(EXTERNAL_KEYS) as ExternalKeyName[]

export function isExternalKeyName(v: unknown): v is ExternalKeyName {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(EXTERNAL_KEYS, v)
}

/** 경보 단계 — 만료 7·3·1일 전. 0 = 만료됨. */
export const KEY_ALERT_DAYS = [7, 3, 1] as const
export type KeyAlertStage = 7 | 3 | 1 | 0

export type KeyExpiryRow = {
  key_name: string
  set_on: string | null
  expires_on: string | null
}

export type KeyExpiryState = {
  name: ExternalKeyName
  label: string
  setOn: string | null
  expiresOn: string | null
  /** 오늘(KST)부터 만료일까지 남은 날. 만료일을 모르면 null. 0 = 오늘 만료, 음수 = 지남. */
  daysLeft: number | null
  /** 지금 어느 경보 단계인가(7일 안 → 7, 3일 안 → 3, 1일 안 → 1, 만료 → 0). 멀면 null. */
  stage: KeyAlertStage | null
  tone: 'ok' | 'warn' | 'bad' | 'unknown'
}

/** 설정일 → 만료일(설정일 + 수명). 설정일을 모르면 null. */
export function expiryFromSetOn(name: ExternalKeyName, setOn: string | null): string | null {
  if (!setOn || !/^\d{4}-\d{2}-\d{2}$/.test(setOn)) return null
  return addDaysKst(setOn, EXTERNAL_KEYS[name].lifetimeDays)
}

export function keyAlertStage(daysLeft: number | null): KeyAlertStage | null {
  if (daysLeft === null) return null
  if (daysLeft <= 0) return 0
  if (daysLeft <= 1) return 1
  if (daysLeft <= 3) return 3
  if (daysLeft <= 7) return 7
  return null
}

/** 한 키의 상태 — 행이 없거나 날짜가 없으면 'unknown'(모르는 것을 '괜찮음'으로 보이지 않는다). */
export function keyExpiryState(name: ExternalKeyName, row: KeyExpiryRow | null, todayKst: string): KeyExpiryState {
  const setOn = row?.set_on ?? null
  const expiresOn = row?.expires_on ?? expiryFromSetOn(name, setOn)
  const daysLeft = expiresOn ? diffDaysKst(expiresOn, todayKst) : null
  const stage = keyAlertStage(daysLeft)
  return {
    name,
    label: EXTERNAL_KEYS[name].label,
    setOn,
    expiresOn,
    daysLeft,
    stage,
    tone: daysLeft === null ? 'unknown' : stage === 0 ? 'bad' : stage !== null ? 'warn' : 'ok',
  }
}

/** 모든 외부 키의 상태 — 표의 행을 이름으로 맞춘다(없는 키도 'unknown' 으로 한 줄). */
export function keyExpiryStates(rows: readonly KeyExpiryRow[], todayKst: string): KeyExpiryState[] {
  const byName = new Map(rows.map((r) => [r.key_name, r]))
  return EXTERNAL_KEY_NAMES.map((n) => keyExpiryState(n, byName.get(n) ?? null, todayKst))
}

/** 사람이 읽는 한 줄(키 값 없음). */
export function describeKeyExpiry(s: KeyExpiryState): string {
  if (s.daysLeft === null) return `${s.label} — 만료일을 몰라요(설정일을 적어 주세요)`
  const md = s.expiresOn ? `${Number(s.expiresOn.slice(5, 7))}/${Number(s.expiresOn.slice(8, 10))}` : ''
  if (s.daysLeft < 0) return `${s.label} — ${md} 만료됨(${-s.daysLeft}일 지남)`
  if (s.daysLeft === 0) return `${s.label} — 오늘(${md}) 만료`
  return `${s.label} — ${md} 만료 · ${s.daysLeft}일 남음`
}

export type KeyExpiryAlert = {
  level: 'warning' | 'error'
  /** 경보함 대상 열쇠 — 키·만료일·단계(한 단계는 한 번만, 새 키는 다시 센다). */
  targetKey: string
  detail: string
}

/** 경보함에 올릴 것 — 단계에 들어간 키만. 만료(0)·1일 전은 error. */
export function keyExpiryAlert(s: KeyExpiryState): KeyExpiryAlert | null {
  if (s.stage === null || !s.expiresOn) return null
  return {
    level: s.stage <= 1 ? 'error' : 'warning',
    targetKey: `key:${s.name}:${s.expiresOn}:${s.stage}`,
    detail: describeKeyExpiry(s),
  }
}
