/**
 * MeParts — '내 정보' 화면 묶음의 공용 조각 (2026-10-09 앱 새 디자인 'A 포스터').
 *
 * 내 정보(T09)·프로필(M01)·배송지(M02·M03)·멤버십(M05·I12)·알림(M11~M14·I08·I13)·내 데이터(M15)·회원 탈퇴(M16·M17)·
 * 고객센터(M18)·1:1 문의(C01·C02)·FAQ(M19)·사업자 정보(M20)·약관(M21·M22)이 같은 규칙으로 그린다 — 화면마다 따로
 * 그리면 하나만 고쳐지고 나머지가 옛 모양으로 남는다. 치수는 시안 원본 HTML 값 그대로.
 *
 *  · 입력 칸 = 높이 56 · 1.5px 회색(#8A8A8A) 테두리 · 18px. 누르고 있으면 먹선(시안엔 값이 있어도 같은 회색).
 *  · 주 버튼 = 먹색 바탕 흰 글자 · 보조 버튼 = 흰 바탕 1.5px 먹선 · 모서리 4.
 *  · 켜고 끄기 = 64×36 둥근 스위치(켜짐 먹색 · 꺼짐 #BDBDBD).
 *  · 목록 = 위 2px 먹선 + 줄마다 1px 회색 선. 도장 그림자(2px 먹선 + 4px 4px 0)는 화면당 한 곳.
 *
 * 훅이 없어 서버·클라이언트 어디서든 그려진다(onClick 을 받는 조각은 클라이언트 화면에서만 쓴다).
 * 자리표시 글자색·누를 때 테두리는 인라인으로 못 주는 가상 요소라 전용 클래스(ft-me-input)로 준다 —
 * React 19 의 <style href precedence> 라 몇 번 그려도 한 번만 들어간다(globals.css 는 건드리지 않는다).
 */

import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import { V3, V3Radius, V3Shadow } from '@/lib/design/tokens'

/** 입력 칸 테두리(시안 — 비었을 때도, 값이 있어도 같은 회색). */
export const FIELD_LINE = '#8A8A8A'
/** 자리표시 글자색(시안의 우편번호·주소 자리 #767676). */
export const PLACEHOLDER_INK = '#767676'
/** 꺼진 스위치 바탕. */
export const TOGGLE_OFF = '#BDBDBD'
/** 내 정보 메뉴 줄 사이 선(시안 T09). */
export const MENU_LINE = '#EFEDEE'
/** 가운데 창·아래 창 뒤 바탕 막. */
export const SCRIM = 'rgba(20, 20, 20, 0.42)'

const ME_CSS = `
[data-ft-chrome="app"] .ft-me-input::placeholder { color: ${PLACEHOLDER_INK}; opacity: 1; }
[data-ft-chrome="app"] .ft-me-input:focus { border-color: ${V3.ink} !important; outline: none; }
[data-ft-chrome="app"] .ft-me-cs::placeholder { color: #9A9A9A; opacity: 1; }
[data-ft-chrome="app"] .ft-legal-art:last-child { border-bottom: 0 !important; }
[data-ft-chrome="app"] .ft-me-faq { border-bottom: 1px solid ${V3.rule}; }
[data-ft-chrome="app"] .ft-me-faq[open] { background: ${V3.soft}; margin: 0 -20px; padding: 0 20px; }
[data-ft-chrome="app"] .ft-me-faq > summary {
  min-height: 60px; padding: 12px 0; box-sizing: border-box; list-style: none;
  display: grid; grid-template-columns: 1fr 24px; column-gap: 12px; align-items: center;
  font-size: 17px; font-weight: 700; line-height: 1.4; cursor: pointer;
}
[data-ft-chrome="app"] .ft-me-faq[open] > summary { min-height: 64px; padding: 14px 0; font-weight: 800; }
[data-ft-chrome="app"] .ft-me-faq > summary::-webkit-details-marker { display: none; }
[data-ft-chrome="app"] .ft-me-faq > summary .ft-me-faq-open { display: none; }
[data-ft-chrome="app"] .ft-me-faq[open] > summary .ft-me-faq-open { display: block; }
[data-ft-chrome="app"] .ft-me-faq[open] > summary .ft-me-faq-closed { display: none; }
`

