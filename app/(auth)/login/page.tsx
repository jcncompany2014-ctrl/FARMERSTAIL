'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import { useIsAppContext } from '@/hooks/useIsAppContext'
import {
  applySignupProfile,
  normalizeSignupMeta,
} from '@/lib/auth/applySignupProfile'
import { applyAutosignupDraft } from '@/lib/auth/applyAutosignupDraft'
import { createDogFromDraft } from '@/lib/auth/createDogFromDraft'
import { claimPromotionOnSignup } from '@/lib/auth/claimPromotionOnSignup'
import { isFreshAccount, surveyStartHref } from '@/lib/survey/welcome'
import {
  loadAutosignupDraft,
  isDogDraftComplete,
  clearAutosignupDraft,
} from '@/lib/autosignup-draft'
import { trackSignUp } from '@/lib/analytics'
import { safeNextPath } from '@/lib/auth/safe-next'
import { isEmailNotConfirmed } from '@/lib/auth/resend-confirmation'
import ResendConfirmationButton from '@/components/auth/ResendConfirmationButton'
import { useServerAppContext } from '@/components/app/ServerAppContext'
import { V3 } from '@/lib/design/tokens'
import StoreShell from '@/components/store/StoreShell'
import {
  AuthAppMain,
  AuthErrorBox,
  AuthInput,
  AuthNoticeBox,
  AuthOrDivider,
  AuthOutlineLink,
  AuthPasswordInput,
  AuthPrimaryButton,
} from '@/components/v3/auth/AuthAppParts'

/**
 * /login — 기존 계정 로그인.
 *
 * 모양: 앱 = 앱 새 디자인('A 포스터', 캔버스 W06·W22~W24) · 웹 = 웹 시안 WEB-A01(2026-10-10 웹 리뉴얼 — 새 웹 가게 틀에
 * 카카오(처음이면 1초 가입)·애플·이메일, 아래에 카카오 1초 가입 안내). 판정은 서버 레이아웃이 넘긴 값(첫 그림부터).
 *
 * 인증 로직은 보존(불변): soft-delete 가드 · Confirm-email 후 signup_profile
 * 복원(applySignupProfile) · app/web 분기(/dashboard vs /mypage/orders) ·
 * ?next= safe-redirect. ★웹은 강아지(설문) 없이도 그대로 들어간다(웹 = 회원만 사는 단품 가게, 2026-10-10) —
 * 강아지 없으면 설문으로 보내는 것은 앱만.
 */

/**
 * OAuth callback 에서 보낸 안정 에러 코드를 사용자용 한국어 카피로 변환.
 * 모르는 코드는 그대로 반환 — fallback (옛 링크 / 외부 직접 호출 등).
 *
 * SSOT: app/auth/callback/route.ts 의 코드 목록과 1:1 매핑.
 */
