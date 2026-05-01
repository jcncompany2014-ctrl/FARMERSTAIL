'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, BellRing } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Admin 헤더의 실시간 주문 알림 벨.
 *
 * Supabase Realtime 으로 orders 테이블 INSERT 이벤트 구독. 새 주문이 들어오면:
 *   1) 벨 아이콘 ring 애니메이션 + unread 카운트 +1
 *   2) (옵션) 브라우저 알림 (사용자 권한 허용 시)
 *   3) 클릭 시 dropdown 으로 최근 5건 노출 + /admin/orders 이동
 *
 * # 왜 RLS 우회?
 * admin 의 supabase client 는 anon 키로 동작하지만 admin 사용자라 orders 의
 * RLS 가 자기 데이터만 허용하면 다른 사용자 주문을 못 본다. orders 테이블의
 * admin RLS policy 가 (role='admin') 사용자에게 모든 row read 허용한다 가정.
 *
 * # SSR / 클라이언트
 * RSC 에서 import 가능하지만 'use client' — Realtime 은 WebSocket 이라 client
 * 만 동작. layout 에 한 번만 마운트.
 */

type Notification = {
  id: string
  order_number: string
  total_amount: number
  recipient_name: string | null
  created_at: string
}

const MAX_VISIBLE = 5

export default function OrderRealtimeBell() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Realtime 구독.
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as unknown as Notification & {
            payment_status?: string
          }
          // payment_status === 'pending' 인 신규 주문만 — Toss confirm 후
          // status 가 'paid' 로 update 되는 건 별도 이벤트라 중복 방지.
          // 단, 운영자에겐 결제 완료된 주문이 더 중요하므로 'paid' 도 보고
          // 받으려면 update 이벤트도 구독해야 한다. 지금은 INSERT 만.
          setNotifications((prev) =>
            [
              {
                id: row.id,
                order_number: row.order_number,
                total_amount: row.total_amount,
                recipient_name: row.recipient_name,
                created_at: row.created_at,
              },
              ...prev,
            ].slice(0, MAX_VISIBLE),
          )
          setUnreadCount((c) => c + 1)
          // 브라우저 알림 — 권한 있을 때만.
          maybeBrowserNotify(row)
        },
      )
      .subscribe()

    // 초기 권한 요청 (한 번만, default 상태일 때).
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      // 명시 동의 UX 가 더 좋지만 admin 컨텍스트라 자동 요청 OK.
      Notification.requestPermission().catch(() => {})
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // 외부 클릭 닫기.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!dropdownRef.current) return
      if (!dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function toggleOpen() {
    setOpen((v) => !v)
    if (!open) setUnreadCount(0) // 열면 read 처리
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition"
        aria-label={`주문 알림 ${unreadCount}건`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-gold animate-pulse" strokeWidth={2} />
        ) : (
          <Bell className="w-5 h-5 text-muted" strokeWidth={2} />
        )}
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-black flex items-center justify-center px-1"
            style={{ background: 'var(--sale)', color: 'white' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-xl overflow-hidden z-30"
          style={{
            background: 'var(--bg)',
            boxShadow:
              '0 12px 36px rgba(0,0,0,0.18), inset 0 0 0 1px var(--rule)',
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--rule)' }}
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
              실시간 주문
            </span>
            <Link
              href="/admin/orders"
              className="text-[11px] font-bold text-terracotta hover:underline"
              onClick={() => setOpen(false)}
            >
              전체 보기 →
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="text-[12.5px] text-muted text-center py-8 px-4 leading-relaxed">
              새 주문이 들어오면 여기에 표시돼요.
              <br />
              실시간 연결됨.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/admin/orders/${n.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-bg-2/50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-text truncate">
                        {n.order_number}
                      </p>
                      <p className="text-[10.5px] text-muted mt-0.5">
                        {n.recipient_name ?? '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12.5px] font-black text-terracotta tabular-nums">
                        {n.total_amount.toLocaleString()}원
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">
                        {formatRelative(n.created_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function maybeBrowserNotify(row: {
  order_number: string
  total_amount: number
}): void {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification('새 주문', {
      body: `${row.order_number} · ${row.total_amount.toLocaleString()}원`,
      icon: '/icons/icon-192.png',
      tag: `order-${row.order_number}`,
      // requireInteraction: true 면 클릭/닫기 전엔 안 사라짐. admin 이라 허용.
      requireInteraction: false,
    })
  } catch {
    /* noop */
  }
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return '방금'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return new Date(iso).toLocaleDateString('ko-KR')
}
