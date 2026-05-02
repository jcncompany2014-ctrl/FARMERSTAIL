/**
 * Farmer's Tail — 거래 메일 공용 레이아웃.
 *
 * 메일은 Tailwind 유틸리티, CSS 커스텀 프로퍼티, `<link>` 외부 스타일시트 모두
 * 먹지 않는다. 각 <td>/<div>에 inline style을 직접 박아야 Gmail/Outlook/네이버
 * 웹메일이 모두 깨지지 않고 렌더된다. 그래서 tailwind 토큰도 여기서는 hex로
 * 평탄화해 복사했다.
 *
 * 브랜드 토큰 (app/globals.css 의 `@theme inline` 과 수동 싱크):
 *   --ink:       #1E1A14  (제목/본문 주 색)
 *   --text:      #2C2A26  (본문 일반)
 *   --muted:     #7A7A7A  (메타 라벨)
 *   --terracotta:#B5533A  (강조/가격)
 *   --moss:      #6B7F3A  (성공 상태)
 *   --gold:      #D4B872  (경고/대기)
 *   --sale:      #C44B3A  (경고/오류)
 *   --bg:        #FAF6EE  (페이지 배경)
 *   --bg-2:      #F3ECDC  (카드 세컨더리)
 *   --rule:      #E6DDC8  (구분선)
 */

import { business } from '@/lib/business'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://farmerstail.kr'

export type LayoutInput = {
  /** <title>. Gmail 스레드 그룹화에 영향. */
  preview?: string
  /** 히어로 블록의 kicker (소제목). 예: 'Order Placed · 주문 접수' */
  kicker?: string
  /** 제목. 예: '주문이 접수됐어요' */
  heading: string
  /** 본문 HTML (이 함수는 이걸 감싸는 레이아웃만 제공). */
  body: string
  /** 선택: 하단 큰 CTA 버튼. */
  cta?: { label: string; href: string }
  /** 선택: 히어로 아이콘 이모지 (📦 📮 🐾 …). 없으면 텍스트 로고만. */
  icon?: string
}

/**
 * 메일 1통 전체 HTML. DOCTYPE 부터 `</html>` 까지.
 *
 * 디자인 타겟:
 *   - 너비 560px 카드, 640px viewport. Mobile 에선 fluid.
 *   - `Pretendard` 을 먼저 시도하고, 메일 클라이언트가 시스템 폰트로 폴백.
 *   - 다크 모드 대응은 생략 (Gmail 모바일이 자동 다크화는 하지만 토큰 유지).
 */
