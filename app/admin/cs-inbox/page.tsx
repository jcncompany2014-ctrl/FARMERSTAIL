import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Inbox, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

/**
 * /admin/cs-inbox — 사용자가 답장 보낸 미확인 CS 메시지 inbox.
 *
 * 1:1 메시지 양방향 sender='user' AND read_at IS NULL 큐. 최근 50개.
 * 클릭 시 해당 사용자 1:1 message 페이지 (/admin/users/[id]/message) 로 이동
 * 거기서 thread 보고 답변 발송.
 */
export default async function AdminCsInboxPage() {
  const supabase = await createClient()

  // 사용자별 마지막 unread 메시지 1개씩만 그룹핑 — 같은 사용자가 여러 번 답장
  // 보냈을 때 inbox 가 도배되지 않게.
  const { data: rawMessages } = await supabase
    .from('cs_messages')
    .select('id, user_id, body, created_at')
    .eq('sender', 'user')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  type Row = {
    id: string
    user_id: string
    body: string
    created_at: string
  }
  const all = (rawMessages ?? []) as Row[]
  // 사용자별 최신 1행 + 안읽음 개수. (2026-07-19 검수: 이전엔 두 루프가 겹쳐
  // 더해 안읽음 3개가 5개로 표시되는 이중 카운트 버그가 있었다.)
  const grouped: (Row & { unreadCount: number })[] = []
  const byUser = new Map<string, Row & { unreadCount: number }>()
  for (const m of all) {
    const g = byUser.get(m.user_id)
    if (g) {
      g.unreadCount += 1
    } else {
      const row = { ...m, unreadCount: 1 }
      byUser.set(m.user_id, row)
      grouped.push(row)
    }
  }

  // 사용자 프로필 일괄 fetch.
  const userIds = grouped.map((g) => g.user_id)
  let profilesById = new Map<
    string,
    { name: string | null; email: string | null }
  >()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds)
    profilesById = new Map(
      ((profiles ?? []) as Array<{
        id: string
        name: string | null
        email: string | null
      }>).map((p) => [p.id, { name: p.name, email: p.email }]),
    )
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-widest font-bold">
            미확인 답장
          </p>
          <h1 className="text-2xl font-black text-text mt-1">
            고객 답장 인박스
          </h1>
          <p className="text-[12px] text-muted mt-1">
            사용자가 1:1 메시지에 답장한 미확인 큐 — {grouped.length}명
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          ← 대시보드
        </Link>
      </header>

      {grouped.length === 0 ? (
        <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center">
          <Inbox
            className="w-10 h-10 text-muted mx-auto mb-3"
            strokeWidth={1.3}
          />
          <p className="text-[13px] font-bold text-text">
            모든 답장을 확인했어요
          </p>
          <p className="text-[11px] text-muted mt-1">
            사용자가 보낸 새 메시지가 들어오면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <ul className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          {grouped.map((g) => {
            const p = profilesById.get(g.user_id)
            return (
              <li
                key={g.id}
                className="border-b border-zinc-200 last:border-b-0"
              >
                <Link
                  href={`/admin/users/${g.user_id}/message`}
                  className="block px-4 py-4 hover:bg-bg-2/40 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[13px] font-bold text-text">
                          {p?.name ?? '(이름 없음)'}
                        </p>
                        {g.unreadCount > 1 && (
                          <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full bg-sale">
                            +{g.unreadCount - 1}
                          </span>
                        )}
                        <span className="text-[10px] text-muted font-mono">
                          {p?.email ?? '—'}
                        </span>
                      </div>
                      <p className="text-[12px] text-text leading-relaxed line-clamp-2">
                        {g.body}
                      </p>
                      <p className="text-[10px] text-muted font-mono mt-1">
                        {new Date(g.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </p>
                    </div>
                    <ArrowRight
                      className="w-4 h-4 text-terracotta shrink-0"
                      strokeWidth={2.5}
                    />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
