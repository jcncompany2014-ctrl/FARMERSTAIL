'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Dog as DogIcon, Plus, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

export default function DogsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [dogs, setDogs] = useState<Dog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDogs() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Explicit user_id filter (defense-in-depth: RLS admin policy would
      // otherwise leak other users' dogs to admin-role accounts on this route).
      const { data, error } = await supabase
        .from('dogs')
        .select(
          'id, name, breed, gender, weight, age_value, age_unit, photo_url, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setDogs(data)
      }
      setLoading(false)
    }
    loadDogs()
  }, [router, supabase])

  if (loading) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pb-8">
      {/* Header */}
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/dashboard"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 홈으로
        </Link>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="kicker">Our Dogs · 내 아이들</span>
            <h1
              className="font-serif mt-1.5"
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              내 강아지
            </h1>
          </div>
          <Link
            href="/dogs/new"
            className="inline-flex items-center gap-1 px-4 py-2 text-[12px] font-bold rounded-full active:scale-[0.98] transition"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            추가
          </Link>
        </div>
      </section>

      {/* Empty state — editorial paper-tone, landing/dashboard와 동일 문법 */}
      {dogs.length === 0 && (
        <section className="px-5 mt-6">
          <div
            className="rounded-2xl border border-dashed px-6 py-12 text-center"
            style={{ background: 'var(--bg-2)', borderColor: 'var(--rule-2)' }}
          >
            <div
              className="inline-flex w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <DogIcon
                className="w-7 h-7 text-terracotta"
                strokeWidth={1.3}
              />
            </div>
            <span className="kicker">First Dog · 시작하기</span>
            <h3
              className="font-serif mt-2"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              아직 등록된 강아지가 없어요
            </h3>
            <p className="text-[12px] text-muted mt-2 leading-relaxed">
              첫 번째 강아지를 등록하고
              <br />
              맞춤 영양 분석을 받아보세요
            </p>
            <Link
              href="/dogs/new"
              className="mt-6 inline-flex items-center gap-1.5 px-6 py-3 text-[12px] font-bold rounded-full active:scale-[0.98] transition-all"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              강아지 등록하기
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
                  className="flex items-center gap-4 bg-white rounded-2xl border border-rule px-5 py-4 hover:border-text hover:shadow-sm transition-all"
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
                      <DogIcon
                        className="w-5 h-5 text-muted"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-serif truncate"
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--ink)',
                        letterSpacing: '-0.015em',
                      }}
                    >
                      {dog.name}
                    </h3>
                    {/* meta — mono 9.5 muted, separator는 rule-2 톤 dot.
                        상품/블로그 카드와 동일한 secondary typography 톤. */}
                    <div
                      className="flex flex-wrap items-center gap-x-1.5 mt-1 font-mono"
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
    </main>
  )
}
