'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Package,
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react'
import type { TrackingResult } from '@/lib/tracking'

type Props = {
  carrier: string | null
  carrierLabel: string | null
  trackingNumber: string | null
  orderStatus: string
  shippedAt: string | null
  deliveredAt: string | null
  recipientName: string
  trackerDeepLink: string | null
  supportsInline: boolean
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: TrackingResult }
  | { status: 'error'; message: string; code?: string }

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STEPS: Array<{
  key: TrackingResult['state'] | 'shipped'
  label: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}> = [
  { key: 'information_received', label: '접수', Icon: Package },
  { key: 'at_pickup', label: '인수', Icon: Package },
  { key: 'in_transit', label: '이동', Icon: Truck },
  { key: 'out_for_delivery', label: '배송 출발', Icon: MapPin },
  { key: 'delivered', label: '완료', Icon: CheckCircle2 },
]

const STATE_INDEX: Record<TrackingResult['state'], number> = {
  information_received: 0,
  at_pickup: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
  unknown: -1,
}

export default function TrackingView({
  carrier,
  carrierLabel,
  trackingNumber,
  orderStatus,
  shippedAt,
  deliveredAt,
  recipientName,
  trackerDeepLink,
  supportsInline,
}: Props) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)

  const reload = useCallback(async () => {
    if (!carrier || !trackingNumber || !supportsInline) return
    setFetchState({ status: 'loading' })
    try {
      const res = await fetch(
        `/api/tracking?carrier=${encodeURIComponent(carrier)}&trackingNumber=${encodeURIComponent(trackingNumber)}`,
        { cache: 'no-store' }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setFetchState({
          status: 'error',
          message: data?.message ?? '택배 정보를 불러오지 못했어요',
          code: data?.code,
        })
        return
      }
      setFetchState({ status: 'ok', data: data as TrackingResult })
    } catch {
      setFetchState({
        status: 'error',
        message: '네트워크 오류가 발생했어요',
      })
    }
  }, [carrier, trackingNumber, supportsInline])

  useEffect(() => {
    // Defer to a microtask so the loading-state transition isn't a
    // synchronous setState in the effect body (react-hooks/set-state-in-effect).
    if (supportsInline && carrier && trackingNumber) {
      queueMicrotask(reload)
    }
  }, [supportsInline, carrier, trackingNumber, reload])

  async function copyTracking() {
    if (!trackingNumber) return
    try {
      await navigator.clipboard.writeText(trackingNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore — fallback is native selection */
    }
  }

  // 아직 송장이 안 들어온 경우
  if (!trackingNumber || !carrier) {
    return (
      <section className="px-5 mt-6">
        <div className="bg-white rounded-2xl border border-rule px-5 py-10 text-center">
          <Clock
            className="w-8 h-8 text-muted mx-auto mb-3"
            strokeWidth={1.5}
          />
          <p className="text-[13px] font-bold text-text">
            아직 송장번호가 등록되지 않았어요
          </p>
          <p className="text-[11px] text-muted mt-2 leading-relaxed">
            발송이 시작되면 푸시 알림과 주문 상세에서 운송장을 확인할 수
            있어요.
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* 송장 요약 카드 */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-rule px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.2em]">
                Carrier
              </div>
              <div className="text-[15px] font-black text-text mt-0.5">
                {carrierLabel ?? '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.2em]">
                Recipient
              </div>
              <div className="text-[13px] font-bold text-text mt-0.5">
                {recipientName}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-bg rounded-lg px-3 py-2.5">
              <div className="text-[9px] font-semibold text-muted uppercase tracking-[0.15em]">
                Tracking Number
              </div>
              <div className="font-mono text-[13px] text-text mt-0.5 break-all">
                {trackingNumber}
              </div>
            </div>
            <button
              onClick={copyTracking}
              aria-label="송장번호 복사"
              className="shrink-0 w-11 h-11 rounded-lg bg-text text-white flex items-center justify-center hover:bg-ink transition active:scale-95"
            >
              {copied ? (
                <Check className="w-4 h-4" strokeWidth={2.5} />
              ) : (
                <Copy className="w-4 h-4" strokeWidth={2} />
              )}
            </button>
          </div>

          {/* 주문 상태 기반 타임스탬프 */}
          <dl className="mt-4 space-y-1.5 text-[11px]">
            {shippedAt && (
              <div className="flex justify-between">
                <dt className="text-muted">발송 일시</dt>
                <dd className="text-text font-semibold">
                  {formatTime(shippedAt)}
                </dd>
              </div>
            )}
            {deliveredAt && (
              <div className="flex justify-between">
                <dt className="text-muted">도착 일시</dt>
                <dd className="text-moss font-black">
                  {formatTime(deliveredAt)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* 진행 단계 프로그레스 (inline API 성공 시) */}
      {fetchState.status === 'ok' && (
        <section className="px-5 mt-3">
          <div className="bg-white rounded-2xl border border-rule px-5 py-5">
            <h2 className="text-[13px] font-black text-text mb-4">
              진행 상태
            </h2>
            <ProgressBar state={fetchState.data.state} />
          </div>
        </section>
      )}

      {/* 이벤트 타임라인 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-2xl border border-rule px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-black text-text">
              배송 이력
            </h2>
            {supportsInline && (
              <button
                onClick={reload}
                disabled={fetchState.status === 'loading'}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta hover:brightness-90 disabled:opacity-50 transition"
              >
                <RefreshCw
                  className={`w-3 h-3 ${
                    fetchState.status === 'loading' ? 'animate-spin' : ''
                  }`}
                  strokeWidth={2.25}
                />
                새로고침
              </button>
            )}
          </div>

          {!supportsInline ? (
            <div className="py-6 text-center">
              <p className="text-[12px] text-muted">
                이 택배사는 사이트에서 직접 조회해 주세요.
              </p>
            </div>
          ) : fetchState.status === 'loading' ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fetchState.status === 'error' ? (
            <div className="py-6 text-center">
              <AlertCircle
                className="w-5 h-5 text-sale mx-auto mb-2"
                strokeWidth={1.75}
              />
              <p className="text-[12px] text-sale font-bold">
                {fetchState.message}
              </p>
              {fetchState.code === 'TRACKING_NOT_FOUND' && orderStatus !== 'delivered' && (
                <p className="text-[11px] text-muted mt-2">
                  발송 직후에는 조회가 지연될 수 있어요. 잠시 후 다시 시도해
                  주세요.
                </p>
              )}
            </div>
          ) : fetchState.status === 'ok' ? (
            fetchState.data.events.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-muted">
                아직 등록된 이벤트가 없어요
              </p>
            ) : (
              <ol className="relative pl-5">
                {/* 수직 축 */}
                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-rule" />
                {fetchState.data.events.map((ev, idx) => (
                  <li key={`${ev.time}-${idx}`} className="relative pb-4 last:pb-0">
                    <span
                      className={`absolute -left-[15px] top-1 w-3 h-3 rounded-full border-2 ${
                        idx === 0
                          ? 'bg-terracotta border-terracotta'
                          : 'bg-white border-rule'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-[12px] ${
                          idx === 0
                            ? 'font-black text-text'
                            : 'font-semibold text-text'
                        }`}
                      >
                        {ev.description || ev.status || '상태 업데이트'}
                      </p>
                      <time className="text-[10px] text-muted whitespace-nowrap">
                        {formatTime(ev.time)}
                      </time>
                    </div>
                    {ev.location && (
                      <p className="text-[11px] text-muted mt-0.5">
                        {ev.location}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )
          ) : null}
        </div>
      </section>

      {/* 택배사 사이트로 열기 (폴백 + 신뢰성 확보) */}
      {trackerDeepLink && (
        <section className="px-5 mt-3">
          <a
            href={trackerDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-text text-white text-[13px] font-bold hover:bg-ink transition active:scale-[0.98]"
          >
            <ExternalLink className="w-4 h-4" strokeWidth={2.25} />
            {carrierLabel} 사이트에서 조회
          </a>
          <p className="mt-2 text-[10px] text-muted text-center">
            택배사 원본 조회 페이지로 이동해요.
          </p>
        </section>
      )}
    </>
  )
}

function ProgressBar({ state }: { state: TrackingResult['state'] }) {
  const currentIdx = STATE_INDEX[state] ?? -1
  return (
    <div className="relative flex items-center justify-between">
      <div className="absolute top-3 left-3 right-3 h-0.5 bg-rule" />
      <div
        className="absolute top-3 left-3 h-0.5 bg-terracotta transition-all"
        style={{
          width:
            currentIdx >= 0
              ? `${(currentIdx / (STEPS.length - 1)) * 100}%`
              : '0%',
        }}
      />
      {STEPS.map((s, idx) => {
        const active = idx <= currentIdx
        return (
          <div
            key={s.key}
            className="relative flex flex-col items-center z-10 flex-1"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                active
                  ? 'bg-terracotta text-white'
                  : 'bg-rule text-muted'
              }`}
            >
              <s.Icon className="w-3 h-3" strokeWidth={2.5} />
            </div>
            <span
              className={`mt-1.5 text-[9px] font-bold ${
                active ? 'text-text' : 'text-muted'
              }`}
            >
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
