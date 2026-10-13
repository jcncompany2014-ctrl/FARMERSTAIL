/**
 * 푸시 알림 설정(push_preferences) 요청 검사 — 순수 함수 (2026-10-13 점검, 규칙193).
 *
 * app/api/push/preferences 가 쓴다. 보낸 칸만 골라내고(모르는 칸·틀린 형은 거절),
 * 방해 금지 시간은 **바뀐 뒤의 두 값**(보낸 값 + 저장된 값)으로 검사한다 — 한쪽 시각만 바꿔도 된다.
 * 예전엔 한쪽만 보내면 다른 쪽을 '없음'으로 봐서 시작·끝 시각 고르기가 늘 400 이었다.
 *
 * `@/` 값 import 없음 — node 테스트(lib/push-preferences.test.ts)가 그대로 읽는다.
 */

export type PushPrefs = {
  notify_order: boolean
  notify_health: boolean
  notify_marketing: boolean
  quiet_hours_start: number | null
  quiet_hours_end: number | null
}

export const PUSH_PREF_DEFAULTS: PushPrefs = {
  notify_order: true,
  // 건강 알림은 기본 ON — 배송 알림을 꺼도 체중 경보는 남아야 한다.
  notify_health: true,
  notify_marketing: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
}

const BOOL_KEYS = ['notify_order', 'notify_health', 'notify_marketing'] as const
const HOUR_KEYS = ['quiet_hours_start', 'quiet_hours_end'] as const

export type PrefsPatch = Partial<PushPrefs>

/** 보낸 칸만 담는다. 모르는 칸(user_id 등)·틀린 형·빈 요청은 거절. */
export function parsePrefsPatch(body: unknown): { ok: true; patch: PrefsPatch } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: '요청 형식이 올바르지 않습니다' }
  }
  const b = body as Record<string, unknown>
  const allowed = new Set<string>([...BOOL_KEYS, ...HOUR_KEYS])
  for (const k of Object.keys(b)) {
    if (!allowed.has(k)) return { ok: false, message: `바꿀 수 없는 항목이에요 (${k})` }
  }
  const patch: PrefsPatch = {}
  for (const k of BOOL_KEYS) {
    if (!(k in b)) continue
    if (typeof b[k] !== 'boolean') return { ok: false, message: `${k} 는 켜기·끄기 값이어야 해요` }
    patch[k] = b[k] as boolean
  }
  for (const k of HOUR_KEYS) {
    if (!(k in b)) continue
    const v = b[k]
    if (v !== null && !(typeof v === 'number' && Number.isInteger(v))) {
      return { ok: false, message: `${k} 는 0-23 정수나 null 이어야 해요` }
    }
    patch[k] = v as number | null
  }
  if (Object.keys(patch).length === 0) return { ok: false, message: '바꿀 항목이 없어요' }
  return { ok: true, patch }
}

/**
 * 방해 금지 시간 — 바뀐 뒤의 두 값이 '둘 다 null' 또는 '서로 다른 0-23 정수'인가. 틀리면 안내 문구, 맞으면 null.
 * 시각을 안 건드린 요청은 검사하지 않는다(저장된 값이 이미 DB 제약을 통과했다).
 */
export function validateQuietHours(current: PushPrefs, patch: PrefsPatch): string | null {
  if (!('quiet_hours_start' in patch) && !('quiet_hours_end' in patch)) return null
  const s = 'quiet_hours_start' in patch ? patch.quiet_hours_start : current.quiet_hours_start
  const e = 'quiet_hours_end' in patch ? patch.quiet_hours_end : current.quiet_hours_end
  const bothNull = s === null && e === null
  const inRange = (h: unknown) => typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23
  const bothRange = inRange(s) && inRange(e) && s !== e
  if (bothNull || bothRange) return null
  return '방해 금지 시간은 둘 다 끄거나, 서로 다른 시각(0-23시)으로 정해 주세요'
}
