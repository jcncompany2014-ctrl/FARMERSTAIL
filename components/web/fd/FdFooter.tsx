/**
 * FdFooter — FD 톤 마케팅 푸터 (nav 컬럼 + 워드마크 + CTA).
 * 법정 정보(사업자번호 등)는 아래 SiteFooter(불변)가 담당 — 여기는 탐색/브랜드만.
 * cream bg, 샤프, 코랄 CTA. 서버 컴포넌트.
 */
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SOCIAL_PROFILES } from '@/lib/seo/jsonld'
import { cred } from '@/lib/copy/credibility'

const BROWSE: { href: string; label: string }[] = [
  { href: '/our-food', label: '우리 음식' },
  { href: '/why-fresh', label: '왜 신선식' },
  { href: '/why-app', label: '앱 소개' },
  { href: '/reviews', label: '후기' },
  { href: '/about', label: '브랜드 이야기' },
  // 실 자문 없을 땐 '영양 근거'로 톤다운(lib/copy/credibility 토글).
  { href: '/science', label: cred.navVetLabel },
  { href: '/partners', label: '농장 파트너' },
  { href: '/faq', label: '자주 묻는 질문' },
  { href: '/blog', label: '매거진' },
]

const SUPPORT: { href: string; label: string }[] = [
  { href: '/contact', label: '문의하기' },
  { href: '/faq', label: '배송 · 환불 안내' },
  { href: '/legal/privacy', label: '개인정보처리방침' },
]

// FD 텍스트 링크 hover — 밑줄이 좌→우로 자라는 모션(after 의사요소, globals 무변경).
// bg-current = 텍스트색(pine) 밑줄. reduced-motion 은 globals 전역 net 이 transition
// 을 0 으로 만들어 즉시 표시(접근성). 버튼류엔 적용 안 함(텍스트 nav 링크 전용).
const navLinkCls =
  // before 의사요소 = 시각 변화 없는 터치 히트존 확장(모바일 21px→~40px, WCAG 2.5.8).
  "relative inline-block no-underline after:absolute after:left-0 after:-bottom-px after:h-px after:w-0 after:bg-current after:transition-[width] after:duration-200 hover:after:w-full before:absolute before:-inset-y-2.5 before:-inset-x-1 before:content-['']"

function Col({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3
        style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fd-green)' }}
      >
        {title}
      </h3>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className={navLinkCls}
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--fd-pine)' }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function FdFooter({ planHref }: { planHref: string }) {
  return (
    <div style={{ background: 'var(--fd-cream)', borderTop: '1px solid var(--fd-line)' }}>
      <div className="mx-auto px-5 md:px-8 py-12 md:py-16" style={{ maxWidth: 1140 }}>
        {/* 뉴스레터 가입 band — 실제 구독 폼은 /newsletter(FD). 가짜 입력 X. */}
        <div
          className="grid md:grid-cols-2 md:items-center gap-4 md:gap-6 pb-9 md:pb-12 mb-9 md:mb-12"
          style={{ borderBottom: '1px solid var(--fd-line)' }}
        >
          <div>
            <span
              style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fd-green)' }}
            >
              Newsletter
            </span>
            <p
              className="mt-2 text-[16px] md:text-[18px]"
              style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em', lineHeight: 1.35 }}
            >
              월 1회, 농장 소식 · 신상 메뉴 · 케어 가이드를 한 편으로.
            </p>
          </div>
          <div className="md:flex md:justify-end">
            <Link
              href="/newsletter"
              className="inline-flex items-center justify-center gap-2 rounded-full no-underline transition hover:opacity-80"
              style={{ height: 48, padding: '0 22px', border: '1.5px solid var(--fd-pine)', color: 'var(--fd-pine)', fontWeight: 800, fontSize: 14 }}
            >
              뉴스레터 구독하기
              <ArrowRight size={17} strokeWidth={2.4} />
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-[1.4fr_1fr_1fr] gap-9 md:gap-10">
          {/* 브랜드 */}
          <div>
            <span className="font-chunky" style={{ fontSize: 22, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>
              FARMER&rsquo;S TAIL
            </span>
            <p className="mt-3 text-[14px]" style={{ maxWidth: 320, lineHeight: 1.6, color: 'var(--fd-muted)' }}>
              사료 대신, 사람이 먹는 등급의 진짜 음식 한 끼. 우리 아이 몸에 딱 맞게.
            </p>
            <Link
              href={planHref}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full no-underline transition hover:brightness-[0.94] hover:-translate-y-[1px] active:translate-y-[1px]"
              style={{ height: 48, padding: '0 22px', background: 'var(--fd-coral)', color: '#FFFFFF', fontWeight: 800, fontSize: 14 }}
            >
              2분 설문 시작하기
              <ArrowRight size={17} strokeWidth={2.4} />
            </Link>

            {/* Connect — 공식 소셜 채널. SOCIAL_PROFILES(jsonld) SSOT = Organization
                sameAs 와 동일. 실재 계정만(가짜 링크 X). */}
            <div className="mt-7">
              <span
                style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fd-green)' }}
              >
                Connect
              </span>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                {SOCIAL_PROFILES.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={navLinkCls}
                    style={{ fontSize: 14, fontWeight: 600, color: 'var(--fd-pine)' }}
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <Col title="둘러보기" links={BROWSE} />
          <Col title="고객지원" links={SUPPORT} />
        </div>
      </div>
    </div>
  )
}
