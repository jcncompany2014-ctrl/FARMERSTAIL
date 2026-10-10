'use client'

import { useEffect, useId, useState } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { FRESH_TIERS, type FreshTierKey } from '@/lib/subscription/freshTier'
import { V3 } from '@/lib/design/tokens'

/**
 * 화식 비율 변경 시트 — **정본은 서버**, 여기는 보여주고 고르는 자리다.
 *
 * # 왜 생겼나 (사장님 2026-07-31)
 * 비율은 신청할 때 한 번 고르면 끝이었다. 앱·웹·어드민 어디에도 바꾸는 수단이
 * 없어서, 곁들임(30%)으로 시작한 고객이 완전 화식으로 올리려면 **해지하고 다시
 * 신청**하는 수밖에 없었다 — 업셀도 이탈 방지도 그 벽에서 끝난다.
 *
 * # 금액을 여기서 계산하지 않는다
 * 세 티어의 금액은 **서버(GET)가 준다.** 화면이 계산하면 금액을 만드는 곳이
 * 둘이 되고, 그건 이 저장소가 반복해서 겪은 사고다("긁은 금액과 담는 박스가
 * 다른 처방"). 저장도 서버가 다시 계산한다 — 여기서 보낸 금액은 받지 않는다.
 *
 * # 왜 세 금액을 다 보여주나
 * 금액이 바뀌는데 **고객이 직접 고른 값**이라 별도 동의 모달이 없다(그 모달은
 * 우리가 처방을 바꿔 금액이 달라질 때 쓴다). 고르는 순간이 곧 동의라서,
 * 누르기 전에 **셋 다** 얼마인지 보여야 한다.
 *
 * 웹은 `--fd-*` 토큰만 쓴다 — 이 시트를 띄우는 웹 화면이 톤을 정한다.
 *
 * # 앱 모양(variant="app", 2026-10-09 앱 새 디자인 'A 포스터', 캔버스 S08)
 * 같은 컴포넌트·같은 API·같은 상태 — **그리는 것만** 갈린다(R14 variant 패턴, 웹은 기본값 그대로).
 * 앱은 비율(%)을 말하지 않는다(브랜드 보이스 · 앱시안 결정 3번 "화식 비율 %") — 티어 부제를 앱 문구로.
 */

type Option = { ratio: number; amount: number | null }

/** 앱 부제 — 비율(%) 대신 그릇이 어떻게 채워지는지(시안 S08). 웹은 FRESH_TIERS.sub 그대로. */
const APP_TIER_SUB: Record<FreshTierKey, string> = {
  light: '건사료에 화식을 곁들여요',
  half: '화식 반, 사료 반',
  full: '그릇을 화식으로만 채워요',
}

/** 고르지 않은 칸 테두리 — 시안의 옅은 회색(시트 손잡이와 같은 색). */
const APP_IDLE_BORDER = '#D5D3D4'

