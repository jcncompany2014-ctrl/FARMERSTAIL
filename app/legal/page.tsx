import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, RotateCcw, Shield, Building, HelpCircle, Mail } from 'lucide-react'
import AuthAwareShell from '@/components/AuthAwareShell'
import SiteShell from '@/components/store/SiteShell'
import { isAppContextServer } from '@/lib/app-context'
import { V3 } from '@/lib/design/tokens'
import { SCREEN_ROOT } from '@/components/v3/me/MeParts'
import {
  BuildingIcon,
  MailIcon,
  QuestionIcon,
  RefundIcon,
  ShieldIcon,
  TermsIcon,
} from '@/components/v3/me/MeIcons'

/**
 * /legal — 약관·정책 hub.
 *
 * 마이페이지 footer 의 4개 텍스트 링크 (환불/이용약관/개인정보/사업자) 를 한
 * 페이지에 묶어 시각 무게 ↓. 각 항목은 sub-route 로 분기 (/legal/refund 등) —
 * SEO 정합 유지.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M21): 앱이면 위 2px 먹선 목록(줄 높이 76 · 선 그림 22 · 꺾쇠)으로 그린다.
 * 영어 머리말("Legal · 정책")과 화면 안 제목은 앱에서 뺐다 — 윗줄이 화면 이름을 말한다. 웹 마크업은 그대로.
 */

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차152).
  title: '약관 · 정책',
  description: '이용약관 · 개인정보처리방침 · 환불 정책 · 사업자 정보 · 자주 묻는 질문 · 문의하기',
  alternates: { canonical: '/legal' },
  robots: { index: true, follow: true },
}

const ITEMS = [
  {
    href: '/faq',
    Icon: HelpCircle,
    label: '자주 묻는 질문',
    desc: '식단 · 배송 · 결제 · 정기배송',
  },
  {
    href: '/help',
    Icon: Mail,
    label: '문의하기',
    desc: '고객센터 · 앱은 카카오톡, 웹은 문의 폼',
  },
  {
    href: '/legal/terms',
    Icon: FileText,
    label: '이용약관',
    desc: '서비스 이용 시 적용되는 약관',
  },
  {
    href: '/legal/privacy',
    Icon: Shield,
    label: '개인정보처리방침',
    desc: '개인정보 수집 · 이용 · 보호',
  },
  {
    href: '/legal/refund',
    Icon: RotateCcw,
    label: '환불 정책',
    desc: '환불·반품·교환 기준',
  },
  {
    href: '/business',
    Icon: Building,
    label: '사업자 정보',
    desc: '상호 · 사업자번호 · 통신판매업 신고',
  },
] as const

/** 앱 목록 — 같은 목적지, 시안 M21 의 그림·설명. */
const APP_ITEMS = [
  { href: '/faq', Icon: QuestionIcon, label: '자주 묻는 질문', desc: '식단 · 배송 · 결제 · 정기배송' },
  { href: '/help', Icon: MailIcon, label: '문의하기', desc: '고객센터 · 카카오톡' },
  { href: '/legal/terms', Icon: TermsIcon, label: '이용약관', desc: '서비스를 이용할 때 적용되는 약관' },
  { href: '/legal/privacy', Icon: ShieldIcon, label: '개인정보처리방침', desc: '개인정보 수집 · 이용 · 보호' },
  { href: '/legal/refund', Icon: RefundIcon, label: '환불 정책', desc: '환불·반품·교환 기준' },
  { href: '/business', Icon: BuildingIcon, label: '사업자 정보', desc: '상호 · 사업자번호 · 통신판매업 신고' },
] as const

export default async function LegalHubPage() {
  if (await isAppContextServer()) {
    return (
      <AuthAwareShell>
        <main style={SCREEN_ROOT}>
          <p style={{ margin: '20px 20px 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
            전자상거래법·개인정보보호법·정보통신망법에 따라 꼭 알려 드려야 하는 내용이에요.
          </p>
          <nav
            aria-label="약관과 정책"
            style={{ margin: '20px 20px 0', borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}
          >
            {APP_ITEMS.map(({ href, Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                style={{
                  minHeight: 76,
                  boxSizing: 'content-box',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr 14px',
                  columnGap: 14,
                  alignItems: 'center',
                  color: V3.ink,
                  textDecoration: 'none',
                }}
              >
                <Icon size={22} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>{label}</span>
                  <span style={{ fontSize: 15, color: V3.inkMute }}>{desc}</span>
                </span>
                <span aria-hidden style={{ fontSize: 20 }}>
                  ›
                </span>
              </Link>
            ))}
          </nav>
        </main>
      </AuthAwareShell>
    )
  }

  // 웹 — 2026-10-10 웹 리뉴얼('A 포스터' 웹): 새 웹 가게 틀 + 영어 머리말 없음.
  return (
    <SiteShell>
      <main style={{ padding: '28px 20px 64px' }}>
        <h1 className="d" style={{ margin: 0, fontSize: 34, lineHeight: 1.1 }}>
          약관 · 정책
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>
          전자상거래법·개인정보보호법·정보통신망법에 따라 꼭 알려 드려야 하는 내용이에요.
        </p>
        <nav aria-label="약관과 정책" style={{ marginTop: 20, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          {ITEMS.map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              style={{ minHeight: 76, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: '#141414', textDecoration: 'none' }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{label}</span>
                <span style={{ fontSize: 15, color: '#595959' }}>{desc}</span>
              </span>
              <span aria-hidden style={{ fontSize: 22 }}>
                ›
              </span>
            </Link>
          ))}
        </nav>
      </main>
    </SiteShell>
  )
}
