'use server'

/**
 * 첫 박스 체크인 → 사장님께 알리기(경보함) (2026-10-15, 규칙270).
 *
 * 화면(FirstCheckinClient)이 답을 저장한 **뒤에** 부른다. 저장 자체는 지금처럼 로그인 사용자 권한(RLS: 본인 + 강아지 구성원)으로
 * 화면에서 한다 — 이 동작이 실패해도 손님의 답은 이미 저장돼 있고, 어드민 '이번 주 할 일'과 고객 화면은 그 답을 DB 에서 직접 읽는다
 * (경보함은 두 번째 길). 그래서 여기서는:
 *  · 내용(답·메모)을 **화면이 넘긴 값이 아니라 DB 에서** 읽는다 — 로그인 사용자 본인의 답만(.eq('user_id', user.id)).
 *  · '잘 안 먹어요'·메모 있는 '조금 가렸어요'만 경보함에 적는다(lib/first-checkin 판정). 같은 강아지는 24시간 안이면 한 줄로 묶인다
 *    (record_admin_alert) — 여러 번 눌러도 경보가 쌓이지 않는다.
 *  · 메모는 개인정보 모양(전화·메일 등)을 정본(scrubSentryString)으로 가린 뒤 짧게만 남긴다.
 */

import { createClient, getSafeUser } from '@/lib/supabase/server'
import { recordAdminAlert } from '@/lib/admin/alert-record'
import { scrubSentryString } from '@/lib/sentry-scrub'
import { firstCheckinAlertOf, firstCheckinLine, isCheckinPalatability } from '@/lib/first-checkin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type NotifyFirstCheckinResult =
  | { ok: true; alerted: boolean }
  | { ok: false; reason: 'unauthorized' | 'bad_request' | 'not_found' | 'db_error' | 'alert_failed' }

export async function notifyOwnerOfFirstCheckin(dogId: string): Promise<NotifyFirstCheckinResult> {
  if (typeof dogId !== 'string' || !UUID_RE.test(dogId)) return { ok: false, reason: 'bad_request' }
  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  if (!user) return { ok: false, reason: 'unauthorized' }

  const { data: row, error } = await supabase
    .from('feeding_outcomes')
    .select('id, palatability, comment')
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .eq('source', 'first_box_checkin')
    .maybeSingle()
  if (error) {
    console.error('[first-checkin] 답 조회 실패 — 경보함 기록 못 함(할 일·고객 화면은 DB 에서 직접 읽는다):', error.message)
    return { ok: false, reason: 'db_error' }
  }
  if (!row) return { ok: false, reason: 'not_found' }

  const alert = firstCheckinAlertOf(row.palatability, row.comment)
  if (!alert || !isCheckinPalatability(row.palatability)) return { ok: true, alerted: false }

  // 강아지 이름 — 사장님이 누구인지 바로 알게. 못 읽으면 '강아지'(경보는 그래도 남긴다 — 고객 링크가 있다).
  const { data: dog, error: dogErr } = await supabase.from('dogs').select('name').eq('id', dogId).maybeSingle()
  if (dogErr) console.error('[first-checkin] 강아지 이름 조회 실패 — 이름 없이 적는다:', dogErr.message)
  const dogName = (dog?.name ?? '').trim() || '강아지'
  const memo = row.comment ? scrubSentryString(row.comment) : null

  const res = await recordAdminAlert(alert.level, alert.kind, {
    userId: user.id,
    dogId,
    outcomeId: row.id,
    detail: firstCheckinLine(dogName, row.palatability, memo),
  })
  if (!res.ok) return { ok: false, reason: 'alert_failed' }
  return { ok: true, alerted: true }
}
