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
  initialTab,
}: {
  inboxRows: Row[]
  pushSubs: SettingsProps['initialSubs']
  vapidPublicKey: SettingsProps['vapidPublicKey']
  /** null = 동의 현황 조회 실패. '미동의' 로 그리면 안 된다 — 아래 렌더 주석 참고. */
  consentInitial: ConsentProps['initial'] | null
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
      {tab === 'consent' &&
        /**
         * ★ 조회 실패(null)를 '미동의' 로 그리지 않는다 (규칙1, 2026-07-31).
         *
         * 예전엔 서버가 `Boolean(profile?.agree_email)` 로 넘겨서 **실패와
         * 미동의가 같은 false** 였다. 그러면 지금도 광고 메일을 받는 사람에게
         * "현재 미동의" 가 뜬다 — 수신거부하러 온 사람이 **이미 꺼져 있다고
         * 믿고 나간다.** 메일은 계속 가고 본인은 껐다고 알고 있는 상태가 되어,
         * 정보통신망법 §50 신고로 이어지는 모양이다. 그래서 안내를 띄운다.
         */
        (consentInitial === null ? (
          <div className="px-5 pt-6">
            <div className="bg-bg-3 rounded border border-rule p-5">
              <p className="text-[13.5px] font-black text-text">
                수신 설정을 불러오지 못했어요
              </p>
              <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                지금 상태를 알 수 없어서 화면을 그리지 않았어요 — 잘못
                보여드리면 이미 껐다고 오해하실 수 있어서예요. 잠시 뒤 다시
                열어봐 주세요. 급하시면 story@farmerstail.kr 로 알려주시면
                저희가 바로 꺼드릴게요.
              </p>
            </div>
          </div>
        ) : (
          <ConsentSettingsClient initial={consentInitial} embedded />
        ))}
    </div>
  )
}
