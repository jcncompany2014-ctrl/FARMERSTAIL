'use client'

/**
 * PawFab — 앱 전역 "빠른 기입" (사장님 스케치 기준).
 *   닫힘: 우하단 작은 원형 FAB(발자국 아이콘)
 *   열림: 큰 원형 발바닥이 우하단 모서리에 박히고(코너 채움), 그 둘레를 따라
 *         발가락 버튼 4개(건강·체중·일기·사진)가 호를 그리며 펼쳐진다.
 *         좌하단(바닥변) → 우상단(오른변) 순서.
 *
 * **앱(PWA) 전용** — AppChrome 안에서만 마운트. 강아지 없음/몰입화면 hidden.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Scale, Pencil, Camera } from 'lucide-react'
import { V3 } from '@/lib/design/tokens'
import DogPawMark from '@/components/DogPawMark'
import QuickHealthSheet from '@/components/v3/sheet/QuickHealthSheet'
import QuickWeightSheet from '@/components/v3/sheet/QuickWeightSheet'
import QuickMemoSheet from '@/components/v3/sheet/QuickMemoSheet'
import QuickPhotoSheet from '@/components/v3/sheet/QuickPhotoSheet'

interface PawFabProps {
  /** 라우팅 기준 활성 강아지. null 이면 렌더 안 함. */
  activeDogId: string | null
  /** 몰입 화면(설문/체크인 등)에서 숨김. */
  hidden?: boolean
}

interface Toe {
  key: string
  label: string
  Icon: typeof Scale
  href: (id: string) => string
  /** 우하단 코너 기준 발가락 중심의 오른쪽/아래 거리(px). */
  r: number
  b: number
  delay: number
}

// 발바닥 중심(우24·하24)에서 같은 반지름 R=162 + 등각(26°)으로 90° 사분원 꽉
// 채움: y축(세로/오른변, φ96) → x축(가로/아래변, φ174). 간격·반지름 모두 일정.
const TOES: Toe[] = [
  { key: 'health', label: '건강', Icon: Activity, href: (id) => `/dogs/${id}/health`, r: 41, b: 185, delay: 0 },
  { key: 'weight', label: '체중', Icon: Scale, href: (id) => `/dogs/${id}?weight=open`, r: 110, b: 161, delay: 45 },
  { key: 'diary', label: '일기', Icon: Pencil, href: (id) => `/dogs/${id}/diary`, r: 161, b: 110, delay: 90 },
  { key: 'photo', label: '사진', Icon: Camera, href: (id) => `/dogs/${id}/diary`, r: 185, b: 41, delay: 135 },
]

const FAB = 56 // 닫힘 지름
const TOE = 58 // 발가락 지름
const EDGE = 18 // 닫힘 가장자리 여백
const COL = EDGE + FAB / 2 // = 46, 발가락 collapse 원점(닫힘 FAB 중심)
const PAD = 244 // 발바닥 원 지름
const PAD_RIGHT = 24 - PAD / 2 // = -98 (중심 right-dist 24 → 코너 살짝 안쪽, 코너 채움)
const PAD_BOTTOM = 24 - PAD / 2 // = -98 (중심 bottom-dist 24)

