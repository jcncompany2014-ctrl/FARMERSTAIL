import { Badge } from '@/components/adminui/badge'
import { ADMIN_TONE_CLASS, type AdminBadge } from '@/lib/admin/status-badge'

/**
 * 어드민 상태 배지 그리기 — 이름·색 판정은 lib/admin/status-badge 하나(2026-10-24 규칙316).
 * note(카드 거절·부분 환불 등)는 배지 옆 작은 회색 글씨. withNote=false 면 배지만(좁은 표 칸).
 */
export default function AdminStatusBadge({
  badge,
  withNote = true,
  className = '',
}: {
  badge: AdminBadge
  withNote?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className}`}>
      <Badge className={`shrink-0 ${ADMIN_TONE_CLASS[badge.tone]}`}>{badge.label}</Badge>
      {withNote && badge.note && <span className="text-[12px] text-muted-foreground">{badge.note}</span>}
    </span>
  )
}
