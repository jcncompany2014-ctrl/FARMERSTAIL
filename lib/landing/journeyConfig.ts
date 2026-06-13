/**
 * journeyConfig — "원물 트럭의 여정" 랜딩 단일 설정 파일 (farm v4 Q8, 2026-06-12).
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  🎨 그림 교체 방법 (지금은 SVG 크레용 placeholder, 나중에 실제 그림)    │
 * │                                                                        │
 * │  1) 그림(투명 PNG/WebP)을  /public/landing/  에 넣는다.                 │
 * │     파일명은 아래 ASSET_SLOTS 의 슬롯 번호(스펙과 동일)로.              │
 * │  2) 해당 슬롯의 src 를 null → '/landing/파일명.webp' 로 바꾼다.         │
 * │     끝. src 가 채워지면 placeholder 대신 그 이미지가 자동으로 깔린다.   │
 * │                                                                        │
 * │  슬롯 번호 = 에셋 스펙 문서의 레이어 번호와 1:1. (A1 하늘, T3 정면트럭…) │
 * │  트럭 경로(WAYPOINTS)도 여기 숫자만 고치면 길에 맞춰 조정된다.          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * 코드는 건드릴 필요 없음 — 이 파일의 src 경로와 숫자만 만지면 된다.
 */

export type AssetSlot = {
  /** null = SVG placeholder 사용. '/landing/xxx.webp' 채우면 그 그림으로 교체. */
  src: string | null
  /** 사람이 읽는 라벨 (스펙 문서와 매칭) */
  label: string
}

/** 에셋 슬롯 — 키는 에셋 스펙 문서의 번호. */
export const ASSET_SLOTS: Record<string, AssetSlot> = {
  A1_sky: { src: null, label: 'A1 하늘' },
  A1_1_sun: { src: null, label: 'A1-1 해' },
  A2_farMountain: { src: null, label: 'A2 먼 산맥' },
  A3_midHill: { src: null, label: 'A3 중간 언덕' },
  A4_frontHillRoad: { src: null, label: 'A4 앞 언덕 + 지그재그 길' },
  A5_windmill: { src: null, label: 'A5 풍차/헛간' },
  T1_truckSide: { src: null, label: 'T1 측면 트럭' },
  T3_truckFront: { src: null, label: 'T3 정면 도착 트럭' },
  B1_dog: { src: null, label: 'B1 달리는 강아지' },
}

/** 배경 레이어 — 뒤(작은 depth)→앞(큰 depth). travel = p=1 일 때 세로 이동(px, 음수=위). */
export type LayerDef = {
  slot: keyof typeof ASSET_SLOTS | string
  /** 0(원경, 느림) ~ 1(근경, 빠름) */
  depth: number
  /** 패럴랙스 세로 이동량(px). 근경일수록 크게. */
  travel: number
}

export const LAYERS: LayerDef[] = [
  { slot: 'A2_farMountain', depth: 0.15, travel: -14 },
  { slot: 'A3_midHill', depth: 0.4, travel: -42 },
  { slot: 'A5_windmill', depth: 0.55, travel: -70 },
  { slot: 'A4_frontHillRoad', depth: 0.85, travel: -120 },
]

/** 트럭 경로 웨이포인트. x/y = 캔버스 대비 % (트럭 중심), s = 스케일, flip: 1=좌향(기본), -1=우향. */
export type Waypoint = { p: number; x: number; y: number; s: number; flip: 1 | -1 }

export type StageConfig = {
  id: number
  /** TODO(카피): 주행 캡션 — 사장님이 최종 문구 확정. */
  caption: string
  waypoints: Waypoint[]
}

/**
 * 3단계 주행 — 트럭이 단조 증가(작게→크게)하며 지그재그로 내려온다.
 * 스케일 범위: 1차 0.30~0.55, 2차 0.55~1.0, 3차 1.0~1.7 (겹치지 않게 단조 ↑).
 * x/y/flip 숫자는 실제 A4 길 그림이 오면 그 곡선에 맞춰 미세조정. (스펙 A4 협의 조항)
 */
export const STAGES: StageConfig[] = [
  {
    id: 1,
    caption: '농장에서 출발', // TODO(카피)
    waypoints: [
      { p: 0.0, x: 80, y: 42, s: 0.3, flip: 1 },
      { p: 0.5, x: 47, y: 47, s: 0.42, flip: 1 },
      { p: 1.0, x: 30, y: 60, s: 0.55, flip: 1 },
    ],
  },
  {
    id: 2,
    caption: '유통 단계 없이', // TODO(카피)
    waypoints: [
      { p: 0.0, x: 20, y: 40, s: 0.55, flip: -1 },
      { p: 0.5, x: 54, y: 52, s: 0.78, flip: -1 },
      { p: 1.0, x: 74, y: 68, s: 1.0, flip: -1 },
    ],
  },
  {
    id: 3,
    caption: '가장 짧은 길로', // TODO(카피)
    waypoints: [
      { p: 0.0, x: 82, y: 44, s: 1.0, flip: 1 },
      { p: 0.5, x: 48, y: 60, s: 1.35, flip: 1 },
      { p: 1.0, x: 30, y: 80, s: 1.7, flip: 1 },
    ],
  },
]

/** 도착 컷 캡션. TODO(카피). */
export const ARRIVAL = { caption: '도착했어요' }

/** 각 주행 섹션 높이(svh). 클수록 그 주행이 천천히 오래 진행된다. */
export const DRIVE_VH = 165
/** 도착 섹션 높이(svh). */
export const ARRIVAL_VH = 130

// ── 순수 유틸 (모션 계산) ──────────────────────────────────────────────

export function clamp(v: number, min = 0, max = 1) {
  return v < min ? min : v > max ? max : v
}

/** 웨이포인트 배열에서 진행도 p(0~1)의 트럭 상태를 선형보간. */
export function sampleWaypoints(wps: Waypoint[], p: number): Waypoint {
  const fallback: Waypoint = { p, x: 50, y: 50, s: 1, flip: 1 }
  const first = wps[0]
  if (!first) return fallback
  const last = wps[wps.length - 1] ?? first
  if (p <= first.p) return first
  if (p >= last.p) return last
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i]
    const b = wps[i + 1]
    if (!a || !b) continue
    if (p >= a.p && p <= b.p) {
      const span = b.p - a.p || 1
      const t = (p - a.p) / span
      return {
        p,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        s: a.s + (b.s - a.s) * t,
        flip: a.flip, // 방향은 구간 시작값 유지
      }
    }
  }
  return last
}

/** 캡션 페이드: 0.15~0.32 등장, 0.62~0.82 퇴장. 그 외 0. */
export function captionOpacity(p: number): number {
  if (p < 0.15 || p > 0.82) return 0
  if (p < 0.32) return clamp((p - 0.15) / 0.17)
  if (p > 0.62) return clamp((0.82 - p) / 0.2)
  return 1
}
