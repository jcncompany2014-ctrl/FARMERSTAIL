'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AddressSearch from '@/components/AddressSearch'
import type { Address, AddressInput } from '@/lib/commerce/addresses'
import { formatPhone } from '@/lib/formatters'

type Props = {
  mode: 'create' | 'edit'
  initial?: Address
}

/**
 * 배송지 추가/수정 공용 폼.
 *
 * - react-hook-form 을 쓰지 않고 useState 로 단순화. 필드 수가 적고, 서버측
 *   zod 검증이 실패를 도맡아 복잡한 클라 검증 체계가 과함.
 * - Daum Postcode 로 zip + address 한번에 채움. 상세주소는 유저 입력.
 * - mode='edit' 일 때 PATCH, 'create' 일 때 POST.
 * - "기본 배송지로 설정" 토글: 이 값이 true 면 저장 후 자동으로 기본값.
 *   (현재 기본값이 없는 계정의 첫 주소는 DB 트리거가 auto-default 시킴)
 */
export default function AddressForm({ mode, initial }: Props) {
  const router = useRouter()

  const [label, setLabel] = useState(initial?.label ?? '')
  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [zip, setZip] = useState(initial?.zip ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [addressDetail, setAddressDetail] = useState(initial?.addressDetail ?? '')
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function fillFromSearch(d: { zip: string; address: string; buildingName: string }) {
    setZip(d.zip)
    setAddress(d.address)
    // 일반적으로 동·호수가 상세주소이므로 buildingName 은 힌트로만 넣는다.
    // 이미 상세 주소가 입력돼 있으면 덮어쓰지 않음.
    if (!addressDetail && d.buildingName) {
      setAddressDetail(d.buildingName)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const body: AddressInput = {
      label: label.trim(),
      recipientName: recipientName.trim(),
      phone: phone.trim(),
      zip: zip.trim(),
      address: address.trim(),
      addressDetail: addressDetail.trim(),
      isDefault,
    }

    try {
      const url =
        mode === 'edit'
          ? `/api/addresses/${initial!.id}`
          : '/api/addresses'
      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let message = '저장에 실패했어요.'
        try {
          const j = await res.json()
          if (j?.issues?.length) {
            message = j.issues[0].message
          } else if (j?.error) {
            message = String(j.error)
          }
        } catch {
          /* noop */
        }
        setError(message)
        setSubmitting(false)
        return
      }

      router.push('/mypage/addresses')
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했어요.')
      setSubmitting(false)
    }
  }

  return (
    <main className="pb-10" style={{ background: 'var(--bg)' }}>
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage/addresses"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 배송지 관리
        </Link>
        <span className="kicker mt-3 block">
          {mode === 'edit' ? 'Edit · 배송지 수정' : 'New · 배송지 추가'}
        </span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {mode === 'edit' ? '배송지 수정' : '새 배송지'}
        </h1>
      </section>

      <form onSubmit={handleSubmit} className="px-5 mt-5 space-y-4">
        <Field label="별칭 (선택)">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="집, 회사 등"
            maxLength={20}
            autoComplete="off"
            enterKeyHint="next"
            className="form-input"
          />
        </Field>

        <Field label="받는 분">
          <input
            type="text"
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="이름"
            maxLength={40}
            autoComplete="name"
            enterKeyHint="next"
            className="form-input"
          />
        </Field>

        <Field label="연락처">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            maxLength={13}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            className="form-input"
          />
        </Field>

        <Field label="우편번호 / 주소">
          <div className="flex gap-2">
            <input
              type="text"
              required
              readOnly
              value={zip}
              placeholder="우편번호"
              autoComplete="postal-code"
              inputMode="numeric"
              maxLength={5}
              className="form-input flex-1"
              style={{ background: 'var(--bg-2)' }}
            />
            <AddressSearch onComplete={fillFromSearch} buttonText="검색" />
          </div>
          <input
            type="text"
            required
            readOnly
            value={address}
            placeholder="주소 검색 버튼으로 입력해 주세요"
            autoComplete="street-address"
            className="form-input mt-2"
            style={{ background: 'var(--bg-2)' }}
          />
          <input
            type="text"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            placeholder="상세 주소 (동, 호수)"
            maxLength={100}
            autoComplete="address-line2"
            enterKeyHint="done"
            className="form-input mt-2"
          />
        </Field>

        <label className="flex items-center gap-2 px-1 py-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4 accent-ink"
          />
          <span className="text-[12px] font-semibold text-text">
            기본 배송지로 설정
          </span>
        </label>

        {error && (
          <div
            className="text-[12px] font-bold rounded-lg px-3.5 py-2.5"
            style={{
              color: 'var(--sale)',
              background: 'color-mix(in srgb, var(--sale) 6%, transparent)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--sale) 25%, transparent)',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-full font-bold text-[13.5px] active:scale-[0.98] transition-all disabled:opacity-50"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            letterSpacing: '-0.01em',
            boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
          }}
        >
          {submitting ? '저장 중…' : mode === 'edit' ? '저장' : '배송지 등록'}
        </button>
      </form>

      {/* 공용 폼 입력 스타일 — globals.css 로 빼기엔 한 화면 전용이라 여기에. */}
      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid var(--rule-2);
          background: #fdfdfd;
          color: var(--text);
          font-size: 14px;
          transition: border-color 0.15s;
          outline: none;
        }
        :global(.form-input:focus) {
          border-color: var(--terracotta);
        }
        :global(.form-input::placeholder) {
          color: var(--muted);
          opacity: 0.7;
        }
      `}</style>
    </main>
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
    <div>
      <label
        className="block text-[11px] font-bold mb-1.5"
        style={{ color: 'var(--text)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
