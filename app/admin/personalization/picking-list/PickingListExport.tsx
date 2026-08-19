'use client'

import { Download } from 'lucide-react'
import { shipBlockReason, SHIP_BLOCK_LABEL } from '@/lib/admin/ship-block'
import { toCsvWithBom } from '@/lib/csv'

/**
 * 피킹 리스트 CSV — 한 줄 = 한 박스. 팩 구성은 "제품 165g×14" 형태로 한 컬럼에
 * (제품 종류가 박스마다 달라 고정 컬럼 펼치기보다 안전). 한국어 BOM 포함.
 *
 * 2026-07-19 재작성 — 서버 page 가 boxPricing 정본으로 만든 PickingRow 를 그대로
 * 받는다. 계산은 여기서 하지 않는다(정본 밖 재계산 금지).
 */

export type PickingRow = {
  subId: string
  dogName: string
  recipientName: string
  phone: string
  zip: string
  addressLine: string
  memo: string
  freshRatio: number
  freshLabel: string
  freshUnknown: boolean
  cycleNumber: number | null
  userAdjusted: boolean
  transition: string
  noFormula: boolean
  /**
   * **결제가 일어날 수 없는 구독** — 카드가 없거나(billing_key null) 영구 거절
   * 상태(requires_billing_key_renewal)다. 청구 크론의 대상 조건과 같은 판정이라,
   * true 면 이 박스는 **돈을 받지 않고 나간다**.
   *
   * 예전엔 피킹 리스트가 status='active' + 날짜만 봐서 이런 구독이 아무 표시
   * 없이 포장 대상에 섞였다(2026-07-31). 특히 어드민 '재개' 가 영구 거절 구독에
   * 배송일을 박아주고 있어 그 조합이 실제로 만들어졌다.
   */
  /**
   * 결제 후 정지된 건 — 돈은 받았는데 구독이 멈췄다(2026-08-07).
   * ★판정은 '결제됨+preparing 주문 존재'가 증거다(2026-08-12 반증감사) —
   *   status='paused' 만으로는 청구 전에 고객이 멈춘 건과 구분되지 않는다.
   */
  pausedAfterCharge: boolean
  /**
   * ★청구 **전에** 고객이 스스로 멈춘 건 — 대금이 없다. 일시정지는
   * next_delivery_date 를 안 지우므로 목록에 남는데, 보내면 무료 발송이 된다.
   * 라벨·CSV 에서 제외하고 화면에는 빨간 경고로 남긴다(사장님이 이유를 알아야 함).
   */
  pausedBeforeCharge: boolean
  /**
   * ★오늘 아침 청구가 실패했다(2026-08-12 3라운드 감사). 청구 실패는
   * next_delivery_date 를 안 밀어 charged·overdue 가 모두 false 가 되므로,
   * 이 플래그가 없으면 배지가 "발송일 아침 청구 예정" 으로 떨어져 그대로 발송된다.
   */
  chargeFailedToday: boolean
  /**
   * ★고객이 이번 배송을 '미루기(skip)'해 날짜가 chargedBumpDate 로 밀렸지만
   * 결제 주문이 없는 활성 구독 (2026-08-20 6라운드 감사). ship-block 이
   * 발송금지로 판정한다 — 날짜만으론 청구분과 구분이 안 돼 무료 박스가 나갔다.
   */
  skippedNotCharged: boolean
  /** 실패 코드(INSUFFICIENT_FUNDS 등) — 사장님이 원인을 바로 보게. */
  failedCode: string | null
  /** 청구 후 고객이 배송일을 옮겨 날짜 필터 밖으로 나간 건 — 발송 대기 주문 역추적으로 포함됨. */
  dateMovedAfterCharge: boolean
  cannotCharge: boolean
  charged: boolean
  overdue: boolean
  totalAmount: number
  /** 이번 출고분 미발송 주문 — 포장 중 송장 입력으로 바로 가는 링크용. */
  order: { id: string; orderNumber: string } | null
  packs: Array<{ name: string; packG: number; count: number; totalG: number }>
  /**
   * 레시피는 부르는데 **박스에 못 담기는** 항목 — 판매중지·재고0·구독불가.
   * 예전엔 그냥 사라져서, 3종 레시피가 2종으로 포장돼 나갔다(2026-07-31).
   * 금액은 저장된 total_amount 로 그대로 청구되므로 고객은 제값을 내고 덜 받는다.
   */
  missing: Array<{ name: string; packG: number; count: number; reason: string }>
  boxTotalG: number
}

