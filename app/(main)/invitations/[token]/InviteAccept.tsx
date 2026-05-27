'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HeartHandshake,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/v3'

const ROLE_LABEL: Record<'member' | 'viewer', string> = {
  member: '함께 케어하는 가족',
  viewer: '함께 지켜보는 가족',
}

const ROLE_DESCRIPTION: Record<'member' | 'viewer', string> = {
  member: '일지 작성, 체크인 응답까지 함께 할 수 있어요',
  viewer: '일지·체크인 결과를 함께 볼 수 있어요',
}

export default function InviteAccept({
  token,
  dogName,
  inviterName,
  role,
  expiresAt,
  invalidReason,
}: {
  token: string
  dogName: string | null
  inviterName: string | null
  role: 'member' | 'viewer' | null
  expiresAt: string | null
  invalidReason: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)

  async function handleAccept() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as {
        ok: boolean
        dogId?: string | null
        message?: string
      }
      if (!data.ok) {
        toast.error(data.message ?? '수락하지 못했어요')
        return
      }
      setAccepted(true)
      toast.success('초대를 수락했어요')
      // 잠깐 후 dog 페이지로 이동
      setTimeout(() => {
        if (data.dogId) {
          router.push(`/dogs/${data.dogId}`)
        } else {
          router.push('/dogs')
        }
      }, 800)
    } catch {
      toast.error('잠시 네트워크가 불안정한 것 같아요. 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  async function handleDecline() {
    if (busy) return
    const ok = await confirm({
      title: '초대를 거절할까요?',
      body: '초대 링크가 더 이상 작동하지 않아요. 보호자에게 새로 부탁해야 해요.',
      confirmLabel: '거절',
      tone: 'destructive',
    })
    if (!ok) return
    setBusy(true)
    try {
      // 거절 endpoint 는 후속에 — 일단 클라이언트 측에서 뒤로가기
      toast.info('초대를 닫았어요')
      router.push('/dogs')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded border bg-bg-3 px-6 py-7 shadow-sm" style={{ borderColor: 'var(--rule)' }}>
        {/* 헤더 아이콘 */}
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'color-mix(in srgb, var(--terracotta) 10%, white)',
              color: 'var(--terracotta)',
            }}
            aria-hidden
          >
            <HeartHandshake className="w-7 h-7" strokeWidth={1.8} />
          </div>
        </div>

        {invalidReason ? (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <AlertCircle className="w-4 h-4 text-sale" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-sale">
                초대 사용 불가
              </span>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink)' }}>
              {invalidReason}
            </p>
            <Link
              href="/dogs"
              className="mt-5 inline-block text-[12px] font-bold text-muted hover:text-text underline"
            >
              내 강아지로 돌아가기
            </Link>
          </div>
        ) : accepted ? (
          <div className="text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto" style={{ color: 'var(--moss)' }} />
            <p className="mt-3 text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
              가족이 되었어요
            </p>
            <p className="mt-1 text-[12px] text-muted">잠시 후 강아지 페이지로 이동해요</p>
          </div>
        ) : (
          <>
            <span className="kicker block text-center" style={{ color: 'var(--terracotta)' }}>
              Family · 가족 초대
            </span>
            <h1
              className="font-sans text-center mt-1.5 leading-tight"
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {dogName ? `${dogName}의 가족이 되어주세요` : '가족 초대를 받았어요'}
            </h1>
            {inviterName && (
              <p className="text-center mt-2 text-[12.5px] text-text/80 leading-relaxed">
                <strong>{inviterName}</strong>님이 초대했어요
              </p>
            )}

            {role && (
              <div className="mt-5 rounded border bg-bg/40 px-4 py-3" style={{ borderColor: 'var(--rule)' }}>
                <div className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                  역할
                </div>
                <p className="mt-1 text-[13.5px] font-bold" style={{ color: 'var(--ink)' }}>
                  {ROLE_LABEL[role]}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {ROLE_DESCRIPTION[role]}
                </p>
              </div>
            )}

            {expiresAt && (
              <p className="mt-3 text-[11px] text-center text-muted">
                {fmtExpire(expiresAt)} 까지 유효해요
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAccept}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded text-[13px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
                style={{ background: 'var(--terracotta)' }}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    수락 중...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />
                    초대 수락하기
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={busy}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded text-[12px] font-bold text-muted hover:text-text transition disabled:opacity-60"
              >
                다음에 할게요
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function fmtExpire(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
