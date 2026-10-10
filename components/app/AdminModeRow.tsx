'use client'

/**
 * 관리자 모드 스위치 — 운영자 본인에게만 보인다(2026-07-25 사장님 요청).
 *
 * ★2026-10-09 앱 새 디자인('A 포스터'): 예전엔 윗줄 오른쪽 강아지 칩을 누르면 펼쳐지는 메뉴 안에 있었다.
 *   시안 결정으로 윗줄은 화면 이름·알림 종만 남기고 강아지 고르기는 홈 탭으로 옮겨서, 이 스위치는
 *   '내 정보'로 왔다. 동작은 그대로다:
 *   켜면 관리자 홈으로, 끄면 앱 홈으로 이동한다. 선택은 localStorage ft_admin_mode 에 남아 **다시 끄기 전까지
 *   유지**된다(앱을 껐다 켜면 AppChrome 이 한 번만 관리자 화면으로 데려간다). 이 스위치는 화면 전환 편의일 뿐
 *   권한 경계가 아니다 — /admin 은 서버가 매번 권한을 확인한다. 판정은 DB is_admin() RPC(역할 값을 클라가 들고 있지 않다).
 *   운영 알림(아침 브리핑 등)은 이 스위치와 무관하게 항상 온다.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { V3 } from '@/lib/design/tokens'

export default function AdminModeRow() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [on, setOn] = useState(false)

  useEffect(() => {
    let alive = true
    const supabase = createClient()
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('is_admin')
        if (!alive || error || data !== true) return // 일반 사용자거나 조회 실패 — 스위치 미노출
        setIsAdmin(true)
        try {
          setOn(window.localStorage.getItem('ft_admin_mode') === '1')
        } catch {
          /* 저장소 접근 불가 — 기본 꺼짐 */
        }
      } catch {
        /* 조회 실패 — 스위치 미노출 */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!isAdmin) return null

  function toggle() {
    const next = !on
    setOn(next)
    try {
      window.localStorage.setItem('ft_admin_mode', next ? '1' : '0')
    } catch {
      /* 저장 불가 — 이번 세션만 적용 */
    }
    router.push(next ? '/admin' : '/dashboard')
  }

  return (
    <section style={{ padding: '24px 20px 0' }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        className="transition active:scale-[0.99]"
        style={{
          width: '100%',
          minHeight: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 4,
          background: V3.soft,
          border: 0,
          color: V3.ink,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>관리자 모드</span>
          <span style={{ fontSize: 14, color: V3.inkMute }}>운영자에게만 보여요</span>
        </span>
        <span
          aria-hidden
          style={{
            width: 48,
            height: 28,
            borderRadius: 999,
            background: on ? V3.ink : '#D6D6D6',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 160ms ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: on ? 23 : 3,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: '#FFFFFF',
              transition: 'left 160ms ease',
            }}
          />
        </span>
      </button>
    </section>
  )
}
