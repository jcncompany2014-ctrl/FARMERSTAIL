'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Ticket, X, Send, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import {
  createCouponAction,
  toggleCouponActiveAction,
  deleteCouponAction,
} from './actions'

type AudienceType =
  | 'all'
  | 'first_signup'
  | 'birthday'
  | 'inactive_30d'
  | 'vip_tier'
  | 'manual'

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
  audience_type: AudienceType
  created_at: string
}

// admin 표/모달에서 사용하는 사람-친화 라벨 + 운영 의도 설명.
// audience_type 가 새로 추가되면 여기에 항목 한 줄 + 마이그레이션 CHECK 만
// 확장하면 전체 화면이 자동 반영.
const AUDIENCE_OPTIONS: {
  value: AudienceType
  label: string
  desc: string
}[] = [
  { value: 'all', label: '누구나', desc: '코드 입력으로 누구나 사용' },
  {
    value: 'first_signup',
    label: '첫 가입 환영',
    desc: '결제 0건인 신규 회원에게 자동 노출 · 결제 시 자동 적용',
  },
  {
    value: 'birthday',
    label: '생일 축하',
    desc: '생일 cron 이 매년 1회 자동 발송 (마케팅 수신 동의자만)',
  },
  {
    value: 'inactive_30d',
    label: '재참여 (30일 미접속)',
    desc: '30일 이상 활동 없는 사용자에게 재참여 유도 (cron 추가 예정)',
  },
  {
    value: 'vip_tier',
    label: 'VIP / 우수 고객',
    desc: '등급 = gold / vip 사용자에게만 노출 (정책 확정 후 활성)',
  },
  {
    value: 'manual',
    label: '수동 발급 전용',
    desc: 'admin 이 사용자 한 명씩 직접 지정 — 대량 발급 X',
  },
]

