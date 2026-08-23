import Link from 'next/link'

/**
 * 이메일 인증 결과 화면 — `/auth/confirmed` (성공) · `?error=expired|missing` (실패)
 *
 * `/auth/confirm` 라우트가 verifyOtp 처리 후 이리로 보낸다. 예전엔 인증 후
 * 홈으로 떨궈 아무 피드백이 없었다(사장님 지적). 웹·앱 어느 브라우저에서
 * 열려도 되는 독립 화면이라 chrome 없이 가운데 카드 하나만 그린다.
 * 카피는 고객 문구 원칙(전문용어·영어 금지)대로.
 */
export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const failed = Boolean(error)

  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center px-5"
      style={{ background: '#FAF9F5' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white px-7 py-10 text-center"
        style={{ border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}
      >
        <div className="text-[44px] leading-none mb-4" aria-hidden>
          {failed ? '⏰' : '🎉'}
        </div>
        <h1
          className="text-[22px] font-bold mb-2"
          style={{ color: '#1E1A14', letterSpacing: '-0.02em' }}
        >
          {failed ? '링크가 더 이상 유효하지 않아요' : '이메일 인증이 완료됐어요!'}
        </h1>
        <p
          className="text-[14px] leading-relaxed mb-8"
          style={{ color: '#6B6353' }}
        >
          {failed
            ? '인증 링크는 1시간 동안만 쓸 수 있어요. 로그인 화면에서 다시 받아 주세요.'
            : '이제 로그인해서 우리 아이의 식단을 시작할 수 있어요.'}
        </p>
        <Link
          href="/login"
          className="inline-block w-full py-3.5 rounded-full text-[14px] font-bold text-white active:translate-y-[1px] transition"
          style={{ background: '#1E1A14' }}
        >
          로그인하기
        </Link>
        <p className="mt-4 text-[12px]" style={{ color: '#9A9282' }}>
          앱에서 가입하셨다면 앱으로 돌아가 로그인해 주세요.
        </p>
      </div>
    </main>
  )
}
