/**
 * Avatar — v3 원형 프로필 표시.
 *
 * **앱 컨텍스트 전용.** 강아지 / 사용자 / 가족 멤버 표현.
 *  - image 가 있으면 우선 표시 (next/image)
 *  - 없으면 initial (이름 첫 글자) 텍스트
 *  - tone 으로 배경색 결정 — 강아지마다 다른 색 round-robin
 *  - 우하단 status dot 옵션 (online / offline / new)
 *
 * # API
 *
 *   <Avatar src="/dog.jpg" name="초롱" size={48} />
 *   <Avatar name="가족" tone="sage" size={32} status="online" />
 */

import Image from 'next/image'
import { V3, V3FontWeight } from '@/lib/design/tokens'

type AvatarTone = 'accent' | 'sage' | 'yellow' | 'blue' | 'ink' | 'auto'
type AvatarStatus = 'online' | 'offline' | 'new'

interface AvatarProps {
  /** image url. 없으면 initial 표시. */
  src?: string | null
  /** 이름 — initial 추출용. 또는 직접 initial 문자. */
  name?: string | null
  /** px 사이즈. 기본 40. */
  size?: number
  /** initial 배경 톤. 'auto' = name 해시로 자동. */
  tone?: AvatarTone
  /** 우하단 status dot. */
  status?: AvatarStatus
  className?: string
}

const TONE_BG: Record<Exclude<AvatarTone, 'auto'>, string> = {
  accent: V3.accent,
  sage: V3.sage,
  yellow: V3.yellow,
  blue: V3.blue,
  ink: V3.ink,
}

const AUTO_TONES: Exclude<AvatarTone, 'auto'>[] = [
  'accent',
  'sage',
  'yellow',
  'blue',
  'ink',
]

const STATUS_COLOR: Record<AvatarStatus, string> = {
  online: V3.sage,
  offline: V3.inkFaint,
  new: V3.accent,
}

function pickAutoTone(name?: string | null): Exclude<AvatarTone, 'auto'> {
  if (!name) return 'ink'
  // FNV-1a 32bit hash — 빠르고 분포 균일.
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  const tone = AUTO_TONES[Math.abs(hash) % AUTO_TONES.length]
  return tone ?? 'ink'
}

function getInitial(name?: string | null): string {
  if (!name) return '?'
  // 한국어 이름은 첫 글자, 영어 이름은 첫 글자 대문자.
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // 한글 unicode range 우선
  const first = trimmed[0]
  if (!first) return '?'
  return /[A-Za-z]/.test(first) ? first.toUpperCase() : first
}

export default function Avatar({
  src,
  name,
  size = 40,
  tone = 'auto',
  status,
  className,
}: AvatarProps) {
  const resolvedTone = tone === 'auto' ? pickAutoTone(name) : tone
  const bg = TONE_BG[resolvedTone]
  const initial = getInitial(name)
  const dotSize = Math.max(8, Math.round(size * 0.22))

  return (
    <div
      className={`relative inline-flex shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name ?? ''}
          width={size}
          height={size}
          className="object-cover"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `1px solid ${V3.rule}`,
            background: V3.paperDeep,
          }}
        />
      ) : (
        <span
          aria-label={name ?? undefined}
          className="inline-flex items-center justify-center"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: bg,
            color: '#fff',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: Math.round(size * 0.42),
            letterSpacing: '-0.01em',
            userSelect: 'none',
          }}
        >
          {initial}
        </span>
      )}
      {status && (
        <span
          aria-hidden
          className="absolute"
          style={{
            right: 0,
            bottom: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: STATUS_COLOR[status],
            border: `2px solid ${V3.paperHi}`,
          }}
        />
      )}
    </div>
  )
}
