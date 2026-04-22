import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/PublicPageShell'
import LegalDocument, {
  Article,
  OL,
  UL,
} from '@/components/LegalDocument'
import { business } from '@/lib/business'

export const metadata: Metadata = {
  title: '이용약관',
  description:
    '파머스테일 서비스 이용약관. 회원가입, 주문·결제·배송·환불, 회원 의무, 책임 제한, 분쟁 해결 절차를 규정합니다.',
  robots: { index: true, follow: true },
}

const EFFECTIVE_DATE = '2026-04-22'

/**
 * 이용약관 — Terms of Service.
 *
 * 전자상거래법, 약관의 규제에 관한 법률, 민법 상의 전자상거래
 * 표준약관(공정위 고시)을 기반으로 파머스테일 사업 특성(반려견 식품
 * 정기배송 D2C)에 맞춰 변경한 초안. 법률 검토 전 사용 시 반드시
 * 자문을 받을 것.
 */
export default function TermsPage() {
  return (
    <PublicPageShell>
      <LegalDocument
        eyebrow="Terms of Service"
        title="이용약관"
        effectiveDate={EFFECTIVE_DATE}
        summary={
          <>
            파머스테일 서비스 이용 시 적용되는 기본 규칙입니다. 주문·결제는
            토스페이먼츠를 통해 처리되고, 수령 후 7일 이내 단순 변심 환불이
            가능하며, 상품 하자 시 3개월 내 교환·환불을 보장합니다.{' '}
            <Link
              href="/legal/refund"
              className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
            >
              환불 정책 전문
            </Link>
            과{' '}
            <Link
              href="/legal/privacy"
              className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
            >
              개인정보처리방침
            </Link>
            을 함께 확인해 주세요.
          </>
        }
      >
        <Article number={1} title="목적">
          <p>
            본 약관은 {business.companyName}(이하 &ldquo;회사&rdquo;)이
            운영하는 &ldquo;파머스테일&rdquo; 서비스(이하 &ldquo;서비스&rdquo;)의
            이용에 관한 회사와 회원 간의 권리·의무 및 책임사항, 기타 필요한
            사항을 규정함을 목적으로 합니다.
          </p>
        </Article>

        <Article number={2} title="용어의 정의">
          <OL>
            <li>
              &ldquo;서비스&rdquo;란 회사가 제공하는 반려견 식품 및
              관련 용품의 판매, 정기배송, 반려견 건강 관련 콘텐츠 등
              파머스테일 브랜드로 제공되는 모든 온라인 서비스를 말합니다.
            </li>
            <li>
              &ldquo;회원&rdquo;이란 서비스에 가입하여 회사와 이용계약을
              체결한 자를 말합니다.
            </li>
            <li>
              &ldquo;정기배송&rdquo;이란 회원이 지정한 주기로 상품이
              자동 결제·발송되는 구독형 서비스를 말합니다.
            </li>
          </OL>
        </Article>

        <Article number={3} title="약관의 효력 및 변경">
          <OL>
            <li>
              본 약관은 서비스 초기 화면에 게시하거나 기타 방법으로
              회원에게 공지함으로써 효력이 발생합니다.
            </li>
            <li>
              회사는 관련 법령에 위배되지 않는 범위 내에서 약관을 변경할
              수 있으며, 변경 시 시행일 7일 전(회원에게 불리한 변경의
              경우 30일 전)부터 시행일 전일까지 공지합니다.
            </li>
            <li>
              회원이 변경된 약관에 동의하지 않을 경우, 시행일 전까지
              서비스를 해지할 수 있습니다. 시행일 이후에도 서비스를
              계속 이용한 경우 변경 약관에 동의한 것으로 봅니다.
            </li>
          </OL>
        </Article>

        <Article number={4} title="회원가입 및 계정">
          <OL>
            <li>
              회원가입은 이용자가 본 약관과 개인정보처리방침에 동의하고
              회사가 정한 양식에 따라 정보를 입력함으로써 신청하며,
              회사의 승낙으로 이용계약이 성립합니다.
            </li>
            <li>
              회원은 계정 정보를 정확하게 유지해야 하며, 타인에게
              양도·대여할 수 없습니다.
            </li>
            <li>
              회사는 다음 각 호에 해당하는 경우 가입을 거부하거나
              사후적으로 이용계약을 해지할 수 있습니다.
              <UL>
                <li>허위 정보를 기재하거나 타인의 정보를 도용한 경우</li>
                <li>이전에 회원 자격을 상실한 자가 재가입을 신청한 경우</li>
                <li>법령 또는 본 약관을 위반한 경우</li>
              </UL>
            </li>
          </OL>
        </Article>

        <Article number={5} title="서비스의 제공 및 변경">
          <OL>
            <li>
              회사는 상품의 판매, 배송, 정기배송 관리, 고객 문의 응대,
              회원 대상 프로모션 등을 제공합니다.
            </li>
            <li>
              회사는 상품의 품절, 정책 변경, 기술적 사유 등으로 서비스
              내용을 변경할 수 있으며, 변경 시 해당 내용을 공지합니다.
            </li>
            <li>
              회사는 시스템 점검, 천재지변, 통신 장애 등 불가피한 사유가
              있는 경우 일시적으로 서비스 제공을 중단할 수 있습니다.
            </li>
          </OL>
        </Article>

        <Article number={6} title="주문 및 계약 성립">
          <OL>
            <li>
              회원은 서비스에 게시된 상품 정보를 확인한 후 주문을 할 수
              있으며, 주문 시 배송지, 결제수단 등 필요 정보를 정확히
              입력해야 합니다.
            </li>
            <li>
              매매계약은 회원의 주문에 대해 회사가 결제 확인 및 주문
              접수 완료를 통지한 시점에 성립합니다.
            </li>
            <li>
              회사는 재고 부족, 결제 오류, 가격 오기재 등의 사유로
              주문을 수락하지 않을 수 있으며, 이 경우 지체 없이 회원에게
              통지하고 결제 금액을 환불합니다.
            </li>
          </OL>
        </Article>

        <Article number={7} title="결제">
          <OL>
            <li>
              회사는 토스페이먼츠(주)를 통해 결제를 처리합니다. 카드
              번호, 유효기간 등 민감 결제 정보는 회사 서버에 저장되지
              않습니다.
            </li>
            <li>
              정기배송 상품의 경우, 회원이 등록한 결제수단으로 각 배송
              회차의 결제 예정일에 자동 청구됩니다. 회원은 마이페이지에서
              정기배송을 언제든 해지할 수 있습니다.
            </li>
            <li>
              가상계좌 결제의 경우 입금 기한 내 입금이 확인되지 않으면
              주문이 자동 취소됩니다.
            </li>
          </OL>
        </Article>

        <Article number={8} title="배송">
          <OL>
            <li>
              배송지는 대한민국 내에 한하며, 도서·산간 지역은 추가
              배송비가 발생할 수 있습니다.
            </li>
            <li>
              회사는 결제 완료 후 평균 2영업일 이내에 상품을 발송하며,
              발송 후 일반적으로 1~3영업일 이내 배송이 완료됩니다.
              연휴, 물류사 사정, 품절 등의 사유로 지연될 수 있습니다.
            </li>
            <li>
              회원이 입력한 배송지 오류로 인한 미수령·오배송의 책임은
              회원에게 있습니다.
            </li>
          </OL>
        </Article>

        <Article number={9} title="청약철회 및 환불">
          <OL>
            <li>
              회원은 상품 수령일로부터 7일 이내에 별도 사유 없이 청약을
              철회할 수 있습니다.
            </li>
            <li>
              다음 각 호의 경우 청약철회가 제한됩니다(전자상거래법 제17조
              제2항).
              <UL>
                <li>
                  회원의 책임 있는 사유로 상품이 멸실·훼손된 경우 (단,
                  상품 확인을 위해 포장을 훼손한 경우는 제외)
                </li>
                <li>
                  회원의 사용 또는 일부 소비로 상품의 가치가 현저히
                  감소한 경우
                </li>
                <li>
                  시간이 지나 재판매가 곤란할 정도로 상품의 가치가
                  현저히 감소한 경우 (예: 유통기한이 임박한 식품)
                </li>
                <li>복제가 가능한 상품의 포장을 훼손한 경우</li>
              </UL>
            </li>
            <li>
              상품에 하자가 있거나 표시·광고 내용과 다른 경우, 수령일로부터
              3개월 이내 또는 하자를 안 날로부터 30일 이내에 교환·환불을
              요청할 수 있습니다.
            </li>
            <li>
              청약철회 시 상품 반환에 필요한 비용은 단순 변심의 경우
              회원이, 상품 하자 또는 오배송의 경우 회사가 부담합니다.
            </li>
            <li>
              환불은 반품 확인일로부터 3영업일 이내에 원 결제수단으로
              진행됩니다. 상세 절차는{' '}
              <Link
                href="/legal/refund"
                className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
              >
                환불 정책
              </Link>
              을 참고해 주세요.
            </li>
          </OL>
        </Article>

        <Article number={10} title="회원의 의무">
          <UL>
            <li>
              회원은 관계 법령, 본 약관, 회사가 공지한 주의사항을
              준수해야 합니다.
            </li>
            <li>
              회원은 서비스를 이용하여 다음 행위를 해서는 안 됩니다.
              <UL>
                <li>타인의 정보 도용, 허위 정보 기재</li>
                <li>회사의 서비스 운영을 방해하는 행위</li>
                <li>자동화된 수단(크롤링 등)으로 무단 수집하는 행위</li>
                <li>법령에 위반되거나 공서양속에 반하는 행위</li>
              </UL>
            </li>
          </UL>
        </Article>

        <Article number={11} title="회사의 의무 및 책임 제한">
          <OL>
            <li>
              회사는 법령과 본 약관이 금지하는 행위를 하지 않으며,
              지속적이고 안정적으로 서비스를 제공하기 위해 노력합니다.
            </li>
            <li>
              회사는 천재지변, 불가항력, 제3자의 고의 또는 과실로 인한
              서비스 장애에 대해서는 책임을 지지 않습니다.
            </li>
            <li>
              회사는 회원이 서비스를 이용하여 기대한 수익을 얻지 못하거나
              상실한 것에 대하여 책임을 지지 않습니다.
            </li>
          </OL>
        </Article>

        <Article number={12} title="회원 탈퇴 및 자격 상실">
          <OL>
            <li>
              회원은 언제든지 마이페이지 &gt; 회원 탈퇴 메뉴를 통해
              탈퇴할 수 있습니다. 탈퇴 시 개인정보는{' '}
              <Link
                href="/legal/privacy"
                className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
              >
                개인정보처리방침
              </Link>
              에 따라 처리됩니다.
            </li>
            <li>
              진행 중인 주문이 있는 경우, 해당 주문의 배송이 완료된
              뒤 탈퇴할 수 있습니다.
            </li>
            <li>
              회사는 회원이 본 약관을 위반하거나 타인에게 피해를 주는
              경우, 사전 통지 없이 회원 자격을 제한하거나 상실시킬 수
              있습니다.
            </li>
          </OL>
        </Article>

        <Article number={13} title="분쟁 해결 및 관할">
          <OL>
            <li>
              서비스 이용과 관련하여 회사와 회원 사이에 분쟁이 발생한
              경우, 양 당사자는 분쟁의 해결을 위해 성실히 협의합니다.
            </li>
            <li>
              협의에 의해 해결되지 않은 분쟁에 대해서는{' '}
              <a
                href="https://ecrb.kca.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                style={{ color: 'var(--terracotta)' }}
              >
                전자거래분쟁조정위원회
              </a>
              의 조정을 신청할 수 있습니다.
            </li>
            <li>
              본 약관은 대한민국 법을 준거법으로 하며, 회사의 본사
              소재지 관할 법원을 전속 관할 법원으로 합니다.
            </li>
          </OL>
        </Article>

        <Article number={14} title="부칙">
          <p>
            본 약관은 {EFFECTIVE_DATE}부터 시행합니다.
          </p>
        </Article>
      </LegalDocument>
    </PublicPageShell>
  )
}
