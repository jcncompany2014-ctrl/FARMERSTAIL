// audit #101: 'use client' → server component RSC.
// 이전: client 가 useEffect 에서 auth + supabase fetch → spinner 800ms+.
// 새: server 에서 prefetch → 즉시 페인트. 인증 redirect 도 server.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import DogPawMark from '@/components/DogPawMark'

type Dog = {
  id: string
  name: string
  breed: string | null
  gender: string | null
  weight: number | null
  age_value: number | null
  age_unit: string | null
  photo_url: string | null
  created_at: string
}

export default async function DogsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/dogs')
  }

  // Explicit user_id filter (defense-in-depth).
  const { data } = await supabase
    .from('dogs')
    .select(
      'id, name, breed, gender, weight, age_value, age_unit, photo_url, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const dogs = (data ?? []) as Dog[]

  return (
    <div className="pb-8">
      {/* Header — 탭 루트라 상단 앱 헤더(로고+강아지 칩)가 내비를 담당.
          '← 홈으로' + 'Our Dogs · 우리 아이' 키커는 난잡해서 제거(사장님 피드백),
          깔끔한 제목 + 추가 버튼만. */}
      <section className="px-5 pt-5 pb-2">
        <div className="flex items-end justify-between">
          <h1
            className="font-sans"
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            우리 아이
          </h1>
          {/* UI audit F-1: 44px touch target — py-2 → py-2.5 + min-h. iOS HIG. */}
          <Link
            href="/dogs/new"
            className="inline-flex items-center gap-1 px-4 py-2.5 min-h-[40px] text-[12px] font-bold rounded-full active:scale-[0.98] transition"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            추가
          </Link>
        </div>
      </section>

      {/* Empty state */}
      {dogs.length === 0 && (
        <section className="px-5 mt-6">
          <div
            className="rounded border border-dashed px-6 py-12 text-center"
            style={{ background: 'var(--bg-3)', borderColor: 'var(--rule)', borderWidth: 1.5 }}
          >
            <div
              className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-4"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--rule)',
              }}
            >
              <DogPawMark className="w-6 h-6 text-terracotta" />
            </div>
            <span className="kicker">First Dog · 첫 아이</span>
            <h3
              className="font-sans mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              아직 등록된 아이가 없어요
            </h3>
            {/* UI audit B-1: <br/> 제거 — keep-all 전역이라 자연 wrap. */}
            <p className="text-[12px] text-muted mt-2 leading-relaxed max-w-[240px] mx-auto">
              첫 번째 아이를 등록하고 맞춤 영양 분석을 받아볼 수 있어요
            </p>
            <Link
              href="/dogs/new"
              className="mt-6 inline-flex items-center gap-1.5 px-6 py-3 text-[12px] font-bold rounded-full active:scale-[0.98] transition-all"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              아이 등록하기
            </Link>
          </div>
        </section>
      )}

      {/* Dogs list */}
      {dogs.length > 0 && (
        <section className="px-5 mt-4">
          <ul className="space-y-2.5">
            {dogs.map((dog) => (
              <li key={dog.id}>
                <Link
                  href={`/dogs/${dog.id}`}
                  className="flex items-center gap-4 bg-bg-3 rounded border border-rule px-5 py-4 hover:border-text transition-all"
                >
                  <div className="relative w-12 h-12 bg-bg rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                    {dog.photo_url ? (
                      <Image
                        src={dog.photo_url}
                        alt={dog.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <DogPawMark className="w-5 h-5 text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-sans truncate"
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: 'var(--ink)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {dog.name}
                    </h3>
                    {/* UI audit A-1/A-2: items-baseline + tabular-nums — meta row baseline 정렬 + 자릿수 정렬. */}
                    <div
                      className="flex flex-wrap items-baseline gap-x-1.5 mt-1 font-mono tabular-nums"
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        color: 'var(--muted)',
                      }}
                    >
                      {dog.breed && (
                        <span style={{ textTransform: 'uppercase' }}>
                          {dog.breed}
                        </span>
                      )}
                      {dog.age_value && (
                        <>
                          {dog.breed && (
                            <span style={{ color: 'var(--rule-2)' }}>·</span>
                          )}
                          <span>
                            {dog.age_value}
                            {dog.age_unit === 'years' ? '살' : '개월'}
                          </span>
                        </>
                      )}
                      {dog.weight && (
                        <>
                          <span style={{ color: 'var(--rule-2)' }}>·</span>
                          <span>{dog.weight}kg</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 text-muted"
                    strokeWidth={2}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
