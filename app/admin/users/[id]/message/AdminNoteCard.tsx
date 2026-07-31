'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StickyNote, Loader2 } from 'lucide-react'
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
  const toast = useToast()
  const [value, setValue] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const [savedValue, setSavedValue] = useState(initial ?? '')

  const dirty = value !== savedValue

  async function save() {
    setSaving(true)
    /**
     * ★ 서버 라우트로 저장한다 (2026-07-31).
     *
     * 예전엔 여기서 쿠키 클라이언트로 `profiles.admin_note` 를 직접 썼다.
     * 그런데 profiles 는 모든 칸이 authenticated 에게 열려 있었고 RLS 는 본인
     * 행 UPDATE 를 허용해서 — **고객이 자기 admin_note 를 지우거나 위조할 수
     * 있었다.** 사장님이 그 고객에 대해 적어 둔 상담 내용이 당사자 손에 있었던 셈.
     * 20260731000100 이 admin_note 를 고객 권한에서 뺐고, 쓰기는 관리자 검증을
     * 거친 서버 라우트가 한다.
     */
    const res = await fetch(`/api/admin/users/${userId}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: value.trim() || null }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error('메모 저장에 실패했어요')
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
