'use client'

/**
 * 오늘 주문하면 언제 출고되나 — 브라우저 시계(KST)로 계산한다. 화면은 캐시해 두므로 서버에서 날짜를 박으면
 * 자정이 지나도 어제 기준 출고일이 남는다. 서버 그림(첫 그림)엔 null — 부르는 쪽이 '화·목 출고' 같은 말을 쓴다.
 */
import { useSyncExternalStore } from 'react'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { shipDateLabel, storeShipDate } from '@/lib/store/shipping'

function subscribe(cb: () => void) {
  // 1분마다 다시 본다 — 자정을 넘기면 출고일이 바뀐다.
  const t = window.setInterval(cb, 60_000)
  return () => window.clearInterval(t)
}
const getSnapshot = () => todayKstIsoDate()
const getServerSnapshot = () => null

export function useShipDate(): { iso: string; label: string } | null {
  const today = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (!today) return null
  const iso = storeShipDate(today)
  return { iso, label: shipDateLabel(iso) }
}
