'use client'

// B12 — medications DB 마이그 (R15-B). localStorage → Supabase.
// 2026-10-09 앱 새 디자인('A 포스터', 시안 D14 복약 · D15 약물 추가 창):
//   먹선 보조 버튼 '약물 추가' → 위 2px 먹선 목록(약 그림 + 이름 18 · 주기·시간·용량 · 메모 | 알림 스위치 · 휴지통).
//   스위치는 시안 크기(52×30, 켜짐 먹색 · 꺼짐 옅은 회색) — 공용 v3 Toggle 은 건드리지 않고 여기서 그린다.
//   약물 추가 창은 시트 기본 제목·바닥 띠 대신 시안 틀(큰 제목 · 1.5px 칸 · 윗선 아래 먹색 '저장')을 직접 그린다.
//   저장·삭제·켜고 끄기 로직은 그대로.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/v3'
import { V3 } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import {
  listMedications,
  insertMedication,
  deleteMedication,
  setMedicationEnabled,
  type MedicationRow,
} from '@/lib/dog-records'
import { useToast } from '@/components/ui/Toast'
import { CheckIcon, PillIcon, PlusIcon, TrashIcon } from '@/components/v3/dog/DogIcons'
import {
  Field,
  FormError,
  PickerField,
  SelectField,
  TextField,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '@/components/v3/dog/DogFormParts'

/** 알림 스위치 — 시안 D14(52×30 · 손잡이 24). */
function AlarmSwitch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden style={{ fontSize: 13, fontWeight: 700, color: checked ? V3.inkSoft : V3.inkMute }}>
        알림
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="알림"
        onClick={() => onChange(!checked)}
        className="ft-no-press"
        style={{
          position: 'relative',
          width: 52,
          height: 30,
          padding: 0,
          border: 0,
          borderRadius: 15,
          background: checked ? V3.ink : '#D5D3D4',
          cursor: 'pointer',
          transition: 'background 160ms',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: '#FFFFFF',
            transition: 'left 160ms',
          }}
        />
      </button>
    </span>
  )
}

