'use client'

/**
 * 알림 통합 — 받은 알림 · 알림 설정 · 광고 수신을 한 페이지 탭으로(사장님 2026-07-16).
 *
 * 세 개였던 마이페이지 메뉴(받은 알림 / 알림 받기·화면테마 / 광고 수신 설정)를 하나로.
 * 화면 테마 토글은 삭제. 기존 세 클라이언트를 embedded 로 재사용(자체 헤더 숨김) —
 * 로직(읽음처리·푸시구독·동의철회)은 그대로 살아 있다. 탭 전환만 여기서 담당.
 */

import { useState } from 'react'
import { Tabs } from '@/components/v3'
import NotificationsClient, { type Row } from './NotificationsClient'
import NotificationSettingsClient from '../mypage/notifications/NotificationSettingsClient'
import ConsentSettingsClient from '../mypage/consent/ConsentSettingsClient'

type SettingsProps = React.ComponentProps<typeof NotificationSettingsClient>
type ConsentProps = React.ComponentProps<typeof ConsentSettingsClient>

const TABS = [
  { key: 'inbox', label: '받은 알림' },
  { key: 'push', label: '알림 설정' },
  { key: 'consent', label: '광고 수신' },
]

export default function AlertsClient({
  inboxRows,
  pushSubs,
  vapidPublicKey,
  consentInitial,
  consentHistory,
  initialTab,
}: {
  inboxRows: Row[]
  pushSubs: SettingsProps['initialSubs']
  vapidPublicKey: SettingsProps['vapidPublicKey']
  consentInitial: ConsentProps['initial']
  consentHistory: ConsentProps['history']
  initialTab?: string
}) {
  const [tab, setTab] = useState(
    TABS.some((t) => t.key === initialTab) ? (initialTab as string) : 'inbox',
  )

  return (
    <div className="pb-10">
      <section className="px-5 pt-6 pb-1">
        <span className="kicker mt-3 block">Alerts</span>
        <h1
          className="font-sans mt-1.5"
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          알림
        </h1>
      </section>

      <section className="px-5 mt-4">
        <Tabs value={tab} onChange={setTab} options={TABS} />
      </section>

      {tab === 'inbox' && <NotificationsClient initialRows={inboxRows} embedded />}
      {tab === 'push' && (
        <NotificationSettingsClient
          initialSubs={pushSubs}
          vapidPublicKey={vapidPublicKey}
          embedded
        />
      )}
      {tab === 'consent' && (
        <ConsentSettingsClient
          initial={consentInitial}
          history={consentHistory}
          embedded
        />
      )}
    </div>
  )
}
