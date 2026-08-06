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
 *   - 모바일: 각 블록 안에 해당 화면 인라인(md:hidden ↔ hidden md:block).
 *
 * # 폰 속 화면 = 실제 앱 실화면 미러 (사장님 스크린샷 4장 기준, 2026-07-02 2차)
 *   1차(v3 토큰 재구성)도 "실제 화면과 다름" 피드백 → 사장님이 실스크린샷
 *   4장(홈/우리 아이/영양 분석/주문하기)을 제공, 그 화면을 그대로 축소 재현:
 *     홈     = AppChrome 헤더(User·logo-ink·강아지칩) + Greeting + ActiveDogCard
 *              (NOW FEATURING·80² 사진·4-col 스탯 체중/연속/분석/배송) + 이번 주
 *     우리아이 = 딥헤더(←) + 탭바(개요·기록·분석·구독) + DOG PROFILE 원형사진
 *              + 정보 rows(성별~활동량) + 현재 박스 컬러바(Basic/Premium/Skin)
 *     분석   = 딥헤더 + 탭바 + kcal/급여량/BCS 스트립 + 오늘의 영양 진단
 *              (dashed 링 사진·배지 칩·강조 카피·AAFCO/NRC) + MER 331
 *     구독   = 딥헤더 + 탭바 + CUSTOM BOX 키커 + 2주 결제 카드 + 화식 비율 선택
 *              (곁들임/반반/완전) + 추천 박스 구성(Duck 50%)
 *   사진 = public AI 예시견(dog-poodle.jpg, 리뷰 로스터와 동일 에셋). 이름은
 *   예시 "콩이"(실고객 아님), "예시 화면" 명시 유지. 수치는 실앱 형식 그대로.
 *   색/서체 = lib/design/tokens V3 상수(v3 CSS 변수는 app 스코프 전용이라).
 *
 * 로직/DB 0 — presentation only. 실제 앱 코드는 불침범(토큰 import 만).
 */

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BellRing,
  Camera,
  Check,
  ChevronDown,
  Heart,
  PawPrint,
  Pill,
  RefreshCw,
  Stethoscope,
  Syringe,
  User,
} from 'lucide-react'
import { V3, V3Font } from '@/lib/design/tokens'
import { stickyScreenIndex } from '@/lib/motion/sticky-progress'
import { Eyebrow, Display } from '@/components/web/fd/ui'

// 라인 컬러 — lib/personalization skuModel 실값(소=와인·돼지=블러시) + V3.
const LINE = {
  yellow: V3.yellow, // Skin
  terracotta: V3.accent, // Basic
  blush: '#C97F8E',
  sage: V3.sage,
  wine: '#9B5B5B', // Premium
}

const sans = 'var(--font-sans)'

// ---------------------------------------------------------------------------
// v3 미니 프리미티브
// ---------------------------------------------------------------------------

/** components/v3/Mono 대응 — mono ALL-CAPS 키커. */
function MonoText({
  children,
  color = V3.inkMute,
  size = 8,
  weight = 500,
  upper = true,
  ls = '0.12em',
  style,
}: {
  children: React.ReactNode
  color?: string
  size?: number
  weight?: number
  upper?: boolean
  ls?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      style={{
        fontFamily: V3Font.mono,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: ls,
        textTransform: upper ? 'uppercase' : 'none',
        color,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/** .ft-card-v3 대응 — paperHi + 1px rule, 그림자 없음. */
function V3Card({
  children,
  radius = 4,
  style,
}: {
  children: React.ReactNode
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: V3.paperHi,
        border: `1px solid ${V3.rule}`,
        borderRadius: radius,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** AppChrome 탭루트 헤더 — 좌 User · 중앙 logo-ink · 우 강아지 칩. */
function AppHeaderHome({ dogName }: { dogName: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: `1px solid ${V3.ruleSoft}`,
      }}
    >
      <User size={14} color={V3.ink} strokeWidth={1.8} />
      {/* eslint-disable-next-line @next/next/no-img-element -- 목업 내 소형 로고 */}
      <img src="/logo-ink.png" alt="" aria-hidden style={{ height: 18, width: 'auto' }} />
      <span
        style={{
          justifySelf: 'end',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          fontFamily: sans,
          fontSize: 9.5,
          fontWeight: 600,
          color: V3.ink,
        }}
      >
        {dogName}
        <ChevronDown size={9} color={V3.ink} strokeWidth={2} />
      </span>
    </div>
  )
}

/** AppChrome 딥화면 헤더 — ← + 화면 제목. */
function AppHeaderDeep({ title }: { title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '9px 12px',
        borderBottom: `1px solid ${V3.ruleSoft}`,
      }}
    >
      <ArrowLeft size={13} color={V3.ink} strokeWidth={2} />
      <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: V3.ink, letterSpacing: '-0.02em' }}>
        {title}
      </span>
    </div>
  )
}

