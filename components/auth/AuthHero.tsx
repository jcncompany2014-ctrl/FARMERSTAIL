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
    <div className="text-center mb-8">
      {/* Landing / onboarding과 동일한 logo.png를 쓴다 —
          예전처럼 rounded-square PNG 아이콘이 아니라 serif script mark.
          flex + justify-center 로 항상 컨테이너 중앙에 딱 맞게 놓는다. */}
      <Link
        href="/"
        aria-label="파머스테일 홈"
        className="flex justify-center mb-6"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Farmer's Tail"
          className="h-11 w-auto block"
          style={{ filter: 'brightness(0)' }}
        />
      </Link>

      <span className="kicker">{kicker}</span>

      <h1
        className="font-serif"
        style={{
          fontSize: 24,
          lineHeight: 1.2,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
          marginTop: 10,
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--muted)',
            marginTop: 10,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
