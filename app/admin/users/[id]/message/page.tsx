import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MessageComposer from './MessageComposer'
import AdminNoteCard from './AdminNoteCard'
import { Hl, LoadError } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

/**
 * /admin/users/[id]/message — 어드민이 단일 사용자에게 1:1 푸시 메시지 발송.
 *
 * CS 시나리오:
 *   - 환불 처리 안내
 *   - 배송 지연 사과 / 보상 포인트 적립 안내
 *   - 정기배송 결제 실패 알림
 *   - 개별 케어 안내 (특정 강아지 식단 변경 등)
 *
 * 사용자의 마지막 push_log 50건을 함께 보여줘 어떤 메시지를 받았는지
 * 컨텍스트 확인.
 */
export default async function AdminUserMessagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 규칙1 — error 를 버리면 프로필 조회 실패가 404 로, 이력 조회 실패가
  // "발송된 알림 없음"으로 위장한다.
  const [
    { data: profile, error: profileErr },
    { data: pushLog, error: pushLogErr },
    { data: csThread, error: csThreadErr },
  ] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, name, phone, admin_note')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('push_log')
        .select('id, title, body, category, sent_at, read_at')
        .eq('user_id', id)
        .order('sent_at', { ascending: false })
        .limit(50),
      supabase
        .from('cs_messages')
        .select('id, sender, body, created_at, read_at')
        .eq('user_id', id)
        .order('created_at', { ascending: true })
        .limit(100),
    ])

  if (profileErr) throw new Error(`프로필 조회 실패: ${profileErr.message}`)
  if (!profile) notFound()

  // 사용자가 보낸 미확인 메시지가 있으면 read 처리 — admin 이 thread 본 시점.
  await supabase
    .from('cs_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', id)
    .eq('sender', 'user')
    .is('read_at', null)

  const recent = (pushLog ?? []) as Array<{
    id: string
    title: string
    body: string
    category: string | null
    sent_at: string
    read_at: string | null
  }>

  const thread = ((csThread ?? []) as unknown) as Array<{
    id: string
    sender: 'admin' | 'user'
    body: string
    created_at: string
    read_at: string | null
  }>

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">
            1:1 메시지 — {profile.name ?? '(이름 없음)'}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <Hl>이 고객에게 앱 알림으로 직접 메시지를 보내는 곳</Hl>이에요. 고객이
            답장하면 &lsquo;고객 답장&rsquo; 탭에 떠요. —{' '}
            {profile.email ?? '—'} · {profile.phone ?? '—'}
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-[11px] text-muted-foreground hover:text-primary font-semibold"
        >
          ← 회원 목록
        </Link>
      </header>

      {/* 계획 A-F5 — 이 고객과 대화하기 전에 맥락부터 보이게 최상단. */}
      <AdminNoteCard
        userId={id}
        initial={
          (profile as { admin_note?: string | null }).admin_note ?? null
        }
      />

      {(pushLogErr || csThreadErr) && (
        <div className="mb-6">
          <LoadError
            what={csThreadErr ? '대화 내역' : '발송 이력'}
            hint="비어 보여도 기록이 없는 게 아니에요 — 조회가 실패했어요. 새로고침해 주세요."
          />
        </div>
      )}

      {/* CS 양방향 thread — 사용자 답장 + admin 답변 history */}
      {thread.length > 0 && (
        <section className="mb-6">
          <h2 className="text-[13px] font-black text-foreground mb-3">
            대화 내역 ({thread.length}건)
          </h2>
          <ul className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-2.5 max-h-[400px] overflow-y-auto">
            {thread.map((m) => {
              const mine = m.sender === 'admin'
              return (
                <li
                  key={m.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3.5 py-2.5 ${
                      mine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary text-foreground rounded-bl-md border border-border'
                    }`}
                  >
                    <p className="text-[10px] font-bold mb-0.5 opacity-70">
                      {mine ? 'admin' : '사용자'}
                    </p>
                    <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-keep">
                      {m.body}
                    </p>
                    <p
                      className={`text-[9.5px] mt-1 ${
                        mine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(m.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composer */}
        <section>
          <h2 className="text-[13px] font-black text-foreground mb-3">메시지 작성</h2>
          <MessageComposer userId={id} />
          <div className="mt-3 p-3 rounded-xl bg-secondary border border-border">
            <p className="text-[11px] text-foreground leading-relaxed">
              ⚠️ 1:1 CS 메시지는 사용자의 알림 선호도/방해금지 시간대를 우회해
              발송됩니다. 환불/배송지연 같은 critical 안내에만 사용하세요.
              사용자가 답장하면 위 대화 내역에 누적됩니다.
            </p>
          </div>
        </section>

        {/* History */}
        <section>
          <h2 className="text-[13px] font-black text-foreground mb-3">
            최근 발송 이력 (최대 50건)
          </h2>
          {recent.length === 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
              <p className="text-[12px] text-muted-foreground">
                아직 이 사용자에게 발송된 알림이 없어요.
              </p>
            </div>
          ) : (
            <ul className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="border-b border-border last:border-b-0 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold text-foreground truncate">
                      {r.title}
                    </p>
                    <span
                      className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${
                        r.read_at
                          ? 'bg-emerald-600/10 text-emerald-700'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {r.read_at ? '읽음' : '미확인'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {r.body}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {r.category && (
                      <span className="text-[10.5px] font-bold text-primary">
                        {r.category}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(r.sent_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
