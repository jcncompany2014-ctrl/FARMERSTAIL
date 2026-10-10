import type { Metadata } from 'next'
import Link from 'next/link'
import AuthAwareShell from '@/components/AuthAwareShell'
import SiteShell from '@/components/store/SiteShell'
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
 * 2026-10-10 웹 리뉴얼: 웹은 HelpWebView(웹 시안 WEB-C17) — 새 웹 가게 틀(SiteShell)에 머리말·큰 제목 + 같은 세 묶음.
 * 예전 웹 판(둥근 카드 목록)은 git 이력.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '고객센터',
  robots: { index: false, follow: false },
}

export default async function HelpPage() {
  // 문의 창구 — 앱: 카카오 채널 1:1 채팅으로 외부 연결(사장님 2026-07-17 "앱 문의는
  // 전부 카카오톡으로"). 웹: 문의 양식(/contact, 그 안에 카카오 채널 줄도 있음).
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
    <SiteShell>
      <HelpWebView />
    </SiteShell>
  )
}

/** 고객센터 — 웹 모양(웹 시안 WEB-C17). 묶음·순서·주소는 앱과 같다(웹 문의 = /contact 양식). */
function HelpWebView() {
  return (
    <main>
      <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>고객센터</span>
        <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
          무엇을
          <br />
          도와드릴까요?
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 17, lineHeight: 1.6, color: '#3D3D3D' }}>영업일에는 24시간 안에 답변드려요.</p>
      </section>

      <section aria-labelledby="help-web-self" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="help-web-self" style={{ margin: 0, fontFamily: 'inherit', fontSize: 15, fontWeight: 800, letterSpacing: 'inherit', color: '#595959' }}>
          상담 없이 해결할 수 있어요
        </h2>
        <div style={{ marginTop: 10, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          <WebRow href="/faq" icon={<QuestionIcon size={20} color="#141414" />} label="자주 묻는 질문">
            <span style={{ fontSize: 15, color: '#595959' }}>식단 · 배송 · 결제 · 정기배송</span>
          </WebRow>
        </div>
      </section>

      <section aria-labelledby="help-web-ask" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="help-web-ask" style={{ margin: 0, fontFamily: 'inherit', fontSize: 15, fontWeight: 800, letterSpacing: 'inherit', color: '#595959' }}>
          직접 문의하기
        </h2>
        <div style={{ marginTop: 10, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          <WebRow href="/contact" icon={<InquiryIcon />} label="1:1 문의 남기기" />
          <WebRow href={`tel:${business.phone.replace(/[^0-9]/g, '')}`} external icon={<PhoneIcon size={20} color="#141414" />} label="전화 문의">
            <span className="n" style={{ fontSize: 16, color: '#3D3D3D' }}>
              {business.phone}
            </span>
          </WebRow>
          <WebRow href={`mailto:${business.email}`} external icon={<MailIcon size={20} color="#141414" />} label="이메일 문의">
            <span style={{ fontSize: 15, color: '#3D3D3D', wordBreak: 'break-all' }}>{business.email}</span>
          </WebRow>
        </div>
      </section>

      <nav aria-label="회사·약관" style={{ padding: '32px 20px 64px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          <WebRow href="/business" icon={<BuildingIcon size={20} />} label="사업자 정보" short />
          <WebRow href="/legal" icon={<TermsIcon size={20} />} label="이용약관 · 개인정보처리방침" short />
        </div>
      </nav>
    </main>
  )
}

/** 1:1 문의 그림(웹 시안 C17 — 네모 말풍선). 앱의 TalkIcon(카카오톡 말풍선)과 구분한다 — 웹 문의는 양식이다. */
function InquiryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5h14v10H9l-4 4z" />
    </svg>
  )
}

/** 웹 시안 C17 의 줄 — 40px 동그라미 그림 · 굵은 이름(+ 아래 한 줄) · 꺾쇠. 바닥 두 줄은 조금 낮다(short). */
function WebRow({
  href,
  icon,
  label,
  external,
  short,
  children,
}: {
  href: string
  icon: ReactNode
  label: string
  /** 전화·메일 — 앱 밖으로 나가는 <a>. */
  external?: boolean
  short?: boolean
  children?: ReactNode
}) {
  const style = {
    minHeight: short ? 68 : 76,
    borderBottom: '1px solid #E5E5E5',
    display: 'grid',
    gridTemplateColumns: '44px 1fr 18px',
    columnGap: 10,
    alignItems: 'center',
    color: '#141414',
    textDecoration: 'none',
  }
  const inner = (
    <>
      <span
        aria-hidden
        style={{ width: 40, height: 40, borderRadius: 20, background: '#F6F4F5', color: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{label}</span>
        {children}
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
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
