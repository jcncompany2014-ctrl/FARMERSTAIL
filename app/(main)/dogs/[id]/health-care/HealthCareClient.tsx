'use client'

/**
 * 건강 관리 통합 — 복약 · 예방접종 · 리마인더를 한 페이지 탭으로(사장님 2026-07-16).
 *
 * 세 기능이 각자 메뉴였던 걸 하나로 묶는다. 기존 세 클라이언트의 로직(추가·삭제·
 * 토글·markDone)을 그대로 재사용하고, 여기선 탭 전환만 담당한다. 리마인더는
 * embedded=true 로 자체 헤더를 숨긴다(페이지 헤더가 위에 하나만 있으면 됨).
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 D14·D16·D18): 화면 머리(제목 "{이름}의 건강 관리" + 한 줄)도
 * 여기서 그린다(예전엔 page.tsx — 점검 화면이 같은 부품으로 그리게 옮겼다, 조회는 그대로 page.tsx).
 * 종류 고르기 = 회색 면 안 세 칸(높이 48), 고른 칸 = 흰 바탕 + 1.5px 먹선. 공용 v3 Tabs(먹색 칸)는
 * 알림 화면도 쓰는 부품이라 건드리지 않고, 기록 허브(일상·건강일지)와 같은 모양을 여기서 직접 그린다.
 */

import { useRef, useState, type KeyboardEvent } from 'react'
import { petName } from '@/lib/korean'
import { V3, V3Radius } from '@/lib/design/tokens'
import MedicationsClient from '../medications/MedicationsClient'
import VaccinationsClient from '../vaccinations/VaccinationsClient'
import RemindersClient, { type Reminder } from '../reminders/RemindersClient'
import type { MedicationRow, VaccinationRow } from '@/lib/dog-records'

const TABS = [
  { key: 'medications', label: '복약' },
  { key: 'vaccinations', label: '예방접종' },
  { key: 'reminders', label: '리마인더' },
]

/** 점검 화면(/design-check/dogs) 전용 — 조회 없이 예시 기록·열린 창으로 시작. 실제 화면은 넘기지 않는다. */
export type HealthCarePreview = {
  medications?: MedicationRow[]
  vaccinations?: VaccinationRow[]
  /** 약물 추가·예방접종 추가 창을 연 채로(시안 D15·D17), 리마인더 추가 칸을 편 채로(D19). */
  openAdd?: boolean
}

export default function HealthCareClient({
  dogId,
  dogName,
  initialReminders,
  initialTab,
  preview,
}: {
  dogId: string
  dogName: string
  initialReminders: Reminder[]
  initialTab?: string
  preview?: HealthCarePreview
}) {
  const [tab, setTab] = useState(
    TABS.some((t) => t.key === initialTab) ? (initialTab as string) : 'medications',
  )
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  // WAI-ARIA tabs 키보드 — ←/→ 옆 칸, Home/End 처음·끝(공용 Tabs 와 같은 동작).
  function onKey(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next === null) return
    e.preventDefault()
    const t = TABS[next]
    if (!t) return
    setTab(t.key)
    tabRefs.current[next]?.focus()
  }

  return (
    // 줄 높이 normal — 시안은 줄 높이를 안 준 글자가 글꼴 기본값이다(앱 전역 1.5 로 두면 칸마다 커진다).
    <div style={{ paddingBottom: 32, lineHeight: 'normal' }}>
      <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, wordBreak: 'keep-all' }}>
          {petName(dogName)}의 건강 관리
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: V3.inkSoft }}>복약·예방접종·리마인더를 한곳에서</p>
      </section>

      <div
        role="tablist"
        aria-label="건강 관리 종류"
        style={{
          margin: '18px 20px 0',
          padding: 4,
          borderRadius: V3Radius.sm,
          background: V3.soft,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 4,
        }}
      >
        {TABS.map((t, i) => {
          const on = t.key === tab
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onKey(e, i)}
              className="ft-no-press"
              style={{
                height: 48,
                boxSizing: 'border-box',
                borderRadius: V3Radius.sm,
                border: on ? `1.5px solid ${V3.ink}` : 0,
                background: on ? '#FFFFFF' : 'transparent',
                color: on ? V3.ink : V3.inkMute,
                fontFamily: 'inherit',
                fontSize: 17,
                fontWeight: on ? 800 : 600,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'medications' && (
        <MedicationsClient dogId={dogId} previewRecords={preview?.medications} previewAddOpen={preview?.openAdd} />
      )}
      {tab === 'vaccinations' && (
        <VaccinationsClient
          dogId={dogId}
          dogName={dogName}
          previewRecords={preview?.vaccinations}
          previewAddOpen={preview?.openAdd}
        />
      )}
      {tab === 'reminders' && (
        <RemindersClient
          dogId={dogId}
          dogName={dogName}
          initial={initialReminders}
          embedded
          previewAdding={preview?.openAdd}
        />
      )}
    </div>
  )
}
