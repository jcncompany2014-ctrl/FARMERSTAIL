'use client'

/**
 * BottomTabBar — 앱 전용 하단 탭 (2026-09-21, 시니어 사용성 기획 1단계).
 *
 *   홈 · 우리 아이 · [기록 = 발바닥] · 정기배송 · 내 정보
 *
 * # 왜 되살렸나
 * 하단 탭은 2026-06-17 "홈 허브형" 전환 때 일부러 뺐다(내비 = 로고→홈 + 계정
 * 아이콘 + 홈 카드 + ← 뒤로). 실제 사용자(부모님 세대)를 보니 "허브에서 찾아
 * 들어가기"가 안 됐다 — 강아지 프로필 상단 탭이 눌리는 것인 줄 모르고, 정기배송
 * 카드는 두 화면 반 아래에 있었다. 항상 보이고 글자가 붙은 탭이 가장 확실한
 * "여기를 누르세요"다. 발바닥(빠른 기록)은 라벨 없는 우하단 FAB 였는데 가운데
 * 칸으로 옮겼다.
 *
 * # 규칙
 * - 앱에서만 그린다(useIsAppContext). 웹은 절대 안 나온다 — 웹/앱 절대 분리.
 * - 몰입 화면(설문·체크인·승인 = AppChrome focusMode)에서는 숨긴다.
 * - 라벨 13.5px(V3FontSize.base, 탭바 표준은 12~13)·터치 영역은 칸 전체(높이 68px).
 *   16px 굵은체로 했다가 사장님이 "무겁고 이상하다" — 탭바는 아이콘+짧은 라벨로 읽히는
 *   곳이라 본문 기준을 그대로 적용하면 안 된다(2026-09-22).
 * - 가운데 발바닥은 글자 없는 원(56px) 하나로, 바 **안쪽** 다른 아이콘과 같은 줄에
 *   앉는다. 바 위로 솟게 했더니 "혼자 둥둥 떠 있다", 46px 은 "너무 작다"(사장님
 *   2026-09-22). 바 높이 68 은 이 원에 위아래 6px 여백을 주기 위한 값.
 * - 기록 탭은 페이지 이동이 아니라 시트(건강·체중·일기·사진)를 연다. 강아지가
 *   없으면 등록 화면으로 보낸다.
 */

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { House, Dog, Truck, User, Activity, Scale, Pencil, Camera } from 'lucide-react'
import { V3, V3FontSize, V3Radius } from '@/lib/design/tokens'
import DogPawMark from '@/components/DogPawMark'
import BottomSheet from '@/components/ui/BottomSheet'
import { useIsAppContext } from '@/lib/app-context-client'
import { petName } from '@/lib/korean'
import QuickHealthSheet from '@/components/v3/sheet/QuickHealthSheet'
import QuickWeightSheet from '@/components/v3/sheet/QuickWeightSheet'
import QuickMemoSheet from '@/components/v3/sheet/QuickMemoSheet'
import QuickPhotoSheet from '@/components/v3/sheet/QuickPhotoSheet'

interface BottomTabBarProps {
  /** 기록 시트의 대상 강아지. null 이면 기록 탭이 강아지 등록으로 보낸다. */
  activeDogId: string | null
  /** 시트 제목에 쓰는 이름("푸린이의 오늘"). */
  activeDogName?: string | null
  /** 몰입 화면(설문 등)에서 숨김. */
  hidden?: boolean
}

type LinkTab = {
  key: string
  label: string
  href: string
  Icon: typeof House
  isActive: (path: string) => boolean
}

const LEFT: LinkTab[] = [
  {
    key: 'home',
    label: '홈',
    href: '/dashboard',
    Icon: House,
    isActive: (p) => p === '/dashboard',
  },
  {
    key: 'dogs',
    label: '우리 아이',
    href: '/dogs',
    Icon: Dog,
    // 강아지별 정기배송 관리(/dogs/:id/subscription)는 '정기배송' 탭 소관.
    isActive: (p) =>
      (p === '/dogs' || p.startsWith('/dogs/') || p.startsWith('/account/dogs')) &&
      !/^\/dogs\/[^/]+\/subscription/.test(p),
  },
]

