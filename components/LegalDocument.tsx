import type { ReactNode } from 'react'

/**
 * Shared styling wrapper for long-form legal documents
 * (이용약관, 개인정보처리방침, 환불정책).
 *
 * 톤: /about · /plans · /blog와 같은 editorial 언어.
 * kicker + serif 헤드라인 + paper-tone 카드 + 토큰만.
 * Enforces a consistent reading rhythm: 12px body, tight spacing,
 * numbered sections, brand-matching colors. Also renders the
 * "시행일" metadata bar so users can see when the document was last
 * updated — which 개인정보보호법 explicitly requires for privacy
 * policies.
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
        <span className="kicker">{eyebrow}</span>
        <h1
          className="font-serif mt-3 md:mt-5 leading-tight text-[26px] md:text-[44px] lg:text-[52px]"
          style={{
            fontWeight: 900,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
          }}
        >
          {title}
        </h1>
        <div
          className="mt-2 md:mt-4 text-[11px] md:text-[12.5px] font-mono"
          style={{
            color: 'var(--muted)',
            letterSpacing: '0.08em',
          }}
        >
          시행일 · {effectiveDate}
        </div>
      </section>

      {summary && (
        <section className="px-5 md:px-6 mt-5 md:mt-8">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <span
              className="kicker"
              style={{ color: 'var(--moss)' }}
            >
              Summary · 요약
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: 'var(--rule-2)' }}
            />
          </div>
          <div
            className="rounded-2xl px-5 py-4 md:px-7 md:py-6"
            style={{
              background:
                'color-mix(in srgb, var(--moss) 8%, transparent)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--moss) 30%, transparent)',
            }}
          >
            <div
              className="text-[11.5px] md:text-[14px] leading-relaxed"
              style={{ color: 'var(--text)' }}
            >
              {summary}
            </div>
          </div>
        </section>
      )}

      <section className="px-5 md:px-6 mt-5 md:mt-8 pb-10 md:pb-16">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <span className="kicker kicker-muted">
            Document · 전문
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>
        <article
          className="rounded-2xl px-5 py-5 md:px-8 md:py-8 text-[12px] md:text-[14px] leading-[1.75]"
          style={{
            background: 'var(--bg-2)',
            boxShadow: 'inset 0 0 0 1px var(--rule)',
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
        className="font-serif text-[14px] md:text-[18px] font-black"
        style={{
          color: 'var(--ink)',
          letterSpacing: '-0.015em',
        }}
      >
        <span
          className="font-mono mr-1.5 md:mr-2 text-[11px] md:text-[13px]"
          style={{
            color: 'var(--terracotta)',
            letterSpacing: '0.12em',
            fontWeight: 700,
          }}
        >
          제{number}조
        </span>
        ({title})
      </h2>
      <div
        className="mt-2 md:mt-3 text-[12px] md:text-[14px] leading-[1.75] space-y-1.5 md:space-y-2"
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
        className="font-serif text-[14px] md:text-[18px] font-black"
        style={{
          color: 'var(--ink)',
          letterSpacing: '-0.015em',
        }}
      >
        {title}
      </h2>
      <div
        className="mt-2 md:mt-3 text-[12px] md:text-[14px] leading-[1.75] space-y-1.5 md:space-y-2"
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
