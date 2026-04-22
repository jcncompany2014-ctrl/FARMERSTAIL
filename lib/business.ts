/**
 * 사업자 정보 — single source of truth.
 *
 * 전자상거래법 제10조 / 개인정보보호법 제26조에서 요구하는 필수 표기
 * 항목을 환경변수로 주입하고, 세팅 전에는 플레이스홀더로 대체한다.
 * 실제 값은 `.env.local` 또는 Vercel Project Settings > Environment
 * Variables에 채워 넣는다.
 *
 * 클라이언트 컴포넌트(푸터)에서도 참조하기 때문에 모두
 * NEXT_PUBLIC_ 접두사를 쓴다. 공개가 법적으로 요구되는 정보라서
 * 노출되어도 무방하다.
 *
 * 값이 비어 있으면 `(등록 예정)`이 렌더링되므로, 런칭 직전
 * 체크리스트에서 이 필드들을 반드시 채웠는지 확인해야 한다.
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
  /** 개인정보보호 책임자 */
  privacyOfficer: string
  /** 개인정보보호 책임자 이메일 */
  privacyOfficerEmail: string
  /** 호스팅 서비스 제공자 (선택 — 전자상거래법 명시) */
  hostingProvider: string
}

const placeholder = '(등록 예정)'

function read(
  envKey: keyof NodeJS.ProcessEnv,
  fallback: string = placeholder
): string {
  const raw = process.env[envKey]
  if (!raw || !raw.trim()) return fallback
  return raw.trim()
}

export const business: BusinessInfo = {
  companyName: read(
    'NEXT_PUBLIC_BUSINESS_COMPANY_NAME',
    '파머스테일 (Farmer\'s Tail)'
  ),
  brandName: "파머스테일",
  ceo: read('NEXT_PUBLIC_BUSINESS_CEO'),
  businessNumber: read('NEXT_PUBLIC_BUSINESS_NUMBER'),
  mailOrderNumber: read('NEXT_PUBLIC_BUSINESS_MAIL_ORDER_NUMBER'),
  address: read('NEXT_PUBLIC_BUSINESS_ADDRESS'),
  phone: read('NEXT_PUBLIC_BUSINESS_PHONE', '1644-0000'),
  email: read('NEXT_PUBLIC_BUSINESS_EMAIL', 'support@farmerstail.com'),
  privacyOfficer: read('NEXT_PUBLIC_BUSINESS_PRIVACY_OFFICER'),
  privacyOfficerEmail: read(
    'NEXT_PUBLIC_BUSINESS_PRIVACY_OFFICER_EMAIL',
    'privacy@farmerstail.com'
  ),
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
