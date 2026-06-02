'use client'

// audit #101 — DogDetailClient: interactive 부분만 client.
// page.tsx (server) 가 auth/dog/formula/logs/subs/checkins prefetch + redirect.
// 여기엔 weight modal, delete modal, welcome sheet, 가족/공유/사진 요청 같은
// useState/onClick/useEffect 만 남김.
import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useModalA11y } from '@/lib/ui/useModalA11y'
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
  Sparkles,
  PartyPopper,
  Stethoscope,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  type Dog,
  type WeightLog,
  type CurrentFormula,
  type CheckinStatus,
  type ActiveSubscription,
} from './_components/types'
import WeightSparkline from './_components/WeightSparkline'
import CurrentFormulaCard from './_components/CurrentFormulaCard'
import SubscriptionCard from './_components/SubscriptionCard'
import DogFamilyMembers from '@/components/DogFamilyMembers'
import VetShareButton from '@/components/VetShareButton'
import PhotoRequestButton from '@/components/PhotoRequestButton'

type Props = {
  dog: Dog
  ownerName: string | null
  initialWeightLogs: WeightLog[]
  currentFormula: CurrentFormula | null
  checkinStatus: CheckinStatus
  subscriptions: ActiveSubscription[]
}

export default function DogDetailClient({
  dog: initialDog,
  ownerName,
  initialWeightLogs,
  currentFormula,
  checkinStatus,
  subscriptions,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const toast = useToast()

  // dog 는 체중 저장 시 즉시 반영해야 하므로 state 유지 (server 가 init).
  const [dog, setDog] = useState<Dog>(initialDog)
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(initialWeightLogs)
  const dogId = dog.id

  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [showWeightModal, setShowWeightModal] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [newWeightNote, setNewWeightNote] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  // ?welcome=1 — 강아지 등록 직후 진입 시 환영 시트 자동 오픈.
  const [showWelcomeSheet, setShowWelcomeSheet] = useState(false)

  const weightModalRef = useRef<HTMLDivElement>(null)
  const deleteModalRef = useRef<HTMLDivElement>(null)
  const welcomeSheetRef = useRef<HTMLDivElement>(null)
  function closeWeightModal() {
    if (savingWeight) return
    setShowWeightModal(false)
    setNewWeight('')
    setNewWeightNote('')
  }
  useModalA11y({
    open: showWeightModal,
    onClose: closeWeightModal,
    containerRef: weightModalRef,
    preventEscape: savingWeight,
  })
  useModalA11y({
    open: showDeleteConfirm,
    onClose: () => !deleting && setShowDeleteConfirm(false),
    containerRef: deleteModalRef,
    preventEscape: deleting,
  })
  useModalA11y({
    open: showWelcomeSheet,
    onClose: () => setShowWelcomeSheet(false),
    containerRef: welcomeSheetRef,
  })

  // ?weight=open 자동 오픈, ?welcome=1 환영 시트 자동 오픈 + URL 정리.
  useEffect(() => {
    if (searchParams.get('weight') === 'open') {
      setShowWeightModal(true)
    }
    if (searchParams.get('welcome') === '1') {
      setShowWelcomeSheet(true)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('welcome')
        window.history.replaceState({}, '', url.toString())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      toast.error('저장하지 못했어요')
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
    setDog((prev) => ({ ...prev, weight: value }))
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

    const { data, error } = await supabase
      .from('dogs')
      .delete()
      .eq('id', dogId)
      .eq('user_id', user.id)
      .select('id')

    if (error) {
      toast.error('삭제하지 못했어요')
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
    <div className="pb-10">
      {/* Header */}
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/dogs"
          className="text-[10.5px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 강아지 목록
        </Link>
      </section>

      {/* Hero */}
      <section className="px-5 mt-4">
        <div className="bg-bg-3 rounded border border-rule px-6 py-8 text-center">
          <div className="relative w-24 h-24 bg-bg rounded-full overflow-hidden flex items-center justify-center mx-auto mb-4">
            {dog.photo_url ? (
              <Image
                src={dog.photo_url}
                alt={dog.name}
                fill
                sizes="96px"
                className="object-cover"
                priority
              />
            ) : (
              <DogIcon
                className="w-10 h-10 text-muted"
                strokeWidth={1.5}
              />
            )}
          </div>
          <span className="kicker mb-2 inline-block">Dog Profile</span>
          <h1 className="font-sans" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {dog.name}
          </h1>
          {dog.breed && (
            <p className="text-[12px] text-muted mt-1.5 truncate">{dog.breed}</p>
          )}
        </div>
      </section>

      {/* Info card */}
      <section className="px-5 mt-3">
        <div className="bg-bg-3 rounded border border-rule px-5 py-4">
          <InfoRow
            label="성별"
            value={dog.gender ? genderText[dog.gender] ?? '-' : '-'}
          />
          <InfoRow
            label="중성화"
            valueNode={
              dog.neutered === null ? (
                <span className="text-[13.5px] font-bold text-text">-</span>
              ) : dog.neutered ? (
                <span className="inline-flex items-center gap-1 text-[13.5px] font-bold text-moss">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  했어요
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[13.5px] font-bold text-muted">
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
                return <span className="text-[13.5px] font-bold text-text">-</span>
              const meta = activityMeta[dog.activity_level]
              if (!meta)
                return <span className="text-[13.5px] font-bold text-text">-</span>
              const { Icon, text } = meta
              return (
                <span className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-text">
                  <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={2} />
                  {text}
                </span>
              )
            })()}
          />
        </div>
      </section>

      {/* 현재 처방 카드 — dog_formulas 최신 cycle */}
      {currentFormula && (
        <CurrentFormulaCard
          formula={currentFormula}
          checkinStatus={checkinStatus}
          dogId={dogId}
        />
      )}

      {/* 진행중 정기배송 카드 */}
      <SubscriptionCard
        subscriptions={subscriptions}
        dogName={dog.name}
        dogId={dogId}
        hasFormula={!!currentFormula}
      />

      {/* 체중 추이 카드 */}
      <section className="px-5 mt-3">
        <div className="bg-bg-3 rounded border border-rule p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-moss" strokeWidth={2} />
              <span className="kicker">Weight Log</span>
            </div>
            <button
              onClick={() => setShowWeightModal(true)}
              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-terracotta hover:text-text transition"
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
              <p className="text-[10.5px] text-muted/70 mt-1">
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
                      <span className="text-muted text-[10.5px]">
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
                            className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold ${
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
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:px-6 z-50"
          onClick={closeWeightModal}
        >
          <div
            ref={weightModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="weight-modal-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-3 rounded-t-2xl sm:rounded border-t sm:border border-rule p-6 max-w-sm w-full shadow-xl"
          >
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-3.5 h-3.5 text-moss" strokeWidth={2} />
              <span className="kicker">New Weight Log</span>
            </div>
            <h3
              id="weight-modal-title"
              className="font-sans text-[18px] font-black text-text"
            >
              {dog.name}의 체중
            </h3>
            <p className="text-[10.5px] text-muted mt-1">
              기록하면 추이 차트와 대시보드에 반영돼요.
            </p>

            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-[10.5px] font-bold text-text mb-1.5">
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
                  inputMode="decimal"
                  enterKeyHint="next"
                  className="w-full px-4 py-3 rounded-lg border border-rule bg-[#FDFDFD] text-[#2A2118] text-sm focus:outline-none focus:border-terracotta transition"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-text mb-1.5">
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
                className="w-full py-3 rounded-full bg-ink text-bg text-[13.5px] font-bold active:scale-[0.98] transition disabled:opacity-50"
              >
                {savingWeight ? '저장 중...' : '저장하기'}
              </button>
              <button
                onClick={closeWeightModal}
                disabled={savingWeight}
                className="w-full py-3 rounded bg-bg-3 text-muted text-[13.5px] font-bold border border-rule hover:border-text hover:text-text transition"
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
          className="flex items-center gap-3 w-full px-5 py-4 bg-text text-white rounded active:scale-[0.99] transition"
        >
          <div className="w-9 h-9 rounded-full bg-bg-3/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[13.5px] font-black">맞춤 영양 분석 보기</div>
            <div className="text-[10.5px] text-white/60 mt-0.5">
              AI가 {dog.name}의 식단을 분석해요
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/survey`}
          className="flex items-center gap-3 w-full px-5 py-4 bg-terracotta text-white rounded active:scale-[0.99] transition"
        >
          <div className="w-9 h-9 rounded-full bg-bg-3/10 flex items-center justify-center">
            <ClipboardList className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[13.5px] font-black">설문 시작하기</div>
            <div className="text-[10.5px] text-white/70 mt-0.5">
              맞춤 식단 추천을 위한 5분 설문
            </div>
          </div>
        </Link>
      </section>

      {/* Tertiary: 분석 히스토리 + 건강 일지 */}
      <section className="px-5 mt-3 space-y-2">
        <Link
          href={`/dogs/${dog.id}/analyses`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <History className="w-4 h-4 text-moss" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              분석 히스토리
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              이전 분석 결과를 시간순으로 비교해보세요
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/health`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <Heart className="w-4 h-4 text-sale" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              건강 일지
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              변·활동량·기분·식욕을 매일 기록해요
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/reminders`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <Bell className="w-4 h-4 text-terracotta" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              리마인더
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              예방접종·투약·검진 일정을 관리해요
            </div>
          </div>
        </Link>
        {/* R14 B8-B11 — 새 feature 페이지 4개 navigation. */}
        <Link
          href={`/dogs/${dog.id}/milestones`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <History className="w-4 h-4 text-gold" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              마일스톤
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              함께한 시간의 기념일을 한눈에 봐요
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/vaccinations`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <Heart className="w-4 h-4 text-terracotta" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              예방접종 기록
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              접종 일정과 다음 일정을 관리해요
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/medications`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <Bell className="w-4 h-4 text-sale" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              복약 관리
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              약물·영양제 복용 시간과 알림
            </div>
          </div>
        </Link>
        <Link
          href={`/dogs/${dog.id}/expenses`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <History className="w-4 h-4 text-moss" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              지출 트래커
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              사료·병원·간식 비용을 한 곳에서
            </div>
          </div>
        </Link>
        {/* XL-2 (#14) — 수의사 진료 보조 보고서 (모듈 H). */}
        <Link
          href={`/dogs/${dog.id}/vet-report`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-ink" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              수의사 보고서
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              병원 갈 때 인쇄해서 가져가는 진료 요약
            </div>
          </div>
        </Link>
        {/* XL-3 (#12) — 30일 식단 시뮬레이션 (모듈 F). */}
        <Link
          href={`/dogs/${dog.id}/simulate`}
          className="flex items-center gap-3 w-full px-5 py-3.5 bg-bg-3 rounded border border-rule hover:border-text transition"
        >
          <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-moss" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-[12px] font-black text-text">
              식단 시뮬레이션
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              다른 식단·운동의 30일 후 변화 예상
            </div>
          </div>
        </Link>
      </section>

      {/* Phase D7.3 — 가족 멤버 + 초대. */}
      <section className="px-5 mt-3">
        <DogFamilyMembers
          dogId={dog.id}
          isOwner={true}
          ownerName={ownerName}
        />
      </section>

      {/* Phase D8.2 — 수의사 read-only 공유 토큰. */}
      <section className="px-5 mt-3">
        <VetShareButton dogId={dog.id} dogName={dog.name} />
      </section>

      {/* Phase P5 — 친구 사진 부탁 링크. */}
      <section className="px-5 mt-3">
        <PhotoRequestButton dogId={dog.id} dogName={dog.name} />
      </section>

      {/* Secondary actions */}
      <section className="px-5 mt-3 grid grid-cols-2 gap-2.5">
        <Link
          href={`/dogs/${dog.id}/edit`}
          className="flex items-center justify-center gap-1.5 py-3 bg-bg-3 text-text rounded border border-rule hover:border-text text-[12px] font-bold transition"
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
          정보 수정
        </Link>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center justify-center gap-1.5 py-3 bg-bg-3 text-sale rounded border border-rule hover:border-sale text-[12px] font-bold transition"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          삭제
        </button>
      </section>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center px-6 z-50"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            ref={deleteModalRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-desc"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-3 rounded border border-rule p-6 max-w-sm w-full shadow-xl"
          >
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-[#FFF5F3] flex items-center justify-center">
                <AlertTriangle
                  className="w-6 h-6 text-sale"
                  strokeWidth={2}
                />
              </div>
            </div>
            <h3
              id="delete-modal-title"
              className="font-sans text-[18px] font-black text-text text-center mb-2"
            >
              정말 삭제할까요?
            </h3>
            <p
              id="delete-modal-desc"
              className="text-[12px] text-muted text-center mb-6 leading-relaxed"
            >
              {dog.name}의 모든 정보가 삭제돼요.
              <br />
              이 작업은 되돌릴 수 없어요.
              {subscriptions.length > 0 && (
                <>
                  <br />
                  <br />
                  <span className="text-terracotta font-bold">
                    ⚠ 진행중인 정기배송 {subscriptions.length}건은 자동으로
                    해지되지 않아요. 마이페이지에서 먼저 해지해 주세요.
                  </span>
                </>
              )}
            </p>
            <div className="space-y-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-3 rounded bg-sale text-white text-[13.5px] font-black active:scale-[0.98] transition disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '네, 삭제할래요'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="w-full py-3 rounded bg-bg-3 text-muted text-[13.5px] font-bold border border-rule hover:border-text hover:text-text transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome sheet — 강아지 등록 직후 환영 + 설문 유도 (?welcome=1) */}
      {showWelcomeSheet && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:px-6 z-50"
          onClick={() => setShowWelcomeSheet(false)}
        >
          <div
            ref={welcomeSheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-sheet-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-3 rounded-t-2xl sm:rounded border-t sm:border border-rule p-6 max-w-sm w-full shadow-xl"
          >
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-bg flex items-center justify-center">
                <PartyPopper
                  className="w-7 h-7 text-terracotta"
                  strokeWidth={1.8}
                />
              </div>
            </div>
            <div className="text-center mb-1">
              <span className="kicker">Welcome</span>
            </div>
            <h3
              id="welcome-sheet-title"
              className="font-sans text-[20px] font-black text-text text-center"
            >
              {dog.name} 등록 완료!
            </h3>
            <p className="text-[12px] text-muted text-center mt-2 leading-relaxed">
              이제 {dog.name}의 식습관·건강·취향을 5분 동안
              <br />
              알려주시면 맞춤 식단을 추천해 드려요.
            </p>

            <div className="mt-5 rounded bg-bg p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <Sparkles
                  className="w-3.5 h-3.5 text-terracotta mt-0.5 shrink-0"
                  strokeWidth={2.2}
                />
                <p className="text-[10.5px] text-text leading-relaxed">
                  AI가 NRC 2006 / FEDIAF 기준으로 일일 칼로리·영양소를 계산해요
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Sparkles
                  className="w-3.5 h-3.5 text-terracotta mt-0.5 shrink-0"
                  strokeWidth={2.2}
                />
                <p className="text-[10.5px] text-text leading-relaxed">
                  알레르기·만성질환·기호도까지 반영한 1:1 처방
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Sparkles
                  className="w-3.5 h-3.5 text-terracotta mt-0.5 shrink-0"
                  strokeWidth={2.2}
                />
                <p className="text-[10.5px] text-text leading-relaxed">
                  설문은 언제든 다시 할 수 있어요
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={() => {
                  setShowWelcomeSheet(false)
                  router.push(`/dogs/${dog.id}/survey`)
                }}
                className="flex items-center justify-center gap-1.5 w-full py-3.5 rounded-full bg-terracotta text-white text-[13.5px] font-black active:scale-[0.98] transition"
              >
                <ClipboardList className="w-4 h-4" strokeWidth={2.2} />5분 맞춤
                설문 시작하기
              </button>
              <button
                onClick={() => setShowWelcomeSheet(false)}
                className="w-full py-3 rounded bg-bg-3 text-muted text-[12px] font-bold border border-rule hover:border-text hover:text-text transition"
              >
                먼저 둘러볼게요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
    // UI audit A-3: dt 라벨 column min-w-[88px] 통일 + tracking 0.22 → 0.18 (한국어 가독성)
    <div className="flex justify-between items-center py-2.5 border-b border-bg last:border-0 gap-3">
      <span className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.18em] min-w-[88px] shrink-0">
        {label}
      </span>
      {valueNode ?? (
        <span className="text-[13.5px] font-bold text-text text-right">{value}</span>
      )}
    </div>
  )
}
