'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield,
  Loader2,
  CheckCircle2,
  Eye,
  GraduationCap,
  Briefcase,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

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
 */

type Level = 1 | 2 | 3 | 4

const LEVELS: Array<{
  level: Level
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}> = [
  {
    level: 1,
    label: '기본',
    description: '서비스 운영에 필수한 데이터만 처리해요',
    Icon: Shield,
  },
  {
    level: 2,
    label: '익명 통계 허용',
    description: '익명 통계·내부 연구에 활용해도 좋아요',
    Icon: Eye,
  },
  {
    level: 3,
    label: '학술 연구 허용',
    description: '학술 논문·연구 자료 제공에 동의해요',
    Icon: GraduationCap,
  },
  {
    level: 4,
    label: '파트너 제공 허용',
    description: '차등 프라이버시 적용된 데이터의 사업 파트너 제공',
    Icon: Briefcase,
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
    <section
      className="rounded-2xl border bg-white px-5 py-4"
      style={{ borderColor: 'var(--rule)' }}
      aria-label="데이터 동의 단계"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles
          className="w-4 h-4"
          strokeWidth={2}
          style={{ color: 'var(--terracotta)' }}
          aria-hidden
        />
        <span className="kicker" style={{ color: 'var(--terracotta)' }}>
          데이터 동의 단계
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-text/75 mb-4">
        단계가 높을수록 데이터가 더 유용하게 쓰여요. 언제든 낮출 수 있어요.
      </p>

      <div className="space-y-2">
        {LEVELS.map((l) => {
          const active = l.level === level
          return (
            <button
              key={l.level}
              type="button"
              onClick={() => setConsentLevel(l.level)}
              disabled={busy}
              aria-pressed={active}
              className="w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition disabled:opacity-60"
              style={{
                borderColor: active
                  ? 'var(--terracotta)'
                  : 'var(--rule)',
                background: active
                  ? 'color-mix(in srgb, var(--terracotta) 6%, white)'
                  : 'white',
              }}
            >
              <span
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                style={{
                  background: active
                    ? 'var(--terracotta)'
                    : 'color-mix(in srgb, var(--rule) 60%, white)',
                  color: active ? 'white' : 'var(--muted)',
                }}
                aria-hidden
              >
                <l.Icon className="w-4 h-4" strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[12.5px] font-bold"
                    style={{ color: 'var(--ink)' }}
                  >
                    {l.label}
                  </span>
                  {active && (
                    <CheckCircle2
                      className="w-3 h-3"
                      strokeWidth={2.2}
                      style={{ color: 'var(--terracotta)' }}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  {l.description}
                </p>
              </div>
              {busy && active && (
                <Loader2
                  className="w-3.5 h-3.5 animate-spin shrink-0 mt-1"
                  style={{ color: 'var(--terracotta)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
