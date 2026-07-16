'use client'

/**
 * 건강 관리 통합 — 복약 · 예방접종 · 리마인더를 한 페이지 탭으로(사장님 2026-07-16).
 *
 * 세 기능이 각자 메뉴였던 걸 하나로 묶는다. 기존 세 클라이언트의 로직(추가·삭제·
 * 토글·markDone)을 그대로 재사용하고, 여기선 탭 전환만 담당한다. 리마인더는
 * embedded=true 로 자체 헤더를 숨긴다(페이지 헤더가 위에 하나만 있으면 됨).
 */

import { useState } from 'react'
import { Tabs } from '@/components/v3'
import MedicationsClient from '../medications/MedicationsClient'
import VaccinationsClient from '../vaccinations/VaccinationsClient'
import RemindersClient, { type Reminder } from '../reminders/RemindersClient'

const TABS = [
  { key: 'medications', label: '복약' },
  { key: 'vaccinations', label: '예방접종' },
  { key: 'reminders', label: '리마인더' },
]

export default function HealthCareClient({
  dogId,
  dogName,
  initialReminders,
  initialTab,
}: {
  dogId: string
  dogName: string
  initialReminders: Reminder[]
  initialTab?: string
}) {
  const [tab, setTab] = useState(
    TABS.some((t) => t.key === initialTab) ? (initialTab as string) : 'medications',
  )

  return (
    <div className="pb-10">
      <section className="px-5 mt-4">
        <Tabs value={tab} onChange={setTab} options={TABS} />
      </section>

      {tab === 'medications' && <MedicationsClient dogId={dogId} />}
      {tab === 'vaccinations' && (
        <VaccinationsClient dogId={dogId} dogName={dogName} />
      )}
      {tab === 'reminders' && (
        <RemindersClient
          dogId={dogId}
          dogName={dogName}
          initial={initialReminders}
          embedded
        />
      )}
    </div>
  )
}
