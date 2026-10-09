'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AddressSearch from '@/components/AddressSearch'
import type { Address, AddressInput } from '@/lib/commerce/addresses'
import { formatPhone } from '@/lib/formatters'
import { V3, V3Radius } from '@/lib/design/tokens'
import {
  FIELD_LINE,
  INPUT_STYLE,
  MeCss,
  PLACEHOLDER_INK,
  SCREEN_ROOT,
  primaryButton,
} from '@/components/v3/me/MeParts'

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
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 M02 새 배송지 · M03 배송지 수정 · M04 주소 검색 · I14 검색 실패):
 *   이름표 16 굵게 · 입력 높이 56(회색 1.5px 테두리 · 18px) · 우편번호·주소는 회색 면(검색으로만 채움) ·
 *   '검색' 단추 112 폭 2px 먹선 · 체크 26 · 등록 버튼 58 먹색. 화면 안의 영어 머리말("New · 배송지 추가")과
 *   큰 제목은 뺐다 — 윗줄(AppChrome)이 화면 이름을 말한다. 저장·검사 로직은 그대로.
 *   주소는 여러 줄로 보이게 입력칸 대신 글 상자로 그린다(시안) — 값은 원래도 검색 결과로만 들어왔고, 읽기 전용
 *   입력칸의 required 는 브라우저가 검사하지 않는다(서버 zod 가 검사한다).
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
  // 동기 가드 — disabled={submitting} 은 리렌더 후 적용되므로 서브프레임
  // 더블탭이 빠져나갈 수 있다. ref 는 동기라 중복 제출(중복 배송지 생성)을 막음
  // (dogs/new NewDogClient 의 submittingRef 패턴과 동일).
  const submittingRef = useRef(false)
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
    if (submittingRef.current) return // 더블탭 중복 제출(중복 배송지) 방지
    submittingRef.current = true
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
        let message = '저장하지 못했어요.'
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
        submittingRef.current = false // 실패 시 재시도 허용
        return
      }

      // 배송지 목록은 프로필로 편입됨(2026-07-16) — 저장 후 프로필로.
      router.push('/account/profile')
      router.refresh()
    } catch {
      setError('잠시 네트워크가 불안정한 것 같아요. 다시 시도해 주세요.')
      setSubmitting(false)
      submittingRef.current = false // 실패 시 재시도 허용
    }
  }

  return (
    <div style={SCREEN_ROOT}>
      <MeCss />
      <form onSubmit={handleSubmit} style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* input 을 label 안에 넣어 암묵적 연결 — htmlFor/id 없이도 스크린리더가 필드명을
            읽고, 라벨 탭으로 포커스 이동된다(2026-07-17 a11y). */}
        <Field label="별칭" hint="(선택)">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="집, 회사 등"
            maxLength={20}
            autoComplete="off"
            enterKeyHint="next"
            className="ft-me-input"
            style={INPUT_STYLE}
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
            className="ft-me-input"
            style={INPUT_STYLE}
          />
        </Field>

        <Field label="연락처">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            maxLength={13}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            className="ft-me-input"
            style={INPUT_STYLE}
          />
        </Field>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>주소</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 112px', gap: 8 }}>
            <input
              type="text"
              required
              readOnly
              value={zip}
              placeholder="우편번호"
              aria-label="우편번호"
              autoComplete="postal-code"
              inputMode="numeric"
              maxLength={5}
              className="ft-me-input"
              style={{ ...INPUT_STYLE, background: V3.soft }}
            />
            <AddressSearch onComplete={fillFromSearch} buttonText="검색" variant="app" />
          </div>
          <div
            role="textbox"
            aria-readonly="true"
            aria-label="주소"
            style={{
              minHeight: 56,
              boxSizing: 'border-box',
              padding: '15px 14px',
              borderRadius: V3Radius.sm,
              border: `1.5px solid ${FIELD_LINE}`,
              background: V3.soft,
              fontSize: address ? 18 : 17,
              lineHeight: 1.5,
              color: address ? V3.ink : PLACEHOLDER_INK,
            }}
          >
            {address || '주소 검색 버튼으로 입력해 주세요'}
          </div>
          <input
            type="text"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            placeholder="상세 주소 (동, 호수)"
            aria-label="상세 주소"
            maxLength={100}
            autoComplete="address-line2"
            enterKeyHint="done"
            className="ft-me-input"
            style={INPUT_STYLE}
          />
        </div>

        <label style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            style={{ margin: 0, width: 26, height: 26, accentColor: V3.ink, flexShrink: 0 }}
          />
          기본 배송지로 설정
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

        <button type="submit" disabled={submitting} style={{ ...primaryButton(58), opacity: submitting ? 0.5 : 1 }}>
          {submitting ? '저장 중…' : mode === 'edit' ? '저장' : '배송지 등록'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 16, fontWeight: 800 }}>
        {label}
        {hint && <span style={{ fontWeight: 500, color: V3.inkMute }}> {hint}</span>}
      </span>
      {children}
    </label>
  )
}
