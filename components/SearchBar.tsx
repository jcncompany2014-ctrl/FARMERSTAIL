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
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X, Clock, TrendingUp } from 'lucide-react'

/**
 * Recent searches — localStorage `ft_recent_searches`.
 * 마지막 5개 (중복 제거, 최근 순). focus 시 dropdown 으로 노출.
 */
const RECENT_KEY = 'ft_recent_searches'
const RECENT_MAX = 5

function readRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((s): s is string => typeof s === 'string').slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

function pushRecent(q: string): string[] {
  if (typeof window === 'undefined') return []
  const trimmed = q.trim()
  if (!trimmed) return readRecent()
  try {
    const cur = readRecent()
    const next = [trimmed, ...cur.filter((s) => s !== trimmed)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    return next
  } catch {
    return readRecent()
  }
}

type SuggestItem = {
  id: string
  name: string
  slug: string
  category: string | null
  image_url: string | null
  price: number
  sale_price: number | null
}

function clearRecent(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(RECENT_KEY)
  } catch {
    /* noop */
  }
}

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
  const [focused, setFocused] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestAbortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)

  // 최근 검색어 hydrate (mount 1회).
  useEffect(() => {
    setRecent(readRecent())
  }, [])

  // 외부 click 으로 dropdown 닫기.
  useEffect(() => {
    if (!focused) return
    const onDocClick = (e: MouseEvent) => {
      if (!formRef.current) return
      if (!formRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [focused])
  // 마지막으로 URL 에 쓴 (정규화된) 값. 같은 값을 또 쓰는 router.replace 를 막아
  // 무의미한 RSC 재요청을 차단한다. 마운트 시점에는 URL 의 initial 이 이미
  // 정답이므로 같은 값으로 시작.
  const lastWrittenRef = useRef<string>(initial.trim())

  // URL 의 q 가 외부 네비게이션으로 바뀐 경우 동기화 (뒤로가기 등).
  useEffect(() => {
    const next = searchParams.get(paramName) ?? ''
    // 외부에서 URL 이 바뀐 거니까 lastWrittenRef 도 그 값으로 끌어올려서,
    // 그 다음 debounce effect 가 같은 값을 또 쓰려 하지 않게 한다.
    lastWrittenRef.current = next.trim()
    setValue((prev) => (prev === next ? prev : next))
    // paramName 바뀔 일 없지만 ESLint deps 완비.
  }, [searchParams, paramName])

  const writeToUrl = useCallback(
    (next: string) => {
      const trimmed = next.trim()
      if (trimmed === lastWrittenRef.current) return
      lastWrittenRef.current = trimmed
      const params = new URLSearchParams(searchParams.toString())
      if (trimmed) {
        params.set(paramName, trimmed)
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

  // value 변화 → 220ms 디바운스 → /api/search/suggest fetch.
  // 키 입력당 fetch 가 너무 많이 가는 걸 막기 위해 URL 동기화보다 약간 길게
  // 220ms 잡음. AbortController 로 직전 요청 취소.
  useEffect(() => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    suggestAbortRef.current?.abort()
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setSuggestions([])
      setSuggestLoading(false)
      return
    }
    suggestTimerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      suggestAbortRef.current = controller
      setSuggestLoading(true)
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        )
        if (!res.ok) {
          setSuggestions([])
          return
        }
        const data = (await res.json()) as { items?: SuggestItem[] }
        setSuggestions(Array.isArray(data.items) ? data.items : [])
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setSuggestions([])
        }
      } finally {
        setSuggestLoading(false)
      }
    }, 220)
    return () => {
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
      suggestAbortRef.current?.abort()
    }
  }, [value])

  const clear = () => {
    setValue('')
    if (timerRef.current) clearTimeout(timerRef.current)
    writeToUrl('')
    onChange?.('')
    inputRef.current?.focus()
  }

  return (
    <form
      ref={formRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (timerRef.current) clearTimeout(timerRef.current)
        writeToUrl(value)
        onChange?.(value.trim())
        if (value.trim()) setRecent(pushRecent(value))
        setFocused(false)
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
        onFocus={() => setFocused(true)}
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

      {/* Recent searches dropdown — focus + 입력값 비어 있을 때만 */}
      {focused && value.length === 0 && recent.length > 0 && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg)',
            boxShadow:
              '0 8px 24px rgba(30,26,20,0.12), inset 0 0 0 1px var(--rule)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--rule)' }}
          >
            <span
              className="font-mono text-[10px] tracking-[0.18em] uppercase"
              style={{ color: 'var(--muted)' }}
            >
              Recent · 최근 검색
            </span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                clearRecent()
                setRecent([])
              }}
              className="text-[10.5px] font-bold underline underline-offset-2"
              style={{ color: 'var(--terracotta)' }}
            >
              모두 삭제
            </button>
          </div>
          <ul>
            {recent.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // mousedown 으로 처리해 input blur 보다 먼저 실행
                    e.preventDefault()
                    setValue(q)
                    writeToUrl(q)
                    setRecent(pushRecent(q))
                    onChange?.(q)
                    setFocused(false)
                    inputRef.current?.blur()
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition active:bg-bg-2"
                  style={{ color: 'var(--text)' }}
                >
                  <Clock
                    className="w-3.5 h-3.5 shrink-0"
                    strokeWidth={2}
                    color="var(--muted)"
                  />
                  <span className="text-[13px] truncate">{q}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 자동완성 dropdown — 입력값 있을 때 suggest API 결과.
          상품 카드 형태 (썸네일 + 이름 + 카테고리 + 가격). 클릭 시 PDP 직진. */}
      {focused && value.length > 0 && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg)',
            boxShadow:
              '0 8px 24px rgba(30,26,20,0.12), inset 0 0 0 1px var(--rule)',
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--rule)' }}
          >
            <TrendingUp
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={2}
              color="var(--muted)"
            />
            <span
              className="font-mono text-[10px] tracking-[0.18em] uppercase"
              style={{ color: 'var(--muted)' }}
            >
              Suggest · 추천 상품
            </span>
            {suggestLoading && (
              <div
                className="ml-auto w-3 h-3 border rounded-full animate-spin"
                style={{
                  borderColor: 'var(--terracotta)',
                  borderTopColor: 'transparent',
                }}
              />
            )}
          </div>
          <ul>
            {suggestions.map((p) => {
              const effective = p.sale_price ?? p.price
              return (
                <li key={p.id}>
                  <Link
                    href={`/products/${p.slug}`}
                    onMouseDown={(e) => {
                      // input blur 차단 — Link 의 client-side 네비게이션 진행
                      e.preventDefault()
                    }}
                    onClick={() => {
                      setRecent(pushRecent(value))
                      setFocused(false)
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 transition active:bg-bg-2"
                  >
                    <div
                      className="relative w-10 h-10 shrink-0 rounded-md overflow-hidden"
                      style={{ background: 'var(--bg-2)' }}
                    >
                      {p.image_url && (
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-bold truncate"
                        style={{ color: 'var(--text)' }}
                      >
                        {p.name}
                      </p>
                      {p.category && (
                        <p
                          className="text-[10.5px] mt-0.5"
                          style={{ color: 'var(--muted)' }}
                        >
                          {p.category}
                        </p>
                      )}
                    </div>
                    <p
                      className="text-[12px] font-black tabular-nums shrink-0"
                      style={{ color: 'var(--terracotta)' }}
                    >
                      {effective.toLocaleString()}원
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 자동완성 결과 0건 안내 */}
      {focused && value.length > 0 && !suggestLoading && suggestions.length === 0 && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-2xl overflow-hidden px-4 py-3"
          style={{
            background: 'var(--bg)',
            boxShadow:
              '0 8px 24px rgba(30,26,20,0.12), inset 0 0 0 1px var(--rule)',
          }}
        >
          <p
            className="text-[12px]"
            style={{ color: 'var(--muted)' }}
          >
            <strong style={{ color: 'var(--text)' }}>"{value}"</strong>{' '}
            검색 결과가 없어요. Enter 를 눌러 전체 카탈로그에서 다시 시도하실
            수 있어요.
          </p>
        </div>
      )}
    </form>
  )
}
