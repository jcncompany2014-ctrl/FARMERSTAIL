'use client'

import { useEffect, useRef, useState } from 'react'
import {
  UserPlus,
  Users,
  Mail,
  Loader2,
  X,
  Crown,
  Eye,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useModalA11y } from '@/lib/ui/useModalA11y'

/**
 * DogFamilyMembers — 강아지 가족 멤버 + 초대 UI.
 *
 * # 표시
 *  - owner 1명 + member/viewer N명 칩 리스트
 *  - "+ 가족 초대" 버튼 → 모달 (email + role)
 *  - pending 초대 (accepted_at NULL) 도 회색 칩으로 표시 → 재발송 버튼
 *
 * # 권한
 *  - 멤버 추가/제거는 owner 만. props.isOwner 로 분기.
 *  - 멤버 본인은 "나가기" 가능 — 별도 endpoint 필요 (후속).
 *
 * # 데이터 fetch
 *  - dog_members (RLS: 본인 OR owner 가 통과)
 *  - profiles join (id → name)
 *  - dog_invitations pending
 *
 * voice-guidelines §10 — 가족이라는 단어를 따뜻하게 사용. "초대" 톤은
 * 부드럽게 ("함께 케어해주실 분이 있으면 초대해보세요").
 */

type MemberRow = {
  id: string
  user_id: string
  role: 'member' | 'viewer'
  accepted_at: string
  user_name: string | null
  user_email: string | null
}

type PendingInvitation = {
  id: string
  email: string
  role: 'member' | 'viewer'
  expires_at: string
  token: string
}

export default function DogFamilyMembers({
  dogId,
  isOwner,
  ownerName,
}: {
  dogId: string
  isOwner: boolean
  ownerName: string | null
}) {
  const supabase = createClient()
  const toast = useToast()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [pending, setPending] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  // reloadKey 를 증가시키면 useEffect 가 재실행 — 명시적 refresh 트리거.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // 외부 데이터 sync — IIFE 안에서 setState 호출이라 react-hooks/set-state
    // -in-effect 룰 통과. cancelled 가드로 unmount race 차단.
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: memberRows } = await supabase
        .from('dog_members')
        .select(
          'id, user_id, role, accepted_at, profiles!dog_members_user_id_fkey(name)',
        )
        .eq('dog_id', dogId)
        .order('accepted_at', { ascending: true })
      if (cancelled) return
      type RawRow = {
        id: string
        user_id: string
        role: 'member' | 'viewer'
        accepted_at: string
        profiles?: { name: string | null } | null
      }
      // audit #79: Supabase typed select 가 profiles relation 을 모름 → unknown cast.
      const list = ((memberRows ?? []) as unknown as RawRow[]).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        accepted_at: r.accepted_at,
        user_name: r.profiles?.name ?? null,
        user_email: null,
      }))
      setMembers(list)

      if (isOwner) {
        const { data: pendingRows } = await supabase
          .from('dog_invitations')
          .select('id, email, role, expires_at, token')
          .eq('dog_id', dogId)
          .is('accepted_at', null)
          .is('declined_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
        if (cancelled) return
        setPending((pendingRows ?? []) as PendingInvitation[])
      } else {
        setPending([])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, isOwner, supabase, reloadKey])

  function load() {
    setReloadKey((k) => k + 1)
  }

  async function removeMember(memberId: string) {
    if (!confirm('이 가족을 정말 내보낼까요? 다시 초대하면 돌아올 수 있어요.')) {
      return
    }
    const { error } = await supabase
      .from('dog_members')
      .delete()
      .eq('id', memberId)
    if (error) {
      toast.error('내보내지 못했어요')
      return
    }
    toast.success('내보냈어요')
    load()
  }

  async function cancelInvite(inviteId: string) {
    if (!confirm('초대를 취소할까요?')) return
    const { error } = await supabase
      .from('dog_invitations')
      .update({ declined_at: new Date().toISOString() })
      .eq('id', inviteId)
    if (error) {
      toast.error('취소하지 못했어요')
      return
    }
    toast.success('초대를 취소했어요')
    load()
  }

  return (
    <section
      className="rounded-2xl border bg-white px-5 py-4"
      style={{ borderColor: 'var(--rule)' }}
      aria-label="강아지 가족"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Users
            className="w-4 h-4"
            strokeWidth={2}
            style={{ color: 'var(--terracotta)' }}
            aria-hidden
          />
          <span className="kicker" style={{ color: 'var(--terracotta)' }}>
            Family · 가족
          </span>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rule bg-white text-[11px] font-bold text-text hover:border-terracotta hover:text-terracotta transition"
          >
            <UserPlus className="w-3 h-3" strokeWidth={2.2} />
            초대
          </button>
        )}
      </div>

      {/* Owner */}
      <div className="flex items-center gap-2 mb-1.5">
        <Crown className="w-3.5 h-3.5" strokeWidth={2} style={{ color: 'var(--gold)' }} />
        <span className="text-[12px] font-bold" style={{ color: 'var(--ink)' }}>
          {ownerName ?? '주 보호자'}
        </span>
        <span className="text-[10.5px] text-muted">owner</span>
      </div>

      {/* Members */}
      {loading ? (
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted py-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          멤버 불러오는 중...
        </div>
      ) : members.length === 0 && pending.length === 0 ? (
        <p className="text-[11.5px] text-muted leading-relaxed mt-1">
          {isOwner
            ? '함께 케어할 가족이 있으면 초대해보세요. 강제 X — 옵션이에요.'
            : '아직 다른 가족이 없어요'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              {m.role === 'viewer' ? (
                <Eye className="w-3.5 h-3.5 text-muted" strokeWidth={2} />
              ) : (
                <HeartHandshake
                  className="w-3.5 h-3.5"
                  strokeWidth={2}
                  style={{ color: 'var(--moss)' }}
                />
              )}
              <span className="text-[12px] font-bold flex-1" style={{ color: 'var(--ink)' }}>
                {m.user_name ?? '가족 한 분'}
              </span>
              <span className="text-[10.5px] text-muted">
                {m.role === 'viewer' ? 'viewer' : 'member'}
              </span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  aria-label="내보내기"
                  className="p-1 text-muted hover:text-sale transition"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.id} className="flex items-center gap-2 opacity-70">
              <Mail className="w-3.5 h-3.5 text-muted" strokeWidth={2} />
              <span className="text-[11.5px] flex-1 truncate" style={{ color: 'var(--text)' }}>
                {p.email}
              </span>
              <span className="text-[10.5px] text-muted">발송됨</span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => cancelInvite(p.id)}
                  aria-label="초대 취소"
                  className="p-1 text-muted hover:text-sale transition"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        dogId={dogId}
        onInvited={() => {
          setInviteOpen(false)
          load()
        }}
      />
    </section>
  )
}

