/**
 * 서버 쓰기의 정기배송 변경 기록 — service_role 로 subscription_events 에 한 줄(2026-10-14 C3, 규칙255).
 *
 * # 언제 부르나
 * service_role 로 subscriptions 를 바꾼 **바로 뒤**. 그 쓰기는 auth.uid() 가 없어 DB 트리거가 건너뛴다
 * (마이그 20261014220100 — 청구 크론이 행마다 UPDATE 하므로 트리거는 로그인 쓰기만 본다). 누가 시켰는지는
 * 그 코드가 안다 — 고객 라우트면 'customer', 크론이면 'cron'.
 *
 * # 실패해도 본 동작을 막지 않는다
 * 기록은 덤이다. 고객의 비율 변경·카드 등록이 기록 실패로 500 이 되면 안 된다. 그래서 throw 하지 않고, 실패는
 * 사람이 볼 수 있게 Sentry 경고로만 남긴다(`.insert()` 는 throw 가 아니라 `{ error }` 를 돌려준다 — 규칙1·8).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import type { SubscriptionEventActor, SubscriptionEventKind } from '@/lib/subscription-events'

// 쓰기 대상 표는 types.ts 에 있지만 호출처마다 클라이언트 제네릭이 달라 넓게 받는다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, 'public', any>

export type SubscriptionEventInput = {
  subscriptionId: string
  /** 구독 주인. */
  userId: string
  actor: SubscriptionEventActor
  /** 실제로 누른 사람(고객 라우트면 고객 id). 크론은 생략. */
  actorUserId?: string | null
  kind: SubscriptionEventKind
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  /** 코드 위치 — 'api/subscriptions/fresh-ratio' 처럼. */
  source: string
}

export async function recordSubscriptionEvent(
  admin: AnyClient,
  input: SubscriptionEventInput,
): Promise<void> {
  try {
    const { error } = await admin.from('subscription_events').insert({
      subscription_id: input.subscriptionId,
      user_id: input.userId,
      actor: input.actor,
      actor_user_id: input.actorUserId ?? null,
      kind: input.kind,
      before: input.before ?? {},
      after: input.after ?? {},
      source: input.source,
    })
    if (error) {
      captureBusinessEvent('warning', 'subscription.events.record_failed', {
        subscriptionId: input.subscriptionId,
        kind: input.kind,
        source: input.source,
        dbError: error.message,
      })
    }
  } catch (e) {
    captureBusinessEvent('warning', 'subscription.events.record_failed', {
      subscriptionId: input.subscriptionId,
      kind: input.kind,
      source: input.source,
      dbError: e instanceof Error ? e.message : String(e),
    })
  }
}
