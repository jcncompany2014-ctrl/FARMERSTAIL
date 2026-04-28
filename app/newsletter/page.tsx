import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ChevronRight,
  Mail,
  Sparkles,
  Calendar,
  BookOpen,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react'
import NewsletterForm from './NewsletterForm'

type SearchParamsT = Promise<{ status?: string }>

const STATUS_MESSAGES: Record<
  string,
  { tone: 'success' | 'error' | 'info'; title: string; body: string }
> = {
  confirmed: {
    tone: 'success',
    title: '구독 확인 완료!',
    body: '이메일 인증이 완료되었어요. 다음 첫째 주에 첫 뉴스레터로 만나요.',
  },
  already: {
    tone: 'info',
    title: '이미 구독 중이에요',
    body: '이메일 인증이 이미 완료된 주소예요.',
  },
  unsubscribed: {
    tone: 'success',
    title: '구독을 해지했어요',
    body: '앞으로 뉴스레터를 보내지 않아요. 언제든 다시 구독해 주세요.',
  },
  'already-unsubscribed': {
    tone: 'info',
    title: '이미 해지된 상태예요',
    body: '재구독을 원하시면 아래 폼에서 다시 신청해 주세요.',
  },
  invalid: {
    tone: 'error',
    title: '링크가 만료되었어요',
    body: '확인 링크가 잘못되었거나 만료되었어요. 새 신청 메일을 받아주세요.',
  },
  error: {
    tone: 'error',
    title: '처리 중 오류가 발생했어요',
    body: '잠시 후 다시 시도해 주세요. 계속되면 hello@farmerstail.kr 로 연락해 주세요.',
  },
}

/**
 * /newsletter — 뉴스레터 구독 페이지.
 *
 * editorial 톤의 신청 페이지. 폼은 client island (NewsletterForm) — submit
 * 시 Supabase consent_log + profiles 에 저장. 비로그인 시 메일 입력 → 별도
 * collection 에 저장.
 */

export const metadata: Metadata = {
  title: '뉴스레터 구독 | 파머스테일',
  description:
    '월 1회, 농장 소식 + 신상 메뉴 + 케어 가이드를 정리해서 보내드려요. 광고는 줄이고 인사이트만.',
  alternates: { canonical: '/newsletter' },
  openGraph: {
    title: '파머스테일 뉴스레터 — 월 1회',
    description: '월 1회, 농장 + 신상 + 케어 가이드.',
    type: 'website',
    url: '/newsletter',
  },
  robots: { index: true, follow: true },
}

