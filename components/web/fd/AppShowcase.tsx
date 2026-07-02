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
 *     구독   = 딥헤더 + 탭바 + CUSTOM BOX 키커 + 월결제 카드 + 분량 선택
 *              (2주치/4주치) + 추천 박스 구성(Duck 50%)
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
  Plus,
  RefreshCw,
  Stethoscope,
  Syringe,
  User,
  UserPlus,
} from 'lucide-react'
import { V3, V3Font } from '@/lib/design/tokens'
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
          <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
            {[
              { c: LINE.yellow, w: 20 },
              { c: LINE.terracotta, w: 30 },
              { c: LINE.blush, w: 10 },
              { c: LINE.sage, w: 10 },
              { c: LINE.wine, w: 30 },
            ].map((seg, i) => (
              <div key={i} style={{ width: `${seg.w}%`, background: seg.c }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
            {[
              { c: LINE.terracotta, label: 'Basic', pct: '30%' },
              { c: LINE.wine, label: 'Premium', pct: '30%' },
              { c: LINE.yellow, label: 'Skin', pct: '20%' },
            ].map((l) => (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: 3, background: l.c }} />
                <span style={{ fontFamily: sans, fontSize: 7.5, color: V3.inkSoft }}>
                  {l.label} <b>{l.pct}</b>
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
              단백 32%
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
// ④ 구독(주문하기) — CUSTOM BOX 키커 + 월결제 카드 + 분량 선택 + 박스 구성
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
          분석 결과 그대로 만든 박스를 한 달에 한 번 보내드려요. 언제든 일시정지·해지할 수 있어요.
        </div>

        {/* 월 결제 카드 — accent 보더 */}
        <div style={{ border: `1.5px solid ${V3.accent}`, borderRadius: 10, background: V3.paperHi, padding: '3px 11px', marginTop: 8 }}>
          {[
            { label: '받는 것', value: '콩이 맞춤 박스 · 4주치 (한달)', accent: false },
            { label: '첫 배송', value: '7월 7일 (화) · 이후 매월 자동', accent: false },
            { label: '월 결제', value: '354,000원 /월', accent: true },
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

        {/* 분량 선택 */}
        <MonoText size={7} ls="0.18em" style={{ display: 'block', marginTop: 9 }}>
          한달 정기배송 · 분량 선택
        </MonoText>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <V3Card radius={8} style={{ padding: '9px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 10.5, color: V3.ink }}>2주치</div>
            <div style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: V3.accent, marginTop: 2 }}>하이브리드</div>
            <div style={{ fontFamily: sans, fontSize: 7, color: V3.inkMute, marginTop: 2 }}>15일 1팩씩 · 건식 반반</div>
          </V3Card>
          <div
            style={{
              border: `1.5px solid ${V3.accent}`,
              borderRadius: 8,
              background: 'color-mix(in srgb, #C86B45 6%, #FFFFFF)',
              padding: '9px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 10.5, color: V3.ink }}>4주치</div>
            <div style={{ fontFamily: sans, fontSize: 7.5, fontWeight: 700, color: V3.accent, marginTop: 2 }}>풀 화식</div>
            <div style={{ fontFamily: sans, fontSize: 7, color: V3.inkMute, marginTop: 2 }}>30일 1팩씩 · 한달 풀 (인기)</div>
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
// ⑥ 가족 공유 — 실화면: /family (가족 멤버·초대) + /invitations
// ---------------------------------------------------------------------------
function ScreenFamily() {
  return (
    <div style={{ background: V3.paper, height: '100%', overflow: 'hidden' }}>
      <AppHeaderDeep title="가족 멤버" />

      <div style={{ padding: '10px 12px 0' }}>
        <MonoText color={V3.accent} size={7.5} weight={600} ls="0.18em">Family</MonoText>
        <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 13.5, color: V3.ink, letterSpacing: '-0.025em', marginTop: 5 }}>
          가족 멤버
        </div>
        <div style={{ fontFamily: sans, fontSize: 8, color: V3.inkSoft, marginTop: 3 }}>
          함께 챙기는 가족과 강아지 정보를 공유해 봐요
        </div>

        {/* 멤버 rows */}
        <V3Card style={{ marginTop: 10, padding: '2px 10px' }}>
          {[
            { name: '나', role: '관리자', note: '오늘 산책 기록', me: true },
            { name: '엄마', role: '가족', note: '아침 식사 기록', me: false },
            { name: '동생', role: '가족', note: '어제 체중 기록', me: false },
          ].map((m, i) => (
            <div
              key={m.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7.5px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${V3.ruleSoft}`,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: m.me ? V3.ink : V3.paperDeep,
                  color: m.me ? V3.paper : V3.inkSoft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: sans,
                  fontSize: 8.5,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {m.name.slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 9.5, color: V3.ink }}>
                  {m.name}{' '}
                  <span style={{ fontSize: 7, fontWeight: 700, color: m.me ? V3.accent : V3.inkMute }}>· {m.role}</span>
                </div>
                <div style={{ fontFamily: sans, fontSize: 7.5, color: V3.inkMute, marginTop: 1 }}>{m.note}</div>
              </div>
              <span aria-hidden style={{ width: 5, height: 5, borderRadius: 3, background: V3.sage }} />
            </div>
          ))}
        </V3Card>

        {/* 초대 버튼 — 실화면 '가족 초대하기' */}
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
          <UserPlus size={11} strokeWidth={2} /> 가족 초대하기
        </div>
        <div style={{ fontFamily: sans, fontSize: 7.5, color: V3.inkMute, textAlign: 'center', marginTop: 5 }}>
          초대 링크를 보내면 강아지 정보를 함께 볼 수 있어요
        </div>

        {/* 보낸 초대 */}
        <MonoText size={7} ls="0.18em" style={{ display: 'block', marginTop: 10 }}>보낸 초대 · 1건</MonoText>
        <V3Card style={{ marginTop: 5, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={11} color={V3.inkMute} strokeWidth={2} />
          <span style={{ flex: 1, fontFamily: sans, fontSize: 8.5, fontWeight: 600, color: V3.inkSoft }}>
            아빠 · 초대 링크 전송됨
          </span>
          <MonoText color={V3.yellow} size={7} weight={700} style={{ color: '#B8860B' }}>대기중</MonoText>
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
    key: 'family',
    eyebrow: 'Family',
    title: (
      <>
        온 가족이 함께
        <br />
        같은 아이를 챙겨요
      </>
    ),
    body: '아침은 엄마가, 산책은 동생이 — 초대 링크 하나면 가족 모두가 같은 기록을 보고 함께 쓸 수 있어요. 누가 언제 뭘 챙겼는지 보이니까 "밥 줬어?"를 두 번 묻지 않아도 돼요.',
    screen: <ScreenFamily />,
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
    body: '분석 결과 그대로 만든 맞춤 박스를 한 달에 한 번 받아요. 2주치 하이브리드와 4주치 풀 화식 중 분량을 고르고, 박스에 담기는 레시피 구성과 가격을 투명하게 확인해요. 주기 변경·일시정지·해지도 전부 앱 안에서 몇 번의 탭이면 돼요.',
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
