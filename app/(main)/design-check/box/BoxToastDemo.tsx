'use client'

/**
 * /design-check/box/checkin?s=first-done — 첫 박스 체크인을 보낸 뒤 뜨는 짧은 알림을 띄워 시안(S28)과 비교한다.
 * 미리보기 전용. 자동으로 사라지지 않게(duration null) 한 번 띄운다. 문구는 FirstCheckinClient 의 성공 알림과 같다.
 */

import { useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'

export default function BoxToastDemo({ message }: { message: string }) {
  const toast = useToast()
  const shown = useRef(false)
  useEffect(() => {
    if (shown.current) return
    shown.current = true
    toast.success(message, { duration: null })
  }, [message, toast])
  return null
}
