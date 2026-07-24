'use client'

import { Tag } from 'lucide-react'
import { business } from '@/lib/business'
import type { PickingRow } from './PickingListExport'

/**
 * 배송 라벨 인쇄 — 전수검사 신기능(2026-07-25, 사장님 실운영 보조).
 *
 * # 왜
 * 화요일에 박스를 싸고 나면 각 박스에 붙일 "받는분/주소" 라벨이 필요한데,
 * 여태 그걸 뽑을 방법이 없었다(운송장도 주문 상세에서 하나씩). 피킹 리스트가
 * 이미 주소·팩 구성을 다 갖고 있으니, 같은 데이터로 A4 라벨 시트를 인쇄한다.
 *
 * # 방식
 * 자체 인쇄 창(window.open + srcdoc 스타일 self-contained HTML) — 페이지 CSS 와
 * 충돌 없고 print CSS 만으로 A4 2열 그리드. 계산은 하지 않는다 — 서버 page 가
 * boxPricing 정본으로 만든 PickingRow 를 그대로 받는다(PickingListExport 와 동일 원칙).
 *
 * 한 라벨: 받는분·연락처·주소 / 박스 내용(강아지·화식비율·팩 요약) / 보내는분.
 * 가위로 잘라 테이프로 붙이는 용도라 테두리는 점선.
 */

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function labelHtml(rows: PickingRow[], date: string): string {
  const sender = `파머스테일 ${business.phone ?? ''}`.trim()
  const cards = rows
    .map((r) => {
      const packSummary =
        r.packs.length > 0
          ? r.packs.map((p) => `${p.name} ${p.packG}g×${p.count}`).join(' · ')
          : '(팩 구성 미확정)'
      return `<div class="label">
  <div class="to">
    <div class="name">${esc(r.recipientName)} <span class="dog">(${esc(r.dogName)} 보호자)</span></div>
    <div class="phone">${esc(r.phone || '-')}</div>
    <div class="addr">${r.zip ? `[${esc(r.zip)}] ` : ''}${esc(r.addressLine)}</div>
  </div>
  <div class="box">${esc(r.freshLabel)} · ${esc(packSummary)}</div>
  <div class="from">보내는분: ${esc(sender)} · 발송일 ${esc(date)}</div>
</div>`
    })
    .join('\n')

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>배송 라벨 — ${esc(date)} (${rows.length}박스)</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; padding: 10mm; }
  .sheet-title { font-size: 12px; color: #555; margin-bottom: 6mm; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .label { border: 1.5px dashed #999; border-radius: 6px; padding: 5mm; break-inside: avoid; }
  .to .name { font-size: 16px; font-weight: 800; }
  .to .dog { font-size: 11px; font-weight: 400; color: #666; }
  .to .phone { font-size: 13px; margin-top: 1.5mm; }
  .to .addr { font-size: 13px; line-height: 1.45; margin-top: 1.5mm; word-break: keep-all; }
  .box { font-size: 10.5px; color: #444; margin-top: 3mm; padding-top: 2.5mm; border-top: 1px solid #ddd; line-height: 1.4; }
  .from { font-size: 9.5px; color: #888; margin-top: 2mm; }
  @media print { .no-print { display: none; } body { padding: 6mm; } }
</style></head><body>
<div class="sheet-title no-print">배송 라벨 ${esc(date)} · ${rows.length}박스 — 인쇄(Ctrl+P) 후 잘라서 붙이세요</div>
<div class="grid">
${cards}
</div>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`
}

export default function ShippingLabels({
  rows,
  date,
}: {
  rows: PickingRow[]
  date: string
}) {
  function openLabels() {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.write(labelHtml(rows, date))
    w.document.close()
  }

  return (
    <button
      type="button"
      onClick={openLabels}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-zinc-200 bg-white text-[12px] font-bold text-zinc-700 hover:border-zinc-400 transition disabled:opacity-40"
    >
      <Tag className="w-3.5 h-3.5" strokeWidth={2.2} />
      배송 라벨 인쇄
    </button>
  )
}
