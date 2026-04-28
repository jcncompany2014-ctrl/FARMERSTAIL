/**
 * Farmer's Tail — 이벤트 타입 + DB fetch 헬퍼.
 *
 * # 역사
 * 초기엔 `MOCK_EVENTS` 상수 배열을 그대로 반환하는 sync 모듈이었다. 관리자가
 * 이벤트 기간·할인율을 수정하려면 코드 수정 + 배포가 필요했고, 서비스 운영
 * 관점에서 치명적이라 `supabase.events` 테이블로 이전
 * (`20260424000007_events.sql`). 여기서는 그 테이블을 **읽는 층** 만 정의.
 *
 * # 왜 SupabaseClient 를 인자로 받는가
 * 이벤트는 서버 컴포넌트 (`/events`, `/events/[slug]`, landing `/`) 와
 * 클라이언트 컴포넌트 (대시보드, 랜딩 `OngoingEvents`) 양쪽에서 조회된다.
 * 각 컨텍스트는 서로 다른 Supabase 클라이언트 (`server.ts` vs `client.ts`) 를
 * 쓰므로, 이 모듈은 클라이언트 생성에 대해 agnostic 하다. 호출부가 자기에게
 * 맞는 클라이언트를 주입.
 *
 *   // 서버 컴포넌트:
 *   import { createClient } from '@/lib/supabase/server'
 *   const supabase = await createClient()
 *   const events = await getActiveEvents(supabase)
 *
 *   // 클라이언트 컴포넌트 (useEffect 안):
 *   import { createClient } from '@/lib/supabase/client'
 *   const supabase = createClient()
 *   const events = await getActiveEvents(supabase)
 *
 * # 팔레트 매핑
 * DB 에는 'ink' | 'terracotta' | 'moss' | 'gold' 이름만 저장. 실제 색은 각
 * 표시 컴포넌트가 자체 팔레트 맵을 가지고 해석 — 대시보드 카드 / 랜딩
 * 매거진 슬라이드 / 상세 hero 가 서로 다른 visual vocabulary 를 쓰기 때문.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type EventPalette = 'ink' | 'terracotta' | 'moss' | 'gold'

/**
 * 카드 클릭 시 분기:
 *  - 'default' : 일반 Link 이동 (`href` 로)
 *  - 'welcome' : 첫 가입 혜택. 대시보드에선 모달, 상세 페이지에선 3시간
 *                카운트다운 블록. 로그인 상태 + created_at 필요.
 */
export type EventKind = 'default' | 'welcome'

/**
 * 상세 페이지의 primary CTA 성격:
 *  - 'coupon-claim'  : 쿠폰 코드를 발급받는 이벤트. 상세에서 "쿠폰 받기"
 *                      버튼 → 클립보드 복사 + localStorage 마킹.
 *  - 'benefit-auto'  : 자동 적용되는 혜택. 상세에서 혜택 안내 + 활성화
 *                      상태(카운트다운 or "자동 적용됨").
 */
export type EventCtaVariant = 'coupon-claim' | 'benefit-auto'

export type EventItem = {
  id: string
  slug: string
  kicker: string
  enTitle: string
  koSubtitle: string
  tagline: string
  highlight: string
  /** ISO 문자열. */
  startsAt: string
  endsAt: string
  statusLabel: string
  palette: EventPalette
  kind: EventKind
  /**
   * 카드 클릭 기본 목적지. kind: 'welcome' 이고 유저가 로그인된 경우엔
   * 대시보드가 이 href 대신 모달을 열지만, 비로그인 폴백 및 상세 페이지
   * 보조 CTA 에선 이 값이 쓰인다.
   *
   * DB 에는 없고 `/events/[slug]` 로 파생 — 모든 카드는 상세 페이지를 먼저
   * 통과시키는 게 편집/통계 관점에서 깔끔.
   */
  href: string

  ctaVariant: EventCtaVariant
  /** ctaVariant='coupon-claim' 일 때만. 체크아웃에서 입력할 쿠폰 코드. */
  couponCode?: string

  /** 상세 hero 하단 2~3줄 intro. */
  detailLede: string
  /** 혜택을 불릿으로. 3~5개 권장. */
  perks: string[]
  /** 유의사항. 2~4개 권장. */
  terms: string[]
  /** 상세 하단 보조 CTA (예: "전체 상품 보기"). 옵셔널. */
  ctaSecondary?: {
    label: string
    href: string
  }

  /**
   * 대표 이미지 — 카드 배경 + 상세 hero backdrop 에 공통 사용. null/undefined
   * 이면 palette 단색 배경만 렌더 (이전 동작 유지 — 이미지 없는 이벤트도
   * 그대로 돌아감).
   */
  imageUrl?: string
  /** a11y. 비우면 컴포넌트가 en_title 로 fallback. */
  imageAlt?: string
}

/**
 * DB 스키마 (snake_case, timestamptz). `select('*')` 결과를 그대로 받는다.
 */
