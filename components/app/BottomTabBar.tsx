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
 * - ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 T11): 흰 바 + 먹색 1.5px 윗선, 아이콘 26
 *   (홈은 켜지면 채움), 켜진 탭 = 먹색 800 / 꺼진 탭 = #595959 600, 가운데 = 52px 먹색 원.
 *   기록 메뉴 = 회색 칸 + 왼쪽 6px 색 띠(머스타드·청록·빨강·먹색) + 흰 원 아이콘.
 * - ★2026-10-10 떠 있는 둥근 탭(사장님 "토스 UI 위아래는 우리만큼 여백이 많은 느낌이 아닌데" → 세 안 비교에서
 *   "두번째가 젤 나은 듯"). 꽉 찬 바(68) + 홈바 구간(34) = 102 높이 덩어리가 화면 아래를 막고 있었다.
 *   토스 캡처 실측(높이 61·좌우 21 안쪽·완전 둥금)대로 높이 62 알약을 좌우 20 안쪽에 띄우고, 양옆으로 내용이 보인다.
 *   켜진 탭 = 회색 알약 + 먹색 800. 가운데 원은 50(알약 안 위아래 6). 글자 크기(13.5)는 그대로.
 *   ★네이티브 앱은 알약을 홈바 구간 바로 위(간격 0)에 앉힌다 — 아이폰은 contentInset 'always' 라 홈바 구간을
 *   웹이 아니라 앱이 칠하고 그 아래로는 내용이 안 보인다. 간격을 두면 알약 밑에 내용이 한 줄 비치다가 잘린다(규칙84).
 */

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, Scale, Pencil, Camera } from 'lucide-react'
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

/** 탭 아이콘 — 시안(캔버스 T11) 그대로. 선 굵기 2, 둥근 끝. 홈만 켜지면 속을 채운다. */
function TabIcon({ name, active }: { name: 'home' | 'dogs' | 'subs' | 'me'; active: boolean }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'home')
    return (
      <svg {...common} fill={active ? 'currentColor' : 'none'}>
        <path d="M4 11l8-7 8 7v9h-5.5v-6h-5v6H4z" />
      </svg>
    )
  if (name === 'dogs')
    return (
      <svg {...common} fill="none">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
    )
  if (name === 'subs')
    return (
      <svg {...common} fill="none">
        <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
        <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
      </svg>
    )
  return (
    <svg {...common} fill="none">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  )
}

type LinkTab = {
  key: 'home' | 'dogs' | 'subs' | 'me'
  label: string
  href: string
  isActive: (path: string) => boolean
}

const LEFT: LinkTab[] = [
  {
    key: 'home',
    label: '홈',
    href: '/dashboard',
    isActive: (p) => p === '/dashboard',
  },
  {
    key: 'dogs',
    label: '우리 아이',
    href: '/dogs',
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
    isActive: (p) =>
      p.startsWith('/mypage/subscriptions') ||
      p.startsWith('/account/subscriptions') ||
      /^\/dogs\/[^/]+\/subscription/.test(p),
  },
  {
    key: 'me',
    label: '내 정보',
    href: '/mypage',
    // 내 정보 메뉴에서 들어가는 화면들(/reports·/notifications·/chat, /account 하위)도 이 탭.
    // 2026-09-23 점검: 알림 설정(/notifications)에 들어가면 탭이 전부 꺼지던 것.
    // 2026-10-09 앱시안 결정 10번: 고객센터·FAQ·사업자 정보·약관·문의(내 정보 → 고객센터에서 들어간다)도 이 탭을 켠다 —
    //   예전엔 다섯 칸이 다 꺼져 어디 있는지 잃었다.
    isActive: (p) =>
      (p.startsWith('/mypage') && !p.startsWith('/mypage/subscriptions')) ||
      p.startsWith('/reports') ||
      p.startsWith('/notifications') ||
      p.startsWith('/chat') ||
      p === '/help' ||
      p.startsWith('/faq') ||
      p.startsWith('/business') ||
      p.startsWith('/legal') ||
      p.startsWith('/contact') ||
      (p.startsWith('/account') &&
        !p.startsWith('/account/subscriptions') &&
        !p.startsWith('/account/dogs')),
  },
]

