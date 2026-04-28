import type { Metadata } from 'next'
import Link from 'next/link'
import { Smartphone, ArrowRight, Heart, Bell, BookOpen } from 'lucide-react'

export const metadata: Metadata = {
  title: '앱에서 사용 가능한 기능이에요',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ from?: string }>

/**
 * /app-required — 웹 사용자가 앱 전용 경로 (예: /dashboard, /dogs, /mypage/*)
 * 로 직접 진입했을 때 보이는 다운로드 유도 페이지.
 *
 * Middleware 가 ft_app 쿠키 없는 요청을 여기로 redirect 한다. `?from` 쿼리에
 * 원래 가려던 경로가 들어옴 — Universal Links / App Links 가 설정된 후엔 앱
 * 설치 + 첫 실행 시 이 경로로 deep-link 가능.
 *
 * 디자인: 마케팅 + 마켓컬리 톤. 강한 다운로드 CTA + 앱이 무엇을 주는지 짧게.
 */
export default async function AppRequiredPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { from } = await searchParams
  const fromLabel = from ? friendlyLabel(from) : null

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16 md:py-24"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-md md:max-w-2xl w-full text-center">
        {/* 큰 아이콘 */}
        <div
          className="w-20 h-20 md:w-28 md:h-28 mx-auto rounded-3xl flex items-center justify-center mb-6 md:mb-9"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
          }}
        >
          <Smartphone className="w-9 h-9 md:w-12 md:h-12" strokeWidth={1.75} />
        </div>

        {/* kicker */}
        <div
          className="text-[10px] md:text-[12px]"
          style={{
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--terracotta)',
          }}
        >
          App Only · 앱 전용 기능
        </div>

        {/* 헤드라인 */}
        <h1
          className="font-serif mt-3 md:mt-5 leading-tight text-[28px] md:text-[44px] lg:text-[52px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
          }}
        >
          {fromLabel
            ? `${fromLabel}은(는)`
            : '이 기능은'}
          <br />
          <span
            className="italic"
            style={{ color: 'var(--terracotta)', fontWeight: 700 }}
          >
            앱에서 사용 가능해요
          </span>
        </h1>

        <p
          className="mt-4 md:mt-6 leading-relaxed text-[13px] md:text-[16px] max-w-xl mx-auto"
          style={{
            color: 'var(--text)',
          }}
        >
          정기배송 관리 · 강아지 케어 기록 · 컨디션 분석 같은 도구는
          <br className="hidden md:block" />
          {' '}파머스테일 앱에서만 제공돼요.
        </p>

        {/* 기능 미리보기 */}
        <ul
          className="mt-8 md:mt-12 space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0 text-left"
          style={{ color: 'var(--text)' }}
        >
          <Feature
            Icon={Heart}
            title="우리 아이 케어 기록"
            desc="식사·활동·체중을 한 번 입력하면 변화 그래프로 보여드려요."
          />
          <Feature
            Icon={Bell}
            title="배송일 자동 알림"
            desc="다음 정기배송이 출발하기 전에 알려드려요."
          />
          <Feature
            Icon={BookOpen}
            title="우리 아이 맞춤 매거진"
            desc="품종·연령에 맞는 영양 정보를 정기적으로 큐레이션."
          />
        </ul>

        {/* 다운로드 배지 (실제 스토어 링크는 출시 후 채움) */}
        <div className="mt-10 md:mt-14 flex flex-col md:flex-row gap-3 md:gap-4 md:max-w-md md:mx-auto">
          <a
            href="https://apps.apple.com/app/farmerstail"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3.5 md:py-4 rounded-2xl text-[14px] md:text-[15px] font-bold active:scale-[0.98] transition"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              letterSpacing: '-0.01em',
            }}
          >
            App Store 에서 받기
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.farmerstail.app"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3.5 md:py-4 rounded-2xl text-[14px] md:text-[15px] font-bold border active:scale-[0.98] transition"
            style={{
              background: 'var(--bg)',
              color: 'var(--ink)',
              borderColor: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            Google Play 에서 받기
          </a>
        </div>

        {/* 웹으로 계속 — 마케팅 / 정보 페이지로 회귀 */}
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:underline"
          style={{ color: 'var(--muted)' }}
        >
          웹에서 제품 둘러보기
          <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
        </Link>
      </div>
    </main>
  )
}

function Feature({
  Icon,
  title,
  desc,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  desc: string
}) {
  return (
    <li className="flex items-start gap-3 md:flex-col md:gap-3 md:p-5 md:rounded-2xl md:border md:border-rule md:bg-bg-2 md:text-center md:items-center">
      <div
        className="w-9 h-9 md:w-12 md:h-12 shrink-0 rounded-xl flex items-center justify-center mt-0.5"
        style={{
          background: 'var(--bg-2)',
          color: 'var(--terracotta)',
        }}
      >
        <Icon className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />
      </div>
      <div className="flex-1 md:flex-none">
        <div
          className="font-bold text-[13px] md:text-[15px]"
          style={{ color: 'var(--ink)' }}
        >
          {title}
        </div>
        <div
          className="mt-1 md:mt-1.5 leading-relaxed text-[11.5px] md:text-[12.5px]"
          style={{ color: 'var(--muted)' }}
        >
          {desc}
        </div>
      </div>
    </li>
  )
}

/**
 * `/dashboard` 같은 기술 경로를 사용자에게 보여줄 라벨로 변환.
 * 변환 못 하는 경로면 null 반환 → 일반 카피로 폴백.
 */
function friendlyLabel(path: string): string | null {
  const clean = path.split('?')[0]
  if (clean === '/dashboard') return '홈 대시보드'
  if (clean.startsWith('/dogs')) return '강아지 정보'
  if (clean === '/welcome') return '앱 시작 화면'
  if (clean.startsWith('/mypage/subscriptions')) return '정기배송 관리'
  if (clean.startsWith('/mypage/addresses')) return '배송지 관리'
  if (clean.startsWith('/mypage/reviews')) return '리뷰 관리'
  if (clean.startsWith('/mypage/points')) return '적립금 관리'
  if (clean.startsWith('/mypage/coupons')) return '쿠폰 관리'
  if (clean.startsWith('/mypage/wishlist')) return '찜 목록'
  if (clean.startsWith('/mypage/notifications')) return '알림 설정'
  if (clean.startsWith('/mypage/consent')) return '동의 설정'
  if (clean.startsWith('/mypage/delete')) return '회원 탈퇴'
  if (clean.startsWith('/mypage/referral')) return '친구 초대'
  return null
}
