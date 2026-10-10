'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { V3, V3Radius } from '@/lib/design/tokens'
import { RuleList, SectionTitle, Toggle, outlineButton } from '@/components/v3/me/MeParts'
import { BellIcon, MoonIcon, RefreshIcon } from '@/components/v3/me/MeIcons'

/**
 * 푸시 카테고리 토글 + quiet hours 설정 UI.
 *
 * 마운트 시 /api/push/preferences 에서 GET, 각 토글/셀렉트는 즉시 PATCH 로 반영.
 * 낙관적 UI: 로컬 state 를 먼저 올리고, 실패 시 원복.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 M12 · I08): '알림 종류'(위 2px 먹선 목록 + 64×36 스위치) ·
 *   '방해 금지 시간'(달 그림 + 체크 26 + 고르기 칸 52). 불러오기 실패는 회색 면 카드 + '다시 불러오기'(I08) —
 *   문구는 앱시안 결정대로 "지금 상태를 알 수 없어서 켜고 끄는 칸을 잠시 숨겼어요. 새로고침해 주세요."
 *   (예전 "…그리지 않았어요"). 상태를 모르면 칸을 그리지 않는 원칙은 그대로다.
 */

type Prefs = {
  notify_order: boolean
  notify_health: boolean
  notify_marketing: boolean
  quiet_hours_start: number | null
  quiet_hours_end: number | null
}

// 카테고리는 **보호자가 끄고 싶어 하는 단위**로 나눈다 (2026-07-16 정리).
// 장바구니·재입고는 낱개 커머스와 함께 사라져 컬럼째 제거. 반대로 건강 알림은
// 카테고리가 없어서 '주문·배송' 으로 위장해 나가고 있었다 — 배송 알림을 끄면
// 체중 경보까지 꺼지는 상태였다. 그래서 건강을 독립시켰다.
const CATEGORIES: { key: keyof Prefs; label: string; sub?: string; hint: string }[] = [
  { key: 'notify_order', label: '주문 · 배송', hint: '결제와 배송 단계가 바뀌면 알려드려요' },
  {
    key: 'notify_health',
    label: '건강 알림',
    hint: '체중 재기 · 체중 변화 · 검진 권고',
  },
  // 광고성 정보 수신 동의라는 **법정 표현**이 있어야 한다(정보통신망법 §50).
  // '프로모션 · 할인 / 할인·새 소식' 만으로는 무엇에 동의하는지가 드러나지 않는다.
  // (시안 M12 는 둘째 줄로 나눠 그린다 — 스위치 이름(aria-label)엔 두 줄을 다 넣는다.)
  {
    key: 'notify_marketing',
    label: '프로모션 · 할인',
    sub: '(광고성 정보 수신 동의)',
    hint: '할인·새 소식을 앱 푸시로 받아요 (선택) · 08~20시에만 보내요',
  },
]

const LOAD_FAILED = '설정을 불러오지 못했어요. 지금 상태를 알 수 없어서 켜고 끄는 칸을 잠시 숨겼어요. 새로고침해 주세요.'

const SELECT_STYLE = {
  height: 52,
  boxSizing: 'border-box' as const,
  padding: '0 10px',
  borderRadius: V3Radius.sm,
  border: '1.5px solid #8A8A8A',
  background: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: 17,
  fontWeight: 700,
  color: V3.ink,
  minWidth: 0,
  letterSpacing: 'normal',
}

