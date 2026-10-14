'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MapPin } from 'lucide-react'
import AddressSearch from '@/components/AddressSearch'
import { useToast } from '@/components/ui/Toast'
import { isKoreanMobile, formatKoreanMobile, PHONE_ERROR } from '@/lib/phone'
import type { ShippingTarget } from '@/lib/commerce/shipping-target'

/**
 * 배송지 고치기 (2026-10-14 C5, 규칙257) — 고객이 카톡으로 "이사했어요"라고 할 때.
 *
 * 저장은 /api/admin/users/[id]/address — 배송지 우선순위 정본의 1순위인 **기본 배송지**를 고친다(없으면 만든다).
 * 주소 검색은 정본 부품(components/AddressSearch), 전화번호 검사는 정본(lib/phone). 저장 전에 확인창을 띄우고,
 * 이미 결제된 발송 대기 박스가 있으면 그 주소도 같이 바꿀지 묻는다(안 바꾸면 그 박스는 옛 주소로 라벨이 찍힌다).
 * 금액·화식 비율은 이 화면이 건드리지 않는다.
 */
export default function AddressEditor({
  userId,
  current,
  pendingPaidBoxes,
  demo = false,
}: {
  userId: string
  current: ShippingTarget | null
  pendingPaidBoxes: number
  demo?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(current?.name ?? '')
  const [phone, setPhone] = useState(current?.phone ?? '')
  const [zip, setZip] = useState(current?.zip ?? '')
  const [address, setAddress] = useState(current?.address ?? '')
  const [detail, setDetail] = useState(current?.addressDetail ?? '')
  const [alsoPending, setAlsoPending] = useState(pendingPaidBoxes > 0)
  const [saving, setSaving] = useState(false)

  const phoneOk = isKoreanMobile(phone)
  const ready = name.trim() && phoneOk && /^\d{5}$/.test(zip.trim()) && address.trim()

  async function save() {
    if (!ready) {
      toast.error(phoneOk ? '받는 분·우편번호·주소를 채워 주세요' : PHONE_ERROR)
      return
    }
    const lines = [
      `${name.trim()} · ${formatKoreanMobile(phone)}`,
      `(${zip.trim()}) ${address.trim()} ${detail.trim()}`.trim(),
      pendingPaidBoxes > 0
        ? alsoPending
          ? `결제된 발송 대기 박스 ${pendingPaidBoxes}개의 주소도 같이 바꿔요.`
          : `결제된 발송 대기 박스 ${pendingPaidBoxes}개는 옛 주소 그대로 나가요.`
        : '',
    ].filter(Boolean)
    if (!window.confirm(`이 고객의 기본 배송지를 바꿀까요?\n\n${lines.join('\n')}\n\n작업 기록이 남아요.`)) return
    if (demo) {
      toast.info('점검 화면이라 저장하지 않아요')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/admin/users/${userId}/address`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientName: name.trim(),
        phone,
        zip: zip.trim(),
        address: address.trim(),
        addressDetail: detail.trim(),
        alsoPendingOrders: pendingPaidBoxes > 0 && alsoPending,
      }),
    })
    setSaving(false)
    const j = (await res.json().catch(() => null)) as { message?: string; pendingOrdersUpdated?: number; target?: string } | null
    if (!res.ok) {
      toast.error(j?.message ?? '배송지를 저장하지 못했어요')
      if (res.status === 500 && j?.target) router.refresh()
      return
    }
    toast.success(
      j?.target === 'unchanged'
        ? '바뀐 내용이 없어요'
        : j?.pendingOrdersUpdated
          ? `배송지를 바꿨어요 — 발송 대기 박스 ${j.pendingOrdersUpdated}개도 바꿨어요`
          : '배송지를 바꿨어요',
    )
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-bold text-foreground"
      >
        <MapPin className="size-3.5" strokeWidth={2.2} />
        배송지 고치기
      </button>
    )
  }

  const field = 'mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-[14px] text-foreground focus:border-input focus:outline-none'
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[12px] font-semibold text-muted-foreground">
          받는 분
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} className={field} />
        </label>
        <label className="text-[12px] font-semibold text-muted-foreground">
          휴대폰
          <input
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value.slice(0, 20))}
            onBlur={() => setPhone((p) => formatKoreanMobile(p))}
            className={`${field} ${phone && !phoneOk ? 'border-destructive' : ''}`}
          />
        </label>
      </div>
      {phone && !phoneOk && <p className="mt-1 text-[12px] text-destructive">{PHONE_ERROR}</p>}
      <div className="mt-2 flex items-end gap-2">
        <label className="w-28 shrink-0 text-[12px] font-semibold text-muted-foreground">
          우편번호
          <input value={zip} readOnly className={`${field} bg-secondary`} />
        </label>
        <AddressSearch
          className="!py-2"
          onComplete={(a) => {
            setZip(a.zip)
            setAddress(a.buildingName ? `${a.address} (${a.buildingName})` : a.address)
          }}
        />
      </div>
      <label className="mt-2 block text-[12px] font-semibold text-muted-foreground">
        주소
        <input value={address} readOnly className={`${field} bg-secondary`} />
      </label>
      <label className="mt-2 block text-[12px] font-semibold text-muted-foreground">
        상세 주소
        <input value={detail} onChange={(e) => setDetail(e.target.value.slice(0, 100))} className={field} />
      </label>
      {pendingPaidBoxes > 0 && (
        <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-900">
          <input
            type="checkbox"
            checked={alsoPending}
            onChange={(e) => setAlsoPending(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            이미 결제된 <b>발송 대기 박스 {pendingPaidBoxes}개</b>의 주소도 같이 바꾸기 — 안 바꾸면 그 박스 라벨은 옛 주소로 찍혀요.
          </span>
        </label>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted-foreground"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !ready}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-[13px] font-bold text-background disabled:opacity-40"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />}
          배송지 저장
        </button>
      </div>
    </div>
  )
}
