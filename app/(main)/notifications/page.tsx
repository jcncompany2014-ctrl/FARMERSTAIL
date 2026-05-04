'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Bell,
  Loader2,
  Check,
  Inbox,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import './notifications.css'

/**
 * /notifications — 보호자가 받은 푸시 알림 모아보기.
 *
 * push_log 테이블에서 사용자 본인 row 만 fetch (RLS). 읽지 않은 것 위에
 * 강조. 클릭 시 push_log.read_at 갱신 + url 로 deep link 이동.
 */

type Row = {
  id: string
  title: string
  body: string
  url: string | null
  category: string | null
  sent_count: number
  read_at: string | null
  sent_at: string
}

const CATEGORY_LABEL: Record<string, string> = {
  order: '주문',
  restock: '재입고',
  cart: '장바구니',
  marketing: '광고',
  reminder: '리마인더',
  approval: '동의 요청',
  checkin: '체크인',
}

export default function NotificationsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=/notifications')
        return
      }
      const { data } = await supabase
        .from('push_log')
        .select(
          'id, title, body, url, category, sent_count, read_at, sent_at',
        )
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(100)
      if (cancelled) return
      setRows(((data ?? []) as unknown) as Row[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const unreadCount = rows.filter((r) => r.read_at === null).length

  async function markAllRead() {
    setMarking(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const now = new Date().toISOString()
      await supabase
        .from('push_log')
        .update({ read_at: now })
        .eq('user_id', user.id)
        .is('read_at', null)
      setRows((prev) => prev.map((r) => ({ ...r, read_at: r.read_at ?? now })))
    } finally {
      setMarking(false)
    }
  }

  async function markOneRead(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date().toISOString()
    await supabase
      .from('push_log')
      .update({ read_at: now })
      .eq('id', id)
      .eq('user_id', user.id)
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, read_at: r.read_at ?? now } : r)),
    )
  }

  return (
    <main className="nt-page">
      <Link href="/" className="nt-back">
        <ChevronLeft size={14} strokeWidth={2.2} />홈
      </Link>

      <header className="nt-hero">
        <div className="nt-kicker">
          <Bell size={11} strokeWidth={2.4} />
          NOTIFICATIONS
          {unreadCount > 0 && (
            <span className="nt-unread-badge">{unreadCount}</span>
          )}
        </div>
        <h1>알림 센터</h1>
        <p>최근 100개 알림. 읽으면 자동 표시됩니다.</p>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={marking}
            className="nt-mark-all"
          >
            {marking ? (
              <Loader2 size={11} strokeWidth={2.4} className="animate-spin" />
            ) : (
              <Check size={11} strokeWidth={2.6} />
            )}
            모두 읽음
          </button>
        )}
      </header>

      {loading ? (
        <div className="nt-state">
          <Loader2
            size={18}
            strokeWidth={2}
            color="var(--terracotta)"
            className="animate-spin"
          />
          알림 불러오는 중...
        </div>
      ) : rows.length === 0 ? (
        <div className="nt-empty">
          <Inbox size={28} strokeWidth={1.5} color="var(--muted)" />
          <p>아직 받은 알림이 없어요.</p>
          <p className="nt-empty-sub">
            체크인 / 박스 도착 / 새 비율 동의 알림이 여기 모여요.
          </p>
        </div>
      ) : (
        <ol className="nt-list">
          {rows.map((row) => (
            <NotificationCard
              key={row.id}
              row={row}
              onClick={() => {
                if (row.read_at === null) markOneRead(row.id)
                if (row.url) router.push(row.url)
              }}
            />
          ))}
        </ol>
      )}
    </main>
  )
}

function NotificationCard({
  row,
  onClick,
}: {
  row: Row
  onClick: () => void
}) {
  const isUnread = row.read_at === null
  const timeAgo = formatTimeAgo(row.sent_at)
  const catLabel = row.category ? CATEGORY_LABEL[row.category] ?? row.category : null

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={'nt-card ' + (isUnread ? 'nt-unread' : '')}
      >
        <div className="nt-card-head">
          <div className="nt-card-title-row">
            {isUnread && <span className="nt-dot" />}
            <span className="nt-title">{row.title}</span>
          </div>
          <span className="nt-time">{timeAgo}</span>
        </div>
        {row.body && <p className="nt-body">{row.body}</p>}
        <div className="nt-foot">
          {catLabel && <span className="nt-tag">{catLabel}</span>}
          {row.sent_count === 0 && (
            <span className="nt-tag nt-tag-warn">미발송</span>
          )}
          {row.url && (
            <span className="nt-go">
              열기
              <ArrowRight size={10} strokeWidth={2.4} />
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

function formatTimeAgo(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = now - t
  if (diff < 60_000) return '방금'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}시간 전`
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}일 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()}`
}
