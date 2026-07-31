'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { FRESH_TIERS } from '@/lib/subscription/freshTier'

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
 * 토큰은 `--fd-*` 만 쓴다 — 이 시트를 띄우는 화면이 앱 컨텍스트에서 스코프
 * 스왑을 하므로 톤이 저절로 따라온다(웹=FD, 앱=v3).
 */

type Option = { ratio: number; amount: number | null }

export default function FreshRatioSheet({
  subscriptionId,
  onClose,
  onChanged,
}: {
  subscriptionId: string
  onClose: () => void
  /** 저장 성공 시 부모가 목록을 다시 읽도록. */
  onChanged: (next: { ratio: number; amount: number }) => void
}) {
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
