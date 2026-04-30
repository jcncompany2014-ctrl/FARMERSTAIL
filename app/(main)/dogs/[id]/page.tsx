'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Dog as DogIcon,
  Moon,
  Footprints,
  Zap,
  Check,
  X,
  BarChart3,
  ClipboardList,
  Pencil,
  Trash2,
  AlertTriangle,
  Scale,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Heart,
  Bell,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type Dog = {
  id: string
  name: string
  breed: string | null
  gender: string | null
  neutered: boolean | null
  age_value: number | null
  age_unit: string | null
  weight: number | null
  activity_level: string | null
  photo_url: string | null
  created_at: string
}

type WeightLog = {
  id: string
  weight: number
  measured_at: string
  note: string | null
}

export default function DogDetailPage() {
  const router = useRouter()
  const params = useParams()
  const dogId = params.id as string
  const supabase = createClient()
  const toast = useToast()

  const [dog, setDog] = useState<Dog | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [newWeightNote, setNewWeightNote] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  useEffect(() => {
    async function loadDog() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Explicit user_id filter — the admin RLS policy would otherwise let
      // admin-role accounts read other users' dogs by guessing an ID.
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error || !data) {
        router.push('/dogs')
        return
      }

      setDog(data)

      const { data: logs } = await supabase
        .from('weight_logs')
        .select('id, weight, measured_at, note')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(10)
      if (logs) setWeightLogs(logs)

      setLoading(false)
    }
    loadDog()
  }, [dogId, router, supabase])

  async function handleSaveWeight() {
    const value = parseFloat(newWeight)
    if (!value || value <= 0 || value > 100) {
      toast.error('올바른 체중을 입력해 주세요 (0.1 ~ 100kg)')
      return
    }
    setSavingWeight(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('weight_logs')
      .insert({
        dog_id: dogId,
        user_id: user.id,
        weight: value,
        note: newWeightNote.trim() || null,
      })
      .select('id, weight, measured_at, note')
      .single()

    if (error || !data) {
      toast.error('저장 실패: ' + (error?.message ?? '알 수 없음'))
      setSavingWeight(false)
      return
    }

    // 마스터 체중도 최신값으로 업데이트 (분석·대시보드 반영)
    await supabase
      .from('dogs')
      .update({ weight: value, updated_at: new Date().toISOString() })
      .eq('id', dogId)
      .eq('user_id', user.id)

    setWeightLogs((prev) => [data, ...prev])
    setDog((prev) => (prev ? { ...prev, weight: value } : prev))
    setNewWeight('')
    setNewWeightNote('')
    setShowWeightModal(false)
    setSavingWeight(false)
  }

  async function handleDelete() {
    setDeleting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // `.select()` + row count so RLS-blocked deletes surface as errors
    // instead of silently succeeding with zero rows affected.
    const { data, error } = await supabase
      .from('dogs')
      .delete()
      .eq('id', dogId)
      .eq('user_id', user.id)
      .select('id')

    if (error) {
      toast.error('삭제 실패: ' + error.message)
      setDeleting(false)
      return
    }

    if (!data || data.length === 0) {
      toast.error('삭제 권한이 없어요. 이 강아지는 다른 계정에 속해있어요.')
      setDeleting(false)
      setShowDeleteConfirm(false)
      return
    }

    router.push('/dogs')
    router.refresh()
  }

  if (loading || !dog) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  const activityMeta: Record<
    string,
    { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; text: string }
  > = {
    low: { Icon: Moon, text: '낮음' },
    medium: { Icon: Footprints, text: '보통' },
    high: { Icon: Zap, text: '활동적' },
  }
  const genderText: Record<string, string> = {
    male: '남아',
    female: '여아',
  }

  return (
    <main className="pb-10">
      {/* Header */}
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/dogs"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 강아지 목록
        </Link>
      </section>

      {/* Hero */}
      <section className="px-5 mt-4">
        <div className="bg-white rounded-2xl border border-rule px-6 py-8 text-center">
          <div className="w-24 h-24 bg-bg rounded-full overflow-hidden flex items-center justify-center mx-auto mb-4">
            {dog.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dog.photo_url}
                alt={dog.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <DogIcon
                className="w-10 h-10 text-muted"
                strokeWidth={1.3}
              />
            )}
          </div>
          <span className="kicker mb-2 inline-block">Dog Profile</span>
          <h1 className="font-serif" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {dog.name}
          </h1>
          {dog.breed && (
            <p className="text-[12px] text-muted mt-1.5">{dog.breed}</p>
          )}
        </div>
      </section>

      {/* Info card */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-2xl border border-rule px-5 py-4">
          <InfoRow
            label="성별"
            value={dog.gender ? genderText[dog.gender] ?? '-' : '-'}
          />
          <InfoRow
            label="중성화"
            valueNode={
              dog.neutered === null ? (
                <span className="text-[13px] font-bold text-text">-</span>
              ) : dog.neutered ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-bold text-moss">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  했어요
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[13px] font-bold text-muted">
                  <X className="w-3.5 h-3.5" strokeWidth={2.5} />안 했어요
                </span>
              )
            }
          />
          <InfoRow
            label="나이"
            value={
              dog.age_value
                ? `${dog.age_value}${dog.age_unit === 'years' ? '살' : '개월'}`
                : '-'
            }
          />
          <InfoRow label="체중" value={dog.weight ? `${dog.weight}kg` : '-'} />
          <InfoRow
            label="활동량"
            valueNode={(() => {
              if (!dog.activity_level)
                return <span className="text-[13px] font-bold text-text">-</span>
              const meta = activityMeta[dog.activity_level]
              if (!meta)
                return <span className="text-[13px] font-bold text-text">-</span>
              const { Icon, text } = meta
              return (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-text">
                  <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={2} />
                  {text}
                </span>
              )
            })()}
          />
        </div>
      </section>

      {/* 체중 추이 카드 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-2xl border border-rule p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-moss" strokeWidth={2} />
              <span className="kicker">Weight Log · 체중 기록</span>
            </div>
            <button
              onClick={() => setShowWeightModal(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta hover:text-text transition"
            >
              <Plus className="w-3 h-3" strokeWidth={2.5} />
              기록 추가
            </button>
          </div>

          {weightLogs.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-[12px] text-muted">
                아직 체중 기록이 없어요.
              </p>
              <p className="text-[10px] text-muted/70 mt-1">
                &ldquo;기록 추가&rdquo;로 주기적으로 남겨 보세요.
              </p>
            </div>
          ) : (
            <>
              {/* 스파크라인 */}
              <WeightSparkline logs={weightLogs} />

              {/* 최근 3개 */}
              <ul className="mt-3 space-y-1.5">
                {weightLogs.slice(0, 3).map((log, idx) => {
                  const next = weightLogs[idx + 1]
                  const delta = next ? log.weight - next.weight : 0
                  return (
                    <li
                      key={log.id}
                      className="flex items-center justify-between text-[12px] py-1.5 px-3 rounded-lg bg-bg"
                    >
                      <span className="text-muted text-[11px]">
                        {new Date(log.measured_at).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text">
                          {log.weight}kg
                        </span>
                        {next && (
                          <span
                            className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                              Math.abs(delta) < 0.05
                                ? 'text-muted'
                                : delta > 0
                                  ? 'text-terracotta'
                                  : 'text-moss'
                            }`}
                          >
                            {Math.abs(delta) < 0.05 ? (
                              <Minus className="w-2.5 h-2.5" strokeWidth={3} />
                            ) : delta > 0 ? (
                              <TrendingUp className="w-2.5 h-2.5" strokeWidth={2.5} />
                            ) : (
                              <TrendingDown className="w-2.5 h-2.5" strokeWidth={2.5} />
                            )}
                            {delta > 0 ? '+' : ''}
                            {delta.toFixed(1)}kg
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* 체중 기록 모달 */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:px-6 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border-t sm:border border-rule p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-3.5 h-3.5 text-moss" strokeWidth={2} />
              <span className="kicker">New Weight Log · 체중 기록 추가</span>
            </div>
            <h3 className="font-serif text-[18px] font-black text-text">
              {dog.name}의 체중
            </h3>
            <p className="text-[11px] text-muted mt-1">
              기록하면 추이 차트와 대시보드에 반영돼요.
            </p>

            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-text mb-1.5">
                  체중 (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  autoFocus
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder={dog.weight ? `이전: ${dog.weight}kg` : '예: 5.4'}
                  className="w-full px-4 py-3 rounded-lg border border-rule bg-[#FDFDFD] text-[#2A2118] text-sm focus:outline-none focus:border-terracotta transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text mb-1.5">
                  메모 (선택)
                </label>
                <input
                  type="text"
                  value={newWeightNote}
                  onChange={(e) => setNewWeightNote(e.target.value)}
                  placeholder="병원 검진, 사료 변경 등"
                  maxLength={80}
                  className="w-full px-4 py-3 rounded-lg border border-rule bg-[#FDFDFD] text-[#2A2118] text-sm focus:outline-none focus:border-terracotta transition"
                />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={handleSaveWeight}
                disabled={savingWeight || !newWeight}
                className="w-full py-3 rounded-full bg-ink text-bg text-[13px] font-bold active:scale-[0.98] transition disabled:opacity-50"
              >
                {savingWeight ? '저장 중...' : '저장하기'}
              </button>
              <button
                onClick={() => {
                  setShowWeightModal(false)
                  setNewWeight('')
                  setNewWeightNote('')
                }}
                disabled={savingWeight}
                className="w-full py-3 rounded-xl bg-white text-muted text-[13px] font-bold border border-rule hover:border-text hover:text-text transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary actions */}
      <section className="px-5 mt-4 space-y-2.5">
        <Link
          href={`/dogs/${dog.id}/analysis`}
          className="flex items-center gap-3 w-full px-5 py-4 bg-text text-white rounded-2xl active:scale-[0.99] transition"
        >
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[13px] font-black">맞춤 영양 분석 보기</div>
            <div className="text-[10px] text-white/60 mt-0.5">
              AI가 {dog.name}의 식단을 분석해요
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/survey`}
          className="flex items-center gap-3 w-full px-5 py-4 bg-terracotta text-white rounded-2xl active:scale-[0.99] transition"
        >
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <ClipboardList className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[13px] font-black">설문 시작하기</div>
            <div className="text-[10px] text-white/70 mt-0.5">
              맞춤 식단 추천을 위한 5분 설문
            </div>
          </div>
        </Link>
      </section>

      {/* Tertiary: 분석 히스토리 + 건강 일지 */}
      <section className="px-5 mt-3 space-y-2">
        <Link
          href={`/dogs/${dog.id}/analyses`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-white rounded-xl border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <History className="w-4 h-4 text-moss" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              분석 히스토리
            </div>
            <div className="text-[10px] text-muted mt-0.5">
              이전 분석 결과를 시간순으로 비교해보세요
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/health`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-white rounded-xl border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <Heart className="w-4 h-4 text-sale" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              건강 일지
            </div>
            <div className="text-[10px] text-muted mt-0.5">
              변·활동량·기분·식욕을 매일 기록해요
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/reminders`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-white rounded-xl border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <Bell className="w-4 h-4 text-terracotta" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              리마인더
            </div>
            <div className="text-[10px] text-muted mt-0.5">
              예방접종·투약·검진 일정을 관리해요
            </div>
          </div>
        </Link>
      </section>

      {/* Secondary actions */}
      <section className="px-5 mt-3 grid grid-cols-2 gap-2.5">
        <Link
          href={`/dogs/${dog.id}/edit`}
          className="flex items-center justify-center gap-1.5 py-3 bg-white text-text rounded-xl border border-rule hover:border-text text-[12px] font-bold transition"
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
          정보 수정
        </Link>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center justify-center gap-1.5 py-3 bg-white text-sale rounded-xl border border-rule hover:border-sale text-[12px] font-bold transition"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          삭제
        </button>
      </section>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-6 z-50">
          <div className="bg-white rounded-2xl border border-rule p-6 max-w-sm w-full shadow-xl">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-[#FFF5F3] flex items-center justify-center">
                <AlertTriangle
                  className="w-6 h-6 text-sale"
                  strokeWidth={2}
                />
              </div>
            </div>
            <h3 className="font-serif text-[18px] font-black text-text text-center mb-2">
              정말 삭제할까요?
            </h3>
            <p className="text-[12px] text-muted text-center mb-6 leading-relaxed">
              {dog.name}의 모든 정보가 삭제돼요.
              <br />
              이 작업은 되돌릴 수 없어요.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-3 rounded-xl bg-sale text-white text-[13px] font-black active:scale-[0.98] transition disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '네, 삭제할래요'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="w-full py-3 rounded-xl bg-white text-muted text-[13px] font-bold border border-rule hover:border-text hover:text-text transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function InfoRow({
  label,
  value,
  valueNode,
}: {
  label: string
  value?: string
  valueNode?: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-bg last:border-0">
      <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.2em]">
        {label}
      </span>
      {valueNode ?? (
        <span className="text-[13px] font-bold text-text">{value}</span>
      )}
    </div>
  )
}

/**
 * Tiny SVG sparkline of recent weight readings.
 * Receives logs in newest-first order; we reverse for left-to-right time axis.
 */
function WeightSparkline({ logs }: { logs: WeightLog[] }) {
  const series = [...logs].reverse()
  if (series.length < 2) {
    return (
      <div className="h-16 flex items-center justify-center bg-bg rounded-lg">
        <span className="text-[11px] text-muted">
          기록이 2개 이상 쌓이면 추이가 보여요
        </span>
      </div>
    )
  }

  const W = 280
  const H = 64
  const PAD = 6
  const weights = series.map((s) => s.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1

  const points = series.map((s, i) => {
    const x = PAD + (i * (W - PAD * 2)) / (series.length - 1)
    const y = H - PAD - ((s.weight - min) / range) * (H - PAD * 2)
    return { x, y, v: s.weight }
  })
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${points[0].x},${H} ${polyline} ${points[points.length - 1].x},${H}`
  const last = points[points.length - 1]

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-16"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="wlog-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--moss)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--moss)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#wlog-grad)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--moss)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last.x} cy={last.y} r="3.5" fill="var(--terracotta)" />
        <circle cx={last.x} cy={last.y} r="1.5" fill="white" />
      </svg>
      <div className="flex justify-between text-[9px] text-muted mt-1 px-0.5">
        <span>{min}kg</span>
        <span className="font-bold text-text">{last.v}kg</span>
        <span>{max}kg</span>
      </div>
    </div>
  )
}
