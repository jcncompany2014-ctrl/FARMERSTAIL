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
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08): 2칸 네모 타일(1px 회색 선) — 아이콘 20 + 굵은 이름 16 + 회색 한 줄.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { V3 } from '@/lib/design/tokens'

interface CTAStackProps {
  /** 제품 문의 CTA 경로 — 앱의 1:1 상담(/chat). (웹 /contact 는 2026-09-05
   *  기각 — 앱 전용 화면에서 웹 문의로 빠지는 동선이었다.) */
  consultHref: string
  /** 결과 저장 CTA 경로 — 수의사 리포트(/dogs/[id]/vet-report). 필수다:
   *  optional 로 두면 안 넘겨도 컴파일이 통과해 또 죽은 버튼이 된다. */
  reportHref: string
}

export function CTAStack({ consultHref, reportHref }: CTAStackProps) {
  return (
    <div
      style={{
        margin: '14px 20px 0',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
      }}
    >
      <Tile
        href={consultHref}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5z" />
          </svg>
        }
        label="제품 문의"
        sub="궁금한 점 물어보기"
      />
      <Tile
        href={reportHref}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M14 3v4h4M9 12h6M9 16h6" />
          </svg>
        }
        label="결과 저장"
        sub="수의사용 리포트"
      />
    </div>
  )
}

function Tile({ href, icon, label, sub }: { href: string; icon: ReactNode; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="transition active:scale-[0.98]"
      style={{
        minHeight: 84,
        padding: 14,
        boxSizing: 'border-box',
        border: `1px solid ${V3.rule}`,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        color: V3.ink,
        textDecoration: 'none',
      }}
    >
      {icon}
      <span style={{ fontSize: 16, fontWeight: 800 }}>{label}</span>
      <span style={{ fontSize: 14, color: V3.inkMute }}>{sub}</span>
    </Link>
  )
}