export default function PickingListExport({
  rows,
  date,
}: {
  rows: PickingRow[]
  date: string
}) {
  function downloadCsv() {
    // ★직렬화는 **정본 lib/csv** 로 (2026-08-19 5라운드 감사). 예전엔 자체
    //   직렬화라 선두 `= + - @` 를 무력화하지 않아 CSV 수식 인젝션에 뚫려
    //   있었다 — 배송메모·강아지이름·수령인이 전부 고객 자유텍스트라, 고객이
    //   `=IMPORTXML(...)` 를 저장하면 사장님이 화요일 피킹리스트를 Excel/시트로
    //   여는 순간 수식이 실행돼 인접 셀(다른 고객 PII)을 유출·피싱할 수 있었다.
    //   주문 export 는 이미 lib/csv 를 쓰는데 실포장에 쓰는 피킹리스트만 구멍이
    //   었다. toCsvWithBom 의 escapeCell 이 OWASP 수식 인젝션 방어 + BOM 을
    //   함께 처리한다(자체 이스케이프·자체 BOM 붙이기 제거).
    const columns = [
      '강아지',
      '수령인',
      '전화',
      '우편',
      '주소',
      '배송메모',
      '화식비율',
      'cycle',
      '보호자조정',
      '상태',
      '팩 구성',
      '박스 총량(g)',
      '청구액(원)',
    ]
    const csvRows = rows.map((r) => ({
      강아지: r.dogName,
      수령인: r.recipientName,
      전화: r.phone,
      우편: r.zip,
      주소: r.addressLine,
      배송메모: r.memo,
      화식비율: `${r.freshLabel} ${r.freshRatio}%`,
      cycle: r.cycleNumber == null ? '' : String(r.cycleNumber),
      보호자조정: r.userAdjusted ? '✓' : '',
      // ★상태는 화면 배지와 같은 우선순위로 판정한다(2026-08-12 반증감사).
      //   예전엔 미결제 정지 건이 '청구예정'으로 나와 CSV 를 믿고 포장하면
      //   무료 발송이 됐다. CSV 는 발송물이 아니라 데이터라 제외 대신 표기.
      // 발송 금지 사유는 정본(lib/admin/ship-block)이 판정한다 — 화면 배지·
      // 라벨 필터·조리 합계와 **같은 함수**라 넷이 갈라질 수 없다.
      상태: shipBlockReason(r)
        ? SHIP_BLOCK_LABEL[shipBlockReason(r)!] +
          (shipBlockReason(r) === 'charge_failed_today' && r.failedCode
            ? `:${r.failedCode}`
            : '')
        : r.pausedAfterCharge
          ? '결제후정지(확인필요)'
          : r.noFormula
            ? '처방없음'
            : r.charged
              ? '청구완료'
              : r.overdue
                ? '청구지연'
                : '청구예정',
      '팩 구성': r.packs
        .map((p) => `${p.name} ${p.packG}g×${p.count}`)
        .join(' / '),
      '박스 총량(g)': String(r.boxTotalG),
      '청구액(원)': String(r.totalAmount),
    }))
    const csv = toCsvWithBom(csvRows, columns)

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `picking-list-${date}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={downloadCsv}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold disabled:opacity-40 bg-zinc-900 text-white"
    >
      <Download size={12} strokeWidth={2.5} />
      CSV 다운로드
    </button>
  )
}
