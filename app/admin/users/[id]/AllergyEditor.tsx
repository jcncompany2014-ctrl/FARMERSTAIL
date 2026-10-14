'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ALLERGY_GROUPS, normalizeAllergyAnswers } from '@/lib/survey/allergy-options'
import { FOOD_LINE_META } from '@/lib/personalization/lines'
import type { FoodLine } from '@/lib/personalization/types'
import type { AllergyImpact } from '@/lib/admin/allergy-edit'

/**
 * 강아지 알레르기 고치기 (2026-10-14 C5, 규칙258).
 *
 * 설문은 기록이라 덮어쓰지 않는다 — 서버가 최신 설문을 복사한 '관리자 수정' 새 행을 남긴다(옛 답은 그대로).
 * 저장 전에 '영향 보기'로 지금 박스가 어떻게 되는지 먼저 보여 준다(정본 computeBoxPlan 으로 전·후 계산).
 * 레시피·금액은 여기서 바꾸지 않는다 — 바꿔야 하면 '고객에게 새 식단 제안 보내기'로 재제안 크론의 동의 흐름을 탄다.
 */

type Preview = {
  prevAllergies: string[]
  nextAllergies: string[]
  unchanged: boolean
  hasLiveSubscription: boolean
  liveActive: boolean
  impact: AllergyImpact
}

function lineNames(lines: readonly FoodLine[]): string {
  return lines.map((l) => FOOD_LINE_META[l]?.nameKo ?? l).join(' · ')
}

