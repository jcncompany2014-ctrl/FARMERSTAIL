'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { V3, V3Radius } from '@/lib/design/tokens'
import { FIELD_LINE, INPUT_STYLE } from '@/components/v3/me/MeParts'

const CONFIRM_WORD = '탈퇴'

const REASONS = [
  '더 이상 사용하지 않아요',
  '원하는 상품이 없어요',
  '가격이 비싸요',
  '서비스에 불만이 있어요',
  '개인정보가 걱정돼요',
  '기타',
] as const

/**
 * 회원 탈퇴 폼 — 웹·앱 공용(/mypage/delete).
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M16·M17): variant='app' 일 때만 앱 모양(탈퇴 이유 목록 · 회색 면 동의 칸 ·
 * 확인 문구 칸 56 · 빨간 '회원 탈퇴' 58)으로 그린다. 기본 'web' 은 아래 옛 마크업 그대로(한 픽셀도 안 바뀜).
 * 제출·검사 로직(handleSubmit · canSubmit)은 두 모양이 같은 것을 쓴다.
 */
export default function DeleteAccountForm({
  variant = 'web',
  previewFilled,
}: {
  /** 'app' = 앱 새 디자인 모양. 기본 'web'(웹 화면 그대로). */
  variant?: 'web' | 'app'
  /** 점검 화면(/design-check/me) 전용 — 이유·동의·확인 문구를 채운 상태로 그린다(시안 M17). 실제 화면은 넘기지 않는다. */
  previewFilled?: boolean
} = {}) {
  const router = useRouter()
  const [reason, setReason] = useState<(typeof REASONS)[number] | ''>(previewFilled ? REASONS[0] : '')
  const [reasonDetail, setReasonDetail] = useState('')
  const [confirmText, setConfirmText] = useState(previewFilled ? CONFIRM_WORD : '')
  const [agreed, setAgreed] = useState(previewFilled ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit =
    agreed &&
    confirmText.trim() === CONFIRM_WORD &&
    !loading &&
    reason !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)

    const combinedReason =
      reason === '기타' && reasonDetail.trim()
        ? reasonDetail.trim()
        : reason + (reasonDetail.trim() ? ` — ${reasonDetail.trim()}` : '')

    // ★연결이 끊겨도 버튼이 '처리 중'에 멈추지 않게(2026-09-26 점검 7차). 탈퇴는 서버에서
    //   끝났을 수도 있으니 "실패"라고 단정하지 않고 확인 방법을 알려 준다.
    let res: Response
    try {
      res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: combinedReason,
          confirmText: confirmText.trim(),
        }),
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      setLoading(false)
      setError('연결이 끊겼어요. 탈퇴가 처리됐는지 다시 로그인해서 확인해 주세요.')
      return
    }

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setLoading(false)
      setError(data?.message ?? '탈퇴를 처리하지 못했어요')
      return
    }

    // Success — session is already cleared server-side. Send the user
    // to a goodbye state. Using replace so back button doesn't
    // resurrect the form.
    router.replace('/login?deleted=1')
    router.refresh()
  }

  if (variant === 'app') {
    const typed = confirmText.trim() === CONFIRM_WORD
    return (
      <form onSubmit={handleSubmit} style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* 탈퇴 사유 */}
        <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <legend style={{ padding: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="ft-poster" style={{ fontSize: 22 }}>
              탈퇴 이유
            </span>
            <span style={{ fontSize: 14, color: V3.inkMute }}>익명 통계로만 써요</span>
          </legend>
          <div style={{ marginTop: 12, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
            {REASONS.map((r) => (
              <label
                key={r}
                style={{
                  minHeight: 56,
                  boxSizing: 'content-box',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 17,
                  fontWeight: reason === r ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  style={{ margin: 0, width: 24, height: 24, accentColor: V3.ink, flexShrink: 0 }}
                />
                {r}
              </label>
            ))}
          </div>
          <textarea
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value.slice(0, 200))}
            placeholder="자세한 의견을 남겨 주시면 서비스를 고치는 데 큰 도움이 돼요 (선택)"
            aria-label="자세한 의견"
            rows={3}
            className="ft-me-input"
            style={{
              marginTop: 14,
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: V3Radius.sm,
              border: `1.5px solid ${FIELD_LINE}`,
              fontFamily: 'inherit',
              fontSize: 17,
              lineHeight: 1.5,
              letterSpacing: 'normal',
              color: V3.ink,
              resize: 'none',
              outline: 'none',
            }}
          />
          <span style={{ marginTop: 4, textAlign: 'right', fontSize: 14, color: V3.inkMute }}>{reasonDetail.length}/200</span>
        </fieldset>

        {/* 동의 */}
        <label
          style={{
            padding: 16,
            borderRadius: V3Radius.sm,
            background: V3.soft,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            fontSize: 16,
            lineHeight: 1.55,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ margin: '2px 0 0', flexShrink: 0, width: 26, height: 26, accentColor: V3.ink }}
          />
          <span>
            위 안내를 모두 확인했고, 개인정보 삭제와 주문 기록 5년 보관에 동의해요. 탈퇴하면 계정을 되돌릴 수 없다는 걸
            이해했어요.
          </span>
        </label>

        {/* 확인 문구 */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="ft-poster" style={{ fontSize: 22 }}>
            확인 문구 입력
          </span>
          <span style={{ fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
            실수로 탈퇴하지 않도록, 아래 칸에{' '}
            <strong style={{ fontWeight: 800, color: V3.sale }}>&ldquo;{CONFIRM_WORD}&rdquo;</strong>를 그대로 입력해 주세요.
          </span>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            className="ft-me-input"
            style={{
              ...INPUT_STYLE,
              marginTop: 4,
              fontWeight: 700,
              // 정확히 입력하면 먹선 2px(시안 M17) — 맞게 썼다는 걸 칸이 알려 준다.
              border: typed ? `2px solid ${V3.ink}` : `1.5px solid ${FIELD_LINE}`,
            }}
          />
        </label>

        {error && (
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              borderRadius: V3Radius.sm,
              background: 'rgba(198,61,42,0.06)',
              color: V3.sale,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            height: 58,
            border: 0,
            borderRadius: V3Radius.sm,
            background: V3.sale,
            color: '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: 17,
            fontWeight: 800,
            opacity: canSubmit ? 1 : 0.4,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? '탈퇴 처리 중...' : '회원 탈퇴'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 mt-4 space-y-4">
      {/* 탈퇴 사유 */}
      <div className="bg-bg-3 rounded border border-rule px-5 py-5">
        <label className="block text-[13.5px] font-black text-text mb-3">
          탈퇴 사유{' '}
          <span className="text-[10.5px] text-muted font-semibold">
            (익명 통계로만 사용해요)
          </span>
        </label>
        <div className="space-y-2">
          {REASONS.map((r) => (
            <label
              key={r}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg cursor-pointer transition ${
                reason === r
                  ? 'bg-bg border border-terracotta'
                  : 'bg-bg/50 border border-transparent hover:border-rule-2'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-terracotta"
              />
              <span className="text-[12px] font-semibold text-text">
                {r}
              </span>
            </label>
          ))}
        </div>
        <textarea
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value.slice(0, 200))}
          placeholder="자세한 의견을 남겨 주시면 서비스 개선에 큰 도움이 돼요 (선택)"
          rows={2}
          className="mt-3 w-full px-3 py-2.5 rounded-lg bg-bg border border-transparent focus:border-terracotta focus:outline-none text-[12px] text-text placeholder:text-muted/55 resize-none"
        />
        <p className="mt-1 text-right text-[10.5px] text-muted">
          {reasonDetail.length}/200
        </p>
      </div>

      {/* 동의 */}
      <div className="bg-bg-3 rounded border border-rule px-5 py-5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-sale"
          />
          <span className="text-[12px] text-text leading-relaxed">
            위 안내 내용을 모두 확인했고, 개인정보 삭제 및 주문 이력 5년
            보관에 동의해요. 탈퇴 후에는 계정을 되돌릴 수 없다는 사실을
            이해했어요.
          </span>
        </label>
      </div>

      {/* 확인 문구 */}
      <div className="bg-bg-3 rounded border border-rule px-5 py-5">
        <label className="block text-[13.5px] font-black text-text mb-2">
          확인 문구 입력
        </label>
        <p className="text-[10.5px] text-muted mb-3 leading-relaxed">
          실수로 탈퇴하는 것을 막기 위해, 아래 입력란에{' '}
          <b className="text-sale">&ldquo;{CONFIRM_WORD}&rdquo;</b>를
          그대로 입력해 주세요.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="w-full px-4 py-3 rounded-lg bg-bg border border-transparent focus:border-sale focus:outline-none text-[13.5px] font-bold text-text placeholder:text-muted/55"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="bg-sale/5 border border-sale/30 rounded px-4 py-3" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="w-4 h-4 text-sale shrink-0 mt-0.5"
              strokeWidth={2.25}
            />
            <p className="text-[12px] font-semibold text-sale">{error}</p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3.5 rounded bg-sale text-white text-[13.5px] font-black hover:brightness-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? '탈퇴 처리 중...' : '회원 탈퇴'}
      </button>
    </form>
  )
}
