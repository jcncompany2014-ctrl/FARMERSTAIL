'use client'

// B11 — vaccinations DB 마이그 (R15-B). localStorage → Supabase.
// 기존 localStorage 데이터는 마이그레이션 X (베타 단계, 사용자 거의 없음).
// 2026-10-09 앱 새 디자인('A 포스터', 시안 D16 예방접종 · D17 예방접종 추가 창):
//   먹선 보조 버튼 '새 기록 추가' → "다가오는 접종"(이 화면의 핵심 카드 — 머스타드 + 먹선 2 + 도장 그림자)
//   → "기록"(위 1.5px 먹선 목록 · 휴지통). 날짜는 "2026. 11. 20." 꼴(예전엔 2026-11-20 그대로였다).
//   백신 이름 "DHPPL (종합)" → "종합백신 (DHPPL)"(시안). 저장·삭제 로직은 그대로.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { petName } from '@/lib/korean'
import { useConfirm } from '@/components/v3'
import { V3, V3Radius, V3Shadow } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import {
  listVaccinations,
  insertVaccination,
  deleteVaccination,
  type VaccinationRow,
} from '@/lib/dog-records'
import { CheckIcon, PlusIcon, SyringeIcon, TrashIcon } from '@/components/v3/dog/DogIcons'
import {
  Field,
  FormError,
  PickerField,
  SectionTitle,
  SelectField,
  TextField,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '@/components/v3/dog/DogFormParts'

// 한국 견 예방접종 표준 (DHPPL, 코로나, 켄넬코프, 광견병).
const VACCINE_OPTIONS = [
  { value: 'DHPPL', label: '종합백신 (DHPPL)' },
  { value: 'Corona', label: '코로나 장염' },
  { value: 'KennelCough', label: '켄넬코프' },
  { value: 'Rabies', label: '광견병' },
  { value: 'Heartworm', label: '심장사상충 예방약' },
  { value: 'Other', label: '기타' },
]

function vaccineLabel(v: string): string {
  return VACCINE_OPTIONS.find((o) => o.value === v)?.label ?? v
}

/** 'YYYY-MM-DD' → '2026. 11. 20.'(시안 · 우리말 날짜 꼴). */
function dotDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${y}. ${Number(m)}. ${Number(d)}.`
}

export default function VaccinationsClient({
  dogId,
  dogName,
  previewRecords,
  previewAddOpen = false,
}: {
  dogId: string
  dogName: string
  /** 점검 화면(/design-check/dogs) 전용 — 조회 없이 이 기록으로 그린다. 실제 화면은 넘기지 않는다. */
  previewRecords?: VaccinationRow[]
  /** 점검 화면 전용 — 추가 창을 연 채로(예시 값을 채워) 시작. */
  previewAddOpen?: boolean
}) {
  const supabase = createClient()
  const [records, setRecords] = useState<VaccinationRow[]>(previewRecords ?? [])
  const [loading, setLoading] = useState(previewRecords === undefined)
  const [open, setOpen] = useState(previewAddOpen)
  const [vaccine, setVaccine] = useState(previewAddOpen ? 'Rabies' : '')
  const [date, setDate] = useState(previewAddOpen ? '2025-11-20' : '')
  const [next, setNext] = useState(previewAddOpen ? '2026-11-20' : '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // fetch 실패를 '기록 없음' 빈 상태로 위장하던 버그 방지(2026-07-17).
  const [loadError, setLoadError] = useState(false)
  const confirm = useConfirm()

  useEffect(() => {
    // 점검 화면은 예시 기록으로 그린다(로그인이 없어 조회하면 빈 목록이 된다).
    if (previewRecords !== undefined) return
    let mounted = true
    setLoadError(false)
    listVaccinations(supabase, dogId)
      .then((rows) => {
        if (!mounted) return
        setRecords(rows)
      })
      .catch((e) => {
        console.error('listVaccinations', e)
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
    if (!vaccine || !date || saving) return
    setErr(null)
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('not-authed')
      const rec = await insertVaccination(supabase, {
        dog_id: dogId,
        user_id: user.id,
        vaccine,
        date,
        next_date: next || null,
        note: note || null,
      })
      setRecords((rs) =>
        [rec, ...rs].sort((a, b) => b.date.localeCompare(a.date)),
      )
      setOpen(false)
      setVaccine('')
      setDate('')
      setNext('')
      setNote('')
    } catch (e) {
      console.error('insertVaccination', e)
      setErr('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '예방접종 기록을 삭제할까요?',
      body: '삭제한 기록은 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'destructive',
    })
    if (!ok) return
    try {
      await deleteVaccination(supabase, id)
      setRecords((rs) => rs.filter((r) => r.id !== id))
    } catch (e) {
      console.error('deleteVaccination', e)
    }
  }

  const today = todayKstIsoDate()
  const upcoming = records
    .filter((r) => r.next_date && r.next_date >= today)
    .sort((a, b) => (a.next_date ?? '').localeCompare(b.next_date ?? ''))

  const listNote = { margin: 0, padding: '28px 0', textAlign: 'center', fontSize: 16, lineHeight: 1.55, color: V3.inkMute } as const

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
        새 기록 추가
      </button>

      {upcoming.length > 0 && (
        <section aria-labelledby="vac-upcoming-title" style={{ margin: '26px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <SectionTitle>
            <span id="vac-upcoming-title">다가오는 접종</span>
          </SectionTitle>
          <div
            style={{
              border: `2px solid ${V3.ink}`,
              boxShadow: V3Shadow.stamp,
              borderRadius: V3Radius.sm,
              background: V3.mustard,
              color: V3.ink,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {upcoming.map((r, i) => (
              <div
                key={r.id}
                style={{
                  minHeight: 68,
                  padding: '0 16px',
                  borderBottom: i < upcoming.length - 1 ? '1px solid rgba(20, 20, 20, 0.2)' : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{vaccineLabel(r.vaccine)}</span>
                  <span style={{ fontSize: 15 }}>
                    다음 일정 <strong style={{ fontWeight: 800 }}>{dotDate(r.next_date ?? '')}</strong>
                  </span>
                </span>
                <SyringeIcon size={22} color={V3.ink} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section
        aria-labelledby="vac-list-title"
        style={{ margin: `${upcoming.length > 0 ? 30 : 26}px 20px 0`, display: 'flex', flexDirection: 'column' }}
      >
        <SectionTitle>
          <span id="vac-list-title">기록</span>
        </SectionTitle>
        {loading ? (
          <p style={listNote}>불러오는 중…</p>
        ) : loadError ? (
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: V3.inkMute }}>
              접종 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
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
          <p style={{ ...listNote, borderTop: `1.5px solid ${V3.ink}` }}>
            아직 기록이 없어요. {petName(dogName)}의 첫 접종 기록을 추가해 보세요.
          </p>
        ) : (
          <div style={{ borderTop: `1.5px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
            {records.map((r) => (
              <div
                key={r.id}
                style={{
                  minHeight: 72,
                  boxSizing: 'border-box',
                  padding: '12px 0',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr 48px',
                  alignItems: 'center',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{vaccineLabel(r.vaccine)}</span>
                  <span style={{ fontSize: 15, color: V3.inkMute }}>
                    접종일 {dotDate(r.date)}
                    {r.next_date && ` · 다음 ${dotDate(r.next_date)}`}
                  </span>
                  {r.note && <span style={{ fontSize: 16, color: V3.inkSoft }}>{r.note}</span>}
                </span>
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
              </div>
            ))}
          </div>
        )}
      </section>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="새 예방접종 기록"
        dismissOnBackdrop={!saving}
      >
        <BottomSheet.Body>
          <div style={{ lineHeight: 'normal', color: V3.ink, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
            <h2 style={{ margin: '-2px 0 0', fontSize: 26, lineHeight: 1.15 }}>새 예방접종 기록</h2>
            <p style={{ margin: '6px 0 0', fontSize: 16, color: V3.inkSoft }}>
              접종일과 다음 일정을 기록해 두면 놓치지 않아요
            </p>

            <Field label="백신" required style={{ marginTop: 18 }}>
              <SelectField
                value={vaccine}
                onChange={(e) => setVaccine(e.target.value)}
                aria-label="백신"
                options={[{ value: '', label: '선택하세요' }, ...VACCINE_OPTIONS]}
              />
            </Field>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <Field label="접종일" required>
                <PickerField
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={today}
                  aria-label="접종일"
                  height={54}
                  fontSize={16}
                  padX={12}
                />
              </Field>
              <Field label="다음 일정">
                <PickerField
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  min={date || today}
                  aria-label="다음 일정"
                  height={54}
                  fontSize={16}
                  padX={12}
                />
              </Field>
            </div>
            <Field label="메모" style={{ marginTop: 14 }}>
              <TextField
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="메모"
                placeholder="예: 동물병원, 이상반응 없음"
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
                disabled={!vaccine || !date || saving}
                aria-busy={saving || undefined}
                style={primaryButtonStyle(58, !vaccine || !date || saving)}
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
