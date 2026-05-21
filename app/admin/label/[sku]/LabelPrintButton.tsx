'use client'

import { Printer } from 'lucide-react'

/**
 * Round G3 (2026-05-20): 라벨 인쇄 → PDF 저장.
 * window.print() — 브라우저 print 다이얼로그.
 */
export default function LabelPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-ink text-bg text-[12px] font-bold active:scale-[0.98] transition"
    >
      <Printer className="w-3.5 h-3.5" strokeWidth={2.5} />
      인쇄 / PDF 저장
    </button>
  )
}
