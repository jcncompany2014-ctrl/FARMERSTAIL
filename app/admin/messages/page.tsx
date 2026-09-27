import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { AdminCard, AdminHeader, Badge, LoadError, SectionTitle } from '@/components/admin/ui'
import { alimtalkConfig } from '@/lib/notify/alimtalk'
import { ALIMTALK_TEMPLATES } from '@/lib/notify/templates'

/**
 * /admin/messages — 알림톡 준비 상태 + 발송 내역 (2026-09-28).
 * 준비 상태: 솔라피 키·채널 연동·템플릿 승인(코드에 템플릿 ID 반영) — 사장님 콘솔 작업 진행표.
 * 발송 내역: message_log 최근 200건(번호는 마스킹).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '알림톡',
  robots: { index: false, follow: false },
}

const STATUS_LABEL: Record<string, { tone: 'green' | 'blue' | 'red' | 'neutral'; text: string }> = {
  delivered: { tone: 'green', text: '받음' },
  accepted: { tone: 'blue', text: '보냄(결과 대기)' },
  pending: { tone: 'neutral', text: '보내는 중' },
  failed: { tone: 'red', text: '실패' },
}

const fmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function AdminMessagesPage() {
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/messages')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const cfg = alimtalkConfig()
  const templates = Object.values(ALIMTALK_TEMPLATES)
  const approved = templates.filter((t) => t.solapiTemplateId).length
  const webhookReady = !!process.env.SOLAPI_WEBHOOK_TOKEN?.trim()

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('message_log')
    .select('id, created_at, event_type, template_code, to_masked, status, status_code, error')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <>
      <AdminHeader title="알림톡" sub="카카오 알림톡 준비 상태와 발송 내역 — 자사몰 고객 대상 정보성 안내" />
      <div className="grid gap-4">
        <AdminCard>
          <SectionTitle title="준비 상태" />
          <ul className="grid gap-2 text-[14px]">
            <li className="flex items-center gap-2">
              {cfg ? <Badge tone="green">완료</Badge> : <Badge tone="neutral">대기</Badge>}
              솔라피 키 · 카카오 채널 연동
            </li>
            <li className="flex items-center gap-2">
              {cfg?.sender ? <Badge tone="green">완료</Badge> : <Badge tone="neutral">선택</Badge>}
              발신번호(결제 실패 안내만 문자 대신 발송)
            </li>
            <li className="flex items-center gap-2">
              {webhookReady ? <Badge tone="green">완료</Badge> : <Badge tone="neutral">대기</Badge>}
              발송 결과 웹훅
            </li>
            <li className="flex items-center gap-2">
              {approved === templates.length ? (
                <Badge tone="green">완료</Badge>
              ) : (
                <Badge tone="neutral">
                  {approved}/{templates.length}
                </Badge>
              )}
              템플릿 승인
            </li>
          </ul>
          <ul className="mt-3 grid gap-1 text-[13px] text-[color:var(--adminui-mute)]">
            {templates.map((t) => (
              <li key={t.code}>
                {t.solapiTemplateId ? '✓' : '·'} {t.name} <span className="opacity-70">({t.code})</span>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard>
          <SectionTitle title={`발송 내역 ${rows?.length ?? 0}건`} />
          {error ? (
            <LoadError what="발송 내역" />
          ) : !rows || rows.length === 0 ? (
            <p className="text-[13px] text-[color:var(--adminui-mute)]">아직 보낸 알림톡이 없어요.</p>
          ) : (
            <ul className="grid gap-2">
              {rows.map((r) => {
                const s = STATUS_LABEL[r.status] ?? { tone: 'neutral' as const, text: r.status }
                const t = ALIMTALK_TEMPLATES[r.template_code as keyof typeof ALIMTALK_TEMPLATES]
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-[color:var(--adminui-line)] px-3 py-2 text-[13px]"
                  >
                    <span className="min-w-0">
                      <b>{t?.name ?? r.template_code}</b>{' '}
                      <span className="text-[color:var(--adminui-mute)]">
                        {r.to_masked} · {fmt.format(new Date(r.created_at))}
                      </span>
                      {r.status === 'failed' && (r.error || r.status_code) && (
                        <span className="ml-2 text-red-600">
                          {r.status_code ?? ''} {r.error ?? ''}
                        </span>
                      )}
                    </span>
                    <Badge tone={s.tone}>{s.text}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </AdminCard>
      </div>
    </>
  )
}
