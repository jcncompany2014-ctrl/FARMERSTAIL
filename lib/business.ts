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

export const business: BusinessInfo = {
  companyName: "(주)Farmer's Tail",
  brandName: '파머스테일',
  ceo: '안성민, 이준호',
  businessNumber: '243-06-03606',
  mailOrderNumber: placeholder, // 통신판매업 신고 완료 후 'XXXX-인천연수-XXXX호' 형식으로 교체
  address: '인천광역시 연수구 송도동 171, 121호',
  phone: '070-4066-1333',
  email: 'story@farmerstail.kr',
  kakaoChannelUrl: null, // 카카오 채널 만들면 'https://pf.kakao.com/_xxxxx/chat' 로 교체
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