export default function AllergyEditor({
  userId,
  dogId,
  dogName,
  current,
  hasSurvey,
  demo = false,
}: {
  userId: string
  dogId: string
  dogName: string
  current: string[] | null
  hasSurvey: boolean
  demo?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>(normalizeAllergyAnswers(current ?? []))
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [propose, setPropose] = useState(false)
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)

  const options: string[] = ALLERGY_GROUPS.flatMap((g) => [...g.options])
  // 지금 보기에 없는 옛 값(뺀 보기·옛 라벨)도 그대로 보여 준다 — 버리면 기록이 조용히 사라진다.
  const extras = normalizeAllergyAnswers(current ?? []).filter((v) => !options.includes(v))

  function toggle(v: string) {
    setPreview(null)
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))
  }

  async function post(action: 'preview' | 'save'): Promise<Record<string, unknown> | null> {
    const res = await fetch(`/api/admin/users/${userId}/allergies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        dogId,
        allergies: picked,
        note: note.trim() || undefined,
        requestProposal: action === 'save' ? propose : undefined,
      }),
    })
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok) {
      toast.error((j?.message as string) ?? '처리하지 못했어요')
      return null
    }
    return j
  }

  async function runPreview() {
    if (demo) {
      toast.info('점검 화면이라 계산하지 않아요')
      return
    }
    setBusy('preview')
    const j = await post('preview')
    setBusy(null)
    if (!j) return
    const p = j as unknown as Preview
    setPreview(p)
    setPropose(p.liveActive && (p.impact.heldAfter.length > 0 || p.impact.addedBlockedLines.length > 0))
  }

  async function save() {
    if (!preview || preview.unchanged) return
    const msg = [
      `${dogName} 알레르기를 바꿀까요?`,
      `전: ${preview.prevAllergies.join(', ') || '없음'}`,
      `후: ${preview.nextAllergies.join(', ') || '없음'}`,
      '',
      '고객 설문은 그대로 두고 관리자 수정 기록을 새로 남겨요. 작업 기록이 남아요.',
      propose ? '내일 아침 재제안 때 고객에게 새 식단 제안이 가요(금액이 바뀌면 고객 동의 후 반영).' : '',
    ]
      .filter((x) => x !== null)
      .join('\n')
    if (!window.confirm(msg)) return
    setBusy('save')
    const j = await post('save')
    setBusy(null)
    if (!j) return
    const proposal = j.proposal as { ok?: boolean; message?: string; alreadyQueued?: boolean } | undefined
    if (proposal && !proposal.ok) toast.info(proposal.message ?? '제안 요청은 보내지 못했어요')
    else toast.success(proposal?.ok ? '알레르기를 바꾸고 새 식단 제안을 예약했어요' : '알레르기를 바꿨어요')
    setOpen(false)
    setPreview(null)
    router.refresh()
  }

  if (!hasSurvey) {
    return (
      <p className="text-[12px] text-muted-foreground">
        설문 기록이 없어 알레르기를 고칠 수 없어요 — 고객이 설문을 먼저 해야 해요.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-bold text-foreground"
      >
        <ShieldAlert className="size-3.5" strokeWidth={2.2} />
        알레르기 고치기
      </button>
    )
  }

  const impact = preview?.impact
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      {ALLERGY_GROUPS.map((g) => (
        <div key={g.label} className="mb-2">
          <p className="mb-1 text-[12px] font-bold text-muted-foreground">{g.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                aria-pressed={picked.includes(o)}
                className={`rounded-full px-3 py-1 text-[13px] font-bold transition ${
                  picked.includes(o) ? 'bg-red-600 text-white' : 'border border-border bg-card text-foreground'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}
      {extras.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[12px] font-bold text-muted-foreground">예전 보기(지금 설문엔 없음)</p>
          <div className="flex flex-wrap gap-1.5">
            {extras.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                aria-pressed={picked.includes(o)}
                className={`rounded-full px-3 py-1 text-[13px] font-bold ${
                  picked.includes(o) ? 'bg-red-600 text-white' : 'border border-border bg-card text-foreground'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 200))}
        placeholder="메모 (예: 10/14 카톡 — 닭 먹으면 긁는다고 함)"
        className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground"
      />

      {impact && preview && (
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed">
          {preview.unchanged ? (
            <p className="text-muted-foreground">지금 설문과 같아요 — 바꿀 게 없어요.</p>
          ) : (
            <>
              {impact.addedBlockedLines.length > 0 && (
                <p className="text-foreground">
                  새로 빠지는 레시피: <b>{lineNames(impact.addedBlockedLines)}</b>
                </p>
              )}
              {impact.removedBlockedLines.length > 0 && (
                <p className="text-foreground">
                  다시 쓸 수 있는 레시피: <b>{lineNames(impact.removedBlockedLines)}</b>
                </p>
              )}
              {impact.computed && impact.heldAfter.length > impact.heldBefore.length ? (
                <p className="rounded-md border border-red-300 bg-red-50 p-2 font-semibold text-red-700">
                  지금 식단에 {lineNames(impact.heldAfter.map((h) => h.line))} 레시피가 들어 있어요 — 저장하면 포장 목록에서 이 박스가
                  &lsquo;알레르기 확인 필요 — 보내지 마세요&rsquo;로 멈춰요. 레시피·금액은 고객 동의로만 바뀌어요.
                </p>
              ) : impact.computed && impact.itemsChanged ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
                  박스에 담기는 팩이 달라져요(대체 레시피). 다음 결제 금액은 저장 금액 그대로예요.
                </p>
              ) : impact.computed ? (
                <p className="text-muted-foreground">지금 박스 구성은 그대로예요.</p>
              ) : (
                <p className="text-muted-foreground">
                  {preview.hasLiveSubscription
                    ? '지금 식단·화식 비율을 몰라 박스 영향을 계산하지 못했어요.'
                    : '진행 중인 정기배송이 없어 지금 박스에는 영향이 없어요. 다음 신청 때 고친 알레르기로 계산돼요.'}
                </p>
              )}
              {preview.liveActive && (
                <label className="flex items-start gap-2 rounded-md border border-border bg-card p-2.5">
                  <input type="checkbox" checked={propose} onChange={(e) => setPropose(e.target.checked)} className="mt-1" />
                  <span>
                    <b>고객에게 새 식단 제안 보내기</b> — 박스 3개를 기다리지 않고 내일 아침(10시 재제안) 같은 동의 흐름으로 보내요.
                    금액이 바뀌면 고객이 3일 안에 동의해야 바뀌고, 무응답이면 지금 식단 그대로예요.
                  </span>
                </label>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setPreview(null)
          }}
          className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted-foreground"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={runPreview}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-bold text-foreground disabled:opacity-50"
        >
          {busy === 'preview' && <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />}
          영향 보기
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy !== null || !preview || preview.unchanged}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-[13px] font-bold text-background disabled:opacity-40"
        >
          {busy === 'save' && <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />}
          저장
        </button>
      </div>
    </div>
  )
}
