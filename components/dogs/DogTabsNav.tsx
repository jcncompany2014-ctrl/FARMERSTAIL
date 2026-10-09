'use client'

/**
 * 강아지 detail 탭 nav.
 *
 * sub-route 들을 3개 그룹으로 묶어 사용자가 한 페이지 안에서 길 잃지 않게.
 *
 *   개요  — /dogs/{id}                              (강아지 정보 / 다음 일정)
 *   기록  — /dogs/{id}/diary                        (사진·컨디션·체중 로그)
 *   분석  — /dogs/{id}/analysis                     (영양 분석 결과 + 추천 박스 일체)
 *
 * 2026-09-21 — '구독' 탭은 앱 하단 탭(정기배송)으로 옮겼다(시니어 사용성 기획).
 * 여기 남으면 같은 목적지가 두 군데라 헷갈린다. 4탭→3탭, 라벨 11→13px.
 *
 * 2026-06-19 (사장님 "분석→박스 점프 비효율" 지시) — '박스'(/formulas) 탭 폐지.
 * 추천 박스는 분석 결과(/analysis)에 BoxMixCard 로 이미 인라인 표시되므로 별도
 * 탭/페이지 점프가 중복이었음. 분석 탭을 /analyses(히스토리)→/analysis(결과뷰)로
 * 직결해 1차 목적지를 '결과+박스 일체' 페이지로. 박스 cycle 이력(/formulas)·
 * survey·analyses(히스토리)·approve 는 전부 '분석' 그룹으로 하이라이트. 5탭→4탭.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 AppDog·D01·D05·D08):
 *   · 모양 — 높이 52 · 3칸 · 아래 1.5px 먹선. 아이콘 없이 글자만(17px). 켜진 칸 = 먹색 800 + 아래 4px 먹선,
 *     꺼진 칸 = 회색(#595959) 600. 바탕은 흰색(반투명·블러 없음).
 *   · 어느 칸이 켜지나 — 예전엔 건강 관리·정보 수정·진료 보고서에서 셋 다 꺼져 있었다(사장님 결정 목록
 *     "아무것도 안 켜짐"). 그리고 '/analysis' 로 시작하는지만 봐서 분석 히스토리(/analyses)도 꺼졌다
 *     ('analyses' 는 'analysis' 로 시작하지 않는다). 이제 하위 화면마다 갈 곳을 표(SECTION_OF)로 정한다 —
 *     모든 하위 화면이 셋 중 하나를 켠다. 기준은 그 화면의 ← 가 올라가는 곳과 들어오는 입구:
 *       개요 = 정보 수정·건강 관리(복약·예방접종·리마인더)·진료 보고서·정기배송 — 전부 개요에서 들어가고 ← 가 개요.
 *       기록 = 일기·건강일지·체크인·연말 결산(한 해 기록 돌아보기).
 *       분석 = 분석·분석 히스토리·식단 기록·설문·승인·레시피 고르기·주문하기(분석 → 추천 박스 흐름).
 *
 * 디자인: 강아지 page chrome 상단에 sticky bar 로 붙임. 3칸 균등 grid. 모바일 친화 — 한 손 엄지.
 */

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { V3 } from '@/lib/design/tokens'

type Section = 'overview' | 'records' | 'analysis'

type Tab = {
  key: Section
  href: (id: string) => string
  label: string
}

const TABS: readonly Tab[] = [
  { key: 'overview', href: (id) => `/dogs/${id}`, label: '개요' },
  // 기록 = 사진 일기 (매일 retention 핵심). 컨디션·체중 등 health log 는 같은 '기록' 허브의 둘째 칸.
  { key: 'records', href: (id) => `/dogs/${id}/diary`, label: '기록' },
  // 분석 = 영양 분석 결과 + 추천 박스(인라인). /analysis(매거진 결과)가 1차 목적지.
  { key: 'analysis', href: (id) => `/dogs/${id}/analysis`, label: '분석' },
] as const

/**
 * /dogs/{id}/<첫 칸> → 켤 탭. 표에 없는 새 하위 화면은 개요(← 가 올라가는 곳)로 본다 — 셋 다 꺼진 화면을
 * 다시 만들지 않는다.
 */
