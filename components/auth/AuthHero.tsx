import Link from 'next/link'

/**
 * Shared hero block for auth screens (/login, /signup, 추후 /password-reset 등).
 *
 * Why this exists:
 *   온보딩 carousel은 editorial tone(세리프 헤드라인, 여백, kicker)로 끝난다.
 *   그런데 이후 뜨는 로그인/회원가입이 앱 폼 언어로 뚝 끊기면 사용자 입장에선
 *   갑자기 다른 브랜드로 넘어간 것처럼 느껴진다. Hero 영역만이라도 landing /
 *   onboarding과 같은 조판 언어로 맞춰서 전환을 부드럽게 한다.
 *
 *   폼 입력/버튼/체크박스는 기능성을 지키기 위해 기존 sans UI를 유지한다 —
 *   "웹은 웹답게, 앱은 앱답게"의 연장선에서 hero만 에디토리얼, form은 앱.
 *
 *   모든 헤더 타이포는 한 폰트(serif)로 고정, 변화는 italic / weight / color.
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
          src="/logo.png"
          alt="Farmer's Tail"
          className="h-9 md:h-11 w-auto block"
          style={{ filter: 'brightness(0)' }}
        />
      </Link>

      <span className="kicker">{kicker}</span>

      <h1
        className="font-serif mt-2.5 md:mt-3.5 text-[24px] md:text-[34px] lg:text-[40px]"
        style={{
          lineHeight: 1.15,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.025em',
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <p
          className="mt-2.5 md:mt-3.5 text-[13px] md:text-[15px]"
          style={{
            lineHeight: 1.6,
            color: 'var(--muted)',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
