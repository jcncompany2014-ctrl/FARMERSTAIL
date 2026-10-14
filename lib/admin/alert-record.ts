import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  alertMessageOf,
  alertTargetKey,
  alertTargetsOf,
  sanitizeAlertContext,
  shouldRecordOwnerAlert,
  type AlertContext,
} from '@/lib/admin/alert-kinds'

/**
 * 운영 경보함(admin_alerts) 기록 — 서버 전용 (2026-10-14 B1, 규칙247).
 *
 * # 원칙: 기록 실패가 원래 동작을 막지 않는다
 * 이 함수는 결제·환불·크론 한가운데서 불린다(captureBusinessEvent 를 거쳐). 그래서
 *  · 절대 던지지 않는다 — 실패는 서버 로그 + Sentry(captureMessage, 경보함 목록에 없는 이름이라 되돌아오지 않음)로만.
 *  · 응답을 기다리게 하지 않는다 — next/server after() 로 응답 뒤에 적는다(요청 범위 밖이면 바로 돌린다).
 *
 * # 묶음
 * 같은 종류 + 같은 대상이 24시간 안에 또 오면 새 줄을 만들지 않고 횟수만 올린다 — DB 함수 record_admin_alert 가
 * 잠금(pg_advisory_xact_lock) 안에서 판정한다(마이그 20261014210000). 쓰기는 service_role 만 할 수 있다.
 */

export type RecordAlertResult = { ok: true; id: string | null } | { ok: false; error: string }

/** 바로 적는다(기다릴 수 있는 곳 — 크론의 키 만료 점검 등). 던지지 않는다. */
export async function recordAdminAlert(
  level: 'warning' | 'error',
  kind: string,
  ctx: AlertContext,
): Promise<RecordAlertResult> {
  try {
    const t = alertTargetsOf(ctx)
    const db = createAdminClient()
    const { data, error } = await db.rpc('record_admin_alert', {
      p_kind: kind,
      p_severity: level,
      p_message: alertMessageOf(kind, ctx),
      p_target_key: alertTargetKey(kind, ctx, t),
      p_order_id: t.orderId,
      p_subscription_id: t.subscriptionId,
      p_user_id: t.userId,
      p_dog_id: t.dogId,
      p_context: sanitizeAlertContext(ctx),
    })
    if (error) {
      reportRecordFailure(kind, error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true, id: typeof data === 'string' ? data : null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    reportRecordFailure(kind, msg)
    return { ok: false, error: msg }
  }
}

/**
 * captureBusinessEvent 가 부르는 입구 — 목록(lib/admin/alert-kinds)에 있는 사람 일만 골라 응답 뒤에 적는다.
 * 동기 함수이고 절대 던지지 않는다(원래 흐름 보호).
 */
export function forwardOwnerAlert(
  level: 'info' | 'warning' | 'error',
  kind: string,
  ctx: AlertContext,
): void {
  try {
    if (!shouldRecordOwnerAlert(level, kind)) return
    const sev = level === 'error' ? 'error' : 'warning'
    const task = async () => {
      await recordAdminAlert(sev, kind, ctx)
    }
    try {
      // 요청 범위 안: 응답을 보낸 뒤에 적는다(결제·크론 응답을 늦추지 않는다).
      after(task)
    } catch {
      // 요청 범위 밖(스크립트·테스트 등) — 바로 돌린다. 실패는 recordAdminAlert 안에서 로그로 끝난다.
      void task()
    }
  } catch (e) {
    reportRecordFailure(kind, e instanceof Error ? e.message : String(e))
  }
}

function reportRecordFailure(kind: string, message: string) {
  try {
    console.error('[admin-alerts] 경보함 기록 실패 — 원래 동작은 계속:', kind, message)
    Sentry.captureMessage(`[admin-alerts] 경보함 기록 실패: ${kind}`, {
      level: 'warning',
      extra: { kind, error: message.slice(0, 300) },
    })
  } catch {
    /* 관측 실패가 흐름을 막지 않는다 */
  }
}
