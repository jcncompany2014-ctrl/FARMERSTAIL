/**
 * Supabase 인증 메일 4종(가입 확인 · 비밀번호 재설정 · 이메일 변경 · 로그인 링크)의 HTML — 공용 틀(renderLayout)로 만든다.
 *
 * 이 메일은 우리 서버가 아니라 **Supabase 가 보낸다.** 그래서 코드가 직접 쓰지 않고, 여기서 만든 HTML 을
 * supabase/email-templates/*.html 에 적어 두면 사장님이 Supabase 대시보드(Authentication → Email Templates)에
 * 붙여 넣는다. 파일 다시 만들기: `node --experimental-strip-types scripts/build-email-auth-templates.ts`
 * (규칙225 가 파일과 이 함수의 결과가 같은지 본다 — 틀을 고치고 파일을 안 만들면 빨간불).
 *
 * Supabase 변수({{ .ConfirmationURL }} · {{ .SiteURL }} · {{ .TokenHash }} · {{ .Email }})는 글자 그대로 둔다.
 * 링크의 & 는 HTML 규칙대로 &amp; 로 적힌다 — 메일 앱이 & 로 읽으므로 주소는 옛 파일과 같다.
 * 문구(제목·본문·만료 시간·바닥 안내)는 옛 파일 그대로다(2026-10-14 디자인만 바꿈).
 */
import { EMAIL_COLORS, escape, renderLayout } from '../layout.ts'

export type AuthTemplateFile = 'confirm-signup' | 'reset-password' | 'change-email' | 'magic-link'

type AuthTemplateSpec = {
  kicker: string
  heading: string
  /** 본문 한 문단(HTML, Supabase 변수 포함). */
  lead: string
  ctaLabel: string
  /** 버튼 주소 — Supabase 변수 그대로. */
  href: string
  /** 바닥 안내 첫 줄. */
  footer: string
  /** 파일 맨 위에 남길 설명 주석(대시보드에 붙여 넣어도 메일엔 안 보인다). */
  leadingComment?: string
}

const BRAND_LINE = '파머스테일 · 정성스러운 화식 펫푸드'

const SPECS: Record<AuthTemplateFile, AuthTemplateSpec> = {
  'confirm-signup': {
    kicker: '환영합니다',
    heading: '파머스테일에 오신 걸 환영해요 🐾',
    lead: '가입을 완료하려면 아래 버튼을 눌러 이메일 인증을 진행해주세요. 링크는 <strong>1시간 후 만료</strong>됩니다.',
    ctaLabel: '이메일 인증하기',
    href: '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup',
    footer: '본 메일은 회원가입 완료 안내 거래성 이메일이에요. 본인이 가입한 적이 없다면 이 메일을 무시해주세요.',
  },
  'reset-password': {
    kicker: '비밀번호 재설정',
    heading: '비밀번호를 다시 설정해주세요',
    lead: '요청하신 계정 ({{ .Email }}) 의 비밀번호 재설정 링크예요. 링크는 <strong>1시간 후 만료</strong>됩니다.',
    ctaLabel: '비밀번호 재설정',
    href: '{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery',
    footer:
      '본 메일은 비밀번호 재설정 요청에 의한 거래성 이메일이에요. 본인이 요청하지 않았다면 이 메일을 무시해주세요. 누군가가 계정 비밀번호 변경을 시도했지만 변경되지 않았어요.',
    leadingComment: `<!--
  ★링크는 {{ .ConfirmationURL }} 이 아니라 token_hash 형식이다 (2026-08-14 감사).

  ConfirmationURL 은 PKCE code 로 리다이렉트되는데, code 를 세션으로 바꾸는 데
  필요한 code_verifier 는 **메일을 요청한 그 브라우저**에만 있다. 앱에서
  재설정을 요청하고 메일앱 인앱브라우저나 Safari 에서 링크를 열면 100% 실패하고,
  화면 문구는 "만료됐거나 이미 사용됐어요" 라 고객이 메일만 계속 다시 받는다.
  token_hash + verifyOtp 는 verifier 가 필요 없어 어느 브라우저에서도 통한다.

  ⚠️ 이 파일을 고쳐도 자동 반영되지 않는다 — Supabase Dashboard →
     Authentication → Email Templates → Reset Password 에 붙여 넣어야 한다.
-->
`,
  },
  'change-email': {
    kicker: '이메일 변경',
    heading: '새 이메일 인증',
    lead: '{{ .Email }} 로 이메일을 변경하려면 아래 버튼을 눌러 인증을 완료해주세요. 링크는 <strong>1시간 후 만료</strong>됩니다.',
    ctaLabel: '이메일 변경 인증',
    href: '{{ .ConfirmationURL }}',
    footer: '본 메일은 이메일 변경 요청에 의한 거래성 이메일이에요. 본인이 요청하지 않았다면 이 메일을 무시해주세요.',
  },
  'magic-link': {
    kicker: '로그인',
    heading: '한 번 클릭으로 로그인',
    lead: '{{ .Email }} 계정으로 로그인하려면 아래 버튼을 누르세요. 링크는 <strong>1시간 후 만료</strong>됩니다.',
    ctaLabel: '로그인하기',
    href: '{{ .ConfirmationURL }}',
    footer: '본 메일은 로그인 링크 요청에 의한 거래성 이메일이에요. 본인이 요청하지 않았다면 이 메일을 무시해주세요.',
  },
}

export const AUTH_TEMPLATE_FILES = Object.keys(SPECS) as AuthTemplateFile[]

/** supabase/email-templates/<file>.html 에 들어갈 전체 내용. */
export function renderAuthTemplate(file: AuthTemplateFile): string {
  const s = SPECS[file]
  const html = renderLayout({
    kicker: s.kicker,
    heading: s.heading,
    body: `<p style="margin:0;">${s.lead}</p>`,
    cta: { label: s.ctaLabel, href: s.href },
    afterCta: `버튼이 작동하지 않으면 이 주소를 복사해서 브라우저에 붙여 넣어주세요:<br>
                <span style="word-break:break-all;color:${EMAIL_COLORS.ink};">${escape(s.href)}</span>`,
    footerNote: `${s.footer}<br>${BRAND_LINE}`,
  })
  return `${s.leadingComment ?? ''}${html}\n`
}
