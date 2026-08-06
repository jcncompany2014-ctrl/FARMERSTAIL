'use client'

import { useState } from 'react'
import { Loader2, Mail, MessageSquare, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MARKETING_POLICY_VERSION, CONSENT_LABEL } from '@/lib/consent'
import { formatKstLongDate } from '@/lib/datetime-kst'

/**
 * 광고·마케팅 수신동의 — **웹 톤** client.
 *
 * 앱 화면(`app/(main)/mypage/consent/ConsentSettingsClient.tsx`)을 재사용하지
 * 않는 이유는 `/account/subscriptions` 와 같다: 그쪽은 v3 앱 토큰(bg-bg-3 ·
 * text-text · kicker)으로 그려져 웹 FD 톤과 섞이지 않는다. **서버 계약은 공유**
 * 한다 — `set_marketing_consent` RPC · `/api/consent/unsubscribe-ack`.
 * 즉 갈라지는 건 시각뿐이고 저장 경로는 하나다.
 *
 * 변경 이력(consent_log)은 **화면에 안 보인다**(사장님 2026-07-31). 기록 자체는
 * RPC 가 계속 남긴다 — 법정 보관 자료이고, 고객은 /mypage/privacy 의 개인정보
 * 다운로드(§35 열람권)로 받아볼 수 있다. 뺀 건 표시뿐이다.
 */

type Channel = 'email' | 'sms'

type Initial = {
  agree_email: boolean
  agree_sms: boolean
  agree_email_at: string | null
  agree_sms_at: string | null
  marketing_policy_version: string | null
}

export default function ConsentWebClient({ initial }: { initial: Initial }) {
  const supabase = createClient()

  const [state, setState] = useState<Initial>(initial)
  const [saving, setSaving] = useState<Channel | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(channel: Channel, next: boolean) {
    setError(null)
    setSaving(channel)
    const prev = state
    setState((s) => ({
      ...s,
      [channel === 'email' ? 'agree_email' : 'agree_sms']: next,
      [channel === 'email' ? 'agree_email_at' : 'agree_sms_at']: next
        ? new Date().toISOString()
        : null,
      marketing_policy_version: next
        ? MARKETING_POLICY_VERSION
        : s.marketing_policy_version,
    }))

    const { error: rpcErr } = await supabase.rpc('set_marketing_consent', {
      p_channel: channel,
      p_granted: next,
      p_policy_version: MARKETING_POLICY_VERSION,
      p_source: 'account',
    })
    if (rpcErr) {
      setState(prev)
      console.error('[consent] set_marketing_consent failed', rpcErr.message)
      setError('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
      setSaving(null)
      return
    }

    // 정보통신망법 §50⑤ — 수신거부 처리결과 통보. fire-and-forget.
    if (!next) {
      void fetch('/api/consent/unsubscribe-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      }).catch(() => {
        /* swallow — 토글은 RPC 로 이미 저장됐다 */
      })
    }

    setSaving(null)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-col gap-3">
        <ConsentCard
          icon={<Mail className="w-4 h-4" strokeWidth={2} />}
          label={CONSENT_LABEL.email}
          on={state.agree_email}
          at={state.agree_email_at}
          saving={saving === 'email'}
          onChange={(v) => toggle('email', v)}
        />
        <ConsentCard
          icon={<MessageSquare className="w-4 h-4" strokeWidth={2} />}
          label={CONSENT_LABEL.sms}
          on={state.agree_sms}
          at={state.agree_sms_at}
          saving={saving === 'sms'}
          onChange={(v) => toggle('sms', v)}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 text-[12px] font-bold rounded-[10px] px-3.5 py-2.5 flex items-start gap-2"
          style={{
            color: 'var(--fd-coral)',
            background: 'color-mix(in srgb, var(--fd-coral) 7%, transparent)',
          }}
        >
          <AlertCircle
            className="w-3.5 h-3.5 shrink-0 mt-0.5"
            strokeWidth={2.5}
          />
          <span>{error}</span>
        </div>
      )}

      {/*
        거래 안내는 이 설정으로 끌 수 없다 — 메일 푸터가 "수신을 원치 않으시면
        알림 설정에서 변경" 이라고만 말해서, 여기 왔는데 주문·배송 메일을 끄는
        토글이 없으면 "고장났다" 로 읽힌다. 없는 게 아니라 끌 수 없는 것임을 밝힌다.
      */}
      <p
        className="mt-5 text-[12px] leading-relaxed"
        style={{ color: 'var(--fd-muted)' }}
      >
        주문·배송·결제·환불 등 <strong>거래 안내는 이 설정과 무관하게</strong>{' '}
        계속 발송됩니다. 앱 푸시 알림(카테고리·조용시간·기기)은 앱의 알림 설정에서
        관리하실 수 있어요.
      </p>

      <p
        className="text-[11px] mt-3 leading-relaxed"
        style={{ color: 'var(--fd-muted)' }}
      >
        수신동의는 언제든 철회할 수 있으며, 철회 즉시 해당 채널의 광고·마케팅
        정보 발송이 중단됩니다.
      </p>
    </div>
  )
}

function ConsentCard({
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
    <div
      className="rounded-[14px] p-5"
      style={{
        background: '#FFFFFF',
        boxShadow: 'inset 0 0 0 1px var(--fd-line)',
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={
            on
              ? {
                  background:
                    'color-mix(in srgb, var(--fd-coral) 12%, transparent)',
                  color: 'var(--fd-coral)',
                }
              : { background: 'var(--fd-offwhite)', color: 'var(--fd-muted)' }
          }
          aria-hidden
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[13.5px] font-bold"
            style={{ color: 'var(--fd-pine)' }}
          >
            {label}
          </p>
          <p
            className="text-[11px] mt-0.5 leading-relaxed"
            style={{ color: 'var(--fd-muted)' }}
          >
            {on && at
              ? `${formatKstLongDate(at)} 동의`
              : on
                ? '수신 중'
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
          className="relative w-10 h-6 rounded-full transition shrink-0 mt-1 disabled:opacity-50"
          style={{ background: on ? 'var(--fd-pine)' : 'var(--fd-line)' }}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
              on ? 'left-[18px]' : 'left-0.5'
            }`}
            style={{ background: '#FFFFFF' }}
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
