/**
 * VIP/gold 등급 정기 쿠폰 메일.
 *
 * 톤: 절제된 감사 + 격조. "감사합니다" 보다 "한 끼 더 정성스럽게" 같은
 * brand voice. paper-tone + serif + 큰 쿠폰 박스.
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.kr'

export type VipEmailInput = {
  recipientName: string
  tier: string // 'fruit' | 'mate' — 메일 hook 에 노출 (사용자에게 자존감)
  discountLabel: string
  validUntil?: string | null
}

const TIER_LABELS: Record<string, string> = {
  mate: 'MATE · 단짝',
  fruit: 'FRUIT · 열매',
  bloom: 'BLOOM · 꽃',
  sprout: 'SPROUT · 새싹',
  seed: 'SEED · 씨앗',
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function renderVipCoupon({
  recipientName,
  tier,
  discountLabel,
  validUntil,
}: VipEmailInput): { subject: string; html: string } {
  const tierLabel = TIER_LABELS[tier] ?? tier.toUpperCase()
  const subject = `(광고) ${recipientName}님께, ${tierLabel} 감사 쿠폰`

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
          <div style="font-family:'Archivo Black',Arial,sans-serif;font-size:11px;letter-spacing:0.22em;color:#A0452E;text-transform:uppercase">${tierLabel} · 등급 감사</div>
          <h1 style="margin:14px 0 0;font-family:'Noto Serif KR',serif;font-size:28px;line-height:1.2;letter-spacing:-0.02em;font-weight:900">
            ${recipientName} 님,<br>오래 함께해 주셨네요
          </h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#3A3128">
            우리 아이의 한 끼를 매번 챙겨주신 덕분에 ${tierLabel} 등급에
            도달하셨어요. 작은 보답으로 이번 달 쿠폰을 준비했어요.
          </p>
        </td></tr>

        <tr><td style="padding:6px 32px 24px">
          <div style="background:#1E1A14;border-radius:14px;padding:24px 24px 22px;text-align:center;color:#D4A94A">
            <div style="font-family:'Archivo Black',Arial,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.7">${tierLabel} 쿠폰</div>
            <div style="margin-top:6px;font-family:'Noto Serif KR',serif;font-size:24px;font-weight:900;letter-spacing:-0.02em">
              ${discountLabel}
            </div>
            <div style="margin-top:10px;font-size:13px;opacity:0.85">결제 단계에서 자동으로 적용돼요</div>
            ${validBlock}
          </div>
        </td></tr>

        <tr><td style="padding:0 32px 32px">
          <a href="${SITE_URL}/products"
             style="display:block;background:#1E1A14;color:#F5F0E6;text-align:center;text-decoration:none;font-weight:700;font-size:14px;padding:14px 0;border-radius:999px">
             지금 둘러보기 →
          </a>
          <p style="margin:18px 0 0;font-size:12px;color:#7B6F5C;line-height:1.6">
            * 자동 적용 — 별도 코드 입력 불필요.<br>
            * 1인 1회 사용. 다른 쿠폰과 중복 사용 불가.
          </p>
        </td></tr>

        <tr><td style="padding:0 32px 26px;border-top:1px solid #EDE6D8">
          <p style="margin:16px 0 0;font-size:11px;color:#9C9282;line-height:1.5">
            본 메일은 마케팅 정보 수신에 동의하신 분께 발송되었어요. 수신
            거부는 마이페이지 → 알림 설정에서 변경하실 수 있어요.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, html }
}
