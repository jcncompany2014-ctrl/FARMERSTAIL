'use client'

/**
 * R16-C23: /reports 페이지의 캡처 + 이미지 다운로드 버튼.
 *
 * html2canvas 로 .ft-report-capture 노드 → canvas → PNG blob → download.
 * jspdf 없이도 사용자가 인쇄 / 공유 가능. 진짜 PDF 가 필요하면 후속에서
 * jspdf 도입.
 */

import { useState } from 'react'
import { Download } from 'lucide-react'

export default function ReportExportButton({ monthLabel }: { monthLabel: string }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      const node = document.querySelector<HTMLElement>('.ft-report-capture')
      if (!node) throw new Error('capture-target-missing')
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(node, {
        backgroundColor: '#fbf6ec',
        scale: 2,
        useCORS: true,
      })
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), 'image/png', 0.95),
      )
      if (!blob) throw new Error('blob-failed')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `farmerstail-report-${monthLabel}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('report export', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-rule bg-bg-3 text-[12px] font-bold text-text active:scale-[0.99] disabled:opacity-50 transition"
    >
      <Download className="w-3.5 h-3.5" strokeWidth={2.5} />
      {exporting ? '내보내는 중…' : '이미지로 저장'}
    </button>
  )
}