function humanizeAuthError(code: string): string {
  switch (code) {
    case 'oauth_provider_denied':
      return '로그인 동의가 취소됐어요. 다시 시도해 주세요.'
    case 'oauth_provider_error':
      return '소셜 로그인 제공자에서 문제가 발생했어요. 잠시 후 다시 시도해 주세요.'
    case 'oauth_missing_code':
      return '로그인 정보가 누락됐어요. 다시 로그인을 시도해 주세요.'
    case 'oauth_exchange_failed':
      return '로그인 세션을 만들지 못했어요. 페이지를 새로고침하고 다시 시도해 주세요.'
    case 'oauth_unexpected':
      return '예상하지 못한 문제가 있었어요. 잠시 후 다시 시도해 주세요.'
    case 'oauth_account_deleted':
      // R90-E H1 (D7): 탈퇴 처리된 계정 OAuth 로그인 시도.
      return '탈퇴 처리된 계정이에요. 새 계정으로 가입해 주세요.'
    default:
      // 옛 링크 호환을 위해 raw 메시지를 그대로. 단 너무 길면 잘라서.
      return code.length > 200 ? code.slice(0, 200) + '…' : code
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  /**
   * 소셜 로그인이 돌아갈 곳 — 허브(/start/claim)를 **통과시키되 목적지를 실어** 보낸다.
   *
   * ★2026-08-12 4라운드 감사: 카카오·애플 버튼이 next 를 '/start/claim' 으로
   *   **하드코딩**해 고객의 ?next= 를 버렸다. 보호 경로 40여 곳이
   *   `/login?next=...` 로 보내는데(금액변경 동의 화면·구독 관리 등), 소셜로
   *   로그인하면 원래 보던 화면으로 못 돌아갔다. 이메일 경로만 제대로 돌아갔다.
   *
   *   허브를 우회하면 안 된다 — /start/claim 이 프로모션 박기·설문 초안 이관·
   *   "설문 없이 가입 불가" 를 담당한다. 그래서 목적지를 to 로 넘겨 허브가
   *   제 일을 마친 뒤 그리로 보내게 한다.
   */
  const socialNext = (() => {
    const to = safeNextPath(searchParams.get('next'))
    return to ? `/start/claim?to=${encodeURIComponent(to)}` : '/start/claim'
  })()
  // app/web 분리 모델: 로그인 후 행선지가 다르다.
  //   • App (PWA / Capacitor) → /dashboard (케어 다이어리 home)
  //   • Web (브라우저)         → /mypage/orders (주문 확인 — 웹 접근 가능 surface)
  // useIsAppContext 가 SSR 시 null 이라도 OK — handleLogin 은 client 이벤트.
  const isApp = useIsAppContext()
  // 모양 판정(앱 새 디자인) — 서버가 첫 그림부터 넘긴 값. 위 isApp 은 로그인 뒤 갈 곳(동작)에만 쓴다.
  const appLook = useServerAppContext()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // Form-submission errors only — URL-driven errors are a derived value
  // below so we don't need a setState-in-effect round trip.
  const [formError, setFormError] = useState('')
  // 인증 전 계정으로 로그인 시도한 이메일 — 재발송 버튼의 대상.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('')

  // Derived from the URL. Deriving avoids the react-hooks/set-state-in-effect
  // lint rule and eliminates the flash where the banner renders empty, then
  // populates.
  //
  // OAuth callback (app/auth/callback/route.ts) 은 안정 에러 코드를 보낸다 —
  // 여기서 한국어 카피로 매핑. 알 수 없는 코드는 그대로 노출 (fallback) —
  // 옛날 링크/외부에서 들어온 직접 호출 케이스 대비.
  const urlErrorParam = searchParams.get('error')
  const rawUrlError = urlErrorParam ? decodeURIComponent(urlErrorParam) : ''
  const urlError = rawUrlError ? humanizeAuthError(rawUrlError) : ''
  const error = formError || urlError
  const justDeleted = searchParams.get('deleted') === '1'
  // R89-E (D7): /reset-password 에서 비밀번호 변경 후 redirect.
  const justReset = searchParams.get('reset') === '1'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      // 인증 전 계정은 비밀번호가 맞아도 막힌다 — "비밀번호가 틀렸다"로 보이면
      // 고객이 헤맨다(2026-09-10 실제 고객 9회 연속). 원인과 재발송을 보여준다.
      if (isEmailNotConfirmed(error)) {
        setUnconfirmedEmail(email.trim())
        setFormError('아직 이메일 인증 전이에요. 가입할 때 받은 메일의 인증 링크를 눌러 주세요. 메일이 안 보이면 아래에서 다시 받을 수 있어요.')
        return
      }
      setUnconfirmedEmail('')
      // ★연결 끊김·시도 초과를 '비밀번호 틀림'으로 말하지 않는다(2026-09-26 점검 7차) — 맞는
      //   비밀번호를 넣은 고객이 비밀번호를 의심하며 재설정까지 갔다.
      const st = (error as { status?: number }).status
      if (st === 429 || /rate|too many/i.test(error.message)) {
        setFormError('로그인 시도가 많아요. 잠시 후 다시 시도해 주세요.')
      } else if (error.name === 'AuthRetryableFetchError' || !st || st >= 500) {
        setFormError('연결이 불안정해요. 잠시 후 다시 시도해 주세요.')
      } else {
        setFormError('이메일 또는 비밀번호가 올바르지 않아요')
      }
      return
    }

    // R101-A: soft-delete 계정 가드. OAuth 콜백(app/auth/callback)은 deleted_at
    // 을 검사하는데 password 로그인엔 없어서, 운영자가 profiles.deleted_at 만 set
    // 한 (account_purge cron 이전) 계정이 이메일 로그인으로 통과했다. 동일 가드.
    const {
      data: { user: signedIn },
    } = await supabase.auth.getUser()
    if (signedIn) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('deleted_at')
        .eq('id', signedIn.id)
        .maybeSingle()
      if (profile?.deleted_at) {
        await supabase.auth.signOut()
        setLoading(false)
        setFormError(
          '탈퇴 처리된 계정이에요. 도움이 필요하면 고객센터로 문의해 주세요.',
        )
        return
      }

      // R-fix(이메일확인 데이터유실 복원): Confirm email 이 ON 이면 signUp 직후
      // 세션이 없어 프로필이 비어 있다. signUp 때 auth 메타데이터(signup_profile)
      // 에 보관해 둔 가입 입력값을 "첫 로그인"에 복원한다(이름·전화·주소·생일·
      // 마케팅동의). profiles.name 이 비어 있을 때만 실행(멱등)
      // 하고, 성공 후 메타데이터 PII 를 즉시 비운다(PIPA). 복원 실패는 로그인을
      // 막지 않는다 — 프로필은 마이페이지에서 수정 가능.
      try {
        const pending = normalizeSignupMeta(
          (signedIn.user_metadata as Record<string, unknown> | null)
            ?.signup_profile,
        )
        if (pending) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', signedIn.id)
            .maybeSingle()
          const needsRestore = !prof?.name || prof.name.trim().length === 0
          if (needsRestore) {
            const r = await applySignupProfile(supabase, signedIn.id, pending)
            if (r.underAge) {
              await supabase.auth.signOut()
              setLoading(false)
              setFormError('만 14세 미만은 가입할 수 없어요.')
              return
            }
            // GA4/Meta sign_up 전환 — 이메일 가입은 "가입 입력값 복원에 성공한
            // 첫 로그인"이 가입 확정 시점(메타데이터는 1회 소비라 정확히 1회
            // 발화). 2026-07-19 이전엔 trackSignUp 호출처가 0 = 가입 전환 미측정.
            trackSignUp('email')
          }
          // 복원 여부와 무관하게 메타데이터 PII 는 비운다(PIPA, fire-and-forget).
          supabase.auth
            .updateUser({ data: { signup_profile: null } })
            .catch(() => {})
        }
      } catch {
        /* 복원 실패는 로그인 자체를 막지 않는다 */
      }

      // 트랙B B5-2: 익명 드립 설문(localStorage 초안) → 계정 이관(메일 인증 후
      // 첫 로그인 1회). signup_profile 복원 직후·일반 redirect 앞. 초안이 완성돼
      // 있으면 dogs+surveys+analyses 생성 후 분석 화면으로. 이관 실패는 로그인을
      // 막지 않는다(일반 흐름 진행). 초안 없는 일반 로그인은 영향 0.
      // 프로모션 박기 — 초안 이관 **앞**, 그리고 초안 완성 여부와 **무관**하게.
      // 부스에서 QR 찍고 설문을 반만 하다 가입한 사람도 할인은 약속받았다.
      // 이관 안에 넣으면 그 사람이 프로모션까지 잃는다. 실패는 무시(로그인 우선).
      await claimPromotionOnSignup()

      try {
        const draft = loadAutosignupDraft()
        if (draft && isDogDraftComplete(draft.dog)) {
          // 앱 가입-먼저 흐름(surveyDeferred, Phase B 2026-07-20): 설문이 아직
          // 안 끝났으므로 강아지만 만들고 앱내 설문으로 보낸다. 기존/웹 흐름은
          // 설문이 이미 끝나 있어(아래) applyAutosignupDraft 로 일괄 이관한다.
          if (draft.surveyDeferred) {
            const deferredDogId = await createDogFromDraft(signedIn.id, draft)
            if (deferredDogId) {
              clearAutosignupDraft()
              setLoading(false)
              // 방금 가입한 계정(메일 인증 뒤 첫 로그인)이면 설문 첫 질문에 '가입 완료' 띠(시안 Y7, lib/survey/welcome).
              router.replace(surveyStartHref(deferredDogId, isFreshAccount(signedIn.created_at)))
              return
            }
          }
          const dogName = (draft.dog.name || '').trim()
          const dogId = await applyAutosignupDraft(signedIn.id, draft)
          if (dogId) {
            clearAutosignupDraft()
            setLoading(false)
            // 앱=정밀 분석 종착점, 웹=가입 완료 핸드오프(/dogs app-only 벽 우회, A안).
            router.replace(
              isApp
                ? `/dogs/${dogId}/analysis?fromSurvey=1`
                : `/start/done?name=${encodeURIComponent(dogName)}&dog=${dogId}`, // claim 과 같게 — 완료 화면 CTA 가 이 강아지로(2026-09-26)
            )
            return
          }
        }
      } catch {
        /* 이관 실패는 로그인을 막지 않는다 */
      }
    }

    setLoading(false)

    // 분기: 앱 사용자는 /dashboard (케어), 웹 사용자는 /mypage/orders (주문 확인).
    // ?next= 가 명시되어 있으면 그쪽 우선 (예: /checkout 으로 가다가 로그인 통과).
    // R101-B: /api 경로는 redirect 금지 (인증 직후 GET 으로 부작용 엔드포인트 유도 방어).
    const nextParam = searchParams.get('next')
    // 검증은 정본 하나로(lib/auth/safe-next). 여기 자체 검사는 콜백과 달리
    // 백슬래시 변형(`/\evil.com`)이 빠져 있었다 — 같은 규칙이 세 곳에 흩어지면
    // 이렇게 갈라진다.
    const safeNext = safeNextPath(nextParam)
    let destination = safeNext ?? (isApp ? '/dashboard' : '/mypage/orders')
    // 설문(=강아지) 없이 로그인한 신규/미완성 유저는 설문으로 (사장님 2026-06-16:
    // 설문 없이 진입 불가). 명시적 ?next=(예: /checkout) 가 있으면 그쪽 우선.
    // ★앱만(2026-10-10 웹 리뉴얼) — 웹은 회원만 사는 단품 가게라 강아지 없이도 주문 내역으로(웹 설문은 앱으로 옮겼다).
    if (!safeNext && signedIn && (isApp || appLook)) {
      const { count } = await supabase
        .from('dogs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', signedIn.id)
      if (!count) destination = '/start'
    }
    router.push(destination)
    router.refresh()
  }

  // ★앱 새 디자인('A 포스터', 2026-10-09 캔버스 W06·W22·W23·W24) — 앱이면 앱 모양으로 그린다. 판정은 서버 레이아웃
  //   ((auth)/layout.tsx)이 넘긴 값이라 첫 그림부터 맞다. 로그인 처리(handleLogin)·소셜 목적지·안내 판정은 위 그대로.
  if (appLook) {
    const notice = justReset || justDeleted
    return (
      <AuthAppMain>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ink.png" alt="파머스테일" width={98} height={17} style={{ marginTop: 44, alignSelf: 'flex-start', height: 17, width: 'auto', display: 'block' }} />
        <h1 style={{ margin: `${notice ? 16 : 26}px 0 0`, fontSize: 48, lineHeight: 1.05 }}>환영해요!</h1>
        <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.5, color: V3.inkSoft }}>로그인하고 우리 아이 식단 이어가기</p>
        {justReset && (
          <AuthNoticeBox title="비밀번호가 변경됐어요" style={{ marginTop: 16 }}>
            새 비밀번호로 로그인해 주세요.
          </AuthNoticeBox>
        )}
        {/* "언제든 다시 찾아 주세요" — '언제든' 금지(고객 문구 규칙) → 시안 W24 문구. */}
        {justDeleted && (
          <AuthNoticeBox title="탈퇴가 완료됐어요" style={{ marginTop: 16 }}>
            그동안 파머스테일을 이용해 주셔서 감사해요. 또 찾아 주시면 반갑게 맞을게요.
          </AuthNoticeBox>
        )}
        <div style={{ marginTop: notice ? 14 : 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <KakaoLoginButton variant="login" next={socialNext} look="app" />
          <AppleLoginButton variant="login" next={socialNext} look="app" />
        </div>
        <AuthOrDivider style={{ margin: notice ? '16px 0' : '20px 0' }} />
        <form onSubmit={handleLogin} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AuthInput
            type="email"
            required
            aria-label="이메일"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
          />
          <AuthPasswordInput
            required
            aria-label="비밀번호"
            autoComplete="current-password"
            enterKeyHint="go"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />
          {error && <AuthErrorBox>{error}</AuthErrorBox>}
          {unconfirmedEmail && formError && (
            <ResendConfirmationButton email={unconfirmedEmail} className="text-center text-[12.5px]" />
          )}
          <AuthPrimaryButton type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? '로그인 중...' : '로그인'}
          </AuthPrimaryButton>
        </form>
        <Link
          href="/forgot-password"
          style={{
            alignSelf: 'center',
            marginTop: 6,
            minHeight: 48,
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            fontSize: 15,
            fontWeight: 700,
            color: V3.inkSoft,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          비밀번호를 잊으셨나요?
        </Link>
        <div
          style={{
            marginTop: 'auto',
            padding: notice ? '16px 0 26px' : '18px 0 30px',
            borderTop: `1px solid ${V3.rule}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, textAlign: 'center' }}>파머스테일이 처음이세요?</span>
          <AuthOutlineLink href="/start">무료 맞춤 분석 시작하기</AuthOutlineLink>
        </div>
      </AuthAppMain>
    )
  }

  // ── 웹(웹 시안 WEB-A01, 2026-10-10 웹 리뉴얼) — 새 웹 가게 틀에 카카오(처음이면 1초 가입)·애플·이메일.
  //    로그인 처리(handleLogin)·소셜 목적지·안내 판정은 위 그대로. 웹은 회원만 사는 단품 가게라 '무료 맞춤 분석(설문)'
  //    대신 카카오 1초 가입(/signup)으로 안내한다. 예전 FD 톤 판은 git 이력.
  const notice = justReset || justDeleted
  const signupHref = safeNextPath(searchParams.get('next'))
    ? `/signup?next=${encodeURIComponent(safeNextPath(searchParams.get('next'))!)}`
    : '/signup'
  return (
    <StoreShell>
      <section style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h1 className="d" style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>
          환영해요!
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.55, color: '#3D3D3D' }}>로그인하면 주문과 배송을 한눈에 볼 수 있어요</p>
        {justReset && (
          <AuthNoticeBox title="비밀번호가 변경됐어요" style={{ marginTop: 16 }}>
            새 비밀번호로 로그인해 주세요.
          </AuthNoticeBox>
        )}
        {justDeleted && (
          <AuthNoticeBox title="탈퇴가 완료됐어요" style={{ marginTop: 16 }}>
            그동안 파머스테일을 이용해 주셔서 감사해요. 또 찾아 주시면 반갑게 맞을게요.
          </AuthNoticeBox>
        )}
        <div style={{ marginTop: notice ? 16 : 28 }}>
          <KakaoLoginButton variant="login" next={socialNext} look="app" label="카카오로 시작하기" />
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.5, color: '#3D3D3D', textAlign: 'center' }}>처음이어도 카카오로 1초 만에 가입돼요</p>
        <div style={{ marginTop: 14 }}>
          <AppleLoginButton variant="login" next={socialNext} look="app" />
        </div>
        <div style={{ margin: '30px 0 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span aria-hidden style={{ flex: 1, height: 1, background: '#E5E5E5' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>또는 이메일로</span>
          <span aria-hidden style={{ flex: 1, height: 1, background: '#E5E5E5' }} />
        </div>
        <form onSubmit={handleLogin} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>이메일</span>
            <AuthInput
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>비밀번호</span>
            <AuthPasswordInput
              required
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <AuthErrorBox>{error}</AuthErrorBox>}
          {unconfirmedEmail && formError && <ResendConfirmationButton email={unconfirmedEmail} className="text-center text-[12.5px]" />}
          <AuthPrimaryButton type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? '로그인 중...' : '로그인'}
          </AuthPrimaryButton>
        </form>
        <Link
          href="/forgot-password"
          style={{
            alignSelf: 'center',
            marginTop: 8,
            minHeight: 48,
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            fontSize: 16,
            fontWeight: 700,
            color: '#3D3D3D',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          비밀번호를 잊으셨나요?
        </Link>
      </section>

      <section style={{ margin: '28px 20px 56px', padding: '20px 18px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <strong style={{ fontSize: 18, fontWeight: 800 }}>파머스테일이 처음이세요?</strong>
        <span style={{ fontSize: 16, lineHeight: 1.55, color: '#3D3D3D' }}>카카오로 가입하면 웹에서 산 주문이 앱에서도 그대로 보여요.</span>
        <Link
          href={signupHref}
          style={{
            marginTop: 4,
            height: 56,
            boxSizing: 'border-box',
            borderRadius: 4,
            border: '2px solid #141414',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            fontWeight: 800,
            color: '#141414',
            textDecoration: 'none',
          }}
        >
          카카오로 1초 가입
        </Link>
      </section>
    </StoreShell>
  )
}
