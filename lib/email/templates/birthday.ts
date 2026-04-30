/**
 * 생일 축하 + 쿠폰 메일 템플릿.
 *
 * 톤: 짧고 따뜻하게. 큰 폰트 헤드라인, 쿠폰 코드 박스, 사용 안내 1~2줄.
 * 형식은 lib/email/templates/orders.ts 의 표준과 맞춤.
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.vercel.app'

export type BirthdayEmailInput = {
  recipientName: string
  couponCode: string
  /** "10% 할인" 같은 사람-읽기-쉬운 라벨 */
  discountLabel: string
  /** ISO 만료일 — 미지정 시 "이번 달 말까지" 같은 generic 표현. */
  validUntil?: string | null
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function renderBirthdayCoupon({
  recipientName,
  couponCode,
  discountLabel,
  validUntil,
}: BirthdayEmailInput): { subject: string; html: string } {
  // (광고) 표기 — 정보통신망법 제50조 제4항. 생일 쿠폰은 광고성 마케팅 메일.
  const subject = `(광고) 🎂 ${recipientName}님, 생일 축하해요`

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
          <div style="font-family:'Archivo Black',Arial,sans-serif;font-size:11px;letter-spacing:0.22em;color:#A0452E;text-transform:uppercase">Birthday · 생일 축하</div>
          <h1 style="margin:14px 0 0;font-family:'Noto Serif KR',serif;font-size:28px;line-height:1.2;letter-spacing:-0.02em;font-weight:900">
            ${recipientName} 님,<br>오늘이 그날이에요 🎂
          </h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#3A3128">
            우리 아이의 생일도 챙기시느라 바쁘셨죠. 오늘만큼은 사람도 함께
            축하받아야 해요. 작은 마음이지만, 한 끼 더 즐겁게 드시라고
            준비했어요.
          </p>
        </td></tr>

        <tr><td style="padding:6px 32px 24px">
          <div style="background:#D4A94A;border-radius:14px;padding:24px 24px 22px;text-align:center;color:#1E1A14">
            <div style="font-family:'Archivo Black',Arial,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.7">생일 쿠폰</div>
            <div style="margin-top:6px;font-family:'Noto Serif KR',serif;font-size:24px;font-weight:900;letter-spacing:-0.02em">
              ${discountLabel}
            </div>
            <div style="margin:14px auto 0;display:inline-block;background:#1E1A14;color:#D4A94A;font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;letter-spacing:0.18em;padding:10px 18px;border-radius:8px">
              ${couponCode}
            </div>
            ${validBlock}
          </div>
        </td></tr>

        <tr><td style="padding:0 32px 32px">
          <a href="${SITE_URL}/products"
             style="display:block;background:#1E1A14;color:#F5F0E6;text-align:center;text-decoration:none;font-weight:700;font-size:14px;padding:14px 0;border-radius:999px">
             지금 쇼핑하기 →
          </a>
          <p style="margin:18px 0 0;font-size:12px;color:#7B6F5C;line-height:1.6">
            * 체크아웃 단계에서 쿠폰 코드를 입력하시면 적용돼요.<br>
            * 1인 1회 사용. 다른 쿠폰과 중복 사용 불가.
          </p>
        </td></tr>

        <tr><td style="background:#F5F0E6;padding:18px 32px;font-size:11px;color:#7B6F5C;text-align:center">
          파머스테일 · ${SITE_URL.replace(/^https?:\/\//, '')}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, html }
}
