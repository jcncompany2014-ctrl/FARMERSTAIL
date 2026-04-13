'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Dog = {
  id: string
  name: string
  breed: string | null
  gender: string | null
  weight: number | null
  age_value: number | null
  age_unit: string | null
  created_at: string
}

export default function DogsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [dogs, setDogs] = useState<Dog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDogs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('dogs')
        .select('id, name, breed, gender, weight, age_value, age_unit, created_at')
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
      <main className="min-h-screen flex items-center justify-center bg-[#F5F0E6]">
        <div className="text-[#8A7668]">로딩 중...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F5F0E6] px-6 py-10">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-sm text-[#8A7668] hover:text-[#3D2B1F] transition">
              ← 홈으로
            </Link>
            <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight mt-3">
              내 강아지
            </h1>
          </div>
          <Link
            href="/dogs/new"
            className="px-4 py-2 bg-[#A0452E] text-white font-bold text-sm rounded-xl border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2A2118] transition-all"
          >
            + 추가
          </Link>
        </div>

        {/* Empty state */}
        {dogs.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-[#D8CCBA] p-10 text-center">
            <div className="text-6xl mb-4">🐕</div>
            <h3 className="font-bold text-[#3D2B1F] mb-2">아직 등록된 강아지가 없어요</h3>
            <p className="text-sm text-[#8A7668] mb-6">
              첫 번째 강아지를 등록하고<br />맞춤 영양 분석을 받아보세요
            </p>
            <Link
              href="/dogs/new"
              className="inline-block px-6 py-3 bg-[#A0452E] text-white font-bold rounded-xl border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2A2118] transition-all"
            >
              + 강아지 등록하기
            </Link>
          </div>
        )}

        {/* Dogs list */}
        {dogs.length > 0 && (
          <div className="space-y-3">
            {dogs.map((dog) => (
              <Link
                key={dog.id}
                href={`/dogs/${dog.id}`}
                className="block bg-white rounded-2xl border-2 border-[#EDE6D8] p-5 hover:border-[#3D2B1F] hover:shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#F5F0E6] rounded-full flex items-center justify-center text-3xl flex-shrink-0">
                    🐕
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[#3D2B1F] text-lg truncate">
                      {dog.name}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-1 text-xs text-[#8A7668]">
                      {dog.breed && <span>{dog.breed}</span>}
                      {dog.age_value && (
                        <>
                          <span>·</span>
                          <span>{dog.age_value}{dog.age_unit === 'years' ? '살' : '개월'}</span>
                        </>
                      )}
                      {dog.weight && (
                        <>
                          <span>·</span>
                          <span>{dog.weight}kg</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-[#8A7668]">→</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}