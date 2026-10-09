import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ChevronRight,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  Building2,
  FileText,
} from 'lucide-react'
import AuthAwareShell from '@/components/AuthAwareShell'
import { business } from '@/lib/business'
import { isAppContextServer } from '@/lib/app-context'
import type { ReactNode } from 'react'
import { V3 } from '@/lib/design/tokens'
import { SCREEN_ROOT } from '@/components/v3/me/MeParts'
import {
  BuildingIcon,
  ExternalIcon,
  MailIcon,
  PhoneIcon,
  QuestionIcon,
  TalkIcon,
  TermsIcon,
} from '@/components/v3/me/MeIcons'

/**
 * /help — 고객센터 허브 (토스식, 2026-07-16 사장님).
 *
 * 이전엔 마이페이지 '고객센터' 가 /business(사업자 정보) 로 바로 튀었다. 대신 여기에
 * "무엇을 도와드릴까요?" 허브를 두고 ① 자주 묻는 질문 ② 문의 ③ 사업자 정보를
 * 그 안의 요소로 모은다. AuthAwareShell 로 앱에선 앱 chrome(웹으로 안 넘어감).
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M18): 앱이면 HelpAppView — 큰 제목(제목 글꼴 32) + 위 2px 먹선 목록
 * (줄 높이 76 · 동그라미 그림 44). 카카오톡 문의는 먹색 동그라미 + '앱 밖으로 열려요' 그림. 문의 창구 분기(아래)는 그대로.
 * 웹 마크업은 그대로 — 한 픽셀도 바꾸지 않았다(AGENTS.md R14).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '고객센터',
  robots: { index: false, follow: false },
}

function Row({
  href,
  Icon,
  label,
  sub,
  external,
}: {
  href: string
  Icon: typeof HelpCircle
  label: string
  sub?: string
  external?: boolean
}) {
  const inner = (
    <>
      <span className="w-8 h-8 rounded-full bg-bg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-terracotta" strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[13.5px] font-bold text-text">{label}</span>
        {sub && <span className="block text-[10.5px] text-muted mt-0.5">{sub}</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-muted shrink-0" strokeWidth={2} />
    </>
  )
  const cls =
    'flex items-center gap-3 w-full px-4 py-3.5 hover:bg-bg/40 transition'
  return external ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  )
}

export default async function HelpPage() {
  // 문의 창구 — 앱: 카카오 채널 1:1 채팅으로 외부 연결(사장님 2026-07-17 "앱 문의는
  // 전부 카카오톡으로"). 웹: 기존 문의 폼(/contact, 그 안에 카카오 버튼도 있음).
  // 카카오 URL 미설정(env 비어있음)이면 앱에서도 /contact 폼으로 안전 폴백.
  const isApp = await isAppContextServer()
  const kakaoUrl = business.kakaoChannelUrl
  const inquiryToKakao = isApp && !!kakaoUrl
  const inquiryHref = inquiryToKakao ? kakaoUrl! : '/contact'

  if (isApp) {
    return (
      <AuthAwareShell>
        <HelpAppView inquiryHref={inquiryHref} inquiryToKakao={inquiryToKakao} />
      </AuthAwareShell>
    )
  }

  return (
    <AuthAwareShell>
      <main className="pb-16" style={{ minHeight: '72vh' }}>
        <section className="px-5 pt-8 pb-1">
          <h1
            className="font-sans"
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            무엇을 도와드릴까요?
          </h1>
          <p className="text-[12px] text-muted mt-2">
            평일 영업일 24시간 이내 답변드려요.
          </p>
        </section>

        {/* 상담 없이 해결 */}
        <section className="px-5 mt-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted mb-2 px-1">
            상담 없이 해결할 수 있어요
          </div>
          <div className="rounded-[12px] bg-bg-3 border border-rule overflow-hidden divide-y divide-rule">
            <Row
              href="/faq"
              Icon={HelpCircle}
              label="자주 묻는 질문"
              sub="식단 · 배송 · 결제 · 정기배송"
            />
          </div>
        </section>

        {/* 문의 */}
        <section className="px-5 mt-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted mb-2 px-1">
            직접 문의하기
          </div>
          <div className="rounded-[12px] bg-bg-3 border border-rule overflow-hidden divide-y divide-rule">
            <Row
              href={inquiryHref}
              Icon={MessageCircle}
              label={inquiryToKakao ? '카카오톡으로 문의' : '1:1 문의 남기기'}
              sub={inquiryToKakao ? '카카오톡 채널로 바로 연결돼요' : undefined}
              external={inquiryToKakao}
            />
            <Row
              href={`tel:${business.phone.replace(/[^0-9]/g, '')}`}
              Icon={Phone}
              label="전화 문의"
              sub={business.phone}
              external
            />
            <Row
              href={`mailto:${business.email}`}
              Icon={Mail}
              label="이메일 문의"
              sub={business.email}
              external
            />
          </div>
        </section>

        {/* 하단 — 사업자정보 · 약관 */}
        <section className="px-5 mt-4">
          <div className="rounded-[12px] bg-bg-3 border border-rule overflow-hidden divide-y divide-rule">
            <Row href="/business" Icon={Building2} label="사업자 정보" />
            <Row href="/legal" Icon={FileText} label="이용약관 · 개인정보처리방침" />
          </div>
        </section>
      </main>
    </AuthAwareShell>
  )
}

