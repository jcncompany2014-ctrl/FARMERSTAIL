'use client'

/**
 * 재사용 가능한 검색 입력.
 *
 * 동작:
 *   1) 사용자가 타이핑하면 로컬 state 즉시 반영 (즉응성).
 *   2) 180ms debounce 뒤 `router.replace(pathname?q=...)` 로 URL 동기화.
 *      replace 이유: 매 글자마다 history 쌓이면 뒤로가기 가 도저히 못 쓰임.
 *   3) Enter 나 submit 시 디바운스 우회, 즉시 URL 반영.
 *   4) 값이 비면 `q` 파라미터를 URL 에서 제거 — 다른 필터 (category) 는 유지.
 *
 * PWA 모바일 환경에서 soft keyboard 가 올라오는 순간 layout shift 가 일어나
 * LCP 에 영향이 갈 수 있어서, input 은 `autocomplete="off"` 로 키보드 팝업
 * 하단 제안바를 줄인다 (iOS 에서 효과적). inputMode="search" 는 모바일
 * 키보드의 '돋보기→이동' 키를 돋보기로 바꿔준다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

type Props = {
  placeholder?: string
  /** q 가 바뀔 때마다 부모에 알려주고 싶을 때. URL 동기화와 병렬. */
  onChange?: (q: string) => void
  className?: string
  /** q 파라미터 이름 커스텀 (예: 다른 검색 UI 와 충돌 방지). 기본 'q'. */
  paramName?: string
  debounceMs?: number
}

export default function SearchBar({
  placeholder = '제품명으로 검색',
  onChange,
  className,
  paramName = 'q',
  debounceMs = 180,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initial = searchParams.get(paramName) ?? ''
  const [value, setValue] = useState(initial)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // URL 의 q 가 외부 네비게이션으로 바뀐 경우 동기화 (뒤로가기 등).
  useEffect(() => {
    const next = searchParams.get(paramName) ?? ''
    setValue((prev) => (prev === next ? prev : next))
    // paramName 바뀔 일 없지만 ESLint deps 완비.
  }, [searchParams, paramName])

  const writeToUrl = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next.trim()) {
        params.set(paramName, next.trim())
      } else {
        params.delete(paramName)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, paramName, router, searchParams],
  )

  // value 변화 → debounce → URL 동기화 + onChange.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      writeToUrl(value)
      onChange?.(value.trim())
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // onChange 는 매 렌더마다 레퍼런스가 바뀔 수 있어 deps 에서 제외. 호출자는
    // useCallback 으로 안정화해서 넘기는 게 이상적이지만 미안정화 콜백이
    // 들어와도 루프가 돌진 않는다 (value 가 같아야 같은 타이머 예약).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs])

  const clear = () => {
    setValue('')
    if (timerRef.current) clearTimeout(timerRef.current)
    writeToUrl('')
    onChange?.('')
    inputRef.current?.focus()
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (timerRef.current) clearTimeout(timerRef.current)
        writeToUrl(value)
        onChange?.(value.trim())
        inputRef.current?.blur()
      }}
      className={[
        'relative flex items-center gap-2 rounded-full',
        'bg-white border border-rule focus-within:border-terracotta',
        'transition-colors',
        'pl-4 pr-1 py-1',
        className ?? '',
      ].join(' ')}
    >
      <Search
        className="w-4 h-4 shrink-0"
        strokeWidth={2}
        color="var(--muted)"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        inputMode="search"
        autoComplete="off"
        enterKeyHint="search"
        className="flex-1 min-w-0 bg-transparent py-1.5 text-[13px] text-ink placeholder:text-muted focus:outline-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={clear}
          aria-label="검색어 지우기"
          className="shrink-0 rounded-full p-1.5 hover:bg-bg-2 transition"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} color="var(--muted)" />
        </button>
      )}
    </form>
  )
}
