import type { Metadata } from 'next'
import { shareCard } from '@/lib/seo/share-card'
import { loadLinkContent } from '@/lib/link-content/load'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import LinkBody from './LinkBody'

/**
 * /link — 인스타 프로필용 링크인바이오 (litt.ly 대체, 2026-09-24).
 *
 * 모양 = 웹 시안 WEB-C12(2026-10-10 웹 리뉴얼) — 흰 바탕·먹색, 가게 머리줄 없이 한 장짜리:
 *   도장 로고·이름 → 바로 가기 버튼(lib/links BIO_LINKS) → 알려드려요(번호 공지줄 + 배너) → 파머스테일의 하루(사진 줄)
 *   → 숲색 앱 띠(공식 배지) → 카카오톡 문의 → 인스타·주소.
 * ★첫 버튼은 앱 소개(/app) — 토스 일반결제 심사 전이라 인스타 손님은 본 사이트로 보내지 않는다(규칙165).
 *   시안의 첫 줄 '레시피 고르기(공식몰)'는 심사가 끝나면 lib/links 에 되돌린다.
 *
 * 이벤트/모집 배너·'파머스테일의 하루' 사진은 어드민(/admin/link) 저장값(lib/link-content/load.ts)이 정본이고,
 * 고정 콘텐츠(버튼·스토어 카드 컷·스토어 링크)는 lib/links.ts. 클릭 추적은 UTM → 자사 퍼널의 기존 수집.
 * 배너 기간: 시작 전 숨김 → 진행 중 → 종료 후 14일간 회색 "기간 종료"(클릭 불가) → 자동 숨김
 * (lib/link-content/status.ts, 사장님 2026-09-26). 페이지는 5분 ISR — 어드민 저장은 revalidatePath 로 즉시.
 * 진입 움직임(도장 '쿵'·한 박자씩 떠오르기·눌림)은 사장님 2026-09-25 요청이라 시안(정지 화면) 위에 그대로 둔다.
 * ⛔사진은 실물·생활감 스냅만.
 */
const DESCRIPTION = '파머스테일 — 신선 화식, 앱 맞춤 정기배송, 이벤트 바로가기'
export const metadata: Metadata = {
  title: '링크 모음',
  description: DESCRIPTION,
  alternates: { canonical: '/link' },
  // 자기 공유 카드 — 없으면 루트 카드(홈 제목·주소)를 물려받았다(2026-10-12 점검). 인스타 소개 링크라 가장 많이 공유된다.
  ...shareCard('링크 모음', DESCRIPTION, '/link'),
}

export const revalidate = 300

/** 본문은 LinkBody(서포터즈 /link/코드 와 같이 쓴다). */
export default async function LinkInBioPage() {
  const content = await loadLinkContent(todayKstIsoDate())
  return <LinkBody content={content} />
}
