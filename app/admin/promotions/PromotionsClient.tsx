'use client'

/**
 * 이벤트 관리 — 만들기 + 링크/QR + 성과.
 *
 * # 사장님이 여기서 하는 일
 *  1. 이벤트 하나 만든다 (이름 · 할인% · 기간 · 상한)
 *  2. 나온 **링크**를 인스타 프로필에 걸거나, **QR** 을 배너에 인쇄한다
 *  3. 끝. 고객은 코드를 입력하지 않는다.
 *
 * # QR 은 서버에서 만든다
 * `/api/admin/promotions/qr?code=` 가 SVG 를 돌려준다. 클라이언트 번들에 QR
 * 인코더를 싣지 않으려고(고객 페이지와 공유되는 번들이다) 서버에 둔다.
 */
import { useState } from 'react'
import { AdminCard, AdminButton, Badge, SectionTitle } from '@/components/admin/ui'
import { promotionGate, PROMOTION_GATE_LABEL } from '@/lib/promotions'

export type PromoWithStat = {
  id: string
  code: string
  name: string
  discount_rate: number
  starts_at: string
  ends_at: string
  max_signups: number | null
  active: boolean
  signups: number
  orders: number
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PromotionsClient({
  initial,
  siteUrl,
}: {
  initial: PromoWithStat[]
  siteUrl: string
}) {
  const [rows, setRows] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [openQr, setOpenQr] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    code: '',
    discountPct: '50',
    startsAt: '',
    endsAt: '',
    maxSignups: '',
  })

  const linkOf = (code: string) => `${siteUrl}/start?p=${code}`

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          discountPct: Number(form.discountPct),
          startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined,
          maxSignups: form.maxSignups ? Number(form.maxSignups) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.message ?? '만들지 못했어요')
        return
      }
      setRows((r) => [{ ...data.promotion, signups: 0, orders: 0 }, ...r])
      setForm({ name: '', code: '', discountPct: '50', startsAt: '', endsAt: '', maxSignups: '' })
    } catch {
      setErr('네트워크가 불안정해요')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(id: string, active: boolean) {
    setRows((r) => r.map((p) => (p.id === id ? { ...p, active } : p)))
    try {
      await fetch('/api/admin/promotions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      })
    } catch {
      // 실패 시 원복 — 낙관적 UI.
      setRows((r) => r.map((p) => (p.id === id ? { ...p, active: !active } : p)))
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(linkOf(code))
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="px-5 space-y-5">
      {/* ── 만들기 ── */}
      <AdminCard>
        <SectionTitle title="새 이벤트" desc="만들면 링크와 QR 이 바로 나와요" />
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold text-zinc-600">이벤트 이름</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="부산 펫박람회"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-zinc-600">
                링크 코드 (영문소문자·숫자)
              </span>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="busan1102"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-[13px] font-mono"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold text-zinc-600">할인 %</span>
              <input
                required
                type="number"
                min={1}
                max={100}
                value={form.discountPct}
                onChange={(e) => setForm({ ...form, discountPct: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-[13px] tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-zinc-600">시작</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-2 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-zinc-600">종료</span>
              <input
                required
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-2 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-zinc-600">인원 상한</span>
              <input
                type="number"
                min={0}
                value={form.maxSignups}
                onChange={(e) => setForm({ ...form, maxSignups: e.target.value })}
                placeholder="무제한"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-[13px] tabular-nums"
              />
            </label>
          </div>
          {err && <p className="text-[12px] text-red-600 font-bold">{err}</p>}
          <AdminButton type="submit" disabled={busy}>
            {busy ? '만드는 중…' : '이벤트 만들기'}
          </AdminButton>
        </form>
      </AdminCard>

      {/* ── 목록 ── */}
      {rows.length === 0 ? (
        <AdminCard>
          <SectionTitle title="이벤트" />
          <p className="text-[12px] text-zinc-500">
            아직 이벤트가 없어요. 위에서 하나 만들면 링크와 QR 이 나와요.
          </p>
        </AdminCard>
      ) : (
        rows.map((p) => {
          const gate = promotionGate(p, new Date(), p.signups)
          return (
            <AdminCard key={p.id}>
              <SectionTitle title={p.name} desc={`/start?p=${p.code}`} />
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge tone={gate.open ? 'green' : 'neutral'}>
                  {gate.open ? '진행 중' : PROMOTION_GATE_LABEL[gate.reason]}
                </Badge>
                <Badge tone="blue">{Math.round(p.discount_rate * 100)}% 할인</Badge>
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {fmt(p.starts_at)} ~ {fmt(p.ends_at)}
                </span>
                {p.max_signups != null && (
                  <span className="text-[11px] text-zinc-500 tabular-nums">
                    상한 {p.signups}/{p.max_signups}명
                  </span>
                )}
              </div>

              {/* 성과 — 광고 추적이 없는 지금, 채널 성과를 읽는 유일한 창 */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded bg-zinc-50 px-3 py-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    가입
                  </div>
                  <div className="text-[20px] font-bold tabular-nums">{p.signups}명</div>
                </div>
                <div className="rounded bg-zinc-50 px-3 py-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    첫 결제
                  </div>
                  <div className="text-[20px] font-bold tabular-nums">{p.orders}명</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <input
                  readOnly
                  value={linkOf(p.code)}
                  onClick={(e) => e.currentTarget.select()}
                  className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-[11px] font-mono bg-zinc-50"
                />
                <AdminButton type="button" onClick={() => copy(p.code)}>
                  {copied === p.code ? '복사됨' : '링크 복사'}
                </AdminButton>
                <AdminButton
                  type="button"
                  onClick={() => setOpenQr(openQr === p.code ? null : p.code)}
                >
                  QR
                </AdminButton>
                <AdminButton type="button" onClick={() => toggle(p.id, !p.active)}>
                  {p.active ? '끄기' : '켜기'}
                </AdminButton>
              </div>

              {openQr === p.code && (
                <div className="mt-3 flex flex-col items-center gap-2 rounded border border-zinc-200 p-4 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/promotions/qr?code=${encodeURIComponent(p.code)}`}
                    alt={`${p.name} QR 코드`}
                    width={220}
                    height={220}
                  />
                  <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                    우클릭 → 이미지 저장 → 배너·포스터에 인쇄하세요.
                    <br />
                    찍으면 바로 설문이 열리고, 가입하면 {Math.round(p.discount_rate * 100)}%가
                    자동 적용돼요.
                  </p>
                </div>
              )}
            </AdminCard>
          )
        })
      )}
    </div>
  )
}
