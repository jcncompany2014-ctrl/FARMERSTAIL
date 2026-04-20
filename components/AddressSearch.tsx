'use client'

import { useEffect, useRef, useCallback } from 'react'

// Daum Postcode API 타입

interface DaumPostcodeData {
  zonecode: string
  roadAddress: string
  jibunAddress: string
  autoRoadAddress: string
  autoJibunAddress: string
  buildingName: string
  apartment: string
  userSelectedType: 'R' | 'J'
}

interface AddressSearchProps {
  onComplete: (data: {
    zip: string
    address: string
    buildingName: string
  }) => void
  className?: string
  buttonText?: string
}

// 스크립트 로딩 상태 (전역 싱글톤)
let scriptLoaded = false
let scriptLoading = false
const callbacks: (() => void)[] = []

function loadScript(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded) {
      resolve()
      return
    }
    if (scriptLoading) {
      callbacks.push(resolve)
      return
    }
    scriptLoading = true
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.onload = () => {
      scriptLoaded = true
      scriptLoading = false
      resolve()
      callbacks.forEach((cb) => cb())
      callbacks.length = 0
    }
    document.head.appendChild(script)
  })
}

export default function AddressSearch({
  onComplete,
  className = '',
  buttonText = '주소 검색',
}: AddressSearchProps) {
  const scriptReady = useRef(false)
  // ref로 최신 콜백 유지 — Daum Postcode 클로저 안에서도 항상 최신 참조
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!scriptReady.current) {
      loadScript()
      scriptReady.current = true
    }
  }, [])

  const handleClick = useCallback(async () => {
    await loadScript()

    new window.daum.Postcode({
      oncomplete(data: DaumPostcodeData) {
        const address =
          data.userSelectedType === 'R'
            ? data.roadAddress
            : data.jibunAddress

        onCompleteRef.current({
          zip: data.zonecode,
          address,
          buildingName: data.buildingName,
        })
      },
    }).open()
  }, [])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`px-4 py-3 rounded-lg border border-[#EDE6D8] bg-white text-[12px] font-bold text-[#3D2B1F] hover:border-[#A0452E] hover:text-[#A0452E] transition active:scale-95 ${className}`}
    >
      🔍 {buttonText}
    </button>
  )
}