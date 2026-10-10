'use client'

/**
 * 알림 통합 — 받은 알림 · 알림 설정 · 광고 수신을 한 페이지 탭으로(사장님 2026-07-16).
 *
 * 세 개였던 마이페이지 메뉴(받은 알림 / 알림 받기·화면테마 / 광고 수신 설정)를 하나로.
 * 화면 테마 토글은 삭제. 기존 세 클라이언트를 embedded 로 재사용(자체 헤더 숨김) —
 * 로직(읽음처리·푸시구독·동의철회)은 그대로 살아 있다. 탭 전환만 여기서 담당.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 M11~M14·I08·I13): 화면 안의 '알림' 머리말·큰 제목을 뺐다 — 윗줄이
 *   화면 이름을 말한다. 탭은 윗줄 바로 아래 붙는 52px 줄(강아지 위 탭과 같은 모양 — 켜진 칸 800 + 아래 4px 먹선).
 */

import { useState } from 'react'
import { V3, V3Radius } from '@/lib/design/tokens'
import { MeCss, SCREEN_ROOT } from '@/components/v3/me/MeParts'
import { BellIcon } from '@/components/v3/me/MeIcons'
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
  nativeDevices,
  vapidPublicKey,
  consentInitial,
  initialTab,
  previewSettings,
}: {
  inboxRows: Row[]
  pushSubs: SettingsProps['initialSubs']
  /** 앱(네이티브) 기기 — null = 조회 실패(빈 목록으로 그리지 않는다). */
  nativeDevices: SettingsProps['initialNativeDevices']
  vapidPublicKey: SettingsProps['vapidPublicKey']
  /** null = 동의 현황 조회 실패. '미동의' 로 그리면 안 된다 — 아래 렌더 주석 참고. */
  consentInitial: ConsentProps['initial'] | null
  initialTab?: string
  /** 점검 화면(/design-check/me) 전용 — 알림 설정 탭의 기기 상태를 정해 둔다. 실제 화면은 넘기지 않는다. */
  previewSettings?: SettingsProps['previewStatus']
}) {
  const [tab, setTab] = useState(
    TABS.some((t) => t.key === initialTab) ? (initialTab as string) : 'inbox',
  )

  return (
    <div style={SCREEN_ROOT}>
      <MeCss />
      <nav
        role="tablist"
        aria-label="알림 화면"
        className="sticky z-30"
        style={{
          top: 'calc(var(--ft-header-h, 64px) + env(safe-area-inset-top))',
          background: '#FFFFFF',
          borderBottom: `1.5px solid ${V3.ink}`,
        }}
      >
        <div style={{ height: 52, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {TABS.map((t) => {
            const active = t.key === tab
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className="ft-no-press"
                style={{
                  boxSizing: 'border-box',
                  // 켜진 칸의 4px 먹선은 줄의 1.5px 먹선 위에 겹친다(시안: margin-bottom −1.5).
                  marginBottom: active ? -1.5 : 0,
                  border: 0,
                  borderBottom: active ? `4px solid ${V3.ink}` : 0,
                  background: 'transparent',
                  fontFamily: 'inherit',
                  fontSize: 17,
                  fontWeight: active ? 800 : 600,
                  color: active ? V3.ink : V3.inkMute,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>

      {tab === 'inbox' && <NotificationsClient initialRows={inboxRows} embedded />}
      {tab === 'push' && (
        <NotificationSettingsClient
          initialSubs={pushSubs}
          initialNativeDevices={nativeDevices}
          vapidPublicKey={vapidPublicKey}
          embedded
          previewStatus={previewSettings}
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
          <section
            aria-label="수신 설정 불러오기 실패"
            style={{
              margin: '24px 20px 0',
              padding: '22px 18px 20px',
              borderRadius: V3Radius.sm,
              background: V3.soft,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 6,
            }}
          >
            <BellIcon size={30} color={V3.inkMute} strokeWidth={1.8} />
            <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, lineHeight: 1.4 }}>수신 설정을 불러오지 못했어요</p>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
              지금 상태를 알 수 없어서 화면을 그리지 않았어요 — 잘못 보여드리면 이미 껐다고 오해하실 수 있어서예요. 잠시
              뒤 다시 열어봐 주세요. 급하시면 story@farmerstail.kr 로 알려주시면 저희가 바로 꺼드릴게요.
            </p>
          </section>
        ) : (
          <ConsentSettingsClient initial={consentInitial} embedded />
        ))}
    </div>
  )
}
