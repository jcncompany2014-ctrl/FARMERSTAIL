/**
 * 챙길 손님 표시 — 지금 있는 신호로 '이 고객은 우리가 먼저 연락해야 한다'를 판정한다(2026-10-14 C4, 규칙256).
 *
 * # 신호 넷
 *  · 메일 반송 — email_suppressions(하드바운스·스팸 신고)에 그 주소가 있다. 결제·배송 안내 메일이 가지 않는다
 *    (lib/email/client 가 그 주소로는 아예 보내지 않는다). 카카오 가입자 @kakao.com 2명 반송 실측(10/14).
 *  · 앱 알림 못 받음 — 네이티브 토큰(native_push_tokens)도 웹 푸시 구독(push_subscriptions)도 없다. 결제 실패·배송 알림이
 *    한 건도 안 간다.
 *  · 옛 앱 — 가장 최근에 쓴 안드로이드 기기의 앱 버전이 1.0.11 보다 낮다(플레이 1.0.10). 그 빌드는 카카오톡·카드사 앱
 *    전환이 고장이다(lib/native-build NATIVE_FEATURE_MIN_BUILD.androidIntentLinks = versionCode 12 = 1.0.11). 토큰 행에는
 *    빌드 번호가 아니라 표시 버전('1.0.10')이 저장되므로 표시 버전으로 비교한다.
 *  · 카드 재등록 필요 — 해지 안 된 정기배송 중 상태 정본(subscriptionState)이 card_failed 인 것. 판정을 여기서 다시 짜지
 *    않는다 — 같은 판정을 두 곳에 두면 두 화면이 다른 말을 한다.
 *
 * 순수 함수 — 조회는 lib/admin/customer-flags-load(서버 전용). `@/` 값 import 없음(node 테스트가 그대로 읽는다).
 */
import { subscriptionState, type SubLike } from '../subscription-state.ts'

export type CustomerFlagKey = 'bounced' | 'no_push' | 'old_app' | 'card_renewal'

export const CUSTOMER_FLAG_KEYS: readonly CustomerFlagKey[] = ['card_renewal', 'old_app', 'no_push', 'bounced']

/** 짧은 이름(배지·필터 칩). */
export const CUSTOMER_FLAG_LABEL: Record<CustomerFlagKey, string> = {
  card_renewal: '카드 재등록 필요',
  old_app: '옛 앱(안드 1.0.10)',
  no_push: '앱 알림 못 받음',
  bounced: '메일 반송',
}

/** 무엇을 하면 되는지 — 고객 화면 맨 위 배지 설명. */
export const CUSTOMER_FLAG_HINT: Record<CustomerFlagKey, string> = {
  card_renewal: '카드 결제가 안 되고 있어요 — 카드를 다시 등록해 달라고 카톡으로 안내해 주세요.',
  old_app: '카카오톡·카드사 앱으로 넘어가지 못하는 옛 버전이에요 — 플레이 스토어에서 업데이트하도록 안내해 주세요.',
  no_push: '앱 알림을 받을 기기가 없어요 — 결제·배송 알림이 안 가요. 중요한 안내는 카톡으로.',
  bounced: '메일이 되돌아와요 — 결제·배송 안내 메일이 안 가요. 안내는 카톡·앱 알림으로.',
}

/** 카카오톡·카드사 앱 전환이 고쳐진 첫 안드로이드 표시 버전(versionCode 12). */
export const ANDROID_FIRST_FIXED_VERSION = '1.0.11'

function parseVersion(v: string | null | undefined): number[] | null {
  if (typeof v !== 'string') return null
  const m = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v)
  if (!m) return null
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)]
}

/** a < b (표시 버전). 못 읽으면 null(모름). */
export function versionLessThan(a: string | null | undefined, b: string): boolean | null {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa[i]! !== pb[i]!) return pa[i]! < pb[i]!
  }
  return false
}

/** 카톡·카드사 앱 전환이 고장인 옛 안드로이드 버전인가. 버전을 모르면 false(단정하지 않는다). */
export function isBrokenAndroidVersion(version: string | null | undefined): boolean {
  return versionLessThan(version, ANDROID_FIRST_FIXED_VERSION) === true
}

export type NativeTokenLite = {
  platform: string | null
  app_version: string | null
  updated_at: string | null
}

export type CustomerFlagInput = {
  email: string | null
  /** email_suppressions 의 주소들(소문자). */
  suppressedEmails: ReadonlySet<string>
  nativeTokens: readonly NativeTokenLite[]
  webPushCount: number
  /** 이 고객의 정기배송들(해지 포함 — 해지는 판정에서 뺀다). */
  subscriptions: readonly SubLike[]
}

export type CustomerFlags = {
  keys: CustomerFlagKey[]
  /** 가장 최근에 쓴 기기의 앱 — 없으면 null. */
  latestApp: { platform: string; version: string | null; updatedAt: string | null } | null
}

/** 가장 최근에 갱신된 토큰(같은 플랫폼 중). */
function latestToken(tokens: readonly NativeTokenLite[], platform?: string): NativeTokenLite | null {
  let best: NativeTokenLite | null = null
  for (const t of tokens) {
    if (platform && t.platform !== platform) continue
    if (!best || Date.parse(t.updated_at ?? '') > Date.parse(best.updated_at ?? '')) best = t
  }
  return best
}

export function customerFlags(input: CustomerFlagInput): CustomerFlags {
  const keys: CustomerFlagKey[] = []

  const live = input.subscriptions.filter((s) => s.status !== 'cancelled')
  if (live.some((s) => subscriptionState(s) === 'card_failed')) keys.push('card_renewal')

  const android = latestToken(input.nativeTokens, 'android')
  if (android && isBrokenAndroidVersion(android.app_version)) keys.push('old_app')

  if (input.nativeTokens.length === 0 && input.webPushCount <= 0) keys.push('no_push')

  const email = (input.email ?? '').trim().toLowerCase()
  if (email && input.suppressedEmails.has(email)) keys.push('bounced')

  const latest = latestToken(input.nativeTokens)
  return {
    keys,
    latestApp: latest
      ? { platform: latest.platform ?? '?', version: latest.app_version, updatedAt: latest.updated_at }
      : null,
  }
}

/** 회원 목록 필터 값 → 판정 키. 모르는 값이면 null(필터 없음). 'any' = 하나라도. */
export type CustomerFlagFilter = CustomerFlagKey | 'any'

export function parseFlagFilter(raw: string | null | undefined): CustomerFlagFilter | null {
  if (raw === 'any') return 'any'
  return (CUSTOMER_FLAG_KEYS as readonly string[]).includes(raw ?? '') ? (raw as CustomerFlagKey) : null
}

export function matchesFlagFilter(keys: readonly CustomerFlagKey[], filter: CustomerFlagFilter): boolean {
  return filter === 'any' ? keys.length > 0 : keys.includes(filter)
}
