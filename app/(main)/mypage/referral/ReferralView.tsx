'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Copy,
  Check,
  Share2,
  Gift,
  Users,
  ChevronLeft,
  Sparkles,
  Lock,
  ChevronRight,
  Dog,
} from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type RedemptionRow = {
  id: string
  referee_id: string
  redeemed_at: string
}

type DogRow = {
  id: string
  name: string
  photo_url: string | null
}

type Props = {
  code: string
  alreadyRedeemed: boolean
  referredCount: number
  totalEarned: number
  recent: RedemptionRow[]
  dogs?: DogRow[]
}

/**
 * 단계별 보상 milestone — 시각화용. 실제 보너스 지급 RPC 는 추후 별도 phase.
 * 사용자가 다음 목표를 보고 동기 부여 받는 게 1차 가치.
 */
const MILESTONES = [
  { count: 1, label: '첫 친구', reward: '3,000P 즉시' },
  { count: 5, label: '5명 달성', reward: '+ 5,000원 쿠폰' },
  { count: 10, label: '10명 달성', reward: '+ 1만원 쿠폰' },
  { count: 20, label: '20명 달성', reward: '+ 1개월 무료 정기배송' },
] as const

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
  totalEarned,
  recent,
  dogs = [],
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/signup?ref=${code}`
    return `${window.location.origin}/signup?ref=${code}`
  }, [code])

  const shareText = useMemo(
    () =>
      `🐾 [파머스테일] 우리 아이를 위한 맞춤 화식 펫푸드\n\n친구 초대 코드 ${code} 로 가입하면 우리 둘 다 3,000P 받아요!\n\n${shareUrl}`,
    [code, shareUrl],
  )

  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [inputCode, setInputCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState<
    { kind: 'ok' | 'err'; text: string } | null
  >(null)

  // 다음 milestone — 현재 referredCount 기반
  const nextMilestone = useMemo(() => {
    return MILESTONES.find((m) => m.count > referredCount) ?? null
  }, [referredCount])
  const nextMilestoneProgress = useMemo(() => {
    if (!nextMilestone) return 100
    const prevCount =
      MILESTONES[MILESTONES.indexOf(nextMilestone) - 1]?.count ?? 0
    return Math.min(
      100,
      Math.max(
        0,
        ((referredCount - prevCount) /
          (nextMilestone.count - prevCount)) *
          100,
      ),
    )
  }, [nextMilestone, referredCount])

  async function copy(text: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
      toast.success(which === 'code' ? '코드를 복사했어요' : '링크를 복사했어요')
    } catch {
      window.prompt('복사해 주세요', text)
    }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: '🐾 파머스테일 초대',
          text: shareText,
          url: shareUrl,
        })
        return
      } catch {
        return
      }
    }
    void copy(shareUrl, 'link')
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
      const raw = error.message || ''
      const friendly = raw.includes('invalid code')
        ? '유효하지 않은 코드예요'
        : raw.includes('already redeemed')
          ? '이미 초대 코드를 등록했어요'
          : raw.includes('cannot redeem own code')
            ? '본인의 코드는 사용할 수 없어요'
            : raw.includes('empty code')
              ? '코드를 입력해 주세요'
              : `잠시 문제가 생겼어요: ${raw}`
      setRedeemMsg({ kind: 'err', text: friendly })
      return
    }

    const bonus =
      (data as { referee_bonus?: number } | null)?.referee_bonus ?? 3000
    toast.success(`${bonus.toLocaleString()}P가 적립되었어요!`)
    setInputCode('')
    router.refresh()
  }

  return (
    <>
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-3">
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          내 정보
        </Link>
      </section>

      {/* HERO 카드 — gradient + 누적 적립금 + 큰 공유 CTA */}
      <section className="px-5">
        <div
          className="relative overflow-hidden rounded-[12px] px-6 pt-6 pb-7 text-white"
          style={{
            background:
              'linear-gradient(135deg, var(--terracotta) 0%, #8B3923 100%)',
          }}
        >
          {/* 장식 — 우측 상단 큰 원, 좌측 하단 작은 원 */}
          <div
            aria-hidden
            className="absolute -top-12 -right-8 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          />
          <div
            aria-hidden
            className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
              <span className="kicker kicker-gold">
                Refer · 친구 초대
              </span>
            </div>
            <h1
              className="font-sans leading-tight"
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              친구를 초대하면
              <br />
              <span className="text-gold">3,000P</span> 둘 다 받아요
            </h1>
            <p className="text-[12px] text-white/80 mt-2.5 leading-relaxed">
              친구가 코드 입력해 가입하는 순간 즉시 적립
            </p>

            {/* 누적 카운트 + 적립금 */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div
                className="rounded px-3.5 py-3"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <div className="text-[10px] text-white/70 font-bold uppercase tracking-widest">
                  초대한 친구
                </div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span
                    className="font-sans font-black leading-none"
                    style={{ fontSize: 26, letterSpacing: '-0.02em' }}
                  >
                    {referredCount}
                  </span>
                  <span className="text-[11px] text-white/80">명</span>
                </div>
              </div>
              <div
                className="rounded px-3.5 py-3"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <div className="text-[10px] text-white/70 font-bold uppercase tracking-widest">
                  누적 적립
                </div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span
                    className="font-sans font-black leading-none text-gold"
                    style={{ fontSize: 26, letterSpacing: '-0.02em' }}
                  >
                    {totalEarned.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-white/80">P</span>
                </div>
              </div>
            </div>

            {/* 큰 공유 CTA */}
            <button
              type="button"
              onClick={share}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-[14px] font-black active:scale-[0.98] transition"
              style={{
                background: 'white',
                color: 'var(--terracotta)',
              }}
            >
              <Share2 className="w-4 h-4" strokeWidth={2.5} />
              친구에게 공유하기
            </button>
          </div>
        </div>
      </section>

      {/* 코드 + 링크 통합 카드 */}
      <section className="px-5 mt-3">
        <div className="bg-bg-3 rounded border border-rule overflow-hidden">
          {/* 코드 표시 + 복사 */}
          <button
            type="button"
            onClick={() => copy(code, 'code')}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-bg transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--bg-2)' }}
              >
                <Gift
                  className="w-4 h-4"
                  style={{ color: 'var(--terracotta)' }}
                  strokeWidth={2}
                />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[10px] text-muted font-bold uppercase tracking-widest">
                  내 코드
                </div>
                <div
                  className="font-mono font-black text-text leading-tight"
                  style={{
                    fontSize: 16,
                    letterSpacing: '0.1em',
                  }}
                >
                  {code}
                </div>
              </div>
            </div>
            <span
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition"
              style={{
                background: copied === 'code' ? 'var(--moss)' : 'var(--bg-2)',
                color: copied === 'code' ? 'white' : 'var(--text)',
              }}
            >
              {copied === 'code' ? (
                <>
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" strokeWidth={2} />
                  코드 복사
                </>
              )}
            </span>
          </button>

          {/* 분리선 */}
          <div className="border-t border-rule" />

          {/* 링크 표시 + 복사 */}
          <button
            type="button"
            onClick={() => copy(shareUrl, 'link')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg transition"
          >
            <div className="text-left min-w-0 flex-1 pr-3">
              <div className="text-[10px] text-muted font-bold uppercase tracking-widest">
                초대 링크
              </div>
              <div className="text-[11.5px] text-text/80 truncate font-mono">
                {shareUrl}
              </div>
            </div>
            <span
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition"
              style={{
                background: copied === 'link' ? 'var(--moss)' : 'var(--bg-2)',
                color: copied === 'link' ? 'white' : 'var(--text)',
              }}
            >
              {copied === 'link' ? (
                <>
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" strokeWidth={2} />
                  링크 복사
                </>
              )}
            </span>
          </button>
        </div>
      </section>

      {/* 단계별 보상 progress */}
      <section className="px-5 mt-5">
        <div className="flex items-center gap-2 mb-3">
          <span
            aria-hidden
            style={{
              width: 16,
              height: 1.5,
              background: 'var(--terracotta)',
            }}
          />
          <span className="kicker">Milestones</span>
        </div>

        {/* 진행률 bar */}
        {nextMilestone && (
          <div
            className="mb-3 rounded border border-rule px-4 py-3"
            style={{ background: 'white' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles
                  className="w-3.5 h-3.5 text-terracotta"
                  strokeWidth={2}
                />
                <span className="text-[11.5px] font-bold text-text">
                  다음 보상까지 {nextMilestone.count - referredCount}명
                </span>
              </div>
              <span
                className="text-[10px] font-bold"
                style={{ color: 'var(--terracotta)' }}
              >
                {nextMilestone.reward}
              </span>
            </div>
            <div
              className="relative h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--bg-2)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${nextMilestoneProgress}%`,
                  background: 'var(--terracotta)',
                }}
              />
            </div>
          </div>
        )}

        {/* milestone 카드들 */}
        <ul className="space-y-1.5">
          {MILESTONES.map((m) => {
            const reached = referredCount >= m.count
            return (
              <li
                key={m.count}
                className="rounded border px-4 py-3 flex items-center justify-between"
                style={{
                  background: reached ? 'color-mix(in srgb, var(--moss) 6%, white)' : 'white',
                  borderColor: reached ? 'var(--moss)' : 'var(--rule)',
                  opacity: reached ? 1 : 0.85,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: reached ? 'var(--moss)' : 'var(--bg-2)',
                    }}
                  >
                    {reached ? (
                      <Check
                        className="w-3.5 h-3.5 text-white"
                        strokeWidth={2.5}
                      />
                    ) : (
                      <Lock
                        className="w-3 h-3 text-muted"
                        strokeWidth={2}
                      />
                    )}
                  </div>
                  <div>
                    <div
                      className="text-[12px] font-black"
                      style={{ color: reached ? 'var(--moss)' : 'var(--ink)' }}
                    >
                      {m.label}
                    </div>
                    <div className="text-[10.5px] text-muted">
                      {m.count}명 달성 시
                    </div>
                  </div>
                </div>
                <span
                  className="text-[11px] font-bold"
                  style={{ color: reached ? 'var(--moss)' : 'var(--text)' }}
                >
                  {m.reward}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 강아지 사진과 함께 공유 — 솔로 D2C CAC 핵심 그로스 */}
      {dogs.length > 0 && (
        <section className="px-5 mt-5">
          <div className="flex items-center gap-2 mb-2.5">
            <span
              aria-hidden
              style={{
                width: 16,
                height: 1.5,
                background: 'var(--terracotta)',
              }}
            />
            <span className="kicker">Share</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed mb-3">
            강아지 사진 + 한마디 + 추천 코드를 한 묶음으로. 신뢰감 ↑
          </p>
          <ul className="space-y-2">
            {dogs.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dogs/${d.id}/share`}
                  className="flex items-center gap-3 bg-bg-3 rounded border border-rule px-4 py-3 hover:border-terracotta transition active:scale-[0.99]"
                >
                  <div className="shrink-0 w-12 h-12 rounded-full bg-bg-2 overflow-hidden flex items-center justify-center">
                    {d.photo_url ? (
                      <Image
                        src={d.photo_url}
                        alt={d.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Dog
                        className="w-6 h-6 text-muted"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-text">
                      {d.name}로 공유하기
                    </div>
                    <div className="text-[10.5px] text-muted mt-0.5">
                      미리보기 + 카카오톡 / 메시지 공유
                    </div>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 text-muted shrink-0"
                    strokeWidth={2}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 받은 초대 코드 입력 (아직 등록 안 한 유저만) */}
      {!alreadyRedeemed && (
        <section className="px-5 mt-5">
          <div className="bg-bg-3 rounded border border-rule px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-terracotta" strokeWidth={2} />
              <h2 className="text-[13px] font-black text-text">
                받은 초대 코드가 있나요?
              </h2>
            </div>
            <p className="text-[11px] text-muted leading-relaxed mb-3">
              친구에게 받은 코드를 입력하면 3,000P가 즉시 적립돼요.
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
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="flex-1 px-3 py-2.5 rounded-lg bg-bg border border-rule text-[13px] font-mono font-bold tracking-widest text-text placeholder:text-muted/55 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-terracotta"
                aria-label="초대 코드"
              />
              <button
                type="submit"
                disabled={redeeming || !inputCode.trim()}
                className="px-4 rounded-lg text-[12px] font-bold transition disabled:opacity-40"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                {redeeming ? '등록 중' : '등록'}
              </button>
            </form>
            {redeemMsg && (
              <div
                className={`mt-3 text-[11px] font-semibold rounded-lg px-3 py-2 ${
                  redeemMsg.kind === 'ok'
                    ? 'bg-moss/10 text-moss'
                    : 'bg-sale/8 text-sale'
                }`}
              >
                {redeemMsg.text}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 친구 list */}
      <section className="px-5 mt-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-moss" strokeWidth={2} />
            <span className="kicker">Friends</span>
          </div>
          <span className="text-[11px] text-muted font-bold">
            {referredCount}명
          </span>
        </div>

        {recent.length === 0 ? (
          <div
            className="rounded border px-5 py-10 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{ background: 'white' }}
            >
              <Users
                className="w-5 h-5 text-muted"
                strokeWidth={1.5}
              />
            </div>
            <p className="text-[12px] font-bold text-text">
              아직 친구가 없어요
            </p>
            <p className="text-[10.5px] text-muted mt-1 leading-relaxed">
              위 공유 버튼으로 첫 친구를 초대해보세요
            </p>
          </div>
        ) : (
          <ul className="bg-bg-3 rounded border border-rule overflow-hidden">
            {recent.map((r, i) => (
              <li
                key={r.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < recent.length - 1 ? 'border-b border-rule' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--moss) 12%, white)' }}
                  >
                    <Users
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--moss)' }}
                      strokeWidth={2}
                    />
                  </div>
                  <div>
                    {/* RLS 가 referee profile 안 보여줘서 익명 — "F-XXXXXX" 보다
                        부드러운 톤으로. */}
                    <div className="text-[12px] font-bold text-text">
                      함께한 친구 #{r.referee_id.slice(0, 4).toUpperCase()}
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      {formatDate(r.redeemed_at)} 가입
                    </div>
                  </div>
                </div>
                <span
                  className="text-[11px] font-bold"
                  style={{ color: 'var(--moss)' }}
                >
                  +3,000P
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 안내 */}
      <section className="px-5 mt-5">
        <div className="rounded bg-bg-2 px-4 py-3.5 text-[10.5px] text-text leading-relaxed">
          <p className="font-bold text-text mb-1.5">How it works</p>
          <ol className="space-y-1 text-text/80">
            <li>
              <span className="font-bold text-text">1.</span> 위 코드나 링크를
              친구에게 공유해요
            </li>
            <li>
              <span className="font-bold text-text">2.</span> 친구가 가입 후{' '}
              <Link
                href="/mypage/referral"
                className="underline underline-offset-2 font-bold text-terracotta"
              >
                내 정보 &gt; 친구 초대
              </Link>
              에서 코드 등록
            </li>
            <li>
              <span className="font-bold text-text">3.</span> 두 분 모두에게
              3,000P 즉시 지급
            </li>
          </ol>
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            ※ 가입 시 링크로 진입하면 자동 적용돼요. 단계별 보상은 추후 정밀화.
          </p>
        </div>
      </section>
    </>
  )
}
