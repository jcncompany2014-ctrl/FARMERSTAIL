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
  // 모양 = 웹 시안 WEB-A32(2026-10-10 웹 리뉴얼) — 높이 48 · 먹색 1.5px 테.
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print"
      style={{ height: 48, padding: '0 14px', borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', color: '#141414', fontFamily: 'inherit', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
      aria-label="PDF로 저장하거나 인쇄"
    >
      <Printer className="w-4 h-4" strokeWidth={2.2} />
      PDF · 인쇄
    </button>
  )
}
