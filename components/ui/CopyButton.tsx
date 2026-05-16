'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

/**
 * CopyButton — clipboard.writeText + toast feedback.
 *
 * # 사용
 *   <CopyButton text="3333-12-34567890" label="계좌번호 복사" />
 *
 * # 디자인
 * inline-flex icon + 텍스트. clipboard API 실패 시 toast.error.
 * 복사 직후 1.5초 동안 Check 아이콘 + "복사됨".
 */
export default function CopyButton({
  text,
  label = '복사',
  className,
  size = 'sm',
}: {
  text: string
  label?: string
  className?: string
  size?: 'xs' | 'sm'
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!text) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        toast.success('복사했어요')
        setTimeout(() => setCopied(false), 1500)
      } else {
        toast.error('복사 기능을 사용할 수 없어요')
      }
    } catch {
      toast.error('복사하지 못했어요')
    }
  }

  const sizeCls =
    size === 'xs'
      ? 'text-[10px] px-2 py-1 gap-1'
      : 'text-[11px] px-2.5 py-1.5 gap-1'
  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center font-bold rounded-full border border-rule bg-white hover:border-terracotta hover:text-terracotta active:scale-[0.96] transition ${sizeCls} ${className ?? ''}`}
      aria-label={label}
    >
      {copied ? (
        <>
          <Check className={iconSize} strokeWidth={2.5} />
          복사됨
        </>
      ) : (
        <>
          <Copy className={iconSize} strokeWidth={2} />
          {label}
        </>
      )}
    </button>
  )
}
