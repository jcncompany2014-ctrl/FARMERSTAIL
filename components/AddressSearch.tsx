'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isStandaloneApp } from '@/lib/standalone'
import { useNativeBackClose } from '@/lib/native-back'

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

/**
 * 주소 검색 — 브라우저는 Daum 팝업, **설치된 앱(네이티브·PWA)은 화면 안 embed**.
 *
 * ★2026-08-22 — 예전엔 무조건 `.open()`(팝업)이었다. 네이티브 WebView 는
 * 팝업을 못 열어 안드로이드가 **외부 브라우저로 인텐트를 던졌고**(사장님 재현:
 * "크롬/삼성인터넷 중 선택" 팝업), 외부 브라우저는 앱 WebView 와 연결이 없어
 * **주소를 눌러도 앱에 아무것도 전달되지 않았다.** 주소 입력이 통째로 불능.
 *
 * embed 모드는 같은 페이지 안 iframe 이라 WebView 에서 그대로 동작한다.
 * 브라우저 웹은 기존 팝업 UX 를 유지한다(출시 직전 웹 동선 변경 금지).
 */
export default function AddressSearch({
  onComplete,
  className = '',
  buttonText = '주소 검색',
}: AddressSearchProps) {
  const toast = useToast()
  const scriptReady = useRef(false)
  const [embedOpen, setEmbedOpen] = useState(false)
  const embedHostRef = useRef<HTMLDivElement | null>(null)
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

  // 하드웨어 뒤로가기 → 주소 시트만 닫기 (화면 이동 금지).
  const closeEmbed = useCallback(() => setEmbedOpen(false), [])
  useNativeBackClose(embedOpen, closeEmbed)

  // embed 마운트 — 오버레이가 열리고 호스트 div 가 생긴 뒤 위젯을 채운다.
  useEffect(() => {
    if (!embedOpen) return
    const host = embedHostRef.current
    if (!host || !window.daum?.Postcode) return
    new window.daum.Postcode({
      oncomplete(data: DaumPostcodeData) {
        const address =
          data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress
        onCompleteRef.current({
          zip: data.zonecode,
          address,
          buildingName: data.buildingName,
        })
        setEmbedOpen(false)
      },
      width: '100%',
      height: '100%',
    }).embed(host)
    return () => {
      host.innerHTML = ''
    }
  }, [embedOpen])

  const handleClick = useCallback(async () => {
    try {
      await loadScript()
      if (typeof window === 'undefined' || !window.daum?.Postcode) {
        throw new Error('daum postcode unavailable')
      }
      // 설치된 앱(네이티브 WebView·PWA)은 팝업이 외부 브라우저로 새거나 막힌다
      // — embed 오버레이로. 판정은 lib/standalone 정본.
      if (isStandaloneApp()) {
        setEmbedOpen(true)
        return
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
      // 우편번호 스크립트 로드 실패(CDN 다운 등) — 무한 hang 대신 토스트로 안내 후
      // 재시도 유도 (R-feel: 브라우저 alert 회색창 제거).
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

      {embedOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/45"
          role="dialog"
          aria-modal="true"
          aria-label="주소 검색"
          onClick={(e) => {
            // 스크림(바깥) 탭 → 닫기. 패널 내부 클릭은 버블링 막아 유지.
            if (e.target === e.currentTarget) closeEmbed()
          }}
        >
          <div className="absolute inset-x-0 bottom-0 top-[8dvh] flex flex-col rounded-t-[12px] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
              <span className="text-[16px] font-bold">주소 검색</span>
              <button
                type="button"
                onClick={closeEmbed}
                aria-label="닫기"
                className="p-2 -m-2"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div ref={embedHostRef} className="flex-1 min-h-0" />
          </div>
        </div>
      )}
    </>
  )
}
