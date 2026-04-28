'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail, MessageSquare, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MARKETING_POLICY_VERSION, CONSENT_LABEL } from '@/lib/consent'

/**
 * 광고·마케팅 수신동의 관리 UI.
 *
 * 구조:
 *   • 상단 메타 (현재 상태 + 동의 일자)
 *   • 채널별 토글 (이메일 / SMS)
 *   • 최근 변경 이력 (consent_log 10건)
 *
 * 저장은 `set_marketing_consent` RPC 를 호출해 profiles + consent_log 동시 갱신.
 * 실패 시 원복 낙관적 업데이트.
 */

type Channel = 'email' | 'sms'

type Initial = {
  agree_email: boolean
  agree_sms: boolean
  agree_email_at: string | null
  agree_sms_at: string | null
  marketing_policy_version: string | null
}

type HistoryRow = {
  id: string
  channel: Channel
  granted: boolean
  granted_at: string
  policy_version: string | null
  source: string | null
}

export default function ConsentSettingsClient({
  initial,
  history,
}: {
  initial: Initial
  history: HistoryRow[]
}) {
  const supabase = createClient()

  const [state, setState] = useState<Initial>(initial)
  const [hist, setHist] = useState<HistoryRow[]>(history)
  const [saving, setSaving] = useState<Channel | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(channel: Channel, next: boolean) {
    setError(null)
    setSaving(channel)
    const prev = state
    // 낙관적 업데이트
    setState((s) => ({
      ...s,
      [channel === 'email' ? 'agree_email' : 'agree_sms']: next,
      [channel === 'email' ? 'agree_email_at' : 'agree_sms_at']: next
        ? new Date().toISOString()
        : null,
      marketing_policy_version: next ? MARKETING_POLICY_VERSION : s.marketing_policy_version,
    }))

    const { error: rpcErr } = await supabase.rpc('set_marketing_consent', {
      p_channel: channel,
      p_granted: next,
      p_policy_version: MARKETING_POLICY_VERSION,
      p_source: 'mypage',
    })
    if (rpcErr) {
      setState(prev)
      setError(rpcErr.message ?? '저장에 실패했어요')
      setSaving(null)
      return
    }
    // 이력 리로드 — 최신 10건.
    const { data: fresh } = await supabase
      .from('consent_log')
      .select('id, channel, granted, granted_at, policy_version, source')
      .order('granted_at', { ascending: false })
      .limit(10)
    if (fresh) {
      setHist(
        fresh.map((r) => ({
          id: r.id,
          channel: r.channel as Channel,
          granted: Boolean(r.granted),
          granted_at: r.granted_at,
          policy_version: r.policy_version ?? null,
          source: r.source ?? null,
        })),
      )
    }
    setSaving(null)
  }

  return (
    <main className="pb-10">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 마이페이지
        </Link>
        <span className="kicker mt-3 block">Consent · 수신동의</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          광고·마케팅 수신 설정
        </h1>
        <p className="text-[11px] text-muted mt-1 leading-relaxed">
          혜택·이벤트 안내 수신 여부를 채널별로 관리할 수 있어요.
          <br />
          주문/배송/환불 등 거래 정보 안내는 이 설정과 무관하게 전송됩니다.
        </p>
      </section>

      <section className="px-5 mt-4 space-y-3">
        <ConsentRow
          icon={<Mail className="w-4 h-4" strokeWidth={2} />}
          label={CONSENT_LABEL.email}
          on={state.agree_email}
          at={state.agree_email_at}
          saving={saving === 'email'}
          onChange={(v) => toggle('email', v)}
        />
        <ConsentRow
          icon={<MessageSquare className="w-4 h-4" strokeWidth={2} />}
          label={CONSENT_LABEL.sms}
          on={state.agree_sms}
          at={state.agree_sms_at}
          saving={saving === 'sms'}
          onChange={(v) => toggle('sms', v)}
        />
      </section>

      {error && (
        <section className="px-5 mt-3">
          <div
            className="text-[12px] font-bold rounded-lg px-3.5 py-2.5 flex items-start gap-2"
            style={{
              color: 'var(--sale)',
              background: 'color-mix(in srgb, var(--sale) 6%, transparent)',
            }}
          >
            <AlertCircle
              className="w-3.5 h-3.5 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span>{error}</span>
          </div>
        </section>
      )}

      <section className="px-5 mt-6">
        <div className="mb-2">
          <span className="kicker kicker-muted">History · 최근 변경 이력</span>
        </div>
        {hist.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-rule-2 p-6 text-center">
            <p className="text-[11px] text-muted">변경 이력이 없어요.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {hist.map((h) => (
              <li
                key={h.id}
                className="bg-white rounded-xl border border-rule px-4 py-3 flex items-start gap-3"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    h.granted ? 'bg-moss/10' : 'bg-bg'
                  }`}
                >
                  {h.granted ? (
                    <Check className="w-3 h-3 text-moss" strokeWidth={3} />
                  ) : (
                    <span className="text-muted text-[10px] font-black">
                      ✕
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-bold text-text">
                    {CONSENT_LABEL[h.channel]}{' '}
                    {h.granted ? '동의' : '철회'}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {new Date(h.granted_at).toLocaleString('ko-KR')}
                    {h.policy_version ? ` · ${h.policy_version}` : ''}
                    {h.source ? ` · ${h.source}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-muted mt-3 leading-relaxed">
          수신동의는 언제든 철회할 수 있으며, 철회 즉시 해당 채널의 광고·마케팅
          정보 발송이 중단됩니다.
        </p>
      </section>
    </main>
  )
}

function ConsentRow({
  icon,
  label,
  on,
  at,
  saving,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  on: boolean
  at: string | null
  saving: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-rule p-5">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            on ? 'bg-terracotta/10 text-terracotta' : 'bg-bg text-muted'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-black text-text">{label}</p>
          <p className="text-[10px] text-muted mt-0.5 leading-relaxed">
            {on && at
              ? `${new Date(at).toLocaleDateString('ko-KR')} 동의`
              : '현재 미동의'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(!on)}
          disabled={saving}
          role="switch"
          aria-checked={on}
          aria-label={label}
          className={`relative w-10 h-6 rounded-full transition shrink-0 mt-1 ${
            on ? 'bg-moss' : 'bg-rule'
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
              on ? 'left-[18px]' : 'left-0.5'
            }`}
          />
          {saving && (
            <Loader2
              className="absolute inset-0 m-auto w-3 h-3 animate-spin text-white"
              strokeWidth={2.5}
            />
          )}
        </button>
      </div>
    </div>
  )
}
