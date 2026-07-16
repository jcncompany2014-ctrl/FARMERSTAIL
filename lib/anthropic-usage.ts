/**
 * Anthropic AI 비용 가드 — 일일 cap 체크 + 사용량 기록 (마스터피스 P1-O4).
 *
 * # 문제
 * AI 라우트 (/api/analysis/structured, /api/health/ocr) 는 IP 당
 * rate-limit (5req/min) 만 있고 **일·월 누적 비용 추적·예산 cap·초과 알림이
 * 전무**. 분산 IP / 봇 / 버그 폭주 시 Anthropic 청구가 조용히 누적됨.
 *
 * # 동작
 *  1) checkAnthropicDailyCap() — 라우트 진입부 (rate-limit 직후) 에서 호출.
 *     env ANTHROPIC_DAILY_CALL_CAP 가 양수이고 오늘 전역 호출수가 그 값 이상이면
 *     exceeded=true → 라우트가 503 반환 + captureBusinessEvent.
 *  2) recordAnthropicUsage() — Anthropic 호출 **성공 후** best-effort 누적.
 *     usage.input_tokens / output_tokens 가 응답에 있으면 같이 기록.
 *
 * # fail-open 원칙
 * 추적/cap 로직 실패 (테이블 부재 / DB 장애 / service_role 미설정) 가 정상 AI
 * 호출을 절대 막지 않는다. 모든 경로 try/catch 로 감싸고, cap 체크 실패 시
 * exceeded=false (통과) 를 반환. 기록 실패는 조용히 삼킨다.
 *
 * # 테이블 미적용 안전성
 * 마이그레이션 (supabase/migrations/20260601000000_anthropic_usage.sql) 이 아직
 * prod 에 적용 안 됐을 수 있음 → RPC 부재 에러를 fail-open 으로 흡수.
 *
 * # cap 설계
 * - env `ANTHROPIC_DAILY_CALL_CAP` (optional, lib/env.ts 등록). 미설정/0/음수 →
 *   무제한 (기존 동작 보존, opt-in). 양수면 그 값이 오늘 전역 호출 상한.
 * - 호출수 기준 (토큰 아님) — 단순/안전. 토큰 cap 이 필요하면 후속 확장.
 */
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'

/**
 * Anthropic 응답의 usage 필드 — input_tokens / output_tokens 만 사용.
 * 응답에 없을 수 있으니 전부 optional.
 */
export type AnthropicUsage = {
  input_tokens?: number
  output_tokens?: number
}

/**
 * 설정된 일일 호출 cap. 양수면 그 값, 미설정/0/음수면 null (무제한).
 * 파싱 실패도 null 로 — 잘못된 env 가 AI 를 막지 않게.
 */
function dailyCallCap(): number | null {
  const raw = env.ANTHROPIC_DAILY_CALL_CAP
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

export type DailyCapResult = {
  /** true 면 오늘 전역 호출수가 cap 도달 → 라우트가 503 차단해야 함. */
  exceeded: boolean
  /** 설정된 cap (없으면 null). 503 응답/로그용. */
  cap: number | null
  /** 차단 시점의 오늘 전역 호출수 (확인 못 했으면 null). */
  used: number | null
}

const PASS: DailyCapResult = { exceeded: false, cap: null, used: null }

/**
 * 오늘 전역 Anthropic 호출수가 일일 cap 에 도달했는지 확인.
 *
 * fail-open: cap 미설정이거나 DB 확인 실패면 항상 exceeded=false (통과).
 * cap 도달 시에만 exceeded=true 와 함께 captureBusinessEvent('error', ...) 발사.
 *
 * @param route 호출 라우트 라벨 (예: 'analysis-structured') — 로그용.
 */
export async function checkAnthropicDailyCap(
  route: string,
): Promise<DailyCapResult> {
  const cap = dailyCallCap()
  if (cap === null) return PASS // opt-in 미설정 → 무제한

  try {
    const supabase = createAdminClient()
    // 바로 service_role RPC. SupabaseClient<Database> 의 .rpc 는 known
    // function 만 타입에 있으나, 이 RPC 는 아직 generated types 에 없으므로
    // 느슨한 핸들로 호출 (rateLimitDB 패턴과 동일). cast 로 타입만 우회.
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: number | null; error: unknown }>
    )('sum_anthropic_calls_today')

    if (error || typeof data !== 'number') {
      // 테이블/RPC 부재 또는 DB 장애 → fail-open. 통과시키되 사실은 남김.
      console.warn(
        `[anthropic-usage] cap check failed — fail-open. route=${route}`,
      )
      return PASS
    }

    const used = data
    if (used >= cap) {
      captureBusinessEvent('error', 'anthropic.daily_cap_exceeded', {
        route,
        cap,
        used,
      })
      return { exceeded: true, cap, used }
    }
    return { exceeded: false, cap, used }
  } catch {
    // service_role 미설정 (createAdminClient throw) 등 — fail-open.
    return PASS
  }
}

/**
 * Anthropic 호출 성공 후 사용량 누적 (best-effort).
 *
 * 절대 throw 하지 않음 — 기록 실패가 본 응답을 막지 않는다. 테이블/RPC 부재,
 * service_role 미설정 모두 조용히 흡수.
 *
 * @param route 호출 라우트 라벨 (예: 'analysis-structured').
 * @param usage Anthropic 응답의 usage (input_tokens / output_tokens). 없으면 생략.
 */
export async function recordAnthropicUsage(
  route: string,
  usage?: AnthropicUsage,
): Promise<void> {
  try {
    const supabase = createAdminClient()
    const input =
      typeof usage?.input_tokens === 'number' && usage.input_tokens > 0
        ? Math.floor(usage.input_tokens)
        : 0
    const output =
      typeof usage?.output_tokens === 'number' && usage.output_tokens > 0
        ? Math.floor(usage.output_tokens)
        : 0

    const { error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: unknown }>
    )('incr_anthropic_usage', {
      p_route: route,
      p_input_tokens: input,
      p_output_tokens: output,
      p_calls: 1,
    })

    if (error) {
      console.warn(
        `[anthropic-usage] record failed (best-effort). route=${route}`,
      )
    }
  } catch {
    /* swallow — 기록 실패가 정상 AI 응답을 막아서는 안 됨 */
  }
}
