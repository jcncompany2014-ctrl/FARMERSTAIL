import type { Metadata } from 'next'
import SiteShell from '@/components/store/SiteShell'
import { isAppContextServer } from '@/lib/app-context'
import NewsletterForm from './NewsletterForm'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'

type SearchParamsT = Promise<{ status?: string }>

/**
 * 메일 링크(구독 확인·수신거부 — app/api/newsletter/*)가 돌려보내는 ?status= 값별 안내.
 * 키는 API 의 redirect 값과 같아야 한다(confirmed·already·unsubscribed·already-unsubscribed·invalid·error).
 */
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
    // 2026-10-10 웹 리뉴얼 — 고객 문구에 '언제든'을 쓰지 않는다(예전: "언제든 다시 구독해 주세요").
    body: '앞으로 뉴스레터를 보내지 않아요. 다시 받고 싶으면 아래에서 신청해 주세요.',
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
    title: '지금 처리하지 못했어요',
    body: '잠시 후 다시 시도해 주세요. 계속되면 story@farmerstail.kr 로 연락해 주세요.',
  },
}

/**
 * /newsletter — 뉴스레터 구독 페이지.
 *
 * # 2026-10-10 웹 리뉴얼 — 웹 시안 WEB-C13
 * 위에서부터: (메일 링크로 왔으면 결과 안내) → 머리말·큰 제목(웹만) → 소개 → 셸티 사진 → 받는 것 세 줄(먹선 목록)
 *   → 회색 칸 '받은편지함에서 만나요' + 구독 양식(NewsletterForm — 검사·동의·/api/newsletter 호출 그대로, 모양만).
 * 바깥 틀은 SiteShell — 웹이면 새 웹 가게 틀, 앱이면 AppChrome(메일의 확인·수신거부 링크가 앱을 열면 여기로 돌아온다).
 * 앱은 윗줄이 화면 이름을 맡으므로 머리말·큰 제목을 뺀다(app/contact 와 같은 방식). 예전 FD 톤 판은 git 이력.
 */

// R99-A (D7): openGraph images 누락 → 공유 카드 썸네일 0 (shallow merge).
const NEWSLETTER_OG = ogImageUrl({
  title: '파머스테일 뉴스레터',
  subtitle: '월 1회, 농장 + 제철 + 케어 가이드',
  tag: 'Newsletter',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차149).
  title: '뉴스레터 구독',
  description:
    '월 1회, 농장 소식 + 제철 재료 이야기 + 케어 가이드를 정리해서 보내드려요. 광고는 줄이고 인사이트만.',
  alternates: { canonical: '/newsletter' },
  openGraph: {
    title: '파머스테일 뉴스레터 — 월 1회',
    description: '월 1회, 농장 + 제철 + 케어 가이드.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/newsletter',
    images: [
      { url: NEWSLETTER_OG, width: 1200, height: 630, alt: '파머스테일 뉴스레터' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '파머스테일 뉴스레터 — 월 1회',
    description: '월 1회, 농장 + 제철 + 케어 가이드.',
    images: [NEWSLETTER_OG],
  },
  robots: { index: true, follow: true },
}

/** 받는 것 세 줄(시안 C13) — 아이콘은 시안 원본 svg path 그대로. */
const PERKS: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: '월 1회',
    body: '받은편지함을 어지럽히지 않아요. 매월 첫째 주에 한 번 보내요.',
    icon: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </>
    ),
  },
  {
    title: '제철 이야기',
    body: '지금 제철인 국내산 재료와 화식 활용법을 편지처럼 전해드려요.',
    icon: (
      <>
        <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
        <path d="M5 19l7-7" />
      </>
    ),
  },
  {
    title: '돌봄 읽을거리',
    body: '반려 영양 칼럼과 보호자 후기를 골라 담아요.',
    icon: (
      <>
        <path d="M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z" />
        <path d="M20 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z" />
      </>
    ),
  },
]

