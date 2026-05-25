// B3 — 다견 가정용 비교 페이지.
// 체중 / BCS / 식이 / 다음 분석 등 가로 비교.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface DogRow {
  id: string
  name: string
  weight: number | null
  age_value: number | null
  age_unit: 'years' | 'months' | null
  body_condition: string | null
  breed: string | null
}

export default async function CompareDogsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dogs/compare')

  const { data: rows } = await supabase
    .from('dogs')
    .select('id, name, weight, age_value, age_unit, body_condition, breed')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const dogs = (rows ?? []) as DogRow[]

  return (
    <main className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <Link
          href="/dogs"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          강아지 목록
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">Compare</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            우리 집 강아지 비교
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            체중·BCS·식이 정보를 한눈에 비교해 봐요
          </p>
        </div>
      </div>

      {dogs.length < 2 ? (
        <section className="px-5 mt-6">
          <div className="rounded border border-rule bg-bg-3 px-5 py-8 text-center">
            <BarChart3
              className="w-8 h-8 mx-auto text-muted"
              strokeWidth={1.6}
            />
            <p className="mt-3 text-[13px] font-bold text-text">
              비교하려면 강아지가 2마리 이상이어야 해요
            </p>
            <p className="mt-1 text-[12px] text-muted">
              새 강아지를 등록하면 자동으로 비교 카드가 보여요
            </p>
            <Link
              href="/dogs/new"
              className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded bg-text text-bg text-[12px] font-bold active:scale-[0.99]"
            >
              새 강아지 등록
            </Link>
          </div>
        </section>
      ) : (
        <section className="px-5 mt-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                <th className="text-left p-2 text-muted text-[10px] uppercase tracking-widest">
                  항목
                </th>
                {dogs.map((d) => (
                  <th
                    key={d.id}
                    className="text-left p-2 font-bold text-text"
                    style={{ fontSize: 13 }}
                  >
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="견종" dogs={dogs} pick={(d) => d.breed ?? '—'} />
              <Row
                label="나이"
                dogs={dogs}
                pick={(d) =>
                  d.age_value != null
                    ? `${d.age_value} ${d.age_unit === 'years' ? '살' : '개월'}`
                    : '—'
                }
              />
              <Row
                label="체중"
                dogs={dogs}
                pick={(d) => (d.weight != null ? `${d.weight} kg` : '—')}
              />
              <Row
                label="BCS"
                dogs={dogs}
                pick={(d) => d.body_condition ?? '—'}
              />
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

function Row({
  label,
  dogs,
  pick,
}: {
  label: string
  dogs: DogRow[]
  pick: (d: DogRow) => string
}) {
  return (
    <tr className="border-t border-rule">
      <td className="p-2 text-muted">{label}</td>
      {dogs.map((d) => (
        <td key={d.id} className="p-2 text-text" style={{ fontWeight: 600 }}>
          {pick(d)}
        </td>
      ))}
    </tr>
  )
}
