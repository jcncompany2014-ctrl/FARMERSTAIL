import type { createAdminClient } from '@/lib/supabase/admin'
import { recordAdminAlert } from '@/lib/admin/alert-record'
import { keyExpiryAlert, type KeyExpiryState } from '@/lib/admin/key-expiry'

/**
 * 외부 키 만료 경보를 경보함에 올린다 — 아침 브리핑(daily-briefing)이 하루 한 번 부른다 (2026-10-14 어드민 B4, 규칙252).
 *
 * 7·3·1일 전·만료 단계마다 **한 번만** 적는다: 대상 열쇠(key:이름:만료일:단계)로 이미 적힌 줄이 있으면(처리했어도) 건너뛴다.
 * 그래서 크론이 하루 빠져도 다음 날 같은 단계로 한 번 적히고, 매일 같은 줄이 쌓이지 않는다. 키를 새로 받아 만료일이 바뀌면
 * 열쇠가 달라져 다시 7일 전부터 센다. 키 값은 다루지 않는다(날짜만).
 * 실패해도 던지지 않는다 — 브리핑은 계속 나가고, 못 적은 사실은 failures 로 돌려준다.
 */
export async function raiseKeyExpiryAlerts(
  db: ReturnType<typeof createAdminClient>,
  states: readonly KeyExpiryState[],
): Promise<{ raised: number; failures: string[] }> {
  const failures: string[] = []
  let raised = 0
  for (const s of states) {
    const a = keyExpiryAlert(s)
    if (!a) continue
    const { data, error } = await db
      .from('admin_alerts')
      .select('id')
      .eq('kind', 'ops.key_expiring')
      .eq('target_key', a.targetKey)
      .limit(1)
    if (error) {
      failures.push(`키 만료 경보 확인(${s.name}): ${error.message}`)
      continue
    }
    if ((data ?? []).length > 0) continue
    const r = await recordAdminAlert(a.level, 'ops.key_expiring', { targetKey: a.targetKey, detail: a.detail, key: s.name })
    if (r.ok) raised++
    else failures.push(`키 만료 경보 기록(${s.name}): ${r.error}`)
  }
  return { raised, failures }
}
