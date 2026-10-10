'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TrackingResult } from '@/lib/tracking'
import TrackingAppView, { type TrackingFetchState } from './TrackingAppView'

type Props = {
  carrier: string | null
  carrierLabel: string | null
  trackingNumber: string | null
  orderStatus: string
  shippedAt: string | null
  deliveredAt: string | null
  recipientName: string
  trackerDeepLink: string | null
  supportsInline: boolean
  /**
   * 화면 = TrackingAppView 하나(앱 새 디자인 'A 포스터', 캔버스 M10·I09·I10) — 조회·복사·새로고침은 이 부품이 맡는다.
   * web = 2026-10-10 웹 리뉴얼: 웹도 같은 화면을 새 가게 틀에 담는다(시안 WEB-A16 — 카드는 흰색, 겨자색 없음).
   * 예전 웹 갈래(둥근 카드·진행 막대)는 부르는 곳이 모두 이 값을 넘기게 된 뒤 지웠다(git 이력).
   */
  app: { orderNumber: string; web?: boolean }
}

type FetchState = TrackingFetchState

export default function TrackingView({
  carrier,
  carrierLabel,
  trackingNumber,
  orderStatus,
  shippedAt,
  deliveredAt,
  recipientName,
  trackerDeepLink,
  supportsInline,
  app,
}: Props) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)

  const reload = useCallback(async () => {
    if (!carrier || !trackingNumber || !supportsInline) return
    setFetchState({ status: 'loading' })
    try {
      const res = await fetch(
        `/api/tracking?carrier=${encodeURIComponent(carrier)}&trackingNumber=${encodeURIComponent(trackingNumber)}`,
        { cache: 'no-store' }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setFetchState({
          status: 'error',
          message: data?.message ?? '택배 정보를 불러오지 못했어요',
          code: data?.code,
          justShipped: shippedAt != null && Date.now() - Date.parse(shippedAt) < 36 * 60 * 60 * 1000,
        })
        return
      }
      setFetchState({ status: 'ok', data: data as TrackingResult })
    } catch {
      setFetchState({
        status: 'error',
        message: '잠시 네트워크가 불안정한 것 같아요. 다시 시도해 주세요',
      })
    }
  }, [carrier, trackingNumber, supportsInline, shippedAt])

  useEffect(() => {
    // Defer to a microtask so the loading-state transition isn't a
    // synchronous setState in the effect body (react-hooks/set-state-in-effect).
    if (supportsInline && carrier && trackingNumber) {
      queueMicrotask(reload)
    }
  }, [supportsInline, carrier, trackingNumber, reload])

  async function copyTracking() {
    if (!trackingNumber) return
    try {
      await navigator.clipboard.writeText(trackingNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore — fallback is native selection */
    }
  }

  return (
    <TrackingAppView
      orderNumber={app.orderNumber}
      web={app.web}
      carrierLabel={carrierLabel}
      trackingNumber={trackingNumber}
      hasTracking={!!trackingNumber && !!carrier}
      recipientName={recipientName}
      orderStatus={orderStatus}
      shippedAt={shippedAt}
      deliveredAt={deliveredAt}
      trackerDeepLink={trackerDeepLink}
      supportsInline={supportsInline}
      fetchState={fetchState}
      copied={copied}
      onCopy={copyTracking}
      onReload={reload}
    />
  )
}
