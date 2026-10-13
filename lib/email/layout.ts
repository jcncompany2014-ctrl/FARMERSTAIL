/**
 * Farmer's Tail — 메일 공용 틀 ('A 포스터', 2026-10-14 사장님 "이메일 템플릿도 새 디자인으로 다 바꿔야 돼").
 *
 * 앱·웹이 10/9~10/11 바뀐 'A 포스터' 디자인을 메일에 옮긴 것이다 — 흰 바탕 · 먹색 글자 · 머스터드 포인트 ·
 * 아주 굵은 제목 · 큰 숫자 · 작은 모서리(4px) · 먹색 바닥 띠(웹 가게 바닥 components/store/StoreFooter 와 같은 느낌).
 * 크림·베이지 바탕은 쓰지 않는다('AI 티' — 사장님 10/7). 쓰는 색은 아래 EMAIL_COLORS 뿐이다(규칙228 이 잠근다).
 *
 * # 메일 기술 제약 (지키지 않으면 Gmail·네이버·아웃룩 어딘가에서 깨진다)
 *   · 표(table) 레이아웃 + 인라인 스타일 — 메일은 클래스·CSS 변수·외부 CSS 를 거의 못 읽는다.
 *     머리의 <style> 은 휴대폰 여백·글자 크기를 줄이는 보조일 뿐, 없어도 똑같이 읽힌다(네이버는 지운다).
 *   · 폭 600 — width 속성 600 + style width:100%·max-width:600px(아웃룩은 속성, 휴대폰은 스타일을 본다).
 *   · 웹폰트 없음 — Gmail 이 지운다. 제목은 굵은 시스템 글꼴(Apple SD Gothic Neo · 맑은 고딕)로
 *     아주 굵게·자간 좁게 써서 포스터 느낌을 낸다(앱의 Black Han Sans·Anton 대신).
 *   · 그림은 절대 주소(SITE_URL) — 메일엔 상대 주소가 없다. 로고는 먹색 워드마크를 **흰 바탕에 구운** 그림
 *     (public/email/logo-ink-white.png)이다. 원본(public/logo-ink.png)은 바탕이 투명이라, 다크 모드에서
 *     메일 앱이 바탕만 검게 바꾸면 검은 글자가 검은 바탕에 사라진다(Gmail 안드로이드 등).
 *   · 다크 모드 — color-scheme 을 light only 로 선언해 애플 메일은 밝게 그대로 두고, 바탕·글자를 강제로 뒤집는
 *     메일 앱(Gmail·아웃룩)에서도 읽히게 색을 먹·흰·회색 세 단계로만 쓴다(뒤집혀도 대비가 그대로 남는다).
 *   · 버튼은 먹색 바탕 흰 글자, 바탕색을 <td> 에 준다(아웃룩은 <a> 의 여백을 무시한다).
 *   · 미리보기 글(preheader) — 받은편지함 제목 아래 한 줄. 뒤에 보이지 않는 글자를 채워 본문 첫 줄이 딸려 나오지 않게.
 *
 * # 바꾸지 않은 것 (디자인만 바꿨다)
 *   문구·링크·법정 표시 — 바닥의 사업자 정보(lib/business 정본, 전자상거래법 §10)와 거래 안내·알림 설정 문장,
 *   광고 메일의 '(광고)' 제목 머리와 수신거부 링크, 발신 주소(EMAIL_FROM)는 그대로다.
 */

import { business } from '../business.ts'
import { escape } from './escape.ts'

/**
 * 메일이 만드는 모든 절대 URL 의 base — **export 해서 이 파일 밖에서도 이것만
 * 쓴다.** lib/email/index.ts 두 곳이 자체 폴백 'https://farmerstail.kr'(apex)을
 * 갖고 있었고, 그 값으로 List-Unsubscribe 헤더가 만들어졌다(2026-09-01 감사).
 * apex 는 www 로 리다이렉트되는데 메일 제공자의 원클릭 수신거부 에이전트는
 * 리다이렉트 추종이 보장되지 않는다 — 폴백이 갈라지면 같은 메일 안에서 헤더와
 * 본문이 다른 호스트를 가리킨다. 규칙75가 apex 하드코딩 재발을 막는다.
 * (export 는 파일 맨 아래 `export { SITE_URL }` — 여기 붙이면 중복 선언이다.)
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://www.farmerstail.kr'

/**
 * 메일에 쓰는 색 — 이 표 밖의 색은 쓰지 않는다(규칙228). 앱 'A 포스터' 토큰(lib/design/tokens V3)과 같은 값.
 *   ink 먹(제목·값·버튼) · inkSoft 본문 · mute 보조 글자(흰 바탕 대비 7:1) · line 선 · face 회색 면(콜아웃) ·
 *   mustard 포인트(머리 띠·네모 점·밑줄) · red 실패·기한(한우 파우치 색) · onInk/onInkFaint 먹색 바닥 위 글자.
 */
