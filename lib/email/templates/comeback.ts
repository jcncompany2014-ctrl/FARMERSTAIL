/**
 * 재참여 쿠폰 메일 — 30일+ 미접속 사용자에게 발송.
 *
 * 톤: "오랜만이에요" — 부담 없이, 가벼운 안부. 강요/sales-y X.
 * 형식은 birthday 템플릿 패턴 따라감 (paper-tone + serif + 큰 쿠폰 박스).
 */

import { escape } from '../escape'
import { marketingFooterRow } from '../layout'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

export type ComebackEmailInput = {
  recipientName: string
  discountLabel: string
  /** ISO 만료일 — 미지정 시 만료일 안내 생략. */
  validUntil?: string | null
}

// R94 (D7): KST 강제 (서버 UTC 기준 하루 밀림 방지).
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(iso))
    .replace(/\. /g, '.')
    .replace(/\.$/, '')
}

export function renderComebackCoupon({
  recipientName,
  discountLabel,
  validUntil,
}: ComebackEmailInput): { subject: string; html: string } {
  // (광고) 표기 — 정보통신망법 제50조 제4항. 재참여 메일도 마케팅성.
  const subject = `(광고) ${recipientName}님, 오랜만이에요 🐾`

  const validBlock = validUntil
    ? `<p style="margin:8px 0 0;font-size:13px;color:#7B6F5C">유효기간: ~${fmtDate(validUntil)}</p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;background:#F5F0E6;font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Apple SD Gothic Neo',sans-serif;color:#1E1A14">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F5F0E6;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#FFF;border:1px solid #E5DCC9;border-radius:16px;overflow:hidden">
        <tr><td style="padding:36px 32px 12px">
          <div style="font-family:'Archivo Black',Arial,sans-serif;font-size:11px;letter-spacing:0.22em;color:#A0452E;text-transform:uppercase">Comeback · 다시 만나요</div>
          <h1 style="margin:14px 0 0;font-family:'Noto Serif KR',serif;font-size:28px;line-height:1.2;letter-spacing:-0.02em;font-weight:900">
            ${escape(recipientName)} 님,<br>오랜만이에요 🐾
          </h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#3A3128">
            우리 아이는 잘 있나요? 그동안 자리를 비우신 사이 새로운 메뉴와
            산지 이야기가 많이 쌓였어요. 다시 들러주신다면 작은 보답으로
            할인을 준비했어요.
          </p>
        </td></tr>

        <tr><td style="padding:6px 32px 24px">
          <div style="background:#9CB35F;border-radius:14px;padding:24px 24px 22px;text-align:center;color:#1E1A14">
            <div style="font-family:'Archivo Black',Arial,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.7">재참여 쿠폰</div>
            <div style="margin-top:6px;font-family:'Noto Serif KR',serif;font-size:24px;font-weight:900;letter-spacing:-0.02em">
              ${escape(discountLabel)}
            </div>
            <div style="margin-top:10px;font-size:13px;opacity:0.78">결제 단계에서 자동으로 적용돼요</div>
            ${validBlock}
          </div>
        </td></tr>

        <tr><td style="padding:0 32px 32px">
          <a href="${SITE_URL}/products"
             style="display:block;background:#1E1A14;color:#F5F0E6;text-align:center;text-decoration:none;font-weight:700;font-size:14px;padding:14px 0;border-radius:999px">
             다시 둘러보기 →
          </a>
          <p style="margin:18px 0 0;font-size:12px;color:#7B6F5C;line-height:1.6">
            * 자동 적용 — 별도 코드 입력 불필요.<br>
            * 1인 1회 사용. 다른 쿠폰과 중복 사용 불가.
          </p>
        </td></tr>

        ${marketingFooterRow()}
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, html }
}
