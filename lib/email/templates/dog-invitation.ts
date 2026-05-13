/**
 * 강아지 가족 초대 메일.
 *
 * voice-guidelines §2 — 따뜻하게, 짧게. CTA 1개. "○○님이 △△의 가족으로
 * 초대했어요" — 자율성 강조 ("싫으면 안 받아도 돼요" 톤은 자제하되 강요 X).
 */

import { renderLayout } from '../layout'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://farmerstail.kr'

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

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function renderDogInvitation(
  input: DogInvitationEmailInput,
): { subject: string; html: string } {
  const { inviterName, dogName, role, token, expiresAt } = input
  const url = `${SITE_URL}/invitations/${encodeURIComponent(token)}`

  const subject = `${inviterName}님이 ${dogName}의 가족으로 초대했어요`

  const html = renderLayout({
    preview: `${dogName} 케어를 함께 해보실래요?`,
    kicker: 'Family · 가족 초대',
    heading: `${dogName}의 가족이 되어주세요`,
    body: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#2C2A26;">
        <strong>${inviterName}</strong>님이 <strong>${dogName}</strong>의
        ${ROLE_LABEL[role]} 으로 초대했어요.
      </p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.7;color:#7A7A7A;">
        링크를 누르면 ${dogName}의 일지·체크인을 함께 보실 수 있어요.
        초대는 <strong>${fmtDate(expiresAt)}</strong>까지 유효해요.
      </p>
    `,
    cta: {
      label: '초대 수락하기',
      href: url,
    },
  })

  return { subject, html }
}
