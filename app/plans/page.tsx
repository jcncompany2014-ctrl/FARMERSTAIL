import { permanentRedirect } from 'next/navigation'

/**
 * /plans — 웹 정기배송 안내(2026-06-13 ~ 2026-10-10).
 *
 * ★2026-10-10 웹 리뉴얼(사장님 "웹 = 단품 가게, 정기배송은 앱" · 기획서 D1): 웹에서 정기배송을 안내·신청하지 않는다.
 *  옛 주소는 새 가게로 308(기획서 §5.1 — 내부 링크가 이미 0 인 고아 주소였다). 정기배송 안내는 앱 소개(/app).
 *  예전 화면은 git 이력에 있다.
 */
export default function PlansPage() {
  permanentRedirect('/store')
}
