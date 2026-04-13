'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Dog = {
  id: string
  name: string
  breed: string | null
  gender: string | null
  neutered: boolean | null
  age_value: number | null
  age_unit: string | null
  weight: number | null
  activity_level: string | null
  created_at: string
}

export default function DogDetailPage() {
  const router = useRouter()
  const params = useParams()
  const dogId = params.id as string
  const supabase = createClient()

  const [dog, setDog] = useState<Dog | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    async function loadDog() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('id', dogId)
        .single()

      if (error || !data) {
        router.push('/dogs')
        return
      }

      setDog(data)
      setLoading(false)
    }
    loadDog()
  }, [dogId, router, supabase])

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase
      .from('dogs')
      .delete()
      .eq('id', dogId)

    if (error) {
      alert('삭제 실패: ' + error.message)
      setDeleting(false)
      return
    }

    router.push('/dogs')
    router.refresh()
  }

  if (loading || !dog) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F5F0E6]">
        <div className="text-[#8A7668]">로딩 중...</div>
      </main>
    )
  }

  const activityLabels: Record<string, { emoji: string; text: string }> = {
    low: { emoji: '😴', text: '낮음' },
    medium: { emoji: '🚶', text: '보통' },
    high: { emoji: '🏃', text: '활동적' },
  }
  const genderLabels: Record<string, string> = {
    male: '🙋‍♂️ 남아',
    female: '🙋‍♀️ 여아',
  }

  return (
    <main className="min-h-screen bg-[#F5F0E6] px-6 py-10">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <Link href="/dogs" className="text-sm text-[#8A7668] hover:text-[#3D2B1F] transition">
          ← 돌아가기
        </Link>

        {/* Hero */}
        <div className="mt-6 mb-8 text-center">
          <div className="w-24 h-24 bg-white rounded-full border-4 border-[#3D2B1F] flex items-center justify-center text-5xl mx-auto mb-4 shadow-[4px_4px_0_#2A2118]">
            🐕
          </div>
          <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight">
            {dog.name}
          </h1>
          {dog.breed && (
            <p className="text-[#8A7668] text-sm mt-1">{dog.breed}</p>
          )}
        </div>

        {/* Info card */}
        <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] p-6 mb-4">
          <div className="space-y-4">
            <InfoRow label="성별" value={dog.gender ? genderLabels[dog.gender] : '-'} />
            <InfoRow label="중성화" value={dog.neutered === null ? '-' : dog.neutered ? '✅ 했어요' : '❌ 안 했어요'} />
            <InfoRow
              label="나이"
              value={dog.age_value ? `${dog.age_value}${dog.age_unit === 'years' ? '살' : '개월'}` : '-'}
            />
            <InfoRow label="체중" value={dog.weight ? `${dog.weight}kg` : '-'} />
            <InfoRow
              label="활동량"
              value={
                dog.activity_level
                  ? `${activityLabels[dog.activity_level]?.emoji} ${activityLabels[dog.activity_level]?.text}`
                  : '-'
              }
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href={`/dogs/${dog.id}/analysis`}
            className="block w-full py-3 text-center rounded-xl bg-[#6B7F3A] text-white font-bold border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2A2118] transition-all"
          >
            📊 맞춤 영양 분석 보기
          </Link>
          <Link
            href={`/dogs/${dog.id}/survey`}
            className="block w-full py-3 text-center rounded-xl bg-[#A0452E] text-white font-bold border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2A2118] transition-all"
          >
            🐕 설문 시작하기
          </Link>
          <Link
            href={`/dogs/${dog.id}/edit`}
            className="block w-full text-center py-3 rounded-xl bg-[#3D2B1F] text-white font-bold border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2A2118] transition-all"
          >
            ✏️ 정보 수정
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 rounded-xl bg-transparent text-[#B83A2E] font-bold border-2 border-[#B83A2E]/30 hover:border-[#B83A2E] hover:bg-[#FFF5F3] transition"
          >
            🗑️ 삭제
          </button>
        </div>

        {/* Delete confirm modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-6 z-50">
            <div className="bg-white rounded-2xl border-2 border-[#2A2118] p-6 max-w-sm w-full shadow-[6px_6px_0_#2A2118]">
              <div className="text-4xl text-center mb-3">⚠️</div>
              <h3 className="text-lg font-black text-[#3D2B1F] text-center mb-2">
                정말 삭제할까요?
              </h3>
              <p className="text-sm text-[#8A7668] text-center mb-6">
                {dog.name}의 모든 정보가 삭제돼요.<br />
                이 작업은 되돌릴 수 없어요.
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full py-3 rounded-xl bg-[#B83A2E] text-white font-bold border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
                >
                  {deleting ? '삭제 중...' : '네, 삭제할래요'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="w-full py-3 rounded-xl bg-transparent text-[#8A7668] font-bold border-2 border-[#EDE6D8] hover:border-[#3D2B1F] hover:text-[#3D2B1F] transition"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#F5F0E6] last:border-0">
      <span className="text-xs font-bold text-[#8A7668] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-bold text-[#3D2B1F]">{value}</span>
    </div>
  )
}