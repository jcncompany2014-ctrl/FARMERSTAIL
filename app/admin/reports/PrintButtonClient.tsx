'use client'

import { Printer } from 'lucide-react'

/**
 * 인쇄 버튼 — server-side report page 의 단일 client island.
 * window.print() 호출 → @media print CSS 가 깔끔한 출력 처리.
 */
export default function PrintButtonClient() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-bg text-[11px] font-bold hover:opacity-90 transition"
    >
      <Printer className="w-3.5 h-3.5" strokeWidth={2.5} />
      인쇄 / PDF
    </button>
  )
}
