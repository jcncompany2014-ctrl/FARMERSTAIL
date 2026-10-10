import type { Metadata } from 'next'
import Link from 'next/link'
import SiteShell from '@/components/store/SiteShell'
import { Section as WebSection, UL as WebUL } from '@/components/LegalDocument'
import { isAppContextServer } from '@/lib/app-context'
import { AppSection, AppUL, LegalFrame } from '@/components/v3/me/AppLegal'
import { business } from '@/lib/business'

export const metadata: Metadata = {
  title: '환불 정책',
  description:
    '파머스테일의 교환·환불·반품 정책. 전자상거래법 제17조에 따른 청약철회 절차와 정기배송 해지 정책을 안내합니다.',
  // ★canonical 자기선언 (2026-08-12 4라운드 감사) — 없으면 루트 layout 의
  //   metadataBase alternates 를 상속해 **홈을 정본으로 선언**한다. 그러면
  //   sitemap 은 이 URL 을 올리는데 페이지는 '나는 홈이다' 라고 말해
  //   검색엔진이 색인에서 뺀다(법정 문서는 심사·분쟁 때 접근 가능해야 한다).
  alternates: { canonical: '/legal/refund' },
  robots: { index: true, follow: true },
}

// ★2026-10-02 개정 — 결제 후 취소 제한(결제 전 별도 동의 회차)·주말 조리 일정·카드 전용·냉동 보관(봉투 라벨)·
//   없는 '마이페이지 반품 신청' 정정. 사장님 "실 결제 고객 한 명도 없음, 바로 해도 돼" — 즉시 시행.
//   문안 docs/LEGAL_REVISION_2026_10.md §3·§5. 동의 정본 lib/payments/no-cancel-consent.
const EFFECTIVE_DATE = '2026-10-02'

/**
 * 환불 정책.
 * 전자상거래법 제17조 (청약철회 등) 및 제18조 (청약철회 효과)에
 * 근거한 소비자 보호 조항을 명시한다. 식품류 특성상 일부 제한이
 * 있음을 분명히 표시한다.
 */
