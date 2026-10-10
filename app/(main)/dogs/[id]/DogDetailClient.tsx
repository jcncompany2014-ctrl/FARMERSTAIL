'use client'

// audit #101 — DogDetailClient: interactive 부분만 client.
// page.tsx (server) 가 auth/dog/formula/logs/subs/checkins prefetch + redirect.
// 여기엔 weight modal, delete modal, welcome sheet, 가족/공유/사진 요청 같은
// useState/onClick/useEffect 만 남김.
// 2026-10-09 앱 새 디자인('A 포스터', 시안 AppDog·D12 등록 환영 창·D20 체중 기록 창·D21 삭제 확인):
//   옅은 주황 머리 띠(사진 96 · 이름 제목 글꼴 40 · 수정 칸) → 정보 칸 3열(#FFF7EA) → 보호자님께 → 맞춤 식단
//   → 정기배송(핵심 카드 — 파우치 색 + 도장 그림자) → 체중 기록(먹색 선 그래프 · 숫자 목록) → 더 보기 목록
//   → 정보 수정·삭제. 저장·삭제·환영 로직은 그대로다 — 겉모습만 바꿨다.
import { useEffect, useState, useRef } from 'react'
import type { TrialState } from '@/lib/payments/trial'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { petName, formatKg, kgNumber } from '@/lib/korean'
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
import InsightNote from './_components/InsightNote'
import type { DogInsight } from '@/lib/dog-insight'
import CurrentFormulaCard from './_components/CurrentFormulaCard'
import SubscriptionCard from './_components/SubscriptionCard'
import PhotoRequestButton from '@/components/PhotoRequestButton'
import AiCommentCard from '@/components/v3/AiCommentCard'
import GracePeriodBanner from '@/components/dashboard/GracePeriodBanner'
import type { OnboardingPhase } from '@/lib/onboarding/grace-period'
import type { AiAnalysisJson } from '@/lib/nutrition/ai-prompt'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'
import { V3, V3Radius } from '@/lib/design/tokens'
import {
  CheckIcon,
  ClipboardIcon,
  PawFillIcon,
  PencilIcon,
  ScaleIcon,
  WarningIcon,
  XIcon,
} from '@/components/v3/dog/DogIcons'
import {
  CENTER_PANEL,
  CENTER_SCRIM,
  Field,
  Grabber,
  SHEET_PANEL,
  SHEET_SCRIM,
  TextField,
  UnitText,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '@/components/v3/dog/DogFormParts'

type Props = {
  dog: Dog
  initialWeightLogs: WeightLog[]
  currentFormula: CurrentFormula | null
  checkinStatus: CheckinStatus
  subscriptions: ActiveSubscription[]
  /** 구독 조회 실패 — true 면 카드를 아예 안 그린다(틀린 CTA 방지). */
  subsQueryFailed?: boolean
  /** 개요 인사이트 멘트 — server 에서 체중 기록으로 산출(lib/dog-insight). */
  insight: DogInsight
  /**
   * 개요 AI 코멘트 게이트(server 판정). null 이면 안 뜬다 —
   * 첫 설문 전이거나 현재 구독 중이 아닌 강아지. [[project-ai-comment-cost]]
   */
  aiComment: { analysisId: string; cached: AiAnalysisJson | null } | null
  /** 체험단 가격표 — SubscriptionCard 금액 표시용 (청구와 같은 판정) */
  trial?: TrialState | null
  /** 구독별 다음 결제액 — 서버가 청구와 같은 함수로 계산 */
  chargePreview?: Record<string, number>
  /** 첫 4주 온보딩 여정 phase(유저 가입일 기준). 개요 최상단 배너용. */
  gracePhase: OnboardingPhase
  /** 점검 화면(/design-check/dogs) 전용 — 삭제 확인 창을 연 채로 시작. 실제 화면은 넘기지 않는다. */
  previewDeleteConfirm?: boolean
}

/** 제목 글꼴이 아닌 굵은 제목(창 제목) — 앱 틀의 h2 규칙(제목 글꼴)을 본문 글꼴로 되돌린다(시안 D21 21px 800). */
const PLAIN_TITLE = { fontFamily: 'inherit', fontWeight: 800, letterSpacing: '-0.02em' } as const

export default function DogDetailClient({
  dog: initialDog,
  initialWeightLogs,
  currentFormula,
  checkinStatus,
  subscriptions,
  subsQueryFailed,
  insight,
  aiComment,
  gracePhase,
  trial = null,
  chargePreview,
  previewDeleteConfirm = false,
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(previewDeleteConfirm)

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
    // 새 기록 기준으로 인사이트 멘트·개입 윈도우를 다시 계산시킨다(server).
    // 목록/스파크라인은 위 setState 로 이미 즉시 반영 — refresh 는 뒤따라온다.
    router.refresh()
  }

  /**
   * 진행 중(active·paused) 정기배송이 있나. 서버 조회가 그 두 상태만 가져오므로
   * 길이만 보면 된다 — DB 트리거(20260730000400)의 판정 집합과 **같다**.
   */
  // ★조회 실패면 "구독 있음"으로 가정한다 (2026-08-08 재검증 2차 #7).
  //  빈 배열을 그대로 믿으면 구독자에게 삭제 확인 버튼이 열린다 — DB 트리거
  //  (FT100)가 최종 거부하긴 하지만, 열리면 안 되는 문이 열리는 화면이다.
  const hasLiveSub = subsQueryFailed ? true : subscriptions.length > 0

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
      // FT100 = 진행 중 정기배송이 있어 DB 트리거가 거부한 것(20260730000400).
      // 화면이 이미 막지만, 다른 기기에서 방금 구독을 만든 경우 목록이 낡아
      // 여기까지 올 수 있다. DB 원문 대신 무엇을 해야 하는지 알려준다.
      // FT101 = 해지는 했지만 이미 결제된 이번 박스가 준비 중(20260926130000) — 지우면 그 박스의 처방이
      // 사라져 빈 팩으로 나간다. 박스가 출발한 뒤에 지우게 안내한다(2026-09-26 점검 8차).
      if ((error as { code?: string }).code === 'FT101') {
        toast.error('이미 결제된 박스가 준비 중이라 지금은 지울 수 없어요. 박스가 출발한 뒤에 지워 주세요.')
        setShowDeleteConfirm(false)
        setDeleting(false)
        return
      }
      if ((error as { code?: string }).code === 'FT100') {
        toast.error(
          '정기배송이 진행 중이라 지울 수 없어요. 정기배송을 먼저 정리해 주세요.',
        )
        setShowDeleteConfirm(false)
        router.push(`/dogs/${dogId}/subscription`)
        setDeleting(false)
        return
      }
      toast.error('삭제하지 못했어요')
      setDeleting(false)
      return
    }

    if (!data || data.length === 0) {
      toast.error('삭제 권한이 없어요. 이 강아지는 다른 계정에 속해 있어요')
      setDeleting(false)
      setShowDeleteConfirm(false)
      return
    }

    // ★지운 강아지의 사진도 파기한다(2026-09-26) — 예전엔 DB 행만 지워 일기·체크인·진료기록·
    //   프로필 사진이 탈퇴 때까지 남았다. 서버가 '정말 지워졌는지' 확인한 뒤 본인 폴더만 지운다.
    void fetch(`/api/dogs/${dogId}/purge-photos`, { method: 'POST', keepalive: true }).catch(() => {
      /* 파기 실패는 서버가 Sentry 로 남긴다 — 화면 흐름은 막지 않는다 */
    })

    router.push('/dogs')
    router.refresh()
  }

  const activityText: Record<string, string> = {
    low: '낮음',
    medium: '보통',
    high: '활동적',
  }
  const genderText: Record<string, string> = {
    male: '남아',
    female: '여아',
  }

  const infoItems: Array<{ label: string; value: React.ReactNode }> = [
    { label: '성별', value: dog.gender ? genderText[dog.gender] ?? '-' : '-' },
    {
      label: '나이',
      value: dog.age_value ? `${dog.age_value}${dog.age_unit === 'years' ? '살' : '개월'}` : '-',
    },
    { label: '체중', value: dog.weight ? formatKg(dog.weight) : '-' },
    {
      label: '중성화',
      value:
        dog.neutered === null ? (
          '-'
        ) : dog.neutered ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckIcon size={16} strokeWidth={3} />
            했어요
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <XIcon size={14} strokeWidth={3} />안 했어요
          </span>
        ),
    },
    {
      label: '활동량',
      value: dog.activity_level ? activityText[dog.activity_level] ?? '-' : '-',
    },
  ]

  const moreLinks: Array<{ href: string; title: string; sub?: string }> = [
    {
      href: `/dogs/${dog.id}/analysis`,
      title: '설문 결과 · 맞춤 영양 분석',
      sub: `설문을 바탕으로 ${petName(dog.name)}의 식단을 분석해요`,
    },
    { href: `/dogs/${dog.id}/analyses`, title: '분석 히스토리' },
    // 복약·예방접종·리마인더 3개 링크를 '건강 관리' 하나로 통합(2026-07-16).
    { href: `/dogs/${dog.id}/health-care`, title: '건강 관리', sub: '복약·예방접종·리마인더를 한곳에서' },
    // XL-2 (#14) — 수의사 진료 보조 (모듈 H). 인쇄 리포트 + 링크 공유를
    // 이 한 페이지 안에서 모두 처리 → 개요의 중복 '수의사 공유' 버튼은 제거.
    { href: `/dogs/${dog.id}/vet-report`, title: '수의사에게 보여주기' },
  ]

  return (
    // 줄 높이 normal — 시안은 줄 높이를 안 준 글자가 글꼴 기본값이다(앱 전역 1.5 로 두면 칸마다 커진다).
    <div style={{ paddingBottom: 28, lineHeight: 'normal' }}>
      {/* 머리 띠 — 사진 · 이름 · 견종 · 정보 수정(연필). 정보 수정 진입점은 여기와 맨 아래 두 곳
          (사장님 2026-07-16: 프로필 카드 모서리 연필 + 혹시 모르니 삭제 옆에 하나 더). */}
      <section
        style={{
          padding: '22px 20px',
          display: 'grid',
          gridTemplateColumns: '96px 1fr 44px',
          columnGap: 16,
          alignItems: 'center',
          background: V3.cream,
          color: V3.ink,
        }}
      >
        <span
          style={{
            position: 'relative',
            width: 96,
            height: 96,
            borderRadius: 48,
            overflow: 'hidden',
            boxSizing: 'border-box',
            border: dog.photo_url ? '3px solid #FFFFFF' : 0,
            background: V3.soft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {dog.photo_url ? (
            <Image src={dog.photo_url} alt={`${dog.name} 사진`} fill sizes="96px" className="object-cover" priority />
          ) : (
            <PawFillIcon size={42} color="#9A9A9A" />
          )}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>우리 아이</span>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
            {dog.name}
          </h1>
          {dog.breed && (
            <span className="ft-clamp-1" style={{ fontSize: 16, color: V3.inkSoft }}>
              {dog.breed}
            </span>
          )}
        </span>
        {/* 44px — 이 화면의 정보 수정 진입점(2026-08-07 감사: 누를 면적은 44 이상). */}
        <Link
          href={`/dogs/${dog.id}/edit`}
          aria-label={`${petName(dog.name)} 정보 수정`}
          style={{
            alignSelf: 'flex-start',
            width: 44,
            height: 44,
            boxSizing: 'border-box',
            border: '1.5px solid rgba(20, 20, 20, 0.3)',
            borderRadius: V3Radius.sm,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: V3.ink,
          }}
        >
          <PencilIcon size={20} />
        </Link>
      </section>

      {/* 첫 4주 온보딩 여정 — 홈에서 개요 최상단으로 이동(2026-07-24 사장님).
          주차별 안내(1주 천천히→2주 체크인→3주 체중→4주 축하), 29일+ 자동 졸업. */}
      <GracePeriodBanner
        phase={gracePhase}
        dogName={petName(dog.name)}
        dogId={dog.id}
        // 3주차 "체중 기록하기" — 이 페이지 안의 카드라 링크(/dogs/{id})는 자기 자신이었다.
        // 그 자리에서 체중 입력 모달을 연다(사장님 제보 2026-09-23, 규칙87).
        onAction={(a) => {
          if (a === 'weight') setShowWeightModal(true)
        }}
      />

      {/* 정보 칸 — 3열(옅은 주황 #FFF7EA). */}
      <dl
        style={{
          margin: '20px 20px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 6,
        }}
      >
        {infoItems.map((it) => (
          <div
            key={it.label}
            style={{
              padding: 12,
              background: V3.creamSoft,
              borderRadius: V3Radius.sm,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              minWidth: 0,
            }}
          >
            <dt style={{ fontSize: 13, color: V3.inkMute }}>{it.label}</dt>
            <dd style={{ margin: 0, fontSize: 17, fontWeight: 800, color: V3.ink, whiteSpace: 'nowrap' }}>{it.value}</dd>
          </div>
        ))}
      </dl>

      {/* 보호자님께 한마디 — 정보 칸 바로 아래(사장님 2026-07-16).
          server 가 게이트: 첫 설문 전이면 aiComment=null → 안 뜬다.
          ★revalidate 제거(2026-07-16): 개요 방문마다 재요청하면 신뢰가 깨진다는 사장님
          피드백. 코멘트는 한 번 생성되면 **고정** — 캐시가 있으면 그대로 보여주고 다시
          부르지 않는다(cached 없을 때만 최초 1회 생성). 재설문해야 새 코멘트가 나온다. */}
      {aiComment && (
        <AiCommentCard
          analysisId={aiComment.analysisId}
          dogName={dog.name}
          cached={aiComment.cached}
        />
      )}

      {/* 맞춤 영양 처방 카드 — dog_formulas 최신 cycle(추천). 실제 박스는 구독 카드에. */}
      {currentFormula && (
        <CurrentFormulaCard
          formula={currentFormula}
          checkinStatus={checkinStatus}
          dogId={dogId}
        />
      )}

      {/* 진행중 정기배송 카드 — 조회가 실패했으면 그리지 않는다(2026-08-08).
          빈 배열로 그리면 구독자에게 '정기배송 시작' CTA 가 뜬다. */}
      {!subsQueryFailed && (
      <SubscriptionCard
        trial={trial}
        chargePreview={chargePreview}
        subscriptions={subscriptions}
        dogName={dog.name}
        dogId={dogId}
        hasFormula={!!currentFormula}
      />
      )}

      {/* 체중 기록 — 제목 + '+ 기록 추가' · 먹색 선 그래프 · 최근 3개 · 인사이트 한 줄. */}
      <section
        aria-labelledby="dog-weight-title"
        style={{ margin: '26px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h2 id="dog-weight-title" style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>
            체중 기록
          </h2>
          <button
            type="button"
            onClick={() => setShowWeightModal(true)}
            style={{
              height: 40,
              padding: '0 12px',
              boxSizing: 'border-box',
              borderRadius: V3Radius.sm,
              border: `1.5px solid ${V3.ink}`,
              background: '#FFFFFF',
              color: V3.ink,
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            + 기록 추가
          </button>
        </div>

        {weightLogs.length > 0 && (
          <>
            <WeightSparkline logs={weightLogs} />

            {/* 최근 3개 */}
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: `1.5px solid ${V3.ink}` }}>
              {weightLogs.slice(0, 3).map((log, idx) => {
                const next = weightLogs[idx + 1]
                const delta = next ? log.weight - next.weight : 0
                const flat = !next || Math.abs(delta) < 0.05
                return (
                  <li
                    key={log.id}
                    style={{
                      minHeight: 52,
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 72px',
                      columnGap: 12,
                      alignItems: 'center',
                      borderBottom: `1px solid ${V3.rule}`,
                    }}
                  >
                    <span style={{ fontSize: 15, color: V3.inkMute }}>
                      {new Date(log.measured_at).toLocaleDateString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <span className="ft-num" style={{ fontSize: 22 }}>
                        {kgNumber(log.weight)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}> kg</span>
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontSize: 14,
                        fontWeight: flat ? 400 : 700,
                        color: flat ? V3.inkMute : V3.ink,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {flat ? '—' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}kg`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {/* 인사이트 멘트 — 위 숫자에서 읽어낸 결론 한 줄. 기록이 없을 때는
            이 멘트가 곧 빈 상태 안내(기록을 권하는 문구)라 따로 두지 않는다. */}
        <InsightNote insight={insight} />
      </section>

      {/* 더 보기 — 분석·히스토리·건강 관리·수의사 보고서. */}
      <nav
        aria-label="더 보기"
        style={{ margin: '28px 20px 0', borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}
      >
        {moreLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              minHeight: l.sub ? 72 : 64,
              borderBottom: `1px solid ${V3.rule}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              color: V3.ink,
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>{l.title}</span>
              {l.sub && <span style={{ fontSize: 14, color: V3.inkMute }}>{l.sub}</span>}
            </span>
            {/* 시안: 설명이 있는 줄은 꺾쇠가 보통 굵기, 제목만 있는 줄은 굵게. */}
            <span aria-hidden style={{ fontSize: l.sub ? 16 : 17, fontWeight: l.sub ? 400 : 800 }}>
              ›
            </span>
          </Link>
        ))}
      </nav>

      {/* 가족 초대(DogFamilyMembers)·수의사 공유(VetShareButton)는 2026-07-16 개요에서
          제거. 초대는 수락 후 열람 경로가 아직 없어 사장님이 UI 숨김 결정. 공유는
          위 '수의사에게 보여주기'(vet-report)가 링크 공유까지 포함해 중복이었음. */}

      {/* Phase P5 — 친구 사진 부탁 링크(배포 스위치가 꺼져 있으면 자리도 비우지 않는다). */}
      {isAdvancedUiEnabled('photo_request') && (
        <section style={{ margin: '12px 20px 0' }}>
          <PhotoRequestButton dogId={dog.id} dogName={dog.name} />
        </section>
      )}

      {/* 정보 수정 + 삭제 — 수정하기는 머리 띠 연필과 함께 여기 하단에도 둔다
          (사장님 2026-07-16: 혹시 모르니 삭제 옆에 하나 더). */}
      <div style={{ margin: '22px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Link href={`/dogs/${dog.id}/edit`} style={secondaryButtonStyle(52)}>
          정보 수정
        </Link>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            height: 52,
            boxSizing: 'border-box',
            borderRadius: V3Radius.sm,
            border: `1.5px solid ${V3.rule}`,
            background: '#FFFFFF',
            color: V3.inkMute,
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          삭제
        </button>
      </div>

      {/* 체중 기록 창 (시안 D20) */}
      {showWeightModal && (
        <div style={SHEET_SCRIM} onClick={closeWeightModal}>
          <div
            ref={weightModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="weight-modal-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={SHEET_PANEL}
          >
            <Grabber />
            <span
              style={{
                marginTop: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                fontWeight: 800,
                color: V3.inkMute,
              }}
            >
              <ScaleIcon size={16} />
              새 체중 기록
            </span>
            <h2 id="weight-modal-title" style={{ margin: '8px 0 0', fontSize: 28, lineHeight: 1.15 }}>
              {petName(dog.name)}의 체중
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 16, lineHeight: 1.5, color: V3.inkSoft }}>
              기록하면 체중 그래프와 홈 화면에 반영돼요.
            </p>

            <Field
              label="체중"
              style={{ marginTop: 20 }}
              help={dog.weight ? `이전 기록 ${formatKg(dog.weight)}` : undefined}
            >
              <TextField
                type="number"
                onWheel={(e) => e.currentTarget.blur()}
                step="0.1"
                min="0.1"
                max="100"
                autoFocus
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="예: 5.4"
                inputMode="decimal"
                enterKeyHint="next"
                height={64}
                fontSize={30}
                padX={16}
                className="ft-num"
                borderWidth={2}
                trailing={<UnitText size={17} weight={800}>kg</UnitText>}
              />
            </Field>
            <Field label="메모" hint="(선택)" style={{ marginTop: 16 }}>
              <TextField
                type="text"
                value={newWeightNote}
                onChange={(e) => setNewWeightNote(e.target.value)}
                placeholder="병원 검진, 사료 변경 등"
                maxLength={80}
                height={54}
              />
            </Field>

            <button
              type="button"
              onClick={handleSaveWeight}
              disabled={savingWeight || !newWeight}
              aria-busy={savingWeight || undefined}
              style={{ ...primaryButtonStyle(58, savingWeight || !newWeight), marginTop: 22 }}
            >
              {savingWeight ? '저장 중...' : '저장하기'}
            </button>
            <button
              type="button"
              onClick={closeWeightModal}
              disabled={savingWeight}
              style={{ ...secondaryButtonStyle(54), marginTop: 8 }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 (시안 D21) */}
      {showDeleteConfirm && (
        <div style={CENTER_SCRIM} onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div
            ref={deleteModalRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-desc"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={CENTER_PANEL}
          >
            <span
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: V3.soft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: V3.sale,
              }}
            >
              <WarningIcon size={28} />
            </span>
            <h2 id="delete-modal-title" style={{ ...PLAIN_TITLE, margin: '16px 0 0', fontSize: 21, lineHeight: 1.35 }}>
              정말 삭제할까요?
            </h2>
            <p
              id="delete-modal-desc"
              style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}
            >
              {/* ★ 예전엔 여기서 "자동으로 해지되지 않아요" 라고 **경고만 하고**
                  아래 버튼으로 그대로 삭제가 됐다. 그러면 구독은 dog_id 만 NULL 이
                  된 채 살아남아(FK SET NULL) 계속 청구되는데 강아지도 처방도 없어
                  담을 게 없다 — **돈은 나가고 박스는 안 온다.**
                  이제 DB 트리거가 거부하므로(20260730000400) 화면도 같은 판정을
                  해서 누를 수 없게 하고, 갈 곳을 알려준다. 조회 집합도 트리거와
                  같다(active·paused). */}
              {hasLiveSub ? (
                <>
                  {petName(dog.name)}의 정기배송이 아직 진행 중이에요.
                  <br />
                  먼저 정기배송을 정리하면 삭제할 수 있어요.
                </>
              ) : (
                <>
                  {petName(dog.name)}의 모든 정보가 삭제돼요.
                  <br />
                  이 작업은 되돌릴 수 없어요.
                </>
              )}
            </p>
            {hasLiveSub ? (
              <Link
                href={`/dogs/${dog.id}/subscription`}
                style={{ ...primaryButtonStyle(58), marginTop: 22, alignSelf: 'stretch' }}
              >
                정기배송 보러가기
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-busy={deleting || undefined}
                style={{
                  ...primaryButtonStyle(58),
                  marginTop: 22,
                  alignSelf: 'stretch',
                  background: V3.sale,
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? '삭제 중...' : '네, 삭제할래요'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              style={{ ...secondaryButtonStyle(54), marginTop: 8, alignSelf: 'stretch' }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 등록 환영 창 — 강아지 등록 직후 환영 + 설문 유도 (?welcome=1, 시안 D12) */}
      {showWelcomeSheet && (
        <div style={SHEET_SCRIM} onClick={() => setShowWelcomeSheet(false)}>
          <div
            ref={welcomeSheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-sheet-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={SHEET_PANEL}
          >
            <Grabber />
            <span style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800 }}>
              <span aria-hidden style={{ width: 8, height: 8, background: V3.mustard }} />
              환영해요
            </span>
            <h2 id="welcome-sheet-title" style={{ margin: '10px 0 0', fontSize: 32, lineHeight: 1.15, wordBreak: 'keep-all' }}>
              {dog.name} 등록 완료!
            </h2>
            <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
              이제 {petName(dog.name)}의 식습관·건강·취향을 5분 동안 알려주시면 맞춤 식단을 추천해 드려요.
            </p>

            {/* 문구(사장님 결정 목록): 'AI가 NRC / FEDIAF 기준으로' → 전문용어 없이 '국제 기준',
                '설문은 언제든 다시' → 실제로 월 횟수 한도가 있어 '나중에 다시'. */}
            <div
              style={{
                marginTop: 18,
                padding: '14px 16px',
                borderRadius: V3Radius.sm,
                background: V3.soft,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {[
                '하루 열량과 영양을 국제 기준에 맞춰 계산해요',
                '알레르기·만성질환·기호도까지 반영한 1:1 맞춤 설계',
                '설문은 나중에 다시 할 수 있어요',
              ].map((t) => (
                <span key={t} style={{ display: 'flex', gap: 10, fontSize: 16, lineHeight: 1.5 }}>
                  <CheckIcon size={18} strokeWidth={2.8} style={{ marginTop: 3 }} />
                  {t}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowWelcomeSheet(false)
                router.push(`/dogs/${dog.id}/survey`)
              }}
              style={{ ...primaryButtonStyle(60), marginTop: 22 }}
            >
              <ClipboardIcon size={20} />
              5분 맞춤 설문 시작하기
            </button>
            <button
              type="button"
              onClick={() => setShowWelcomeSheet(false)}
              style={{ ...secondaryButtonStyle(54), marginTop: 8 }}
            >
              먼저 둘러볼게요
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