/** 메일 링크 결과 안내 — 회색 칸(오류는 연한 빨강) · 왼쪽 동그라미 표시 · 굵은 제목 + 설명. */
const BANNER_TONE = {
  success: { bg: '#F6F4F5', dot: '#141414', body: '#3D3D3D', icon: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
  error: { bg: '#FDECEA', dot: '#B3261E', body: '#8A1F11', icon: <path d="M12 7v6M12 17h.01" /> },
  info: { bg: '#F6F4F5', dot: '#595959', body: '#3D3D3D', icon: <path d="M12 11v6M12 7h.01" /> },
} as const

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: SearchParamsT
}) {
  const { status } = await searchParams
  const banner = status ? STATUS_MESSAGES[status] : null
  const isApp = await isAppContextServer()

  // 검색엔진용 BreadcrumbList 구조화데이터(회차123).
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '뉴스레터', path: '/newsletter' },
  ])

  const tone = banner ? BANNER_TONE[banner.tone] : null

  return (
    <SiteShell>
      <JsonLd id="ld-newsletter-crumbs" data={crumbLd} />
      <div style={{ lineHeight: 'normal' }}>
        {/* ── 메일 링크(구독 확인·수신거부)로 돌아왔을 때 결과 ── */}
        {banner && tone && (
          <section style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <div
              role={banner.tone === 'error' ? 'alert' : 'status'}
              style={{ padding: 16, borderRadius: 4, background: tone.bg, display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 12, alignItems: 'start' }}
            >
              <span aria-hidden style={{ width: 28, height: 28, borderRadius: 14, background: tone.dot, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  {tone.icon}
                </svg>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.5 }}>{banner.title}</strong>
                <span style={{ fontSize: 15, lineHeight: 1.6, color: tone.body }}>{banner.body}</span>
              </span>
            </div>
          </section>
        )}

        {/* ── 머리말 · 큰 제목(웹만) · 소개 · 사진 ── */}
        <section style={{ padding: banner ? '24px 20px 0' : isApp ? '20px 20px 0' : '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          {!isApp && (
            <>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>뉴스레터</span>
              <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
                농장에서 꼬리까지
                <br />
                월 1회 정리해서
              </h1>
            </>
          )}
          <p style={{ margin: isApp ? 0 : '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            광고는 줄이고 알맹이만 담았어요. 농장 이야기, 제철 재료, 돌봄 가이드를 한 편으로 묶어 매월 첫째 주에 보내드려요.
          </p>
          {/* ★farm-landscape.jpg 는 가짜 타사 브랜드("WHOLESOME NATURAL PET FOOD") 포대가 박힌 AI 사진이었다(2026-09-02 실사 검수). 실촬영 컷. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bowl-eating.jpg"
            alt="그릇에 담긴 화식을 먹는 셸티"
            width={1200}
            height={900}
            fetchPriority="high"
            style={{ marginTop: 22, width: '100%', height: 'auto', aspectRatio: '350 / 250', objectFit: 'cover', borderRadius: 4, display: 'block' }}
          />
        </section>

        {/* ── 받는 것 세 줄 — 먹선 아래 동그라미 아이콘 · 굵은 이름 · 설명 ── */}
        <section style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {PERKS.map((p) => (
              <li
                key={p.title}
                style={{ padding: '16px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '44px 1fr', columnGap: 6, alignItems: 'start' }}
              >
                <span aria-hidden style={{ width: 36, height: 36, borderRadius: 18, background: '#F6F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {p.icon}
                  </svg>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <strong style={{ fontSize: 18, fontWeight: 800 }}>{p.title}</strong>
                  <span style={{ fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 구독 칸 — 회색 바탕 · 포스터 제목 · 개인정보 안내 · 양식 ── */}
        <section style={{ padding: '40px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px 20px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
            <h2 className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
              받은편지함에서 만나요
            </h2>
            <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>
              이메일은 뉴스레터를 보내는 데만 쓰고 다른 곳에 주지 않아요. 그만 받고 싶으면 메일 맨 아래 링크로 바로 해지할 수 있어요.
            </p>
            <NewsletterForm />
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