export function renderLayout({
  preview,
  kicker,
  heading,
  body,
  cta,
  icon,
}: LayoutInput): string {
  const previewText = preview ?? heading
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escape(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#FAF6EE;font-family:Pretendard,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2C2A26;">
    <!-- Preview text (inbox preview 에만 노출) -->
    <div style="display:none;max-height:0;overflow:hidden;color:#FAF6EE;opacity:0;">
      ${escape(previewText)}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF6EE;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #E6DDC8;border-radius:16px;overflow:hidden;">
            <!-- 헤더 (로고) -->
            <tr>
              <td style="padding:28px 32px 0 32px;text-align:center;">
                <a href="${escape(SITE_URL)}" style="text-decoration:none;color:#1E1A14;font-family:'Archivo Black',sans-serif;letter-spacing:-0.01em;font-size:18px;font-weight:900;">
                  FARMER'S TAIL
                </a>
                <div style="margin-top:2px;font-size:10px;color:#7A7A7A;letter-spacing:0.1em;text-transform:uppercase;">
                  파머스테일 · 반려견 프리미엄 푸드
                </div>
              </td>
            </tr>

            <!-- 히어로 -->
            <tr>
              <td style="padding:24px 32px 8px 32px;text-align:center;">
                ${icon ? `<div style="font-size:40px;line-height:1;margin-bottom:10px;">${icon}</div>` : ''}
                ${kicker
                  ? `<div style="font-size:10px;color:#B5533A;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">${escape(kicker)}</div>`
                  : ''}
                <h1 style="margin:0;font-size:22px;font-weight:800;color:#1E1A14;letter-spacing:-0.02em;font-family:Pretendard,serif;">
                  ${escape(heading)}
                </h1>
              </td>
            </tr>

            <!-- 본문 -->
            <tr>
              <td style="padding:20px 32px 8px 32px;font-size:13px;line-height:1.65;color:#2C2A26;">
                ${body}
              </td>
            </tr>

            ${cta
              ? `
            <!-- CTA -->
            <tr>
              <td align="center" style="padding:16px 32px 28px 32px;">
                <a href="${escape(cta.href)}" style="display:inline-block;background:#1E1A14;color:#FAF6EE;text-decoration:none;font-size:13px;font-weight:700;padding:14px 28px;border-radius:999px;letter-spacing:-0.01em;">
                  ${escape(cta.label)}
                </a>
              </td>
            </tr>`
              : ''}

            <!-- 푸터 — 사업자 정보는 lib/business.ts 가 single source of truth.
                 이전엔 가짜 placeholder 가 박혀 있어서 모든 메일에 잘못된 정보가
                 발송되고 있었음. 절대 다시 하드코딩하지 말 것. -->
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid #E6DDC8;background:#FAF6EE;">
                <div style="font-size:10px;color:#7A7A7A;line-height:1.6;">
                  <strong style="color:#2C2A26;">${escape(business.companyName)}</strong><br />
                  대표 ${escape(business.ceo)} · 사업자등록번호 ${escape(business.businessNumber)}<br />
                  통신판매업신고 ${escape(business.mailOrderNumber)}<br />
                  ${escape(business.address)}<br />
                  고객센터 <a href="mailto:${escape(business.email)}" style="color:#B5533A;text-decoration:none;">${escape(business.email)}</a>${
                    business.phone
                      ? ` · ${escape(business.phone)}`
                      : ''
                  }
                </div>
                <div style="margin-top:10px;font-size:10px;color:#9A9A9A;">
                  본 메일은 거래 안내용으로, 주문 및 회원 활동에 따라 자동 발송됩니다.
                  수신을 원치 않으시면 <a href="${escape(SITE_URL)}/mypage/notifications" style="color:#7A7A7A;text-decoration:underline;">알림 설정</a> 에서 변경하실 수 있어요.
                </div>
              </td>
            </tr>
          </table>

          <div style="font-size:10px;color:#9A9A9A;margin-top:16px;">
            © ${new Date().getFullYear()} Farmer's Tail. All rights reserved.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** 본문 조각에 공용으로 쓰는 HTML 빌더들. 각 템플릿에서 재조합해 쓴다. */
export const block = {
  /** 강조 박스. color 는 'moss' | 'terracotta' | 'gold' | 'sale'. */
  callout(color: 'moss' | 'terracotta' | 'gold' | 'sale', html: string): string {
    const bg =
      color === 'moss'
        ? '#F0F4E6'
        : color === 'terracotta'
          ? '#FBEEE8'
          : color === 'gold'
            ? '#FFF6E0'
            : '#FBE8E5'
    const border =
      color === 'moss'
        ? '#6B7F3A'
        : color === 'terracotta'
          ? '#B5533A'
          : color === 'gold'
            ? '#D4B872'
            : '#C44B3A'
    return `<div style="background:${bg};border-left:3px solid ${border};border-radius:8px;padding:14px 16px;font-size:12px;line-height:1.6;color:#2C2A26;">${html}</div>`
  },

  /** 라벨-값 테이블 행 하나. <tr> HTML을 리턴. */
  row(label: string, value: string): string {
    return `<tr>
      <td style="padding:6px 0;font-size:12px;color:#7A7A7A;width:40%;">${escape(label)}</td>
      <td style="padding:6px 0;font-size:12px;color:#1E1A14;font-weight:700;text-align:right;">${value}</td>
    </tr>`
  },

  /** 라벨-값 테이블 전체. rows 는 block.row() HTML 배열. */
  dl(rows: string[]): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.join('')}</table>`
  },

  /** 가로 구분선. */
  hr(): string {
    return `<div style="height:1px;background:#E6DDC8;margin:16px 0;"></div>`
  },

  /** 주문 아이템 1줄. */
  orderItem(name: string, qty: number, lineTotal: number): string {
    return `<tr>
      <td style="padding:8px 0;font-size:12px;color:#1E1A14;">
        <div style="font-weight:700;">${escape(name)}</div>
        <div style="font-size:11px;color:#7A7A7A;margin-top:2px;">수량 ${qty}개</div>
      </td>
      <td style="padding:8px 0;font-size:12px;color:#1E1A14;font-weight:700;text-align:right;white-space:nowrap;">
        ${lineTotal.toLocaleString()}원
      </td>
    </tr>`
  },
}

/** HTML 삽입용 안전 escape (attribute/text 공용). */
export function escape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export { SITE_URL }
