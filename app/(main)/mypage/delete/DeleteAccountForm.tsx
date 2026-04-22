'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

const CONFIRM_WORD = '탈퇴'

const REASONS = [
  '더 이상 사용하지 않아요',
  '원하는 상품이 없어요',
  '가격이 비싸요',
  '서비스에 불만이 있어요',
  '개인정보가 걱정돼요',
  '기타',
] as const

export default function DeleteAccountForm() {
  const router = useRouter()
  const [reason, setReason] = useState<(typeof REASONS)[number] | ''>('')
  const [reasonDetail, setReasonDetail] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [agreed, setAgreed] = useState(false)
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

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: combinedReason,
        confirmText: confirmText.trim(),
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setLoading(false)
      setError(data?.message ?? '탈퇴 처리에 실패했어요')
      return
    }

    // Success — session is already cleared server-side. Send the user
    // to a goodbye state. Using replace so back button doesn't
    // resurrect the form.
    router.replace('/login?deleted=1')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 mt-4 space-y-4">
      {/* 탈퇴 사유 */}
      <div className="bg-white rounded-2xl border border-rule px-5 py-5">
        <label className="block text-[13px] font-black text-text mb-3">
          탈퇴 사유{' '}
          <span className="text-[10px] text-muted font-semibold">
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
        <p className="mt-1 text-right text-[10px] text-muted">
          {reasonDetail.length}/200
        </p>
      </div>

      {/* 동의 */}
      <div className="bg-white rounded-2xl border border-rule px-5 py-5">
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
      <div className="bg-white rounded-2xl border border-rule px-5 py-5">
        <label className="block text-[13px] font-black text-text mb-2">
          확인 문구 입력
        </label>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">
          실수로 탈퇴하는 것을 막기 위해, 아래 입력란에{' '}
          <b className="text-sale">&ldquo;{CONFIRM_WORD}&rdquo;</b>를
          그대로 입력해 주세요.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="w-full px-4 py-3 rounded-lg bg-bg border border-transparent focus:border-sale focus:outline-none text-[14px] font-bold text-text placeholder:text-muted/55"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="bg-sale/5 border border-sale/30 rounded-xl px-4 py-3">
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
        className="w-full py-3.5 rounded-xl bg-sale text-white text-[14px] font-black hover:brightness-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? '탈퇴 처리 중...' : '회원 탈퇴'}
      </button>
    </form>
  )
}
