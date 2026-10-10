'use client'

import { useState } from 'react'

/** 주문번호 복사(웹 시안 Done). */
export default function CopyOrderNumber({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1800)
        } catch {
          /* 복사 못 해도 번호는 화면에 있다 */
        }
      }}
      style={{ height: 32, padding: '0 10px', borderRadius: 2, border: '1px solid #BDBDBD', background: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#141414' }}
    >
      {done ? '복사했어요' : '복사'}
    </button>
  )
}
