import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/PublicPageShell'
import LegalDocument, {
  Section,
  UL,
} from '@/components/LegalDocument'
import { business } from '@/lib/business'

export const metadata: Metadata = {
  title: '환불 정책',
  description:
    '파머스테일의 교환·환불·반품 정책. 전자상거래법 제17조에 따른 청약철회 절차와 정기배송 해지 정책을 안내합니다.',
  robots: { index: true, follow: true },
}

const EFFECTIVE_DATE = '2026-04-22'

/**
 * 환불 정책.
 * 전자상거래법 제17조 (청약철회 등) 및 제18조 (청약철회 효과)에
 * 근거한 소비자 보호 조항을 명시한다. 식품류 특성상 일부 제한이
 * 있음을 분명히 표시한다.
 */
export default function RefundPage() {
  return (
    <PublicPageShell>
      <LegalDocument
        eyebrow="Refund Policy"
        title="환불 정책"
        effectiveDate={EFFECTIVE_DATE}
        summary={
          <>
            상품 수령 후 <b>7일 이내 단순 변심 환불</b>이 가능하며,{' '}
            <b>상품 하자 시 3개월 이내</b> 교환·환불을 보장합니다. 개봉·
            섭취한 식품은 위생상의 이유로 단순 변심 환불이 제한될 수
            있습니다. 정기배송은 다음 결제일 전일까지 언제든지 해지할 수
            있습니다.
          </>
        }
      >
        <Section title="1. 기본 원칙">
          <p>
            {business.companyName}은 전자상거래법 등 관계 법령에 따라
            회원에게 구매한 상품에 대한 교환·환불 권리를 보장합니다.
          </p>
        </Section>

        <Section title="2. 단순 변심에 의한 청약철회">
          <UL>
            <li>
              <b>기간:</b> 상품 수령일로부터 <b>7일 이내</b>
            </li>
            <li>
              <b>방법:</b> 마이페이지 &gt; 주문내역에서 &ldquo;반품
              신청&rdquo; 또는 고객센터({business.email}) 문의
            </li>
            <li>
              <b>반품 비용:</b> 회원 부담 (왕복 배송비)
            </li>
            <li>
              <b>환불 처리:</b> 회사가 반품 상품을 확인한 날로부터
              3영업일 이내 원 결제수단으로 환불
            </li>
          </UL>
        </Section>

        <Section title="3. 단순 변심 환불이 제한되는 경우">
          <p>
            다음의 경우에는 전자상거래법 제17조 제2항에 따라 단순 변심에
            의한 청약철회가 제한됩니다.
          </p>
          <UL>
            <li>
              회원의 책임 있는 사유로 상품이 멸실·훼손된 경우 (단, 상품
              확인을 위해 포장을 훼손한 경우는 제외)
            </li>
            <li>
              회원의 사용 또는 일부 소비로 상품의 가치가 현저히 감소한
              경우 — <b>개봉 후 섭취한 식품</b>이 이에 해당합니다.
            </li>
            <li>
              시간의 경과에 의하여 재판매가 곤란할 정도로 상품 등의
              가치가 현저히 감소한 경우 — 유통기한이 임박한 식품이 이에
              해당합니다.
            </li>
            <li>
              복제가 가능한 상품 등의 포장을 훼손한 경우
            </li>
          </UL>
          <p
            className="mt-2 text-[11.5px]"
            style={{ color: 'var(--muted)' }}
          >
            ※ 단순 개봉 후 미섭취 상태의 반품은 가능 여부를 고객센터에
            먼저 문의해 주세요.
          </p>
        </Section>

        <Section title="4. 상품 하자·오배송에 의한 환불">
          <UL>
            <li>
              <b>기간:</b> 상품 수령일로부터 <b>3개월 이내</b> 또는
              하자를 안 날로부터 <b>30일 이내</b>
            </li>
            <li>
              <b>대상:</b> 상품 자체의 결함, 유통기한 초과, 오배송,
              파손 상태 배송 등
            </li>
            <li>
              <b>방법:</b> 마이페이지에서 반품 신청 시 하자 내용을
              적어 주시거나, 가능하시면 사진을 고객센터 이메일로
              보내주시면 빠른 처리에 도움이 됩니다.
            </li>
            <li>
              <b>반품 비용:</b> 전액 회사 부담
            </li>
            <li>
              <b>환불 처리:</b> 회사가 하자를 확인한 날로부터 3영업일
              이내 원 결제수단으로 환불 또는 동일 상품으로 교환
            </li>
          </UL>
        </Section>

        <Section title="5. 환불 방법 및 기간">
          <UL>
            <li>
              <b>신용/체크카드:</b> 카드 승인 취소 (카드사에 따라 영업일
              기준 3~7일 소요)
            </li>
            <li>
              <b>가상계좌:</b> 회원이 고지한 환불 계좌로 입금 (영업일
              기준 1~3일 소요)
            </li>
            <li>
              <b>간편결제:</b> 간편결제사를 통해 결제 취소
            </li>
            <li>
              <b>적립금:</b> 마이페이지 적립금으로 환급
            </li>
          </UL>
          <p>
            회사는 반품 상품 수령 및 환불 사유 확인일로부터 3영업일
            이내에 환불 절차를 진행합니다. 단, 카드사·은행 등의 처리
            일정에 따라 실제 입금까지의 기간은 달라질 수 있습니다.
          </p>
        </Section>

        <Section title="6. 정기배송 해지 및 환불">
          <UL>
            <li>
              회원은 마이페이지 &gt; 정기배송 관리에서 언제든지 정기배송을
              해지할 수 있습니다.
            </li>
            <li>
              다음 결제 예정일 <b>전일 24시까지</b> 해지할 경우 다음
              회차 결제가 청구되지 않습니다.
            </li>
            <li>
              이미 결제·발송된 회차에 대한 단순 변심 환불은 일반
              주문과 동일한 기준이 적용됩니다.
            </li>
          </UL>
        </Section>

        <Section title="7. 포인트·쿠폰 환불">
          <UL>
            <li>
              결제 시 사용한 포인트는 환불 금액에 비례하여 계정에
              복원됩니다.
            </li>
            <li>
              쿠폰을 사용한 주문이 환불되는 경우, 쿠폰 유효기간이
              남아있으면 복원되며, 만료된 쿠폰은 복원되지 않습니다.
            </li>
            <li>
              리뷰 작성 등으로 적립된 포인트는 환불 대상 상품의 리뷰가
              삭제될 경우 회수될 수 있습니다.
            </li>
          </UL>
        </Section>

        <Section title="8. 반품 주소">
          <UL>
            <li>{business.address}</li>
            <li>
              반품 전 반드시 고객센터({business.email}) 또는
              마이페이지에서 반품 신청을 먼저 진행해 주세요. 사전 접수
              없이 임의 발송된 상품은 처리가 지연될 수 있습니다.
            </li>
          </UL>
        </Section>

        <Section title="9. 문의">
          <p>
            환불 관련 문의는{' '}
            <a
              href={`mailto:${business.email}`}
              className="font-bold hover:underline"
              style={{ color: 'var(--terracotta)' }}
            >
              {business.email}
            </a>{' '}
            또는{' '}
            <a
              href={`tel:${business.phone}`}
              className="font-bold hover:underline"
              style={{ color: 'var(--terracotta)' }}
            >
              {business.phone}
            </a>
            으로 연락해 주세요. 전체 이용 조건은{' '}
            <Link
              href="/legal/terms"
              className="font-bold hover:underline"
              style={{ color: 'var(--terracotta)' }}
            >
              이용약관
            </Link>
            에서 확인하실 수 있습니다.
          </p>
        </Section>
      </LegalDocument>
    </PublicPageShell>
  )
}
