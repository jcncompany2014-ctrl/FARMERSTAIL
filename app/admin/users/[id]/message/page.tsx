import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MessageComposer from './MessageComposer'

export const dynamic = 'force-dynamic'

/**
 * /admin/users/[id]/message — 어드민이 단일 사용자에게 1:1 푸시 메시지 발송.
 *
 * CS 시나리오:
 *   - 환불 처리 안내
 *   - 배송 지연 사과 / 보상 쿠폰 발급 안내
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

  const [{ data: profile }, { data: pushLog }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, name, phone')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('push_log')
      .select('id, title, body, category, sent_at, read_at')
      .eq('user_id', id)
      .order('sent_at', { ascending: false })
      .limit(50),
  ])

  if (!profile) notFound()

  const recent = (pushLog ?? []) as Array<{
    id: string
    title: string
    body: string
    category: string | null
    sent_at: string
    read_at: string | null
  }>

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-widest font-bold">
            User Messaging · 1:1 알림 발송
          </p>
          <h1 className="text-2xl font-black text-text mt-1">
            {profile.name ?? '(이름 없음)'}
          </h1>
          <p className="text-[12px] text-muted mt-1">
            {profile.email ?? '—'} · {profile.phone ?? '—'}
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          ← 회원 목록
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composer */}
        <section>
          <h2 className="text-[13px] font-black text-text mb-3">메시지 작성</h2>
          <MessageComposer userId={id} />
          <div className="mt-3 p-3 rounded-xl bg-bg-2 border border-rule">
            <p className="text-[11px] text-text leading-relaxed">
              ⚠️ 1:1 CS 메시지는 사용자의 알림 선호도/방해금지 시간대를 우회해
              발송됩니다. 환불/배송지연 같은 critical 안내에만 사용하세요.
            </p>
          </div>
        </section>

        {/* History */}
        <section>
          <h2 className="text-[13px] font-black text-text mb-3">
            최근 발송 이력 (최대 50건)
          </h2>
          {recent.length === 0 ? (
            <div className="bg-white rounded-2xl border border-rule p-8 text-center">
              <p className="text-[12px] text-muted">
                아직 이 사용자에게 발송된 알림이 없어요.
              </p>
            </div>
          ) : (
            <ul className="bg-white rounded-2xl border border-rule overflow-hidden">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="border-b border-rule last:border-b-0 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold text-text truncate">
                      {r.title}
                    </p>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        r.read_at
                          ? 'bg-moss/10 text-moss'
                          : 'bg-rule text-muted'
                      }`}
                    >
                      {r.read_at ? '읽음' : '미확인'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1 line-clamp-2">
                    {r.body}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {r.category && (
                      <span className="text-[9px] uppercase tracking-widest font-bold text-terracotta">
                        {r.category}
                      </span>
                    )}
                    <span className="text-[10px] text-muted font-mono">
                      {new Date(r.sent_at).toLocaleString('ko-KR')}
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
