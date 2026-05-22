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
import { Mono } from '@/components/v3'

export default function AddressesClient({ initial }: { initial: Address[] }) {
  const router = useRouter()
  const toast = useToast()
  const [list, setList] = useState<Address[]>(initial)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

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

  async function handleDelete(id: string) {
    if (busyId) return
    const target = list.find((a) => a.id === id)
    if (!target) return
    const name = target.label || target.address
    const code = name.charCodeAt(name.length - 1)
    const eulReul =
      code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
        ? '을'
        : '를'
    if (!confirm(`"${name}"${eulReul} 삭제할까요?`)) return

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
              <span
                className="inline-flex items-center"
                style={{
                  gap: 4,
                  fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: V3Radius.xs,
                  background: V3.ink,
                  color: V3.paperHi,
                }}
              >
                <Star size={10} strokeWidth={2.5} fill="currentColor" />
                Default
              </span>
            ) : (
              <Mono color="inkMute" size="xxs" weight={600}>
                Saved
              </Mono>
            )}
            {a.label && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: V3FontWeight.bold,
                  padding: '3px 8px',
                  borderRadius: V3Radius.xs,
                  color: V3.accent,
                  background:
                    'color-mix(in srgb, ' + V3.accent + ' 8%, transparent)',
                  border: `1px solid ${V3.rule}`,
                }}
              >
                {a.label}
              </span>
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
                    fontSize: 13,
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
                  fontSize: 11.5,
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
                fontSize: 11.5,
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
              onClick={() => handleDelete(a.id)}
              disabled={busyId === a.id || pending}
              className="flex-1 inline-flex items-center justify-center transition disabled:opacity-50"
              style={{
                gap: 4,
                padding: '10px 0',
                fontSize: 11.5,
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
    </section>
  )
}
