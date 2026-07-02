'use client'

/**
 * AppShowcase — /why-app 스크롤 모션 쇼케이스 (2026-07-02).
 *
 * 레퍼런스: 사장님 첨부(타 앱 랜딩) — 폰 목업이 화면에 고정된 채 스크롤에
 * 따라 좌측 설명과 폰 속 화면이 함께 바뀌는 패턴.
 *
 * 구조:
 *   - 데스크톱(md+): 좌측 = 기능 설명 블록 4개(각 ~85vh), 우측 = sticky 폰
 *     프레임. IntersectionObserver(중앙 밴드)로 활성 블록을 추적해 폰 속
 *     화면을 crossfade(opacity+translateY) 전환.
 *   - 모바일: sticky 분할이 좁은 화면에서 겹침이 심해, 각 블록 안에 해당
 *     화면을 인라인으로 렌더(md:hidden ↔ hidden md:block).
 *
 * 폰 속 화면 4종은 실제 앱 기능(대시보드/분석 리포트/기록/정기배송 관리)을
 * DOM 으로 재구성한 **예시 화면** — 실스크린샷 아님(앱은 로그인 게이트 뒤라
 * 캡처 불가). 가짜 후기·효능 단정 0, 하단에 "예시 화면" 명시(정직성 가드).
 *
 * 로직/DB 0 — presentation only. FD 토큰(--fd-*)만 사용(앱 v3 토큰 불침범).
 */

import { useEffect, useRef, useState } from 'react'
import {
  Bone,
  Dog,
  Flame,
  Footprints,
  PauseCircle,
  RefreshCw,
  Scale,
  Truck,
} from 'lucide-react'
import { Eyebrow, Display } from '@/components/web/fd/ui'

// ---------------------------------------------------------------------------
// 폰 속 예시 화면 4종 — 실제 앱 기능만 재구성 (없는 기능 그리지 않기)
// ---------------------------------------------------------------------------

/** 공통 미니 카드 셸 */
function ScreenCard({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '12px 14px',
        boxShadow: '0 1px 4px rgba(30,26,20,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function ScreenHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--fd-pine)' }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--fd-muted)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

/** ① 홈 대시보드 — 오늘 급여량 + 이번 주 기록 + 퀵 기록 칩 */
function ScreenHome() {
  return (
    <div style={{ padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fd-muted)' }}>좋은 아침이에요</div>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--fd-pine)' }}>
            콩이네 🐾
          </div>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: 'var(--fd-cream)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Dog size={18} color="var(--fd-coral)" strokeWidth={2.4} />
        </div>
      </div>

      <ScreenCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fd-muted)' }}>오늘 급여</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fd-green)' }}>1끼 남음</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--fd-pine)', marginTop: 3 }}>
          340g <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fd-muted)' }}>/ 하루 2끼</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--fd-cream)', marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: '50%', height: '100%', borderRadius: 999, background: 'var(--fd-coral)' }} />
        </div>
      </ScreenCard>

      <ScreenCard>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fd-muted)', marginBottom: 8 }}>이번 주 기록</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
            <div key={d} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: i < 5 ? 'var(--fd-green)' : 'var(--fd-cream)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  color: i < 5 ? '#FFF' : 'var(--fd-muted)',
                }}
              >
                {i < 5 ? '✓' : ''}
              </div>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--fd-muted)', marginTop: 3 }}>{d}</div>
            </div>
          ))}
        </div>
      </ScreenCard>

      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { icon: <Bone size={12} strokeWidth={2.4} />, label: '식사' },
          { icon: <Footprints size={12} strokeWidth={2.4} />, label: '산책' },
          { icon: <Scale size={12} strokeWidth={2.4} />, label: '체중' },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '9px 0',
              borderRadius: 999,
              background: '#FFFFFF',
              boxShadow: 'inset 0 0 0 1px var(--fd-line)',
              fontSize: 10.5,
              fontWeight: 800,
              color: 'var(--fd-pine)',
            }}
          >
            {c.icon}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  )
}

/** ② 정밀 분석 리포트 — BCS + 권장 칼로리 + 단백질 적합 */
function ScreenAnalysis() {
  return (
    <div style={{ padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ScreenHeader title="영양 분석 리포트" sub="콩이 · 말티즈 · 3살" />

      <ScreenCard>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fd-muted)' }}>체형 점수 (BCS)</div>
        <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: i === 4 ? 18 : 12,
                borderRadius: 3,
                background: i === 4 ? 'var(--fd-green)' : 'var(--fd-cream)',
                alignSelf: 'flex-end',
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--fd-green)', marginTop: 6 }}>
          5 / 9 · 적정 체형
        </div>
      </ScreenCard>

      <ScreenCard>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fd-muted)' }}>하루 권장</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--fd-pine)' }}>612</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fd-muted)' }}>kcal</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--fd-pine)' }}>340g</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fd-muted)' }}>급여량</div>
          </div>
        </div>
      </ScreenCard>

      <ScreenCard>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fd-muted)', marginBottom: 7 }}>
          잘 맞는 단백질
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            { name: '닭고기', ok: true },
            { name: '오리', ok: true },
            { name: '소고기', ok: false },
          ].map((p) => (
            <span
              key={p.name}
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                padding: '5px 10px',
                borderRadius: 999,
                background: p.ok ? 'var(--fd-cream)' : 'transparent',
                color: p.ok ? 'var(--fd-pine)' : 'var(--fd-muted)',
                boxShadow: p.ok ? 'none' : 'inset 0 0 0 1px var(--fd-line)',
                textDecoration: p.ok ? 'none' : 'line-through',
              }}
            >
              {p.ok ? '✓ ' : ''}
              {p.name}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--fd-muted)', marginTop: 7 }}>
          알레르기 응답을 반영했어요
        </div>
      </ScreenCard>
    </div>
  )
}

