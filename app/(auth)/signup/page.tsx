import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import { isAppContextServer } from '@/lib/app-context'
import { safeNextPath } from '@/lib/auth/safe-next'

export const metadata: Metadata = { title: '회원가입' }

/**
 * /signup — 웹 회원가입(웹 시안 WEB-A11, 2026-10-10 웹 리뉴얼). 웹 가게는 회원만 산다 — 카카오로 1초 가입.
 *
 * 따로 적는 칸이 없다: 카카오 화면에서 동의만 누르면 끝나고 보던 화면(?next=)으로 돌아온다. 가입은 소셜 로그인과 같은
 * 길(허브 /start/claim — 프로모션 박기·설문 초안 이관을 마친 뒤 ?to= 로)이고, 웹은 강아지(설문) 없이도 그대로 간다.
 * 애플도 둔다(규칙108 — 카카오가 있는 가입 화면엔 애플도). 카카오에서 받는 정보 = 이름·출생 연도(전화번호는 동의항목에서
 * 뺐다 — 주문할 때 배송지와 함께 적는다, app/auth/callback). 만 14세 확인 = 카카오 간편가입 필수 동의.
 * 앱은 가입이 설문·로그인 화면에 있으므로 로그인으로 보낸다.
 */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const to = safeNextPath(next ?? null)
  if (await isAppContextServer()) redirect(to ? `/login?next=${encodeURIComponent(to)}` : '/login')
  // 가입 뒤 갈 곳 — 보던 화면, 없으면 가게(처음 온 회원은 레시피부터 고른다).
  const socialNext = `/start/claim?to=${encodeURIComponent(to ?? '/store')}`
  const loginHref = to ? `/login?next=${encodeURIComponent(to)}` : '/login'
  return (
    <StoreShell>
      <section style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h1 className="d" style={{ margin: 0, fontSize: 44, lineHeight: 1.08 }}>
          카카오로
          <br />
          1초 가입
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>
          따로 적을 건 없어요. 카카오 화면에서 동의만 누르면 끝나요.
        </p>

        <ol style={{ margin: '26px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          <Step n={1}>
            <strong style={{ fontWeight: 800 }}>카카오로 가입하기</strong>를 눌러요
          </Step>
          <Step n={2}>
            카카오 화면에서 <strong style={{ fontWeight: 800 }}>동의하고 계속하기</strong>를 눌러요
          </Step>
          <Step n={3}>
            보던 화면으로 <strong style={{ fontWeight: 800 }}>그대로 돌아와요</strong>
          </Step>
        </ol>

        <div style={{ marginTop: 24 }}>
          <KakaoLoginButton variant="signup" next={socialNext} look="app" label="카카오로 가입하기" />
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.5, color: '#3D3D3D', textAlign: 'center' }}>만 14세 이상만 가입할 수 있어요</p>
        <div style={{ marginTop: 14 }}>
          <AppleLoginButton variant="signup" next={socialNext} look="app" />
        </div>
      </section>

      <section
        aria-labelledby="signup-after"
        style={{ margin: '36px 20px 0', padding: '22px 18px 20px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}
      >
        <h2 id="signup-after" className="d" style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>
          가입하면
        </h2>
        <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Benefit>주문과 배송을 한눈에 볼 수 있어요</Benefit>
          <Benefit>배송지를 저장해 두면 다음 주문 때 알아서 채워져요</Benefit>
          <Benefit>
            앱에 같은 카카오 계정으로 로그인하면 <strong style={{ fontWeight: 800 }}>웹에서 산 주문이 그대로</strong> 보여요
          </Benefit>
        </ul>
      </section>

      <section aria-labelledby="signup-info" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="signup-info" style={{ margin: 0, fontFamily: 'inherit', fontSize: 18, fontWeight: 800, letterSpacing: 'inherit' }}>
          카카오에서 받는 정보
        </h2>
        <dl style={{ margin: '12px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column', fontSize: 17 }}>
          <div style={{ minHeight: 56, display: 'grid', gridTemplateColumns: '96px 1fr', alignItems: 'center', borderBottom: '1px solid #E5E5E5' }}>
            <dt style={{ fontSize: 16, color: '#595959' }}>받아요</dt>
            <dd style={{ margin: 0, fontWeight: 800 }}>이름 · 출생 연도</dd>
          </div>
          <div style={{ minHeight: 56, padding: '8px 0', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '96px 1fr', alignItems: 'center', borderBottom: '1px solid #E5E5E5' }}>
            <dt style={{ fontSize: 16, color: '#595959' }}>안 받아요</dt>
            <dd style={{ margin: 0, lineHeight: 1.5 }}>전화번호 — 주문할 때 배송지와 함께 적어요</dd>
          </div>
        </dl>
        <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.6, color: '#595959' }}>
          가입하면{' '}
          <Link href="/legal/terms" style={{ color: '#141414', fontWeight: 700 }}>
            이용약관
          </Link>
          과{' '}
          <Link href="/legal/privacy" style={{ color: '#141414', fontWeight: 700 }}>
            개인정보처리방침
          </Link>
          에 동의하게 돼요.
        </p>
      </section>

      <p style={{ margin: '28px 20px 56px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, color: '#595959' }}>
        이미 회원이세요?
        <Link
          href={loginHref}
          style={{ minHeight: 48, padding: '0 4px', display: 'flex', alignItems: 'center', fontWeight: 800, color: '#141414', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          로그인
        </Link>
      </p>
    </StoreShell>
  )
}

/** 가입 순서 한 줄(시안 A11) — 32px 먹색 네모 숫자 + 문장. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li
      style={{
        minHeight: 64,
        boxSizing: 'border-box',
        padding: '12px 0',
        borderBottom: '1px solid #E5E5E5',
        display: 'grid',
        gridTemplateColumns: '36px 1fr',
        columnGap: 12,
        alignItems: 'center',
        fontSize: 17,
        lineHeight: 1.5,
      }}
    >
      <span className="d" aria-hidden style={{ width: 32, height: 32, background: '#141414', color: '#FFFFFF', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

/** '가입하면' 한 줄 — 먹색 체크 + 문장. */
function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '26px 1fr', columnGap: 10, alignItems: 'start', fontSize: 17, lineHeight: 1.55 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 2 }}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span>{children}</span>
    </li>
  )
}
