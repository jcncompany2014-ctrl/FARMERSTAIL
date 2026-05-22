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
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

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
        toast.error('쓸 수 없는 쿠폰 코드예요')
        return
      }
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        toast.error('기간이 지난 쿠폰이에요')
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
      // UX audit #16: 복사 후 "장바구니로" action — 사용자가 다음 단계 알게.
      toast.success('코드를 복사했어요', {
        action: {
          label: '장바구니로',
          onClick: () => router.push('/cart'),
        },
      })
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
      <section style={{ padding: '12px 20px 0' }}>
        <div
          className="flex"
          style={{
            gap: 8,
            padding: '10px 12px',
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
          }}
        >
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 32))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void lookupAndCopy()
            }}
            placeholder="받은 쿠폰 코드 입력"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="flex-1 focus:outline-none"
            style={{
              padding: '8px 10px',
              borderRadius: V3Radius.xs,
              background: V3.paper,
              border: `1px solid ${V3.rule}`,
              fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              color: V3.ink,
              letterSpacing: '0.04em',
            }}
          />
          <button
            type="button"
            onClick={lookupAndCopy}
            disabled={registering || !code.trim()}
            className="shrink-0 inline-flex items-center transition disabled:opacity-50"
            style={{
              gap: 4,
              padding: '8px 14px',
              borderRadius: V3Radius.xs,
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              background: V3.ink,
              color: V3.paperHi,
              border: 'none',
            }}
          >
            <Search size={14} strokeWidth={2.5} />
            {registering ? '확인 중' : '등록'}
          </button>
        </div>
      </section>

      {/* 탭 */}
      <section style={{ padding: '16px 20px 0' }}>
        <div
          className="grid grid-cols-3 overflow-hidden"
          style={{
            gap: 1,
            background: V3.rule,
            borderRadius: V3Radius.sm,
            border: `1px solid ${V3.rule}`,
          }}
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
                className="transition"
                style={{
                  padding: '10px 0',
                  fontSize: 11.5,
                  fontWeight: V3FontWeight.bold,
                  background: active ? V3.ink : V3.paperHi,
                  color: active ? V3.paperHi : V3.ink,
                  border: 'none',
                }}
              >
                {label}
                {count > 0 && (
                  <span
                    className="tabular-nums"
                    style={{
                      marginLeft: 4,
                      display: 'inline-block',
                      padding: '0 6px',
                      borderRadius: V3Radius.pill,
                      fontSize: 10,
                      fontWeight: V3FontWeight.bold,
                      background: active ? 'rgba(244,237,224,0.2)' : V3.paper,
                      color: active ? V3.paperHi : V3.inkMute,
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
      <section
        style={{
          padding: '12px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {list.length === 0 ? (
          <div
            className="text-center"
            style={{
              borderRadius: V3Radius.sm,
              border: `1.5px dashed ${V3.rule}`,
              padding: '48px 20px',
              background: V3.paperHi,
            }}
          >
            <div
              className="mx-auto flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                marginBottom: 12,
              }}
            >
              <Ticket size={24} color={V3.inkMute} strokeWidth={1.3} />
            </div>
            <Mono color="inkMute" size="xxs" weight={600}>
              Empty
            </Mono>
            <h3
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 16,
                color: V3.ink,
                letterSpacing: '-0.02em',
              }}
            >
              {tab === 'available'
                ? '사용 가능한 쿠폰이 없어요'
                : tab === 'used'
                  ? '사용한 쿠폰이 없어요'
                  : '만료된 쿠폰이 없어요'}
            </h3>
            <p
              style={{
                fontSize: 11,
                color: V3.inkMute,
                marginTop: 6,
              }}
            >
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