export const EMAIL_COLORS = {
  ink: '#141414',
  inkSoft: '#3D3D3D',
  mute: '#595959',
  line: '#E5E5E5',
  face: '#F6F4F5',
  mustard: '#D4A24C',
  red: '#B5573A',
  white: '#FFFFFF',
  onInk: '#BDBDBD',
  onInkFaint: '#9A9A9A',
} as const

const C = EMAIL_COLORS

/** 본문·제목 글꼴 — 웹폰트를 못 쓰므로 굵은 한글 시스템 글꼴. */
export const EMAIL_FONT = "'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif"

/**
 * 머리 로고 — 먹색 워드마크(public/logo-ink.png)를 흰 바탕에 구운 그림. 873×151 원본을 2.5배 밀도로 줄였다.
 * 화면 크기 150×26. 그림이 안 열려도(차단) alt 글자가 남는다.
 */
export const EMAIL_LOGO = {
  path: '/email/logo-ink-white.png',
  width: 150,
  height: 26,
  alt: "Farmer's Tail 파머스테일",
} as const

export type LayoutInput = {
  /** 받은편지함 미리보기 한 줄(preheader). 없으면 제목. */
  preview?: string
  /** 제목 위 작은 머리말. 예: 'Order Placed · 주문 접수' */
  kicker?: string
  /** 제목. 예: '주문이 접수됐어요' */
  heading: string
  /** 본문 HTML (이 함수는 이걸 감싸는 틀만 제공). */
  body: string
  /** 선택: 본문 아래 큰 버튼 하나. */
  cta?: { label: string; href: string }
  /** 선택: 버튼 바로 아래 작은 글(HTML) — "버튼이 작동하지 않으면 이 주소를…" 처럼 버튼 뒤에 와야 하는 안내. */
  afterCta?: string
  /**
   * 바닥 안내 문장(HTML). 기본 = 거래 안내 + 알림 설정 링크.
   * null = 문장 없이 사업자 정보만(문의 접수 자동 답장·관리자 메일 — 회원이 아닐 수 있어 알림 설정이 없다).
   */
  footerNote?: string | null
}

/** 기본 바닥 문장 — 문구는 옛 틀 그대로(2026-10-14 디자인만 바꿈). */
function defaultFooterNote(): string {
  return `본 메일은 거래 안내용으로, 주문 및 회원 활동에 따라 자동 발송됩니다.
                  수신을 원치 않으시면 <a href="${escape(SITE_URL)}/account/notifications" style="color:${C.white};text-decoration:underline;">알림 설정</a> 에서 변경하실 수 있어요.`
}

/** 미리보기 뒤를 채우는 보이지 않는 글자(조합 문자 + 폭 0 비결합자 + 줄바꿈 없는 공백) — 엔티티가 아니라 글자 그대로. */
const PREHEADER_FILL = '͏‌ '.repeat(48)

/**
 * 메일 1통 전체 HTML. DOCTYPE 부터 `</html>` 까지.
 * 모든 메일(주문·정기배송·뉴스레터·문의·운영 점검·Supabase 인증 4종)이 이 함수 하나로 그려진다(규칙225).
 */
