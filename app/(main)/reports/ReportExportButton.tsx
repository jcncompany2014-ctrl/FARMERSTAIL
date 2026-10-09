'use client'

/**
 * R16-C23: /reports 페이지의 캡처 + 이미지 다운로드 버튼.
 *
 * html2canvas 로 .ft-report-capture 노드 → canvas → PNG blob → download.
 * jspdf 없이도 사용자가 인쇄 / 공유 가능. 진짜 PDF 가 필요하면 후속에서
 * jspdf 도입.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A11): 흰 바탕 1.5px 먹선 네모 버튼(높이 48) + 내려받기 아이콘.
 *   그림 바탕색도 새 종이색(흰색)으로.
 */

import { useState } from 'react'
import { captureNodeToCanvas, saveCanvasImage, SAVE_IMAGE_UNSUPPORTED_MESSAGE } from '@/lib/save-image'
import { V3 } from '@/lib/design/tokens'

export default function ReportExportButton({ monthLabel }: { monthLabel: string }) {
  const [exporting, setExporting] = useState(false)
  // 앱에서 저장이 안 될 때·실패했을 때 — 예전엔 아무 반응이 없었다(2026-09-25).
  const [notice, setNotice] = useState<string | null>(null)

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setNotice(null)
    try {
      const node = document.querySelector<HTMLElement>('.ft-report-capture')
      if (!node) throw new Error('capture-target-missing')
      // 글자 기준선 보정이 들어간 정본(lib/save-image) — 직접 html2canvas 를 부르면 그림 속 글자가 아래로 밀린다.
      const canvas = await captureNodeToCanvas(node)
      const result = await saveCanvasImage(canvas, `farmerstail-report-${monthLabel}.png`)
      if (result === 'unsupported') setNotice(SAVE_IMAGE_UNSUPPORTED_MESSAGE)
    } catch (e) {
      console.error('report export', e)
      setNotice('이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="transition active:scale-[0.99]"
        style={{
          height: 48,
          padding: '0 16px',
          border: `1.5px solid ${V3.ink}`,
          borderRadius: 4,
          background: '#FFFFFF',
          color: V3.ink,
          fontSize: 16,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: exporting ? 'wait' : 'pointer',
          opacity: exporting ? 0.6 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        {exporting ? '내보내는 중…' : '이미지로 저장'}
      </button>
      {notice && (
        <p role="status" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: V3.inkMute }}>
          {notice}
        </p>
      )}
    </>
  )
}
