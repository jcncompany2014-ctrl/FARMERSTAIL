import type { ReactNode } from 'react'

/**
 * Shared styling wrapper for long-form legal documents
 * (이용약관, 개인정보처리방침, 환불정책).
 *
 * 톤: farm v6 = The Farmer's Dog 클론 (2026-06-13, 회차8). FD 토큰으로:
 * 파인 그린 헤딩(Pretendard 헤비) + 오트밀 크림 카드 + 코랄 악센트 + 그린 eyebrow.
 * 일관된 reading rhythm: 12~14px 본문, 타이트 간격, 번호 섹션. 법령이 요구하는
 * "시행일" 메타바도 렌더. **법문 텍스트(props/children)는 일절 수정하지 않음** —
 * 프레젠테이션만 FD 톤.
 */
export default function LegalDocument({
  eyebrow,
  title,
  effectiveDate,
  summary,
  children,
}: {
  eyebrow: string
  title: string
  /** ISO date, e.g. "2026-04-22" */
  effectiveDate: string
  /** Optional 1-paragraph TL;DR for human readability */
  summary?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <section className="px-5 md:px-6 pt-8 md:pt-16 pb-2 md:pb-6 text-center">
        <span
          className="kicker"
          style={{ color: 'var(--fd-green)', letterSpacing: '0.14em' }}
        >
          {eyebrow}
        </span>
        <h1
          className="mt-3 md:mt-5 leading-[1.08] text-[28px] md:text-[46px] lg:text-[54px]"
          style={{
            fontWeight: 900,
            color: 'var(--fd-pine)',
            letterSpacing: '-0.035em',
          }}
        >
          {title}
        </h1>
        <div
          className="mt-2 md:mt-4 text-[11px] md:text-[12.5px] font-mono"
          style={{
            color: 'var(--fd-muted)',
            letterSpacing: '0.08em',
          }}
        >
          시행일 · {effectiveDate}
        </div>
      </section>

      {summary && (
        <section className="px-5 md:px-6 mt-5 md:mt-8">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <span className="kicker" style={{ color: 'var(--fd-green)', letterSpacing: '0.14em' }}>
              Summary · 요약
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--fd-line)' }} />
          </div>
          <div
            className="rounded-lg px-5 py-4 md:px-7 md:py-6"
            style={{
              background: 'color-mix(in srgb, var(--fd-green) 8%, transparent)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--fd-green) 28%, transparent)',
            }}
          >
            <div
              className="text-[12px] md:text-[14px] leading-relaxed"
              style={{ color: 'var(--fd-pine)' }}
            >
              {summary}
            </div>
          </div>
        </section>
      )}

      <section className="px-5 md:px-6 mt-5 md:mt-8 pb-10 md:pb-16">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <span className="kicker" style={{ color: 'var(--fd-muted)', letterSpacing: '0.14em' }}>
            Document · 전문
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--fd-line)' }} />
        </div>
        <article
          className="rounded-lg px-5 py-5 md:px-8 md:py-8 text-[12px] md:text-[14px] leading-[1.78]"
          style={{
            background: 'var(--fd-cream)',
            boxShadow: 'inset 0 0 0 1px var(--fd-line)',
            color: 'var(--text)',
          }}
        >
          {children}
        </article>
      </section>
    </>
  )
}

/** Numbered article header — e.g. 제1조 (목적) */
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
    <section className="mt-6 md:mt-8 first:mt-0">
      <h2
        className="text-[15px] md:text-[19px]"
        style={{
          color: 'var(--fd-pine)',
          fontWeight: 900,
          letterSpacing: '-0.02em',
        }}
      >
        <span
          className="font-mono mr-1.5 md:mr-2 text-[11px] md:text-[13px]"
          style={{
            color: 'var(--fd-coral)',
            letterSpacing: '0.12em',
            fontWeight: 700,
          }}
        >
          제{number}조
        </span>
        ({title})
      </h2>
      <div
        className="mt-2 md:mt-3 text-[12px] md:text-[14px] leading-[1.78] space-y-1.5 md:space-y-2"
        style={{ color: 'var(--text)' }}
      >
        {children}
      </div>
    </section>
  )
}

/** Standalone heading for privacy policy (not numbered by 조) */
export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mt-6 md:mt-8 first:mt-0">
      <h2
        className="text-[15px] md:text-[19px]"
        style={{
          color: 'var(--fd-pine)',
          fontWeight: 900,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      <div
        className="mt-2 md:mt-3 text-[12px] md:text-[14px] leading-[1.78] space-y-1.5 md:space-y-2"
        style={{ color: 'var(--text)' }}
      >
        {children}
      </div>
    </section>
  )
}

/** Compact ordered list used inside articles */
export function OL({ children }: { children: ReactNode }) {
  return (
    <ol
      className="list-decimal pl-5 md:pl-6 space-y-1 md:space-y-1.5 text-[12px] md:text-[14px]"
      style={{ color: 'var(--text)' }}
    >
      {children}
    </ol>
  )
}

/** Compact unordered list */
export function UL({ children }: { children: ReactNode }) {
  return (
    <ul
      className="list-disc pl-5 md:pl-6 space-y-1 md:space-y-1.5 text-[12px] md:text-[14px]"
      style={{ color: 'var(--text)' }}
    >
      {children}
    </ul>
  )
}
