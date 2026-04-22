'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Share2, Gift, Users, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type RedemptionRow = {
  id: string
  referee_id: string
  redeemed_at: string
}

type Props = {
  code: string
  alreadyRedeemed: boolean
  referredCount: number
  recent: RedemptionRow[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ReferralView({
  code,
  alreadyRedeemed,
  referredCount,
  recent,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/signup?ref=${code}`
    return `${window.location.origin}/signup?ref=${code}`
  }, [code])

  const shareText = useMemo(
    () =>
      `[파머스테일] 프리미엄 반려견 식품 같이 써볼래요? 내 초대 코드(${code})로 가입하면 3,000P 받아요!`,
    [code]
  )

  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [inputCode, setInputCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState<
    { kind: 'ok' | 'err'; text: string } | null
  >(null)

  async function copy(text: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Fallback for browsers without clipboard permission — show prompt
      // so the user can copy manually.
      window.prompt('복사해 주세요', text)
    }
  }

  async function share() {
    // Web Share API on mobile covers KakaoTalk, Messages, etc. natively.
    // On desktop Chrome it's missing, so we fall back to copying the link.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: '파머스테일 초대',
          text: shareText,
          url: shareUrl,
        })
        return
      } catch {
        // user cancelled — fall through
        return
      }
    }
    copy(shareUrl, 'link')
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = inputCode.trim().toUpperCase()
    if (!cleaned) return
    setRedeeming(true)
    setRedeemMsg(null)

    const { data, error } = await supabase.rpc('redeem_referral_code', {
      input_code: cleaned,
    })
    setRedeeming(false)

    if (error) {
      // The RPC raises with human-readable messages like "invalid code",
      // "already redeemed", "cannot redeem own code" — translate for users.
      const raw = error.message || ''
      const friendly = raw.includes('invalid code')
        ? '유효하지 않은 코드예요'
        : raw.includes('already redeemed')
          ? '이미 초대 코드를 등록했어요'
          : raw.includes('cannot redeem own code')
            ? '본인의 코드는 사용할 수 없어요'
            : raw.includes('empty code')
              ? '코드를 입력해 주세요'
              : `오류가 발생했어요: ${raw}`
      setRedeemMsg({ kind: 'err', text: friendly })
      return
    }

    const bonus =
      (data as { referee_bonus?: number } | null)?.referee_bonus ?? 3000
    setRedeemMsg({
      kind: 'ok',
      text: `${bonus.toLocaleString()}P가 적립되었어요!`,
    })
    setInputCode('')
    // Refresh the server component so the redemption form disappears.
    router.refresh()
  }

  return (
    <>
      {/* 초대 코드 카드 */}
      <section className="px-5 mt-4">
        <div
          className="rounded-2xl px-5 py-6 text-white"
          style={{ background: 'var(--ink)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              className="w-3.5 h-3.5 text-gold"
              strokeWidth={2}
            />
            <span className="kicker kicker-gold">Your Code · 내 코드</span>
          </div>
          <div
            className="mt-3 font-serif leading-none"
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '0.15em',
            }}
          >
            {code}
          </div>
          <div className="mt-3 text-[11px] text-white/70 truncate">
            {shareUrl}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => copy(code, 'code')}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition text-[12px] font-bold"
            >
              {copied === 'code' ? (
                <>
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" strokeWidth={2.25} />
                  코드 복사
                </>
              )}
            </button>
            <button
              type="button"
              onClick={share}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-ink text-bg text-[12px] font-bold hover:opacity-90 transition"
            >
              <Share2 className="w-3.5 h-3.5" strokeWidth={2.25} />
              공유하기
            </button>
          </div>
          <button
            type="button"
            onClick={() => copy(shareUrl, 'link')}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-[11px] font-semibold text-white/80"
          >
            {copied === 'link' ? (
              <>
                <Check className="w-3 h-3" strokeWidth={2.5} />
                링크 복사됨
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" strokeWidth={2.25} />
                초대 링크 복사
              </>
            )}
          </button>
        </div>
      </section>

      {/* 친구 초대 입력 (아직 등록 안 한 유저만) */}
      {!alreadyRedeemed && (
        <section className="px-5 mt-4">
          <div className="bg-white rounded-2xl border border-rule px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-terracotta" strokeWidth={2} />
              <h2 className="text-[13px] font-black text-text">
                받은 초대 코드가 있나요?
              </h2>
            </div>
            <p className="text-[11px] text-muted leading-relaxed mb-3">
              친구에게 받은 코드를 입력하면 3,000P가 바로 적립돼요. 한 번만
              등록할 수 있어요.
            </p>
            <form onSubmit={handleRedeem} className="flex items-stretch gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) =>
                  setInputCode(e.target.value.toUpperCase().slice(0, 16))
                }
                placeholder="예: AB12CD34"
                disabled={redeeming}
                className="flex-1 px-3 py-2.5 rounded-lg bg-bg border border-transparent focus:border-terracotta focus:outline-none text-[13px] font-mono font-bold tracking-widest text-text placeholder:text-muted/55 placeholder:font-normal placeholder:tracking-normal"
                aria-label="초대 코드"
              />
              <button
                type="submit"
                disabled={redeeming || !inputCode.trim()}
                className="px-4 rounded-lg bg-terracotta text-white text-[12px] font-bold hover:brightness-90 transition disabled:opacity-40"
              >
                {redeeming ? '등록 중...' : '등록'}
              </button>
            </form>
            {redeemMsg && (
              <div
                className={`mt-3 text-[11px] font-semibold rounded-lg px-3 py-2 ${
                  redeemMsg.kind === 'ok'
                    ? 'bg-moss/10 text-moss'
                    : 'bg-sale/5 text-sale'
                }`}
              >
                {redeemMsg.text}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 내 초대 현황 */}
      <section className="px-5 mt-5">
        <div className="bg-white rounded-2xl border border-rule px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-moss" strokeWidth={2} />
              <h2 className="text-[13px] font-black text-text">
                내가 초대한 친구
              </h2>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-[22px] font-black text-text leading-none">
                {referredCount}
              </span>
              <span className="text-[10px] text-muted">명</span>
            </div>
          </div>

          {recent.length === 0 ? (
            <p className="text-[11px] text-muted text-center py-6">
              아직 초대한 친구가 없어요
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-bg flex items-center justify-center">
                      <Users
                        className="w-3 h-3 text-moss"
                        strokeWidth={2}
                      />
                    </div>
                    <span className="text-[12px] font-bold text-text">
                      {/* RLS allows us to see the redemption row but NOT the
                          referee's profile — we keep the display anonymous
                          on purpose. */}
                      친구 #{r.referee_id.slice(0, 6).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted">
                    {formatDate(r.redeemed_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 안내 */}
      <section className="px-5 mt-4">
        <div className="rounded-xl bg-bg px-4 py-3.5 text-[10.5px] text-text leading-relaxed">
          <p className="font-bold text-text mb-1">How it works</p>
          <ol className="list-decimal list-inside space-y-0.5 text-text">
            <li>위 코드나 링크를 친구에게 공유해요.</li>
            <li>
              친구가 가입하고 <b>내 정보 &gt; 친구 초대</b>에서 코드를
              등록해요.
            </li>
            <li>두 분 모두에게 3,000P가 즉시 지급됩니다.</li>
          </ol>
        </div>
      </section>
    </>
  )
}
