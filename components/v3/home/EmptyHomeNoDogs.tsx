/**
 * EmptyHomeNoDogs — 강아지 0마리 상태의 홈 (첫 아이 등록 안내).
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 T05): 머스타드 카드 + 먹색 도장 그림자(이 화면의 핵심 카드),
 *   발바닥 동그라미 · 제목 "첫 아이를 / 등록해 주세요"(제목 글꼴) · 한 줄 · 먹색 큰 버튼.
 */

import Link from 'next/link'
import { V3, V3Shadow } from '@/lib/design/tokens'
import DogPawMark from '@/components/DogPawMark'

interface EmptyHomeNoDogsProps {
  /** "아이 추가" 링크. */
  addDogHref?: string
  /** 버튼 라벨. */
  ctaLabel?: string
  /** 부연 — 기본 안내 문구. */
  description?: string
}

export default function EmptyHomeNoDogs({
  addDogHref = '/dogs/new',
  ctaLabel = '아이 등록하기',
  description = '맞춤 영양 분석과 정기배송 추천이 시작돼요.',
}: EmptyHomeNoDogsProps) {
  return (
    <section
      aria-labelledby="empty-title"
      style={{
        margin: '26px 20px 0',
        padding: '26px 20px 22px',
        border: `2px solid ${V3.ink}`,
        boxShadow: V3Shadow.stamp,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        background: V3.mustard,
        color: V3.ink,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          background: 'rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DogPawMark size={28} color={V3.ink} />
      </span>
      <h2 id="empty-title" style={{ margin: '6px 0 0', fontSize: 28, lineHeight: 1.2 }}>
        첫 아이를
        <br />
        등록해 주세요
      </h2>
      <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: V3.ink, wordBreak: 'keep-all' }}>{description}</p>
      <Link
        href={addDogHref}
        className="transition active:scale-[0.98]"
        style={{
          marginTop: 10,
          alignSelf: 'stretch',
          height: 58,
          borderRadius: 4,
          background: V3.ink,
          color: '#FFFFFF',
          textDecoration: 'none',
          fontSize: 17,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {ctaLabel}
      </Link>
    </section>
  )
}
