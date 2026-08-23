'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Search } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isStandaloneApp } from '@/lib/standalone'
import {
  AddressSearchSheet,
  loadDaumPostcodeScript,
  openDaumPostcodePopup,
  type DaumAddress,
} from '@/components/AddressSearchSheet'

interface AddressSearchProps {
  onComplete: (data: DaumAddress) => void
  className?: string
  buttonText?: string
}

/**
 * 주소 검색 버튼 — 브라우저는 Daum 팝업, 설치된 앱(네이티브·PWA)은 embed 시트.
 *
 * 로더·팝업·시트의 실체는 전부 `components/AddressSearchSheet`(정본)에 있다.
 * 여기는 버튼과 분기만 남는다 — 주문 화면(OrderClient)이 같은 정본을 쓰므로
 * 두 화면의 주소검색 동작이 다시는 갈라질 수 없다(규칙60).
 */
export default function AddressSearch({
  onComplete,
  className = '',
  buttonText = '주소 검색',
}: AddressSearchProps) {
  const toast = useToast()
  const scriptReady = useRef(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  // ref 로 최신 콜백 유지 — Daum 위젯 클로저 안에서도 항상 최신 참조.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!scriptReady.current) {
      // fire-and-forget 프리로드: 실패는 handleClick 에서 window.daum 부재로 판정.
      void loadDaumPostcodeScript()
      scriptReady.current = true
    }
  }, [])

  const handleClick = useCallback(async () => {
    // 설치된 앱은 팝업이 불능(WebView) — embed 시트로.
    if (isStandaloneApp()) {
      setSheetOpen(true)
      return
    }
    try {
      await loadDaumPostcodeScript()
      openDaumPostcodePopup((a) => onCompleteRef.current(a))
    } catch {
      // 스크립트 로드 실패(CDN 다운 등) — 무한 hang 대신 토스트 안내 후 재시도 유도.
      toast.error('주소 검색 서비스를 잠시 불러오지 못했어요. 잠시 후 다시 시도해 주세요')
    }
  }, [toast])

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-lg border border-rule bg-white text-[12px] font-bold text-text hover:border-terracotta hover:text-terracotta transition active:scale-95 ${className}`}
      >
        <Search className="w-4 h-4" strokeWidth={2} />
        {buttonText}
      </button>

      <AddressSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onComplete={(a) => onCompleteRef.current(a)}
      />
    </>
  )
}
