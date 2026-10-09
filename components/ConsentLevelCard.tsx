'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { V3 } from '@/lib/design/tokens'

/**
 * ConsentLevelCard — 단계적 동의 4단계 UI (B-92).
 *
 * 단계:
 *  1) basic     — 서비스 운영에 필수한 데이터만 (default)
 *  2) anonymous — 익명 통계 / 내부 연구 활용 허용
 *  3) academic  — 학술 연구 자료 제공 허용
 *  4) b2b       — 사업 파트너 제공 (차등 프라이버시 적용)
 *
 * 상승/하향 자유 — 별도 보상 없음(옛 응원 포인트 적립 B-94는 2026-07-16 포인트
 * 전면 폐기로 제거됨. 핸들러가 RPC reward 를 무시하고 토스트도 안 띄운다).
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 M15 '데이터 동의 단계'): 쓰는 곳은 앱 '내 데이터'(/mypage/privacy)
 *   하나다. 위 2px 먹선 목록 + 오른쪽 동그라미 고르기(고른 것 = 굵은 먹선 링). 아이콘·테라코타 색은 뺐다.
 *   문구는 시안대로 — "언제든 낮출 수 있어요"(금지어 '언제든') → "이 화면에서 바로 낮출 수 있어요",
 *   파트너 제공 설명의 전문용어("차등 프라이버시") → "누구인지 알 수 없게 처리한 데이터". 저장 로직은 그대로.
 */

type Level = 1 | 2 | 3 | 4

const LEVELS: Array<{
  level: Level
  label: string
  description: string
}> = [
  {
    level: 1,
    label: '기본',
    description: '서비스 운영에 꼭 필요한 데이터만 처리해요',
  },
  {
    level: 2,
    label: '익명 통계 허용',
    description: '익명 통계·내부 연구에 써도 좋아요',
  },
  {
    level: 3,
    label: '학술 연구 허용',
    description: '학술 논문·연구 자료로 제공해도 좋아요',
  },
  {
    level: 4,
    label: '파트너 제공 허용',
    description: '누구인지 알 수 없게 처리한 데이터를 사업 파트너에게 제공해도 좋아요',
  },
]

export default function ConsentLevelCard({
  initialLevel,
}: {
  initialLevel: Level
}) {
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()
  const [level, setLevel] = useState<Level>(initialLevel)
  const [busy, setBusy] = useState(false)

  async function setConsentLevel(next: Level) {
    if (busy || next === level) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('set_consent_level', {
        p_level: next,
      })
      type RpcResult = {
        ok: boolean
        prev?: number
        next?: number
        reward?: number
        balanceAfter?: number
        message?: string
      }
      const result = (data ?? null) as RpcResult | null
      if (error || !result?.ok) {
        toast.error(result?.message ?? '저장하지 못했어요')
        return
      }
      setLevel(next)
      // 포인트 보상 토스트 제거 (2026-07-16 포인트 전면 폐기). RPC 가 아직
      // reward 를 돌려줄 수 있으나 적립될 곳이 없으므로 무시한다.
      toast.success('동의 단계를 저장했어요')
      router.refresh()
    } catch {
      toast.error('잠시 네트워크가 불안정한 것 같아요. 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="ft-consent-level" style={{ padding: '30px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <h2 id="ft-consent-level" style={{ margin: 0, fontSize: 22, lineHeight: 'normal' }}>
        데이터 동의 단계
      </h2>
      <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
        단계가 높을수록 데이터가 더 쓸모 있게 쓰여요. 이 화면에서 바로 낮출 수 있어요.
      </p>
      <div
        role="radiogroup"
        aria-labelledby="ft-consent-level"
        aria-busy={busy}
        style={{ marginTop: 12, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}
      >
        {LEVELS.map((l) => {
          const active = l.level === level
          return (
            <button
              key={l.level}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setConsentLevel(l.level)}
              disabled={busy}
              style={{
                padding: '14px 0',
                border: 0,
                borderBottom: `1px solid ${V3.rule}`,
                background: 'transparent',
                color: V3.ink,
                fontFamily: 'inherit',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '1fr 26px',
                columnGap: 12,
                alignItems: 'center',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy && !active ? 0.6 : 1,
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 17, fontWeight: active ? 800 : 700 }}>{l.label}</span>
                <span style={{ fontSize: 15, color: V3.inkMute }}>{l.description}</span>
              </span>
              <span
                aria-hidden
                style={{
                  width: 26,
                  height: 26,
                  boxSizing: 'border-box',
                  borderRadius: 13,
                  border: active ? `8px solid ${V3.ink}` : '2px solid #8A8A8A',
                  background: '#FFFFFF',
                }}
              />
            </button>
          )
        })}
      </div>
    </section>
  )
}
