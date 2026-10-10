'use client'

/**
 * HomeDogTabs — 강아지 여러 마리일 때 홈의 "우리 아이" 고르기 (앱 새 디자인 2026-10-09, 캔버스 AppHomeMultiTabs · 결정 C안).
 *
 * 예전엔 윗줄 오른쪽 강아지 칩 드롭다운이 이 일을 했다. 시안 결정으로 윗줄은 화면 이름·알림 종만 두고,
 * 고르기는 강아지 카드 바로 위 탭으로 옮겼다. 고른 아이는 예전과 같은 저장소에 남긴다:
 *  · 쿠키 ft_active_dog — 홈(서버 컴포넌트)이 읽어 그 아이를 맨 앞으로(dashboard page)
 *  · localStorage ft_active_dog — 앱 틀(AppChrome)이 읽어 가운데 기록 버튼이 그 아이로 기록
 *  · 'ft-active-dog' 창 이벤트 — 이미 떠 있는 앱 틀에 바로 알림(새로고침 없이 기록 대상이 바뀜)
 */

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { V3 } from '@/lib/design/tokens'
import DogPawMark from '@/components/DogPawMark'

export interface HomeDogTab {
  id: string
  name: string
  photoUrl?: string | null
}

export const ACTIVE_DOG_EVENT = 'ft-active-dog'

export default function HomeDogTabs({ dogs, activeId }: { dogs: HomeDogTab[]; activeId: string }) {
  const router = useRouter()
  // 누르는 즉시 탭이 바뀌어 보이게(서버 새로 그리기는 뒤따라온다).
  const [picked, setPicked] = useState(activeId)
  const [syncedFrom, setSyncedFrom] = useState(activeId)
  if (syncedFrom !== activeId) {
    setSyncedFrom(activeId)
    setPicked(activeId)
  }

  function select(id: string) {
    if (id === picked) return
    setPicked(id)
    try {
      window.localStorage.setItem('ft_active_dog', id)
      // eslint-disable-next-line react-hooks/immutability -- document.cookie 쓰기는 정당한 부수효과(오탐)
      document.cookie = `ft_active_dog=${id}; path=/; max-age=31536000; samesite=lax`
      window.dispatchEvent(new CustomEvent(ACTIVE_DOG_EVENT, { detail: id }))
    } catch {
      /* storage/cookie 불가 환경 — 화면 새로 그리기만 */
    }
    router.refresh()
  }

  return (
    <>
      <div style={{ margin: '30px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* 이 제목만 본문 글꼴 800(시안) — 앱 h2 기본은 제목 글꼴이라 직접 지정 */}
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, fontFamily: 'var(--font-sans)', color: V3.ink }}>우리 아이</h2>
        <Link
          href="/dogs/new"
          style={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            fontSize: 15,
            fontWeight: 700,
            color: V3.inkSoft,
            textDecoration: 'none',
          }}
        >
          + 강아지 추가
        </Link>
      </div>
      <div
        role="tablist"
        aria-label="강아지 고르기"
        style={{ margin: '6px 20px 0', display: 'flex', gap: 8, overflowX: 'auto' }}
      >
        {dogs.map((d) => {
          const on = d.id === picked
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(d.id)}
              className="transition active:scale-[0.97]"
              style={{
                height: 48,
                padding: '0 16px 0 8px',
                border: `1.5px solid ${on ? V3.ink : '#D6D6D6'}`,
                borderRadius: 4,
                background: on ? V3.ink : '#FFFFFF',
                color: on ? '#FFFFFF' : V3.ink,
                fontFamily: 'inherit',
                fontSize: 17,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'relative',
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: V3.soft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {d.photoUrl ? (
                  <Image src={d.photoUrl} alt="" fill sizes="32px" className="object-cover" />
                ) : (
                  <DogPawMark size={16} color={V3.inkMute} />
                )}
              </span>
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
