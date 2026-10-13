import type { createClient } from '@/lib/supabase/client'
import { MARKETING_POLICY_VERSION } from '@/lib/consent'

/**
 * lib/auth/applySignupProfile
 *
 * 가입 시 입력한 프로필을 "인증된 세션"에서 실제로 DB 에 반영한다.
 *
 * 왜 분리했나:
 *  - Supabase "Confirm email" 이 ON 이면 signUp 직후엔 세션이 없다(data.session
 *    === null). RLS 가 미인증 쓰기를 막으므로 profiles.update / consent_log
 *    가 전부 실패한다. → 가입 입력값(이름·전화·주소·생일·마케팅동의)이 유실된다.
 *  - 그래서 signUp 시 options.data.signup_profile 로 보관해 두고(서버측 auth
 *    메타데이터 = 다른 탭/기기에서도 생존), "첫 로그인 직후"에 이 헬퍼로 복원한다.
 *  - 이메일 확인이 OFF 면 signup 페이지의 in-session 분기가 동일 작업을 즉시 수행.
 *
 * 멱등성: 호출 측이 "profiles.name 이 비어 있을 때만" 부르고, 성공 후 메타데이터의
 * signup_profile 를 비우므로(PIPA) 재실행되지 않는다.
 *
 * ⚠️ 클라이언트 전용(sessionStorage/document.cookie/fetch 사용) — 'use client'
 *    컴포넌트에서만 import.
 */

type AppSupabaseClient = ReturnType<typeof createClient>

export type PendingSignupProfile = {
  name: string
  phone: string
  zip: string
  address: string
  addressDetail: string
  birthYear: number | null
  birthMonth: number | null
  birthDay: number | null
  agreeMarketingEmail: boolean
  agreeMarketingSms: boolean
}

export type ApplySignupResult = {
  /** 트리거가 만 14세 미만을 거부 — 호출 측은 signOut + 안내. */
  underAge?: boolean
  /** profiles.update 가 (UNDER_14 외) 실패 — 마이페이지에서 수정 안내. */
  profileError?: boolean
}

/**
 * auth 메타데이터(raw_user_meta_data.signup_profile)에서 읽은 값을
 * PendingSignupProfile 로 정규화. 모든 필드를 방어적으로 캐스팅.
 */
export function normalizeSignupMeta(
  meta: unknown,
): PendingSignupProfile | null {
  if (!meta || typeof meta !== 'object') return null
  const m = meta as Record<string, unknown>
  const name = typeof m.name === 'string' ? m.name : ''
  if (name.trim().length === 0) return null
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  return {
    name,
    phone: typeof m.phone === 'string' ? m.phone : '',
    zip: typeof m.zip === 'string' ? m.zip : '',
    address: typeof m.address === 'string' ? m.address : '',
    addressDetail: typeof m.address_detail === 'string' ? m.address_detail : '',
    birthYear: num(m.birth_year),
    birthMonth: num(m.birth_month),
    birthDay: num(m.birth_day),
    agreeMarketingEmail: m.agree_email === true,
    agreeMarketingSms: m.agree_sms === true,
  }
}

export async function applySignupProfile(
  supabase: AppSupabaseClient,
  userId: string,
  d: PendingSignupProfile,
): Promise<ApplySignupResult> {
  // ★동의 칸(agree_*·시각·약관 버전)은 여기서 쓰지 않는다(2026-10-13 규칙197). 아래 RPC 가 동의 값·시각(now())·
  //   동의 기록(consent_log)을 한 번에 남긴다. 예전엔 브라우저 시계로 시각을 넣고 consent_log 에 직접 INSERT 했다 —
  //   고객 권한으로 동의 기록을 쓸 수 있다는 뜻이라(임의 날짜 가능) 그 권한을 회수했다.
  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      name: d.name.trim(),
      phone: d.phone,
      zip: d.zip,
      address: d.address,
      address_detail: d.addressDetail,
      birth_year: d.birthYear,
      birth_month: d.birthMonth,
      birth_day: d.birthDay,
    })
    .eq('id', userId)

  // 트리거가 만 14세 미만을 거부하면 UNDER_14 메시지로 돌아온다.
  if (profErr?.message?.includes('UNDER_14')) {
    return { underAge: true }
  }

  // 마케팅 동의 — 서버 함수 set_marketing_consent(SECURITY DEFINER)가 profiles 플래그·시각 + consent_log 를 같이 쓴다.
  const wanted: Array<'email' | 'sms'> = [
    ...(d.agreeMarketingEmail ? (['email'] as const) : []),
    ...(d.agreeMarketingSms ? (['sms'] as const) : []),
  ]
  if (wanted.length > 0) {
    const results = await Promise.all(
      wanted.map(async (channel) => {
        const { error } = await supabase.rpc('set_marketing_consent', {
          p_channel: channel,
          p_granted: true,
          p_policy_version: MARKETING_POLICY_VERSION,
          p_source: 'signup',
        })
        if (error) console.error('[applySignupProfile] set_marketing_consent 실패', channel, error.message)
        return error ? null : channel
      }),
    )
    // 실제로 저장된 채널만 통지한다 — 저장 안 된 동의를 '처리됐어요'라고 알리지 않는다.
    const channels = results.filter((c): c is 'email' | 'sms' => c !== null)
    if (channels.length === 0) {
      return { profileError: !!profErr && !profErr.message?.includes('UNDER_14') }
    }
    // ★가입 때 받은 광고 수신 동의도 처리결과를 알린다 (정보통신망법 §50⑦, 2026-09-25).
    //   예전엔 거부만 알려서 가입 동의 고객은 통지를 한 통도 못 받았다. 한 통에 채널을 묶는다.
    //   로그인 직후 화면 이동이 있어 keepalive 로 보낸다.
    void fetch('/api/consent/unsubscribe-ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels, granted: true }),
      keepalive: true,
    }).catch(() => {
      /* 통지 실패가 가입을 막지 않는다 */
    })
  }

  return {
    profileError: !!profErr && !profErr.message?.includes('UNDER_14'),
  }
}
