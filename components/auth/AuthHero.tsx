import Link from 'next/link'

/**
 * Shared hero block for 보조 인증 화면 — 현재 /forgot-password · /reset-password.
 * (회차17 FD 마이그레이션 + 회차131 docstring 정정.)
 *
 * Why this exists:
 *   비밀번호 찾기/재설정 같은 트랜잭션성 인증 화면을 중앙 정렬 단일 컬럼 hero
 *   로 통일해, 두 페이지가 서로 일관된 FD 언어를 갖게 한다. (주 진입점인
 *   /login·/signup 은 별도로 2단 split 브랜드 패널을 인라인으로 갖는다 — 회차129.
 *   AuthHero 를 브랜드 패널로 승격하는 대신, 두 tier 를 의도적으로 구분: 주
 *   진입=브랜드 패널, 보조 트랜잭션=집중형 중앙 hero.)
 *
 *   타이포는 FD 디자인시스템: kicker=eyebrow(--fd-green, mono-uppercase),
 *   헤드라인=Pretendard 헤비 --fd-pine(세리프 아님), subtitle=--fd-muted.
 *   옛 v4 토큰 0. 폼 입력/버튼은 각 페이지가 FD 토큰으로 직접 렌더.
 */
export default function AuthHero({
  kicker,
  title,
  subtitle,
}: {
  kicker: string
  /** React node로 받아서 `<strong>` 같은 인라인 강조를 허용한다. */
  title: React.ReactNode
  subtitle?: React.ReactNode
}) {
  return (
    <div className="text-center mb-8 md:mb-10">
      {/*
        로고 — landing/onboarding 와 같은 logo.png, brightness(0) 블랙.
        모바일은 h-9(36px) — 좁은 max-w-sm 컬럼에서 form 과 위계 균형.
        데스크톱은 h-11(44px) — 페이지 전체 캔버스가 넓어지므로 한 tier 업.
      */}
      <Link
        href="/"
        aria-label="파머스테일 홈"
        className="flex justify-center mb-5 md:mb-6"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-brush.png"
          alt="Farmer's Tail"
          className="h-10 md:h-12 w-auto block"
          // 로그인/회원가입 페이지의 LCP 후보 — 로고 외 큰 시각 요소 없음.
          fetchPriority="high"
          style={{ filter: 'none' }}
        />
      </Link>

      {/* 회차17 FD: eyebrow 그린, 헤드라인 Pretendard 헤비 파인(serif 제거). */}
      <span style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fd-green)' }}>{kicker}</span>

      <h1
        className="mt-2.5 md:mt-3.5 text-[26px] md:text-[36px] lg:text-[42px]"
        style={{
          lineHeight: 1.12,
          fontWeight: 900,
          color: 'var(--fd-pine)',
          letterSpacing: '-0.03em',
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <p
          className="mt-2.5 md:mt-3.5 text-[13px] md:text-[15px]"
          style={{
            lineHeight: 1.6,
            color: 'var(--fd-muted)',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
