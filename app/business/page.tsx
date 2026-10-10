import type { Metadata } from 'next'
import Link from 'next/link'
import { business, ftcLookupUrl } from '@/lib/business'
import AuthAwareShell from "@/components/AuthAwareShell"
import SiteShell from "@/components/store/SiteShell"
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import type { ReactNode } from 'react'
import { isAppContextServer } from '@/lib/app-context'
import { V3, V3Radius } from '@/lib/design/tokens'
import { PlainTitle, SCREEN_ROOT } from '@/components/v3/me/MeParts'
import { BuildingIcon } from '@/components/v3/me/MeIcons'

// 1시간 ISR — 사업자 정보 변경 빈도 낮음. 통신판매 신고번호 등록 시
// revalidatePath('/business') 로 강제 갱신.
export const revalidate = 3600

const BUSINESS_OG = ogImageUrl({
  title: '사업자 정보',
  subtitle: '사업자 등록 · 통신판매 신고 · 고객센터',
  tag: 'Business',
  variant: 'editorial',
})

export const metadata: Metadata = {
  title: '사업자 정보',
  description:
    '파머스테일 사업자 등록 정보, 통신판매업 신고번호, 고객센터 안내.',
  alternates: { canonical: '/business' },
  openGraph: {
    title: '사업자 정보 | 파머스테일',
    description:
      '파머스테일 사업자 등록 정보, 통신판매업 신고번호, 고객센터 안내.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/business',
    images: [{ url: BUSINESS_OG, width: 1200, height: 630, alt: '사업자 정보' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '사업자 정보 | 파머스테일',
    description:
      '파머스테일 사업자 등록 정보, 통신판매업 신고번호, 고객센터 안내.',
    images: [BUSINESS_OG],
  },
  robots: { index: true, follow: true },
}

/**
 * 사업자정보 상세 페이지 — editorial 톤.
 *
 * 전자상거래법 제10조에 따라 상호/대표자/사업장 소재지/전화번호/
 * 전자우편/사업자등록번호/통신판매업 신고번호를 소비자가 쉽게
 * 확인할 수 있도록 이 한 페이지에 모두 모아 둔다.
 *
 * 톤: FD 디자인시스템 — Eyebrow + Pretendard 헤비 + 흰 카드 + --fd-* 토큰
 * (farm v6, 2026-06-14 회차24). AuthAwareShell·사업자 데이터·법정 구조 보존.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M20): 앱이면 BusinessAppView 를 그린다 — 같은 사업자 데이터(lib/business)·
 * 같은 법정 항목(전자상거래법 제10조)을 위 2px 먹선 목록으로. 영어 머리말(Business·Registry·Payments·Dispute)은 앱에서
 * 뺐다. 웹 마크업은 아래 그대로 — 한 픽셀도 바꾸지 않았다(AGENTS.md R14).
 */
export default async function BusinessPage() {
  const ftcLink = ftcLookupUrl()

  if (await isAppContextServer()) {
    return (
      <AuthAwareShell>
        <BusinessAppView ftcLink={ftcLink} />
      </AuthAwareShell>
    )
  }

  // 검색엔진용 BreadcrumbList 구조화데이터(회차124, breadcrumb 커버리지 마무리).
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '사업자 정보', path: '/business' },
  ])

  // 웹 — 2026-10-10 웹 리뉴얼('A 포스터' 웹): 앱과 같은 목록 화면(BusinessAppView — 같은 데이터·같은 법정 항목)을
  // 새 웹 가게 틀에 담고 제목만 더한다. 예전 FD 톤 마크업은 git 이력에 있다.
  return (
    <SiteShell>
      <JsonLd id="ld-business-crumbs" data={crumbLd} />
      <h1 className="d" style={{ margin: 0, padding: '28px 20px 0', fontSize: 34, lineHeight: 1.1 }}>
        사업자 정보
      </h1>
      <BusinessAppView ftcLink={ftcLink} />
    </SiteShell>
  )
}

/** 앱 링크 — 굵은 먹색 밑줄(시안 M20). */
const APP_LINK = { fontWeight: 800, color: V3.ink, textDecoration: 'underline' } as const

