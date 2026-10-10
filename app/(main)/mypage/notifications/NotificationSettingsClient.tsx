'use client'

/**
 * 알림 설정 — 이 기기의 푸시 켜기/끄기 + 알림 종류·방해 금지 시간(PreferencesPanel) + 등록된 기기.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 M12 · I08):
 *   · 이 기기 상태 = 회색 면 + 왼쪽 6px 머스타드 띠 · 먹색 동그라미 종 · "알림이 켜져 있어요" 19 굵게 ·
 *     두 칸 단추(알림 끄기 = 흰 바탕 먹선 · 테스트 알림 = 먹색). 꺼져 있으면 '알림 켜기' 한 칸.
 *   · '기기' 목록에 **앱(네이티브) 기기**도 넣었다(앱시안 결정). 예전엔 웹 푸시(push_subscriptions)만 세서,
 *     앱스토어로 설치한 사람은 알림이 켜져 있어도 "아직 등록된 기기가 없어요"가 떴다. page.tsx 가
 *     native_push_tokens 를 **읽기만** 해서 넘긴다. 켜기·끄기·테스트 발송 로직은 그대로다 — 화면 목록만
 *     켜고 끈 결과를 따라간다(웹 줄을 이미 그렇게 하고 있었다).
 *   · 알림 종류·방해 금지 시간을 못 불러오면(시안 I08) 이 탭엔 실패 카드만 남긴다 — "켜고 끄는 칸을 잠시
 *     숨겼어요. 새로고침해 주세요."(앱시안 결정 문구)와 화면이 같은 말을 하게.
 */

import { useEffect, useState } from 'react'
import { userFacingError } from '@/lib/error-message'
import { Loader2 } from 'lucide-react'
import PreferencesPanel from './PreferencesPanel'
import {
  isNativeApp,
  registerAndSyncNativePush,
  markPushOptOut,
  clearPushOptOut,
  getDeviceId,
  getPlatform,
} from '@/lib/capacitor'
import { formatKstLongDate } from '@/lib/datetime-kst'
import { V3, V3Radius } from '@/lib/design/tokens'
import { Chip, RuleList, SectionTitle, outlineButton, primaryButton } from '@/components/v3/me/MeParts'
import { BellIcon, BellOffIcon, CheckIcon, DeviceIcon, SendIcon, WarnIcon } from '@/components/v3/me/MeIcons'

type SubRow = {
  id: string
  endpoint: string
  user_agent: string | null
  created_at: string
}

/** 앱(네이티브) 기기 — native_push_tokens 의 화면용 칸(토큰 값은 고르지 않는다). */
type NativeDeviceRow = {
  id: string
  platform: string
  device_id: string | null
  created_at: string
}

/** base64url → Uint8Array (with explicit ArrayBuffer backing so it satisfies BufferSource). */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buffer = new ArrayBuffer(raw.length)
  const buf = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; ++i) buf[i] = raw.charCodeAt(i)
  return buf
}

type Status =
  | 'unknown'
  | 'unsupported'
  | 'blocked'
  | 'off'
  | 'on'
  | 'subscribing'
  | 'unsubscribing'