/** 자리표시 글자색 · 누를 때 먹선 · FAQ 펼침 모양 — 이 묶음 화면 맨 위에 한 번. */
export function MeCss() {
  return (
    <style href="ft-me" precedence="medium">
      {ME_CSS}
    </style>
  )
}

/** 화면 뿌리 — 시안 보드는 줄 간격 기본(normal)·먹색 글자·아래 32 여백. */
export const SCREEN_ROOT: CSSProperties = {
  lineHeight: 'normal',
  color: V3.ink,
  paddingBottom: 32,
  wordBreak: 'keep-all',
}

/** 도장 그림자 카드 — 그 화면 핵심 카드 한 곳에만. */
export const STAMP_CARD: CSSProperties = {
  border: `2px solid ${V3.ink}`,
  boxShadow: V3Shadow.stamp,
  borderRadius: V3Radius.sm,
}

/** 입력 칸(시안 M01·M02 · 높이 56 · 18px). */
export const INPUT_STYLE: CSSProperties = {
  width: '100%',
  height: 56,
  boxSizing: 'border-box',
  padding: '0 14px',
  borderRadius: V3Radius.sm,
  border: `1.5px solid ${FIELD_LINE}`,
  background: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: 18,
  color: V3.ink,
  outline: 'none',
  // 입력 칸은 브라우저 기본 자간(normal) — 시안 원본의 <input> 이 그렇다(본문 -0.02em 을 물려받지 않는다).
  letterSpacing: 'normal',
}

/** 주 버튼 — 먹색 바탕 흰 글자. */
export function primaryButton(height = 56, fontSize = 17): CSSProperties {
  return {
    width: '100%',
    height,
    boxSizing: 'border-box',
    border: 0,
    borderRadius: V3Radius.sm,
    background: V3.ink,
    color: '#FFFFFF',
    fontFamily: 'inherit',
    fontSize,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    textDecoration: 'none',
  }
}

/** 보조 버튼 — 흰 바탕 1.5px 먹선. */
export function outlineButton(height = 52, fontSize = 16): CSSProperties {
  return {
    height,
    boxSizing: 'border-box',
    border: `1.5px solid ${V3.ink}`,
    borderRadius: V3Radius.sm,
    background: '#FFFFFF',
    color: V3.ink,
    fontFamily: 'inherit',
    fontSize,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    textDecoration: 'none',
  }
}

/** 제목 글꼴 섹션 제목(시안 class="d" 22·24). 앱 틀의 h2 는 전역 규칙이 제목 글꼴로 만든다. */
export function SectionTitle({
  children,
  size = 22,
  id,
  style,
}: {
  children: ReactNode
  size?: number
  id?: string
  style?: CSSProperties
}) {
  return (
    <h2 id={id} style={{ margin: 0, fontSize: size, lineHeight: 'normal', ...style }}>
      {children}
    </h2>
  )
}

/** 본문 글꼴 굵은 제목(시안의 17px 800 h2) — 앱 틀 h2 기본(제목 글꼴)을 되돌린다. */
export function PlainTitle({
  children,
  size = 17,
  id,
  style,
}: {
  children: ReactNode
  size?: number
  id?: string
  style?: CSSProperties
}) {
  return (
    <h2
      id={id}
      style={{
        margin: 0,
        fontFamily: 'inherit',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.02em',
        lineHeight: 'normal',
        ...style,
      }}
    >
      {children}
    </h2>
  )
}

/** 위 2px 먹선 목록 틀. */
export function RuleList({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column', ...style }}>
      {children}
    </div>
  )
}

