/**
 * 1:1 문의 메일 두 통 — 관리자 알림(story@ 로) · 고객 접수 확인(자동 답장).
 *
 * 예전엔 app/api/contact/route.ts 안에서 크림 바탕(#FAF6EE) HTML 을 따로 그렸다 — 다른 메일과 틀이 달랐다.
 * 2026-10-14 공용 틀(renderLayout)로 옮겼다(규칙225). 문구·받는 사람·답장 주소는 그대로다.
 *
 * ★자동 답장은 입력값(이름·내용)을 인용하지 않는다(2026-09-24 보안 점검). 이 폼은 로그인 없이 **아무 주소**로
 *   보낼 수 있어서, 이름·내용을 그대로 실으면 "결제 실패, 여기서 카드 재등록" 같은 글을 우리 도메인 메일로 남에게
 *   보낼 수 있었다(피싱 중계). 고정 문구 + 카테고리(선택지)만 보낸다 — 그래서 입력 타입에 이름·내용 칸이 없다.
 */
import { business } from '../../business.ts'
import { block, EMAIL_COLORS, escape, renderLayout } from '../layout.ts'

/** 관리자 알림 — 문의 원문을 그대로 보여 준다(받는 사람은 사장님). 답장 주소는 호출처가 고객 주소로 단다. */
export function renderContactAdmin(input: {
  name: string
  email: string
  categoryLabel: string
  message: string
}): { subject: string; html: string } {
  const subject = `[문의·${input.categoryLabel}] ${input.name} 님`
  const body = `
    ${block.dl([
      block.row('카테고리', escape(input.categoryLabel)),
      block.row(
        '이메일',
        `<a href="mailto:${escape(input.email)}" style="color:${EMAIL_COLORS.ink};text-decoration:underline;font-weight:700;">${escape(input.email)}</a>`,
      ),
      block.row('이름', escape(input.name)),
    ])}
    <div style="margin-top:20px;padding:16px 18px;background:${EMAIL_COLORS.face};border-left:6px solid ${EMAIL_COLORS.ink};font-size:16px;line-height:1.75;color:${EMAIL_COLORS.ink};white-space:pre-wrap;">${escape(input.message)}</div>
    ${block.note(`"답장" 버튼으로 바로 회신 가능합니다 (Reply-To: ${escape(input.email)}).`, 18)}
  `
  const html = renderLayout({
    preview: `${input.categoryLabel} · ${input.name} 님의 문의`,
    kicker: '새 문의',
    heading: `${input.name} 님의 문의`,
    body,
    footerNote: null,
  })
  return { subject, html }
}

/** 고객 접수 확인 — 고정 문구 + 카테고리만(위 ★). */
export function renderContactAck(input: { categoryLabel: string }): { subject: string; html: string } {
  const subject = '[파머스테일] 문의가 접수됐어요'
  const body = `
    <p style="margin:0 0 14px 0;">
      평일 영업일 24시간 이내, 가능하면 더 빨리 답변드릴게요. 만약 응답이
      늦어진다면 <a href="mailto:${escape(business.email)}" style="color:${EMAIL_COLORS.ink};font-weight:700;text-decoration:underline;">${escape(business.email)}</a> 로 다시 한 번 연락 주세요.
    </p>
    <div style="margin-top:24px;">
      ${block.label('접수한 내용')}
      ${block.dl([block.row('카테고리', escape(input.categoryLabel))])}
    </div>
  `
  const html = renderLayout({
    preview: '문의가 잘 접수됐어요.',
    kicker: '파머스테일 · 문의 접수',
    heading: '문의가 잘 접수됐어요.',
    body,
    // 문의는 회원이 아니어도 보낸다 — '알림 설정' 안내 대신 사업자 정보만(옛 자동 답장 바닥과 같은 내용 + 대표·상호).
    footerNote: null,
  })
  return { subject, html }
}