export default function PawFab({ activeDogId, hidden }: PawFabProps) {
  const [open, setOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [weightOpen, setWeightOpen] = useState(false)
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const router = useRouter()
  const firstRef = useRef<HTMLButtonElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  // Escape 로 닫기 + 열릴 때 첫 액션에 포커스.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        // 키보드 사용자가 트리거(닫힘 FAB)로 복귀하도록 포커스 되돌림.
        fabRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    firstRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!activeDogId || hidden) return null

  return (
    <>
      {/* backdrop — 밝은 스크림. 탭하면 닫힘. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(247,245,240,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 220ms ease',
        }}
      />

      {/* 우하단 코너 앵커 */}
      <div
        className="fixed z-50"
        style={{
          right: 'env(safe-area-inset-right)',
          bottom: 'env(safe-area-inset-bottom)',
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      >
        {/* 발바닥 — 큰 ink 원. 중심이 모서리 살짝 안쪽이라 코너가 원 내부 → 빈틈 없음.
            우/하단은 화면 밖으로 잘림. 탭하면 닫힘. */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="빠른 기입 닫기"
          tabIndex={open ? 0 : -1}
          className="absolute ft-no-press"
          style={{
            right: PAD_RIGHT,
            bottom: PAD_BOTTOM,
            width: PAD,
            height: PAD,
            borderRadius: 999,
            background: V3.accentDeep,
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            boxShadow: '0 10px 26px rgba(22,20,15,0.34)',
            opacity: open ? 1 : 0,
            transform: open ? 'scale(1)' : 'scale(0.4)',
            transformOrigin: 'bottom right',
            pointerEvents: open ? 'auto' : 'none',
            transition:
              'opacity 240ms ease, transform 340ms cubic-bezier(0.34,1.45,0.64,1)',
          }}
        />

        {/* 발가락 4개 = 액션 버튼. 발바닥 둘레 호를 따라 배치, 닫힘엔 FAB 로 collapse. */}
        {TOES.map((t, i) => {
          const Icon = t.Icon
          return (
            <button
              key={t.key}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              onClick={() => {
                setOpen(false)
                if (t.key === 'health') setHealthOpen(true)
                else if (t.key === 'weight') setWeightOpen(true)
                else if (t.key === 'diary') setDiaryOpen(true)
                else if (t.key === 'photo') setPhotoOpen(true)
                else router.push(t.href(activeDogId))
              }}
              aria-label={`${t.label} 기록`}
              tabIndex={open ? 0 : -1}
              className="absolute flex items-center justify-center ft-no-press"
              style={{
                right: t.r - TOE / 2,
                bottom: t.b - TOE / 2,
                width: TOE,
                height: TOE,
                borderRadius: 999,
                background: V3.accentDeep,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(22,20,15,0.28)',
                transform: open
                  ? 'translate(0,0) scale(1)'
                  : `translate(${t.r - COL}px, ${t.b - COL}px) scale(0.2)`,
                opacity: open ? 1 : 0,
                pointerEvents: open ? 'auto' : 'none',
                transition: `transform 360ms cubic-bezier(0.34,1.5,0.64,1) ${t.delay}ms, opacity 240ms ease ${t.delay}ms`,
              }}
            >
              <Icon size={23} color={V3.paper} strokeWidth={2.1} />
            </button>
          )
        })}

        {/* 닫힘 FAB — ink 원 + 발자국 아이콘. 탭하면 펼침. */}
        <button
          ref={fabRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="빠른 기입 열기"
          aria-expanded={open}
          tabIndex={open ? -1 : 0}
          className="absolute flex items-center justify-center ft-no-press"
          style={{
            right: EDGE,
            bottom: EDGE,
            width: FAB,
            height: FAB,
            borderRadius: 999,
            background: V3.accentDeep,
            border: 'none',
            cursor: 'pointer',
            opacity: open ? 0 : 1,
            transform: open ? 'scale(0.6)' : 'scale(1)',
            pointerEvents: open ? 'none' : 'auto',
            boxShadow: '0 8px 22px rgba(22,20,15,0.32)',
            transition:
              'opacity 200ms ease, transform 220ms cubic-bezier(0.34,1.5,0.64,1)',
          }}
        >
          <DogPawMark size={28} color={V3.paper} />
        </button>
      </div>

      {/* 건강(식사) 퀵 기록 시트 — 무거운 /health 설문 대신 1~3탭 저장. */}
      <QuickHealthSheet
        open={healthOpen}
        onClose={() => setHealthOpen(false)}
        dogId={activeDogId}
      />

      {/* 체중 퀵 기록 시트 — ?weight=open 페이지 이동 대신 그 자리에서 입력. */}
      <QuickWeightSheet
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        dogId={activeDogId}
      />

      {/* 일기 퀵 기록 시트 — /diary 이동 대신 한 줄 메모 바로 저장. */}
      <QuickMemoSheet
        open={diaryOpen}
        onClose={() => setDiaryOpen(false)}
        dogId={activeDogId}
      />

      {/* 사진 퀵 추가 시트 — /photos 이동 대신 골라서 바로 업로드. */}
      <QuickPhotoSheet
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        dogId={activeDogId}
      />
    </>
  )
}