// 탭바 라벨은 본문 토큰(16)을 따르지 않는다 — 사장님 "무겁다"(2026-09-22). 탭바 표준 12~13.
const TAB_LABEL_PX = 13.5
// 떠 있는 알약(2026-10-10) — 바깥 높이 62(테두리 포함) = 안쪽 여백 5 + 칸 50 + 5 + 테두리 1+1.
// --ft-tabbar-h(globals.css)는 이 높이 + 아래 간격(--ft-tabbar-gap)이다. 높이를 바꾸면 둘 다.
const PILL_H = 62
const PILL_PAD = 5
// 켜진 탭 뒤 회색 알약(토스 캡처의 그것). 흰 알약 위에서 보일 만큼만 진하게.
const ACTIVE_FILL = '#EDEDED'

// band = 기록 칸 왼쪽 6px 색 띠(시안 T11 — 머스타드·청록·빨강·먹색 차례).
const RECORD_ACTIONS = [
  { key: 'health', label: '건강 · 식사', hint: '컨디션과 밥', Icon: Activity, band: V3.mustard },
  { key: 'weight', label: '체중', hint: '오늘 잰 몸무게', Icon: Scale, band: '#2F8F8B' },
  { key: 'diary', label: '일기', hint: '한 줄 메모', Icon: Pencil, band: V3.sale },
  { key: 'photo', label: '사진', hint: '오늘의 한 장', Icon: Camera, band: '#2E3338' },
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
    color: active ? V3.ink : V3.inkMute,
    background: active ? ACTIVE_FILL : 'transparent',
  })

  const renderLink = (t: LinkTab) => {
    const active = t.isActive(pathname)
    return (
      <Link
        key={t.key}
        href={t.href}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center justify-center ft-no-press"
        style={{ ...linkStyle(active), gap: 3, borderRadius: 999, minWidth: 0 }}
      >
        <TabIcon name={t.key} active={active} />
        <span
          className="leading-none"
          style={{ fontSize: TAB_LABEL_PX, fontWeight: active ? 800 : 600, letterSpacing: '-0.01em' }}
        >
          {t.label}
        </span>
      </Link>
    )
  }

  return (
    <>
      {/* 떠 있는 둥근 탭(2026-10-10 — 위 docstring). nav 자체가 알약이라 양옆 20px 은 아래 내용을 그대로 누를 수 있다.
          바닥 간격 = --ft-tabbar-gap(웹 8 · 네이티브 앱 0 — html.ft-native) + 기기 안전 여백. */}
      <nav
        aria-label="주 메뉴"
        className="fixed z-40 grid"
        style={{
          left: 20,
          right: 20,
          maxWidth: 448,
          marginLeft: 'auto',
          marginRight: 'auto',
          bottom: 'calc(var(--ft-tabbar-gap, 8px) + env(safe-area-inset-bottom))',
          height: PILL_H,
          padding: PILL_PAD,
          boxSizing: 'border-box',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          borderRadius: 999,
          // 거의 흰 반투명 + 옅은 테두리·그림자 — 지나가는 내용이 살짝 비친다(토스 캡처). 바탕이 흰색이라
          // 예전처럼 네이티브 홈바 구간 색(--ft-native-bg)과 맞출 일이 없다 — 알약은 그 구간에 닿아도 둥근 끝만 닿는다.
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(20,20,20,0.08)',
          boxShadow: '0 6px 24px rgba(20,20,20,0.10)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {LEFT.map(renderLink)}

        {/* 가운데 — 발바닥 원. 처음엔 바 위로 절반 솟게 했는데 사장님이 "혼자 둥둥 떠
            있다" — 바 **안쪽**, 다른 아이콘들과 같은 높이에 앉힌다(2026-09-22).
            글자는 없고(발바닥이 곧 이름), 눌리는 영역은 칸 전체. 지름은 칸 높이(50) 그대로 —
            46 은 "너무 작다"(9/22)였다. */}
        <button
          type="button"
          onClick={openRecord}
          aria-label="기록하기"
          aria-haspopup="dialog"
          aria-expanded={recordActive}
          className="flex items-center justify-center ft-no-press"
          style={{ minWidth: 0 }}
        >
          <span
            aria-hidden
            // 결과 화면 둘러보기 2단계가 이 원을 가리킨다(components/v3/tour/ResultTour).
            data-tour="record"
            className="flex items-center justify-center transition-transform duration-150"
            style={{
              width: PILL_H - PILL_PAD * 2 - 2,
              height: PILL_H - PILL_PAD * 2 - 2,
              borderRadius: 999,
              background: V3.ink,
              transform: recordActive ? 'scale(0.94)' : 'scale(1)',
            }}
          >
            <DogPawMark size={26} color="#FFFFFF" />
          </span>
        </button>

        {RIGHT.map(renderLink)}
      </nav>

      {/* 기록 메뉴 — 제목은 시트 기본 헤더(구분선) 대신 직접 그린다. 2×2 타일:
          아이콘 원 + 이름 + 한 줄 설명. 여백은 v3 스케일(20/12/16). */}
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} ariaLabel="기록하기">
        <div className="px-5 pt-2" style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }}>
          <div className="flex" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: V3.inkMute }}>
                {activeDogName ? `${petName(activeDogName)}의 오늘` : '오늘 기록'}
              </p>
              <h2 className="mt-1" style={{ fontSize: 26, lineHeight: 1.15, color: V3.ink }}>
                무엇을 남길까요?
              </h2>
            </div>
            {/* 시안 T11 — 오른쪽 '닫기'(기록 시트들과 같은 자리·같은 글자). */}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="닫기"
              className="flex items-center"
              style={{
                minWidth: 44,
                height: 44,
                justifyContent: 'flex-end',
                flexShrink: 0,
                padding: '0 4px',
                background: 'none',
                border: 'none',
                color: V3.ink,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
          <div className="grid grid-cols-2" style={{ marginTop: 18, gap: 10 }}>
            {RECORD_ACTIONS.map((a) => {
              const Icon = a.Icon
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => pick(a.key)}
                  className="flex flex-col items-start justify-between text-left transition active:scale-[0.98]"
                  style={{
                    borderRadius: V3Radius.sm,
                    padding: 16,
                    background: V3.soft,
                    borderLeft: `6px solid ${a.band}`,
                    minHeight: 120,
                  }}
                >
                  <span
                    className="flex items-center justify-center"
                    style={{ width: 44, height: 44, borderRadius: 999, background: '#FFFFFF', color: V3.ink }}
                  >
                    <Icon size={24} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="mt-3 flex flex-col" style={{ gap: 2 }}>
                    <span className="leading-snug" style={{ fontSize: V3FontSize.md, fontWeight: 800, color: V3.ink }}>
                      {a.label}
                    </span>
                    <span style={{ fontSize: V3FontSize.sm, color: V3.inkMute }}>{a.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </BottomSheet>

      {activeDogId && (
        <>
          {/* 이름을 넘겨야 시트 제목이 "땅콩 오늘 어땠나요?"처럼 나온다(시안 T12~T15 — 예전엔 "오늘 어땠나요?"). */}
          <QuickHealthSheet
            open={sheet === 'health'}
            onClose={() => setSheet(null)}
            dogId={activeDogId}
            dogName={activeDogName ?? undefined}
          />
          <QuickWeightSheet
            open={sheet === 'weight'}
            onClose={() => setSheet(null)}
            dogId={activeDogId}
            dogName={activeDogName ?? undefined}
          />
          <QuickMemoSheet
            open={sheet === 'diary'}
            onClose={() => setSheet(null)}
            dogId={activeDogId}
            dogName={activeDogName ?? undefined}
          />
          <QuickPhotoSheet
            open={sheet === 'photo'}
            onClose={() => setSheet(null)}
            dogId={activeDogId}
            dogName={activeDogName ?? undefined}
          />
        </>
      )}
    </>
  )
}
