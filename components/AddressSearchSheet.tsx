'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useNativeBackClose } from '@/lib/native-back'

/**
 * Daum 우편번호 — 로더·팝업·embed 시트의 **정본 한 곳**.
 *
 * # 왜 (2026-08-22~23 — 주소검색 5번 왕복의 종착지)
 * 같은 주소검색 코드가 두 벌 있었다: components/AddressSearch(공용 버튼)와
 * app/(main)/dogs/[id]/order/OrderClient(주문 화면의 **복제본**). 앱에서
 * 주소검색이 안 된다는 제보를 받고 공용 쪽만 세 번에 걸쳐 고쳤는데 —
 * 사장님이 계신 화면은 **복제본을 쓰는 주문 화면**이었다. 다섯 왕복 전부
 * 헛발이었다. 복제는 갈라진다 — 이 모듈이 그 두 벌을 하나로 합친다.
 *
 * # 팝업이 앱에서 왜 안 되나 (에뮬레이터 재현 완료)
 * `.open()` 은 window.open 팝업이다. WebView 는 팝업을 못 열어
 * "팝업을 열 수 없습니다" 알림(에뮬레이터 실측)이나 받을 수 없는
 * 외부 앱 선택창(사장님 삼성 폰)으로 끝난다. 설치된 앱은 **embed**
 * (같은 페이지 안 iframe — 같은 에뮬레이터에서 정상 동작 실측)를 쓴다.
 *
 * `window.daum.Postcode` 생성은 이 파일 밖에서 금지 — 규칙60이 지킨다.
 */

export type DaumAddress = {
  zip: string
  address: string
  buildingName: string
}

type DaumPostcodeData = {
  userSelectedType: 'R' | 'J'
  roadAddress: string
  jibunAddress: string
  zonecode: string
  buildingName: string
}

// 스크립트 로딩 상태 (전역 싱글톤)
let scriptLoaded = false
let scriptLoading = false
const callbacks: (() => void)[] = []

/** Daum 우편번호 스크립트 로더 — 실패 시에도 resolve(호출측이 window.daum 부재로 판정). */
export function loadDaumPostcodeScript(): Promise<void> {
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
      // CDN 로드 실패 — awaiter 가 매달리지 않게 resolve 하고 다음 클릭에서 재시도.
      scriptLoading = false
      script.remove()
      resolve()
      callbacks.forEach((cb) => cb())
      callbacks.length = 0
    }
    document.head.appendChild(script)
  })
}

function toAddress(data: DaumPostcodeData): DaumAddress {
  return {
    zip: data.zonecode,
    address: data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress,
    buildingName: data.buildingName,
  }
}

/**
 * 브라우저 웹 전용 — Daum 팝업. **설치된 앱에서 부르지 말 것**(위 docstring).
 * window.daum 이 없으면 throw — 호출측이 토스트로 안내한다.
 */
export function openDaumPostcodePopup(onComplete: (a: DaumAddress) => void): void {
  if (typeof window === 'undefined' || !window.daum?.Postcode) {
    throw new Error('daum postcode unavailable')
  }
  new window.daum.Postcode({
    oncomplete(data: DaumPostcodeData) {
      onComplete(toAddress(data))
    },
  }).open()
}

/**
 * 설치된 앱(네이티브·PWA) 전용 — 화면 안 embed 시트.
 * 하드웨어 뒤로가기는 시트만 닫는다(useNativeBackClose).
 */
export function AddressSearchSheet({
  open,
  onClose,
  onComplete,
}: {
  open: boolean
  onClose: () => void
  onComplete: (a: DaumAddress) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  // ref 로 최신 콜백 유지 — 위젯 클로저가 stale 콜백을 잡지 않게.
  const onCompleteRef = useRef(onComplete)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCompleteRef.current = onComplete
    onCloseRef.current = onClose
  }, [onComplete, onClose])

  useNativeBackClose(open, onClose)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const host = hostRef.current
    void loadDaumPostcodeScript().then(() => {
      if (cancelled || !host || !window.daum?.Postcode) return
      new window.daum.Postcode({
        oncomplete(data: DaumPostcodeData) {
          onCompleteRef.current(toAddress(data))
          onCloseRef.current()
        },
        width: '100%',
        height: '100%',
      }).embed(host)
    })
    return () => {
      cancelled = true
      if (host) host.innerHTML = ''
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[120] bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label="주소 검색"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-x-0 bottom-0 top-[8dvh] flex flex-col rounded-t-[12px] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
          <span className="text-[16px] font-bold">주소 검색</span>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-2 -m-2">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        <div ref={hostRef} className="flex-1 min-h-0" />
      </div>
    </div>
  )
}
