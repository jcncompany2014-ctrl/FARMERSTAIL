/**
 * 카카오 알림톡 발송 어댑터 — 솔라피(전송만) + 우리 발송 기록(message_log).
 *
 * 우리가 책임지는 것: 언제·누구에게·무슨 내용(templates.ts)·한 번만(message_log unique)·기록.
 * 솔라피가 하는 것: 카카오로 전송.
 *
 * ★절대 throw 하지 않는다 — 호출 지점이 청구·환불 같은 돈 경로라, 알림 실패가 결제 기록을
 *   끊으면 안 된다(규칙: charge 크론의 푸시 예외 삼킴과 같은 원칙). 결과는 반환값으로.
 * ★보내기 **전에** message_log 에 자리를 잡는다 — 솔라피엔 멱등키가 없어 같은 이벤트가 두 번
 *   오면 두 번 나간다. unique 충돌(23505) = 이미 보낸 이벤트 → 건너뜀.
 * ★설정 전(키·채널 ID 없음) 또는 템플릿 승인 전(solapiTemplateId '')이면 기록도 남기지 않고
 *   건너뛴다 — 그래야 승인 뒤 같은 이벤트를 정상 발송할 수 있다.
 *
 * env: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_PFID(카카오 채널 연동 ID),
 *      SOLAPI_SENDER(선택 — 등록 발신번호, 있으면 smsFallback 템플릿만 문자 대체).
 */
import { SolapiMessageService } from 'solapi'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { isKoreanMobile, phoneDigits } from '@/lib/phone'
import { ALIMTALK_TEMPLATES, maskPhone, renderAlimtalk, type AlimtalkTemplateCode } from './templates'

export type AlimtalkConfig = {
  apiKey: string
  apiSecret: string
  pfId: string
  sender: string | null
}

export function alimtalkConfig(): AlimtalkConfig | null {
  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const pfId = process.env.SOLAPI_PFID?.trim()
  if (!apiKey || !apiSecret || !pfId) return null
  const sender = process.env.SOLAPI_SENDER?.trim()
  return { apiKey, apiSecret, pfId, sender: sender ? phoneDigits(sender) : null }
}

export type SendAlimtalkInput = {
  userId?: string | null
  /** 이벤트 종류 — 예: 'order.shipped'. source_id 와 함께 "한 번만"의 기준. */
  eventType: string
  /** 이벤트 원천 ID — 주문 ID·청구 ID 등. 같은 (eventType, sourceId) 는 한 번만 발송. */
  sourceId: string
  to: string
  code: AlimtalkTemplateCode
  values: Record<string, string | number>
}

export type SendAlimtalkResult =
  | { ok: true; logId: string }
  | { ok: false; skipped: 'unconfigured' | 'template_pending' | 'duplicate' | 'bad_phone' | 'bad_values' }
  | { ok: false; failed: true; logId?: string; error: string }

export async function sendAlimtalk(input: SendAlimtalkInput): Promise<SendAlimtalkResult> {
  const cfg = alimtalkConfig()
  if (!cfg) return { ok: false, skipped: 'unconfigured' }
  const template = ALIMTALK_TEMPLATES[input.code]
  if (!template.solapiTemplateId) return { ok: false, skipped: 'template_pending' }

  const to = phoneDigits(input.to ?? '')
  if (!isKoreanMobile(to)) return { ok: false, skipped: 'bad_phone' }

  const rendered = renderAlimtalk(input.code, input.values)
  if (!rendered.ok) {
    captureBusinessEvent('error', 'notify.alimtalk.bad_values', {
      eventType: input.eventType,
      sourceId: input.sourceId,
      code: input.code,
      missing: rendered.missing.join(','),
      tooLong: rendered.tooLong,
    })
    return { ok: false, skipped: 'bad_values' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, failed: true, error: 'ADMIN_CLIENT_UNAVAILABLE' }
  }

  // 1) 자리 잡기 — 이미 있으면(같은 이벤트) 보내지 않는다.
  const { data: row, error: insErr } = await admin
    .from('message_log')
    .insert({
      user_id: input.userId ?? null,
      event_type: input.eventType,
      source_id: input.sourceId,
      channel: 'alimtalk',
      template_code: input.code,
      to_masked: maskPhone(to),
      status: 'pending',
    })
    .select('id')
    .single()
  if (insErr) {
    if ((insErr as { code?: string }).code === '23505') return { ok: false, skipped: 'duplicate' }
    captureBusinessEvent('error', 'notify.alimtalk.log_insert_failed', {
      eventType: input.eventType,
      sourceId: input.sourceId,
      dbError: insErr.message,
    })
    return { ok: false, failed: true, error: 'LOG_INSERT_FAILED' }
  }
  const logId = row.id as string

  // 2) 전송.
  const useSms = template.smsFallback && !!cfg.sender
  try {
    const svc = new SolapiMessageService(cfg.apiKey, cfg.apiSecret)
    const res = await svc.send(
      {
        to,
        ...(useSms ? { from: cfg.sender! } : {}),
        kakaoOptions: {
          pfId: cfg.pfId,
          templateId: template.solapiTemplateId,
          variables: rendered.variables,
          disableSms: !useSms,
        },
        customFields: { logId },
      },
      { showMessageList: true },
    )
    const accepted = res.messageList?.[0]
    const failed = res.failedMessageList?.[0]
    if (failed || !accepted) {
      const code = failed?.statusCode ?? 'NO_MESSAGE'
      await admin
        .from('message_log')
        .update({ status: 'failed', status_code: code, error: failed?.statusMessage ?? null, updated_at: new Date().toISOString() })
        .eq('id', logId)
      captureBusinessEvent('warning', 'notify.alimtalk.not_accepted', {
        eventType: input.eventType,
        sourceId: input.sourceId,
        code: input.code,
        statusCode: code,
      })
      return { ok: false, failed: true, logId, error: code }
    }
    const { error: updErr } = await admin
      .from('message_log')
      .update({
        status: 'accepted',
        provider_message_id: accepted.messageId,
        status_code: accepted.statusCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', logId)
    if (updErr) {
      // 발송은 됐다 — 기록 갱신만 실패. 웹훅이 messageId 로 못 찾으니 알린다.
      captureBusinessEvent('warning', 'notify.alimtalk.log_update_failed', { logId, dbError: updErr.message })
    }
    return { ok: true, logId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : 'unknown'
    await admin
      .from('message_log')
      .update({ status: 'failed', error: msg, updated_at: new Date().toISOString() })
      .eq('id', logId)
    captureBusinessEvent('error', 'notify.alimtalk.send_threw', {
      eventType: input.eventType,
      sourceId: input.sourceId,
      code: input.code,
      error: msg,
    })
    return { ok: false, failed: true, logId, error: msg }
  }
}
