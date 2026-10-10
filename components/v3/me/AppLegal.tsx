/**
 * AppLegal — 법정 문서(이용약관 등)의 **앱** 모양 (2026-10-09 앱 새 디자인 'A 포스터', 시안 M22).
 *
 * 웹은 components/LegalDocument(FD 톤)를 그대로 쓴다 — 법정 문서 주소(/legal/*)는 웹·앱이 같이 쓰므로, 페이지가
 * isAppContextServer 로 이 조각과 웹 조각 중 하나를 고른다(AGENTS.md R14). **법문(children·summary)은 일절 바꾸지
 * 않는다** — 같은 글을 앱 모양 틀에 담을 뿐이다(LegalDocument 와 같은 원칙).
 *
 *  · 시행일 = 회색 네모 표 + "2026년 10월 2일" · 요약 = 회색 면 + 왼쪽 6px 머스타드 띠 · 전문 = 위 2px 먹선 아래 조항들.
 *  · 조항 = "제1조"(14 회색 굵게) + 제목(18 굵게) · 본문 16 · 줄 간격 1.75 · 조항 사이 1px 선(마지막은 없음).
 * 시안의 아래쪽 흐림(긴 문서를 자른 표시)은 보드를 자른 그림이라 따라 그리지 않는다 — 실제 화면은 전문을 다 보여준다.
 */

import type { CSSProperties, ReactNode } from 'react'
import { V3, V3Radius } from '@/lib/design/tokens'
import LegalDocument from '@/components/LegalDocument'
import { MeCss, PlainTitle, SCREEN_ROOT } from './MeParts'

/** 앱 법정 문서 안 링크 — 굵은 먹색 밑줄(시안 M22). */
export const APP_LEGAL_LINK: CSSProperties = { fontWeight: 800, color: V3.ink, textDecoration: 'underline' }

/** '2026-10-02' → '2026년 10월 2일'. 모양이 다르면 그대로. */
function koreanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : iso
}

export function AppLegalDocument({
  effectiveDate,
  summary,
  children,
}: {
  /** ISO date, e.g. "2026-10-02" */
  effectiveDate: string
  summary?: ReactNode
  children: ReactNode
}) {
  return (
    <main style={SCREEN_ROOT}>
      <MeCss />
      <div style={{ margin: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            height: 28,
            padding: '0 9px',
            borderRadius: V3Radius.sm,
            background: V3.soft,
            fontSize: 14,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          시행일
        </span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{koreanDate(effectiveDate)}</span>
      </div>

      {summary && (
        <section
          aria-labelledby="legal-sum"
          style={{
            margin: '18px 20px 0',
            padding: '16px 18px',
            borderRadius: V3Radius.sm,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: V3.soft,
            borderLeft: `6px solid ${V3.mustard}`,
          }}
        >
          <PlainTitle id="legal-sum">요약</PlainTitle>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: V3.inkSoft }}>{summary}</p>
        </section>
      )}

      <section aria-labelledby="legal-doc" style={{ padding: '30px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="legal-doc" style={{ margin: 0, fontSize: 22, lineHeight: 'normal' }}>
          전문
        </h2>
        <article
          style={{
            marginTop: 12,
            paddingTop: 6,
            borderTop: `2px solid ${V3.ink}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </article>
      </section>
    </main>
  )
}

/** 조항 — 제N조 (제목). */
export function AppArticle({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <section className="ft-legal-art" style={{ padding: '16px 0', borderBottom: `1px solid ${V3.rule}` }}>
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: V3.inkMute, flexShrink: 0 }}>제{number}조</span>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{title}</span>
      </h3>
      <div
        style={{
          marginTop: 8,
          fontSize: 16,
          lineHeight: 1.75,
          color: V3.inkSoft,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {children}
      </div>
    </section>
  )
}

/** 번호 목록. */
export function AppOL({ children }: { children: ReactNode }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {children}
    </ol>
  )
}

/** 점 목록. */
export function AppUL({ children }: { children: ReactNode }) {
  return (
    <ul style={{ margin: '4px 0 0', paddingLeft: 22, listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {children}
    </ul>
  )
}

/**
 * 번호 없는 장 — 개인정보처리방침·환불 정책(웹 LegalDocument 의 Section 짝, 2026-10-09). 모양은 AppArticle 과 같고
 * 제N조 표시만 없다.
 */
export function AppSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ft-legal-art" style={{ padding: '16px 0', borderBottom: `1px solid ${V3.rule}` }}>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
      <div
        style={{
          marginTop: 8,
          fontSize: 16,
          lineHeight: 1.75,
          color: V3.inkSoft,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * 법정 문서 바깥 틀 고르기 — 앱이면 AppLegalDocument, 웹이면 예전 그대로(가운데 880 폭 + LegalDocument).
 * 개인정보처리방침·환불 정책이 이걸로 고른다(2026-10-09). 웹 갈래는 예전 마크업과 같다 — 한 픽셀도 안 바뀐다.
 */
export function LegalFrame({
  isApp,
  eyebrow,
  title,
  effectiveDate,
  summary,
  children,
}: {
  isApp: boolean
  eyebrow: string
  title: string
  effectiveDate: string
  summary?: ReactNode
  children: ReactNode
}) {
  if (isApp) {
    return (
      <AppLegalDocument effectiveDate={effectiveDate} summary={summary}>
        {children}
      </AppLegalDocument>
    )
  }
  // 웹 — 2026-10-10 웹 리뉴얼: 바깥 칸(가운데 480)은 웹 가게 틀(SiteShell → StoreShell)이 준다.
  return (
    <LegalDocument eyebrow={eyebrow} title={title} effectiveDate={effectiveDate} summary={summary}>
      {children}
    </LegalDocument>
  )
}
