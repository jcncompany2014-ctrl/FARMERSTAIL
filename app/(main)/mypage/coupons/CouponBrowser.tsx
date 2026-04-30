'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Ticket, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Coupon = {
  id: string
  code: string
  name: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_amount: number
  max_discount: number | null
  expires_at: string | null
  per_user_limit: number | null
  used_count: number
  usage_limit: number | null
}

function formatDiscount(c: Coupon) {
  if (c.discount_type === 'percent') {
    return `${c.discount_value}%`
  }
  return `${c.discount_value.toLocaleString()}원`
}

function formatDate(iso: string | null) {
  if (!iso) return '상시'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}까지`
}

export default function CouponBrowser({
  coupons,
  usedCountByCoupon,
}: {
  coupons: Coupon[]
  usedCountByCoupon: Record<string, number>
}) {
  const router = useRouter()
  const supabase = createClient()
  const [code, setCode] = useState('')
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [lookupOk, setLookupOk] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function lookup() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLookupMsg(null)
    setLookupOk(false)

    const { data } = await supabase
      .from('coupons')
      .select('code, name')
      .eq('code', trimmed)
      .eq('is_active', true)
      .maybeSingle()

    if (data) {
      setLookupOk(true)
      setLookupMsg(`"${data.name}" — 체크아웃에서 이 코드를 입력해 적용하세요`)
      router.refresh()
    } else {
      setLookupMsg('유효하지 않은 쿠폰 코드예요')
    }
  }

  async function copyCode(c: string) {
    try {
      await navigator.clipboard.writeText(c)
      setCopied(c)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {/* Lookup input */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-2xl border border-rule px-4 py-4">
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
            쿠폰 코드 확인
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') lookup()
              }}
              placeholder="코드 입력 (예: WELCOME5000)"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={32}
              className="flex-1 px-3 py-2.5 rounded-lg bg-bg border border-rule text-[12px] font-bold text-text placeholder:text-muted/60 focus:outline-none focus:border-terracotta"
            />
            <button
              onClick={lookup}
              className="px-4 py-2.5 rounded-lg bg-text text-white text-[12px] font-bold active:scale-[0.98] transition inline-flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" strokeWidth={2.5} />
              확인
            </button>
          </div>
          {lookupMsg && (
            <p
              className={`text-[11px] mt-2 font-bold ${
                lookupOk ? 'text-moss' : 'text-sale'
              }`}
            >
              {lookupMsg}
            </p>
          )}
        </div>
      </section>

      {/* Coupon list */}
      {coupons.length > 0 && (
        <section className="px-5 mt-4 space-y-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted mb-1">
            사용 가능한 쿠폰
          </div>
          {coupons.map((c) => {
            const usedByMe = usedCountByCoupon[c.id] ?? 0
            const usedUp =
              c.per_user_limit !== null && usedByMe >= c.per_user_limit
            return (
              <div
                key={c.id}
                className={`relative overflow-hidden rounded-2xl border px-4 py-4 transition ${
                  usedUp
                    ? 'bg-bg border-rule opacity-60'
                    : 'bg-gradient-to-br from-bg to-white border-rule hover:border-terracotta'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${
                      usedUp ? 'bg-rule' : 'bg-terracotta/10'
                    }`}
                  >
                    <Ticket
                      className={`w-6 h-6 ${
                        usedUp ? 'text-muted' : 'text-terracotta'
                      }`}
                      strokeWidth={1.8}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`font-serif font-black text-[20px] leading-none ${
                          usedUp ? 'text-muted' : 'text-terracotta'
                        }`}
                      >
                        {formatDiscount(c)}
                      </span>
                      <span className="text-[11px] text-muted">할인</span>
                    </div>
                    <h3 className="mt-1.5 text-[13px] font-black text-text">
                      {c.name}
                    </h3>
                    {c.description && (
                      <p className="text-[11px] text-muted mt-0.5">
                        {c.description}
                      </p>
                    )}
                    <div className="mt-1.5 text-[10px] text-muted space-x-2">
                      {c.min_order_amount > 0 && (
                        <span>
                          최소 {c.min_order_amount.toLocaleString()}원~
                        </span>
                      )}
                      <span>· {formatDate(c.expires_at)}</span>
                    </div>
                    <button
                      onClick={() => copyCode(c.code)}
                      className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rule text-[10px] font-bold text-text hover:border-terracotta hover:text-terracotta transition"
                    >
                      {copied === c.code ? (
                        <>
                          <Check className="w-3 h-3" strokeWidth={2.5} />
                          복사됨
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" strokeWidth={2} />
                          {c.code}
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {usedUp && (
                  <div className="absolute top-2 right-2 text-[9px] font-bold text-muted bg-rule px-2 py-0.5 rounded-md">
                    사용 완료
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}