/** 목록 위·빈 칸 안내 글. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, padding: '32px 0', textAlign: 'center', fontSize: 16, lineHeight: 1.55, color: V3.inkMute }}>
      {children}
    </p>
  )
}

export default function MedicationsClient({
  dogId,
  previewRecords,
  previewAddOpen = false,
}: {
  dogId: string
  /** 점검 화면(/design-check/dogs) 전용 — 조회 없이 이 기록으로 그린다. 실제 화면은 넘기지 않는다. */
  previewRecords?: MedicationRow[]
  /** 점검 화면 전용 — 약물 추가 창을 연 채로(예시 값을 채워) 시작. */
  previewAddOpen?: boolean
}) {
  const supabase = createClient()
  const [records, setRecords] = useState<MedicationRow[]>(previewRecords ?? [])
  const [loading, setLoading] = useState(previewRecords === undefined)
  const [open, setOpen] = useState(previewAddOpen)
  const [name, setName] = useState(previewAddOpen ? '피부 연고' : '')
  const [dose, setDose] = useState(previewAddOpen ? '얇게 한 번' : '')
  const [schedule, setSchedule] =
    useState<MedicationRow['schedule']>('daily')
  const [time, setTime] = useState(previewAddOpen ? '21:00' : '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // fetch 실패를 빈 상태('없어요')로 위장하던 버그 방지(2026-07-17) — 실패 시 에러 UI.
  const [loadError, setLoadError] = useState(false)
  const confirm = useConfirm()
  const toast = useToast()

  useEffect(() => {
    // 점검 화면은 예시 기록으로 그린다(로그인이 없어 조회하면 빈 목록이 된다).
    if (previewRecords !== undefined) return
    let mounted = true
    setLoadError(false)
    listMedications(supabase, dogId)
      .then((rows) => {
        if (mounted) setRecords(rows)
      })
      .catch((e) => {
        console.error('listMedications', e)
        if (mounted) setLoadError(true)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [supabase, dogId, previewRecords])

  async function handleAdd() {
    if (!name || saving) return
    setErr(null)
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('not-authed')
      const rec = await insertMedication(supabase, {
        dog_id: dogId,
        user_id: user.id,
        name,
        schedule,
        dose: dose || null,
        time: time || null,
        enabled: true,
        note: note || null,
      })
      setRecords((rs) => [rec, ...rs])
      setOpen(false)
      setName('')
      setDose('')
      setSchedule('daily')
      setTime('')
      setNote('')
    } catch (e) {
      console.error('insertMedication', e)
      setErr('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string, next: boolean) {
    // optimistic
    setRecords((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: next } : r)),
    )
    try {
      await setMedicationEnabled(supabase, id, next)
    } catch (e) {
      console.error('setMedicationEnabled', e)
      // rollback
      setRecords((rs) =>
        rs.map((r) => (r.id === id ? { ...r, enabled: !next } : r)),
      )
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '복약 기록을 삭제할까요?',
      body: '삭제한 기록은 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'destructive',
    })
    if (!ok) return
    try {
      await deleteMedication(supabase, id)
      setRecords((rs) => rs.filter((r) => r.id !== id))
    } catch (e) {
      console.error('deleteMedication', e)
      toast.error('삭제하지 못했어요')
    }
  }

  const SCHED_LABEL: Record<MedicationRow['schedule'], string> = {
    daily: '매일',
    weekly: '매주',
    asneeded: '필요할 때',
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErr(null)
          setOpen(true)
        }}
        style={{ ...secondaryButtonStyle(59, 17), width: 'calc(100% - 40px)', margin: '20px 20px 0' }}
      >
        <PlusIcon size={20} />
        약물 추가
      </button>

      <section aria-label="복약 목록" style={{ margin: '22px 20px 0' }}>
        {loading ? (
          <Note>불러오는 중…</Note>
        ) : loadError ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: V3.inkMute }}>
              약물 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 8,
                minHeight: 44,
                padding: '0 8px',
                border: 0,
                background: 'transparent',
                color: V3.ink,
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 800,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
          </div>
        ) : records.length === 0 ? (
          <Note>등록된 약물이 없어요. 정기 복약이 필요한 약을 추가해 보세요.</Note>
        ) : (
          <div style={{ borderTop: `2px solid ${V3.ink}` }}>
            {records.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '16px 0',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  columnGap: 12,
                  alignItems: 'start',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800 }}>
                    <PillIcon size={18} color={V3.ink} />
                    {r.name}
                  </span>
                  <span style={{ fontSize: 15, color: V3.inkMute }}>
                    {SCHED_LABEL[r.schedule]}
                    {r.time && ` · ${r.time}`}
                    {r.dose && ` · ${r.dose}`}
                  </span>
                  {r.note && <span style={{ fontSize: 16, color: V3.inkSoft }}>{r.note}</span>}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <AlarmSwitch checked={r.enabled} onChange={(v) => handleToggle(r.id, v)} />
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    aria-label="삭제"
                    style={{
                      width: 48,
                      height: 48,
                      marginRight: -12,
                      border: 0,
                      background: 'transparent',
                      color: V3.inkMute,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <TrashIcon size={21} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="약물 추가"
        dismissOnBackdrop={!saving}
      >
        <BottomSheet.Body>
          <div style={{ lineHeight: 'normal', color: V3.ink, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
            <h2 style={{ margin: '-2px 0 0', fontSize: 26, lineHeight: 1.15 }}>약물 추가</h2>
            <p style={{ margin: '6px 0 0', fontSize: 16, color: V3.inkSoft }}>정기 복약·영양제 시간과 용량을 기록해요</p>

            <Field label="약물 이름" required style={{ marginTop: 18 }}>
              <TextField
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="약물 이름"
                placeholder="예: 심장사상충 예방약"
                height={54}
              />
            </Field>
            <Field label="용량" style={{ marginTop: 14 }}>
              <TextField
                type="text"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                aria-label="용량"
                // 예전 "예: 1/2 tab" 은 영어 — 같은 뜻의 우리말로.
                placeholder="예: 반 알"
                height={54}
              />
            </Field>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <Field label="주기" required>
                <SelectField
                  value={schedule}
                  onChange={(e) =>
                    setSchedule(e.target.value as MedicationRow['schedule'])
                  }
                  aria-label="주기"
                  options={[
                    { value: 'daily', label: '매일' },
                    { value: 'weekly', label: '매주' },
                    { value: 'asneeded', label: '필요할 때' },
                  ]}
                />
              </Field>
              <Field label="시간">
                <PickerField
                  kind="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-label="복약 시간"
                  height={54}
                />
              </Field>
            </div>
            <Field label="메모" style={{ marginTop: 14 }}>
              <TextField
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="메모"
                placeholder="예: 밥 직후 복용"
                height={54}
              />
            </Field>

            {/* ★시트 안에서는 토스트를 쓰지 않는다(2026-08-05 감사).
                BottomSheet 는 <dialog>.showModal() 이라 브라우저 **top layer**
                로 올라가고 나머지 문서는 inert 가 된다 — z-index 와 무관하게
                항상 위다. 그래서 시트가 열린 채 띄운 toast.error 는 통째로 가려져,
                고객은 저장 버튼을 눌렀는데 **아무 반응 없는 화면**을 봤다.
                (popover 로 토스트를 top layer 에 올리는 방법도 재봤지만, 모달이
                 문서를 inert 로 만드는 탓에 이 조합에서 신뢰할 수 없었다 —
                 검증 못 한 방어는 넣지 않는다.)
                QuickHealthSheet 가 이미 쓰는 인라인 에러 패턴으로 통일한다. */}
            <FormError msg={err} style={{ marginTop: 12 }} />

            {/* 저장 — 윗선 아래(시안: 위 20 · 선 · 위 12). 시트 바닥 띠(반투명) 대신 본문 안에 둔다. */}
            <div style={{ margin: '20px -20px 0', padding: '12px 20px 0', borderTop: `1px solid ${V3.rule}` }}>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!name || saving}
                aria-busy={saving || undefined}
                style={primaryButtonStyle(58, !name || saving)}
              >
                <CheckIcon size={20} />
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </BottomSheet.Body>
      </BottomSheet>
    </>
  )
}
