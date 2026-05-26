/**
 * 사업자 정보 — single source of truth.
 *
 * 전자상거래법 제10조 / 개인정보보호법 제26조에서 요구하는 필수 표기
 * 항목. 운영 정보는 환경변수로 주입할 수도 있지만 (NEXT_PUBLIC_*),
 * 변경이 드문 회사 메타라 아래 const 에 직접 박는 게 단순.
 *
 * 통신판매업 신고번호는 신고 후 받은 정식 번호로 교체 필수.
 */

type BusinessInfo = {
  /** 상호 — 법인명 또는 개인사업자명 */
  companyName: string
  /** 서비스 브랜드명 — 상호와 다르면 구분 */
  brandName: string
  /** 대표자 성명 */
  ceo: string
  /** 사업자등록번호 (10자리, 하이픈 포함) */
  businessNumber: string
  /** 통신판매업 신고번호 */
  mailOrderNumber: string
  /** 사업장 소재지 전체 주소 */
  address: string
  /** 고객센터 전화번호 */
  phone: string
  /** 고객센터 이메일 */
  email: string
  /** 카카오 채널 1:1 채팅 URL (선택 — 비어있으면 footer 에 미노출).
   *  ex) "https://pf.kakao.com/_xxxxx/chat" — 카카오 채널 관리자에서 발급. */
  kakaoChannelUrl: string | null
  /** 개인정보보호 책임자 */
  privacyOfficer: string
  /** 개인정보보호 책임자 이메일 */
  privacyOfficerEmail: string
  /** 호스팅 서비스 제공자 (선택 — 전자상거래법 명시) */
  hostingProvider: string
}

const placeholder = '(등록 예정)'

// 운영 출시 후 정식 발급되는 항목은 env 로 주입 가능하게 — 코드 redeploy
// 없이 admin 이 Vercel 대시보드에서 즉시 갱신할 수 있도록.
// NEXT_PUBLIC_* 로 두면 클라이언트 footer 에서도 보임.
const mailOrderFromEnv = process.env.NEXT_PUBLIC_MAIL_ORDER_NUMBER?.trim()
const kakaoFromEnv = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL?.trim()

export const business: BusinessInfo = {
  // 사업자등록증 상의 정식 상호 (개인사업자 — 법인 X).
  // 영문 표기는 사업자등록증 기준 대문자 "Farmer's Tail" (통신판매업
  // 신고증에는 소문자로 등재됐으나 Toss 검수는 사업자등록증 우선).
  // 상법 §20: 회사가 아닌 자가 상호에 (주)·㈜·주식회사 등 회사 표기
  // 사용 시 과태료. Toss 입점심사 검수 항목 (홈페이지 하단 상호 일치).
  companyName: "파머스테일 (Farmer's Tail)",
  brandName: '파머스테일',
  ceo: '안성민, 이준호',
  businessNumber: '243-06-03606',
  // 통신판매업 신고증 — 인천연수구청장 발급, 2026-05-21.
  // 신고번호는 NEXT_PUBLIC_MAIL_ORDER_NUMBER 로 override 가능 (변경 시
  // 코드 redeploy 없이 Vercel env 만 갱신). 미설정 시 아래 default 사용.
  mailOrderNumber: mailOrderFromEnv && mailOrderFromEnv.length > 0
    ? mailOrderFromEnv
    : '제2026-인천연수구-1436호',
  // 사업자등록증 / 통신판매업 신고증 상의 도로명 주소 — Toss 입점심사 시
  // "홈페이지 하단 사업자등록증 상의 사업장 주소" 항목 검수 대상.
  address:
    '인천광역시 연수구 송도과학로28번길 50, 더샵 송도트리플타워 West 1층 121호',
  phone: '070-4066-1333',
  email: 'story@farmerstail.kr',
  // 카카오 채널 발급 후 NEXT_PUBLIC_KAKAO_CHANNEL_URL 에 등록.
  kakaoChannelUrl: kakaoFromEnv && kakaoFromEnv.length > 0 ? kakaoFromEnv : null,
  privacyOfficer: '안성민, 이준호',
  privacyOfficerEmail: 'story@farmerstail.kr',
  hostingProvider: 'Vercel Inc. / Supabase Inc.',
}

/**
 * 통신판매업 신고번호 공정위 사업자정보 조회 링크.
 * 공정거래위원회가 제공하는 공식 확인 페이지로 연결해야
 * 소비자가 신고번호의 실재 여부를 검증할 수 있다.
 */
export function ftcLookupUrl(): string {
  if (business.mailOrderNumber === placeholder) return '#'
  // FTC 사업자정보 조회는 ?wrkr_no=<사업자등록번호> 형식
  const bizNum = business.businessNumber.replace(/-/g, '')
  if (!bizNum || bizNum === placeholder.replace(/-/g, '')) return '#'
  return `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${encodeURIComponent(bizNum)}`
}
