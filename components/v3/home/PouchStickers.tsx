/**
 * PouchStickers — 박스에 든 레시피 팩 사진을 '스티커'처럼 (홈 박스 카드, 2026-10-24 시안).
 *
 * 홈 박스 카드가 글자만 있는 색 상자라 무엇이 오는지 그림이 없었다(사장님 "홈화면 디자인도 업그레이드가 더 필요").
 * 팩은 레시피 팩 **스튜디오 사진만**(규칙289 — pouch-* , 겉봉투·AI 그릇 금지). 흰 바탕 + 먹선 2px + 살짝 기울임 =
 * 디자인 기획서의 '스티커'(오틀리 먹선 카드). 두 가지면 겹쳐 놓는다. 움직이지 않는다(카드·글자는 고정).
 */
import { studioPouchImage } from '@/lib/personalization/packageImage'
import { V3 } from '@/lib/design/tokens'
import type { PouchLine } from '@/lib/design/pouch'

/** 파우치 색 키 → 단백질 키(스튜디오 사진 정본 studioPouchImage 가 단백질로 찾는다). */
const PROTEIN: Record<PouchLine, string> = { chicken: 'chicken', duck: 'duck', pork: 'pork', beef: 'beef' }

export default function PouchStickers({ lines, size = 64 }: { lines: readonly PouchLine[]; size?: number }) {
  const srcs = lines
    .slice(0, 2)
    .map((l) => studioPouchImage(PROTEIN[l]))
    .filter((s): s is string => !!s)
  if (srcs.length === 0) return null
  return (
    <span aria-hidden style={{ position: 'relative', flexShrink: 0, width: size + (srcs.length > 1 ? size * 0.55 : 0), height: size + 6 }}>
      {srcs.map((src, i) => (
        <span
          key={src}
          style={{
            position: 'absolute',
            top: i === 0 ? 0 : 6,
            left: i === 0 ? 0 : size * 0.55,
            width: size,
            height: size,
            background: '#FFFFFF',
            border: `2px solid ${V3.ink}`,
            borderRadius: 4,
            boxShadow: `2px 2px 0 ${V3.ink}`,
            transform: `rotate(${i === 0 ? -6 : 5}deg)`,
            overflow: 'hidden',
            zIndex: i === 0 ? 2 : 1,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 작은 스티커 한 장, lazy 금지(앱 사진 규칙) */}
          <img src={src} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.18)' }} />
        </span>
      ))}
    </span>
  )
}
