'use client'

/**
 * useFitTextSize — heading 텍스트가 컨테이너 폭을 넘으면 자동으로 fontSize 축소.
 *
 * 강아지 이름 길이 (15자+) 같이 가변 텍스트가 hero 헤딩에 들어갈 때, 고정
 * fontSize 가 overflow + ellipsis 또는 줄바뀜으로 깨지는 걸 방지.
 *
 * # 동작
 *  1. min~max 범위에서 binary-search (또는 linear step) 로 가장 큰 fontSize 찾기
 *  2. ResizeObserver 로 컨테이너 폭 변경 감지 → 재계산
 *  3. SSR 단계 → max 반환 (hydration 후 1회 재측정)
 *
 * @example
 *   const { ref, fontSize } = useFitTextSize(58, 28)
 *   <h1 ref={ref} style={{ fontSize }}>{dogName}</h1>
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseFitTextSizeResult {
  /** 타겟 요소 ref. */
  ref: React.RefCallback<HTMLElement>
  /** 현재 fontSize (px). */
  fontSize: number
}

export function useFitTextSize(
  maxSize: number,
  minSize: number,
  step = 2,
): UseFitTextSizeResult {
  const [size, setSize] = useState<number>(maxSize)
  const elRef = useRef<HTMLElement | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  const recalc = useCallback(() => {
    const el = elRef.current
    if (!el || !el.parentElement) return
    const parentWidth = el.parentElement.clientWidth
    if (parentWidth <= 0) return

    // 임시로 큰 사이즈로 측정 → 줄어들 때까지 step 만큼 감소
    const originalSize = el.style.fontSize
    let tryPx = maxSize
    el.style.fontSize = `${tryPx}px`
    el.style.whiteSpace = 'nowrap'
    while (tryPx > minSize && el.scrollWidth > parentWidth) {
      tryPx -= step
      el.style.fontSize = `${tryPx}px`
    }
    el.style.whiteSpace = ''
    // restore 후 react state 로 sync
    el.style.fontSize = originalSize
    setSize(tryPx)
  }, [maxSize, minSize, step])

  const ref = useCallback<React.RefCallback<HTMLElement>>(
    (node) => {
      // cleanup 이전 observer
      if (roRef.current) {
        roRef.current.disconnect()
        roRef.current = null
      }
      elRef.current = node
      if (!node || !node.parentElement) return

      recalc()
      const ro = new ResizeObserver(() => recalc())
      ro.observe(node.parentElement)
      roRef.current = ro
    },
    [recalc],
  )

  // unmount cleanup
  useEffect(() => {
    return () => {
      if (roRef.current) roRef.current.disconnect()
    }
  }, [])

  return { ref, fontSize: size }
}