export default function PreferencesPanel({
  onLoadFailed,
}: {
  /** 불러오기 실패를 부모에 알린다 — 시안 I08 처럼 이 탭의 다른 칸(이 기기 알림·기기)도 같이 숨긴다. */
  onLoadFailed?: () => void
} = {}) {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [saving, setSaving] = useState<keyof Prefs | 'quiet' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 최신 콜백 — 불러오기는 처음 한 번만 하므로 effect 의존성에 넣지 않고 ref 로 읽는다.
  const onLoadFailedRef = useRef(onLoadFailed)
  useEffect(() => {
    onLoadFailedRef.current = onLoadFailed
  }, [onLoadFailed])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/push/preferences')
        const data = await res.json().catch(() => null)
        if (!mounted) return
        if (data?.prefs) setPrefs(data.prefs as Prefs)
        else {
          setError(LOAD_FAILED)
          onLoadFailedRef.current?.()
        }
      } catch {
        if (mounted) {
          setError(LOAD_FAILED)
          onLoadFailedRef.current?.()
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  async function patch(partial: Partial<Prefs>, key: keyof Prefs | 'quiet') {
    if (!prefs) return
    setError(null)
    setSaving(key)
    const prev = prefs
    const optimistic = { ...prefs, ...partial }
    setPrefs(optimistic)
    try {
      const res = await fetch('/api/push/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? '저장하지 못했어요')
        setPrefs(prev)
      }
    } catch {
      setError('네트워크가 불안정해요. 다시 시도해 주세요')
      setPrefs(prev)
    } finally {
      setSaving(null)
    }
  }

  if (!prefs) {
    // 로딩 실패 시 무한 스피너에 갇히지 않도록 — 에러면 안내 + 재시도(시안 I08).
    if (error) {
      return (
        <section
          aria-label="설정 불러오기 실패"
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
          <p role="alert" style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, lineHeight: 1.4 }}>
            설정을 불러오지 못했어요
          </p>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
            지금 상태를 알 수 없어서 켜고 끄는 칸을
            <br />
            잠시 숨겼어요. 새로고침해 주세요.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload()
            }}
            style={{ ...outlineButton(54, 16), marginTop: 14, alignSelf: 'stretch' }}
          >
            <RefreshIcon size={18} strokeWidth={2.4} />
            다시 불러오기
          </button>
        </section>
      )
    }
    return (
      <div style={{ padding: '32px 20px 0', display: 'flex', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" style={{ width: 22, height: 22, color: V3.inkMute }} strokeWidth={2} />
      </div>
    )
  }

  const quietOn = prefs.quiet_hours_start !== null && prefs.quiet_hours_end !== null

  return (
    <>
      <section aria-labelledby="pf-kind" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle id="pf-kind">알림 종류</SectionTitle>
        <RuleList style={{ marginTop: 12 }}>
          {CATEGORIES.map((c) => {
            const on = Boolean(prefs[c.key])
            const busy = saving === c.key
            return (
              <div
                key={c.key}
                style={{
                  padding: '14px 0',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr 64px',
                  columnGap: 14,
                  alignItems: 'center',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>
                    {c.label}
                    {c.sub && (
                      <>
                        <br />
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{c.sub}</span>
                      </>
                    )}
                  </span>
                  <span style={{ fontSize: 15, lineHeight: 1.5, color: V3.inkMute }}>{c.hint}</span>
                </span>
                <Toggle
                  on={on}
                  disabled={busy}
                  label={c.sub ? `${c.label} ${c.sub}` : c.label}
                  onClick={() => patch({ [c.key]: !on } as Partial<Prefs>, c.key)}
                />
              </div>
            )
          })}
        </RuleList>
      </section>

      <section aria-labelledby="pf-quiet" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="pf-quiet" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 22, lineHeight: 'normal' }}>
          <MoonIcon size={20} />
          방해 금지 시간
        </h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
          이 시간에는 푸시가 울리지 않아요. 한국 시간 기준이에요.
        </p>
        <label style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={quietOn}
            onChange={(e) =>
              patch(
                e.target.checked
                  ? { quiet_hours_start: 22, quiet_hours_end: 8 }
                  : { quiet_hours_start: null, quiet_hours_end: null },
                'quiet',
              )
            }
            style={{ margin: 0, width: 26, height: 26, accentColor: V3.ink, flexShrink: 0 }}
          />
          사용
        </label>
        {quietOn && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', columnGap: 8, alignItems: 'center' }}>
            <select
              aria-label="시작 시각"
              value={prefs.quiet_hours_start ?? 22}
              onChange={(e) => patch({ quiet_hours_start: Number(e.target.value) }, 'quiet')}
              style={SELECT_STYLE}
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}시
                </option>
              ))}
            </select>
            <span style={{ fontSize: 16, color: V3.inkSoft }}>부터</span>
            <select
              aria-label="끝 시각"
              value={prefs.quiet_hours_end ?? 8}
              onChange={(e) => patch({ quiet_hours_end: Number(e.target.value) }, 'quiet')}
              style={SELECT_STYLE}
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}시
                </option>
              ))}
            </select>
            <span style={{ fontSize: 16, color: V3.inkSoft }}>까지</span>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" style={{ margin: '12px 20px 0', fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: V3.sale }}>
          {error}
        </p>
      )}
    </>
  )
}