const RIGHT: LinkTab[] = [
  {
    key: 'subs',
    label: '정기배송',
    href: '/mypage/subscriptions',
    Icon: Truck,
    isActive: (p) =>
      p.startsWith('/mypage/subscriptions') ||
      p.startsWith('/account/subscriptions') ||
      /^\/dogs\/[^/]+\/subscription/.test(p),
  },
  {
    key: 'me',
    label: '내 정보',
    href: '/mypage',
    Icon: User,
    // 내 정보 메뉴에서 들어가는 화면들(/reports·/notifications·/chat, /account 하위)도 이 탭.
    // 2026-09-23 점검: 알림 설정(/notifications)에 들어가면 탭이 전부 꺼지던 것.
    isActive: (p) =>
      (p.startsWith('/mypage') && !p.startsWith('/mypage/subscriptions')) ||
      p.startsWith('/reports') ||
      p.startsWith('/notifications') ||
      p.startsWith('/chat') ||
      (p.startsWith('/account') &&
        !p.startsWith('/account/subscriptions') &&
        !p.startsWith('/account/dogs')),
  },
]

// 탭바 라벨은 본문 토큰(16)을 따르지 않는다 — 사장님 "무겁다"(2026-09-22). 탭바 표준 12~13.
const TAB_LABEL_PX = 13.5

const RECORD_ACTIONS = [
  { key: 'health', label: '건강 · 식사', hint: '컨디션과 밥', Icon: Activity },
  { key: 'weight', label: '체중', hint: '오늘 잰 몸무게', Icon: Scale },
  { key: 'diary', label: '일기', hint: '한 줄 메모', Icon: Pencil },
  { key: 'photo', label: '사진', hint: '오늘의 한 장', Icon: Camera },
] as const
type RecordKey = (typeof RECORD_ACTIONS)[number]['key']


