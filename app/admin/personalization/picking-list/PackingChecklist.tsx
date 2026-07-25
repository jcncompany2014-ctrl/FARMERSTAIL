'use client'

import { useSyncExternalStore, useState } from 'react'
import { Check } from 'lucide-react'

/**
 * 패킹 체크 모드 (계획 A-F2) — 화요일 포장 실수 방지.
 *
 * # 왜
 * 박스를 여러 개 싸다 보면 "이 강아지 것 쌌나?" 를 놓친다. 서버 상태를 만들
 * 만큼 무거운 일은 아니고(그날 하루짜리 작업 메모), 대신 새로고침·화면 이동엔
 * 살아남아야 한다 → localStorage.
 *
 * # 저장 규칙
 * 키 = `packing:{shipDate}` — 발송일이 바뀌면 자동으로 빈 상태에서 시작한다
 * (지난주 체크가 이번 주에 남지 않는다). 값 = 체크된 subId 배열.
 *
 * # 구조
 * 서버 컴포넌트(page.tsx)가 만든 박스 카드를 children 으로 감싸고, 각 카드
 * 위에 체크 토글을 얹는다. 체크되면 카드가 흐려지고 취소선 대신 "완료" 배지가
 * 붙는다(주소·팩 구성은 계속 읽혀야 하므로 취소선 대신 투명도).
 */

/**
 * 다른 탭에서 같은 키를 바꿨을 때만 오는 storage 이벤트 구독.
 * (같은 탭의 쓰기는 version state 로 재조회한다 — storage 이벤트는 자기 탭에
 *  발화하지 않는다.)
 */
function subscribeToStorage(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

export default function PackingChecklist({
  shipDate,
  subIds,
  children,
}: {
  shipDate: string
  /** 박스 순서와 1:1 대응하는 구독 id 목록. children 과 같은 길이·순서. */
  subIds: string[]
  children: React.ReactNode[]
}) {
  const storageKey = `packing:${shipDate}`

  // localStorage 는 React 밖의 외부 저장소 — useSyncExternalStore 로 읽는다.
  // (effect 안 setState 는 cascading render 라 lint 가 막고, 서버 스냅샷을
  //  빈 값으로 주면 hydration 도 안전하다.)
  const [version, setVersion] = useState(0)
  const raw = useSyncExternalStore(
    subscribeToStorage,
    () => {
      void version // 쓰기 후 재조회 트리거
      try {
        return localStorage.getItem(storageKey) ?? ''
      } catch {
        return ''
      }
    },
    () => '', // SSR: 항상 빈 상태로 렌더 → 클라 복원 시 자연스럽게 갱신
  )
  const done: Set<string> = (() => {
    if (!raw) return new Set()
    try {
      return new Set(JSON.parse(raw) as string[])
    } catch {
      return new Set()
    }
  })()
  const loaded = typeof window !== 'undefined'

  function write(next: Set<string>) {
    try {
      if (next.size === 0) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, JSON.stringify([...next]))
    } catch {
      /* 저장 실패해도 화면 동작은 유지 */
    }
    setVersion((v) => v + 1)
  }

  function toggle(id: string) {
    const next = new Set(done)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    write(next)
  }

  function reset() {
    write(new Set())
  }

  const doneCount = done.size
  const total = subIds.length

  return (
    <div>
      {/* 진행 바 — 몇 개 남았는지 한눈에 */}
      <div className="mb-3 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div className="flex-1">
          <p className="text-[12px] font-bold text-zinc-800">
            포장 진행 {loaded ? doneCount : 0} / {total}
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{
                width: `${total > 0 && loaded ? (doneCount / total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            박스를 쌀 때마다 체크하세요. 이 기기에만 저장되고, 발송일이 바뀌면
            자동으로 초기화돼요.
          </p>
        </div>
        {loaded && doneCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-bold text-zinc-600 hover:border-zinc-400"
          >
            체크 초기화
          </button>
        )}
      </div>

      <div className="space-y-3">
        {children.map((card, i) => {
          const id = subIds[i]!
          const isDone = loaded && done.has(id)
          return (
            <div key={id} className="relative">
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-pressed={isDone}
                aria-label={isDone ? '포장 완료 취소' : '포장 완료로 표시'}
                className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : 'border border-zinc-300 bg-white text-zinc-600 hover:border-emerald-400 hover:text-emerald-600'
                }`}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                {isDone ? '완료' : '포장 완료'}
              </button>
              <div className={isDone ? 'opacity-45 transition-opacity' : ''}>
                {card}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
