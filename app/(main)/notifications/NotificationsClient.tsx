'use client'

// audit #101 — NotificationsClient: filter / mark-read / click navigation 만
// client. page.tsx (server) 가 auth + 최근 100개 push_log 를 prefetch.
//
// ★2026-10-09 앱 새 디자인('A 포스터', 시안 M11 받은 알림 · M14 비었을 때 · I13 고른 칸이 비었을 때):
//   "안 읽은 알림 N개" + '모두 읽음' 단추 → 네모 거르기 단추(전체·안 읽음·주문·건강·광고 + 개수) → 날짜 묶음
//   (위 2px 먹선 목록). 안 읽은 알림 = 빨간 점 + 굵은 제목. 영어 머리말("NOTIFICATIONS")·알약 모양·색 꼬리표는 뺐다.
//   읽음 처리·이동 로직은 그대로.
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { V3, V3Radius } from '@/lib/design/tokens'
import { Chip, IconDisc, PlainTitle, primaryButton } from '@/components/v3/me/MeParts'
import { BellIcon, BoxIcon, CheckIcon, HeartIcon, InboxIcon, MegaphoneIcon } from '@/components/v3/me/MeIcons'

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

// PushCategory(lib/push.ts) 와 1:1. 한때 restock/cart/reminder/approval/checkin
// 라벨이 있었지만 발송하는 쪽 타입엔 없는 값이라 **영원히 안 뜨는 라벨**이었다.
const CATEGORY_LABEL: Record<string, string> = {
  order: '주문',
  health: '건강',
  marketing: '광고',
}

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'unread', label: '안 읽음' },
  { key: 'order', label: '주문' },
  { key: 'health', label: '건강' },
  { key: 'marketing', label: '광고' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

export default function NotificationsClient({
  initialRows,
  embedded,
}: {
  initialRows: Row[]
  /** 통합 알림 페이지 탭 안에서 렌더될 때 true — 자체 큰 헤더('알림 센터') 숨김. */
  embedded?: boolean
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
    if (filter === 'health') return rows.filter((r) => r.category === 'health')
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

  function countFor(key: FilterKey): number {
    if (key === 'all') return rows.length
    if (key === 'unread') return unreadCount
    if (key === 'order') return rows.filter((r) => r.category === 'order' || r.category === 'restock').length
    if (key === 'health') return rows.filter((r) => r.category === 'health').length
    return rows.filter((r) => r.category === 'marketing' || r.category === 'cart').length
  }

  async function markAllRead() {
    setMarking(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('push_log')
        .update({ read_at: now })
        .eq('user_id', user.id)
        .is('read_at', null)
      // 실패 시 낙관적 갱신 안 함 — 안 읽음 유지가 정직(finally 가 marking 해제).
      if (error) return
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
    const { error } = await supabase
      .from('push_log')
      .update({ read_at: now })
      .eq('id', id)
      .eq('user_id', user.id)
    // 실패 시 낙관적 읽음 표시 안 함 — 안 읽음 유지가 정직(다음 조회서 재시도).
    if (error) return
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, read_at: r.read_at ?? now } : r,
      ),
    )
  }

  // UX audit #19: 아무 알림도 없으면 알림 설정으로 가는 길을 준다(시안 M14).
  if (rows.length === 0) {
    return (
      <section
        style={{
          margin: embedded ? '48px 20px 0' : '24px 20px 0',
          padding: '36px 20px 32px',
          border: '1.5px dashed #BDBDBD',
          borderRadius: V3Radius.sm,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <IconDisc size={64}>
          <InboxIcon size={30} color={V3.inkMute} strokeWidth={1.8} />
        </IconDisc>
        <h2 style={{ margin: '18px 0 0', fontSize: 24, lineHeight: 'normal' }}>아직 받은 알림이 없어요</h2>
        <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
          체크인, 박스 도착, 식단 변경 동의
          <br />
          알림이 여기 모여요.
        </p>
        <Link href="/mypage/notifications" style={{ ...primaryButton(54, 16), width: 'auto', marginTop: 22, padding: '0 24px' }}>
          알림 설정 보기
        </Link>
      </section>
    )
  }

  return (
    <div>
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: V3.inkSoft }}>
          안 읽은 알림{' '}
          <strong className="ft-num" style={{ fontWeight: 400, fontSize: 20, color: V3.ink }}>
            {unreadCount}
          </strong>
          개
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={marking}
            style={{
              height: 44,
              padding: '0 12px',
              boxSizing: 'border-box',
              borderRadius: V3Radius.sm,
              border: `1.5px solid ${V3.ink}`,
              background: '#FFFFFF',
              color: V3.ink,
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              opacity: marking ? 0.6 : 1,
            }}
          >
            {marking ? (
              <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} strokeWidth={2.4} />
            ) : (
              <CheckIcon size={16} strokeWidth={2.8} />
            )}
            모두 읽음
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="알림 거르기"
        style={{ marginTop: 14, padding: '0 20px', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap' }}
      >
        {FILTERS.map((f) => {
          const active = f.key === filter
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              style={{
                flexShrink: 0,
                height: 42,
                boxSizing: 'border-box',
                padding: '0 12px',
                borderRadius: V3Radius.sm,
                border: active ? 0 : `1.5px solid ${V3.ink}`,
                background: active ? V3.ink : '#FFFFFF',
                color: active ? '#FFFFFF' : V3.ink,
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: active ? 800 : 700,
                cursor: 'pointer',
              }}
            >
              {f.label} {countFor(f.key)}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <section
          aria-label="알림 없음"
          style={{
            margin: '22px 20px 0',
            padding: '22px 18px 20px',
            borderRadius: V3Radius.sm,
            background: V3.soft,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          <BellIcon size={30} color={V3.inkMute} strokeWidth={1.8} />
          <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, lineHeight: 1.4 }}>이 카테고리는 비어 있어요</p>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>다른 카테고리를 골라 보세요.</p>
        </section>
      ) : (
        groups.map((g, gi) => (
          <section
            key={g.label}
            aria-label={`${g.label} 알림`}
            style={{ padding: `${gi === 0 ? 22 : 26}px 20px 0`, display: 'flex', flexDirection: 'column' }}
          >
            <PlainTitle size={16} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {g.label} <span style={{ fontWeight: 600, color: V3.inkMute }}>{g.items.length}</span>
            </PlainTitle>
            <ol style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', borderTop: `2px solid ${V3.ink}` }}>
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
          </section>
        ))
      )}
    </div>
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

  const Icon =
    row.category === 'order' || row.category === 'checkin'
      ? BoxIcon
      : row.category === 'restock'
        ? BoxIcon
        : row.category === 'marketing' || row.category === 'cart'
          ? MegaphoneIcon
          : row.category === 'health'
            ? HeartIcon
            : BellIcon

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%',
          padding: '14px 0',
          border: 0,
          borderBottom: `1px solid ${V3.rule}`,
          background: 'transparent',
          color: V3.ink,
          fontFamily: 'inherit',
          textAlign: 'left',
          display: 'grid',
          gridTemplateColumns: '40px 1fr',
          columnGap: 12,
          cursor: 'pointer',
        }}
      >
        <IconDisc size={40}>
          <Icon size={19} color={V3.ink} />
        </IconDisc>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            {isUnread ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 17, fontWeight: 800, lineHeight: 1.35 }}>
                <span
                  role="img"
                  aria-label="안 읽음"
                  style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 4, background: V3.sale }}
                />
                {row.title}
              </span>
            ) : (
              <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>{row.title}</span>
            )}
            <span style={{ flexShrink: 0, fontSize: 14, color: V3.inkMute }}>{timeAgo}</span>
          </span>
          {row.body && (
            <span style={{ fontSize: 15, lineHeight: 1.5, color: isUnread ? V3.inkSoft : V3.inkMute }}>{row.body}</span>
          )}
          {(catLabel || row.sent_count === 0 || row.url) && (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'flex', gap: 6 }}>
                {catLabel && (
                  <Chip tone="soft" height={24}>
                    {catLabel}
                  </Chip>
                )}
                {row.sent_count === 0 && (
                  <Chip tone="soft" height={24} style={{ color: V3.sale }}>
                    미발송
                  </Chip>
                )}
              </span>
              {row.url && <span style={{ fontSize: 14, fontWeight: 800 }}>열기 →</span>}
            </span>
          )}
        </span>
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