const SECTION_OF: Record<string, Section> = {
  edit: 'overview',
  'health-care': 'overview',
  medications: 'overview',
  vaccinations: 'overview',
  reminders: 'overview',
  'vet-report': 'overview',
  subscription: 'overview',
  diary: 'records',
  health: 'records',
  checkin: 'records',
  'first-checkin': 'records',
  'year-in-review': 'records',
  analysis: 'analysis',
  analyses: 'analysis',
  formulas: 'analysis',
  survey: 'analysis',
  approve: 'analysis',
  plan: 'analysis',
  order: 'analysis',
}

function sectionFor(path: string, id: string): Section {
  const base = `/dogs/${id}`
  if (path === base || path === `${base}/`) return 'overview'
  if (!path.startsWith(`${base}/`)) return 'overview'
  const first = path.slice(base.length + 1).split('/')[0] ?? ''
  return SECTION_OF[first] ?? 'overview'
}

/**
 * 액션 중심 sub-route (survey/checkin/approve) 에서는 tab nav 자체를 숨김.
 * 사용자가 흐름에 집중할 수 있게 시각 부담 ↓. 사용자 피드백 반영.
 */
// '/first-checkin'(첫 박스 체크인 — 몰입 화면, AppChrome FOCUS_PATHS 와 같이)·'/formulas'(맞춤 박스 기록 — 시안 S20·S21 에
// 강아지 위 탭이 없다)도 숨긴다(2026-10-09).
const HIDE_ON_PATHS = ['/survey', '/checkin', '/first-checkin', '/approve', '/formulas']

/**
 * 설문 직후(fromSurvey=1) 결과 진입 감지 — AppChrome 의 focusMode 와 동일 신호.
 * useSearchParams(Suspense 필요) 대신 useSyncExternalStore 로 SSR-safe.
 */
function useFromSurvey(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb)
      return () => window.removeEventListener('popstate', cb)
    },
    () => new URLSearchParams(window.location.search).get('fromSurvey') === '1',
    () => false,
  )
}

export default function DogTabsNav({
  dogId,
  previewPath,
}: {
  dogId: string
  /** 점검 화면(/design-check/dogs) 전용 — 주소 대신 이 경로로 켤 탭을 정한다. 실제 화면은 넘기지 않는다. */
  previewPath?: string
}) {
  const routePath = usePathname()
  const pathname = previewPath ?? routePath
  const fromSurvey = useFromSurvey()
  if (HIDE_ON_PATHS.some((p) => pathname.includes(p))) return null
  // 설문 직후 분석 결과(focus 흐름) — AppChrome 헤더가 이미 숨겨져 있어(focusMode),
  // 탭 nav 도 같이 숨겨야 한다. 안 그러면 이 nav 의 sticky top(=헤더 높이) 이
  // 없는 헤더 자리를 비워둔 채, 분석 sticky 요약바(top:0)와 상단에서 겹쳐
  // '빈 공간 + 탭 스트립 겹침'으로 깨진다(사장님 리포트 2026-07-12).
  if (pathname.includes('/analysis') && fromSurvey) return null

  const current = sectionFor(pathname, dogId)

  return (
    <nav
      className="sticky z-30"
      // A5: 60px 하드코딩 → 헤더 높이 변수 + 노치 safe-area 보정. 하드코딩
      // 시절엔 노치 기기에서 헤더와 겹쳤음.
      style={{
        top: 'calc(var(--ft-header-h, 64px) + env(safe-area-inset-top))',
        background: V3.paper,
        borderBottom: `1.5px solid ${V3.ink}`,
      }}
      aria-label="강아지 메뉴"
    >
      <div className="grid grid-cols-3" style={{ height: 52 }}>
        {TABS.map(({ key, href, label }) => {
          const active = key === current
          return (
            <Link
              key={key}
              href={href(dogId)}
              className="flex items-center justify-center ft-no-press"
              aria-current={active ? 'page' : undefined}
              style={{
                boxSizing: 'border-box',
                // 켜진 칸의 4px 먹선은 nav 의 1.5px 먹선 위에 겹친다(시안: margin-bottom −1.5).
                marginBottom: active ? -1.5 : 0,
                borderBottom: active ? `4px solid ${V3.ink}` : 0,
                fontSize: 17,
                fontWeight: active ? 800 : 600,
                color: active ? V3.ink : V3.inkMute,
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
