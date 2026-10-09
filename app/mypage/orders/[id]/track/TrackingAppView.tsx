/**
 * TrackingAppView — 운송장 조회 '앱' 화면(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 M10·I09·I10).
 *
 * 조회·복사·새로고침은 TrackingView 가 그대로 하고(웹과 같은 상태), 앱일 때만 이 컴포넌트가 그린다 — 웹 화면은
 * 예전 그대로. 그림만 맡으므로 핸들러는 전부 필수로 받는다(규칙38 — 없는 핸들러를 꽂은 죽은 버튼 금지).
 *
 * 상태별 모양:
 *   · 조회됨(M10)        — 송장 카드 → 진행 상태 5칸 → 배송 이력 → 택배사 사이트.
 *   · 접수 중(I09)       — 발송 36시간 안 '못 찾음'은 오류가 아니다(11차 점검 B). 회색 안내 카드.
 *   · 조회 실패(I10)      — 회색 카드 + '다시 조회하기'. 다시 해도 안 되는 실패(설정·택배사 미지원)엔 버튼을 안 단다.
 *   · 송장 없음·직접 조회 택배사 — 같은 회색 카드 문법(시안 없음 — 문법을 맞춤).
 */

import type { ReactNode } from 'react'
import type { TrackingResult } from '@/lib/tracking'
import { formatKstShortDateTime } from '@/lib/datetime-kst'
import { V3, V3Shadow } from '@/lib/design/tokens'

export type TrackingFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: TrackingResult }
  /** justShipped = 발송 36시간 안 — 집하 스캔 전이라 '못 찾음'이 정상(오류로 말하지 않는다). 응답 받은 순간에 판정. */
  | { status: 'error'; message: string; code?: string; justShipped?: boolean }

type Props = {
  orderNumber: string
  carrierLabel: string | null
  trackingNumber: string | null
  /** 택배사·송장번호가 둘 다 있을 때만 조회할 게 있다. */
  hasTracking: boolean
  recipientName: string
  orderStatus: string
  shippedAt: string | null
  deliveredAt: string | null
  trackerDeepLink: string | null
  supportsInline: boolean
  fetchState: TrackingFetchState
  copied: boolean
  onCopy: () => void
  onReload: () => void
}

const STEP_LABELS = ['접수', '인수', '이동', '배송 출발', '완료'] as const

const STATE_INDEX: Record<TrackingResult['state'], number> = {
  information_received: 0,
  at_pickup: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
  unknown: -1,
}

// 다시 눌러도 같은 답이 오는 실패 — '다시 조회하기'를 달면 헛버튼이 된다.
const NO_RETRY_CODES = new Set(['LOOKUP_UNAVAILABLE', 'NO_INLINE_LOOKUP', 'UNKNOWN_CARRIER', 'MISSING_PARAMS', 'UNAUTHORIZED'])

const FAIL_TITLE = '택배 정보를 불러오지 못했어요'

const when = (iso: string | null) => (iso ? formatKstShortDateTime(iso) : '—')

/**
 * 문장마다 한 줄(시안 I10: "…같아요." / "다시 시도해 주세요.") — 좁은 폭에서 낱말 중간에 접히지 않게.
 * 뒤돌아보기 정규식(lookbehind)은 쓰지 않는다 — iOS 16.4 미만 WebView 는 그 문법에서 스크립트 전체가 죽는다.
 */
function sentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`))
}

function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={spinning ? 'animate-spin' : undefined}
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
    </svg>
  )
}

const TRUCK_ICON = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={V3.inkMute} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.5 6.5h11v9h-11z" />
    <path d="M13.5 9.5h4l3 3v3h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </svg>
)

const CLOUD_X_ICON = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={V3.inkMute} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z" />
    <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" stroke={V3.sale} />
  </svg>
)

const CLOCK_ICON = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={V3.inkMute} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** 회색 안내 카드(시안 I09·I10) — 아이콘 · 제목 · 문장들 · (있으면) 버튼. */
function NoticeCard({ label, icon, title, lines, action }: { label: string; icon: ReactNode; title: string; lines: string[]; action?: ReactNode }) {
  return (
    <section
      aria-label={label}
      style={{
        margin: '28px 20px 0',
        padding: '22px 18px 20px',
        borderRadius: 4,
        background: V3.soft,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
      }}
    >
      {icon}
      <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, lineHeight: 1.4 }}>{title}</p>
      {lines.length > 0 && (
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
          {lines.map((l, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {l}
            </span>
          ))}
        </p>
      )}
      {action}
    </section>
  )
}

function ProgressSteps({ state }: { state: TrackingResult['state'] }) {
  const cur = STATE_INDEX[state] ?? -1
  return (
    <section aria-labelledby="track-step-title" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <h2 id="track-step-title" style={{ margin: 0, fontSize: 22 }}>
        진행 상태
      </h2>
      <div style={{ marginTop: 12, paddingTop: 18, borderTop: `2px solid ${V3.ink}`, position: 'relative' }}>
        {/* 첫 칸 가운데 ~ 끝 칸 가운데(칸 폭 20% → 양끝 10%). 지나온 구간만 머스타드. */}
        <span aria-hidden style={{ position: 'absolute', left: '10%', right: '10%', top: 31, height: 3, background: V3.rule }} />
        {cur > 0 && (
          <span aria-hidden style={{ position: 'absolute', left: '10%', top: 31, height: 3, width: `${cur * 20}%`, background: V3.mustard }} />
        )}
        <ol style={{ position: 'relative', margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          {STEP_LABELS.map((label, i) => {
            const done = i <= cur
            return (
              <li key={label} aria-current={i === cur ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    boxSizing: 'border-box',
                    borderRadius: 14,
                    background: done ? V3.ink : '#FFFFFF',
                    border: done ? 0 : '2px solid #BDBDBD',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {done && <CheckIcon />}
                </span>
                <span style={{ fontSize: 14, fontWeight: i === cur ? 800 : 700, color: done ? V3.ink : V3.inkMute, textAlign: 'center' }}>{label}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function History({ fetchState, onReload }: { fetchState: TrackingFetchState; onReload: () => void }) {
  const loading = fetchState.status === 'loading' || fetchState.status === 'idle'
  return (
    <section aria-labelledby="track-log-title" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id="track-log-title" style={{ margin: 0, fontSize: 22 }}>
          배송 이력
        </h2>
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          className="active:opacity-80"
          style={{
            height: 44,
            padding: '0 12px',
            borderRadius: 4,
            border: `1.5px solid ${V3.ink}`,
            background: '#FFFFFF',
            color: V3.ink,
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshIcon spinning={loading} />
          새로고침
        </button>
      </div>
      {loading ? (
        <div role="status" aria-label="배송 정보를 불러오는 중" style={{ marginTop: 12, borderTop: `2px solid ${V3.ink}`, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="animate-spin" style={{ width: 24, height: 24, borderRadius: 12, border: `2.5px solid ${V3.ink}`, borderTopColor: 'transparent' }} />
        </div>
      ) : fetchState.status === 'ok' && fetchState.data.events.length > 0 ? (
        <ol style={{ margin: '12px 0 0', padding: '16px 0 0 26px', borderTop: `2px solid ${V3.ink}`, listStyle: 'none', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <span aria-hidden style={{ position: 'absolute', left: 7, top: 24, bottom: 26, width: 2, background: V3.rule }} />
          {fetchState.data.events.map((ev, idx) => {
            const last = idx === fetchState.data.events.length - 1
            const latest = idx === 0
            return (
              <li key={`${ev.time}-${idx}`} style={{ position: 'relative', paddingBottom: last ? 0 : 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: -26,
                    top: 3,
                    width: 16,
                    height: 16,
                    boxSizing: 'border-box',
                    borderRadius: 8,
                    background: latest ? V3.ink : '#FFFFFF',
                    border: latest ? 0 : '2px solid #BDBDBD',
                  }}
                />
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: latest ? 17 : 16, fontWeight: latest ? 800 : 700 }}>{ev.description || ev.status || '상태 업데이트'}</span>
                  <time style={{ fontSize: 14, color: V3.inkMute, whiteSpace: 'nowrap' }}>{formatKstShortDateTime(ev.time)}</time>
                </span>
                {ev.location && <span style={{ fontSize: 15, color: V3.inkMute }}>{ev.location}</span>}
              </li>
            )
          })}
        </ol>
      ) : (
        <p style={{ margin: '12px 0 0', paddingTop: 16, borderTop: `2px solid ${V3.ink}`, fontSize: 16, color: V3.inkMute }}>아직 배송 이력이 없어요.</p>
      )}
    </section>
  )
}

export default function TrackingAppView(p: Props) {
  const orderLine = (
    <p style={{ margin: '18px 20px 0', fontSize: 15, color: V3.inkMute }}>
      주문번호 <strong style={{ fontWeight: 800, color: V3.ink, letterSpacing: '0.01em', wordBreak: 'break-all' }}>{p.orderNumber}</strong>
    </p>
  )

  // 송장이 아직 없다 — 주문 상세는 송장이 있어야 이 화면 링크를 보이지만, 주소로 바로 들어올 수 있다.
  if (!p.hasTracking) {
    return (
      <div style={{ paddingBottom: 32, color: V3.ink, lineHeight: 'normal' }}>
        {orderLine}
        <NoticeCard
          label="송장 대기"
          icon={CLOCK_ICON}
          title="아직 송장번호가 등록되지 않았어요"
          lines={['발송이 시작되면 알림과 주문 상세에서 운송장을 확인할 수 있어요.']}
        />
      </div>
    )
  }

  const fetched = p.fetchState
  const pending =
    fetched.status === 'error' && fetched.code === 'TRACKING_NOT_FOUND' && p.orderStatus !== 'delivered' && !!fetched.justShipped

  let body: ReactNode
  if (!p.supportsInline) {
    body = (
      <NoticeCard
        label="직접 조회"
        icon={TRUCK_ICON}
        title="이 택배사는 사이트에서 직접 조회해 주세요"
        lines={[p.trackerDeepLink ? '아래 버튼을 누르면 택배사 조회 페이지가 열려요.' : '송장번호를 복사해 택배사에 문의해 주세요.']}
      />
    )
  } else if (pending) {
    // ★발송 직후엔 택배사 집하 스캔 전이라 '못 찾음'이 정상이다(11차 점검 B) — 오류로 말하지 않는다.
    body = (
      <NoticeCard
        label="조회 대기"
        icon={TRUCK_ICON}
        title="택배사에 접수되는 중이에요"
        lines={['보통 오늘 밤에서 내일 아침 사이부터 조회돼요.', '그때 다시 확인해 주세요.']}
      />
    )
  } else if (fetched.status === 'error') {
    const msgLines = fetched.message.trim() === FAIL_TITLE ? ['잠시 후 다시 시도해 주세요.'] : sentences(fetched.message)
    if (fetched.code === 'TRACKING_NOT_FOUND' && p.orderStatus !== 'delivered') msgLines.push('발송 직후에는 조회가 늦어질 수 있어요.')
    body = (
      <NoticeCard
        label="조회 실패"
        icon={CLOUD_X_ICON}
        title={FAIL_TITLE}
        lines={msgLines}
        action={
          fetched.code && NO_RETRY_CODES.has(fetched.code) ? undefined : (
            <button
              type="button"
              onClick={p.onReload}
              className="active:opacity-80"
              style={{
                marginTop: 14,
                alignSelf: 'stretch',
                height: 56,
                border: 0,
                borderRadius: 4,
                background: V3.ink,
                color: '#FFFFFF',
                fontFamily: 'inherit',
                fontSize: 17,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 12a8 8 0 1 1-2.3-5.6" />
                <path d="M20 4v4.5h-4.5" />
              </svg>
              다시 조회하기
            </button>
          )
        }
      />
    )
  } else {
    body = (
      <>
        {fetched.status === 'ok' && <ProgressSteps state={fetched.data.state} />}
        <History fetchState={fetched} onReload={p.onReload} />
      </>
    )
  }

  return (
    // 줄 높이 normal — 시안 원본은 기본 줄 높이(안내 카드 문장은 따로 지정).
    <div style={{ paddingBottom: 32, color: V3.ink, lineHeight: 'normal' }}>
      {orderLine}

      {/* 송장 정보 — 화면의 핵심 카드(머스타드 + 도장 그림자) */}
      <section
        aria-label="송장 정보"
        style={{
          margin: '14px 20px 0',
          padding: '16px 16px 14px',
          border: `2px solid ${V3.ink}`,
          boxShadow: V3Shadow.stamp,
          borderRadius: 4,
          background: V3.mustard,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>택배사</span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{p.carrierLabel ?? '—'}</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right', minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>받는 분</span>
            <span style={{ fontSize: 18, fontWeight: 800, wordBreak: 'keep-all' }}>{p.recipientName}</span>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px', gap: 8 }}>
          <span
            style={{
              minHeight: 52,
              boxSizing: 'border-box',
              padding: '6px 12px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.5)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: V3.inkMute }}>송장번호</span>
            <span className="ft-num" style={{ fontSize: 20, letterSpacing: '0.04em', wordBreak: 'break-all' }}>
              {p.trackingNumber}
            </span>
          </span>
          <button
            type="button"
            onClick={p.onCopy}
            aria-label={p.copied ? '송장번호를 복사했어요' : '송장번호 복사'}
            className="active:opacity-80"
            style={{
              height: '100%',
              minHeight: 52,
              border: 0,
              borderRadius: 4,
              background: V3.ink,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {p.copied ? (
              <CheckIcon size={20} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="8" y="8" width="12" height="12" rx="1.5" />
                <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
              </svg>
            )}
          </button>
        </div>
        <dl style={{ margin: 0, paddingTop: 10, borderTop: '1px solid rgba(20,20,20,0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
            <dt>발송 일시</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{when(p.shippedAt)}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
            <dt>도착 일시</dt>
            <dd style={{ margin: 0, fontWeight: 800 }}>{when(p.deliveredAt)}</dd>
          </div>
        </dl>
      </section>

      {body}

      {/* 택배사 사이트로 열기(폴백 + 신뢰성 확보) — 웹과 같은 링크. */}
      {p.trackerDeepLink && (
        <div style={{ margin: '28px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href={p.trackerDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="active:opacity-80"
            style={{
              height: 56,
              borderRadius: 4,
              border: `1.5px solid ${V3.ink}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 16,
              fontWeight: 800,
              color: V3.ink,
              textDecoration: 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
            {p.carrierLabel ? `${p.carrierLabel} 사이트에서 조회` : '택배사 사이트에서 조회'}
          </a>
          <span style={{ textAlign: 'center', fontSize: 14, color: V3.inkMute }}>택배사 조회 페이지로 이동해요</span>
        </div>
      )}
    </div>
  )
}
