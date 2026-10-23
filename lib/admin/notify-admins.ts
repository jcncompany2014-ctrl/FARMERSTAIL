import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { subscriptionHref } from '@/lib/admin/customer-link'

/**
 * 사장님(관리자 전원) 폰에 **바로** 알린다 — 새 정기배송·가게 주문 결제·토요일 결제 결과 (2026-10-24).
 *
 * # 왜
 * 10/21·10/23 첫 정기배송 두 건이 들어왔는데 사장님 폰엔 아무것도 안 떴다("알림도 안 뜨고"). 사장님께 가는 건
 * 아침 9:40 운영 브리핑 하나뿐이었고, 새 주문이 들어온 **그 순간** 알리는 길은 처음부터 없었다.
 *
 * # 규칙
 * - 받는 사람 = admin_user_ids(아침 브리핑·첫 박스 체크인과 같은 정본, service_role 전용). 고객에게는 절대 안 간다.
 * - category 를 주지 않는다 — 운영 알림은 마케팅 선호·조용시간에 걸리면 안 된다(아침 브리핑과 같은 취급).
 * - **손님 흐름을 막지 않는다**: 절대 throw 하지 않고, 4초 안에 안 끝나면 기다리지 않는다. 실패는 로그·Sentry 로 남긴다
 *   (알림은 덧붙이는 길 — 주문·카드 등록 자체는 이미 끝났다).
 */
export type AdminNotice = { title: string; body: string; url: string; tag?: string }

const TIMEOUT_MS = 4000

export async function notifyAdmins(notice: AdminNotice, source: string): Promise<{ ok: boolean; sent: number }> {
  const run = async () => {
    let db: ReturnType<typeof createAdminClient>
    try {
      db = createAdminClient()
    } catch {
      return { ok: false, sent: 0 }
    }
    const { data: admins, error } = await db.rpc('admin_user_ids')
    if (error) {
      console.error(`[notify-admins:${source}] 관리자 조회 실패:`, error.message)
      captureBusinessEvent('warning', 'admin.notify.lookup_failed', { source, dbError: error.message })
      return { ok: false, sent: 0 }
    }
    let sent = 0
    for (const a of (admins ?? []) as Array<{ id: string }>) {
      const res = await pushToUser(a.id, notice)
      if (res.ok) sent += res.sent
    }
    if (sent === 0) {
      console.error(`[notify-admins:${source}] 사장님 폰 한 대에도 안 갔어요(아침 브리핑에는 뜬다)`)
      captureBusinessEvent('warning', 'admin.notify.not_delivered', { source, title: notice.title })
    }
    return { ok: sent > 0, sent }
  }
  try {
    return await Promise.race([
      run(),
      new Promise<{ ok: boolean; sent: number }>((resolve) => setTimeout(() => resolve({ ok: false, sent: 0 }), TIMEOUT_MS)),
    ])
  } catch (e) {
    console.error(`[notify-admins:${source}] 알림 실패:`, e instanceof Error ? e.message : e)
    return { ok: false, sent: 0 }
  }
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
const md = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${iso}T00:00:00+09:00`).getUTCDay()]
  return `${m}/${d}(${w})`
}

/** 새 정기배송(첫 카드 등록) 알림 문구 — 누가·얼마·언제 결제·언제 발송. 이름은 강아지만(보호자 실명은 폰 잠금 화면에 안 띄운다). */
export function newSubscriptionNotice(i: {
  subscriptionId: string
  userId: string
  dogName: string | null
  weightKg: number | null
  totalAmount: number | null
  chargeIso: string | null
  shipIso: string | null
}): AdminNotice {
  const who = [i.dogName, i.weightKg ? `${i.weightKg}kg` : null].filter(Boolean).join(' ')
  const parts = [
    i.totalAmount != null ? `2주 ${won(i.totalAmount)}` : null,
    i.chargeIso ? `결제 ${md(i.chargeIso)}` : null,
    i.shipIso ? `첫 발송 ${md(i.shipIso)}` : null,
  ].filter(Boolean)
  return {
    title: `새 정기배송이 들어왔어요${who ? ` — ${who}` : ''}`,
    body: parts.join(' · ') || '어드민에서 확인해 주세요.',
    // 정기배송 한 장(2026-10-24 규칙314) — 누가·몇 kg·얼마·언제가 첫 화면에.
    url: subscriptionHref(i.subscriptionId),
    tag: `admin-new-sub-${i.subscriptionId}`,
  }
}
