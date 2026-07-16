import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { normalizePromoCode } from '@/lib/promotions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/promotions/qr?code=busan1102 — 프로모션 링크의 QR (SVG).
 *
 * 사장님이 우클릭 저장해서 배너·포스터에 인쇄한다. 손님이 찍으면 `/start?p=busan1102`
 * 가 열리고, 설문 후 가입하면 할인이 자동 적용된다 — **코드 입력 없음.**
 *
 * # 왜 서버에서 만드나
 * QR 인코더(리드-솔로몬 부호)는 무겁다. 클라이언트에서 만들면 그 코드가 번들에 실리는데,
 * 이 앱은 번들을 고객 페이지와 공유한다 — **admin 한 명 편하자고 전 고객에게 무거운
 * 코드를 내려보낼 이유가 없다.**
 *
 * # 오류 정정 레벨 M
 * 인쇄물은 구겨지고 조명이 나쁘다. L(7%)은 부스 배너에서 잘 안 읽히고, H(30%)는
 * 무늬가 빽빽해져 저해상도 인쇄에서 오히려 나빠진다. M(15%)이 인쇄물 표준.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 })
  }

  const code = normalizePromoCode(new URL(req.url).searchParams.get('code'))
  if (!code) {
    return NextResponse.json({ code: 'INVALID_CODE', message: '코드가 올바르지 않아요' }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'
  const target = `${siteUrl}/start?p=${code}`

  const svg = await QRCode.toString(target, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2, // 여백(quiet zone) — 없으면 인쇄물에서 인식률이 떨어진다
    color: { dark: '#16140f', light: '#FFFFFF' },
  })

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      // admin 전용 + 코드별 고정 이미지라 짧게 캐시.
      'Cache-Control': 'private, max-age=300',
    },
  })
}