export default function FreshRatioSheet({
  subscriptionId,
  onClose,
  onChanged,
  variant = 'web',
}: {
  subscriptionId: string
  onClose: () => void
  /** 저장 성공 시 부모가 목록을 다시 읽도록. */
  onChanged: (next: { ratio: number; amount: number }) => void
  /** 'app' = 앱 새 디자인 모양(시안 S08). 기본 'web' — 웹 모양은 손대지 않는다. */
  variant?: 'web' | 'app'
}) {
  const titleId = useId()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [current, setCurrent] = useState<number | null>(null)
  const [options, setOptions] = useState<Option[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/subscriptions/${subscriptionId}/fresh-ratio`,
        )
        const body = (await res.json()) as {
          ok?: boolean
          current?: number | null
          options?: Option[]
          message?: string
        }
        if (cancelled) return
        if (!res.ok || !body.ok) {
          setErr(body.message ?? '금액을 불러오지 못했어요')
        } else {
          setCurrent(body.current ?? null)
          setOptions(body.options ?? [])
        }
      } catch {
        if (!cancelled) setErr('금액을 불러오지 못했어요')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [subscriptionId])

  async function pick(ratio: number) {
    if (saving !== null || ratio === current) return
    setErr('')
    setSaving(ratio)
    try {
      const res = await fetch(
        `/api/subscriptions/${subscriptionId}/fresh-ratio`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ratio }),
        },
      )
      const body = (await res.json()) as {
        ok?: boolean
        amount?: number
        message?: string
      }
      if (!res.ok || !body.ok || typeof body.amount !== 'number') {
        setErr(body.message ?? '변경하지 못했어요')
        setSaving(null)
        return
      }
      onChanged({ ratio, amount: body.amount })
      onClose()
    } catch {
      setErr('변경하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSaving(null)
    }
  }

  if (variant === 'app') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', color: V3.ink }}>
        {/* 제목 글꼴은 앱 틀의 h2 규칙이 준다 — fontFamily·fontWeight 를 여기서 주지 않는다. */}
        <h2 id={titleId} style={{ margin: '18px 0 0', fontSize: 26, lineHeight: 1.2 }}>
          화식 비율 바꾸기
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
          하루 식사 중 화식이 차지하는 비중이에요. 바꾸면 담기는 양과 결제 금액이 함께 바뀌고,{' '}
          <strong style={{ fontWeight: 800, color: V3.ink }}>다음 결제부터</strong> 적용돼요.
        </p>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} style={{ color: V3.inkMute }} aria-label="불러오는 중" />
          </div>
        ) : (
          <div role="radiogroup" aria-labelledby={titleId} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FRESH_TIERS.map((t) => {
              const opt = options.find((o) => o.ratio === t.ratio)
              const isCurrent = current === t.ratio
              const busy = saving === t.ratio
              // 금액을 못 구한 티어는 고를 수 없다(웹과 같은 이유 — 금액을 모르는 채로 누르면 동의가 성립하지 않는다).
              const unavailable = !opt || opt.amount === null
              const locked = isCurrent || unavailable || saving !== null
              return (
                <button
                  key={t.ratio}
                  type="button"
                  role="radio"
                  aria-checked={isCurrent}
                  onClick={() => void pick(t.ratio)}
                  disabled={locked}
                  className="ft-no-press"
                  style={{
                    minHeight: 76,
                    padding: '12px 14px',
                    borderRadius: 4,
                    // 네 변을 따로 — 줄임(border)과 한 변(borderLeft)을 섞으면 다시 그릴 때 React 가 어긋난다.
                    borderTop: isCurrent ? 0 : `1.5px solid ${APP_IDLE_BORDER}`,
                    borderRight: isCurrent ? 0 : `1.5px solid ${APP_IDLE_BORDER}`,
                    borderBottom: isCurrent ? 0 : `1.5px solid ${APP_IDLE_BORDER}`,
                    borderLeft: isCurrent ? `6px solid ${V3.mustard}` : `1.5px solid ${APP_IDLE_BORDER}`,
                    background: isCurrent ? V3.soft : '#FFFFFF',
                    color: V3.ink,
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto 24px',
                    columnGap: 10,
                    alignItems: 'center',
                    cursor: locked ? 'default' : 'pointer',
                    opacity: unavailable && !isCurrent ? 0.5 : 1,
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{t.label}</span>
                      {isCurrent && (
                        <span
                          style={{
                            height: 22,
                            padding: '0 6px',
                            borderRadius: 4,
                            background: V3.ink,
                            color: '#FFFFFF',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          지금 이 비율
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 14, color: V3.inkMute, wordBreak: 'keep-all' }}>{APP_TIER_SUB[t.key]}</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 17, fontWeight: 800 }}>
                      {unavailable ? '금액 미상' : `${opt!.amount!.toLocaleString('ko-KR')}원`}
                    </span>
                    <span style={{ fontSize: 13, color: V3.inkMute }}>2주마다</span>
                  </span>
                  {busy ? (
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} style={{ color: V3.inkMute }} aria-label="바꾸는 중" />
                  ) : isCurrent ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    <span aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {err && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 4,
              border: `1.5px solid ${V3.sale}`,
              background: '#FBF1EF',
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2.5} style={{ color: V3.sale, marginTop: 3 }} />
            <span>{err}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={saving !== null}
          style={{
            marginTop: 16,
            height: 56,
            borderRadius: 4,
            border: `1.5px solid ${V3.ink}`,
            background: '#FFFFFF',
            color: V3.ink,
            fontFamily: 'inherit',
            fontSize: 17,
            fontWeight: 800,
            cursor: saving !== null ? 'default' : 'pointer',
            opacity: saving !== null ? 0.5 : 1,
          }}
        >
          닫기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[13.5px] font-bold" style={{ color: 'var(--fd-pine)' }}>
          화식 비율 바꾸기
        </p>
        <p
          className="mt-1 text-[11.5px] leading-relaxed"
          style={{ color: 'var(--fd-muted)' }}
        >
          하루 식사 중 화식이 차지하는 비중이에요. 바꾸면 담기는 양과 결제 금액이
          함께 바뀌고, <strong>다음 결제부터</strong> 적용돼요.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2
            className="w-5 h-5 animate-spin"
            strokeWidth={2}
            style={{ color: 'var(--fd-muted)' }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {FRESH_TIERS.map((t) => {
            const opt = options.find((o) => o.ratio === t.ratio)
            const isCurrent = current === t.ratio
            const busy = saving === t.ratio
            /**
             * 금액을 못 구한 티어는 **고를 수 없게** 한다. 0원으로 그리면
             * 공짜처럼 보이고, 금액을 모르는 채로 누르면 동의가 성립하지 않는다.
             */
            const unavailable = !opt || opt.amount === null
            return (
              <button
                key={t.ratio}
                type="button"
                onClick={() => void pick(t.ratio)}
                disabled={isCurrent || unavailable || saving !== null}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--fd-r-row,10px)] text-left transition active:scale-[0.99] disabled:cursor-default"
                style={{
                  boxShadow: isCurrent
                    ? 'inset 0 0 0 2px var(--fd-coral)'
                    : 'inset 0 0 0 1px var(--fd-line)',
                  opacity: unavailable && !isCurrent ? 0.5 : 1,
                }}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[13.5px] font-bold"
                    style={{ color: 'var(--fd-pine)' }}
                  >
                    {t.label}
                    {isCurrent && (
                      <span
                        className="ml-1.5 text-[11px] font-bold"
                        style={{ color: 'var(--fd-coral-text)' }}
                      >
                        지금 이 비율
                      </span>
                    )}
                  </span>
                  <span
                    className="block text-[11.5px] mt-0.5"
                    style={{ color: 'var(--fd-muted)' }}
                  >
                    {t.sub}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className="block text-[13px] font-bold tabular-nums"
                    style={{ color: 'var(--fd-pine)' }}
                  >
                    {unavailable
                      ? '금액 미상'
                      : `${opt!.amount!.toLocaleString()}원`}
                  </span>
                  <span
                    className="block text-[10.5px]"
                    style={{ color: 'var(--fd-muted)' }}
                  >
                    2주마다
                  </span>
                </span>
                {busy ? (
                  <Loader2
                    className="w-4 h-4 animate-spin shrink-0"
                    strokeWidth={2}
                    style={{ color: 'var(--fd-muted)' }}
                  />
                ) : isCurrent ? (
                  <Check
                    className="w-4 h-4 shrink-0"
                    strokeWidth={2.5}
                    style={{ color: 'var(--fd-coral)' }}
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {err && (
        <div
          role="alert"
          className="text-[12px] font-bold rounded-[10px] px-3.5 py-2.5 flex items-start gap-2"
          style={{
            color: 'var(--fd-coral)',
            background: 'color-mix(in srgb, var(--fd-coral) 7%, transparent)',
          }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.5} />
          <span>{err}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        disabled={saving !== null}
        className="mt-1 w-full py-3 rounded-full text-[13px] font-bold transition disabled:opacity-50"
        style={{
          color: 'var(--fd-muted)',
          boxShadow: 'inset 0 0 0 1px var(--fd-line)',
        }}
      >
        닫기
      </button>
    </div>
  )
}