export function renderLayout({ preview, kicker, heading, body, cta, afterCta, footerNote }: LayoutInput): string {
  const previewText = preview ?? heading
  const note = footerNote === undefined ? defaultFooterNote() : footerNote
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escape(heading)}</title>
    <style>
      :root { color-scheme: light only; supported-color-schemes: light; }
      a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
      @media only screen and (max-width: 620px) {
        .ft-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .ft-h1 { font-size: 26px !important; }
        .ft-big { font-size: 28px !important; }
        .ft-outer { padding: 0 !important; }
      }
    </style>
  </head>
  <body data-ft-frame="poster" style="margin:0;padding:0;background:${C.face};font-family:${EMAIL_FONT};color:${C.ink};word-break:keep-all;overflow-wrap:break-word;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.face};opacity:0;">${escape(previewText)}${PREHEADER_FILL}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.face};">
      <tr>
        <td class="ft-outer" align="center" style="padding:32px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.white};border:1px solid ${C.line};border-collapse:separate;">
            <!-- 머스터드 띠 -->
            <tr>
              <td style="height:6px;line-height:6px;font-size:0;background:${C.mustard};">&nbsp;</td>
            </tr>

            <!-- 머리: 로고 -->
            <tr>
              <td class="ft-pad" style="padding:22px 32px 18px 32px;border-bottom:2px solid ${C.ink};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="width:${EMAIL_LOGO.width}px;">
                      <a href="${escape(SITE_URL)}" style="text-decoration:none;display:block;">
                        <img src="${escape(SITE_URL)}${EMAIL_LOGO.path}" alt="${escape(EMAIL_LOGO.alt)}" width="${EMAIL_LOGO.width}" height="${EMAIL_LOGO.height}" style="display:block;width:${EMAIL_LOGO.width}px;height:${EMAIL_LOGO.height}px;border:0;outline:none;color:${C.ink};font-size:16px;font-weight:800;" />
                      </a>
                    </td>
                    <td valign="middle" align="right" style="font-size:12px;line-height:1.4;color:${C.mute};font-weight:700;letter-spacing:-0.01em;">
                      파머스테일 · 반려견 프리미엄 푸드
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- 제목 -->
            <tr>
              <td class="ft-pad" style="padding:36px 32px 4px 32px;">
                ${kicker
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">
                  <tr>
                    <td width="10" style="width:10px;height:10px;line-height:10px;font-size:0;background:${C.mustard};">&nbsp;</td>
                    <td style="padding-left:8px;font-size:13px;line-height:1.2;font-weight:800;color:${C.ink};letter-spacing:-0.01em;">${escape(kicker)}</td>
                  </tr>
                </table>`
                  : ''}
                <h1 class="ft-h1" style="margin:0;font-family:${EMAIL_FONT};font-size:30px;line-height:1.28;font-weight:900;color:${C.ink};letter-spacing:-0.04em;">${escape(heading)}</h1>
              </td>
            </tr>

            <!-- 본문 -->
            <tr>
              <td class="ft-pad" style="padding:24px 32px 8px 32px;font-size:16px;line-height:1.7;color:${C.inkSoft};letter-spacing:-0.01em;">
                ${body}
              </td>
            </tr>

            ${cta
              ? `
            <!-- 버튼 -->
            <tr>
              <td class="ft-pad" style="padding:20px 32px 40px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="${C.ink}" style="background:${C.ink};border-radius:4px;">
                      <a href="${escape(cta.href)}" style="display:block;padding:18px 20px;font-family:${EMAIL_FONT};font-size:17px;line-height:1.2;font-weight:800;color:${C.white};text-decoration:none;letter-spacing:-0.01em;border-radius:4px;">${escape(cta.label)}</a>
                    </td>
                  </tr>
                </table>
                ${afterCta ? `<div style="margin-top:16px;font-size:14px;line-height:1.65;color:${C.mute};">${afterCta}</div>` : ''}
              </td>
            </tr>`
              : `
            <tr><td style="height:24px;line-height:24px;font-size:0;">&nbsp;</td></tr>`}

            <!-- 바닥 — 사업자 정보는 lib/business.ts 가 single source of truth.
                 예전엔 가짜 placeholder 가 박혀 있어서 모든 메일에 잘못된 정보가
                 발송되고 있었음. 절대 다시 하드코딩하지 말 것. -->
            <tr>
              <td class="ft-pad" bgcolor="${C.ink}" style="padding:28px 32px 30px 32px;background:${C.ink};">
                <div style="font-size:13px;line-height:1.7;color:${C.onInk};">
                  <strong style="color:${C.white};font-size:14px;">${escape(business.companyName)}</strong><br />
                  대표 ${escape(business.ceo)} · 사업자등록번호 ${escape(business.businessNumber)}<br />
                  통신판매업신고 ${escape(business.mailOrderNumber)}<br />
                  ${escape(business.address)}<br />
                  고객센터 <a href="mailto:${escape(business.email)}" style="color:${C.white};text-decoration:none;">${escape(business.email)}</a>${
                    business.phone ? ` · ${escape(business.phone)}` : ''
                  }
                </div>
                ${note
                  ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid ${C.inkSoft};font-size:13px;line-height:1.7;color:${C.onInk};">
                  ${note}
                </div>`
                  : ''}
                <div style="margin-top:14px;font-size:12px;line-height:1.5;color:${C.onInkFaint};">
                  © ${new Date().getFullYear()} Farmer's Tail. All rights reserved.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** 콜아웃 왼쪽 띠 색 — 정보(먹) · 주의·대기(머스터드) · 실패(빨강). 'terracotta' 는 띠가 아니라 도장 카드다. */
