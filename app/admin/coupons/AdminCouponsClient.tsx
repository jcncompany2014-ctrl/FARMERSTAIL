'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Ticket, X } from 'lucide-react'
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
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  used_count: number
  per_user_limit: number | null
  is_active: boolean
  created_at: string
}

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminCouponsClient({
  initialCoupons,
}: {
  initialCoupons: Coupon[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed')
  const [discountValue, setDiscountValue] = useState(5000)
  const [minOrderAmount, setMinOrderAmount] = useState(30000)
  const [maxDiscount, setMaxDiscount] = useState<number | ''>('')
  const [expiresAt, setExpiresAt] = useState('')
  const [usageLimit, setUsageLimit] = useState<number | ''>('')
  const [perUserLimit, setPerUserLimit] = useState<number | ''>(1)

  async function createCoupon() {
    if (!code.trim() || !name.trim() || discountValue <= 0) {
      alert('코드, 이름, 할인값을 입력해주세요')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('coupons').insert({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrderAmount,
      max_discount: maxDiscount === '' ? null : maxDiscount,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      usage_limit: usageLimit === '' ? null : usageLimit,
      per_user_limit: perUserLimit === '' ? null : perUserLimit,
      is_active: true,
    })
    setSaving(false)
    if (error) {
      alert('쿠폰 생성 실패: ' + error.message)
      return
    }
    setModalOpen(false)
    // reset form
    setCode('')
    setName('')
    setDescription('')
    setDiscountValue(5000)
    router.refresh()
  }

  async function toggleActive(c: Coupon) {
    await supabase
      .from('coupons')
      .update({ is_active: !c.is_active })
      .eq('id', c.id)
    router.refresh()
  }

  async function removeCoupon(c: Coupon) {
    if (!confirm(`"${c.name}" 쿠폰을 삭제할까요?`)) return
    await supabase.from('coupons').delete().eq('id', c.id)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-ink">쿠폰 관리</h1>
          <p className="text-sm text-muted mt-1">
            고객에게 발급할 쿠폰 코드를 생성·관리해요
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-terracotta text-white text-sm font-bold hover:bg-[#8A3822] active:scale-[0.98] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          새 쿠폰
        </button>
      </div>

      {initialCoupons.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-rule px-6 py-16 text-center">
          <Ticket
            className="w-10 h-10 text-muted mx-auto mb-3"
            strokeWidth={1.3}
          />
          <p className="text-sm font-bold text-ink">
            아직 쿠폰이 없어요
          </p>
          <p className="text-xs text-muted mt-1">
            새 쿠폰 버튼으로 첫 쿠폰을 만들어보세요
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-rule overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg border-b border-rule">
              <tr className="text-left">
                <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase">
                  코드
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase">
                  이름
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase">
                  할인
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase">
                  사용
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase">
                  만료
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase text-center">
                  상태
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {initialCoupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono text-[12px] font-bold text-ink">
                    {c.code}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-terracotta">
                    {c.discount_type === 'percent'
                      ? `${c.discount_value}%`
                      : `${c.discount_value.toLocaleString()}원`}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-text">
                    {c.used_count}
                    {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted">
                    {formatDateTime(c.expires_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                        c.is_active
                          ? 'bg-moss/20 text-moss'
                          : 'bg-rule text-muted'
                      }`}
                    >
                      {c.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeCoupon(c)}
                      className="p-1.5 rounded-md text-muted hover:text-sale hover:bg-bg transition"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 생성 모달 */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-rule px-5 py-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-ink">
                새 쿠폰 생성
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:bg-bg"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <Field label="쿠폰 코드 *">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="예: WELCOME5000"
                  className="input"
                />
              </Field>
              <Field label="쿠폰 이름 *">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 첫 구매 5,000원 할인"
                  className="input"
                />
              </Field>
              <Field label="설명">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="선택 사항"
                  className="input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="할인 유형">
                  <select
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(e.target.value as 'percent' | 'fixed')
                    }
                    className="input"
                  >
                    <option value="fixed">정액 (원)</option>
                    <option value="percent">정률 (%)</option>
                  </select>
                </Field>
                <Field label="할인값 *">
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    className="input"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="최소 주문 금액">
                  <input
                    type="number"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value) || 0)}
                    className="input"
                  />
                </Field>
                <Field label="최대 할인액 (정률 시)">
                  <input
                    type="number"
                    value={maxDiscount}
                    onChange={(e) =>
                      setMaxDiscount(
                        e.target.value === '' ? '' : Number(e.target.value) || 0
                      )
                    }
                    placeholder="제한 없음"
                    className="input"
                  />
                </Field>
              </div>
              <Field label="만료일시">
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="전체 사용 횟수">
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) =>
                      setUsageLimit(
                        e.target.value === '' ? '' : Number(e.target.value) || 0
                      )
                    }
                    placeholder="무제한"
                    className="input"
                  />
                </Field>
                <Field label="회원당 사용 횟수">
                  <input
                    type="number"
                    value={perUserLimit}
                    onChange={(e) =>
                      setPerUserLimit(
                        e.target.value === '' ? '' : Number(e.target.value) || 0
                      )
                    }
                    placeholder="1"
                    className="input"
                  />
                </Field>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-rule px-5 py-3 flex gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-rule text-[13px] font-bold text-text hover:bg-bg transition"
              >
                취소
              </button>
              <button
                onClick={createCoupon}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-terracotta text-white text-[13px] font-bold hover:bg-[#8A3822] transition disabled:opacity-50"
              >
                {saving ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #ede6d8;
          background: #fdfdfd;
          font-size: 13px;
          color: #2a2118;
          font-weight: 600;
        }
        .input:focus {
          outline: none;
          border-color: #a0452e;
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
