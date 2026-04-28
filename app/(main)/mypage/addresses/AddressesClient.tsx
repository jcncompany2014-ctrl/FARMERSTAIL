'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Pencil, Star, Trash2 } from 'lucide-react'
import type { Address } from '@/lib/commerce/addresses'

/**
 * 배송지 리스트의 인터랙티브 레이어.
 *
 * 서버에서 렌더된 목록을 initial 로 받아 useState 로 낙관적 업데이트.
 * 수정은 라우트 이동(/addresses/[id]/edit), 삭제·기본설정은 API 호출 후
 * router.refresh() 로 서버 목록도 다시 가져온다 (낙관적 상태 + 서버 재동기화).
 *
 * 에러는 inline 토스트 없이 alert() 로 처리 — 이 화면은 실패 확률이 낮고
 * 나중에 공용 toast 가 들어오면 그때 교체.
 */
export default function AddressesClient({ initial }: { initial: Address[] }) {
  const router = useRouter()
  const [list, setList] = useState<Address[]>(initial)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleSetDefault(id: string) {
    if (busyId) return
    setBusyId(id)
    // 낙관적: 클라이언트 상태에서 기본값을 옮긴다.
    const prev = list
    const next = list.map((a) => ({ ...a, isDefault: a.id === id }))
    // 기본 배송지가 위로 오도록 정렬.
    next.sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1))
    setList(next)

    try {
      const res = await fetch(`/api/addresses/${id}/default`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      startTransition(() => router.refresh())
    } catch {
      setList(prev)
      alert('기본 배송지 설정에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    if (busyId) return
    const target = list.find((a) => a.id === id)
    if (!target) return
    if (!confirm(`"${target.label || target.address}" 을(를) 삭제할까요?`)) return

    setBusyId(id)
    const prev = list
    setList(list.filter((a) => a.id !== id))

    try {
      const res = await fetch(`/api/addresses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      startTransition(() => router.refresh())
    } catch {
      setList(prev)
      alert('삭제에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="px-5 mt-3 space-y-3">
      {list.map((a) => (
        <article
          key={a.id}
          className="rounded-2xl border bg-white overflow-hidden"
          style={{ borderColor: 'var(--rule)' }}
        >
          <header className="px-4 pt-3.5 flex items-center gap-2">
            {a.isDefault ? (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                <Star className="w-3 h-3" strokeWidth={2.5} fill="currentColor" />
                기본 배송지
              </span>
            ) : (
              <span className="kicker kicker-muted">Saved</span>
            )}
            {a.label && (
              <span
                className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                style={{
                  color: 'var(--terracotta)',
                  background: 'color-mix(in srgb, var(--terracotta) 8%, transparent)',
                }}
              >
                {a.label}
              </span>
            )}
          </header>

          <div className="px-4 pt-2 pb-3">
            <div className="flex items-start gap-2">
              <MapPin
                className="w-[15px] h-[15px] text-muted mt-0.5 shrink-0"
                strokeWidth={1.75}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-text leading-snug">
                  {a.recipientName}
                </div>
                <div className="text-[11px] text-muted mt-0.5">{a.phone}</div>
                <div className="text-[12px] text-text mt-1.5 leading-relaxed">
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
            className="flex border-t"
            style={{ borderColor: 'var(--rule-2)' }}
          >
            {!a.isDefault && (
              <button
                type="button"
                onClick={() => handleSetDefault(a.id)}
                disabled={busyId === a.id || pending}
                className="flex-1 py-2.5 text-[11.5px] font-bold text-muted hover:text-ink transition disabled:opacity-50 border-r"
                style={{ borderColor: 'var(--rule-2)' }}
              >
                기본으로
              </button>
            )}
            <Link
              href={`/mypage/addresses/${a.id}/edit`}
              className="flex-1 py-2.5 text-[11.5px] font-bold text-muted hover:text-ink transition inline-flex items-center justify-center gap-1 border-r"
              style={{ borderColor: 'var(--rule-2)' }}
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
              수정
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(a.id)}
              disabled={busyId === a.id || pending}
              className="flex-1 py-2.5 text-[11.5px] font-bold text-muted hover:text-sale transition disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
              삭제
            </button>
          </footer>
        </article>
      ))}
    </section>
  )
}