const PERKS = [
  {
    icon: Calendar,
    title: '월 1회',
    body: '받은편지함을 더럽히지 않아요. 월 1회 첫째 주.',
  },
  {
    icon: Sparkles,
    title: '신상 먼저',
    body: '시즌 한정 / 새 메뉴 출시는 항상 구독자에게 24시간 먼저.',
  },
  {
    icon: BookOpen,
    title: '케어 인사이트',
    body: '수의영양사 칼럼 · 농장 다큐 · 사용자 후기 큐레이션.',
  },
]

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: SearchParamsT
}) {
  const { status } = await searchParams
  const banner = status ? STATUS_MESSAGES[status] : null

  return (
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 880 }}
    >
      <div className="px-5 md:px-8 pt-4 md:pt-6">
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          <Link href="/" className="hover:text-terracotta transition">
            홈
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>
            뉴스레터
          </span>
        </nav>
      </div>

      {banner && (
        <section className="px-5 md:px-8 pt-4">
          <div
            className="rounded-xl px-4 py-3 md:px-5 md:py-4 flex items-start gap-3"
            style={{
              background:
                banner.tone === 'success'
                  ? 'color-mix(in srgb, var(--moss) 12%, var(--bg))'
                  : banner.tone === 'error'
                  ? 'color-mix(in srgb, var(--terracotta) 14%, var(--bg))'
                  : 'var(--bg-2)',
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            {banner.tone === 'success' ? (
              <CheckCircle2
                className="w-5 h-5 shrink-0 mt-0.5"
                strokeWidth={2}
                color="var(--moss)"
              />
            ) : banner.tone === 'error' ? (
              <XCircle
                className="w-5 h-5 shrink-0 mt-0.5"
                strokeWidth={2}
                color="var(--terracotta)"
              />
            ) : (
              <Info
                className="w-5 h-5 shrink-0 mt-0.5"
                strokeWidth={2}
                color="var(--muted)"
              />
            )}
            <div>
              <p
                className="font-serif text-[14px] md:text-[16px] font-bold"
                style={{ color: 'var(--ink)', letterSpacing: '-0.015em' }}
              >
                {banner.title}
              </p>
              <p
                className="mt-1 text-[12px] md:text-[13.5px] leading-relaxed"
                style={{ color: 'var(--text)' }}
              >
                {banner.body}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="px-5 md:px-8 pt-6 md:pt-14 pb-6 md:pb-10 text-center">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--terracotta)' }}
        >
          Newsletter · 뉴스레터
        </span>
        <h1
          className="font-serif mt-3 md:mt-5 text-[28px] md:text-[48px] lg:text-[56px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          }}
        >
          농장에서 꼬리까지,
          <br />
          <span style={{ color: 'var(--terracotta)' }}>월 1회 정리해서</span>
        </h1>
        <p
          className="mx-auto mt-3 md:mt-5 text-[12.5px] md:text-[15.5px] leading-relaxed max-w-xl"
          style={{ color: 'var(--muted)' }}
        >
          광고는 줄이고 인사이트만. 농장 다큐, 신상 메뉴, 케어 가이드를 한
          편으로 묶어 매월 첫째 주에 보내드려요.
        </p>
      </section>

      {/* perks */}
      <section className="px-5 md:px-8 mb-6 md:mb-10">
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {PERKS.map((p) => {
            const Icon = p.icon
            return (
              <li
                key={p.title}
                className="rounded-2xl p-4 md:p-6"
                style={{
                  background: 'var(--bg-2)',
                  boxShadow: 'inset 0 0 0 1px var(--rule)',
                }}
              >
                <span
                  className="inline-flex w-9 h-9 md:w-11 md:h-11 rounded-full items-center justify-center mb-3 md:mb-4"
                  style={{ background: 'var(--bg)' }}
                >
                  <Icon
                    className="w-4 h-4 md:w-[18px] md:h-[18px]"
                    strokeWidth={2}
                    color="var(--terracotta)"
                  />
                </span>
                <h2
                  className="font-serif text-[15px] md:text-[18px]"
                  style={{
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {p.title}
                </h2>
                <p
                  className="mt-1.5 md:mt-2 text-[12px] md:text-[13.5px] leading-relaxed"
                  style={{ color: 'var(--text)' }}
                >
                  {p.body}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      {/* form */}
      <section className="px-5 md:px-8">
        <div
          className="rounded-2xl p-5 md:p-10"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
          }}
        >
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Mail
              className="w-4 h-4 md:w-5 md:h-5"
              strokeWidth={2}
              color="var(--gold)"
            />
            <span
              className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
              style={{ color: 'var(--gold)' }}
            >
              Subscribe
            </span>
          </div>
          <h2
            className="font-serif text-[19px] md:text-[28px]"
            style={{ fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            받은편지함에서 만나요
          </h2>
          <p
            className="mt-2 md:mt-3 text-[12.5px] md:text-[14.5px] leading-relaxed"
            style={{ color: 'rgba(245,240,230,0.78)' }}
          >
            언제든 구독 해지 가능. 이메일은 뉴스레터 발송에만 쓰고 외부에 공유
            하지 않아요.
          </p>

          <NewsletterForm />
        </div>
      </section>
    </main>
  )
}
