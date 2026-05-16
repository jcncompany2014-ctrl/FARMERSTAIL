'use client'

// audit #101 — NotificationsClient: filter / mark-read / click navigation 만
// client. page.tsx (server) 가 auth + 최근 100개 push_log 를 prefetch.
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Bell,
  Check,
  Inbox,
  ArrowRight,
  Package,
  RefreshCcw,
  Megaphone,
  Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'
import './notifications.css'

export type Row = {
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

const CATEGORY_COLOR: Record<string, string> = {
  order: 'var(--moss)',
  restock: 'var(--terracotta)',
  marketing: 'var(--gold)',
  cart: 'var(--gold)',
  reminder: 'var(--terracotta)',
  approval: 'var(--terracotta)',
  checkin: 'var(--moss)',
}

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'unread', label: '안 읽음' },
  { key: 'order', label: '주문' },
  { key: 'marketing', label: '마케팅' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

export default function NotificationsClient({
  initialRows,
}: {
  initialRows: Row[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [marking, setMarking] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')

  const unreadCount = rows.filter((r) => r.read_at === null).length

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'unread') return rows.filter((r) => r.read_at === null)
    if (filter === 'order')
      return rows.filter(
        (r) => r.category === 'order' || r.category === 'restock',
      )
    if (filter === 'marketing')
      return rows.filter(
        (r) => r.category === 'marketing' || r.category === 'cart',
      )
    return rows
  }, [rows, filter])

  const groups = useMemo(() => {
    const today: Row[] = []
    const yesterday: Row[] = []
    const earlier: Row[] = []
    const now = Date.now()
    const todayStart = new Date(now).setHours(0, 0, 0, 0)
    const yesterdayStart = todayStart - 86_400_000
    for (const r of filtered) {
      const t = new Date(r.sent_at).getTime()
      if (t >= todayStart) today.push(r)
      else if (t >= yesterdayStart) yesterday.push(r)
      else earlier.push(r)
    }
    return [
      { label: '오늘', items: today },
      { label: '어제', items: yesterday },
      { label: '이전', items: earlier },
    ].filter((g) => g.items.length > 0)
  }, [filtered])

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
      setRows((prev) =>
        prev.map((r) => ({ ...r, read_at: r.read_at ?? now })),
      )
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
      prev.map((r) =>
        r.id === id ? { ...r, read_at: r.read_at ?? now } : r,
      ),
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
        <p>최근 100개 알림. 클릭하면 자동으로 읽음 처리돼요.</p>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={marking}
            className="nt-mark-all"
          >
            {marking ? (
              <Spinner size={11} />
            ) : (
              <Check size={11} strokeWidth={2.6} />
            )}
            모두 읽음
          </button>
        )}
      </header>

      {rows.length > 0 && (
        <div
          className="grid grid-cols-4 gap-px rounded-xl overflow-hidden mx-5 mt-2"
          style={{ background: 'var(--rule)' }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key
            const count =
              f.key === 'all'
                ? rows.length
                : f.key === 'unread'
                  ? unreadCount
                  : f.key === 'order'
                    ? rows.filter(
                        (r) =>
                          r.category === 'order' || r.category === 'restock',
                      ).length
                    : rows.filter(
                        (r) =>
                          r.category === 'marketing' || r.category === 'cart',
                      ).length
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="py-2 text-[11px] font-bold transition"
                style={{
                  background: active ? 'var(--ink)' : 'white',
                  color: active ? 'white' : 'var(--text)',
                }}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className="ml-1 inline-block px-1 rounded-full text-[9.5px] font-bold tabular-nums"
                    style={{
                      background: active
                        ? 'rgba(255,255,255,0.18)'
                        : 'var(--bg-2)',
                      color: active ? 'white' : 'var(--muted)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {rows.length === 0 ? (
        // UX audit #19: empty state CTA — 알림 설정 진입 안내.
        <div className="nt-empty">
          <Inbox size={28} strokeWidth={1.5} color="var(--muted)" />
          <p>아직 받은 알림이 없어요.</p>
          <p className="nt-empty-sub">
            체크인 / 박스 도착 / 새 비율 동의 알림이 여기 모여요.
          </p>
          <Link
            href="/mypage/notifications"
            className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-full text-[12px] font-bold text-white"
            style={{ background: 'var(--terracotta)' }}
          >
            알림 설정 보기
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="nt-empty">
          <Inbox size={28} strokeWidth={1.5} color="var(--muted)" />
          <p>이 카테고리는 비어 있어요</p>
          <p className="nt-empty-sub">다른 카테고리를 골라 보세요</p>
        </div>
      ) : (
        <div className="px-5 mt-3 space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Calendar
                  className="w-3 h-3 text-muted"
                  strokeWidth={2}
                />
                <span className="text-[11px] font-bold text-text">
                  {g.label}
                </span>
                <span className="text-[10px] text-muted tabular-nums">
                  {g.items.length}
                </span>
              </div>
              <ol className="nt-list">
                {g.items.map((row) => (
                  <NotificationCard
                    key={row.id}
                    row={row}
                    onClick={() => {
                      if (row.read_at === null) void markOneRead(row.id)
                      if (row.url) router.push(row.url)
                    }}
                  />
                ))}
              </ol>
            </div>
          ))}
        </div>
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
  const catLabel = row.category
    ? CATEGORY_LABEL[row.category] ?? row.category
    : null
  const catColor = row.category
    ? CATEGORY_COLOR[row.category] ?? 'var(--muted)'
    : 'var(--muted)'

  const Icon =
    row.category === 'order' || row.category === 'checkin'
      ? Package
      : row.category === 'restock'
        ? RefreshCcw
        : row.category === 'marketing' || row.category === 'cart'
          ? Megaphone
          : Bell

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={'nt-card ' + (isUnread ? 'nt-unread' : '')}
      >
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: `color-mix(in srgb, ${catColor} 12%, white)`,
            }}
            aria-hidden
          >
            <Icon
              className="w-3.5 h-3.5"
              style={{ color: catColor }}
              strokeWidth={2}
            />
          </div>

          <div className="flex-1 min-w-0 text-left">
            <div className="nt-card-head">
              <div className="nt-card-title-row">
                {isUnread && <span className="nt-dot" />}
                <span className="nt-title">{row.title}</span>
              </div>
              <span className="nt-time">{timeAgo}</span>
            </div>
            {row.body && <p className="nt-body">{row.body}</p>}
            <div className="nt-foot">
              {catLabel && (
                <span
                  className="nt-tag"
                  style={{
                    background: `color-mix(in srgb, ${catColor} 8%, white)`,
                    color: catColor,
                    border: `1px solid color-mix(in srgb, ${catColor} 30%, white)`,
                  }}
                >
                  {catLabel}
                </span>
              )}
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
          </div>
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
