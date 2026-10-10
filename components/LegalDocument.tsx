import type { ReactNode } from 'react'

/**
 * 법정 문서(이용약관·개인정보처리방침·환불 정책) **웹** 틀. 앱은 components/v3/me/AppLegal.
 *
 * ★2026-10-10 웹 리뉴얼('A 포스터' 웹, 웹 시안 WEB-C21~23): 흰 바탕 · 제목 Black Han Sans · 본문 16px 줄간 1.75 ·
 *  영어 머리말(Terms of Service·Summary·Document) 없음 — 장 제목·번호만. 바깥 틀은 웹 가게 틀(StoreShell, 가운데 480).
 *  **법문 글자(props/children)는 한 자도 바꾸지 않는다** — 모양만 바꾼다(예전 FD 톤 원칙 그대로).
 *  eyebrow 는 예전 호출부 호환으로 받기만 하고 그리지 않는다.
 */
export default function LegalDocument({
  title,
  effectiveDate,
  summary,
  children,
}: {
  /** 예전 영어 머리말 — 그리지 않는다(호출부 호환). */
  eyebrow?: string
  title: string
  /** ISO date, e.g. "2026-04-22" */
  effectiveDate: string
  /** Optional 1-paragraph TL;DR for human readability */
  summary?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="fts-legal" style={{ padding: '28px 20px 64px', display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: '#595959' }}>약관 · 정책</span>
      <h1 className="d" style={{ margin: '6px 0 0', fontSize: 36, lineHeight: 1.1 }}>
        {title}
      </h1>
      <span style={{ marginTop: 10, fontSize: 15, color: '#3D3D3D' }}>
        시행일 <strong style={{ color: '#141414' }}>{koreanDate(effectiveDate)}</strong>
      </span>

      {summary && (
        <section aria-label="요약" style={{ marginTop: 22, padding: '16px 18px', background: '#F6F4F5', borderRadius: 4 }}>
          <strong style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>요약</strong>
          <div style={{ marginTop: 8, fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>{summary}</div>
        </section>
      )}

      <span style={{ marginTop: 28, paddingBottom: 10, borderBottom: '2px solid #141414', fontSize: 14, fontWeight: 800, color: '#595959' }}>전문</span>
      <article style={{ paddingTop: 4, fontSize: 16, lineHeight: 1.75, color: '#3D3D3D' }}>{children}</article>
    </div>
  )
}

/** '2026-10-02' → '2026년 10월 2일'. 형식이 아니면 그대로. */
function koreanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : iso
}

/** 번호 붙은 조 — 제1조 (목적) */
export function Article({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <section style={{ paddingTop: 22 }}>
      <h2 className="d" style={{ margin: 0, fontSize: 20, color: '#141414' }}>
        제{number}조 {title}
      </h2>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  )
}

/** 번호 없는 장 — 개인정보처리방침·환불 정책 */
export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section style={{ paddingTop: 22 }}>
      <h2 className="d" style={{ margin: 0, fontSize: 20, color: '#141414' }}>
        {title}
      </h2>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  )
}

/** 번호 목록 */
export function OL({ children }: { children: ReactNode }) {
  return <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'decimal' }}>{children}</ol>
}

/** 점 목록 */
export function UL({ children }: { children: ReactNode }) {
  return <ul style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'disc' }}>{children}</ul>
}
