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
 * # 폰 속 화면 = 실제 앱 v3 UI 미러링 (사장님 피드백 2026-07-02)
 *   처음 버전은 웹 FD 토큰으로 임의 구성 → "처음 보는 화면" 지적. 실제 앱
 *   컴포넌트의 시각 구조를 그대로 재구성:
 *     홈    = GreetingSection(accent dot 키커·Signature ink bar·yellow Mark)
 *             + DeliveryStripCard(ink 사각+yellow 트럭·D-N mono)
 *             + QuickActionChips(paper 아이콘 사각 + mono 라벨)
 *     기록  = ThisWeekSection(7일 그리드 full=ink/partial=yellow/today=dashed
 *             accent · legend · "오늘 기록하기 →")
 *     분석  = v3 리포트 톤(mono 키커·paperHi 카드·BCS 세그먼트·meta rows)
 *     구독  = SubscriptionCard(헤더 스트립·yellow 틴트 배송행·meta rows·
 *             radius-4 버튼)
 *   색/서체는 lib/design/tokens 의 V3 상수를 직접 사용 — v3 CSS 변수는
 *   [data-ft-chrome="app"] 스코프라 웹 페이지에선 안 나오기 때문(TS 토큰이
 *   같은 값의 single source). 실스크린샷 아님("예시 화면" 명시, 앱은 로그인
 *   게이트 뒤라 캡처 불가). 가짜 후기·효능 단정 0.
 *
 * 로직/DB 0 — presentation only. 실제 앱 코드는 불침범(토큰 import 만).
 */

import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  Footprints,
  Scale,
  Soup,
  Truck,
} from 'lucide-react'
import { V3, V3Font } from '@/lib/design/tokens'
import { Eyebrow, Display } from '@/components/web/fd/ui'

// ---------------------------------------------------------------------------
// v3 미니 프리미티브 — 실제 Mono / ft-card-v3 / Signature 의 축소 재현
// ---------------------------------------------------------------------------

