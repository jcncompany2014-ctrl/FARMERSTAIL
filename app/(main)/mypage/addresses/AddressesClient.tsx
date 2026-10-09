'use client'

/**
 * AddressesClient — v3 reskin (2026-05-22 R9-5).
 *
 * 비즈니스 로직(낙관적 update + 기본 설정/삭제) 그대로.
 * 시각: paperHi 카드 + Mono kicker (기본 vs Saved) + 1px rule footer 액션.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 M01 배송지): 웹 프로필(/account/profile 웹 화면)도 이 부품을 쓰므로
 *   **isApp 일 때만** 새 모양으로 그린다 — 웹(isApp=false)은 아래 옛 마크업 그대로(한 픽셀도 안 바뀜).
 *   · 기본 배송지 = 회색 면 + 왼쪽 6px 머스타드 띠 + "기본 배송지" 먹색 표, 나머지 = 1px 회색 테두리.
 *   · 삭제 확인 = 공용 확인 창(useConfirm 의 ConfirmSheet, 시안 D03) — 이 화면은 (main) 밖이라 ConfirmProvider 가
 *     없어서 그리는 부분만 가져다 쓴다. 저장·삭제·기본 설정 로직은 두 모양이 같은 함수를 쓴다.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Pencil, Star, Trash2 } from 'lucide-react'
import type { Address } from '@/lib/commerce/addresses'
import { useToast } from '@/components/ui/Toast'
import { V3, V3FontWeight, V3FontSize, V3Radius } from '@/lib/design/tokens'
import { Mono, Modal, Badge } from '@/components/v3'
import { ConfirmSheet } from '@/components/v3/useConfirm'
import { Chip } from '@/components/v3/me/MeParts'
import { PencilIcon, TrashIcon } from '@/components/v3/me/MeIcons'

/**
 * `isApp=false` 로 렌더되면 편집 링크를 **앱 안내로** 바꾼다 (2026-07-31).
 *
 * 이 컴포넌트는 앱 화면(/mypage/addresses)뿐 아니라 **웹 프로필 화면
 * (/account/profile)에도 그대로 렌더**된다. 그런데 '수정' 이 가리키는
 * `/mypage/addresses/[id]/edit` 는 proxy 의 앱 전용 경로라, 웹에서 누르면
 * 편집 폼이 아니라 앱 설치 안내로 튕겼다 — 목록은 보이는데 손댈 수는 없고,
 * 버튼은 손댈 수 있는 것처럼 보였다.
 * 기본값을 true 로 둬 **앱 동작은 그대로**다.
 */
export default function AddressesClient({
  initial,
  isApp = true,
}: {
  initial: Address[]
  isApp?: boolean
}) {
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

  if (isApp) {
    return (
      <AppList
        list={list}
        busyId={busyId}
        pending={pending}
        deleting={deleting}
        onSetDefault={handleSetDefault}
        onAskDelete={setDeleting}
        onCancelDelete={() => {
          if (busyId === deleting?.id) return
          setDeleting(null)
        }}
        onConfirmDelete={() => deleting && void performDelete(deleting.id)}
      />
    )
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
                저장됨
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
                    fontSize: V3FontSize.base,
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
                    fontSize: V3FontSize.sm,
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
                  fontSize: V3FontSize.sm,
                  fontWeight: V3FontWeight.bold,
                  color: V3.inkMute,
                  background: 'transparent',
                  // border(shorthand)가 borderRight 뒤에 오면 우측 구분선을 리셋함
                  // → border:none 먼저, borderRight 나중에 적용해 구분선 보존(2026-06-20 수정).
                  border: 'none',
                  borderRight: `1px solid ${V3.rule}`,
                }}
              >
                기본으로
              </button>
            )}
            <Link
              href={
                isApp
                  ? `/mypage/addresses/${a.id}/edit`
                  : '/app-required?from=%2Fmypage%2Faddresses'
              }
              className="flex-1 inline-flex items-center justify-center transition"
              style={{
                gap: 4,
                padding: '10px 0',
                fontSize: V3FontSize.sm,
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
                fontSize: V3FontSize.sm,
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
              fontSize: V3FontSize.sm,
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
              fontSize: V3FontSize.sm,
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

/** 앱 모양 배송지 목록(시안 M01) — 상태·동작은 위 AddressesClient 가 들고 넘긴다. */
function AppList({
  list,
  busyId,
  pending,
  deleting,
  onSetDefault,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  list: Address[]
  busyId: string | null
  pending: boolean
  deleting: Address | null
  onSetDefault: (id: string) => void
  onAskDelete: (a: Address) => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  const action = {
    height: 52,
    boxSizing: 'border-box' as const,
    border: 0,
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: 16,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    textDecoration: 'none',
    cursor: 'pointer',
  }
  const divider = `1px solid ${V3.rule}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((a) => {
        const busy = busyId === a.id || pending
        return (
          <article
            key={a.id}
            style={
              a.isDefault
                ? {
                    borderRadius: V3Radius.sm,
                    display: 'flex',
                    flexDirection: 'column',
                    background: V3.soft,
                    borderLeft: `6px solid ${V3.mustard}`,
                  }
                : { border: divider, borderRadius: V3Radius.sm, display: 'flex', flexDirection: 'column' }
            }
          >
            <div style={{ padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(a.isDefault || a.label) && (
                <span style={{ display: 'flex', gap: 6 }}>
                  {a.isDefault && <Chip tone="ink">기본 배송지</Chip>}
                  {a.label && <Chip tone={a.isDefault ? 'white' : 'soft'}>{a.label}</Chip>}
                </span>
              )}
              <span style={{ marginTop: 4, fontSize: 18, fontWeight: 800 }}>{a.recipientName}</span>
              <span style={{ fontSize: 15, color: V3.inkMute }}>{a.phone}</span>
              <span style={{ fontSize: 16, lineHeight: 1.55 }}>
                [{a.zip}] {a.address}
                {a.addressDetail && (
                  <>
                    <br />
                    {a.addressDetail}
                  </>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${a.isDefault ? 2 : 3}, minmax(0, 1fr))`,
                borderTop: divider,
              }}
            >
              {!a.isDefault && (
                <button
                  type="button"
                  onClick={() => onSetDefault(a.id)}
                  disabled={busy}
                  style={{ ...action, borderRight: divider, color: V3.ink, opacity: busy ? 0.5 : 1 }}
                >
                  기본으로
                </button>
              )}
              <Link href={`/mypage/addresses/${a.id}/edit`} style={{ ...action, borderRight: divider, color: V3.ink }}>
                <PencilIcon size={17} />
                수정
              </Link>
              <button
                type="button"
                onClick={() => onAskDelete(a)}
                disabled={busy}
                style={{ ...action, color: V3.sale, opacity: busy ? 0.5 : 1 }}
              >
                <TrashIcon size={17} />
                삭제
              </button>
            </div>
          </article>
        )
      })}

      {/* R10-3b: 배송지 삭제 확인 — confirm() 대체. 공용 확인 창(D03)과 같은 모양. */}
      <ConfirmSheet
        open={deleting !== null}
        title="배송지를 삭제할까요?"
        body={
          deleting ? (
            <>
              <strong style={{ fontWeight: 800, color: V3.ink }}>{deleting.label || deleting.address}</strong> 삭제 후에는
              되돌릴 수 없어요.
            </>
          ) : undefined
        }
        confirmLabel="삭제"
        tone="destructive"
        busy={busyId !== null && busyId === deleting?.id}
        busyLabel="삭제 중…"
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </div>
  )
}
