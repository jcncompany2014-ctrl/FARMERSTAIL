/**
 * AI 영양 상담 화면의 머리·주의 상자 — page.tsx 와 점검 화면(/design-check/analysis)이 같이 쓴다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A13): 초록 그라데이션 머리 카드 → 흰 바탕 머리(머스타드 반짝이 머리말 +
 *   제목 글꼴 32). 문구: "NRC / FEDIAF 기반 답변" → "국제 영양 기준을 바탕으로 답해요"(사장님 결정 목록 — 기준 약어 빼기).
 *   주의 상자: "⚠️" 이모지 → 빨간 세모 아이콘, "진단·처방·응급" → "진단·응급"('처방'은 고객 문구 금지어).
 */

import { V3 } from '@/lib/design/tokens'

export function ChatHero() {
  return (
    <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: V3.inkMute }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={V3.mustard} aria-hidden>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
        </svg>
        AI 상담
      </span>
      {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다. */}
      <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15 }}>궁금한 게 있나요?</h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
        식이 · 알레르기 · 영양에 대해 물어보세요.
        <br />
        국제 영양 기준을 바탕으로 답해요.
      </p>
    </section>
  )
}

export function ChatCaution() {
  return (
    <section
      aria-label="주의"
      style={{
        margin: '26px 20px 0',
        padding: 16,
        borderRadius: 4,
        background: V3.soft,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 800 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={V3.sale} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4l9 16H3z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
        주의
      </span>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
        AI 상담은 수의사 진료를 대신하지 않아요. 의학적 진단·응급 상황은 반드시 수의사를 만나주세요. 답변은 일반 영양
        가이드 참고용이에요.
      </p>
    </section>
  )
}