function InviteModal({
  open,
  onClose,
  dogId,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  dogId: string
  onInvited: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y({ open, onClose, containerRef: dialogRef })
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'viewer'>('member')
  const [busy, setBusy] = useState(false)

  // 모달 닫힐 때 form reset
  useEffect(() => {
    if (!open) {
      setEmail('')
      setRole('member')
      setBusy(false)
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/.+@.+\..+/.test(trimmed)) {
      toast.error('올바른 이메일을 입력해주세요')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/dogs/${dogId}/invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: trimmed, role }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        emailSent?: boolean
        code?: string
        message?: string
      }
      if (!res.ok || !data.ok) {
        toast.error(data.message ?? '초대를 보내지 못했어요')
        return
      }
      toast.success(
        data.emailSent
          ? '초대 메일을 보냈어요'
          : '초대를 만들었어요 (메일 발송은 별도로 전달해주세요)',
      )
      onInvited()
    } catch {
      toast.error('네트워크 오류가 발생했어요')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2
            id="invite-modal-title"
            className="font-serif"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            가족 초대
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="p-1.5 rounded-full hover:bg-bg/60 transition disabled:opacity-50"
          >
            <X className="w-5 h-5 text-muted" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 pb-5 space-y-3">
          <div>
            <label className="text-[10.5px] font-bold uppercase tracking-widest text-muted">
              이메일
            </label>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="family@example.com"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-rule text-[13px] focus:outline-none focus:border-terracotta"
              disabled={busy}
            />
          </div>

          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted">
              역할
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <RoleOption
                checked={role === 'member'}
                onChange={() => setRole('member')}
                icon={<HeartHandshake className="w-4 h-4" strokeWidth={2} />}
                label="함께 케어"
                desc="일지·체크인 작성 가능"
              />
              <RoleOption
                checked={role === 'viewer'}
                onChange={() => setRole('viewer')}
                icon={<Eye className="w-4 h-4" strokeWidth={2} />}
                label="함께 보기"
                desc="조회만 가능"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-[13px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: 'var(--terracotta)' }}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                보내는 중...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" strokeWidth={2.2} />
                초대 메일 보내기
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function RoleOption({
  checked,
  onChange,
  icon,
  label,
  desc,
}: {
  checked: boolean
  onChange: () => void
  icon: React.ReactNode
  label: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition"
      style={{
        borderColor: checked ? 'var(--terracotta)' : 'var(--rule)',
        background: checked ? 'color-mix(in srgb, var(--terracotta) 6%, white)' : 'white',
      }}
    >
      <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: 'var(--ink)' }}>
        {icon}
        {label}
        {checked && (
          <CheckCircle2
            className="w-3 h-3"
            strokeWidth={2.2}
            style={{ color: 'var(--terracotta)' }}
          />
        )}
      </span>
      <span className="text-[10.5px] leading-snug text-muted">{desc}</span>
    </button>
  )
}
