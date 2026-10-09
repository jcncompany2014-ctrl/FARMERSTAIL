'use client'

/**
 * /design-check/me 전용 데모 조각 — 서버 페이지가 함수 props(닫기·완료)를 넘길 수 없어서 클라이언트에서 감싼다.
 * 실제 화면 부품을 그대로 쓰고, 열려 있는 상태만 미리 만든다.
 */

import AddressForm from '../../mypage/addresses/AddressForm'
import { AddressSearchSheet } from '@/components/AddressSearchSheet'
import type { Address } from '@/lib/commerce/addresses'

/** 주소 검색 창(시안 M04) — 설치된 앱에서만 열리는 시트라, 미리보기 브라우저에선 열린 채로 그려 둔다. */
export function AddressSearchDemo({ initial }: { initial: Address }) {
  return (
    <>
      <AddressForm mode="create" initial={initial} />
      <AddressSearchSheet open onClose={() => {}} onComplete={() => {}} />
    </>
  )
}
