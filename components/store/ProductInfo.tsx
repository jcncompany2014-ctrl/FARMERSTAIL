/**
 * 상품 정보 칸 — 상품 상세(ProductDetail)와 체험팩 탭(StoreBrowse)이 같이 쓴다(2026-10-13 토스 일반결제 심사 준비, 규칙210·211).
 *  Acc               — 펼치는 칸(details). '배송·교환·환불'은 처음부터 펼친다(open).
 *  ShippingRefundInfo — 출고·배송비·단순 변심 환불(정본 문구)·반품 배송비(정본 상수)·상품 문제·환불 방법.
 *  NoticeList        — 상품정보 제공고시 표(줄바꿈이 든 값은 줄을 나눠 보인다).
 * 숫자는 lib/store/shipping, 환불 문구는 lib/store/refund-copy 에서만 온다 — 화면에 숫자를 박지 않는다.
 */
import Link from 'next/link'
import { FREE_SHIPPING_MIN, SHIPPING_FEE, STORE_SHIP_WEEKDAYS } from '@/lib/store/shipping'
import { REFUND_METHOD_HAEYO, REFUND_RULE_HAEYO, returnFeeSummary } from '@/lib/store/refund-copy'

const won = (n: number) => n.toLocaleString('ko-KR')
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

export function Acc({ title, children, open = false, id }: { title: string; children: React.ReactNode; open?: boolean; id?: string }) {
  return (
    <details id={id} open={open} style={{ borderBottom: '1px solid #E5E5E5', scrollMarginTop: 64 }}>
      <summary style={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 18, fontWeight: 700 }}>
        {title}
        <span aria-hidden className="fts-acc-plus" style={{ fontSize: 26, fontWeight: 300 }}>
          +
        </span>
        <span aria-hidden className="fts-acc-minus" style={{ fontSize: 26, fontWeight: 300 }}>
          −
        </span>
      </summary>
      <div style={{ paddingBottom: 20 }}>{children}</div>
    </details>
  )
}

export function NoticeList({ rows }: { rows: [string, string | null][] }) {
  return (
    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
      {rows
        .filter((row): row is [string, string] => !!row[1])
        .map(([k, v]) => (
          <div key={k} style={{ padding: '12px 0', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12 }}>
            <dt style={{ fontSize: 14, color: '#595959' }}>{k}</dt>
            <dd style={{ margin: 0, fontSize: 16, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{v}</dd>
          </div>
        ))}
    </dl>
  )
}

/** '배송·교환·환불' 칸의 본문 — 상품 상세·체험팩 공용. */
export function ShippingRefundInfo() {
  const shipDays = STORE_SHIP_WEEKDAYS.map((d) => WEEKDAY_KO[d]).join('·')
  return (
    <>
      <NoticeList
        rows={[
          ['출고', `${shipDays}요일에 냉동으로 출고해요. 출고 후 하루나 이틀이면 받아요(지역에 따라 달라요).`],
          ['배송비', `${won(SHIPPING_FEE)}원 · ${FREE_SHIPPING_MIN / 10_000}만 원 이상이면 무료`],
          ['단순 변심', REFUND_RULE_HAEYO],
          ['반품 배송비', `단순 변심이면 ${returnFeeSummary()}`],
          ['상품 문제·오배송', '사진 한 장이면 돼요. 확인하고 다시 보내드리거나 환불해 드려요. 이때 배송비는 저희가 내요.'],
          ['환불 방법', REFUND_METHOD_HAEYO],
        ]}
      />
      <Link href="/legal/refund" style={{ marginTop: 12, minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 16, fontWeight: 700, color: '#141414' }}>
        환불정책 전체
      </Link>
    </>
  )
}