type EventRow = {
  id: string
  slug: string
  kicker: string
  en_title: string
  ko_subtitle: string
  tagline: string
  highlight: string
  starts_at: string
  ends_at: string
  status_label: string
  palette: EventPalette
  kind: EventKind
  cta_variant: EventCtaVariant
  coupon_code: string | null
  detail_lede: string
  perks: unknown
  terms: unknown
  cta_secondary: { label: string; href: string } | null
  sort_priority: number
  is_active: boolean
  image_url: string | null
  image_alt: string | null
}

/**
 * DB row → UI EventItem. `perks` / `terms` 는 jsonb 라 기본적으로 `unknown`
 * 으로 받고 여기서 `string[]` 방어.
 */
function rowToEvent(row: EventRow): EventItem {
  return {
    id: row.id,
    slug: row.slug,
    kicker: row.kicker,
    enTitle: row.en_title,
    koSubtitle: row.ko_subtitle,
    tagline: row.tagline,
    highlight: row.highlight,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    statusLabel: row.status_label,
    palette: row.palette,
    kind: row.kind,
    href: `/events/${row.slug}`,
    ctaVariant: row.cta_variant,
    couponCode: row.coupon_code ?? undefined,
    detailLede: row.detail_lede,
    perks: Array.isArray(row.perks)
      ? (row.perks as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    terms: Array.isArray(row.terms)
      ? (row.terms as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    ctaSecondary: row.cta_secondary ?? undefined,
    imageUrl: row.image_url ?? undefined,
    imageAlt: row.image_alt ?? undefined,
  }
}

const EVENT_COLUMNS =
  'id, slug, kicker, en_title, ko_subtitle, tagline, highlight, starts_at, ends_at, status_label, palette, kind, cta_variant, coupon_code, detail_lede, perks, terms, cta_secondary, sort_priority, is_active, image_url, image_alt'

/**
 * 지금 "보여줄" 이벤트 목록 — is_active + now in-range + sort_priority desc.
 *
 * RLS 상 비활성 이벤트는 anon 에게 애초에 보이지 않지만, 기간 필터는 앱
 * 레이어에서 추가로 걸어 "등록은 됐는데 아직 시작 전" 이벤트가 새는 걸 막는다.
 */
export async function getActiveEvents(
  supabase: SupabaseClient,
  limit?: number
): Promise<EventItem[]> {
  const nowIso = new Date().toISOString()
  let query = supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('is_active', true)
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('sort_priority', { ascending: false })
    .order('starts_at', { ascending: false })

  if (typeof limit === 'number') {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error) {
    // fail-soft — 이벤트 로드 실패가 홈/랜딩 전체를 깨뜨리면 안 됨.
    console.error('[events] getActiveEvents failed:', error.message)
    return []
  }
  return (data as EventRow[] | null)?.map(rowToEvent) ?? []
}

/**
 * 상세 페이지용. 기간 필터는 **걸지 않음** — 관리자 프리뷰나 "끝난 이벤트
 * 리캡" 링크를 의도적으로 살릴 수 있게. 공개 노출 여부만 is_active 로 통제.
 */
export async function getEventBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<EventItem | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('[events] getEventBySlug failed:', error.message)
    return null
  }
  return data ? rowToEvent(data as EventRow) : null
}

/**
 * `generateStaticParams` 용. force-dynamic 페이지에선 빌드 타임에 안 불리고,
 * 향후 ISR/SSG 전환 시에만 의미 있음. 공개 읽기 정책 하에 호출.
 */
export async function getAllEventSlugs(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from('events')
    .select('slug')
    .eq('is_active', true)
  if (error) {
    console.error('[events] getAllEventSlugs failed:', error.message)
    return []
  }
  return (data ?? []).map((r: { slug: string }) => r.slug)
}

/**
 * 'YY.MM.DD – MM.DD' (같은 해) / 'YY.MM.DD – YY.MM.DD' (해 다름).
 * 카드 / 리스트 / 상세 어디서든 동일 포맷을 쓰도록 공유.
 *
 * DB 의 timestamptz 가 ISO 문자열로 내려올 때 Date 생성자가 바로 파싱하므로
 * 타임존은 브라우저 로컬 기준(KST 가정). 서버 렌더링 시엔 Vercel 의 UTC
 * 기본값이 깨질 수 있는데, `/events` 는 운영이 관리자 뜻대로 시작/종료하는
 * 개념이라 +/- 하루 오차는 치명적이지 않다고 판단.
 */
export function formatEventDateRange(
  startsAt: string,
  endsAt: string
): string {
  const s = new Date(startsAt)
  const e = new Date(endsAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const yy = (d: Date) => String(d.getFullYear()).slice(2)
  if (s.getFullYear() === e.getFullYear()) {
    return `${yy(s)}.${pad(s.getMonth() + 1)}.${pad(s.getDate())} – ${pad(e.getMonth() + 1)}.${pad(e.getDate())}`
  }
  return `${yy(s)}.${pad(s.getMonth() + 1)}.${pad(s.getDate())} – ${yy(e)}.${pad(e.getMonth() + 1)}.${pad(e.getDate())}`
}
