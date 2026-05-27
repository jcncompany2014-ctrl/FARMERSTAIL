/**
 * Supabase Realtime helpers (R15-B17/B18).
 *
 * postgres_changes 채널 subscribe — INSERT/UPDATE/DELETE 발생 시 callback.
 * channel unsubscribe 는 returned cleanup 함수로.
 *
 * # 사용
 *
 *   useEffect(() => {
 *     const cleanup = subscribeWeightLogs(supabase, userId, (log) => {
 *       setLogs((prev) => [log, ...prev])
 *     })
 *     return cleanup
 *   }, [supabase, userId])
 */

import type {
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresInsertPayload,
} from '@supabase/supabase-js'
import { REALTIME_LISTEN_TYPES } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, 'public', any>

export interface WeightLogRow {
  id: string
  dog_id: string
  user_id: string
  weight: number
  measured_at: string
  note: string | null
}

/**
 * weight_logs INSERT 구독. user_id 로 필터.
 * 다른 기기에서 체중 입력 시 즉시 dashboard 에 반영.
 */
export function subscribeWeightLogs(
  supabase: AnyClient,
  userId: string,
  onInsert: (row: WeightLogRow) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`weight_logs:${userId}`)
    .on<WeightLogRow>(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'weight_logs',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresInsertPayload<WeightLogRow>) => {
        if (payload?.new) onInsert(payload.new)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel).catch(() => {
      /* ignore */
    })
  }
}

export interface NotificationRow {
  id: string
  user_id: string
  kind: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

/**
 * notifications INSERT 구독. 새 알림 도착 시 NotificationCenter 업데이트.
 */
export function subscribeNotifications(
  supabase: AnyClient,
  userId: string,
  onInsert: (row: NotificationRow) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}`)
    .on<NotificationRow>(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresInsertPayload<NotificationRow>) => {
        if (payload?.new) onInsert(payload.new)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel).catch(() => {
      /* ignore */
    })
  }
}