/** 사업자 정보 — 앱 모양(시안 M20). 항목·순서는 웹과 같다(전자상거래법 제10조 표시 항목). */
function BusinessAppView({ ftcLink }: { ftcLink: string }) {
  return (
    <main style={SCREEN_ROOT}>
      <p style={{ margin: '20px 20px 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
        전자상거래법 제10조에 따라 파머스테일의 사업자 등록 정보를 공개해요.
      </p>

      <section aria-labelledby="biz-reg" style={{ padding: '26px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="biz-reg" style={{ margin: 0, fontSize: 22, lineHeight: 'normal' }}>
          등록 정보
        </h2>
        <div
          style={{
            marginTop: 12,
            padding: '16px 0 14px',
            borderTop: `2px solid ${V3.ink}`,
            borderBottom: `1px solid ${V3.rule}`,
            display: 'grid',
            gridTemplateColumns: '44px 1fr',
            columnGap: 12,
            alignItems: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: V3.soft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BuildingIcon size={21} color={V3.ink} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{business.companyName}</span>
            <span style={{ fontSize: 14, color: V3.inkMute }}>{business.brandName}</span>
          </span>
        </div>
        <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
          <AppRow label="대표자" value={business.ceo} />
          <AppRow
            label="사업자등록번호"
            value={business.businessNumber}
            link={ftcLink !== '#' ? { href: ftcLink, label: '공정위에서 조회 ↗' } : undefined}
          />
          <AppRow
            label={
              <>
                통신판매업
                <br />
                신고번호
              </>
            }
            value={business.mailOrderNumber}
          />
          <AppRow label="사업장 주소" value={business.address} multiline />
          <AppRow label="고객센터" value={business.phone} link={{ href: `tel:${business.phone}`, label: '전화 걸기' }} />
          <AppRow label="이메일" value={business.email} link={{ href: `mailto:${business.email}`, label: '메일 쓰기' }} />
          <AppRow
            label={
              <>
                개인정보
                <br />
                보호 책임자
              </>
            }
            value={
              <>
                {business.privacyOfficer}
                <br />
                <span style={{ fontWeight: 500 }}>({business.privacyOfficerEmail})</span>
              </>
            }
            multiline
          />
          <AppRow label="호스팅 서비스" value={business.hostingProvider} />
        </dl>
      </section>

      <section
        aria-labelledby="biz-pay"
        style={{
          margin: '30px 20px 0',
          padding: 18,
          borderRadius: V3Radius.sm,
          background: V3.soft,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <PlainTitle id="biz-pay">결제와 환불</PlainTitle>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: V3.inkSoft }}>
          파머스테일은 토스페이먼츠(주)를 통해 결제를 처리하고, 카드 정보 같은 민감 정보는 저희 서버에 저장하지 않아요.
          정기배송은 결제 전까지 미루거나 해지할 수 있어요. 결제된 박스는 맞춤으로 조리되기 때문에, 결제 전에 안내하고
          동의를 받은 회차는 단순 변심으로 취소·환불할 수 없어요. 상품에 문제가 있거나 잘못 배송되면 환불해 드려요. 자세한
          내용은{' '}
          <Link href="/legal/terms" style={APP_LINK}>
            이용약관
          </Link>{' '}
          제9조와{' '}
          <Link href="/legal/refund" style={APP_LINK}>
            환불 정책
          </Link>
          을 확인해 주세요.
        </p>
      </section>

      <section aria-labelledby="biz-dispute" style={{ padding: '30px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id="biz-dispute" style={{ margin: 0, fontSize: 22, lineHeight: 'normal' }}>
          분쟁 해결
        </h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: V3.inkSoft }}>
          불편한 점이나 분쟁은 고객센터({business.email})로 알려 주세요. 원만히 해결되지 않으면{' '}
          <a href="https://ecrb.kca.go.kr" target="_blank" rel="noopener noreferrer" style={{ ...APP_LINK, whiteSpace: 'nowrap' }}>
            전자거래분쟁조정위원회 ↗
          </a>{' '}
          또는{' '}
          <a href="https://www.kca.go.kr" target="_blank" rel="noopener noreferrer" style={{ ...APP_LINK, whiteSpace: 'nowrap' }}>
            한국소비자원 ↗
          </a>
          에 조정을 신청할 수 있어요.
        </p>
      </section>
    </main>
  )
}

function AppRow({
  label,
  value,
  link,
  multiline,
}: {
  label: ReactNode
  value: ReactNode
  link?: { href: string; label: string }
  multiline?: boolean
}) {
  const external = !!link && link.href.startsWith('http')
  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: `1px solid ${V3.rule}`,
        display: 'grid',
        gridTemplateColumns: '104px 1fr',
        columnGap: 10,
      }}
    >
      <dt style={{ fontSize: 15, color: V3.inkMute }}>{label}</dt>
      <dd
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          ...(multiline ? { lineHeight: 1.5 } : null),
          ...(link ? { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 4 } : null),
          wordBreak: 'break-word',
        }}
      >
        {value}
        {link && (
          <a
            href={link.href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            style={{ fontSize: 14, fontWeight: 800, color: V3.ink, textDecoration: 'underline' }}
          >
            {link.label}
          </a>
        )}
      </dd>
    </div>
  )
}
