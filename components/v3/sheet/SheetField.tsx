'use client'

/**
 * 기록 시트 공용 폼 프리미티브 — 복약·예방접종 등 add/edit BottomSheet 에서 재사용.
 *
 * # 왜 있나 (2026-07-16)
 * 복약·예방접종 클라이언트가 `w-full px-4 py-3 rounded border border-rule bg-bg-3 …`
 * 인풋 class 문자열을 각자 3~4번씩 복붙하고, 라벨은 tiny uppercase mono 라 답답했다.
 * (사장님 "팝업 디자인 별로"). 라벨·인풋을 한 곳으로 모아 톤을 통일한다.
 *
 * # 라벨이 입력을 감싼다 (2026-08-07 앱 화면 감사)
 * 예전엔 `<label>` 이 입력의 **형제**였고 htmlFor/id 도 없었다. 그래서
 * 스크린리더가 "약물 이름"·"용량"·"접종일" 을 읽지 못했고, 라벨을 눌러도
 * 포커스가 가지 않았다(복약 5필드 + 접종 4필드).
 *
 * 같은 저장소의 mypage/addresses/AddressForm 의 `Field` 는 **입력을 label 로
 * 감싸서** 암묵적 연결을 하고 그 이유까지 적어 뒀다 — 그게 정본인데 시트 쪽만
 * 안 따라갔다. id 를 만들어 붙이는 방식은 소비처가 id 를 넘겨야 해서 또 빠뜨린다.
 * 감싸는 쪽이 빠뜨릴 수 없다.
 */

import { type InputHTMLAttributes, type ReactNode } from 'react'

/** 시트 폼 필드 라벨 래퍼 — 입력을 감싸 라벨과 묶는다. */
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
    <label className="block mt-4">
      <span className="block text-[11.5px] font-bold text-text/80 mb-1.5">
        {label}
        {required && <span className="text-sale"> *</span>}
      </span>
      {children}
    </label>
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