/** 우리 아이 4-탭바 — 개요·기록·분석·구독 (활성 = accent 밑줄). */
function DogTabBar({ active }: { active: '개요' | '기록' | '분석' | '구독' }) {
  const TABS = [
    { label: '개요', Icon: PawPrint },
    { label: '기록', Icon: Camera },
    { label: '분석', Icon: BarChart3 },
    { label: '구독', Icon: RefreshCw },
  ] as const
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderBottom: `1px solid ${V3.rule}`,
      }}
    >
      {TABS.map(({ label, Icon }) => {
        const isActive = label === active
        return (
          <div
            key={label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '7px 0 6px',
              borderBottom: isActive ? `2px solid ${V3.accent}` : '2px solid transparent',
            }}
          >
            <Icon size={12} color={isActive ? V3.ink : V3.inkMute} strokeWidth={isActive ? 2 : 1.7} />
            <span
              style={{
                fontFamily: sans,
                fontSize: 8,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? V3.ink : V3.inkMute,
              }}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 예시견 사진 — public AI 예시 에셋(리뷰 로스터와 동일). */
function DogPhoto({ size, round = false, style }: { size: number; round?: boolean; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 목업 내 소형 예시 사진
    <img
      src="/dog-poodle.jpg"
      alt=""
      aria-hidden
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: round ? 999 : 2,
        boxShadow: round ? 'none' : 'inset 0 0 0 1px rgba(0,0,0,0.16)',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// ① 홈 — 실화면: 헤더 + Greeting + ActiveDogCard(NOW FEATURING·4스탯) + 이번 주
// ---------------------------------------------------------------------------
function ScreenHome() {
  return (
    <div style={{ background: V3.paper, height: '100%', overflow: 'hidden' }}>
      <AppHeaderHome dogName="콩이" />

      {/* Greeting */}
      <div style={{ padding: '11px 12px 0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: 3, background: V3.accent }} />
          <MonoText color={V3.ink}>Hello · good afternoon</MonoText>
        </div>
        <h4
          style={{
            margin: '8px 0 0',
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 15.5,
            letterSpacing: '-0.02em',
            color: V3.ink,
            paddingRight: 66,
          }}
        >
          오후도 활기차게,
        </h4>
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 11,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >
          <span style={{ fontFamily: sans, fontStyle: 'italic', fontWeight: 600, fontSize: 10, color: V3.ink }}>
            보호자님
          </span>
          <MonoText size={7} style={{ marginTop: 3 }}>{`FAMILY · 1`}</MonoText>
          <div aria-hidden style={{ marginTop: 6, height: 16, width: 3, background: V3.ink }} />
        </div>
        <div style={{ marginTop: 7, fontFamily: sans, fontSize: 9.5, color: V3.inkSoft }}>
          오늘도 건강한 한 끼를{' '}
          <mark style={{ background: V3.yellow, color: V3.ink, padding: '0 3px', fontWeight: 700 }}>
            정성스럽게.
          </mark>
        </div>
      </div>

      {/* ActiveDogCard — NOW FEATURING + 사진 + 4-col 스탯 */}
      <div style={{ padding: '10px 12px 0' }}>
        <V3Card style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px 3px' }}>
            <MonoText color={V3.accent} weight={600}>Now featuring</MonoText>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span aria-hidden style={{ width: 5, height: 5, borderRadius: 3, background: V3.sage }} />
              <MonoText size={7.5} color={V3.inkSoft} upper={false}>활성</MonoText>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, padding: '4px 10px 9px' }}>
            <DogPhoto size={46} />
            <div style={{ paddingBottom: 2, minWidth: 0 }}>
              <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 14, color: V3.ink, letterSpacing: '-0.025em' }}>
                콩이
              </div>
              <div style={{ fontFamily: sans, fontSize: 8.5, color: V3.inkSoft, marginTop: 3, whiteSpace: 'nowrap' }}>
                토이푸들 · 5kg · 79일 함께
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: `1px solid ${V3.rule}` }}>
            {[
              { key: '체중', value: '5', sub: 'KG', tone: V3.ink },
              { key: '연속', value: '7', sub: '일', tone: V3.yellow },
              { key: '분석', value: '3', sub: '/ 3', tone: V3.sage },
              { key: '배송', value: 'D-3', sub: '예정', tone: V3.accent },
            ].map((m, i) => (
              <div key={m.key} style={{ padding: '7px 7px', borderLeft: i > 0 ? `1px solid ${V3.rule}` : 'none' }}>
                <MonoText size={6.5}>{m.key}</MonoText>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 3 }}>
                  <span style={{ fontFamily: sans, fontWeight: 800, fontSize: 12.5, color: m.tone, letterSpacing: '-0.025em', lineHeight: 1 }}>
                    {m.value}
                  </span>
                  <MonoText size={6.5} ls="0.06em">{m.sub}</MonoText>
                </div>
              </div>
            ))}
          </div>
        </V3Card>
      </div>

      {/* 이번 주 */}
      <div style={{ padding: '11px 12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: sans, fontWeight: 800, fontSize: 12, color: V3.ink, letterSpacing: '-0.025em' }}>
            이번 주 콩이
          </span>
          <MonoText color={V3.sage} size={7} upper={false}>· 연속 7일</MonoText>
        </div>
        <V3Card style={{ padding: '8px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {[
              { d: 26, w: 'F', s: 'full' },
              { d: 27, w: 'S', s: 'full' },
              { d: 28, w: 'S', s: 'partial' },
              { d: 29, w: 'M', s: 'full' },
              { d: 30, w: 'T', s: 'full' },
              { d: 1, w: 'W', s: 'full' },
              { d: 2, w: 'T', s: 'today' },
            ].map((day) => (
              <div key={`${day.d}`} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    aspectRatio: '1',
                    borderRadius: 3,
                    background: day.s === 'full' ? V3.ink : day.s === 'partial' ? V3.yellow : day.s === 'today' ? 'transparent' : V3.ruleSoft,
                    border: day.s === 'today' ? `1.5px dashed ${V3.accent}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: sans,
                    fontWeight: 700,
                    fontSize: 8,
                    color: day.s === 'full' ? V3.paper : day.s === 'today' ? V3.accent : V3.ink,
                  }}
                >
                  {day.d}
                </div>
                <MonoText size={6} style={{ display: 'block', marginTop: 3 }}>{day.w}</MonoText>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 7,
              paddingTop: 6,
              borderTop: `1px solid ${V3.rule}`,
            }}
          >
            <div style={{ display: 'flex', gap: 7 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span aria-hidden style={{ width: 5, height: 5, background: V3.ink }} />
                <MonoText size={6}>완료</MonoText>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span aria-hidden style={{ width: 5, height: 5, background: V3.yellow }} />
                <MonoText size={6}>일부</MonoText>
              </span>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: sans, fontWeight: 700, fontSize: 8, color: V3.accent }}>
              오늘 기록하기
              <ArrowRight size={8} color={V3.accent} strokeWidth={2.2} />
            </span>
          </div>
        </V3Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ② 우리 아이(개요) — 탭바 + DOG PROFILE + 정보 rows + 현재 박스 컬러바
// ---------------------------------------------------------------------------
function ScreenDog() {
  return (
    <div style={{ background: V3.paper, height: '100%', overflow: 'hidden' }}>
      <AppHeaderDeep title="우리 아이" />
      <DogTabBar active="개요" />

      <div style={{ padding: '10px 12px 0' }}>
        {/* 프로필 카드 */}
        <V3Card style={{ padding: '13px 10px 12px', textAlign: 'center' }}>
          <DogPhoto size={52} round style={{ margin: '0 auto' }} />
          <MonoText color={V3.accent} size={7} ls="0.28em" style={{ display: 'block', marginTop: 8 }}>
            Dog Profile
          </MonoText>
          <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 15, color: V3.ink, letterSpacing: '-0.025em', marginTop: 4 }}>
            콩이
          </div>
          <div style={{ fontFamily: sans, fontSize: 8.5, color: V3.inkMute, marginTop: 3 }}>토이푸들</div>
        </V3Card>

        {/* 정보 rows */}
        <V3Card style={{ padding: '2px 11px', marginTop: 8 }}>
          {[
            { label: '성별', value: '여아', sage: false },
            { label: '중성화', value: '✓ 했어요', sage: true },
            { label: '나이', value: '5살', sage: false },
            { label: '체중', value: '5kg', sage: false },
            { label: '활동량', value: '보통', sage: false },
          ].map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6.5px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${V3.ruleSoft}`,
                fontFamily: sans,
                fontSize: 9,
              }}
            >
              <span style={{ color: V3.inkMute }}>{row.label}</span>
              <span style={{ fontWeight: 700, color: row.sage ? V3.sage : V3.ink }}>{row.value}</span>
            </div>
          ))}
        </V3Card>

        {/* 현재 박스 — 컬러 스택바 + 레전드 */}
        <V3Card style={{ padding: '9px 11px', marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Heart size={9} color={V3.accent} strokeWidth={2} />
              <MonoText color={V3.accent} size={7} weight={600} ls="0.18em">현재 박스 · Cycle 1</MonoText>
            </span>
            <span style={{ fontFamily: sans, fontSize: 7.5, color: V3.inkMute }}>
              히스토리 <span style={{ color: V3.accent, fontWeight: 700 }}>상세 →</span>
            </span>
          </div>
          {/* ★모의 화면도 실제 규칙을 지킨다(2026-08-03 검수). 예전엔 5색 막대에
              "Basic 30% · Premium 30% · Skin 20%" 라고 적혀 있었는데 세 가지가
              한꺼번에 틀렸다:
                ① 박스는 **최대 2종**이다(boxComposition — 1종 100% / 2종 50:50).
                   5종 막대는 실제로 존재하지 않는 박스다.
                ② Basic·Premium·Skin 은 **내부 라인 코드**다. 고객 표기는 원물명
                   (치킨·한우·오리·흑돼지 — skuModel nameKo).
                ③ 비율 %는 고객 문구에서 금지다(사장님 2026-07-23) — 두 원물이면
                   무조건 반반이라 %는 오해를 부른다.
              앱 소개 화면이 앱과 다른 규칙으로 그려져 있으면, 그 그림을 보고 온
              고객이 실제 앱에서 다른 걸 보게 된다. */}
          <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
            {[
              { c: LINE.terracotta, w: 50 },
              { c: LINE.wine, w: 50 },
            ].map((seg, i) => (
              <div key={i} style={{ width: `${seg.w}%`, background: seg.c }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
            {[
              { c: LINE.terracotta, label: '치킨' },
              { c: LINE.wine, label: '한우' },
            ].map((l) => (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: 3, background: l.c }} />
                <span style={{ fontFamily: sans, fontSize: 7.5, color: V3.inkSoft }}>
                  {l.label}
                </span>
              </span>
            ))}
          </div>
        </V3Card>

        {/* SUBSCRIPTION 섹션 헤더 (하단 클립) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
          <RefreshCw size={9} color={V3.accent} strokeWidth={2} />
          <MonoText color={V3.accent} size={7.5} weight={600} ls="0.2em">Subscription</MonoText>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ③ 영양 분석 — kcal 스트립 + 오늘의 영양 진단 + 배지/강조 카피 + MER
// ---------------------------------------------------------------------------
function ScreenAnalysis() {
  return (
    <div style={{ background: V3.paper, height: '100%', overflow: 'hidden' }}>
      <AppHeaderDeep title="영양 분석" />
      <DogTabBar active="분석" />

      {/* 상단 요약 스트립 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          background: V3.paperHi,
          borderBottom: `1px solid ${V3.ruleSoft}`,
          fontFamily: sans,
          fontSize: 7.5,
          color: V3.inkSoft,
        }}
      >
        <span>
          <b style={{ color: V3.accent }}>331 kcal</b>
          {'  ·  '}⚖ 217g{'  ·  '}BCS 5/9
        </span>
        <span style={{ color: V3.inkMute }}>2026년 6월 19일</span>
      </div>

      <div style={{ padding: '12px 12px 0', textAlign: 'center' }}>
        <MonoText color={V3.accent} size={7.5} ls="0.32em">오늘의 영양 진단</MonoText>
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 999,
            border: `1.5px dashed ${V3.accent}`,
            padding: 3,
            margin: '9px auto 0',
          }}
        >
          <DogPhoto size={52} round />
        </div>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 15.5, color: V3.ink, letterSpacing: '-0.025em', marginTop: 8 }}>
          콩이의 식단
        </div>
        <div style={{ fontFamily: sans, fontSize: 8.5, color: V3.inkMute, marginTop: 3 }}>5세 · 토이푸들 · 5kg</div>

        {/* 진단 카드 */}
        <V3Card radius={10} style={{ padding: '10px 11px', marginTop: 10, textAlign: 'left', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: '#FFF', background: V3.accent, borderRadius: 999, padding: '3px 7px' }}>
              성견 (유지기)
            </span>
            <span style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: V3.ink, background: V3.paperDeep, borderRadius: 999, padding: '3px 7px' }}>
              BCS 5/9
            </span>
            <span style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: V3.ink, background: V3.paperDeep, borderRadius: 999, padding: '3px 7px' }}>
              단백 32% 이상
            </span>
          </div>
          <div style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: V3.ink, lineHeight: 1.55, marginTop: 8, wordBreak: 'keep-all' }}>
            단백질은 <span style={{ color: V3.accent }}>넉넉히</span>, 지방은{' '}
            <span style={{ color: '#B8860B' }}>균형 있게</span>
            <br />
            콩이의 BCS 5/9 체형에{' '}
            <mark style={{ background: V3.yellow, color: V3.ink, padding: '0 2px' }}>맞춤 식단을 준비했어요.</mark>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 9,
              paddingTop: 7,
              borderTop: `1px solid ${V3.ruleSoft}`,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: V3.sage }}>
              <Check size={8} strokeWidth={2.6} /> AAFCO 2024 · NRC 2006 기준 충족
            </span>
            <span style={{ fontFamily: sans, fontSize: 7, color: V3.inkMute }}>분석 · 6월 19일</span>
          </div>
        </V3Card>

        {/* DAILY ENERGY · MER (하단 클립) */}
        <V3Card radius={10} style={{ padding: '10px 11px 4px', marginTop: 8, textAlign: 'left' }}>
          <MonoText size={7} ls="0.24em">Daily Energy · MER</MonoText>
          <div style={{ fontFamily: sans, fontSize: 8, color: V3.inkSoft, marginTop: 4 }}>
            콩이가 하루 체중 유지에 필요한 에너지
          </div>
          <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 26, color: V3.accent, letterSpacing: '-0.03em', marginTop: 2 }}>
            331 <span style={{ fontSize: 10, color: V3.inkMute, fontWeight: 700 }}>kcal</span>
          </div>
        </V3Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ④ 구독(주문하기) — CUSTOM BOX 키커 + 2주 결제 카드 + 화식 비율 선택 + 박스 구성