function audienceLabel(t: AudienceType): string {
  return AUDIENCE_OPTIONS.find((o) => o.value === t)?.label ?? t
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
  const toast = useToast()
  const createModalRef = useRef<HTMLDivElement>(null)
  const grantModalRef = useRef<HTMLDivElement>(null)
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
  const [audienceType, setAudienceType] = useState<AudienceType>('all')

  async function createCoupon() {
    if (!code.trim() || !name.trim() || discountValue <= 0) {
      toast.error('코드, 이름, 할인값을 입력해주세요')
      return
    }
    setSaving(true)
    // R101-J: server action 경유 — recordAdminAction(coupon_create) 감사 로그.
    const result = await createCouponAction({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || null,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount: maxDiscount === '' ? null : maxDiscount,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      usageLimit: usageLimit === '' ? null : usageLimit,
      perUserLimit: perUserLimit === '' ? null : perUserLimit,
      audienceType,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error('쿠폰 생성 실패: ' + (result.error ?? ''))
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
    // R101-J: server action 경유 — recordAdminAction(coupon_update) 감사 로그.
    const result = await toggleCouponActiveAction(c.id, !c.is_active)
    if (!result.ok) {
      toast.error('변경 실패: ' + (result.error ?? ''))
      return
    }
    router.refresh()
  }

  async function removeCoupon(c: Coupon) {
    if (!confirm(`"${c.name}" 쿠폰을 삭제할까요?`)) return
    // R101-J: server action 경유 — recordAdminAction(coupon_revoke) 감사 로그.
    const result = await deleteCouponAction(c.id, c.name)
    if (!result.ok) {
      toast.error('삭제 실패: ' + (result.error ?? ''))
      return
    }
    router.refresh()
  }

  // ── 수동 발급 모달 (audience='manual' 쿠폰 전용) ────────────────────────
  // admin 이 "이 쿠폰을 누구에게 줄지" 한 명씩 선택. 이메일/이름 prefix 로
  // profiles 검색 → 결과 list 에서 클릭 → POST /api/admin/coupons/grant.
  const [grantTarget, setGrantTarget] = useState<Coupon | null>(null)
  const [grantQuery, setGrantQuery] = useState('')
  const [grantResults, setGrantResults] = useState<
    Array<{ id: string; email: string | null; name: string | null }>
  >([])
  const [grantSearching, setGrantSearching] = useState(false)
  const [grantSending, setGrantSending] = useState<string | null>(null)
  const [grantedUserIds, setGrantedUserIds] = useState<Set<string>>(
    new Set(),
  )

  async function searchUsers() {
    const q = grantQuery.trim()
    if (!q) return
    setGrantSearching(true)
    // ILIKE prefix search on email + name. profiles 에 RLS — admin 은 service
    // role 아니지만 admin 정책으로 select 가능 (이전 admin 페이지 패턴 동일).
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name')
      .or(`email.ilike.${q}%,name.ilike.${q}%`)
      .limit(20)
    setGrantResults(
      (data ?? []) as Array<{
        id: string
        email: string | null
        name: string | null
      }>,
    )
    setGrantSearching(false)
  }

  async function grantToUser(userId: string) {
    if (!grantTarget) return
    setGrantSending(userId)
    try {
      const res = await fetch('/api/admin/coupons/grant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          coupon_id: grantTarget.id,
          user_id: userId,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        toast.error(`발급 실패: ${json.error ?? res.statusText}`)
        return
      }
      setGrantedUserIds((prev) => new Set(prev).add(userId))
    } finally {
      setGrantSending(null)
    }
  }

  function closeGrantModal() {
    setGrantTarget(null)
    setGrantQuery('')
    setGrantResults([])
    setGrantedUserIds(new Set())
  }

  // 모달 a11y — focus trap / Esc / body scroll lock.
  useModalA11y({
    open: modalOpen,
    onClose: () => !saving && setModalOpen(false),
    containerRef: createModalRef,
    preventEscape: saving,
  })
  useModalA11y({
    open: grantTarget !== null,
    onClose: closeGrantModal,
    containerRef: grantModalRef,
  })

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
                  대상
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
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                        c.audience_type === 'all'
                          ? 'bg-rule text-muted'
                          : 'bg-gold/15 text-text'
                      }`}
                    >
                      {audienceLabel(c.audience_type)}
                    </span>
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
                    <div className="inline-flex items-center gap-1">
                      {c.audience_type === 'manual' && c.is_active && (
                        <button
                          onClick={() => setGrantTarget(c)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-terracotta hover:bg-terracotta/10 transition"
                          aria-label="사용자에게 발급"
                        >
                          <Send className="w-3 h-3" strokeWidth={2.2} />
                          발급
                        </button>
                      )}
                      <button
                        onClick={() => removeCoupon(c)}
                        className="p-1.5 rounded-md text-muted hover:text-sale hover:bg-bg transition"
                        aria-label="삭제"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>
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
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            ref={createModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-create-title"
            tabIndex={-1}
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-rule px-5 py-4 flex items-center justify-between">
              <h2 id="coupon-create-title" className="text-[15px] font-black text-ink">
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
              <Field label="발급 대상 *">
                <select
                  value={audienceType}
                  onChange={(e) =>
                    setAudienceType(e.target.value as AudienceType)
                  }
                  className="input"
                >
                  {AUDIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10.5px] text-muted leading-relaxed">
                  {
                    AUDIENCE_OPTIONS.find((o) => o.value === audienceType)
                      ?.desc
                  }
                </p>
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

      {/* 수동 발급 모달 — audience='manual' 쿠폰 전용 */}
      {grantTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={closeGrantModal}
        >
          <div
            ref={grantModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-grant-title"
            tabIndex={-1}
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-rule px-5 py-4 flex items-center justify-between">
              <div>
                <h2 id="coupon-grant-title" className="text-[15px] font-black text-ink">
                  쿠폰 발급
                </h2>
                <p className="text-[11px] text-muted mt-0.5">
                  &quot;{grantTarget.name}&quot; 받을 사용자 선택
                </p>
              </div>
              <button
                onClick={closeGrantModal}
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:bg-bg"
                aria-label="닫기"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={grantQuery}
                  onChange={(e) => setGrantQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void searchUsers()
                  }}
                  placeholder="이메일 또는 이름 (앞글자)"
                  className="input flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={searchUsers}
                  disabled={grantSearching || !grantQuery.trim()}
                  className="shrink-0 px-3 py-2.5 rounded-lg bg-ink text-bg text-[12px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5" strokeWidth={2.5} />
                  {grantSearching ? '...' : '검색'}
                </button>
              </div>

              <div className="mt-3 space-y-1.5 max-h-[50vh] overflow-y-auto">
                {grantResults.length === 0 && grantQuery && !grantSearching ? (
                  <p className="text-center text-[12px] text-muted py-8">
                    검색 결과가 없어요
                  </p>
                ) : grantResults.length === 0 ? (
                  <p className="text-center text-[11px] text-muted py-4">
                    이메일이나 이름의 앞글자로 검색해 주세요
                  </p>
                ) : (
                  grantResults.map((u) => {
                    const sent = grantedUserIds.has(u.id)
                    const sending = grantSending === u.id
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-rule hover:border-text transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-ink truncate">
                            {u.name ?? '(이름 없음)'}
                          </div>
                          <div className="text-[11px] text-muted truncate">
                            {u.email ?? '-'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => grantToUser(u.id)}
                          disabled={sending || sent}
                          className={`shrink-0 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
                            sent
                              ? 'bg-moss/20 text-moss'
                              : 'bg-terracotta text-white hover:bg-[#8A3822]'
                          } disabled:opacity-60`}
                        >
                          {sent ? '발급됨' : sending ? '발급 중...' : '발급'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-rule px-5 py-3">
              <button
                onClick={closeGrantModal}
                className="w-full py-2.5 rounded-lg border border-rule text-[13px] font-bold text-text hover:bg-bg transition"
              >
                완료
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
