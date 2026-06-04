'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'

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
    script.onerror = () => {
      // CDN 로드 실패 — awaiter 가 영원히 매달리지 않도록 resolve 하고
      // scriptLoading 을 풀어 다음 클릭에서 재시도(새 script 태그) 가능하게.
      // handleClick 이 window.daum 부재를 catch 로 안내 처리.
      scriptLoading = false
      script.remove()
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
  // React 19: ref는 render 중에 mutate하면 안 됨. useEffect에서 갱신한다.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!scriptReady.current) {
      // fire-and-forget: script load error 는 handleClick 호출 시 검증 (try/catch).
      void loadScript()
      scriptReady.current = true
    }
  }, [])

  const handleClick = useCallback(async () => {
    try {
      await loadScript()
      if (typeof window === 'undefined' || !window.daum?.Postcode) {
        throw new Error('daum postcode unavailable')
      }
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
    } catch {
      // 우편번호 스크립트 로드 실패(CDN 다운 등) — 무한 hang 대신 안내 후 재시도 유도.
      if (typeof window !== 'undefined') {
        window.alert(
          '주소 검색 서비스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
        )
      }
    }
  }, [])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-lg border border-rule bg-white text-[12px] font-bold text-text hover:border-terracotta hover:text-terracotta transition active:scale-95 ${className}`}
    >
      <Search className="w-4 h-4" strokeWidth={2} />
      {buttonText}
    </button>
  )
}