// ---------------------------------------------------------------------------
function ScreenSubscription() {
  return (
    <div style={{ background: V3.paper, height: '100%', overflow: 'hidden' }}>
      <AppHeaderDeep title="주문하기" />
      <DogTabBar active="구독" />

      <div style={{ padding: '10px 12px 0' }}>
        <MonoText color={V3.accent} size={7.5} weight={600} ls="0.16em">Custom Box · Cycle 1</MonoText>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 13.5,
            lineHeight: 1.3,
            color: V3.ink,
            letterSpacing: '-0.025em',
            marginTop: 5,
            wordBreak: 'keep-all',
          }}
        >
          콩이 맞춤 박스
          <br />
          정기배송으로 시작할까요?
        </div>
        <div style={{ fontFamily: sans, fontSize: 8, color: V3.inkSoft, lineHeight: 1.5, marginTop: 5 }}>
          분석 결과 그대로 만든 박스를 2주마다 보내드려요. 다음 결제 전까지 일시정지·해지할 수 있어요.
        </div>

        {/* 2주 결제 카드 — accent 보더 (배송·결제는 무조건 2주마다 화요일) */}
        <div style={{ border: `1.5px solid ${V3.accent}`, borderRadius: 10, background: V3.paperHi, padding: '3px 11px', marginTop: 8 }}>
          {[
            { label: '받는 것', value: '콩이 맞춤 박스 · 2주치', accent: false },
            { label: '화식 비율', value: '완전 화식 (100%)', accent: false },
            { label: '첫 배송', value: '첫 화요일 발송 · 이후 2주마다', accent: false },
            { label: '2주 결제', value: '177,000원 /2주', accent: true },
          ].map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6.5px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${V3.ruleSoft}`,
                fontFamily: sans,
                fontSize: 8.5,
              }}
            >
              <span style={{ color: V3.inkMute }}>{row.label}</span>
              <span style={{ fontWeight: 800, color: row.accent ? V3.accent : V3.ink, fontSize: row.accent ? 11 : 8.5 }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* 기준 배지 */}
        <div style={{ display: 'flex', gap: 4, marginTop: 7, flexWrap: 'wrap' }}>
          {['✓ AAFCO 2024 충족', 'NRC · FEDIAF 기준', '±5% 정량'].map((b) => (
            <span
              key={b}
              style={{
                fontFamily: sans,
                fontSize: 7,
                fontWeight: 700,
                color: V3.inkSoft,
                background: V3.paperHi,
                border: `1px solid ${V3.rule}`,
                borderRadius: 999,
                padding: '3px 7px',
              }}
            >
              {b}
            </span>
          ))}
        </div>

        {/* 화식 비율 선택 — 배송은 2주 고정, 고객이 고르는 건 화식 비율(30/50/100). */}
        <MonoText size={7} ls="0.18em" style={{ display: 'block', marginTop: 9 }}>
          화식 비율 선택
        </MonoText>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginTop: 6 }}>
          <V3Card radius={8} style={{ padding: '9px 5px', textAlign: 'center' }}>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 10, color: V3.ink }}>곁들임</div>
            <div style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: V3.inkMute, marginTop: 2 }}>화식 30%</div>
          </V3Card>
          <V3Card radius={8} style={{ padding: '9px 5px', textAlign: 'center' }}>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 10, color: V3.ink }}>반반</div>
            <div style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: V3.inkMute, marginTop: 2 }}>화식 50%</div>
          </V3Card>
          <div
            style={{
              border: `1.5px solid ${V3.accent}`,
              borderRadius: 8,
              background: 'color-mix(in srgb, #C86B45 6%, #FFFFFF)',
              padding: '9px 5px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 10, color: V3.ink }}>완전</div>
            <div style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: V3.accent, marginTop: 2 }}>화식 100%</div>
          </div>
        </div>

        {/* 추천 박스 구성 (하단 클립) */}
        <MonoText size={7} ls="0.18em" style={{ display: 'block', marginTop: 9 }}>
          추천 박스 구성
        </MonoText>
        <V3Card radius={8} style={{ marginTop: 6, padding: '8px 9px', borderLeft: `3px solid ${LINE.sage}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: V3Font.mono, fontSize: 8, fontWeight: 700, color: V3.ink }}>
              Duck · 오리 · 알레르기·장건강
            </span>
            <span style={{ fontFamily: V3Font.mono, fontSize: 8.5, fontWeight: 700, color: V3.sage }}>50%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ fontFamily: sans, fontSize: 6.5, fontWeight: 700, color: '#FFF', background: V3.accent, borderRadius: 3, padding: '1.5px 4px' }}>
              메인
            </span>
            <span style={{ fontFamily: sans, fontSize: 7.5, color: V3.inkSoft }}>일일 105g · 한 끼 110g</span>
          </div>
        </V3Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ⑤ 리마인더(건강 수첩) — 투약·예방접종·병원 일정 (실화면: /dogs/[id]/reminders·
//    medications·vaccinations — 전부 실재 라우트)
// ---------------------------------------------------------------------------
function ScreenHealth() {
  return (
    <div style={{ background: V3.paper, height: '100%', overflow: 'hidden' }}>
      <AppHeaderDeep title="리마인더" />

      <div style={{ padding: '10px 12px 0' }}>
        <MonoText color={V3.accent} size={7.5} weight={600} ls="0.18em">Health Care</MonoText>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 13.5, color: V3.ink, letterSpacing: '-0.025em', marginTop: 5 }}>
          콩이 건강 수첩
        </div>
        <div style={{ fontFamily: sans, fontSize: 8, color: V3.inkSoft, marginTop: 3 }}>
          투약·접종·병원 일정을 앱이 대신 기억해요
        </div>

        {/* 오늘 — 투약 카드 */}
        <MonoText size={7} ls="0.18em" style={{ display: 'block', marginTop: 10 }}>오늘</MonoText>
        <V3Card style={{ marginTop: 5, padding: '9px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            aria-hidden
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              background: V3.ink,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Pill size={13} color={V3.yellow} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 9.5, color: V3.ink }}>관절 영양제 · 저녁</div>
            <div style={{ fontFamily: sans, fontSize: 7.5, color: V3.inkMute, marginTop: 1.5 }}>하루 2회 · 밥 직후 복용</div>
          </div>
          <span style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 800, color: V3.accent, background: 'color-mix(in srgb, #C86B45 10%, transparent)', borderRadius: 999, padding: '3px 7px' }}>
            오후 8시
          </span>
        </V3Card>

        {/* 다가오는 일정 */}
        <MonoText size={7} ls="0.18em" style={{ display: 'block', marginTop: 10 }}>다가오는 일정</MonoText>
        <V3Card style={{ marginTop: 5, padding: '2px 10px' }}>
          {[
            { Icon: Syringe, label: '종합백신 추가 접종', sub: '예방접종 수첩', d: 'D-14' },
            { Icon: Stethoscope, label: '정기 건강검진', sub: '단골 동물병원', d: '7월 12일' },
            { Icon: BellRing, label: '심장사상충 예방', sub: '매월 반복', d: '매월 1일' },
          ].map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${V3.ruleSoft}`,
              }}
            >
              <row.Icon size={12} color={V3.inkMute} strokeWidth={1.75} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 9, color: V3.ink }}>{row.label}</div>
                <div style={{ fontFamily: sans, fontSize: 7, color: V3.inkMute, marginTop: 1 }}>{row.sub}</div>
              </div>
              <MonoText color={V3.accent} size={7.5} weight={700}>{row.d}</MonoText>
            </div>
          ))}
        </V3Card>

        {/* 푸시 알림 안내 */}
        <div
          style={{
            marginTop: 8,
            background: V3.ink,
            borderRadius: 4,
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <BellRing size={11} color={V3.yellow} strokeWidth={2} />
          <span style={{ fontFamily: sans, fontSize: 8, fontWeight: 600, color: V3.paper }}>
            시간이 되면 푸시로 알려드려요 — 잊을 걱정 없이
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ⑥ 수의사 공유 — 실화면: /dogs/[id]/vet-report (수의사용 요약 리포트 공유)
// ---------------------------------------------------------------------------
function ScreenVet() {
  return (
    <div style={{ background: V3.paper, height: '100%', overflow: 'hidden' }}>
      <AppHeaderDeep title="수의사 공유" />

      <div style={{ padding: '10px 12px 0' }}>
        <MonoText color={V3.accent} size={7.5} weight={600} ls="0.18em">Vet Report</MonoText>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 13.5, color: V3.ink, letterSpacing: '-0.025em', marginTop: 5 }}>
          수의사에게 보여주기
        </div>
        <div style={{ fontFamily: sans, fontSize: 8, color: V3.inkSoft, marginTop: 3 }}>
          동물병원 갈 때 분석을 한 장으로 정리해 드려요
        </div>

        {/* 요약 리포트 rows */}
        <V3Card style={{ marginTop: 10, padding: '2px 10px' }}>
          {[
            { k: '체중', v: '5.2kg' },
            { k: '체형 (BCS)', v: '5/9 · 정상' },
            { k: '하루 급여량', v: '252g' },
            { k: '화식 구성', v: '완전 화식' },
          ].map((r, i) => (
            <div
              key={r.k}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '7.5px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${V3.ruleSoft}`,
              }}
            >
              <span style={{ fontFamily: sans, fontSize: 8.5, color: V3.inkMute }}>{r.k}</span>
              <span style={{ fontFamily: sans, fontSize: 9, fontWeight: 700, color: V3.ink }}>{r.v}</span>
            </div>
          ))}
        </V3Card>

        {/* 공유 버튼 — 실화면 '수의사에게 보여주기' */}
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            padding: '9px 0',
            borderRadius: 4,
            background: V3.ink,
            fontFamily: sans,
            fontWeight: 700,
            fontSize: 9.5,
            color: V3.paper,
          }}
        >
          <Stethoscope size={11} strokeWidth={2} /> 수의사에게 보여주기
        </div>
        <div style={{ fontFamily: sans, fontSize: 7.5, color: V3.inkMute, textAlign: 'center', marginTop: 5 }}>
          링크를 열면 AAFCO·NRC 기준 충족까지 한눈에 보여요
        </div>

        {/* 공유 링크 상태 */}
        <MonoText size={7} ls="0.18em" style={{ display: 'block', marginTop: 10 }}>공유 링크 · 유효</MonoText>
        <V3Card style={{ marginTop: 5, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: 3, background: V3.sage, flexShrink: 0 }} />
          <span style={{ flex: 1, fontFamily: sans, fontSize: 8.5, fontWeight: 600, color: V3.inkSoft }}>
            farmerstail.kr/vet/···· · 7일간 열람 가능
          </span>
          <MonoText size={7} weight={700} style={{ color: V3.sage }}>활성</MonoText>
        </V3Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 기능 정의 — 화면과 설명 페어 (실화면 여정 순: 홈 → 우리 아이 → 분석 → 구독)
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
    body: '앱을 열면 체중·연속 기록·분석 진행·다음 배송까지 오늘 필요한 것들이 한 화면에 모여 있어요. 이번 주에 며칠 기록했는지 한눈에 보이고, 식사·산책·체중 기록은 화면을 옮길 필요 없이 탭 한 번이면 끝나요. 매일 쓰는 앱이라, 무엇보다 가볍게 만들었어요.',
    screen: <ScreenHome />,
  },
  {
    key: 'dog',
    eyebrow: 'My Dogs',
    title: (
      <>
        아이의 모든 것이
        <br />한 곳에 모여요
      </>
    ),
    body: '성별·중성화·활동량 같은 프로필부터 지금 먹고 있는 박스가 어떤 레시피로 구성됐는지까지 — 개요·기록·분석·구독 네 개의 탭으로 아이의 전부를 오가요. 여러 마리 키우는 집이라면 아이마다 프로필을 만들어 따로따로 관리할 수 있어요.',
    screen: <ScreenDog />,
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
    body: '체형 점수(BCS)와 하루 필요 에너지(MER), 급여량, 잘 맞는 단백질 구성까지 — 오늘의 영양 진단 리포트로 확인해요. 알레르기 응답은 레시피에서 자동으로 빠지고, AAFCO·NRC 기준 충족 여부도 리포트에 그대로 적혀 있어요. 기록이 쌓여 체중 변화가 감지되면 재분석으로 이어져요.',
    screen: <ScreenAnalysis />,
  },
  {
    key: 'health',
    eyebrow: 'Health Care',
    title: (
      <>
        투약부터 접종까지,
        <br />
        건강 수첩이 대신 기억해요
      </>
    ),
    body: '영양제 시간, 예방접종 D-day, 병원 정기검진 — 보호자가 머릿속으로 챙기던 것들을 앱에 맡겨요. 투약·예방접종 수첩에 기록해두면 시간에 맞춰 푸시로 알려드리고, 병원 갈 때는 기록을 수의사 리포트로 정리해 보여줄 수도 있어요.',
    screen: <ScreenHealth />,
  },
  {
    key: 'vet',
    eyebrow: 'Vet Report',
    title: (
      <>
        동물병원 갈 때,
        <br />
        분석 결과를 그대로 공유
      </>
    ),
    body: '체중·체형·하루 급여량·화식 구성을 수의사용 리포트 한 장으로 정리해, 링크 하나로 보여줘요. 진료실에서 "뭘 먹이나요"에 화면을 바로 보여줄 수 있고, AAFCO·NRC 기준 충족 여부도 그대로 담겨 있어요. 우리 아이 케어가 병원과 자연스럽게 이어져요.',
    screen: <ScreenVet />,
  },
  {
    key: 'subscription',
    eyebrow: 'Subscription',
    title: (
      <>
        분석 그대로,
        <br />
        맞춤 박스 정기배송
      </>
    ),
    body: '분석 결과 그대로 만든 맞춤 박스를 2주마다 받아요. 곁들임·반반·완전 화식 중 우리 아이에 맞는 비율을 고르고, 박스에 담기는 레시피 구성과 가격을 투명하게 확인해요. 비율 변경·일시정지·해지도 전부 앱 안에서 몇 번의 탭이면 돼요.',
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
  /** px 숫자 또는 CSS 길이 문자열(calc/min 허용 — 모바일 쇼케이스가 svh 기반으로 줌). */
  width?: number | string
}) {
  return (
    <div
      style={{
        width,
        aspectRatio: '9 / 19.5',
        // ★베젤 얇게(2026-08-03, 사장님: "핸드폰 목업 프레임이 너무 두꺼워").
        //   padding 10 은 292px 폭 기준 실제 폰의 3배가 넘는 테두리다 — 요즘
        //   기기는 화면이 가장자리까지 온다. 4px 로 줄이고 반경도 같이 조인다
        //   (테두리가 얇아지면 큰 반경은 어색해진다).
        borderRadius: 40,
        background: '#1E1A14',
        padding: 4,
        boxShadow: '0 24px 60px rgba(30,26,20,0.22), inset 0 0 0 1.5px rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 36,
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
  // 모바일 핀 쇼케이스 컨테이너 + 마지막 인덱스(60fps onUpdate 에서 setState
  // 폭주를 막는 가드).
  const mobRef = useRef<HTMLDivElement | null>(null)
  const mobLast = useRef(0)
  // active 를 effect 의존성에 넣으면 전환마다 리스너가 재등록된다 — ref 로 읽는다.
  const activeRef = useRef(0)

  // ★모바일 = CSS sticky + 스크롤 진행도(2026-08-05 재작성).
  //   처음엔 GSAP ScrollTrigger 의 pin 을 썼는데, **pin 은 고정하는 순간의
  //   크기를 인라인으로 박는다.** 그래서 창을 넓히거나 폰을 가로로 돌리면
  //   컨테이너는 옛 폭(실측 335px)에 멈춰 있고 폰만 CSS calc 로 커져
  //   (350px) 화면 밖으로 밀려났다. invalidateOnRefresh + 수동 refresh 로도
  //   인라인 폭이 안 풀렸다(실측).
  //   position: sticky 는 리사이즈 대응이 **브라우저 기본 동작**이라 그 문제가
  //   구조적으로 없다. 인덱스는 스크롤 위치를 읽는 순수 계산이라 라이브러리도
  //   필요 없다 — reduced-motion 이나 JS 실패 시에도 sticky 는 그대로 돌고,
  //   화면만 첫 장에 머문다(깨지지 않는다).
  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const el = mobRef.current
    if (!el) return
    // 진행도 → 인덱스. 스크롤 위치만 읽는 순수 계산이라 라이브러리가 필요 없다.
    const onScroll = () => {
      if (window.innerWidth >= 768) return
      const track = el.parentElement // 스크롤 길이를 가진 바깥 트랙
      if (!track) return
      const r = track.getBoundingClientRect()
      // 산수는 lib/motion/sticky-progress 가 정본 — 이 파일은 배선만 한다.
      // (개발 패널에서는 scroll 이벤트가 안 와서 배선을 실측할 수 없다.
      //  그래서 틀릴 수 있는 계산만 떼어내 테스트로 고정했다.)
      const idx = stickyScreenIndex(
        r.top,
        r.height,
        window.innerHeight,
        FEATURES.length,
      )
      // ★ref 가 아니라 실제 active 와 비교한다(2026-08-07 회귀 감사).
      //   데스크톱 경로(IO)가 active 를 k 로 바꾼 뒤 뷰포트가 768px 아래로
      //   내려오면(폰을 가로→세로로 돌리면), 스크롤 계산이 0 을 내도
      //   `0 === mobLast.current`(초기 0) 라 setActive 가 안 불려 **제목·폰이
      //   k 번 화면에 고정**된다. 첫 경계를 지나야 풀린다.
      if (idx !== mobLast.current || idx !== activeRef.current) {
        mobLast.current = idx
        setActive(idx)
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // reduced-motion 은 globals.css 전역 @media 가 transition-duration 을 0 으로
  // 강제(!important, 인라인 스타일도 덮음) — JS 분기 불필요.
  useEffect(() => {
    const blocks = blockRefs.current.filter(Boolean) as HTMLDivElement[]
    if (blocks.length === 0) return
    // 뷰포트 중앙 밴드에 들어온 블록을 활성으로 — 스크롤 방향과 무관하게
    // "지금 읽고 있는 블록"과 폰 화면이 일치한다.
    //
    // 데스크톱 전용 — 모바일은 GSAP 핀 쇼케이스가 active 를 직접 몬다(아래
    // useEffect). 이 IO 는 데스크톱 텍스트 블록(hidden md:grid 안)만 본다.
    const band = '-42% 0px -42% 0px'
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idx = blocks.indexOf(e.target as HTMLDivElement)
          if (idx >= 0) setActive(idx)
        }
      },
      { rootMargin: band, threshold: 0 },
    )
    blocks.forEach((b) => io.observe(b))
    return () => io.disconnect()
  }, [])

  return (
    <div className="mx-auto px-5 md:px-8" style={{ maxWidth: 1140 }}>
      {/* 모바일 핀 쇼케이스 — 화면 하나에 [제목 + 폰] 한 세트. 스크롤이
          세트를 넘긴다(위 useEffect 가 핀 + 인덱스 구동). 폰은 232px — 목업
          내부가 248px 기준 설계라 이 아래로 줄이면 깨진다(152px 실증). */}
      {/* ★레이아웃(2026-08-05, 사장님 피드백 2건):
          ① "제목이 아예 가려져" — 원인은 사이트 헤더(프로모바+내비, 고정 ~92px)가
             핀 컨테이너 위를 덮는 것. paddingTop 으로 그 아래에서 시작한다.
          ② "핸드폰 아래쪽 20%를 아래쪽에 숨기는 그림" — 폰 래퍼를 바닥에 붙이고
             translateY(20%), 컨테이너 overflow hidden 으로 그 20% 를 뷰포트
             아래로 잠근다. 폰이 바닥에서 솟아오른 그림 — 화면 위쪽이 온전히
             제목 몫이 된다. 잠긴 만큼 폰을 키울 수 있다(272px, 작은 기기는
             svh 기반으로 자동 축소 — 0.577 = 9/19.5÷0.8 역산). */}
      {/* 바깥 트랙 — 스크롤 길이를 만든다(feature 당 620px + 화면 한 장).
          안쪽 sticky 가 그 동안 화면에 붙어 있고, 진행도가 화면을 넘긴다. */}
      <div className="md:hidden" style={{ height: `calc(100svh + ${FEATURES.length * 620}px)` }}>
      <div
        ref={mobRef}
        className="flex flex-col items-center overflow-hidden sticky top-0"
        style={{ height: '100svh', minHeight: 560, paddingTop: 96 }}
      >
        {/* ★내용 폭 상한(2026-08-05, 사장님: "반응형 제대로 안 먹히고").
            이 블록은 md 미만 전부(≈320~767px)가 쓰는데, 폰은 272px 고정이라
            폭이 넓어질수록 좌우가 휑해졌다 — 767px 실측에서 **여백이 폰보다
            넓었다**(한쪽 248px, 폰 대비 182%). 제목도 567px 로 늘어나 한 줄에
            다 들어가면서 리듬이 무너졌다.
            2단 그리드를 더 일찍 켜는 것도 재봤지만 640px 에선 글 칼럼이
            288px 이라 한국어 본문이 읽기 나쁘다.
            그래서 **내용만 420px 로 모으고 가운데 정렬**한다 — 좁은 폰에서는
            그대로고, 태블릿·좁힌 데스크톱에서는 모바일 화면이 가운데 놓인
            자연스러운 구도가 된다. 흔한 패턴이고 가장 적은 변경이다. */}
        <div
          className="flex flex-col items-center w-full"
          style={{ maxWidth: 420, flex: 1, minHeight: 0 }}
        >
        {/* 제목 스택 — 폰과 같은 인덱스로 crossfade. 높이를 고정해 폰이 안 튄다.
            ★flexShrink 0 이 없으면 세로가 짧은 기기에서 **118 → 0 으로 완전히
            찌그러진다**(393×660 실측). 그러면 안쪽 absolute 제목이 박스 밖으로
            튀어나와 캡션 위에 겹치고, 폰까지 위로 당겨져 제목을 덮는다 —
            사장님 실기기 스크린샷이 정확히 그 그림이었다.
            내 검증은 812·814 세로만 봤다. Safari 주소창이 차지하는 실효 세로
            (≈660)에서만 나타나는 조건이라 못 잡았다. */}
        <div className="relative w-full" style={{ height: 118, flexShrink: 0 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.key}
              aria-hidden={active !== i}
              className="absolute inset-0 flex flex-col items-center text-center px-6"
              style={{
                opacity: active === i ? 1 : 0,
                transform: active === i ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
                pointerEvents: 'none',
              }}
            >
              <Eyebrow>{f.eyebrow}</Eyebrow>
              <h3
                // mt-2(8) → 14: 사장님 "아주 살짝만 아래로". 제목 칸(118) 안에서
                // 미는 거라 세로 예산(PHONE_TOP_RESERVED 272)은 그대로다 —
                // 컨테이너 패딩을 건드리면 폰 크기가 같이 어긋난다.
                style={{
                  marginTop: 14,
                  fontFamily: 'var(--font-display)',
                  fontSize: 21,
                  lineHeight: 1.25,
                  fontWeight: 850, // "살짝만 볼드하게" — 800 → 850
                  color: 'var(--fd-pine)',
                  letterSpacing: '-0.02em',
                }}
              >
                {f.title}
              </h3>
            </div>
          ))}
        </div>

        {/* 진행 점 + 캡션 — 제목 바로 아래. 폰 아래는 뷰포트 밖이라 못 둔다. */}
        <div className="mt-2 flex items-center gap-1.5 shrink-0" aria-hidden>
          {FEATURES.map((f, i) => (
            <span
              key={f.key}
              style={{
                width: active === i ? 16 : 5,
                height: 5,
                borderRadius: 999,
                background: active === i ? 'var(--fd-coral)' : 'var(--fd-line)',
                transition: 'width 0.3s ease, background 0.3s ease',
              }}
            />
          ))}
        </div>
        <p
          className="mt-2 shrink-0"
          style={{ fontSize: 10, fontWeight: 600, color: 'var(--fd-muted)' }}
        >
          이해를 돕기 위한 예시 화면이에요
        </p>

        {/* ★폰은 캡션 **바로 아래**에 붙인다(2026-08-05).
            전에는 marginTop:auto 로 바닥에 밀어붙였는데, 그러면 남는 세로가
            전부 캡션↔폰 사이 빈칸이 된다 — 607px 실측 130~151px. 화면이
            휑해 보이던 두 번째 원인이다.
            고정 간격으로 붙이면 폰 하단이 자연히 화면 밖으로 나가 "바닥에서
            솟아오른" 구도는 그대로 유지되고, 잠기는 양은 기기 세로에 따라
            0~15% 로 알아서 정해진다(전에는 폰이 상한에 걸려 30%까지 잠겼다). */}
        <div style={{ marginTop: 24, flexShrink: 0 }}>
          {/* 세로 예산에서 역산한 크기 — 세 제약의 최솟값.
              · 350px  : 상한(그 이상은 목업이 커도 이득이 없다)
              · 100vw-72: 좁은 폰에서 좌우 최소 36px 확보
              · svh 식  : 제목·점·캡션을 뺀 남은 세로에 딱 맞게(0.577 = 9/19.5÷0.8,
                          하단 20% 잠김을 감안한 역산)
              272 = 위쪽 고정분(패딩 96 + 제목 118 + 점·캡션·간격 ≈58). 이 값을
              208 로 낮췄던 적이 있는데(빈칸이 커 보여서), 그건 marginTop:auto 가
              빈칸을 벌린 게 원인이었고 폰이 커지자 **세로 660 기기에서 32% 나
              잘렸다**. 원인을 고쳤으니 예산도 제자리로 돌린다. */}
          <PhoneFrame
            width={'min(350px, calc(100vw - 72px), calc((100svh - 272px) * 0.577))'}
          >
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
        </div>
        </div>

      </div>
      </div>

      {/* ★모바일 쇼케이스 전면 재작성(2026-08-05, 사장님: "이게 우리가 생각했던
          그 페이지의 그림은 아니지 않냐" + 실스크린샷).
          그동안의 시도가 전부 반쪽이었다:
            · 블록마다 정적 폰 4개  → 모션 0
            · 폰 기울이기(틸트)     → 의도 오해
            · 하단 sticky 폰 152px  → **제목이 폰 뒤에 깔리고**, 248px 기준으로
              설계된 목업 내부가 152px 에서 깨졌다(인사말 겹침 — 스크린샷 증거).
          레퍼런스 패턴(토스 홈·Apple 제품 페이지 모바일)은 하나로 수렴한다:
          **섹션을 핀으로 잡고, 화면 하나에 [짧은 제목 + 큰 폰] 한 세트만.**
          스크롤이 제목과 폰 화면을 함께 넘긴다. 글과 폰이 공간을 다투지 않는다.
          그 패턴을 아래 md:hidden 블록이 구현한다. 이 그리드는 데스크톱 전용. */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-12">
        {/* 좌측 — 설명 블록 */}
        <div>
          {FEATURES.map((f, i) => (
            <div
              key={f.key}
              ref={(el) => {
                blockRefs.current[i] = el
              }}
              className="flex flex-col justify-center md:min-h-[88vh]"
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

              {/* 모바일 인라인 폰은 없앴다(2026-08-03) — 상단 고정 폰 하나가
                  화면을 바꾼다. 예전엔 블록마다 정적 폰을 하나씩 박아 4개를
                  쌓아 뒀고, 그래서 이 페이지의 모바일 모션이 0 이었다.
                  (중간에 '기기를 기울이는' 틸트를 넣어 봤는데 사장님 의도는
                   그게 아니었다 — 데스크톱처럼 **폰은 고정, 화면만 바뀌는 것**.) */}
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
