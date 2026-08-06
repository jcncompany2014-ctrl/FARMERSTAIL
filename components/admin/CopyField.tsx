'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * 눌러서 복사되는 값 — 어드민 전용.
 *
 * # 왜 있는가 (2026-08-07 어드민 감사)
 * 매주 화요일 포장할 때 주소·전화번호를 택배사 화면에 옮겨 적는다. 그런데
 * 복사 버튼이 저장소 전체에서 **프로모션 링크 한 곳**뿐이라, 피킹 리스트에서는
 * 폰으로 주소를 드래그 선택해야 했다 — 한 줄이 두 줄로 접히면 선택이 자꾸
 * 어긋나고, 잘못 복사하면 엉뚱한 곳으로 박스가 간다.
 *
 * 값 자체를 버튼으로 만든다(별도 아이콘 버튼을 옆에 두면 폰에서 타깃이 두 개로
 * 쪼개진다). 복사되면 2초간 체크로 바뀐다 — 눌렸는지 모르면 두 번 누른다.
 */
export default function CopyField({
  value,
  label,
  className,
}: {
  /** 실제로 복사될 값. */
  value: string
  /** 화면에 보일 텍스트. 없으면 value 그대로. */
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* 클립보드 권한이 없으면 조용히 넘어간다 — 드래그 선택은 여전히 된다. */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label ?? value} 복사`}
      className={`inline-flex items-center gap-1.5 min-h-[32px] px-2 -mx-2 rounded text-left hover:bg-zinc-100 active:bg-zinc-200 transition ${className ?? ''}`}
    >
      <span className="min-w-0">{label ?? value}</span>
      {copied ? (
        <Check className="w-3 h-3 shrink-0 text-moss" strokeWidth={2.5} />
      ) : (
        <Copy className="w-3 h-3 shrink-0 text-zinc-400" strokeWidth={2} />
      )}
    </button>
  )
}
