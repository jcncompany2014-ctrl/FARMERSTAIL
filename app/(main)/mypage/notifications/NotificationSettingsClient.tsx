'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  BellOff,
  Check,
  Loader2,
  Smartphone,
  AlertCircle,
  Send,
} from 'lucide-react'
import PreferencesPanel from './PreferencesPanel'

type SubRow = {
  id: string
  endpoint: string
  user_agent: string | null
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
  vapidPublicKey,
}: {
  initialSubs: SubRow[]
  vapidPublicKey: string | null
}) {
  const [status, setStatus] = useState<Status>('unknown')
  const [subs, setSubs] = useState<SubRow[]>(initialSubs)
  const [msg, setMsg] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
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
  }, [])

  async function enable() {
    setMsg(null)
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
      setMsg(err instanceof Error ? err.message : '구독 중 오류가 발생했어요')
      setStatus('off')
    }
  }

  async function disable() {
    setMsg(null)
    setStatus('unsubscribing')
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
      setMsg(err instanceof Error ? err.message : '구독 해제 중 오류가 발생했어요')
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

  return (
    <main className="pb-10">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 마이페이지
        </Link>
        <span className="kicker mt-3 inline-block">Notifications · 알림 설정</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          알림 설정
        </h1>
        <p className="text-[11px] text-muted mt-1 leading-relaxed">
          배송 변경, 결제 완료, 리마인더를 알림으로 받을 수 있어요
        </p>
      </section>

      {/* 메인 토글 */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-rule p-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isOn ? 'bg-terracotta/10' : 'bg-bg'
              }`}
            >
              {isOn ? (
                <Bell className="w-5 h-5 text-terracotta" strokeWidth={2} />
              ) : (
                <BellOff className="w-5 h-5 text-muted" strokeWidth={2} />
              )}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-black text-text">
                {isOn ? '알림이 켜져 있어요' : '알림이 꺼져 있어요'}
              </div>
              <div className="text-[10px] text-muted mt-0.5">
                이 기기에서의 알림 상태예요
              </div>
            </div>
          </div>

          {status === 'unsupported' && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-sale bg-sale/5 rounded-lg px-3 py-2">
              <AlertCircle
                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <span>
                이 브라우저는 웹 알림을 지원하지 않아요. 홈 화면에 추가하거나
                Chrome·Safari 최신 버전을 사용해 주세요.
              </span>
            </div>
          )}
          {status === 'blocked' && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-sale bg-sale/5 rounded-lg px-3 py-2">
              <AlertCircle
                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <span>
                알림이 차단되어 있어요. 브라우저 설정에서 파머스테일의 알림을
                허용해 주세요.
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            {isOn ? (
              <button
                onClick={disable}
                disabled={
                  status === 'unsubscribing' || status === 'subscribing'
                }
                className="py-3 rounded-xl bg-white border border-rule text-text text-[12px] font-bold hover:border-text transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {status === 'unsubscribing' ? (
                  <>
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      strokeWidth={2}
                    />
                    처리 중...
                  </>
                ) : (
                  <>
                    <BellOff className="w-3.5 h-3.5" strokeWidth={2} />
                    알림 끄기
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={enable}
                disabled={
                  status === 'subscribing' ||
                  status === 'unsupported' ||
                  status === 'blocked'
                }
                className="col-span-2 py-3 rounded-full text-[12px] font-bold active:scale-[0.98] transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                {status === 'subscribing' ? (
                  <>
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      strokeWidth={2}
                    />
                    처리 중...
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" strokeWidth={2} />
                    알림 켜기
                  </>
                )}
              </button>
            )}
            {isOn && (
              <button
                onClick={sendTest}
                disabled={testing}
                className="py-3 rounded-xl bg-text text-white text-[12px] font-bold active:scale-[0.98] transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {testing ? (
                  <>
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      strokeWidth={2}
                    />
                    전송 중...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" strokeWidth={2} />
                    테스트 알림
                  </>
                )}
              </button>
            )}
          </div>

          {msg && (
            <p className="mt-3 text-[11px] font-bold text-moss inline-flex items-center gap-1">
              <Check className="w-3 h-3" strokeWidth={2.5} />
              {msg}
            </p>
          )}
        </div>
      </section>

      {/* 카테고리·조용한 시간 선호 */}
      <section className="px-5 mt-3">
        <PreferencesPanel />
      </section>

      {/* 등록된 기기 */}
      <section className="px-5 mt-3">
        <div className="mb-2">
          <span className="kicker kicker-muted">Devices · 등록된 기기</span>
        </div>
        {subs.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-rule-2 p-6 text-center">
            <p className="text-[11px] text-muted">
              아직 등록된 기기가 없어요.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {subs.map((s) => {
              const isCurrent = currentEndpoint === s.endpoint
              return (
                <li
                  key={s.id}
                  className="bg-white rounded-xl border border-rule px-4 py-3 flex items-start gap-3"
                >
                  <Smartphone
                    className="w-4 h-4 text-muted shrink-0 mt-0.5"
                    strokeWidth={2}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] font-bold text-text truncate">
                        {prettyUA(s.user_agent)}
                      </p>
                      {isCurrent && (
                        <span className="shrink-0 inline-block px-1.5 py-0.5 rounded-full bg-moss text-white text-[8px] font-black tracking-wider">
                          이 기기
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted mt-0.5">
                      {new Date(s.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
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
