'use client'

/**
 * AddressesClient — v3 reskin (2026-05-22 R9-5).
 *
 * 비즈니스 로직(낙관적 update + 기본 설정/삭제) 그대로.
 * 시각: paperHi 카드 + Mono kicker (기본 vs Saved) + 1px rule footer 액션.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Pencil, Star, Trash2 } from 'lucide-react'
import type { Address } from '@/lib/commerce/addresses'
import { useToast } from '@/components/ui/Toast'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import { Mono, Modal, Badge } from '@/components/v3'

export default function AddressesClient({ initial }: { initial: Address[] }) {
  const router = useRouter()
  const toast = useToast()
  const [list, setList] = useState<Address[]>(initial)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  // R10-3b: browser confirm() 대체 — 삭제 확인 modal 상태.
  const [deleting, setDeleting] = useState<Address | null>(null)

  async function handleSetDefault(id: string) {
    if (busyId) return
    setBusyId(id)
    const prev = list
    const next = list.map((a) => ({ ...a, isDefault: a.id === id }))
    next.sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1))
    setList(next)

    try {
      const res = await fetch(`/api/addresses/${id}/default`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      startTransition(() => router.refresh())
    } catch {
      setList(prev)
      toast.error('기본 배송지로 바꾸지 못했어요')
    } finally {
      setBusyId(null)
    }
  }

  /**
   * 삭제 실행 — Modal confirm 액션에서 호출. 이전엔 confirm() 으로 분기.
   */
  async function performDelete(id: string) {
    setBusyId(id)
    const prev = list
    setList(list.filter((a) => a.id !== id))

    try {
      const res = await fetch(`/api/addresses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      startTransition(() => router.refresh())
    } catch {
      setList(prev)
      toast.error('삭제하지 못했어요')
    } finally {
      setBusyId(null)
      setDeleting(null)
    }
  }

  return (
    <section
      style={{
        padding: '12px 20px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {list.map((a) => (
        <article
          key={a.id}
          className="overflow-hidden"
          style={{
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
          }}
        >
          <header
            className="flex items-center"
            style={{ padding: '12px 16px 0', gap: 6 }}
          >
            {a.isDefault ? (
              <Badge tone="ink" filled size="sm">
                <Star size={10} strokeWidth={2.5} fill="currentColor" />
                Default
              </Badge>
            ) : (
              <Mono color="inkMute" size="xxs" weight={600}>
                Saved
              </Mono>
            )}
            {a.label && (
              <Badge tone="accent" size="sm" upper={false}>
                {a.label}
              </Badge>
            )}
          </header>

          <div style={{ padding: '8px 16px 14px' }}>
            <div className="flex items-start" style={{ gap: 8 }}>
              <MapPin
                size={15}
                color={V3.inkMute}
                strokeWidth={1.75}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <div className="min-w-0">
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13.5,
                    fontWeight: V3FontWeight.bold,
                    color: V3.ink,
                    lineHeight: 1.35,
                  }}
                >
                  {a.recipientName}
                </div>
                <Mono
                  color="inkMute"
                  size="xxs"
                  weight={500}
                  letterSpacing="0.06em"
                  style={{ marginTop: 4, display: 'inline-block' }}
                >
                  {a.phone}
                </Mono>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: V3.ink,
                    lineHeight: 1.55,
                  }}
                >
                  [{a.zip}] {a.address}
                  {a.addressDetail && (
                    <>
                      <br />
                      {a.addressDetail}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <footer
            className="flex"
            style={{ borderTop: `1px solid ${V3.rule}` }}
          >
            {!a.isDefault && (
              <button
                type="button"
                onClick={() => handleSetDefault(a.id)}
                disabled={busyId === a.id || pending}
                className="flex-1 transition disabled:opacity-50"
                style={{
                  padding: '10px 0',
                  fontSize: 12,
                  fontWeight: V3FontWeight.bold,
                  color: V3.inkMute,
                  background: 'transparent',
                  borderRight: `1px solid ${V3.rule}`,
                  border: 'none',
                  borderLeft: 'none',
                }}
              >
                기본으로
              </button>
            )}
            <Link
              href={`/mypage/addresses/${a.id}/edit`}
              className="flex-1 inline-flex items-center justify-center transition"
              style={{
                gap: 4,
                padding: '10px 0',
                fontSize: 12,
                fontWeight: V3FontWeight.bold,
                color: V3.inkMute,
                borderRight: `1px solid ${V3.rule}`,
                textDecoration: 'none',
              }}
            >
              <Pencil size={14} strokeWidth={2} />
              수정
            </Link>
            <button
              type="button"
              onClick={() => setDeleting(a)}
              disabled={busyId === a.id || pending}
              className="flex-1 inline-flex items-center justify-center transition disabled:opacity-50"
              style={{
                gap: 4,
                padding: '10px 0',
                fontSize: 12,
                fontWeight: V3FontWeight.bold,
                color: V3.sale,
                background: 'transparent',
                border: 'none',
              }}
            >
              <Trash2 size={14} strokeWidth={2} />
              삭제
            </button>
          </footer>
        </article>
      ))}

      {/* R10-3b: 배송지 삭제 확인 modal — confirm() 대체. */}
      <Modal
        open={deleting !== null}
        onClose={() => {
          if (busyId === deleting?.id) return
          setDeleting(null)
        }}
        title="배송지를 삭제할까요?"
        dismissOnBackdrop={busyId !== deleting?.id}
        showClose={busyId !== deleting?.id}
      >
        <Modal.Body>
          {deleting && (
            <>
              <strong style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}>
                {deleting.label || deleting.address}
              </strong>{' '}
              삭제 후에는 되돌릴 수 없어요.
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setDeleting(null)}
            disabled={busyId === deleting?.id}
            style={{
              padding: '10px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              background: V3.paperHi,
              color: V3.inkMute,
              border: `1px solid ${V3.rule}`,
              cursor: busyId === deleting?.id ? 'not-allowed' : 'pointer',
              opacity: busyId === deleting?.id ? 0.5 : 1,
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => deleting && void performDelete(deleting.id)}
            disabled={busyId === deleting?.id}
            style={{
              padding: '10px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              background: V3.sale,
              color: V3.paperHi,
              border: 'none',
              cursor: busyId === deleting?.id ? 'not-allowed' : 'pointer',
              opacity: busyId === deleting?.id ? 0.7 : 1,
            }}
          >
            {busyId === deleting?.id ? '삭제 중…' : '삭제'}
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  )
}