const CALLOUT_BAND: Record<'moss' | 'gold' | 'sale', string> = {
  moss: C.ink,
  gold: C.mustard,
  sale: C.red,
}

/** 본문 조각에 공용으로 쓰는 HTML 빌더들. 각 템플릿에서 재조합해 쓴다. */
export const block = {
  /**
   * 강조 박스. tone 은 옛 이름 그대로 받는다(템플릿 호출 모양을 안 바꾸려고):
   *   'moss' 정보 · 'gold' 주의·대기 · 'sale' 실패 → 회색 면 + 왼쪽 6px 색 띠(앱 보조 카드와 같은 모양).
   *   'terracotta' 결제 고지처럼 그 메일의 핵심 한 가지 → 도장 카드(먹선 2px + 먹 그림자 4px, 앱 '화면당 한 곳').
   */
  callout(tone: 'moss' | 'terracotta' | 'gold' | 'sale', html: string): string {
    if (tone === 'terracotta') return block.stamp(html)
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        <td width="6" style="width:6px;background:${CALLOUT_BAND[tone]};font-size:0;line-height:0;">&nbsp;</td>
        <td style="background:${C.face};padding:16px 18px;font-size:15px;line-height:1.65;color:${C.ink};">${html}</td>
      </tr>
    </table>`
  },

  /**
   * 도장 카드 — 흰 면 + 먹선 2px + 오른쪽·아래 4px 먹 그림자. box-shadow 는 Gmail 이 지우므로 표 칸으로 그림자를 만든다
   * (오른쪽 칸 = 위 4px 흰 테두리 + 나머지 먹, 아래 줄 = 왼쪽 4px 흰 테두리 + 나머지 먹).
   */
  stamp(html: string): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        <td style="border:2px solid ${C.ink};background:${C.white};padding:18px 20px;font-size:15px;line-height:1.65;color:${C.ink};">${html}</td>
        <td width="4" style="width:4px;background:${C.ink};border-top:4px solid ${C.white};font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="height:4px;background:${C.ink};border-left:4px solid ${C.white};font-size:0;line-height:4px;mso-line-height-rule:exactly;">&nbsp;</td>
        <td width="4" style="width:4px;height:4px;background:${C.ink};font-size:0;line-height:4px;">&nbsp;</td>
      </tr>
    </table>`
  },

  /** 라벨-값 표 행 하나. <tr> HTML을 리턴. value 는 HTML(호출처가 escape). */
  row(label: string, value: string): string {
    return `<tr>
      <td style="padding:11px 0;border-bottom:1px solid ${C.line};font-size:15px;line-height:1.45;color:${C.mute};width:40%;vertical-align:top;">${escape(label)}</td>
      <td style="padding:11px 0;border-bottom:1px solid ${C.line};font-size:15px;line-height:1.45;color:${C.ink};font-weight:700;text-align:right;vertical-align:top;">${value}</td>
    </tr>`
  },

  /** 합계 행 — 큰 숫자(포스터의 굵은 숫자). value 는 HTML. */
  total(label: string, value: string): string {
    return `<tr>
      <td style="padding:16px 0 4px 0;font-size:15px;line-height:1.45;color:${C.ink};font-weight:800;vertical-align:bottom;">${escape(label)}</td>
      <td class="ft-big" style="padding:16px 0 4px 0;font-size:32px;line-height:1.1;color:${C.ink};font-weight:900;letter-spacing:-0.03em;text-align:right;white-space:nowrap;vertical-align:bottom;">${value}</td>
    </tr>`
  },

  /** 라벨-값 테이블 전체. rows 는 block.row()·block.total() HTML 배열. */
  dl(rows: string[]): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.join('')}</table>`
  },

  /** 가로 구분선. */
  hr(): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td style="height:1px;line-height:1px;font-size:0;background:${C.line};">&nbsp;</td></tr></table>`
  },

  /** 작은 머리말(머스터드 네모 + 굵은 글자) — 본문 안 묶음의 이름. 예: '주문 상품'. */
  label(text: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
      <tr>
        <td width="8" style="width:8px;height:8px;line-height:8px;font-size:0;background:${C.mustard};">&nbsp;</td>
        <td style="padding-left:7px;font-size:13px;line-height:1.2;font-weight:800;color:${C.ink};letter-spacing:-0.01em;">${escape(text)}</td>
      </tr>
    </table>`
  },

  /** 품목 목록 표 — 위 2px 먹선(포스터의 섹션 머리), 줄마다 아래 1px 선. rows 는 deliveryItem·orderItem. */
  items(rows: string[]): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:2px solid ${C.ink};">${rows.join('')}</table>`
  },

  /**
   * 배송 예정 품목 1줄 — **금액 열이 없다**.
   *
   * orderItem 에 0 을 넘겨 쓰던 자리가 있었는데, 그러면 모든 품목이 "0원"으로
   * 렌더됐다(2026-09-01 감사). 정기배송 알림처럼 품목별 단가를 확정해 말할 수
   * 없는 자리는 이 블록을 쓰고, 실제 청구액은 콜아웃으로 한 번만 말한다
   * (할인이 붙으면 품목 합계 ≠ 청구액이라 둘을 나란히 두면 더 헷갈린다).
   */
  deliveryItem(name: string, qty: number): string {
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid ${C.line};font-size:16px;line-height:1.4;color:${C.ink};">
        <div style="font-weight:800;">${escape(name)}</div>
        <div style="font-size:14px;color:${C.mute};margin-top:2px;">수량 ${qty}개</div>
      </td>
    </tr>`
  },

  /** 주문 아이템 1줄. */
  orderItem(name: string, qty: number, lineTotal: number): string {
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid ${C.line};font-size:16px;line-height:1.4;color:${C.ink};">
        <div style="font-weight:800;">${escape(name)}</div>
        <div style="font-size:14px;color:${C.mute};margin-top:2px;">수량 ${qty}개</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid ${C.line};font-size:16px;line-height:1.4;color:${C.ink};font-weight:800;text-align:right;white-space:nowrap;vertical-align:top;">
        ${lineTotal.toLocaleString()}원
      </td>
    </tr>`
  },

  /** 작은 보조 문단(14px 회색). html 은 호출처가 escape 한 HTML. */
  note(html: string, marginTop = 16): string {
    return `<p style="margin:${marginTop}px 0 0 0;font-size:14px;line-height:1.65;color:${C.mute};">${html}</p>`
  },

  /**
   * 법정 안내 칸 — 광고 메일의 수신거부 안내처럼 반드시 읽혀야 하는 작은 글(13px, 흰 바탕 대비 7:1).
   * 예전엔 10px 연회색(#9A9A9A, 대비 2.8:1)이라 '쉽게 알아볼 수 있게'(정보통신망법 §50) 에 못 미쳤다(규칙226).
   */
  fine(html: string): string {
    return `<div style="margin-top:28px;padding-top:16px;border-top:1px solid ${C.line};font-size:13px;line-height:1.7;color:${C.mute};">${html}</div>`
  },

  /** 본문 속 링크 — 먹색 밑줄. href·label 은 원문(여기서 escape). */
  link(href: string, label: string): string {
    return `<a href="${escape(href)}" style="color:${C.ink};font-weight:700;text-decoration:underline;">${escape(label)}</a>`
  },

  /** 강조 — 머스터드 밑줄(앱의 '밑줄' 포인트). text 는 원문(여기서 escape). */
  mark(text: string): string {
    return `<strong style="color:${C.ink};border-bottom:3px solid ${C.mustard};">${escape(text)}</strong>`
  },

  /** 작은 칩 묶음(결정 근거 등). labels 는 원문. */
  chips(labels: string[]): string {
    return labels
      .map(
        (label) =>
          `<span style="display:inline-block;margin:0 6px 8px 0;padding:5px 10px;border:1px solid ${C.ink};border-radius:2px;background:${C.white};font-size:13px;line-height:1.3;font-weight:700;color:${C.ink};">${escape(label)}</span>`,
      )
      .join('')
  },

  /** 뉴스레터 섹션 머리 — 작은 머리말 + 굵은 제목. 원문(여기서 escape). */
  section(kicker: string, title: string): string {
    return `<div style="margin:32px 0 12px 0;">
      ${block.label(kicker)}
      <div style="font-size:21px;line-height:1.35;font-weight:900;color:${C.ink};letter-spacing:-0.03em;">${escape(title)}</div>
    </div>`
  },

  /** 큰 글자 한 줄(카드 안 핵심 이름·금액). html 은 호출처가 escape. */
  big(html: string): string {
    return `<div class="ft-big" style="font-size:26px;line-height:1.25;font-weight:900;color:${C.ink};letter-spacing:-0.03em;">${html}</div>`
  },
}

// 옛 marketingFooterRow()(자체 <html> 을 그리는 마케팅 메일용 바닥)는 호출처가 없어 2026-10-14 지웠다 —
// 모든 메일이 renderLayout 을 쓰고(규칙225), 사업자 정보 바닥은 renderLayout 의 먹색 띠 한 곳이다.

// escape 는 ./escape 에서 re-export (이미 import 됨)
export { escape }
export { SITE_URL }
