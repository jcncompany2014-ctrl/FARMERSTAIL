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

// R90-D C2 (D7): R89 fix 의 dynamic key access (`process.env[key]`) 는
// Next.js client bundle 에서 inline 되지 않음 — 모든 NEXT_PUBLIC_ 키가
// client 측에선 undefined 가 되어 default fallback 만 노출되는 버그.
// SiteFooter / error.tsx 등 client 컴포넌트에서 business 를 import 하므로,
// 모든 키를 literal `process.env.NEXT_PUBLIC_X` 비교로 unrolled —
// build 시점에 webpack/turbopack 이 string 으로 inline.
//
// 참고: `process.env[키변수]` 는 build 시 정적 분석 불가능 → client 번들에
// 그대로 남음 → 런타임에 client 의 `process.env` 는 {} 라 항상 undefined.
function pickEnv(value: string | undefined, fallback: string): string {
  const v = value?.trim()
  return v && v.length > 0 ? v : fallback
}

export const business: BusinessInfo = {
  // 사업자등록증 상의 정식 상호 (개인사업자 — 법인 X).
  // 영문 표기는 사업자등록증 기준 대문자 "Farmer's Tail" (통신판매업
  // 신고증에는 소문자로 등재됐으나 Toss 검수는 사업자등록증 우선).
  // 상법 §20: 회사가 아닌 자가 상호에 (주)·㈜·주식회사 등 회사 표기
  // 사용 시 과태료. Toss 입점심사 검수 항목 (홈페이지 하단 상호 일치).
  // [2026-06-11] dev hydration mismatch 관측 — 클라이언트 청크에 옛 상호
  // "(주)..." 가 인라인된 Turbopack stale cache 였음. 이 주석 추가가 모듈
  // 재컴파일을 강제 (캐시 무효화 처방 — OVERNIGHT_LOG 의 B1 팁 참고).
  companyName: pickEnv(
    process.env.NEXT_PUBLIC_BUSINESS_COMPANY_NAME,
    "파머스테일 (Farmer's Tail)",
  ),
  brandName: pickEnv(
    process.env.NEXT_PUBLIC_BUSINESS_BRAND_NAME,
    '파머스테일',
  ),
  ceo: pickEnv(process.env.NEXT_PUBLIC_BUSINESS_CEO, '안성민, 이준호'),
  businessNumber: pickEnv(
    process.env.NEXT_PUBLIC_BUSINESS_NUMBER,
    '243-06-03606',
  ),
  // 통신판매업 신고증 — 인천연수구청장 발급, 2026-05-21.
  mailOrderNumber: pickEnv(
    process.env.NEXT_PUBLIC_MAIL_ORDER_NUMBER,
    '제2026-인천연수구-1436호',
  ),
  // 사업자등록증 / 통신판매업 신고증 상의 도로명 주소 — Toss 입점심사 시
  // "홈페이지 하단 사업자등록증 상의 사업장 주소" 항목 검수 대상.
  address: pickEnv(
    process.env.NEXT_PUBLIC_BUSINESS_ADDRESS,
    '인천광역시 연수구 송도과학로28번길 50, 더샵 송도트리플타워 West 1층 121호',
  ),
  phone: pickEnv(process.env.NEXT_PUBLIC_BUSINESS_PHONE, '070-4066-1333'),
  email: pickEnv(
    process.env.NEXT_PUBLIC_BUSINESS_EMAIL,
    'story@farmerstail.kr',
  ),
  // 카카오 채널 1:1 채팅 (사장님 2026-07-17). env 로 덮어쓸 수 있고, 없으면 이 기본값.
  // http→https 로 승격(PWA mixed-content 방지). 채널 변경 시 NEXT_PUBLIC_KAKAO_CHANNEL_URL.
  kakaoChannelUrl: pickEnv(
    process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL,
    'https://pf.kakao.com/_qbJqX/chat',
  ),
  privacyOfficer: pickEnv(
    process.env.NEXT_PUBLIC_BUSINESS_PRIVACY_OFFICER,
    '안성민, 이준호',
  ),
  privacyOfficerEmail: pickEnv(
    process.env.NEXT_PUBLIC_BUSINESS_PRIVACY_OFFICER_EMAIL,
    'story@farmerstail.kr',
  ),
  hostingProvider: pickEnv(
    process.env.NEXT_PUBLIC_BUSINESS_HOSTING_PROVIDER,
    'Vercel Inc. / Supabase Inc.',
  ),
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