/** ③ 매일 기록 — 타임라인 + 연속 기록 */
function ScreenRecords() {
  return (
    <div style={{ padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ScreenHeader title="오늘 기록" sub="탭 한 번이면 끝나요" />

      <ScreenCard>
        {[
          { time: '08:12', label: '아침 식사 170g', done: true },
          { time: '17:40', label: '산책 32분', done: true },
          { time: '20:00', label: '체중 6.4kg', done: true },
        ].map((r, i) => (
          <div
            key={r.time}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--fd-line)',
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: 'var(--fd-green)',
                color: '#FFF',
                fontSize: 10,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fd-pine)', flex: 1 }}>{r.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fd-muted)' }}>{r.time}</span>
          </div>
        ))}
      </ScreenCard>

      <ScreenCard
        style={{
          background: 'var(--fd-pine)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Flame size={20} color="#E5A93B" strokeWidth={2.4} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF' }}>12일 연속 기록 중</div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.72)', marginTop: 1 }}>
            기록이 쌓이면 식단 재분석으로 이어져요
          </div>
        </div>
      </ScreenCard>
    </div>
  )
}

/** ④ 정기배송 관리 — 다음 배송 + 박스 구성 + 주기/일시정지 */
function ScreenSubscription() {
  return (
    <div style={{ padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ScreenHeader title="정기배송" sub="다음 박스" />

      <ScreenCard style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--fd-cream)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Truck size={18} color="var(--fd-coral)" strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--fd-pine)' }}>금요일 도착 예정</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fd-muted)', marginTop: 1 }}>2주 주기 · 4kg 박스</div>
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 900,
            color: 'var(--fd-coral)',
            background: 'var(--fd-cream)',
            borderRadius: 999,
            padding: '4px 9px',
          }}
        >
          D-3
        </span>
      </ScreenCard>

      <ScreenCard>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fd-muted)', marginBottom: 8 }}>박스 구성</div>
        {[
          { name: '소고기 레시피', pct: '50%', dot: '#8A4A54' },
          { name: '닭고기 레시피', pct: '50%', dot: 'var(--fd-coral)' },
        ].map((line, i) => (
          <div
            key={line.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--fd-line)',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 999, background: line.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fd-pine)', flex: 1 }}>{line.name}</span>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--fd-muted)' }}>{line.pct}</span>
          </div>
        ))}
      </ScreenCard>

      <div style={{ display: 'flex', gap: 6 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            padding: '9px 0',
            borderRadius: 999,
            background: 'var(--fd-pine)',
            fontSize: 10.5,
            fontWeight: 800,
            color: '#FFFFFF',
          }}
        >
          <RefreshCw size={11} strokeWidth={2.6} /> 주기 변경
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            padding: '9px 0',
            borderRadius: 999,
            background: '#FFFFFF',
            boxShadow: 'inset 0 0 0 1px var(--fd-line)',
            fontSize: 10.5,
            fontWeight: 800,
            color: 'var(--fd-pine)',
          }}
        >
          <PauseCircle size={11} strokeWidth={2.6} /> 일시정지
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 기능 정의 — 화면과 설명 페어 (전부 실재 기능)
// ---------------------------------------------------------------------------

type Feature = {
  key: string
  eyebrow: string
  title: React.ReactNode
  body: string
  screen: React.ReactNode
}

