'use client'

/**
 * SheetParts — 기록 바텀시트들이 같이 쓰는 조각 (2026-10-09 'A 포스터', 시안 T12~T17).
 *
 * 건강·식사(QuickHealthSheet · QuickChipSheet) · 체중(WeightInputSheet) · 일기(QuickMemoSheet) ·
 * 사진(QuickPhotoSheet) · 산책(QuickWalkSheet) 이 모두 같은 틀로 그린다:
 *   그래버(BottomSheet 가 그림) → 머리줄(큰 제목 + 회색 한 줄 · 오른쪽 '닫기' 글자 버튼)
 *   → 내용(묶음 사이 18) → 먹색 꽉 찬 버튼(위 20) → (있으면) 가운데 밑줄 글자 링크.
 * 모서리는 전부 4. 알약(999) 칩은 더 쓰지 않는다. 치수는 시안 원본(T12~T17 HTML) 그대로.
 *
 * 글꼴 — 앱 틀 안에서 h2 는 제목 글꼴(Black Han Sans), .ft-num 은 숫자 글꼴(Anton)이다(globals.css).
 * 그래서 제목·큰 숫자에는 fontFamily·fontWeight 를 인라인으로 주지 않는다(주면 그 글꼴을 덮는다).
 * 본문은 기본 Pretendard 라 글꼴을 따로 정하지 않는다.
 *
 * BottomSheet.Footer 는 쓰지 않는다 — 윗선·반투명 띠가 시안과 다르다. 버튼까지 Body 안에 둔다.
 * 저장·데이터 로직은 각 시트가 그대로 가진다. 여기는 그리는 것만.
 */

import { useId, type ReactNode } from 'react'
import Link from 'next/link'
import { V3, V3Radius } from '@/lib/design/tokens'

/** 선택지 한 칸 — [저장 값, 화면 이름]. */
export type SheetOption = readonly [value: string, label: string]

/** 고르지 않은 선택지 테두리 — 시안의 옅은 회색(그래버와 같은 색). */
const CHOICE_IDLE_BORDER = '#D5D3D4'

/**
 * 시트 내용 감싸기.
 * 위 −6: BottomSheet 의 그래버 아래 여백(4) + 본문 위 여백(16) = 20 을 시안의 14 로 맞춘다.
 * 아래 12: 본문 아래 여백(16)과 합쳐 시안의 28 + 홈 바 구간.
 */
export function SheetContent({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: -6,
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      }}
    >
      {children}
    </div>
  )
}

/** 머리줄 — 왼쪽 큰 제목(줄바꿈 허용) + 회색 한 줄, 오른쪽 '닫기'. */
export function SheetHeader({
  title,
  sub,
  onClose,
  titleId,
}: {
  title: ReactNode
  sub?: ReactNode
  onClose: () => void
  /** 제목 h2 의 id — 선택지 묶음이 제목을 이름으로 삼을 때(aria-labelledby). */
  titleId?: string
}) {
  return (
    <div className="flex" style={{ alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 제목 글꼴은 앱 틀의 h2 규칙이 준다 — fontFamily·fontWeight 를 여기서 주지 않는다. */}
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontSize: 26,
            lineHeight: 1.15,
            color: V3.ink,
            wordBreak: 'keep-all',
          }}
        >
          {title}
        </h2>
        {sub && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 15,
              lineHeight: 1.35,
              color: V3.inkMute,
            }}
          >
            {sub}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="flex items-center"
        style={{
          // 누르는 자리는 44px — 글자는 오른쪽 끝에서 4px 안(시안).
          minWidth: 44,
          height: 44,
          justifyContent: 'flex-end',
          flexShrink: 0,
          padding: '0 4px',
          background: 'none',
          border: 'none',
          color: V3.ink,
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        닫기
      </button>
    </div>
  )
}

/** 묶음 이름 — "식욕" · "산책 시간" 같은 굵은 글자. 아래 8px. */
export function SheetSectionLabel({
  id,
  children,
}: {
  id?: string
  children: ReactNode
}) {
  return (
    <div
      id={id}
      style={{
        fontSize: 16,
        fontWeight: 800,
        lineHeight: 1.25,
        color: V3.ink,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

/**
 * 한 줄 선택지 — 칸을 똑같이 나눈 네모 버튼. 고른 것 = 먹색 바탕 흰 글자.
 * 고른 것을 한 번 더 누르면 고르기를 푼다(onPick(null)).
 * 이름(label)이 없으면 그리지 않고, labelledBy(예: 제목 h2 의 id)가 묶음 이름이 된다.
 */
export function SheetChoiceRow({
  label,
  labelledBy,
  options,
  value,
  onPick,
}: {
  label?: string
  labelledBy?: string
  options: readonly SheetOption[]
  value: string | null
  onPick: (v: string | null) => void
}) {
  // 한 시트에 여러 줄이 있어도 id 가 겹치지 않게.
  const labelId = useId()
  return (
    <div>
      {label && <SheetSectionLabel id={labelId}>{label}</SheetSectionLabel>}
      <div
        role="group"
        aria-labelledby={label ? labelId : labelledBy}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
          gap: 8,
        }}
      >
        {options.map(([v, text]) => {
          const active = value === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(active ? null : v)}
              aria-pressed={active}
              className="transition active:scale-95 ft-no-press"
              style={{
                height: 52,
                padding: '0 4px',
                borderRadius: V3Radius.sm,
                background: active ? V3.ink : '#FFFFFF',
                color: active ? '#FFFFFF' : V3.ink,
                border: `1.5px solid ${active ? V3.ink : CHOICE_IDLE_BORDER}`,
                fontSize: 17,
                fontWeight: active ? 800 : 600,
                cursor: 'pointer',
              }}
            >
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 먹색 꽉 찬 버튼 — 시트마다 하나(저장). 아이콘 없음. */
export function SheetPrimaryButton({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  /** 저장 중 — 커서·aria-busy 만. 막는 것은 disabled 가 한다. */
  busy?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className="flex items-center justify-center transition active:scale-[0.98]"
      style={{
        width: '100%',
        height: 58,
        borderRadius: V3Radius.sm,
        border: 'none',
        background: disabled ? V3.inkMute : V3.ink,
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: 800,
        cursor: busy ? 'wait' : disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/**
 * 버튼 아래 가운데 밑줄 링크 — "자세히 기록 →" 같은 다른 화면으로 가는 길.
 * 누르는 자리는 글자 폭 × 44px(시안: 위 12 · 최소 높이 44 · 글자 세로 가운데).
 */
export function SheetTextLink({
  href,
  onClick,
  children,
}: {
  href: string
  /** 이동하면서 시트를 닫는다. */
  onClick: () => void
  children: ReactNode
}) {
  return (
    <div className="flex justify-center" style={{ marginTop: 12 }}>
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center"
        style={{
          minHeight: 44,
          padding: '0 8px',
          fontSize: 15,
          fontWeight: 700,
          color: V3.inkSoft,
          textDecoration: 'underline',
        }}
      >
        {children}
      </Link>
    </div>
  )
}

/** 저장 실패 문구 — 버튼 바로 위. 없으면 아무것도 그리지 않는다. */
export function SheetError({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null
  return (
    <p
      role="alert"
      style={{ margin: '0 0 10px', fontSize: 14, color: V3.sale, lineHeight: 1.4 }}
    >
      {msg}
    </p>
  )
}
