'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import CouponCard, {
  type CouponCardData,
  type CouponCardState,
} from '@/components/coupons/CouponCard'
import { useToast } from '@/components/ui/Toast'

type Coupon = CouponCardData & {
  per_user_limit: number | null
  used_count: number
  usage_limit: number | null
  is_active: boolean
}

type Redemption = {
  coupon_id: string
  created_at: string
}

type Tab = 'available' | 'used' | 'expired'

const TABS: { key: Tab; label: string }[] = [
  { key: 'available', label: '사용 가능' },
  { key: 'used', label: '사용 완료' },
  { key: 'expired', label: '만료' },
]

export default function CouponBrowser({
  activeCoupons,
  expiredCoupons,
  redemptions,
}: {
  activeCoupons: Coupon[]
  expiredCoupons: Coupon[]
  redemptions: Redemption[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('available')
  const [code, setCode] = useState('')
  const [registering, setRegistering] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // redemption 카운트 — coupon_id 별 본인 사용 횟수
  const usedByCoupon = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of redemptions) {
      m.set(r.coupon_id, (m.get(r.coupon_id) ?? 0) + 1)
    }
    return m
  }, [redemptions])

  // 분류
  const buckets = useMemo(() => {
    const available: Coupon[] = []
    const used: Coupon[] = []

    for (const c of activeCoupons) {
      const userUsed = usedByCoupon.get(c.id) ?? 0
      const usedUp = c.per_user_limit !== null && userUsed >= c.per_user_limit
      const totalDone = c.usage_limit !== null && c.used_count >= c.usage_limit
      if (usedUp) used.push(c)
      else if (totalDone) used.push(c) // 다 소진 — 'used' 로 분류해 노출
      else available.push(c)
    }

    return { available, used, expired: expiredCoupons }
  }, [activeCoupons, expiredCoupons, usedByCoupon])

  async function lookupAndCopy() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setRegistering(true)
    try {
      const { data } = await supabase
        .from('coupons')
        .select('code, name, expires_at, is_active')
        .eq('code', trimmed)
        .eq('is_active', true)
        .maybeSingle()

      if (!data) {
        toast.error('유효하지 않은 쿠폰 코드예요')
        return
      }
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        toast.error('이미 만료된 쿠폰이에요')
        return
      }
      // 클립보드 복사 + 안내
      try {
        await navigator.clipboard.writeText(trimmed)
      } catch {
        /* ignore */
      }
      toast.success(`"${data.name}" 코드를 복사했어요`)
      setCode('')
      router.refresh()
    } finally {
      setRegistering(false)
    }
  }

  async function copyCode(c: string) {
    try {
      await navigator.clipboard.writeText(c)
      setCopied(c)
      setTimeout(() => setCopied(null), 1500)
      toast.success('코드를 복사했어요')
    } catch {
      toast.error('복사하지 못했어요')
    }
  }

  const list =
    tab === 'available'
      ? buckets.available
      : tab === 'used'
        ? buckets.used
        : buckets.expired

  const stateForTab: CouponCardState =
    tab === 'available' ? 'available' : tab === 'used' ? 'used' : 'expired'

  return (
    <>
      {/* 코드 등록 (외부 코드 — 이메일 / SNS 받았을 때) */}
      <section className="px-5 mt-3">
        <div
          className="rounded-2xl border px-4 py-3 flex gap-2"
          style={{ background: 'white', borderColor: 'var(--rule)' }}
        >
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 32))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') lookupAndCopy()
            }}
            placeholder="받은 쿠폰 코드 입력"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="flex-1 px-3 py-2 rounded-lg bg-bg border border-rule text-[12px] font-mono font-bold text-text placeholder:text-muted/60 placeholder:font-sans focus:outline-none focus:border-terracotta"
          />
          <button
            type="button"
            onClick={lookupAndCopy}
            disabled={registering || !code.trim()}
            className="shrink-0 px-4 py-2 rounded-lg text-[12px] font-bold inline-flex items-center gap-1 transition disabled:opacity-50"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            <Search className="w-3.5 h-3.5" strokeWidth={2.5} />
            {registering ? '확인 중' : '등록'}
          </button>
        </div>
      </section>

      {/* 탭 */}
      <section className="px-5 mt-4">
        <div
          className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
          style={{ background: 'var(--rule)' }}
        >
          {TABS.map(({ key, label }) => {
            const count =
              key === 'available'
                ? buckets.available.length
                : key === 'used'
                  ? buckets.used.length
                  : buckets.expired.length
            const active = tab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="py-2.5 text-[11.5px] font-bold transition"
                style={{
                  background: active ? 'var(--ink)' : 'white',
                  color: active ? 'white' : 'var(--text)',
                }}
              >
                {label}
                {count > 0 && (
                  <span
                    className="ml-1 inline-block px-1.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: active ? 'rgba(255,255,255,0.18)' : 'var(--bg-2)',
                      color: active ? 'white' : 'var(--muted)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* 카드 list */}
      <section className="px-5 mt-3 space-y-2.5">
        {list.length === 0 ? (
          <div
            className="rounded-2xl border px-5 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <Ticket
                className="w-6 h-6 text-muted"
                strokeWidth={1.3}
              />
            </div>
            <span className="kicker kicker-muted">Empty</span>
            <h3
              className="font-serif mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {tab === 'available'
                ? '사용 가능한 쿠폰이 없어요'
                : tab === 'used'
                  ? '사용한 쿠폰이 없어요'
                  : '만료된 쿠폰이 없어요'}
            </h3>
            <p className="text-[11px] text-muted mt-1.5">
              {tab === 'available'
                ? '이벤트 / 가입 쿠폰이 발급되면 여기에 표시돼요'
                : '아직이에요'}
            </p>
          </div>
        ) : (
          list.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              state={stateForTab}
              onCopy={
                tab === 'available' ? () => copyCode(c.code) : undefined
              }
              copied={copied === c.code}
            />
          ))
        )}
      </section>
    </>
  )
}
