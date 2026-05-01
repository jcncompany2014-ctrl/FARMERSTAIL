import type { Metadata } from 'next'
import Link from 'next/link'
import AuthAwareShell from "@/components/AuthAwareShell"
import LegalDocument, {
  Section,
  UL,
} from '@/components/LegalDocument'
import CookieConsentResetLink from '@/components/CookieConsentResetLink'
import { business } from '@/lib/business'

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    '파머스테일의 개인정보 수집·이용·제공·파기에 관한 방침. 개인정보보호법 제30조에 따라 처리 목적, 보유 기간, 제3자 제공, 정보주체의 권리를 공개합니다.',
  robots: { index: true, follow: true },
}

const EFFECTIVE_DATE = '2026-04-22'

/**
 * 개인정보처리방침.
 *
 * 개인정보보호법 제30조 기재사항:
 *   - 개인정보의 처리 목적
 *   - 처리하는 개인정보의 항목 및 보유 기간
 *   - 개인정보의 제3자 제공
 *   - 개인정보처리의 위탁
 *   - 정보주체와 법정대리인의 권리·의무 및 행사방법
 *   - 개인정보의 안전성 확보조치
 *   - 개인정보 자동 수집 장치의 설치·운영·거부
 *   - 개인정보 보호책임자
 *   - 개인정보 처리방침의 변경
 */