/** 고객센터 — 앱 모양(시안 M18). */
function HelpAppView({ inquiryHref, inquiryToKakao }: { inquiryHref: string; inquiryToKakao: boolean }) {
  return (
    <main style={SCREEN_ROOT}>
      <section style={{ padding: '26px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 32, lineHeight: 1.15 }}>무엇을 도와드릴까요?</h2>
        <p style={{ margin: 0, fontSize: 16, color: V3.inkSoft }}>영업일에는 24시간 안에 답변드려요.</p>
      </section>

      {/* 상담 없이 해결 */}
      <section aria-labelledby="help-self" style={{ padding: '30px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h3 id="help-self" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: V3.inkMute }}>
          상담 없이 해결할 수 있어요
        </h3>
        <div style={{ marginTop: 10, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
          <HelpRow href="/faq" icon={<QuestionIcon size={21} color={V3.ink} />} label="자주 묻는 질문" sub="식단 · 배송 · 결제 · 정기배송" />
        </div>
      </section>

      {/* 문의 */}
      <section aria-labelledby="help-ask" style={{ padding: '30px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h3 id="help-ask" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: V3.inkMute }}>
          직접 문의하기
        </h3>
        <div style={{ marginTop: 10, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
          <HelpRow
            href={inquiryHref}
            external={inquiryToKakao}
            dark={inquiryToKakao}
            icon={<TalkIcon size={21} />}
            label={inquiryToKakao ? '카카오톡으로 문의' : '1:1 문의 남기기'}
            sub={inquiryToKakao ? '카카오톡 채널로 바로 연결돼요' : undefined}
          />
          <HelpRow
            href={`tel:${business.phone.replace(/[^0-9]/g, '')}`}
            external
            icon={<PhoneIcon size={20} color={V3.ink} />}
            label="전화 문의"
            sub={business.phone}
          />
          <HelpRow
            href={`mailto:${business.email}`}
            external
            icon={<MailIcon size={20} color={V3.ink} />}
            label="이메일 문의"
            sub={business.email}
          />
        </div>
      </section>

      {/* 하단 — 사업자정보 · 약관 */}
      <nav aria-label="회사·약관" style={{ margin: '30px 20px 0', borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
        <FootRow href="/business" icon={<BuildingIcon size={22} />} label="사업자 정보" />
        <FootRow href="/legal" icon={<TermsIcon size={22} />} label="이용약관 · 개인정보처리방침" />
      </nav>
    </main>
  )
}

function HelpRow({
  href,
  icon,
  label,
  sub,
  external,
  dark,
}: {
  href: string
  icon: ReactNode
  label: string
  sub?: string
  /** 앱 밖(카카오톡·전화·메일)으로 나가는 줄 — <a>. 카카오톡만 '앱 밖으로 열려요' 그림을 단다(dark). */
  external?: boolean
  dark?: boolean
}) {
  const style = {
    minHeight: 76,
    boxSizing: 'content-box' as const,
    borderBottom: `1px solid ${V3.rule}`,
    display: 'grid',
    gridTemplateColumns: dark ? '44px 1fr 18px' : '44px 1fr 14px',
    columnGap: 14,
    alignItems: 'center',
    color: V3.ink,
    textDecoration: 'none',
  }
  const inner = (
    <>
      <span
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          background: dark ? V3.ink : V3.soft,
          color: dark ? '#FFFFFF' : V3.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{label}</span>
        {sub && <span style={{ fontSize: 15, color: V3.inkMute }}>{sub}</span>}
      </span>
      {dark ? (
        <span role="img" aria-label="앱 밖으로 열려요">
          <ExternalIcon size={18} />
        </span>
      ) : (
        <span aria-hidden style={{ fontSize: 20 }}>
          ›
        </span>
      )}
    </>
  )
  return external ? (
    <a href={href} style={style}>
      {inner}
    </a>
  ) : (
    <Link href={href} style={style}>
      {inner}
    </Link>
  )
}

function FootRow({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      style={{
        minHeight: 64,
        boxSizing: 'content-box',
        borderBottom: `1px solid ${V3.rule}`,
        display: 'grid',
        gridTemplateColumns: '24px 1fr 14px',
        columnGap: 12,
        alignItems: 'center',
        fontSize: 17,
        fontWeight: 800,
        color: V3.ink,
        textDecoration: 'none',
      }}
    >
      {icon}
      {label}
      <span aria-hidden style={{ fontSize: 20, fontWeight: 400 }}>
        ›
      </span>
    </Link>
  )
}
