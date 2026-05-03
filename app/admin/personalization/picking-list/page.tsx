import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import PickingListExport from './PickingListExport'

export const dynamic = 'force-dynamic'

/**
 * /admin/personalization/picking-list — 박스 패킹 워크 리스트.
 *
 * 운영자가 매일 출고할 박스를 한 번에 조회. 각 박스마다:
 *   - 강아지 이름 + 보호자 이름 + 배송지
 *   - 5종 라인 별 주간 그램 (daily_grams × 7 × ratio)
 *   - 토퍼 주간 그램
 *   - 케어 목표 / 전환 전략 (포장 우선순위에 영향)
 *
 * 기본: 오늘 active 인 모든 처방 (applied_from <= today AND applied_until >= today).
 * URL ?date=YYYY-MM-DD 로 다른 날짜 조회.
 *
 * CSV 다운로드 버튼 — 종이 워크리스트 또는 Google Sheet 동기화용.
 */
export default async function PickingListPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/personalization/picking-list')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const sp = await searchParams
  const today = new Date()
  const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000)
  const todayKstIso = kst.toISOString().slice(0, 10)
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKstIso

  // active formulas — applied_from <= date <= applied_until.
  // 처방이 created_at 만 있고 applied_* 가 NULL 이면 28일 자동 적용.
  type FormulaRow = {
    id: string
    dog_id: string
    user_id: string
    cycle_number: number
    formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
    daily_grams: number
    daily_kcal: number
    transition_strategy: string
    user_adjusted: boolean
    applied_from: string | null
    applied_until: string | null
  }

  const { data: formulasRaw } = await supabase
    .from('dog_formulas')
    .select(
      'id, dog_id, user_id, cycle_number, formula, daily_grams, daily_kcal, ' +
        'transition_strategy, user_adjusted, applied_from, applied_until',
    )
    .or(
      `and(applied_from.lte.${date},applied_until.gte.${date}),and(applied_from.is.null,applied_until.is.null)`,
    )
    .order('cycle_number', { ascending: false })

  const formulas = (formulasRaw ?? []) as unknown as FormulaRow[]

  // dog 별 cycle 최댓값만 — 옛 cycle 까지 잡지 않음.
  const latest = new Map<string, FormulaRow>()
  for (const f of formulas) {
    const ex = latest.get(f.dog_id)
    if (!ex || f.cycle_number > ex.cycle_number) latest.set(f.dog_id, f)
  }

  // 강아지 + 보호자 + 주소 join.
  const dogIds = Array.from(latest.keys())
  type DogRow = {
    id: string
    name: string
    user_id: string
  }
  type ProfileRow = {
    id: string
    name: string | null
    phone: string | null
    address: string | null
    address_detail: string | null
    zip: string | null
  }
  const [{ data: dogsRaw }, { data: profilesRaw }] = await Promise.all([
    dogIds.length > 0
      ? supabase.from('dogs').select('id, name, user_id').in('id', dogIds)
      : Promise.resolve({ data: [] }),
    dogIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, name, phone, address, address_detail, zip')
          .in(
            'id',
            Array.from(new Set(formulas.map((f) => f.user_id))),
          )
      : Promise.resolve({ data: [] }),
  ])

  const dogs = ((dogsRaw ?? []) as unknown as DogRow[]).reduce<
    Record<string, DogRow>
  >((acc, d) => {
    acc[d.id] = d
    return acc
  }, {})
  const profiles = ((profilesRaw ?? []) as unknown as ProfileRow[]).reduce<
    Record<string, ProfileRow>
  >((acc, p) => {
    acc[p.id] = p
    return acc
  }, {})

  // 운영 행 계산.
  type Row = {
    formula: FormulaRow
    dogName: string
    ownerName: string
    phone: string
    addressLine: string
    zip: string
    weeklyGrams: number
    lines: Array<{ line: FoodLine; pct: number; grams: number }>
    veggieGrams: number
    proteinGrams: number
  }

  const rows: Row[] = Array.from(latest.values()).map((f) => {
    const dog = dogs[f.dog_id]
    const profile = profiles[f.user_id]
    const weeklyGrams = f.daily_grams * 7
    const lines = ALL_LINES.map((line) => ({
      line,
      pct: Math.round(f.formula.lineRatios[line] * 100),
      grams: Math.round(f.formula.lineRatios[line] * weeklyGrams),
    })).filter((l) => l.pct > 0)

    return {
      formula: f,
      dogName: dog?.name ?? '(이름 없음)',
      ownerName: profile?.name ?? '(보호자 미등록)',
      phone: profile?.phone ?? '',
      addressLine:
        [profile?.address, profile?.address_detail].filter(Boolean).join(' ') ||
        '(주소 미등록)',
      zip: profile?.zip ?? '',
      weeklyGrams,
      lines,
      veggieGrams: Math.round(f.formula.toppers.vegetable * weeklyGrams),
      proteinGrams: Math.round(f.formula.toppers.protein * weeklyGrams),
    }
  })

  return (
    <main className="px-5 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <span
            className="text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: 'var(--terracotta)' }}
          >
            Admin · Picking List
          </span>
          <h1
            className="font-serif mt-1"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {date} 박스 패킹 리스트
          </h1>
          <p className="text-[11.5px] text-muted mt-1">
            오늘 active 인 처방 {rows.length}건 · 1주 분량 기준
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/personalization"
            className="text-[12px] text-muted hover:text-text"
          >
            ← Personalization
          </Link>
          <PickingListExport rows={rows} date={date} />
        </div>
      </div>

      {/* 날짜 선택 */}
      <form
        method="get"
        className="mb-4 flex items-center gap-2 text-[12px] text-text"
      >
        <label htmlFor="date" className="font-bold">
          날짜:
        </label>
        <input
          type="date"
          id="date"
          name="date"
          defaultValue={date}
          className="px-2 py-1 rounded-lg border border-rule bg-white"
        />
        <button
          type="submit"
          className="px-3 py-1 rounded-lg bg-text text-white font-bold"
        >
          조회
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-rule p-8 text-center text-[13px] text-muted">
          {date} 에 active 처방 없어요.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-rule rounded-2xl">
          <table className="min-w-full text-[12px] text-text">
            <thead className="bg-bg-2">
              <tr>
                <Th>강아지 / 보호자</Th>
                <Th>주소</Th>
                <Th>케어</Th>
                <Th>주간 분량</Th>
                <Th>라인 분배 (g)</Th>
                <Th>토퍼 (g)</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.formula.id}
                  className="border-t border-rule align-top"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-bold">{r.dogName}</div>
                    <div className="text-muted text-[10.5px]">
                      {r.ownerName}
                      {r.phone && ` · ${r.phone}`}
                    </div>
                    <div className="text-[10px] text-muted mt-0.5 font-mono">
                      cycle {r.formula.cycle_number}
                      {r.formula.user_adjusted && ' · 사용자 조정'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <div className="text-[10.5px]">
                      {r.zip && (
                        <span className="font-mono text-muted">{r.zip} </span>
                      )}
                      {r.addressLine}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10.5px] font-mono text-muted">
                      {r.formula.transition_strategy}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    <div className="font-bold">{r.weeklyGrams}g</div>
                    <div className="text-[10px] text-muted">
                      {r.formula.daily_kcal}kcal/일
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <ul className="space-y-0.5">
                      {r.lines.map((l) => (
                        <li
                          key={l.line}
                          className="flex items-center gap-2 text-[11.5px]"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: FOOD_LINE_META[l.line].color }}
                          />
                          <span className="font-bold">
                            {FOOD_LINE_META[l.line].name}
                          </span>
                          <span className="ml-auto font-mono text-terracotta font-black">
                            {l.grams}g
                          </span>
                          <span className="text-muted text-[10px] font-mono">
                            ({l.pct}%)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px]">
                    {r.veggieGrams > 0 && (
                      <div>
                        야채{' '}
                        <span className="font-black text-moss">
                          {r.veggieGrams}g
                        </span>
                      </div>
                    )}
                    {r.proteinGrams > 0 && (
                      <div>
                        육류{' '}
                        <span className="font-black text-terracotta">
                          {r.proteinGrams}g
                        </span>
                      </div>
                    )}
                    {r.veggieGrams === 0 && r.proteinGrams === 0 && (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left text-[10px] font-bold tracking-[0.18em] uppercase text-muted">
      {children}
    </th>
  )
}
