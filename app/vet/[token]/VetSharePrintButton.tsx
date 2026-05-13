'use client'

import { Printer } from 'lucide-react'

/**
 * VetSharePrintButton — /vet/[token] 페이지에서 PDF/인쇄 트리거.
 * window.print() 호출 — 브라우저가 PDF 저장 또는 실 인쇄.
 *
 * @media print CSS 가 페이지 layout 을 진료 리포트 친화적으로 조정
 * (인쇄 시 버튼·링크 숨김 등).
 */
export default function VetSharePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border bg-white text-[11px] font-bold transition active:scale-[0.99]"
      style={{
        borderColor: 'var(--terracotta)',
        color: 'var(--terracotta)',
      }}
      aria-label="PDF 로 저장 또는 인쇄"
    >
      <Printer className="w-3.5 h-3.5" strokeWidth={2.2} />
      PDF / 인쇄
    </button>
  )
}