export default function BottomTabBar({ activeDogId, activeDogName, hidden }: BottomTabBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isApp = useIsAppContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sheet, setSheet] = useState<RecordKey | null>(null)

  // 웹에서는 절대 그리지 않는다. 첫 렌더는 isApp=false 라 하이드레이션 뒤 나타난다.
  if (hidden || !isApp) return null

  const recordActive = menuOpen || sheet !== null

  function openRecord() {
    if (!activeDogId) {
      router.push('/dogs/new')
      return
    }
    setMenuOpen(true)
  }

  function pick(key: RecordKey) {
    setMenuOpen(false)
    setSheet(key)
  }

  const linkStyle = (active: boolean): CSSProperties => ({
    color: active ? 'var(--accent)' : V3.inkMute,
  })

  const renderLink = (t: LinkTab) => {
    const active = t.isActive(pathname)
    const Icon = t.Icon
    return (
      <Link
        key={t.key}
        href={t.href}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center justify-center ft-no-press"
        style={{ ...linkStyle(active), gap: 5, paddingTop: 6, paddingBottom: 8 }}
      >
        <Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
        <span
          className="leading-none"
          style={{ fontSize: TAB_LABEL_PX, fontWeight: active ? 700 : 600, letterSpacing: '-0.01em' }}
        >
          {t.label}
        </span>
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="주 메뉴"
        className="fixed left-0 right-0 z-40"
        style={{
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
          // ★네이티브 배경색과 같은 불투명 색 (사장님 2026-09-22 아이폰 스크린샷: 탭 줄
          //   아래 홈바 구간이 다른 색 띠로 보였다). 그 구간은 웹이 아니라 Capacitor 가
          //   capacitor.config 의 backgroundColor(#F5F0E6)로 칠한다(contentInset 'always').
          //   웹 종이색(#F7F5F0)과 2단계 달라 띠가 생겼다 — 탭바를 그 색으로 맞춰 바+홈바가
          //   한 덩어리로 읽히게 한다. 두 값의 동기는 규칙84 가 잠근다.
          background: 'var(--ft-native-bg)',
          borderTop: `1px solid ${V3.rule}`,
          boxShadow: '0 -4px 16px -14px rgba(22,20,15,0.30)',
        }}
      >
        <div
          className="max-w-md mx-auto grid"
          style={{
            gridTemplateColumns: 'repeat(5, 1fr)',
            height: 'var(--ft-tabbar-h, 68px)',
          }}
        >
          {LEFT.map(renderLink)}

          {/* 가운데 — 발바닥 원. 처음엔 바 위로 절반 솟게 했는데 사장님이 "혼자 둥둥 떠
              있다" — 바 **안쪽**, 다른 아이콘들과 같은 높이에 앉힌다(2026-09-22).
              글자는 없고(발바닥이 곧 이름), 눌리는 영역은 칸 전체. */}
          <button
            type="button"
            onClick={openRecord}
            aria-label="기록하기"
            aria-haspopup="dialog"
            aria-expanded={recordActive}
            className="flex items-center justify-center ft-no-press"
          >
            <span
              aria-hidden
              className="flex items-center justify-center transition-transform duration-150"
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: recordActive ? 'var(--accent)' : V3.accentDeep,
                transform: recordActive ? 'scale(0.94)' : 'scale(1)',
              }}
            >
              <DogPawMark size={27} color={V3.paper} />
            </span>
          </button>

          {RIGHT.map(renderLink)}
        </div>
      </nav>

      {/* 기록 메뉴 — 제목은 시트 기본 헤더(구분선) 대신 직접 그린다. 2×2 타일:
          아이콘 원 + 이름 + 한 줄 설명. 여백은 v3 스케일(20/12/16). */}
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} ariaLabel="기록하기">
        <div className="px-5 pt-2" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
          <p
            className="leading-snug"
            style={{ fontSize: V3FontSize.lg, fontWeight: 800, color: V3.ink, letterSpacing: '-0.02em' }}
          >
            {activeDogName ? `${petName(activeDogName)}의 오늘` : '오늘 기록'}
          </p>
          <p className="mt-1" style={{ fontSize: V3FontSize.base, color: V3.inkMute }}>
            무엇을 남길까요?
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {RECORD_ACTIONS.map((a) => {
              const Icon = a.Icon
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => pick(a.key)}
                  className="flex flex-col items-start text-left transition active:scale-[0.98]"
                  style={{
                    borderRadius: V3Radius.md,
                    padding: 16,
                    background: V3.paperDeep,
                    border: `1px solid ${V3.rule}`,
                    minHeight: 124,
                  }}
                >
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: 'color-mix(in srgb, var(--accent) 14%, var(--paper))',
                      color: V3.accentDeep,
                    }}
                  >
                    <Icon size={22} strokeWidth={2.1} aria-hidden />
                  </span>
                  <span
                    className="mt-3 leading-snug"
                    style={{ fontSize: V3FontSize.md, fontWeight: 800, color: V3.ink }}
                  >
                    {a.label}
                  </span>
                  <span className="mt-0.5" style={{ fontSize: V3FontSize.base, color: V3.inkMute }}>
                    {a.hint}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </BottomSheet>

      {activeDogId && (
        <>
          <QuickHealthSheet
            open={sheet === 'health'}
            onClose={() => setSheet(null)}
            dogId={activeDogId}
          />
          <QuickWeightSheet
            open={sheet === 'weight'}
            onClose={() => setSheet(null)}
            dogId={activeDogId}
          />
          <QuickMemoSheet
            open={sheet === 'diary'}
            onClose={() => setSheet(null)}
            dogId={activeDogId}
          />
          <QuickPhotoSheet
            open={sheet === 'photo'}
            onClose={() => setSheet(null)}
            dogId={activeDogId}
          />
        </>
      )}
    </>
  )
}