const FEATURES: Feature[] = [
  {
    key: 'home',
    eyebrow: 'Daily Care',
    title: (
      <>
        오늘 얼마나 먹일지,
        <br />
        앱이 먼저 알고 있어요
      </>
    ),
    body: '아이 몸무게와 활동량에 맞춘 하루 급여량과 남은 끼니를 홈에서 바로 확인해요. 식사·산책·체중 기록은 탭 한 번이면 끝나요.',
    screen: <ScreenHome />,
  },
  {
    key: 'analysis',
    eyebrow: 'Analysis',
    title: (
      <>
        수의 임상 기준의
        <br />
        정밀 영양 분석
      </>
    ),
    body: '체형(BCS)부터 알레르기·건강 상태까지 8단계 정밀 설문으로, 우리 아이에게 잘 맞는 영양 구성과 레시피를 찾아드려요.',
    screen: <ScreenAnalysis />,
  },
  {
    key: 'records',
    eyebrow: 'Records',
    title: (
      <>
        기록이 쌓일수록
        <br />
        식단이 똑똑해져요
      </>
    ),
    body: '매일의 식사·산책·체중이 아이의 변화 데이터가 돼요. 체중 변화를 감지하면 식단 재분석까지 자연스럽게 이어져요.',
    screen: <ScreenRecords />,
  },
  {
    key: 'subscription',
    eyebrow: 'Subscription',
    title: (
      <>
        배송 일정도
        <br />
        앱에서 자유롭게
      </>
    ),
    body: '다음 박스가 언제 오는지, 박스에 어떤 레시피가 담기는지 한눈에. 주기 변경·일시정지·재개도 몇 번의 탭이면 돼요.',
    screen: <ScreenSubscription />,
  },
]

// ---------------------------------------------------------------------------
// 폰 프레임 — 베젤 + 다이나믹 아일랜드 + 스크린
// ---------------------------------------------------------------------------

function PhoneFrame({
  children,
  width = 292,
}: {
  children: React.ReactNode
  width?: number
}) {
  return (
    <div
      style={{
        width,
        aspectRatio: '9 / 19',
        borderRadius: 46,
        background: '#1E1A14',
        padding: 10,
        boxShadow: '0 24px 60px rgba(30,26,20,0.22), inset 0 0 0 2px rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 37,
          background: 'var(--fd-offwhite)',
          overflow: 'hidden',
        }}
      >
        {/* 다이나믹 아일랜드 */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 74,
            height: 20,
            borderRadius: 999,
            background: '#1E1A14',
            zIndex: 5,
          }}
        />
        <div style={{ position: 'absolute', inset: 0, paddingTop: 26 }}>{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 메인 쇼케이스
// ---------------------------------------------------------------------------

export default function AppShowcase() {
  const [active, setActive] = useState(0)
  const blockRefs = useRef<(HTMLDivElement | null)[]>([])

  // reduced-motion 은 globals.css 전역 @media 가 transition-duration 을 0 으로
  // 강제(!important, 인라인 스타일도 덮음) — JS 분기 불필요.
  useEffect(() => {
    const blocks = blockRefs.current.filter(Boolean) as HTMLDivElement[]
    if (blocks.length === 0) return
    // 뷰포트 중앙 밴드(상하 -42%)에 들어온 블록을 활성으로 — 스크롤 방향과
    // 무관하게 "지금 읽고 있는 블록"과 폰 화면이 일치한다.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idx = blocks.indexOf(e.target as HTMLDivElement)
          if (idx >= 0) setActive(idx)
        }
      },
      { rootMargin: '-42% 0px -42% 0px', threshold: 0 },
    )
    blocks.forEach((b) => io.observe(b))
    return () => io.disconnect()
  }, [])

  return (
    <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1140 }}>
      <div className="md:grid md:grid-cols-2 md:gap-12">
        {/* 좌측 — 설명 블록 (모바일에선 폰 인라인 포함) */}
        <div>
          {FEATURES.map((f, i) => (
            <div
              key={f.key}
              ref={(el) => {
                blockRefs.current[i] = el
              }}
              className="flex flex-col justify-center py-14 md:py-0 md:min-h-[88vh]"
            >
              <Eyebrow>{f.eyebrow}</Eyebrow>
              <Display as="h3" size="md" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                {f.title}
              </Display>
              <p
                className="mt-4"
                style={{
                  fontSize: 16,
                  lineHeight: 1.65,
                  fontWeight: 500,
                  color: 'var(--fd-muted)',
                  maxWidth: 420,
                }}
              >
                {f.body}
              </p>

              {/* 모바일 전용 — 해당 화면 인라인 */}
              <div className="md:hidden mt-8 flex flex-col items-center">
                <PhoneFrame width={248}>{f.screen}</PhoneFrame>
                <p className="mt-3" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--fd-muted)' }}>
                  이해를 돕기 위한 예시 화면이에요
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 우측 — 데스크톱 전용 sticky 폰. 화면 4장이 겹쳐진 채 crossfade */}
        <div className="hidden md:block">
          <div className="sticky top-0 flex h-screen flex-col items-center justify-center">
            <PhoneFrame>
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {FEATURES.map((f, i) => (
                  <div
                    key={f.key}
                    aria-hidden={active !== i}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: active === i ? 1 : 0,
                      transform: active === i ? 'translateY(0)' : 'translateY(14px)',
                      transition: 'opacity 0.45s ease, transform 0.45s ease',
                      pointerEvents: active === i ? 'auto' : 'none',
                    }}
                  >
                    {f.screen}
                  </div>
                ))}
              </div>
            </PhoneFrame>
            <p className="mt-4" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fd-muted)' }}>
              이해를 돕기 위한 예시 화면이에요
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