export default function NotificationSettingsClient({
  initialSubs,
  initialNativeDevices = [],
  vapidPublicKey,
  embedded,
  previewStatus,
}: {
  initialSubs: SubRow[]
  /** 앱(네이티브) 기기. null = 조회 실패 — "등록된 기기가 없어요"로 그리지 않는다(규칙1). */
  initialNativeDevices?: NativeDeviceRow[] | null
  vapidPublicKey: string | null
  /** 통합 알림 페이지 탭 안에서 렌더될 때 true — 자체 헤더 숨김. */
  embedded?: boolean
  /** 점검 화면(/design-check/me) 전용 — 기기 상태 감지 대신 이 값으로 그린다. 실제 화면은 넘기지 않는다. */
  previewStatus?: Status
}) {
  const [status, setStatus] = useState<Status>(previewStatus ?? 'unknown')
  const [subs, setSubs] = useState<SubRow[]>(initialSubs)
  const [nativeDevices, setNativeDevices] = useState<NativeDeviceRow[] | null>(initialNativeDevices)
  const [msg, setMsg] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)
  // 이 앱 기기의 device_id — 목록에서 '이 기기' 표를 붙이는 데만 쓴다.
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null)
  // 알림 종류·방해 금지 시간을 못 불러왔나 — 시안 I08: 그땐 이 탭의 켜고 끄는 칸을 전부 숨기고 실패 카드만 둔다.
  const [prefsFailed, setPrefsFailed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (previewStatus) return // 점검 화면 — 실제 기기 감지를 하지 않는다.
    // ★네이티브(Capacitor) 분기가 초기 감지에 없었다 (2026-08-08 네이티브 감사).
    //   WKWebView 엔 PushManager 가 없어 아래 검사가 'unsupported' 로 굳고,
    //   그러면 켜기 버튼이 disabled 라 enable() 의 네이티브 분기에 **영원히
    //   도달하지 못했다** — 앱스토어 설치 사용자는 알림을 켤 방법이 없었다.
    if (isNativeApp()) {
      ;(async () => {
        try {
          const { PushNotifications } = await import(
            '@capacitor/push-notifications'
          )
          const perm = await PushNotifications.checkPermissions()
          if (perm.receive === 'denied') {
            setStatus('blocked')
            return
          }
          if (perm.receive !== 'granted') {
            setStatus('off')
            return
          }
          // ★OS 권한만으로 ON 을 그리면 거짓말이 된다 (2026-08-08 재검증 2차 #2).
          //  끄기(토큰 DELETE)·로그아웃(cleanupPushOnLogout) 뒤에도 권한은
          //  granted 로 남는다 — 화면은 ON 인데 발송은 0. 웹이 실구독
          //  (getSubscription)으로 판정하듯, 서버 토큰 행 존재까지 확인한다.
          const deviceId = await getDeviceId()
          if (!deviceId) {
            setStatus('off')
            return
          }
          setCurrentDeviceId(deviceId)
          const res = await fetch(
            `/api/push/native-register?deviceId=${encodeURIComponent(deviceId)}`,
          )
          const body = (await res.json().catch(() => ({}))) as {
            registered?: boolean
          }
          setStatus(res.ok && body.registered ? 'on' : 'off')
        } catch {
          // 판정 실패 — 켜기 버튼은 살려 둔다(enable 이 다시 시도).
          setStatus('off')
        }
      })()
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('blocked')
      return
    }
    ;(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        setStatus('off')
        return
      }
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        setCurrentEndpoint(existing.endpoint)
        setStatus('on')
      } else {
        setStatus('off')
      }
    })()
  }, [previewStatus])

  async function enable() {
    setMsg(null)

    // 네이티브 앱 (Capacitor) — Web Push 가 아닌 APNs/FCM 토큰 등록.
    // Web Push 가 native WebView 에서 안 도는 경우가 많아 분기.
    if (isNativeApp()) {
      setStatus('subscribing')
      try {
        const ok = await registerAndSyncNativePush()
        if (!ok) {
          setMsg('알림 권한을 허용한 뒤 다시 시도해 주세요')
          setStatus('off')
          return
        }
        // 직접 켰다 — 홈 진입 자동 등록(autoRegisterNativePush)이 다시 돌게 플래그를 지운다.
        void clearPushOptOut()
        setStatus('on')
        setMsg('네이티브 앱 알림이 활성화됐어요')
        // 화면 목록만 따라간다(등록은 위에서 끝났다) — 이 기기 줄이 없으면 맨 위에 하나 그린다.
        void showThisNativeDevice()
        return
      } catch (e) {
        setMsg(userFacingError(e, '알림 등록 실패'))
        setStatus('off')
        return
      }
    }

    if (!vapidPublicKey) {
      setMsg('서버 설정이 완료되지 않았어요')
      return
    }
    setStatus('subscribing')
    try {
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js')
        // Wait for it to be active-ish.
        await navigator.serviceWorker.ready
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'off')
        setMsg('알림 권한이 허용되지 않았어요')
        return
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const json = subscription.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data?.message ?? '구독 저장 실패')
        setStatus('off')
        return
      }
      setCurrentEndpoint(subscription.endpoint)
      setSubs((prev) => {
        // Replace existing row with same endpoint if present, else prepend a stub
        const filtered = prev.filter((s) => s.endpoint !== subscription.endpoint)
        return [
          {
            id: crypto.randomUUID(),
            endpoint: subscription.endpoint,
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString(),
          },
          ...filtered,
        ]
      })
      setStatus('on')
      setMsg('알림을 켰어요')
    } catch (err) {
      setMsg(userFacingError(err, '알림 켜는 데 실패했어요. 잠시 후 다시 시도해 주세요'))
      setStatus('off')
    }
  }

  async function disable() {
    setMsg(null)
    setStatus('unsubscribing')
    // 네이티브 — Web Push 구독이 아니라 서버의 APNs/FCM 토큰 row 를 지운다.
    // 안 지우면 OFF 로 보이는데 푸시는 계속 온다(2026-08-08 네이티브 감사).
    if (isNativeApp()) {
      try {
        const deviceId = await getDeviceId()
        if (deviceId) {
          const res = await fetch(
            `/api/push/native-register?deviceId=${encodeURIComponent(deviceId)}`,
            { method: 'DELETE' },
          )
          if (!res.ok) throw new Error('푸시 해제에 실패했어요')
          // 화면 목록만 따라간다 — 지운 이 기기 줄을 뺀다.
          setNativeDevices((prev) => (prev ? prev.filter((d) => d.device_id !== deviceId) : prev))
        }
        // ★직접 껐다는 표시. 이게 없으면 다음 홈 진입에서 자동 등록이 토큰을
        //   다시 만들어 "껐는데 계속 온다"가 된다(2026-09-15 자동 등록 도입).
        void markPushOptOut()
        setStatus('off')
        setMsg('알림을 껐어요')
      } catch (err) {
        setMsg(userFacingError(err, '알림 끄는 데 실패했어요. 잠시 후 다시 시도해 주세요'))
        setStatus('on') // 실제로는 아직 켜져 있다 — 버튼이 '처리 중'에 갇히지 않게
      }
      return
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const existing = await reg?.pushManager.getSubscription()
      if (existing) {
        const endpoint = existing.endpoint
        await existing.unsubscribe()
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
        setSubs((prev) => prev.filter((s) => s.endpoint !== endpoint))
      }
      setCurrentEndpoint(null)
      setStatus('off')
      setMsg('알림을 껐어요')
    } catch (err) {
      setMsg(userFacingError(err, '알림 끄는 데 실패했어요. 잠시 후 다시 시도해 주세요'))
      setStatus('on') // 'unsubscribing' 에 갇히면 두 버튼 다 disabled 로 굳는다
    }
  }

  /** 앱에서 켠 뒤 '기기' 목록에 이 기기를 그린다(표시만 — 저장은 registerAndSyncNativePush 가 이미 했다). */
  async function showThisNativeDevice() {
    try {
      const deviceId = await getDeviceId()
      if (!deviceId) return
      setCurrentDeviceId(deviceId)
      const platform = getPlatform()
      setNativeDevices((prev) => {
        const list = prev ?? []
        if (list.some((d) => d.device_id === deviceId)) return list
        return [
          { id: `native-${deviceId}`, platform, device_id: deviceId, created_at: new Date().toISOString() },
          ...list,
        ]
      })
    } catch {
      /* 표시만 못 할 뿐 — 알림은 이미 켜졌다 */
    }
  }

  async function sendTest() {
    setTesting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data?.message ?? '전송 실패')
        return
      }
      setMsg(`테스트 알림을 ${data.sent}개 기기로 전송했어요`)
    } catch {
      setMsg('전송 실패')
    } finally {
      setTesting(false)
    }
  }

  // Use a plain boolean so TS doesn't narrow `status` to just 'on' in the JSX below.
  const isOn: boolean = status === 'on'

  // '기기' 목록 — 앱(네이티브) 기기 먼저, 그다음 웹 푸시 구독.
  const devices: Array<{ key: string; name: string; date: string; current: boolean }> = [
    ...(nativeDevices ?? []).map((d) => ({
      key: `n-${d.id}`,
      name: `${d.platform === 'ios' ? 'iPhone' : 'Android'} · 앱`,
      date: d.created_at,
      current: !!currentDeviceId && d.device_id === currentDeviceId,
    })),
    ...subs.map((s) => ({
      key: `w-${s.id}`,
      name: prettyUA(s.user_agent),
      date: s.created_at,
      current: currentEndpoint === s.endpoint,
    })),
  ]

  return (
    <div>
      {!embedded && (
        <p style={{ margin: '20px 20px 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
          배송 변경, 결제 완료, 리마인더를 알림으로 받을 수 있어요
        </p>
      )}

      {/* 이 기기 알림 — 설정을 못 불러오면(I08) 숨긴다. */}
      {!prefsFailed && (
      <section
        aria-label="이 기기 알림"
        style={{
          margin: '20px 20px 0',
          padding: 18,
          borderRadius: V3Radius.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: V3.soft,
          borderLeft: `6px solid ${V3.mustard}`,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', columnGap: 14, alignItems: 'center' }}>
          <span
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: isOn ? V3.ink : '#FFFFFF',
              color: isOn ? '#FFFFFF' : V3.inkMute,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isOn ? <BellIcon size={24} /> : <BellOffIcon size={24} />}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 19, fontWeight: 800 }}>{isOn ? '알림이 켜져 있어요' : '알림이 꺼져 있어요'}</span>
            <span style={{ fontSize: 15, color: V3.inkMute }}>이 기기에서의 알림 상태예요</span>
          </span>
        </div>

        {(status === 'unsupported' || status === 'blocked') && (
          <p style={{ margin: 0, display: 'flex', gap: 8, fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: V3.sale }}>
            <WarnIcon size={18} strokeWidth={2.2} style={{ marginTop: 2 }} />
            <span>
              {status === 'unsupported'
                ? '이 브라우저는 웹 알림을 지원하지 않아요. 홈 화면에 추가하거나 Chrome·Safari 최신 버전을 사용해 주세요.'
                : isNativeApp()
                  ? '알림이 꺼져 있어요. 휴대폰 설정 > 파머스테일 > 알림에서 허용해 주세요.'
                  : '알림이 차단되어 있어요. 브라우저 설정에서 파머스테일의 알림을 허용해 주세요.'}
            </span>
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {isOn ? (
            <button
              type="button"
              onClick={disable}
              disabled={status === 'unsubscribing' || status === 'subscribing'}
              style={{ ...outlineButton(54, 16), gap: 6 }}
            >
              {status === 'unsubscribing' ? (
                <>
                  <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} strokeWidth={2} />
                  처리 중...
                </>
              ) : (
                <>
                  <BellOffIcon size={18} />
                  알림 끄기
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={enable}
              disabled={
                status === 'subscribing' ||
                status === 'unsupported' ||
                status === 'blocked'
              }
              style={{
                ...primaryButton(54, 16),
                gap: 6,
                gridColumn: '1 / -1',
                opacity: status === 'unsupported' || status === 'blocked' ? 0.45 : 1,
              }}
            >
              {status === 'subscribing' ? (
                <>
                  <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} strokeWidth={2} />
                  처리 중...
                </>
              ) : (
                <>
                  <BellIcon size={18} />
                  알림 켜기
                </>
              )}
            </button>
          )}
          {isOn && (
            <button
              type="button"
              onClick={sendTest}
              disabled={testing}
              style={{ ...primaryButton(54, 16), gap: 6, opacity: testing ? 0.6 : 1 }}
            >
              {testing ? (
                <>
                  <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} strokeWidth={2} />
                  전송 중...
                </>
              ) : (
                <>
                  <SendIcon size={18} />
                  테스트 알림
                </>
              )}
            </button>
          )}
        </div>

        {msg &&
          (() => {
            // 실패 메시지를 초록 체크(성공 스타일)로 보여주던 버그 방지(2026-07-17).
            // 실패면 빨강 + 체크 숨김 + role=alert(SR 즉시 안내).
            const isError = /(실패|않았|않아|않은|완료되지|다시 시도|오류)/.test(
              msg,
            )
            return (
              <p
                role={isError ? 'alert' : 'status'}
                aria-live={isError ? 'assertive' : 'polite'}
                style={{
                  margin: 0,
                  display: 'flex',
                  gap: 6,
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  color: isError ? V3.sale : V3.ink,
                }}
              >
                {!isError && <CheckIcon size={18} strokeWidth={2.6} style={{ marginTop: 2 }} />}
                <span>{msg}</span>
              </p>
            )
          })()}
      </section>
      )}

      {/* 카테고리·조용한 시간 선호 — 불러오기 실패면 실패 카드(I08)를 그린다. 자리를 고정해 상태가 유지된다. */}
      <PreferencesPanel onLoadFailed={() => setPrefsFailed(true)} />

      {/* 화면 테마(다크모드) 토글은 사장님 2026-07-16 지시로 삭제. */}

      {/* 등록된 기기 — 앱(네이티브) + 웹 푸시. 설정을 못 불러오면(I08) 숨긴다. */}
      {!prefsFailed && (
      <section aria-labelledby="nt-device" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle id="nt-device">기기</SectionTitle>
        {devices.length === 0 ? (
          <p
            style={{
              margin: '12px 0 0',
              padding: '22px 16px',
              borderRadius: V3Radius.sm,
              border: '1.5px dashed #BDBDBD',
              textAlign: 'center',
              fontSize: 15,
              lineHeight: 1.5,
              color: V3.inkMute,
            }}
          >
            {nativeDevices === null
              ? '앱 기기 목록을 불러오지 못했어요. 새로고침해 주세요.'
              : '아직 등록된 기기가 없어요.'}
          </p>
        ) : (
          <RuleList style={{ marginTop: 12 }}>
            {devices.map((d) => (
              <div
                key={d.key}
                style={{
                  padding: '14px 0',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr',
                  columnGap: 12,
                  alignItems: 'center',
                }}
              >
                <DeviceIcon size={22} color={V3.ink} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.name}
                    </span>
                    {d.current && (
                      <Chip height={24} fontSize={12}>
                        이 기기
                      </Chip>
                    )}
                  </span>
                  <span style={{ fontSize: 15, color: V3.inkMute }}>{formatKstLongDate(d.date)}</span>
                </span>
              </div>
            ))}
            {nativeDevices === null && (
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: V3.inkMute }}>
                앱 기기 목록을 불러오지 못했어요. 새로고침해 주세요.
              </p>
            )}
          </RuleList>
        )}
      </section>
      )}
    </div>
  )
}

/** Condense the User-Agent string into something human-readable. */
function prettyUA(ua: string | null): string {
  if (!ua) return '알 수 없는 기기'
  const s = ua.toLowerCase()
  let device = '기기'
  if (/iphone/.test(s)) device = 'iPhone'
  else if (/ipad/.test(s)) device = 'iPad'
  else if (/android/.test(s)) device = 'Android'
  else if (/macintosh|mac os x/.test(s)) device = 'Mac'
  else if (/windows/.test(s)) device = 'Windows'

  let browser = ''
  if (/edg\//.test(s)) browser = 'Edge'
  else if (/chrome\//.test(s)) browser = 'Chrome'
  else if (/firefox\//.test(s)) browser = 'Firefox'
  else if (/safari\//.test(s)) browser = 'Safari'

  return browser ? `${device} · ${browser}` : device
}
