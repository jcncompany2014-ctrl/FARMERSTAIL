'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MARKETING_POLICY_VERSION, CONSENT_LABEL } from '@/lib/consent'
import { formatKstLongDate } from '@/lib/datetime-kst'

/**
 * 광고·마케팅 수신동의 — **웹** client(모양 = 웹 시안 WEB-A22, 2026-10-10 웹 리뉴얼).
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

    // 정보통신망법 §50⑦ — 광고 수신 동의·거부 처리결과 통보. fire-and-forget.
    // ★동의(켜기)도 처리결과를 알린다 — §50⑦ 은 동의·거부 모두 14일 내 통지(2026-09-25).
    void fetch('/api/consent/unsubscribe-ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, granted: next }),
      keepalive: true,
    }).catch(() => {
      /* swallow — 토글은 RPC 로 이미 저장됐다 */
    })

    setSaving(null)
  }

  // 모양 = 웹 시안 WEB-A22(2026-10-10 웹 리뉴얼) — 켜진 채널은 먹색 2px 테·검은 동그라미, 꺼진 채널은 회색 1px 테.
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ConsentCard
          id="consent-email"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          }
          label={CONSENT_LABEL.email}
          on={state.agree_email}
          at={state.agree_email_at}
          saving={saving === 'email'}
          onChange={(v) => toggle('email', v)}
        />
        <ConsentCard
          id="consent-sms"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 5h14v10H9l-4 4z" />
            </svg>
          }
          label={CONSENT_LABEL.sms}
          on={state.agree_sms}
          at={state.agree_sms_at}
          saving={saving === 'sms'}
          onChange={(v) => toggle('sms', v)}
        />
      </div>

      {error && (
        <p role="alert" style={{ margin: '12px 0 0', padding: '12px 14px', background: '#FDECEA', color: '#8A1F11', borderRadius: 4, fontSize: 15, fontWeight: 700 }}>
          {error}
        </p>
      )}

      {/*
        거래 안내는 이 설정으로 끌 수 없다 — 메일 푸터가 "수신을 원치 않으시면
        알림 설정에서 변경" 이라고만 말해서, 여기 왔는데 주문·배송 메일을 끄는
        토글이 없으면 "고장났다" 로 읽힌다. 없는 게 아니라 끌 수 없는 것임을 밝힌다.
      */}
      <p style={{ margin: '22px 0 0', padding: 16, borderRadius: 4, background: '#F6F4F5', fontSize: 16, lineHeight: 1.6, color: '#141414' }}>
        <strong style={{ fontWeight: 800 }}>주문·배송·결제·환불 같은 거래 안내</strong>는 이 설정과 상관없이 계속 보내드려요. 앱 푸시 알림(종류·조용한
        시간·기기)은 앱의 알림 설정에서 바꿀 수 있어요.
      </p>
      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.6, color: '#595959' }}>
        수신 동의는 이 화면에서 바로 끌 수 있고, 끄면 그 채널의 광고·마케팅 발송이 바로 멈춰요.
      </p>
    </div>
  )
}

function ConsentCard({
  id,
  icon,
  label,
  on,
  at,
  saving,
  onChange,
}: {
  id: string
  icon: React.ReactNode
  label: string
  on: boolean
  at: string | null
  saving: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div
      style={{
        minHeight: 88,
        boxSizing: 'border-box',
        padding: 16,
        borderRadius: 4,
        border: on ? '2px solid #141414' : '1px solid #BDBDBD',
        display: 'grid',
        gridTemplateColumns: '44px 1fr 64px',
        columnGap: 14,
        alignItems: 'center',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          background: on ? '#141414' : '#F6F4F5',
          color: on ? '#FFFFFF' : '#141414',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span id={id} style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35 }}>
          {label}
        </span>
        <span style={{ fontSize: 15, color: '#595959' }}>{on && at ? `${formatKstLongDate(at)} 동의` : on ? '받고 있어요' : '지금은 받지 않아요'}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        disabled={saving}
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        style={{
          position: 'relative',
          width: 64,
          height: 36,
          padding: 3,
          boxSizing: 'border-box',
          border: 0,
          borderRadius: 18,
          background: on ? '#141414' : '#BDBDBD',
          display: 'flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        <span style={{ width: 30, height: 30, borderRadius: 15, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} color="#141414" />}
        </span>
      </button>
    </div>
  )
}