/** components/v3/Mono 대응 — IBM Plex Mono ALL-CAPS 키커. */
function MonoText({
  children,
  color = V3.inkMute,
  size = 8.5,
  weight = 500,
  upper = true,
  style,
}: {
  children: React.ReactNode
  color?: string
  size?: number
  weight?: number
  upper?: boolean
  style?: React.CSSProperties
}) {
  return (
    <span
      style={{
        fontFamily: V3Font.mono,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: '0.14em',
        textTransform: upper ? 'uppercase' : 'none',
        color,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/** .ft-card-v3 대응 — paperHi + 1px rule + radius 4, 그림자 없음. */
function V3Card({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: V3.paperHi,
        border: `1px solid ${V3.rule}`,
        borderRadius: 4,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** 앱 상단 로고 바 — AppChrome 헤더의 logo-brush 워드마크 축소. */
function AppTopBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '7px 0 6px',
        borderBottom: `1px solid ${V3.ruleSoft}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 목업 내 소형 로고, next/image 불필요 */}
      <img src="/logo-brush.png" alt="" aria-hidden style={{ height: 13, width: 'auto' }} />
    </div>
  )
}

const sans = 'var(--font-sans)'

// ---------------------------------------------------------------------------
// ① 홈 — GreetingSection + DeliveryStripCard + QuickActionChips 미러
// ---------------------------------------------------------------------------
function ScreenHome() {
  return (
    <div style={{ background: V3.paper, height: '100%' }}>
      <AppTopBar />
      <div style={{ padding: '14px 14px 0', position: 'relative' }}>
        {/* kicker: accent dot + mono greeting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: V3.accent }} />
          <MonoText color={V3.ink}>Hello · good morning</MonoText>
        </div>
        <h4
          style={{
            margin: '10px 0 0',
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 17,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            color: V3.ink,
            paddingRight: 78,
          }}
        >
          좋은 아침이에요,
        </h4>
        {/* 우상단 Signature — italic 이름 + FAMILY 키커 + ink bar */}
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >
          <span
            style={{
              fontFamily: sans,
              fontStyle: 'italic',
              fontWeight: 600,
              fontSize: 11,
              color: V3.ink,
              letterSpacing: '-0.015em',
            }}
          >
            보호자님
          </span>
          <MonoText size={7.5} style={{ marginTop: 4 }}>{`FAMILY · 1`}</MonoText>
          <div aria-hidden style={{ marginTop: 8, height: 20, width: 3, background: V3.ink }} />
        </div>
        {/* sub copy + yellow Mark */}
        <div style={{ marginTop: 10, fontFamily: sans, fontSize: 10.5, color: V3.inkSoft, lineHeight: 1.5 }}>
          오늘도 건강한 한 끼를{' '}
          <mark style={{ background: V3.yellow, color: V3.ink, padding: '0 3px', fontWeight: 700 }}>
            정성스럽게.
          </mark>
        </div>
      </div>

      {/* DeliveryStripCard 미러 */}
      <div style={{ padding: '14px 14px 0' }}>
        <V3Card style={{ padding: '9px 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: V3.ink,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Truck size={14} color={V3.yellow} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <MonoText color={V3.accent} size={7.5} weight={700}>D-3</MonoText>
              <MonoText size={7.5}>· 정기배송</MonoText>
            </div>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 700,
                fontSize: 10.5,
                color: V3.ink,
                marginTop: 2,
                letterSpacing: '-0.015em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              금요일 새벽 도착 · 맞춤 화식 박스
            </div>
          </div>
          <ArrowRight size={11} color={V3.inkMute} strokeWidth={2} />
        </V3Card>
      </div>

      {/* QuickActionChips 미러 — 식사(기록함)·산책·체중 */}
      <div style={{ padding: '10px 14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { Icon: Soup, tone: V3.sage, label: '식사', sub: '기록함', done: true },
          { Icon: Footprints, tone: V3.accent, label: '산책', sub: '오늘 기록', done: false },
          { Icon: Scale, tone: V3.ink, label: '체중', sub: '6.4kg', done: false },
        ].map(({ Icon, tone, label, sub, done }) => (
          <V3Card key={label} style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span
              style={{
                width: 24,
                height: 24,
                background: V3.paper,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={13} color={tone} strokeWidth={1.75} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <MonoText size={7}>{label}</MonoText>
              <span
                style={{
                  fontFamily: sans,
                  fontWeight: 700,
                  fontSize: 9.5,
                  color: done ? V3.sage : V3.ink,
                  marginTop: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {done && <Check size={9} color={V3.sage} strokeWidth={2.6} />}
                {sub}
              </span>
            </span>
          </V3Card>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ② 이번 주 기록 — ThisWeekSection 미러 (7일 그리드 + legend + CTA)
// ---------------------------------------------------------------------------
type DayStatus = 'full' | 'partial' | 'miss' | 'today' | 'future'

const WEEK: { date: number; wd: string; status: DayStatus }[] = [
  { date: 22, wd: 'M', status: 'full' },
  { date: 23, wd: 'T', status: 'full' },
  { date: 24, wd: 'W', status: 'partial' },
  { date: 25, wd: 'T', status: 'full' },
  { date: 26, wd: 'F', status: 'today' },
  { date: 27, wd: 'S', status: 'future' },
  { date: 28, wd: 'S', status: 'future' },
]

function dayBg(s: DayStatus) {
  return s === 'full' ? V3.ink : s === 'partial' ? V3.yellow : s === 'today' ? 'transparent' : V3.ruleSoft
}
function dayFg(s: DayStatus) {
  return s === 'full' ? V3.paper : s === 'partial' ? V3.ink : s === 'today' ? V3.accent : V3.inkMute
}

function ScreenWeek() {
  return (
    <div style={{ background: V3.paper, height: '100%' }}>
      <AppTopBar />
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
          <h4
            style={{
              margin: 0,
              fontFamily: sans,
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: '-0.025em',
              color: V3.ink,
            }}
          >
            이번 주 콩이
          </h4>
          <MonoText color={V3.sage} upper={false}>· 연속 12일</MonoText>
        </div>

        <V3Card style={{ padding: '11px 10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {WEEK.map((d) => (
              <div key={d.date} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    aspectRatio: '1',
                    borderRadius: 4,
                    background: dayBg(d.status),
                    border: d.status === 'today' ? `1.5px dashed ${V3.accent}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: sans,
                    fontWeight: 700,
                    fontSize: 9,
                    color: dayFg(d.status),
                  }}
                >
                  {d.date}
                </div>
                <MonoText size={6.5} style={{ display: 'block', marginTop: 4 }}>{d.wd}</MonoText>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              paddingTop: 8,
              borderTop: `1px solid ${V3.rule}`,
            }}
          >
            <div style={{ display: 'flex', gap: 9 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span aria-hidden style={{ width: 6, height: 6, background: V3.ink }} />
                <MonoText size={6.5}>완료</MonoText>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span aria-hidden style={{ width: 6, height: 6, background: V3.yellow }} />
                <MonoText size={6.5}>일부</MonoText>
              </span>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: sans,
                fontWeight: 700,
                fontSize: 9,
                color: V3.accent,
              }}
            >
              오늘 기록하기
              <ArrowRight size={9} color={V3.accent} strokeWidth={2.2} />
            </span>
          </div>
        </V3Card>

        {/* ink hero strip — 연속 기록 (ft-card-ink 톤) */}
        <div
          style={{
            marginTop: 10,
            background: V3.ink,
            borderRadius: 4,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <MonoText color={V3.yellow} size={7}>Streak</MonoText>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 11.5, color: V3.paper, marginTop: 2 }}>
              12일 연속 기록 중
            </div>
          </div>
          <div style={{ fontFamily: sans, fontSize: 9, color: 'rgba(244,237,224,0.65)' }}>
            변화 감지 → 재분석
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ③ 분석 리포트 — v3 리포트 톤 (mono 키커 + BCS 세그먼트 + meta rows)
// ---------------------------------------------------------------------------
function ScreenAnalysis() {
  return (
    <div style={{ background: V3.paper, height: '100%' }}>
      <AppTopBar />
      <div style={{ padding: '14px 14px 0' }}>
        <MonoText color={V3.accent} weight={600}>Report</MonoText>
        <h4
          style={{
            margin: '6px 0 0',
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '-0.025em',
            color: V3.ink,
          }}
        >
          콩이 영양 분석
        </h4>

        <V3Card style={{ marginTop: 10, padding: '10px 11px' }}>
          <MonoText size={7}>체형 점수 · BCS</MonoText>
          <div style={{ display: 'flex', gap: 3, marginTop: 8, alignItems: 'flex-end' }}>
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: i === 4 ? 15 : 10,
                  borderRadius: 2,
                  background: i === 4 ? V3.sage : V3.ruleSoft,
                }}
              />
            ))}
          </div>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 10, color: V3.sage, marginTop: 6 }}>
            5 / 9 · 적정 체형
          </div>
        </V3Card>

        <V3Card style={{ marginTop: 8, padding: '4px 11px' }}>
          {[
            { label: '하루 권장 칼로리', value: '612 kcal' },
            { label: '하루 급여량', value: '340g · 2끼' },
            { label: '잘 맞는 단백질', value: '닭 · 오리' },
          ].map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${V3.rule}`,
                fontFamily: sans,
                fontSize: 9.5,
              }}
            >
              <span style={{ color: V3.inkMute }}>{row.label}</span>
              <span style={{ fontWeight: 700, color: V3.ink }}>{row.value}</span>
            </div>
          ))}
        </V3Card>

        <div style={{ marginTop: 10, fontFamily: sans, fontSize: 9.5, color: V3.inkSoft, lineHeight: 1.5 }}>
          알레르기 응답을 반영해{' '}
          <mark style={{ background: V3.yellow, color: V3.ink, padding: '0 3px', fontWeight: 700 }}>
            소고기 레시피는 제외
          </mark>
          했어요.
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ④ 정기배송 — SubscriptionCard 미러 (헤더 스트립·yellow 틴트 배송행·meta rows)
// ---------------------------------------------------------------------------
function ScreenSubscription() {
  return (
    <div style={{ background: V3.paper, height: '100%' }}>
      <AppTopBar />
      <div style={{ padding: '14px 14px 0' }}>
        <MonoText color={V3.accent} weight={600}>Subscriptions</MonoText>

        <V3Card style={{ marginTop: 10, overflow: 'hidden', padding: 0 }}>
          {/* 헤더 스트립 — paper bg + 상태 mono 키커 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 11px',
              background: V3.paper,
              borderBottom: `1px solid ${V3.rule}`,
            }}
          >
            <MonoText color={V3.sage} size={7.5} weight={700}>● Active · 배송중</MonoText>
            <MonoText size={7}>2주 주기</MonoText>
          </div>

          {/* 다음 배송 하이라이트 — yellow 틴트 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 11px',
              background: 'color-mix(in srgb, #e6b942 12%, transparent)',
              borderBottom: `1px solid ${V3.yellow}`,
            }}
          >
            <Truck size={13} color={V3.yellow} strokeWidth={1.75} />
            <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 10, color: V3.ink }}>
              D-3 · 금요일 새벽 도착
            </span>
          </div>

          {/* 상품 행 — paper 썸네일 박스 + 이름 + 구성 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 11px' }}>
            <div
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: 4,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Soup size={16} color={V3.inkMute} strokeWidth={1.5} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 10.5, color: V3.ink }}>
                콩이 맞춤 화식 박스
              </div>
              <MonoText size={7} style={{ display: 'block', marginTop: 2 }}>
                소고기 50 · 닭고기 50
              </MonoText>
            </div>
          </div>

          {/* meta rows */}
          <div style={{ padding: '0 11px 4px', borderTop: `1px solid ${V3.rule}` }}>
            {[
              { label: '배송 주기', value: '2주마다' },
              { label: '다음 결제', value: '금요일 자동' },
              { label: '누적 배송', value: '3회' },
            ].map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${V3.ruleSoft}`,
                  fontFamily: sans,
                  fontSize: 9,
                }}
              >
                <span style={{ color: V3.inkMute }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: V3.ink }}>{row.value}</span>
              </div>
            ))}
          </div>
        </V3Card>

        {/* 액션 버튼 — v3 radius 4 (pill 아님) */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 0',
              borderRadius: 4,
              background: V3.ink,
              fontFamily: sans,
              fontWeight: 700,
              fontSize: 9.5,
              color: V3.paper,
            }}
          >
            주기 변경
          </div>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 0',
              borderRadius: 4,
              background: V3.paperHi,
              border: `1px solid ${V3.rule}`,
              fontFamily: sans,
              fontWeight: 700,
              fontSize: 9.5,
              color: V3.ink,
            }}
          >
            일시정지
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 기능 정의 — 화면과 설명 페어 (전부 실재 기능, 홈→기록→분석→구독 여정 순)
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
    body: '아이 몸무게와 활동량에 맞춘 하루 급여량과 다음 배송을 홈에서 바로 확인해요. 식사·산책·체중 기록은 탭 한 번이면 끝나요.',
    screen: <ScreenHome />,
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
    body: '한 주의 기록이 한눈에 보이고, 매일의 식사·산책·체중이 아이의 변화 데이터가 돼요. 체중 변화를 감지하면 식단 재분석까지 이어져요.',
    screen: <ScreenWeek />,
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
// 폰 프레임 — 베젤 + 다이나믹 아일랜드 + 스크린 (스크린 bg = v3 paper)
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
          background: V3.paper,
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
        <div style={{ position: 'absolute', inset: 0, paddingTop: 30 }}>{children}</div>
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
