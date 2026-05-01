import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Database,
  Download,
  FileText,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { business } from '@/lib/business'

export const metadata: Metadata = {
  title: '내 데이터 (개인정보 열람권)',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * /mypage/privacy
 *
 * 개인정보보호법 제35조 (열람권) + 제36조 (정정·삭제) + 제37조 (처리정지) 명시.
 *
 * 화면 구성:
 *   1) "내 데이터 한눈에" — 카테고리별 row count (보유 항목 가시화)
 *   2) "JSON 다운로드" — /api/privacy/export 트리거
 *   3) "수정·삭제" — profile / addresses / dogs 등 편집 페이지로 직링크
 *   4) "처리정지·탈퇴" — /mypage/delete 안내
 *   5) "DPO 연락처" — 직접 문의가 필요할 때
 */
export default async function PrivacyDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/privacy')

  // 카테고리별 row count — head:true 로 데이터 fetch 없이 카운트만.
  const counts = await Promise.all(
    [
      ['dogs', 'dogs'],
      ['surveys', 'surveys'],
      ['analyses', 'analyses'],
      ['weight_logs', 'weight_logs'],
      ['health_logs', 'health_logs'],
      ['dog_reminders', 'dog_reminders'],
      ['addresses', 'addresses'],
      ['orders', 'orders'],
      ['subscriptions', 'subscriptions'],
      ['reviews', 'reviews'],
      ['wishlists', 'wishlists'],
      ['point_ledger', 'point_ledger'],
      ['consent_log', 'consent_log'],
    ].map(async ([table, label]) => {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      return { label, count: count ?? 0 }
    }),
  )

  const totalRows = counts.reduce((s, c) => s + c.count, 0)

  return (
    <main className="px-5 pb-24 pt-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-3.5 h-3.5 text-terracotta" strokeWidth={2} />
        <span className="kicker">Privacy · 내 정보</span>
      </div>
      <h1
        className="font-serif text-[24px] mt-1.5"
        style={{
          color: 'var(--ink)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}
      >
        내 데이터 한눈에
      </h1>
      <p
        className="text-[12.5px] mt-2 leading-relaxed"
        style={{ color: 'var(--muted)' }}
      >
        개인정보보호법 제35조에 따라 회원님의 개인정보 처리 현황을 열람·다운로드·
        정정·삭제하실 수 있어요.
      </p>

      {/* 보유 항목 카운트 */}
      <section className="mt-6 bg-white rounded-2xl border border-rule p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-3.5 h-3.5 text-text" strokeWidth={2} />
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted">
            보유 항목 ({totalRows.toLocaleString()}건)
          </h2>
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
          {counts.map((c) => (
            <li
              key={c.label}
              className="flex items-baseline justify-between text-[12px]"
            >
              <span className="text-text">{TABLE_LABEL[c.label] ?? c.label}</span>
              <span className="font-mono text-muted tabular-nums">
                {c.count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* JSON 다운로드 */}
      <section className="mt-4 bg-white rounded-2xl border border-rule p-5">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-3.5 h-3.5 text-text" strokeWidth={2} />
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted">
            전체 데이터 다운로드
          </h2>
        </div>
        <p
          className="text-[12px] leading-relaxed mb-4"
          style={{ color: 'var(--text)' }}
        >
          제 정보를 JSON 파일로 한 번에 다운로드할 수 있어요. 결제 토큰 등 보안
          민감 항목은 자동으로 제외돼요.
        </p>
        <a
          href="/api/privacy/export"
          download
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink text-white text-[12.5px] font-bold active:scale-[0.98] transition"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={2.5} />
          JSON 파일 받기
        </a>
        <p
          className="text-[10.5px] mt-3 leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          ※ 다운로드는 분당 1회로 제한돼요 (서버 보호).
        </p>
      </section>

      {/* 정정 · 삭제 — 정보 편집 직링크 */}
      <section className="mt-4 bg-white rounded-2xl border border-rule p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-3.5 h-3.5 text-text" strokeWidth={2} />
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted">
            정정·삭제 (제36조)
          </h2>
        </div>
        <ul className="space-y-2">
          {EDIT_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-bg hover:bg-bg-2 transition"
              >
                <span className="text-[12.5px] font-bold text-text">
                  {link.label}
                </span>
                <span className="text-[11px] text-muted">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 처리정지 / 탈퇴 */}
      <section className="mt-4 bg-white rounded-2xl border border-rule p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-sale" strokeWidth={2} />
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted">
            처리정지·탈퇴 (제37조)
          </h2>
        </div>
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: 'var(--text)' }}
        >
          모든 데이터 처리 중단 + 탈퇴는 한 번에 진행할 수 있어요. 전자상거래법
          제6조에 따라 거래 기록은 5년간 보관됨을 안내드려요.
        </p>
        <Link
          href="/mypage/delete"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-sale text-sale text-[12.5px] font-bold hover:bg-sale hover:text-white transition"
        >
          탈퇴 절차로 이동
        </Link>
      </section>

      {/* DPO */}
      <section className="mt-4 bg-bg-2 rounded-2xl p-5">
        <p
          className="text-[10.5px] uppercase tracking-widest font-bold mb-2"
          style={{ color: 'var(--muted)' }}
        >
          DPO · 개인정보 보호책임자
        </p>
        <p
          className="text-[12.5px] leading-relaxed"
          style={{ color: 'var(--text)' }}
        >
          {business.privacyOfficer} ·{' '}
          <a
            href={`mailto:${business.privacyOfficerEmail}`}
            className="font-bold underline underline-offset-2"
            style={{ color: 'var(--terracotta)' }}
          >
            {business.privacyOfficerEmail}
          </a>
          {business.phone ? ` · ${business.phone}` : ''}
        </p>
        <p
          className="text-[10.5px] mt-2 leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          위 화면에서 해결되지 않는 요청 (제3자 제공 내역, 가족 사망 시 처리,
          분쟁조정 등) 은 책임자에게 직접 연락해 주세요.
        </p>
      </section>
    </main>
  )
}

const TABLE_LABEL: Record<string, string> = {
  dogs: '반려견 프로필',
  surveys: '설문 응답',
  analyses: '영양 분석',
  weight_logs: '체중 기록',
  health_logs: '건강 기록',
  dog_reminders: '리마인더',
  addresses: '저장된 주소',
  orders: '주문 내역',
  subscriptions: '정기배송',
  reviews: '작성한 리뷰',
  wishlists: '위시리스트',
  point_ledger: '포인트 이력',
  consent_log: '마케팅 동의 이력',
}

const EDIT_LINKS = [
  { href: '/account/profile', label: '프로필 수정 (이름·전화·생일)' },
  { href: '/mypage/addresses', label: '저장된 배송지 관리' },
  { href: '/dogs', label: '반려견 정보 수정 / 삭제' },
  { href: '/mypage/consent', label: '마케팅 수신 동의 변경' },
  { href: '/mypage/notifications', label: '알림 설정 (푸시·이메일)' },
] as const