// 2026-10-09 앱 새 디자인('A 포스터', 이용약관 M22 와 같은 틀): 앱이면 바깥 틀·장 제목·목록만 앱 부품으로 고른다
// (components/v3/me/AppLegal). 법문 글자는 한 자도 바꾸지 않았다. 웹은 LegalFrame 의 웹 갈래 = 예전 마크업 그대로.
export default async function RefundPage() {
  const isApp = await isAppContextServer()
  const Section = isApp ? AppSection : WebSection
  const UL = isApp ? AppUL : WebUL
  return (
    <SiteShell>
      <LegalFrame
        isApp={isApp}
        eyebrow="Refund Policy"
        title="환불 정책"
        effectiveDate={EFFECTIVE_DATE}
        summary={
          <>
            정기배송은 <b>다음 결제 전까지</b> 해지·일시정지·미루기할 수
            있습니다(일반 회차 결제일: 발송 3일 전 토요일 오전).{' '}
            <b>
              결제 전에 별도로 안내하고 동의를 받은 정기배송 회차는 반려견에
              맞춰 조리되므로 결제 후 단순 변심으로 취소·환불되지 않습니다.
            </b>{' '}
            그 밖의 주문은 상품 수령 후 7일 이내 단순 변심 환불이 가능합니다
            (개봉·섭취한 식품 제외). <b>상품 하자·오배송은 수령 후 3개월
            이내</b> 교환·환불을 보장합니다.
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
              {/* ★문구를 실제 동작과 정합화 (2026-08-19 5라운드 감사). 예전엔
                  "출고 전 / 배송 중에는 … 주문 취소로 즉시 신청 가능" 이라
                  적었으나, 코드(lib/commerce/order-fsm 고객 취소 = pending·
                  preparing 만)상 **배송이 시작되면 셀프 취소 버튼도 없고 API 도
                  거부**한다. 법정 문서가 없는 경로를 약속하면 안 된다. 배송 중·
                  수령 후는 고객센터 접수로 안내한다. */}
              {/* ★2026-10-02 — 결제 전 별도 동의를 받은 정기배송 회차는 셀프 취소가 없다(주문 상세 버튼·취소 API 가
                  같은 판정 selfCancelBlockedByConsent). 동의 기록이 없는 주문만 출고 전 셀프 취소가 된다. */}
              <b>방법:</b> 결제 전에 별도로 동의를 받은 정기배송 회차는 결제
              후 조리가 진행되므로 주문 취소 신청을 받지 않습니다(멈추려면
              결제 전에 정기배송 관리 화면에서 해지·미루기해 주세요). 그 밖의
              주문은 출고 전(준비 중)에 주문내역 &gt; &ldquo;주문 취소&rdquo;
              로 즉시 신청할 수 있습니다. 배송이 시작된 후 또는 수령 후 반품은
              고객센터({business.email}) 로 1:1 접수해 주세요.
              {/* "(현재 발송 후 반품 self-service UI는 준비 중)" 삭제(2026-08-02).
                  법정 고지에 내부 로드맵을 적을 이유가 없다 — 고객에게 필요한 건
                  "어떻게 접수하는가"이고 그건 위에 그대로 있다(이메일 1:1 접수).
                  괄호는 정보를 더하지 않고 "아직 미완성"이라는 신호만 준다.
                  법정 페이지는 PG 심사에서도 읽는 문서다. */}
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
            <li>
              <b>회원의 반려견에 맞춰 개별적으로 조리되는 정기배송 회차</b>로서
              결제 전에 그 사실을 별도로 안내하고 회원이 동의한 경우 — 결제된
              회차(전자상거래법 시행령 제21조)
            </li>
          </UL>
          <p
            className="mt-2 text-[11.5px]"
            style={{ color: 'var(--fd-muted)' }}
          >
            ※ 단순 개봉 후 미섭취 상태의 반품은 가능 여부를 고객센터에
            먼저 문의해 주세요.
          </p>
        </Section>

        <Section title="4. 냉동 식품 수령 시 안내">
          <UL>
            <li>
              <b>수령 즉시 포장 상태 확인:</b> 외부 박스 파손, 보냉재 누수,
              내용물 해동·이상 변색이 발견되면 <b>택배 기사 앞에서
              수령을 거부</b>해 주세요. 사진을 함께 보내주시면 처리가
              빠릅니다.
            </li>
            <li>
              {/* 2026-10-02 — 판매 제품은 전부 냉동이다. 봉투 라벨·FAQ(2026-09-26 사장님 승인, 규칙128)와 같게. */}
              <b>수령 후 보관:</b> 판매 제품은 모두 냉동 제품입니다. 받으시면
              바로 냉동(-18℃ 이하) 보관해 주세요. 봉투에 적힌 유통기한(제조일로부터
              냉동 180일)까지 보관할 수 있고, 해동 후에는 냉장 보관해 3일 안에
              급여해 주세요. 한 번 해동한 제품은 다시 얼리지 마세요. 보관
              부주의로 인한 변질은 환불 대상에서 제외될 수 있습니다.
            </li>
            <li>
              <b>도서 · 산간 지역:</b> 일반 지역 대비 1영업일 추가 소요될
              수 있으며, 신선 상태 유지에 영향이 있는 경우 결제 전
              고객센터로 문의해 주세요.
            </li>
            <li>
              <b>장기 부재 시:</b> 휴가·출장 등으로 3일 이상 수령이 어려운
              경우 정기배송 관리 화면에서 <b>결제 전에</b> 미리 미루거나
              일시정지해 주세요. 이미 결제된 회차는 그대로 발송됩니다.
            </li>
          </UL>
        </Section>

        <Section title="5. 상품 하자·오배송에 의한 환불">
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
              {/* 2026-10-02 — 마이페이지에 반품 신청 기능은 없다(2항은 8/19 에 같은 이유로 고쳤다). */}
              <b>방법:</b> 고객센터({business.email})로 하자 내용을 적어
              보내 주세요. 사진을 함께 보내 주시면 빠르게 처리됩니다.
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

        <Section title="6. 환불 방법 및 기간">
          <UL>
            {/* 2026-10-02 — 결제 수단은 카드 전용(토스 빌링, 규칙23). 가상계좌·간편결제 줄을 뺐다. */}
            <li>
              <b>신용/체크카드:</b> 카드 승인 취소 (카드사에 따라 영업일
              기준 3~7일 소요)
            </li>
          </UL>
          <p>
            회사는 반품 상품 수령 및 환불 사유 확인일로부터 3영업일
            이내에 환불 절차를 진행합니다. 단, 카드사·은행 등의 처리
            일정에 따라 실제 입금까지의 기간은 달라질 수 있습니다.
          </p>
        </Section>

        <Section title="7. 정기배송 해지 및 환불">
          <UL>
            {/* 2026-08-02 검수 — 두 가지를 고쳤다.
                ① "언제든지" 삭제: 바로 아랫줄이 마감(전일 24시)을 말하는데 윗줄이
                   "언제든지"라 스스로 어긋났다. 사장님이 안 쓰기로 한 표현이기도 하다.
                ② 경로 이름에서 "마이페이지 &gt;" 를 뺐다: 웹의 정기배송 관리는
                   /account/subscriptions 이고, /mypage/subscriptions 는 **앱 전용**
                   (proxy APP_ONLY_PREFIXES)이라 웹 고객이 그 경로를 따라가면 앱 설치
                   벽을 만난다. 법정 고지는 두 환경 모두에서 맞아야 한다. */}
            {/* ★2026-10-02 — 결제 시점(일반 = 발송 3일 전 토요일 오전 · 서포터즈 할인 회차 = 발송일 오전,
                lib/shipping-schedule chargeDateFor)과 결제 후 취소 제한(결제 전 별도 동의 회차만)을 적었다. */}
            <li>
              회원은 정기배송 관리 화면에서 정기배송을 해지·일시정지·미루기할
              수 있습니다.
            </li>
            <li>
              다음 결제 예정일(일반 회차: 발송 3일 전 토요일 오전 · 서포터즈
              할인 회차: 발송일 오전) <b>전일 24시까지</b> 해지하거나 미루면
              그 회차는 결제되지 않습니다.
            </li>
            <li>
              결제 전에 별도로 안내하고 동의를 받은 정기배송 회차는 반려견에
              맞춰 조리되는 주문 제작 신선식품이므로,{' '}
              <b>결제 후에는 발송 전·후 모두 단순 변심에 의한 취소·환불이
              제한됩니다.</b> 다만 회사는 사정을 고려해 환불할 수 있습니다.
            </li>
            <li>
              그 밖의 이미 결제된 회차는 2항 기준을 따르며, 상품 하자·오배송·
              배송 지연으로 인한 변질은 5항에 따라 환불합니다.
            </li>
          </UL>
        </Section>

        <Section title="8. 반품 주소">
          <UL>
            <li>{business.address}</li>
            <li>
              반품 전 반드시 고객센터({business.email})로 먼저 접수해
              주세요. 사전 접수 없이 임의 발송된 상품은 처리가 지연될 수
              있습니다.
            </li>
          </UL>
        </Section>

        <Section title="9. 문의">
          <p>
            환불 관련 문의는{' '}
            <a
              href={`mailto:${business.email}`}
              className="font-bold hover:underline"
              style={{ color: 'var(--fd-coral)' }}
            >
              {business.email}
            </a>{' '}
            또는{' '}
            <a
              href={`tel:${business.phone}`}
              className="font-bold hover:underline"
              style={{ color: 'var(--fd-coral)' }}
            >
              {business.phone}
            </a>
            으로 연락해 주세요. 전체 이용 조건은{' '}
            <Link
              href="/legal/terms"
              className="font-bold hover:underline"
              style={{ color: 'var(--fd-coral)' }}
            >
              이용약관
            </Link>
            에서 확인하실 수 있습니다.
          </p>
        </Section>
      </LegalFrame>
    </SiteShell>
  )
}
