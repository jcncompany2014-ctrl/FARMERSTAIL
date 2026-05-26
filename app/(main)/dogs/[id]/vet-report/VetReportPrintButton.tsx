'use client'

import { Printer } from 'lucide-react'

/**
 * XL-2 (#14) — window.print() 트리거. Label PDF 패턴 reuse.
 */
export default function VetReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-ink text-paper text-[12px] font-bold active:scale-[0.98] transition"
    >
      <Printer className="w-3.5 h-3.5" strokeWidth={2.5} />
      인쇄 / PDF 저장
    </button>
  )
}
