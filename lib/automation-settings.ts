/**
 * 운영 자동화 설정 — admin 이 코드 배포 없이 조절하는 값 (2026-07-17).
 *
 * # 읽기 규칙 (algorithm_food_lines 와 동일 패턴 — zero-downtime)
 * DB `automation_settings` 에 행이 있으면 그 값을, 없거나 조회 실패면 **코드 기본값**을
 * 쓴다. 즉 테이블이 비어도/마이그레이션 전이어도 안전하게 동작한다.
 *
 * # 무엇이 여기 있고 무엇이 코드에 남는가
 *  · 여기(조절 가능) — represcriptionEnabled(재제안 kill switch), marketingPushHour
 *  · 코드에 고정(lib/personalization/cycle) — 박스 개수·승인 대기 기간·체크인 시점.
 *    임상 정합성이 걸린 값이라 불변식 테스트로 보호(2박스면 종합 체크인이 죽는 등).
 *
 * 크론(service-role)이 부른다. 유저 경로는 이 값을 안 읽는다.
 */

/** 마케팅 라이프사이클 알림 기본 발송 시각 (KST). cycle 정본과 별개인 운영 값. */
export const DEFAULT_MARKETING_PUSH_HOUR = 10

export type AutomationSettings = {
  /** 처방 재제안(personalization-progression) 전체 on/off. */
  represcriptionEnabled: boolean
  /**
   * D+1/D+7/D+30 마케팅 알림이 나가는 KST 시각.
   *
   * ★허용 범위는 0~23 이 아니라 **8~20** 이다(2026-09-01 감사).
   * 정보통신망법 §50⑧ — 21:00~08:00 에 광고성 정보를 전송하려면 **별도 동의**가
   * 필요하다. 우리는 그 동의를 받지 않으므로 아예 고를 수 없게 한다.
   * 20 시를 상한으로 두는 이유: 발송이 21 시로 밀리는 경계를 남기지 않으려고.
   */
  marketingPushHour: number
}

/** 광고성 정보를 보낼 수 있는 KST 시간대(양끝 포함). 정보통신망법 §50⑧. */
export const MARKETING_HOUR_MIN = 8
export const MARKETING_HOUR_MAX = 20

const DEFAULTS: AutomationSettings = {
  represcriptionEnabled: true,
  marketingPushHour: DEFAULT_MARKETING_PUSH_HOUR,
}

/** DB 행 → 검증된 설정. 값이 이상하면 그 필드만 기본값으로 (부분 안전). */
function coerce(row: unknown): AutomationSettings {
  const r = (row ?? {}) as {
    represcription_enabled?: unknown
    marketing_push_hour?: unknown
  }
  // 범위를 벗어나면 clamp 가 아니라 **기본값으로 되돌린다** — 22 시를 21 시로
  // 조용히 당겨 주면 설정한 사람은 자기 값이 먹힌 줄 안다. 야간은 아예 못 쓴다.
  const hour =
    typeof r.marketing_push_hour === 'number' &&
    Number.isInteger(r.marketing_push_hour) &&
    r.marketing_push_hour >= MARKETING_HOUR_MIN &&
    r.marketing_push_hour <= MARKETING_HOUR_MAX
      ? r.marketing_push_hour
      : DEFAULTS.marketingPushHour
  const enabled =
    typeof r.represcription_enabled === 'boolean'
      ? r.represcription_enabled
      : DEFAULTS.represcriptionEnabled
  return { represcriptionEnabled: enabled, marketingPushHour: hour }
}

/**
 * 자동화 설정 조회. supabase = service-role admin client(크론) 또는 server client.
 * 조회 실패·행 없음 → 코드 기본값(자동화는 멈추지 않는다 — 특히 재제안 default ON).
 */
export async function getAutomationSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<AutomationSettings> {
  try {
    const { data, error } = await supabase
      .from('automation_settings')
      .select('represcription_enabled, marketing_push_hour')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return DEFAULTS
    return coerce(data)
  } catch {
    return DEFAULTS
  }
}
