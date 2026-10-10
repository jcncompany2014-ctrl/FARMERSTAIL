import Link from 'next/link'
import { isAppContextServer } from '@/lib/app-context'
import StoreShell from '@/components/store/StoreShell'
import { AuthAppMain, AuthIconBox, AuthPrimaryLink, AuthResultPanel } from '@/components/v3/auth/AuthAppParts'

/**
 * 이메일 인증 결과 화면 — `/auth/confirmed` (성공) · `?error=expired|missing` (실패)
 *
 * `/auth/confirm` 라우트가 verifyOtp 처리 후 이리로 보낸다. 예전엔 인증 후
 * 홈으로 떨궈 아무 피드백이 없었다(사장님 지적). 앱에서 열리면 앱 화면(W11·W12),
 * 웹이면 새 웹 가게 틀(웹 시안 A08·A36, 2026-10-10 웹 리뉴얼).
 * 카피는 고객 문구 원칙(전문용어·영어 금지)대로.
 */
export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const failed = Boolean(error)

  // 앱 새 디자인('A 포스터', 2026-10-09 캔버스 W11·W12) — 앱에서 열리면(앱 링크) 앱 모양. 이모지(🎉⏰) 대신 아이콘
  //   (앱시안 결정 3번 '문구'). 웹(메일앱·브라우저에서 열림 — 대부분)은 아래 새 웹 판.
  if (await isAppContextServer()) {
    return (
      <AuthAppMain>
        <AuthResultPanel
          icon={
            failed ? (
              <AuthIconBox>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2M9.5 2.5h5" />
                </svg>
              </AuthIconBox>
            ) : (
              <AuthIconBox filled>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </AuthIconBox>
            )
          }
          title={
            failed ? (
              <>
                링크가 더 이상
                <br />
                유효하지 않아요
              </>
            ) : (
              <>
                이메일 인증이
                <br />
                완료됐어요!
              </>
            )
          }
          body={
            failed
              ? '인증 링크는 1시간 동안만 쓸 수 있어요. 로그인 화면에서 다시 받아 주세요.'
              : '이제 로그인해서 우리 아이의 식단을 시작할 수 있어요.'
          }
          action={<AuthPrimaryLink href="/login">로그인하기</AuthPrimaryLink>}
          // 시안의 "앱에서 가입하셨다면 앱으로 돌아가 로그인해 주세요."는 뺐다 — 이 갈래는 이미 앱 안이다.
        />
      </AuthAppMain>
    )
  }

  // 웹 = 웹 시안 WEB-A08(완료)·A36(만료), 2026-10-10 웹 리뉴얼 — 새 웹 가게 틀, 이모지 대신 네모 아이콘.
  //   메일앱·브라우저에서 열리는 경우가 대부분이라 '앱에서 가입하셨다면…' 안내를 둔다. 예전 웹 판(가운데 카드)은 git 이력.
  return (
    <StoreShell>
      <section style={{ padding: '44px 20px 72px', display: 'flex', flexDirection: 'column' }}>
        {failed ? (
          <span aria-hidden style={{ width: 72, height: 72, boxSizing: 'border-box', border: '2.5px solid #B3261E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#B3261E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
          </span>
        ) : (
          <span aria-hidden style={{ width: 72, height: 72, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        )}
        <h1 className="d" style={{ margin: '24px 0 0', fontSize: failed ? 38 : 40, lineHeight: failed ? 1.15 : 1.12 }}>
          {failed ? (
            <>
              링크가 더 이상
              <br />
              유효하지 않아요
            </>
          ) : (
            <>
              이메일 인증이
              <br />
              완료됐어요!
            </>
          )}
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>
          {failed ? (
            '인증 링크는 1시간 동안만 쓸 수 있어요. 로그인 화면에서 다시 받아 주세요.'
          ) : (
            <>
              이제 로그인해서
              <br />
              우리 아이의 식단을 시작할 수 있어요.
            </>
          )}
        </p>
        <Link
          href="/login"
          style={{
            marginTop: 30,
            height: 58,
            borderRadius: 4,
            background: '#141414',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          로그인하기
        </Link>
        <p style={{ margin: '16px 0 0', fontSize: 16, lineHeight: 1.55, color: '#595959', textAlign: 'center' }}>앱에서 가입하셨다면 앱으로 돌아가 로그인해 주세요.</p>
      </section>
    </StoreShell>
  )
}
