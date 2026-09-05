'use client'

/**
 * Magazine CTAStack — 보조 2버튼 (제품 문의 + 결과 저장).
 *
 * 메인 적색 SUBSCRIBE 버튼은 2026-05-21 폐기 — 정기배송 신청 CTA 는
 * RecommendationBox 의 fb-totals 안 "정기배송 신청" 버튼이 단독 담당
 * (옛 디자인 기능 보존).
 *
 * 2026-07-14 사장님: '처방 상담 · 수의사 연결' → 수의사 연결 서비스가 없으므로
 * 제품 문의(/contact)로 교체. 없는 서비스를 광고하지 않는다.
 *
 * ★2026-08-05 사장님 제보("분석화면 버튼중에 pdf공유하기라고 써져있어서") —
 * 오른쪽 버튼이 **죽어 있었다.** `onShare` 가 optional 인데 호출부
 * (AnalysisMagazineSection)가 넘기질 않아 `onClick={undefined}` 였다.
 * 눌러도 아무 일이 없는데 "PDF · 링크"라고 적혀 있었으니, **없는 기능을
 * 광고**하면서 무반응이기까지 한 최악의 조합이었다. 타입이 optional 이라
 * 컴파일러도 잡지 못했다.
 * 이제 실제로 PDF 가 되는 곳(수의사 리포트)으로 보내는 링크다 — 그 화면이
 * A4 1장 인쇄 리포트고, 브라우저에서 "PDF 로 저장"이 된다. 문구도 그 화면이
 * 실제로 하는 일에 맞췄다.
 */

import Link from 'next/link'
import { MessageCircle, FileText } from 'lucide-react'
import type { MagazinePalette } from './palette'
import { Reveal } from './primitives'

interface CTAStackProps {
  p: MagazinePalette
  /** 제품 문의 CTA 경로 — 앱의 1:1 상담(/chat). (웹 /contact 는 2026-09-05
   *  기각 — 앱 전용 화면에서 웹 문의로 빠지는 동선이었다.) */
  consultHref: string
  /** 결과 저장 CTA 경로 — 수의사 리포트(/dogs/[id]/vet-report). 필수다:
   *  optional 로 두면 안 넘겨도 컴파일이 통과해 또 죽은 버튼이 된다. */
  reportHref: string
}

export function CTAStack({ p, consultHref, reportHref }: CTAStackProps) {
  return (
    <Reveal delay={60}>
      <div
        style={{
          padding: '18px 18px 22px',
          display: 'flex',
          gap: 10,
        }}
      >
        <SecondaryBtn
          p={p}
          href={consultHref}
          icon={<MessageCircle size={18} color={p.ink2} strokeWidth={1.8} />}
          label="제품 문의"
          sub="궁금한 점 물어보기"
        />
        <SecondaryBtn
          p={p}
          href={reportHref}
          icon={<FileText size={18} color={p.ink2} strokeWidth={1.8} />}
          label="결과 저장"
          sub="수의사용 리포트"
        />
      </div>
    </Reveal>
  )
}

function SecondaryBtn({
  p,
  href,
  icon,
  label,
  sub,
}: {
  p: MagazinePalette
  href: string
  icon: React.ReactNode
  label: string
  sub: string
}) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        background: p.card,
        color: p.ink,
        border: `1px solid ${p.line}aa`,
        borderRadius: 8,
        padding: '14px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        textAlign: 'left',
        textDecoration: 'none',
      }}
    >
      {icon}
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: p.muted, fontWeight: 500 }}>{sub}</div>
    </Link>
  )
}
