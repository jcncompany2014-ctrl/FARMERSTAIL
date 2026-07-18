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
  charged: boolean
  overdue: boolean
  totalAmount: number
  packs: Array<{ name: string; packG: number; count: number; totalG: number }>
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
