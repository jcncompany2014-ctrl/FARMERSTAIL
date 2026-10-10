'use client'

/**
 * 영수증 '이미지로 저장' — 앱 화면 전용(앱 새 디자인 'A 포스터', 캔버스 M09).
 *
 * 웹 영수증은 `?print=1` 새 탭 + window.print() 로 인쇄·PDF 저장을 한다. 앱(Capacitor WebView)에선 그 길이
 * 막혀 있다 — 새 탭이 없고, 안드로이드 WebView 는 window.print() 가 아무 일도 안 한다(앱시안 결정 3번 '동작':
 * "인쇄가 새 탭 방식이라 앱에서 안 될 수 있음"). 그래서 앱은 건강 리포트·등록증과 같은 저장 정본을 쓴다 —
 * 영수증 종이(.ft-receipt-capture)를 그림으로 떠서 saveCanvasImage 에 넘긴다(앱 = 공유 시트, 그 밖 = 내려받기).
 * 버튼 이름도 실제로 일어나는 일로('인쇄 / PDF 저장' 이 아니라 '이미지로 저장'). 저장이 안 되는 환경은
 * 결과로 정직하게 말한다(규칙108 — 거짓 "저장했어요" 금지).
 */

import { useState } from 'react'
import { captureNodeToCanvas, saveCanvasImage, SAVE_IMAGE_UNSUPPORTED_MESSAGE } from '@/lib/save-image'
import { V3 } from '@/lib/design/tokens'

export default function ReceiptSaveButton({ orderNumber }: { orderNumber: string }) {
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setNotice(null)
    try {
      const node = document.querySelector<HTMLElement>('.ft-receipt-capture')
      if (!node) throw new Error('capture-target-missing')
      const canvas = await captureNodeToCanvas(node)
      const result = await saveCanvasImage(canvas, `farmerstail-receipt-${orderNumber}.png`)
      if (result === 'unsupported') setNotice(SAVE_IMAGE_UNSUPPORTED_MESSAGE)
      else if (result === 'downloaded') setNotice('영수증 이미지를 내려받았어요.')
    } catch (e) {
      console.error('receipt export', e)
      setNotice('이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ margin: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="active:opacity-80"
        style={{
          width: '100%',
          height: 58,
          border: 0,
          borderRadius: 4,
          background: V3.ink,
          color: '#FFFFFF',
          fontFamily: 'inherit',
          fontSize: 17,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        {saving ? '이미지를 만드는 중…' : '이미지로 저장'}
      </button>
      {notice && (
        <p role="status" style={{ margin: 0, textAlign: 'center', fontSize: 14, lineHeight: 1.5, color: V3.inkMute }}>
          {notice}
        </p>
      )}
    </div>
  )
}
