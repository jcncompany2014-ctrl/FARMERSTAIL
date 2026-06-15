/**
 * 강아지 가족 초대 메일.
 *
 * voice-guidelines §2 — 따뜻하게, 짧게. CTA 1개. "○○님이 △△의 가족으로
 * 초대했어요" — 자율성 강조 ("싫으면 안 받아도 돼요" 톤은 자제하되 강요 X).
 */

import { renderLayout } from '../layout'
import { escape } from '../escape'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://www.farmerstail.kr'

export type DogInvitationEmailInput = {
  inviterName: string
  /** 강아지 이름 (한글) */
  dogName: string
  /** member 또는 viewer */
  role: 'member' | 'viewer'
  /** magic link 토큰 — /invitations/{token} 로 접속 */
  token: string
  /** 만료 ISO. "○월 ○일까지" 표시용. */
  expiresAt: string
}

const ROLE_LABEL: Record<'member' | 'viewer', string> = {
  member: '함께 케어하는 가족',
  viewer: '함께 지켜보는 가족',
}

// R94 (D7): KST 강제 — 이전엔 서버 UTC 기준이라 만료일이 하루 밀려 표시.
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))
}

export function renderDogInvitation(
  input: DogInvitationEmailInput,
): { subject: string; html: string } {
  const { inviterName, dogName, role, token, expiresAt } = input
  const url = `${SITE_URL}/invitations/${encodeURIComponent(token)}`

  const subject = `${inviterName}님이 ${dogName}의 가족으로 초대했어요`

  // R94 (D7): body 의 사용자 입력(inviterName, dogName)은 renderLayout 이
  // escape 하지 않는 raw HTML 영역이므로 직접 escape (heading/preview 는
  // renderLayout 이 escape). dogName 은 사용자 자유 입력 강아지 이름,
  // inviterName 은 user_metadata.name — 둘 다 사용자 통제값 → XSS 차단.
  const safeDog = escape(dogName)
  const safeInviter = escape(inviterName)
  const html = renderLayout({
    preview: `${dogName} 케어를 함께 해보실래요?`,
    kicker: 'Family · 가족 초대',
    heading: `${dogName}의 가족이 되어주세요`,
    body: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#173B33;">
        <strong>${safeInviter}</strong>님이 <strong>${safeDog}</strong>의
        ${escape(ROLE_LABEL[role])}으로 초대했어요.
      </p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.7;color:#5A6C61;">
        링크를 누르면 ${safeDog}의 일지·체크인을 함께 보실 수 있어요.
        초대는 <strong>${escape(fmtDate(expiresAt))}</strong>까지 유효해요.
      </p>
    `,
    cta: {
      label: '초대 수락하기',
      href: url,
    },
  })

  return { subject, html }
}
