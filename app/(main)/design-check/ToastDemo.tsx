'use client'

/**
 * /design-check?s=toast-done · toast-fail — 짧은 알림(토스트) 완료·실패를 띄워 시안(캔버스 B10·B11)과 비교한다.
 * 미리보기 전용. 자동으로 사라지지 않게(duration null) 띄운다.
 */

import { useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'

export default function ToastDemo({ kind }: { kind: 'done' | 'fail' }) {
  const toast = useToast()
  const shown = useRef(false)
  useEffect(() => {
    if (shown.current) return
    shown.current = true
    if (kind === 'done') toast.success('체중을 기록했어요', { duration: null })
    else toast.error('저장하지 못했어요', { duration: null })
  }, [kind, toast])
  return null
}
