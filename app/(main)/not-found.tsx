import Link from 'next/link'

/**
 * 앱(AppChrome) 안에서의 404.
 *
 * # 왜 따로 필요한가 (2026-08-07 예외 UX 감사)
 * 이 파일이 없으면 `(main)` 안에서 `notFound()` 가 루트 `app/not-found.tsx` 로
 * 떨어진다. 그러면 두 가지가 동시에 깨진다:
 *   ① `(main)/layout.tsx` 의 AppChrome 이 **통째로 사라진다** — 앱을 쓰던
 *      사람에게 갑자기 웹 톤 화면이 뜬다(웹/앱 분리 규칙 위반).
 *   ② 그 화면의 CTA 가 **"2분 설문 시작하기 → /start"** 다. /start 는
 *      **비로그인 설문→가입** 퍼널이라, 로그인한 구독자에게 가입을 권하는
 *      셈이 된다. mypage/orders 가 주석으로 "★로그인 상태라 /start 금지"라고
 *      못 박아 둔 바로 그 실수다.
 *
 * 여기서는 앱 사용자가 실제로 갈 만한 곳만 준다.
 */
export default function AppNotFound() {
  return (
    <div className="px-5 py-16 text-center">
      <p className="kicker" style={{ color: 'var(--muted)' }}>
        404
      </p>
      <h1
        className="mt-2 font-sans"
        style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}
      >
        화면을 찾지 못했어요
      </h1>
      <p className="mt-2 text-[13.5px] text-muted leading-relaxed">
        주소가 바뀌었거나, 삭제된 기록일 수 있어요.
      </p>

      <div className="mt-6 flex flex-col items-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded px-5 py-3 text-[13.5px] font-bold text-white"
          style={{ background: 'var(--terracotta)' }}
        >
          홈으로 가기
        </Link>
        <Link
          href="/dogs"
          className="text-[12px] font-bold text-muted underline underline-offset-4"
        >
          우리 아이 목록 보기
        </Link>
      </div>
    </div>
  )
}