/** 회색 면 상자(모서리 4). */
export function SoftBox({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ borderRadius: V3Radius.sm, background: V3.soft, ...style }}>
      {children}
    </div>
  )
}

/** 작은 네모 표 — "기본 배송지"·"지금 등급"·"건강". */
export function Chip({
  children,
  tone = 'ink',
  height = 26,
  fontSize = 13,
  style,
}: {
  children: ReactNode
  tone?: 'ink' | 'white' | 'soft' | 'glass'
  height?: number
  fontSize?: number
  style?: CSSProperties
}) {
  const tones: Record<string, CSSProperties> = {
    ink: { background: V3.ink, color: '#FFFFFF' },
    white: { background: '#FFFFFF', color: V3.ink },
    soft: { background: V3.soft, color: V3.ink },
    glass: { background: 'rgba(255,255,255,0.5)', color: V3.ink },
  }
  return (
    <span
      style={{
        height,
        boxSizing: 'border-box',
        padding: height <= 24 ? '0 7px' : '0 8px',
        borderRadius: V3Radius.sm,
        fontSize,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/** 등급 색 네모(시안 16×16 · 등록증 10×10). */
export function TierSquare({ color, size = 16 }: { color: string; size?: number }) {
  return <span aria-hidden style={{ width: size, height: size, background: color, flexShrink: 0, display: 'inline-block' }} />
}

/** 켜고 끄기 스위치(시안 M12·M13 · 64×36). 이름은 aria-label 로 받는다. */
export function Toggle({
  on,
  onClick,
  disabled,
  label,
}: {
  on: boolean
  onClick: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 64,
        height: 36,
        boxSizing: 'border-box',
        padding: 3,
        border: 0,
        borderRadius: 18,
        background: on ? V3.ink : TOGGLE_OFF,
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

/** 동그란 아이콘 받침(44 · 회색 면 또는 먹색). */
export function IconDisc({
  children,
  size = 44,
  dark,
}: {
  children: ReactNode
  size?: number
  dark?: boolean
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: dark ? V3.ink : V3.soft,
        color: dark ? '#FFFFFF' : V3.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

/**
 * 도장판 10칸(5×2) — 내 정보(T09)·멤버십(M05).
 * 찍힌 칸 = 흰 원 안 도장 그림(118% · 각도·농도는 칸 번호로 고정 — 렌더마다 흔들리면 산만하고 서버/클라 렌더가
 * 어긋난다 · StampCard 와 같은 식). 빈 칸 = 1.5px 점선 원. 칸 하나하나는 읽지 않는다(요약은 부모 aria-label).
 */
export function StampGrid({
  filled,
  emptyBorder,
  size = 10,
  label,
}: {
  filled: number
  /** 빈 칸 점선 색 — 내 정보 #D9C4A3 · 멤버십 #BDBDBD(시안). */
  emptyBorder: string
  size?: number
  label: string
}) {
  return (
    <span
      role="img"
      aria-label={label}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}
    >
      {Array.from({ length: size }, (_, i) =>
        i < filled ? (
          <span
            key={i}
            aria-hidden
            style={{
              aspectRatio: '1',
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#FFFFFF',
            }}
          >
            <Image
              src="/logo-stamp.png"
              alt=""
              width={72}
              height={72}
              loading="eager"
              style={{
                width: '118%',
                height: '118%',
                maxWidth: 'none',
                objectFit: 'contain',
                transform: `rotate(${((i * 37) % 13) - 6}deg)`,
                opacity: 0.88 + ((i * 7) % 3) * 0.04,
                display: 'block',
                flexShrink: 0,
              }}
            />
          </span>
        ) : (
          <span
            key={i}
            aria-hidden
            style={{
              aspectRatio: '1',
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: `1.5px dashed ${emptyBorder}`,
              background: '#FFFFFF',
            }}
          />
        ),
      )}
    </span>
  )
}
