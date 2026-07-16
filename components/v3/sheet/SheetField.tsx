'use client'

/**
 * 기록 시트 공용 폼 프리미티브 — 복약·예방접종 등 add/edit BottomSheet 에서 재사용.
 *
 * # 왜 있나 (2026-07-16)
 * 복약·예방접종 클라이언트가 `w-full px-4 py-3 rounded border border-rule bg-bg-3 …`
 * 인풋 class 문자열을 각자 3~4번씩 복붙하고, 라벨은 tiny uppercase mono 라 답답했다.
 * (사장님 "팝업 디자인 별로"). 라벨·인풋을 한 곳으로 모아 톤을 통일한다.
 */

import { type InputHTMLAttributes, type ReactNode } from 'react'

/** 시트 폼 필드 라벨 래퍼. */
export function SheetField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="mt-4">
      <label className="block text-[11.5px] font-bold text-text/80 mb-1.5">
        {label}
        {required && <span className="text-sale"> *</span>}
      </label>
      {children}
    </div>
  )
}

/** 공용 텍스트 인풋 — 중복되던 class 문자열을 1곳으로. */
export function SheetInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13.5px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition"
    />
  )
}
