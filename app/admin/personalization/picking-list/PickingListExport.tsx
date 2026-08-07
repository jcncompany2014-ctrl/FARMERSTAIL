'use client'

import { Download } from 'lucide-react'

/**
 * 피킹 리스트 CSV — 한 줄 = 한 박스. 팩 구성은 "제품 165g×14" 형태로 한 컬럼에
 * (제품 종류가 박스마다 달라 고정 컬럼 펼치기보다 안전). 한국어 BOM 포함.
 *
 * 2026-07-19 재작성 — 서버 page 가 boxPricing 정본으로 만든 PickingRow 를 그대로
 * 받는다. 계산은 여기서 하지 않는다(정본 밖 재계산 금지).
 */

export type PickingRow = {
  subId: string
  dogName: string
  recipientName: string
  phone: string
  zip: string
  addressLine: string
  memo: string
  freshRatio: number
  freshLabel: string
  freshUnknown: boolean
  cycleNumber: number | null
  userAdjusted: boolean
  transition: string
  noFormula: boolean
  /**
   * **결제가 일어날 수 없는 구독** — 카드가 없거나(billing_key null) 영구 거절
   * 상태(requires_billing_key_renewal)다. 청구 크론의 대상 조건과 같은 판정이라,
   * true 면 이 박스는 **돈을 받지 않고 나간다**.
   *
   * 예전엔 피킹 리스트가 status='active' + 날짜만 봐서 이런 구독이 아무 표시
   * 없이 포장 대상에 섞였다(2026-07-31). 특히 어드민 '재개' 가 영구 거절 구독에
   * 배송일을 박아주고 있어 그 조합이 실제로 만들어졌다.
   */
  /** 결제 후 정지된 건 — 돈은 받았는데 구독이 멈췄다(2026-08-07). */
  pausedAfterCharge: boolean
  /** 청구 후 고객이 배송일을 옮겨 날짜 필터 밖으로 나간 건 — 발송 대기 주문 역추적으로 포함됨. */
  dateMovedAfterCharge: boolean
  cannotCharge: boolean
  charged: boolean
  overdue: boolean
  totalAmount: number
  /** 이번 출고분 미발송 주문 — 포장 중 송장 입력으로 바로 가는 링크용. */
  order: { id: string; orderNumber: string } | null
  packs: Array<{ name: string; packG: number; count: number; totalG: number }>
  /**
   * 레시피는 부르는데 **박스에 못 담기는** 항목 — 판매중지·재고0·구독불가.
   * 예전엔 그냥 사라져서, 3종 레시피가 2종으로 포장돼 나갔다(2026-07-31).
   * 금액은 저장된 total_amount 로 그대로 청구되므로 고객은 제값을 내고 덜 받는다.
   */
  missing: Array<{ name: string; packG: number; count: number; reason: string }>
  boxTotalG: number
}

export default function PickingListExport({
  rows,
  date,
}: {
  rows: PickingRow[]
  date: string
}) {
  function downloadCsv() {
    const headers = [
      '강아지',
      '수령인',
      '전화',
      '우편',
      '주소',
      '배송메모',
      '화식비율',
      'cycle',
      '보호자조정',
      '상태',
      '팩 구성',
      '박스 총량(g)',
      '청구액(원)',
    ]
    const csvRows = rows.map((r) => [
      r.dogName,
      r.recipientName,
      r.phone,
      r.zip,
      r.addressLine,
      r.memo,
      `${r.freshLabel} ${r.freshRatio}%`,
      r.cycleNumber == null ? '' : String(r.cycleNumber),
      r.userAdjusted ? '✓' : '',
      r.noFormula
        ? '처방없음'
        : r.charged
          ? '청구완료'
          : r.overdue
            ? '청구지연'
            : '청구예정',
      r.packs.map((p) => `${p.name} ${p.packG}g×${p.count}`).join(' / '),
      String(r.boxTotalG),
      String(r.totalAmount),
    ])
    const csv = [headers, ...csvRows]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? '')
            if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
            return s
          })
          .join(','),
      )
      .join('\r\n')

    // 한글 깨짐 방지 BOM (UTF-8 BOM = EF BB BF).
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `picking-list-${date}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={downloadCsv}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold disabled:opacity-40 bg-zinc-900 text-white"
    >
      <Download size={12} strokeWidth={2.5} />
      CSV 다운로드
    </button>
  )
}
