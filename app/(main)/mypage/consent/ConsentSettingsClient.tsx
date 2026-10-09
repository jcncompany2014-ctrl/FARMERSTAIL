'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MARKETING_POLICY_VERSION, CONSENT_LABEL } from '@/lib/consent'
import { formatKstLongDate } from '@/lib/datetime-kst'
import { V3, V3Radius } from '@/lib/design/tokens'
import { RuleList, Toggle } from '@/components/v3/me/MeParts'
import { ChatSquareIcon, MailIcon } from '@/components/v3/me/MeIcons'

/**
 * 광고·마케팅 수신동의 관리 UI.
 *
 * 구조:
 *   • 상단 메타 (현재 상태 + 동의 일자)
 *   • 채널별 토글 (이메일 / SMS)
 *
 * 저장은 `set_marketing_consent` RPC 를 호출해 profiles + consent_log 동시 갱신.
 * 실패 시 원복 낙관적 업데이트.
 *
 * 변경 이력은 **화면에 안 보인다**(사장님 2026-07-31). 기록은 계속 남는다 —
 * 법정 보관 자료이고 /mypage/privacy 의 개인정보 다운로드(§35)로 받을 수 있다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 M13): 위 2px 먹선 목록 · 줄마다 동그라미 그림(켜짐 먹색) · 64×36 스위치.
 *   문구는 시안대로 — '현재 미동의' → '지금은 받지 않아요', 아래 안내의 "언제든 철회할 수 있으며"(금지어 '언제든')
 *   → "이 화면에서 바로 끌 수 있어요. 끄는 즉시 그 채널의 광고 발송이 멈춰요." 저장·통지 로직은 그대로.
 */

type Channel = 'email' | 'sms'

type Initial = {
  agree_email: boolean
  agree_sms: boolean
  agree_email_at: string | null
  agree_sms_at: string | null
  marketing_policy_version: string | null
}

export default function ConsentSettingsClient({
  initial,
  embedded,
}: {
  initial: Initial
  /** 통합 알림 페이지 탭 안에서 렌더될 때 true — 자체 헤더 숨김. */
  embedded?: boolean
}) {
  const supabase = createClient()

  const [state, setState] = useState<Initial>(initial)
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
      // audit #69 일관성 — 원본 RPC error message 노출 제거(서버 로그만).
      console.error('[consent] set_marketing_consent failed', rpcErr.message)
      setError('저장하지 못했어요')
      setSaving(null)
      return
    }

    // 정보통신망법 §50⑦ — 광고 수신 동의·거부 처리결과 통보 의무.
    // fire-and-forget — 실패해도 토글 자체는 RPC 로 이미 저장됐다.
    // ★동의(켜기)도 처리결과를 알린다 — §50⑦ 은 동의·거부 모두 14일 내 통지(2026-09-25).
    void fetch('/api/consent/unsubscribe-ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, granted: next }),
      keepalive: true,
    }).catch(() => {
      /* swallow */
    })

    setSaving(null)
  }

  return (
    <div>
      <p style={{ margin: '20px 20px 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
        {!embedded && (
          <>
            <strong style={{ fontWeight: 800, color: V3.ink }}>동의 설정</strong>
            <br />
          </>
        )}
        혜택·이벤트 안내를 받을지 채널마다 정할 수 있어요.
        <br />
        <strong style={{ fontWeight: 800, color: V3.ink }}>
          주문·배송·환불 같은 거래 안내는 이 설정과 상관없이 보내드려요.
        </strong>
      </p>

      <RuleList style={{ margin: '20px 20px 0' }}>
        <ConsentRow
          icon={<MailIcon size={20} />}
          label={CONSENT_LABEL.email}
          on={state.agree_email}
          at={state.agree_email_at}
          saving={saving === 'email'}
          onChange={(v) => toggle('email', v)}
        />
        <ConsentRow
          icon={<ChatSquareIcon size={20} />}
          label={CONSENT_LABEL.sms}
          on={state.agree_sms}
          at={state.agree_sms_at}
          saving={saving === 'sms'}
          onChange={(v) => toggle('sms', v)}
        />
      </RuleList>

      {error && (
        <p role="alert" style={{ margin: '12px 20px 0', fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: V3.sale }}>
          {error}
        </p>
      )}

      <p
        style={{
          margin: '20px 20px 0',
          padding: '14px 16px',
          borderRadius: V3Radius.sm,
          background: V3.soft,
          fontSize: 15,
          lineHeight: 1.55,
          color: V3.inkSoft,
        }}
      >
        수신 동의는 이 화면에서 바로 끌 수 있어요. 끄는 즉시 그 채널의 광고 발송이 멈춰요.
      </p>
    </div>
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
    <div
      style={{
        padding: '16px 0',
        borderBottom: `1px solid ${V3.rule}`,
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
          background: on ? V3.ink : V3.soft,
          color: on ? '#FFFFFF' : V3.inkMute,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35 }}>{label}</span>
        <span style={{ fontSize: 15, color: V3.inkMute }}>
          {on && at ? `${formatKstLongDate(at)} 동의` : on ? '받고 있어요' : '지금은 받지 않아요'}
        </span>
      </span>
      <Toggle on={on} disabled={saving} label={label} onClick={() => onChange(!on)} />
    </div>
  )
}