export default function PrivacyPage() {
  return (
    <AuthAwareShell><div className="mx-auto" style={{ maxWidth: 880, background: "var(--bg)" }}>
      <LegalDocument
        eyebrow="Privacy Policy"
        title="개인정보처리방침"
        effectiveDate={EFFECTIVE_DATE}
        summary={
          <>
            회원가입·주문·배송에 필요한 최소한의 개인정보만 수집하며,
            목적 외 사용하지 않습니다. 결제 정보는 토스페이먼츠를 통해
            처리되고 카드번호 등 민감 정보는 저장하지 않습니다. 회원
            탈퇴 시 PII는 즉시 익명화되며, 주문 기록은 전자상거래법에
            따라 5년간 보관됩니다. 자세한 내용은 아래 본문을 확인해
            주세요.
          </>
        }
      >
        <Section title="1. 수집하는 개인정보 항목 및 방법">
          <p>
            {business.companyName}(이하 &ldquo;회사&rdquo;)는 서비스
            제공을 위해 다음의 개인정보를 수집합니다.
          </p>

          <p
            className="font-bold text-[12.5px] mt-3"
            style={{ color: 'var(--ink)' }}
          >
            필수 항목
          </p>
          <UL>
            <li>
              <b>회원가입 시:</b> 이메일, 비밀번호, 카카오 로그인 시
              카카오 계정 식별자 및 프로필 닉네임
            </li>
            <li>
              <b>주문/배송 시:</b> 수령인 이름, 전화번호, 배송지 주소,
              우편번호, 배송 요청사항
            </li>
            <li>
              <b>결제 시:</b> 결제 수단 정보는 토스페이먼츠(주)를 통해
              처리되며, 회사는 결제 상태, 거래 ID, 결제 금액, 결제
              방식(카드·가상계좌 등)만 수신·저장합니다.
            </li>
            <li>
              <b>자동 수집:</b> 접속 IP, 접속 일시, 쿠키, 기기 정보,
              서비스 이용 기록
            </li>
          </UL>

          <p
            className="font-bold text-[12.5px] mt-3"
            style={{ color: 'var(--ink)' }}
          >
            선택 항목
          </p>
          <UL>
            <li>
              반려견 프로필: 이름, 견종, 생년월일, 체중, 중성화 여부,
              건강 상태
            </li>
            <li>SMS/이메일 마케팅 수신 동의</li>
          </UL>
        </Section>

        <Section title="2. 개인정보의 처리 목적">
          <UL>
            <li>회원 가입 및 관리, 본인 확인, 고객 문의 응대</li>
            <li>상품 주문, 결제 처리, 배송, 환불, 정기배송 관리</li>
            <li>반려견 맞춤 제품 추천 및 건강 관련 안내 제공</li>
            <li>
              관련 법령 준수를 위한 기록 보관 (전자상거래법, 부가가치세법
              등)
            </li>
            <li>
              동의한 회원에 한해 이벤트, 프로모션, 신상품 정보 안내
            </li>
            <li>
              서비스 품질 개선을 위한 접속 통계 분석 (개인 식별 불가
              형태로 가공)
            </li>
          </UL>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <p>
            회원 탈퇴 시 회원의 개인정보는 즉시 파기되거나 익명화됩니다.
            단, 관련 법령에 따라 다음 정보는 일정 기간 보관됩니다.
          </p>
          <UL>
            <li>
              <b>주문 및 결제 기록:</b> 5년 (전자상거래법 제6조)
            </li>
            <li>
              <b>소비자 불만 및 분쟁 처리 기록:</b> 3년 (전자상거래법
              제6조)
            </li>
            <li>
              <b>표시·광고에 관한 기록:</b> 6개월 (전자상거래법 제6조)
            </li>
            <li>
              <b>로그인 기록:</b> 3개월 (통신비밀보호법)
            </li>
            <li>
              <b>세금 관련 기록:</b> 5년 (국세기본법)
            </li>
          </UL>
          <p>
            보관 기간 중인 정보는 해당 법령이 정한 목적 외의 용도로는
            이용되지 않으며, 보관 기간 만료 후 즉시 파기됩니다.
          </p>
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          <p>
            회사는 원칙적으로 회원의 개인정보를 제3자에게 제공하지
            않습니다. 단, 다음의 경우는 예외로 합니다.
          </p>
          <UL>
            <li>회원이 사전에 동의한 경우</li>
            <li>
              법령의 규정에 의하거나, 수사 목적으로 법령에 정해진
              절차와 방법에 따라 수사기관의 요구가 있는 경우
            </li>
          </UL>
        </Section>

        <Section title="5. 개인정보 처리의 위탁">
          <p>
            회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보
            처리업무를 위탁하고 있습니다.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr
                  style={{
                    background: 'var(--bg)',
                    color: 'var(--ink)',
                  }}
                >
                  <th
                    className="px-2 py-1.5 text-left font-bold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    수탁사
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-bold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    위탁 업무
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    토스페이먼츠(주)
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    결제 처리, 환불 처리
                  </td>
                </tr>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    Supabase Inc.
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    회원 인증, 데이터베이스 운영
                  </td>
                </tr>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    Vercel Inc.
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    웹 서비스 호스팅, CDN
                  </td>
                </tr>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    (주)카카오
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    카카오 소셜 로그인, 주소 검색 API
                  </td>
                </tr>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    택배 운송업체
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    상품 배송
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            회사는 위탁 계약 체결 시 개인정보보호법 제26조에 따라 위탁
            업무 수행 목적 외 개인정보 처리 금지, 기술적·관리적 보호조치,
            재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한
            사항을 계약서 등 문서에 명시하고 수탁자가 개인정보를 안전하게
            처리하는지를 감독하고 있습니다.
          </p>

          <p className="mt-4 font-bold" style={{ color: 'var(--text)' }}>
            국외 이전 (개인정보보호법 제28조의8)
          </p>
          <div className="mt-2 overflow-x-auto">
            <table
              className="w-full text-[12px]"
              style={{ borderCollapse: 'collapse' }}
            >
              <thead>
                <tr style={{ background: 'var(--bg-2)' }}>
                  <th
                    className="text-left px-2 py-1.5 font-bold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    수탁자
                  </th>
                  <th
                    className="text-left px-2 py-1.5 font-bold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    이전 국가
                  </th>
                  <th
                    className="text-left px-2 py-1.5 font-bold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    이전 항목·시기·방법
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    Supabase Inc.
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    미국 (AWS us-east)
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    회원가입·로그인 정보, 주문/결제 메타데이터
                    <br />
                    회원 행위 발생 시점에 상시
                    <br />
                    HTTPS / TLS 1.2 이상 암호화 전송
                  </td>
                </tr>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    Vercel Inc.
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    미국 (글로벌 CDN, 1차 KR 리전)
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    웹 요청 헤더, IP, User-Agent
                    <br />
                    서비스 이용 시점에 상시
                    <br />
                    HTTPS / TLS 1.2 이상 암호화 전송
                  </td>
                </tr>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    Resend (Recur Labs Inc.)
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    미국
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    이메일 주소, 거래·알림 메시지 본문
                    <br />
                    이메일 발송 시점
                    <br />
                    HTTPS API 호출
                  </td>
                </tr>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    Anthropic, PBC
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    미국
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    반려견 영양 분석을 위한 익명화된 설문 응답 (이름·연락처
                    포함하지 않음)
                    <br />
                    분석 요청 시점
                    <br />
                    HTTPS API 호출, Anthropic 정책상 학습용 미사용
                  </td>
                </tr>
                <tr>
                  <td
                    className="px-2 py-1.5 font-semibold"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    Sentry (Functional Software Inc.)
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    미국
                  </td>
                  <td
                    className="px-2 py-1.5"
                    style={{ border: '1px solid var(--rule)' }}
                  >
                    오류 발생 시 stack trace, route, 사용자 식별번호
                    (PII 자동 스크러빙)
                    <br />
                    오류 발생 시점에만
                    <br />
                    HTTPS / 암호화
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            회원은 개인정보 국외 이전을 거부할 권리가 있으며, 거부 시 일부
            서비스 이용이 제한될 수 있습니다. 거부를 원하시면 개인정보 보호
            책임자에게 연락해 주세요.
          </p>
        </Section>

        <Section title="6. 정보주체의 권리와 행사 방법">
          <p>
            회원은 언제든지 자신의 개인정보에 대해 다음의 권리를 행사할
            수 있습니다.
          </p>
          <UL>
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정·삭제 요구</li>
            <li>처리 정지 요구</li>
            <li>회원 탈퇴(동의 철회) 요구</li>
          </UL>
          <p>
            회원은 마이페이지에서 직접 정보를 확인·수정하거나{' '}
            <Link
              href="/mypage/delete"
              className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
            >
              회원 탈퇴
            </Link>
            할 수 있으며, 기타 요청 사항은 개인정보보호 책임자에게 이메일로
            연락하시면 지체 없이 처리합니다.
          </p>
        </Section>

        <Section title="7. 개인정보의 파기 절차 및 방법">
          <UL>
            <li>
              전자 파일 형태의 정보는 복구 및 재생이 불가능한 기술적
              방법으로 삭제합니다.
            </li>
            <li>
              종이에 출력된 정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.
            </li>
            <li>
              관련 법령에 따라 보관해야 하는 정보는 별도의 데이터베이스나
              파일로 분리하여 안전하게 보관 후 기간 만료 시 파기합니다.
            </li>
          </UL>
        </Section>

        <Section title="8. 개인정보의 안전성 확보 조치">
          <UL>
            <li>
              <b>기술적 조치:</b> 개인정보 암호화(HTTPS 전송 구간 암호화,
              비밀번호 해시 저장), 접근 통제 시스템, 행 수준 보안(Row
              Level Security)
            </li>
            <li>
              <b>관리적 조치:</b> 개인정보 취급자 최소화, 내부 관리계획
              수립·시행, 정기 보안 교육
            </li>
            <li>
              <b>물리적 조치:</b> 데이터센터 및 자료보관실의 접근 통제
              (Supabase/Vercel 데이터센터 보안 정책 적용)
            </li>
          </UL>
        </Section>

        <Section title="9. 쿠키 및 자동 수집 장치">
          <p>
            서비스는 로그인 상태 유지, 장바구니 정보 저장, 서비스 이용
            분석 등의 목적으로 쿠키를 사용합니다. 쿠키는 용도에 따라
            다음과 같이 구분됩니다.
          </p>
          <UL>
            <li>
              <b>필수 쿠키:</b> 로그인 세션 (sb-access-token, sb-refresh-token),
              장바구니 (cart 식별), 보안 토큰 (CSRF), 앱 컨텍스트 감지
              (ft_app), 쿠키 동의 기록 (ft_consent) 등. 서비스 기본 기능에
              필요해 동의 여부와 무관하게 사용됩니다.
            </li>
            <li>
              <b>분석 쿠키:</b> 방문 패턴, 페이지 체류 시간, 클릭 흐름을
              집계해 서비스 개선에 활용합니다 (Google Analytics 4 — _ga, _gid).
              개별 식별 불가능한 익명 통계만 수집합니다.
            </li>
            <li>
              <b>광고·마케팅 쿠키:</b> 관심사 기반 광고, 전환 추적에
              사용됩니다 (Meta Pixel — _fbp). iOS Safari 의 ATT 권한
              거부 시 자동 비활성화됩니다.
            </li>
          </UL>

          <p className="mt-3 font-bold" style={{ color: 'var(--text)' }}>
            자동 수집 항목
          </p>
          <UL>
            <li>
              IP 주소, User-Agent (브라우저/OS 종류), 접속 시각·일시
            </li>
            <li>
              방문 페이지 경로, referrer (어떤 사이트에서 왔는지), 광고
              유입 파라미터 (UTM)
            </li>
            <li>
              화면 해상도, 다크/라이트 모드, 언어 설정
            </li>
            <li>
              쿠키 동의 상태, 푸시 알림 권한, 위치 권한 (사용자 명시 허용 시)
            </li>
          </UL>

          <p className="mt-2">
            분석·광고 쿠키는 최초 방문 시 노출되는 쿠키 설정 배너에서
            동의 여부를 직접 선택할 수 있으며, <CookieConsentResetLink />
            를 눌러 언제든 재설정할 수 있습니다. 브라우저 설정에서 쿠키
            저장을 차단해도 동일한 효과이지만, 일부 기능(예: 로그인 유지)
            사용이 제한될 수 있습니다.
          </p>
        </Section>

        <Section title="10. 만 14세 미만 아동의 개인정보">
          <p>
            회사는 만 14세 미만 아동의 회원가입을 받지 않습니다. 만 14세
            미만 아동이 회원으로 가입한 것이 확인될 경우 즉시 계정을
            삭제합니다.
          </p>
        </Section>

        <Section title="11. 개인정보 보호책임자">
          <UL>
            <li>성명: {business.privacyOfficer}</li>
            <li>이메일: {business.privacyOfficerEmail}</li>
            <li>
              연락처: {business.phone}
            </li>
          </UL>
          <p className="mt-2">
            개인정보 침해로 인한 신고·상담이 필요하신 경우 아래 기관에
            문의하실 수 있습니다.
          </p>
          <UL>
            <li>
              개인정보침해신고센터:{' '}
              <a
                href="https://privacy.kisa.or.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
              >
                privacy.kisa.or.kr
              </a>{' '}
              / 국번없이 118
            </li>
            <li>
              개인정보분쟁조정위원회:{' '}
              <a
                href="https://www.kopico.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
              >
                www.kopico.go.kr
              </a>{' '}
              / 1833-6972
            </li>
            <li>
              대검찰청 사이버범죄수사단:{' '}
              <a
                href="https://www.spo.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
              >
                www.spo.go.kr
              </a>{' '}
              / 02-3480-3573
            </li>
            <li>
              경찰청 사이버수사국:{' '}
              <a
                href="https://ecrm.cyber.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
              >
                ecrm.cyber.go.kr
              </a>{' '}
              / 국번없이 182
            </li>
          </UL>
        </Section>

        <Section title="12. 처리방침의 변경">
          <p>
            본 방침은 {EFFECTIVE_DATE}부터 시행됩니다. 내용 추가, 삭제,
            수정이 있을 경우 변경사항 시행 7일 전부터 서비스 초기화면을
            통해 고지합니다.
          </p>
        </Section>
      </LegalDocument>
    </div></AuthAwareShell>
  )
}
