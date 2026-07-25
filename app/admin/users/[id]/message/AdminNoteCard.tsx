'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StickyNote, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

/**
 * 고객 운영 메모 (계획 A-F5) — CS 기억 보조.
 *
 * # 왜
 * "이 분 지난번 배송 지연으로 사과드렸던 고객" 같은 맥락을 머리로 기억 중이다.
 * 다음에 이 고객과 대화할 때 그 맥락이 화면에 같이 떠야 한다.
 *
 * # 어디에 저장하나
 * profiles.admin_note (마이그레이션 profiles_admin_note). RLS 상 **고객 본인도
 * 자기 profiles row 를 읽을 수 있으므로**, 고객이 봐도 곤란하지 않은 표현만
 * 적어야 한다 — 그 경고를 UI 에 항상 띄운다(잊고 민감한 메모를 남기는 사고 방지).
 */
export default function AdminNoteCard({
  userId,
  initial,
}: {
  userId: string
  initial: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [value, setValue] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const [savedValue, setSavedValue] = useState(initial ?? '')

  const dirty = value !== savedValue

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ admin_note: value.trim() || null })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      toast.error('메모 저장에 실패했어요')
      console.error('[admin-note] save error:', error.message)
      return
    }
    setSavedValue(value)
    toast.success('메모를 저장했어요')
    router.refresh()
  }

  return (
    <section className="mb-5 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <StickyNote className="h-4 w-4 text-amber-500" strokeWidth={2.2} />
        <h2 className="text-[13px] font-bold text-zinc-900">운영 메모</h2>
        <span className="text-[11px] text-zinc-500">
          — 이 고객과 대화할 때 기억할 것
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 1000))}
        rows={3}
        placeholder="예: 7월 배송 지연으로 사과드림 · 오리 알레르기 문의 있었음"
        className="w-full rounded-md border border-zinc-200 px-3 py-2 text-[13px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-amber-700">
          ⚠️ 고객 본인도 볼 수 있는 항목이에요 — 민감한 표현은 쓰지 마세요.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-bold transition ${
            dirty && !saving
              ? 'bg-zinc-900 text-white hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
          }`}
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />}
          {saving ? '저장 중' : dirty ? '메모 저장' : '저장됨'}
        </button>
      </div>
    </section>
  )
}
