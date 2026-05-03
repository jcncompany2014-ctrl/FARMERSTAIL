'use client'

import { Download } from 'lucide-react'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { FoodLine } from '@/lib/personalization/types'

type Row = {
  formula: {
    id: string
    cycle_number: number
    transition_strategy: string
    user_adjusted: boolean
  }
  dogName: string
  ownerName: string
  phone: string
  addressLine: string
  zip: string
  weeklyGrams: number
  lines: Array<{ line: FoodLine; pct: number; grams: number }>
  veggieGrams: number
  proteinGrams: number
}

/**
 * CSV 다운로드 — 한 줄 = 한 박스. 라인 별 그램은 "Basic_g, Weight_g, ..."
 * 컬럼으로 펼쳐서 Google Sheet / 엑셀 가져오기 호환.
 *
 * 한국어 BOM 포함 — 엑셀 한글 깨짐 방지.
 */
export default function PickingListExport({
  rows,
  date,
}: {
  rows: Row[]
  date: string
}) {
  function downloadCsv() {
    const headers = [
      '강아지',
      '보호자',
      '전화',
      '우편',
      '주소',
      'cycle',
      '전환',
      '사용자조정',
      '주간(g)',
      ...ALL_LINES.map((l) => `${FOOD_LINE_META[l].name}(g)`),
      '야채토퍼(g)',
      '육류토퍼(g)',
    ]
    const csvRows = rows.map((r) => {
      const lineGrams: Record<FoodLine, number> = {
        basic: 0,
        weight: 0,
        skin: 0,
        premium: 0,
        joint: 0,
      }
      for (const l of r.lines) lineGrams[l.line] = l.grams
      return [
        r.dogName,
        r.ownerName,
        r.phone,
        r.zip,
        r.addressLine,
        String(r.formula.cycle_number),
        r.formula.transition_strategy,
        r.formula.user_adjusted ? '✓' : '',
        String(r.weeklyGrams),
        ...ALL_LINES.map((l) => String(lineGrams[l])),
        String(r.veggieGrams),
        String(r.proteinGrams),
      ]
    })
    const csv = [headers, ...csvRows]
      .map((row) =>
        row
          .map((cell) => {
            // 콤마 / 따옴표 / 줄바꿈 포함 시 quote escape.
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold disabled:opacity-40"
      style={{ background: 'var(--ink)', color: 'var(--bg)' }}
    >
      <Download size={12} strokeWidth={2.5} />
      CSV 다운로드
    </button>
  )
}
