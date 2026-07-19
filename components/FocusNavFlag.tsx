'use client'

import { useEffect } from 'react'

/**
 * FocusNavFlag — 키보드 네비게이션 중에만 포커스 링을 보이게 하는 전역 플래그.
 *
 * # 왜 (사장님 2026-07-19 폰)
 * 모달·FAB 메뉴·드로어가 열릴 때 첫 요소에 프로그램 포커스가 가면 :focus-visible
 * 주황 링이 "자동으로" 떴다(터치 유저에겐 뜬금없는 네모). iOS Safari 는 프로그램/
 * 터치 포커스에도 :focus-visible 를 종종 매칭한다.
 *
 * # 동작
 * Tab 키를 누른 순간에만 `<html data-kbnav>` 를 켜고, 포인터(터치·마우스) 입력
 * 시 끈다. globals.css 는 `html:not([data-kbnav]) :focus-visible { outline:none }`
 * 로 **키보드일 때만** 링을 노출 → 실제 키보드/스위치 사용자의 WCAG 2.4.7 은
 * 보존하면서, 터치·프로그램 포커스의 뜬금 링만 제거한다.
 */
export default function FocusNavFlag() {
  useEffect(() => {
    const root = document.documentElement
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') root.setAttribute('data-kbnav', '')
    }
    const onPointer = () => root.removeAttribute('data-kbnav')
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('touchstart', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('touchstart', onPointer, true)
    }
  }, [])
  return null
}
