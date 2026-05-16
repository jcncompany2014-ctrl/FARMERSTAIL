'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

/**
 * Consumes a `pending_referral` stashed in sessionStorage during the
 * signup flow and redeems it via RPC the first time the user lands on
 * a page that mounts this component (typically /dashboard).
 *
 * Exists because the Kakao OAuth roundtrip throws away the form state
 * from /signup, so we can't redeem inline. sessionStorage survives the
 * callback hop on the same origin.
 *
 * 변경 이력 (audit 1-6 / 2-6 / 3-6):
 *   - 이전엔 자체 toast UI 를 fixed 로 띄움 → 표준 ToastProvider 와 시각 분리.
 *     이제 useToast() 로 통일된 success toast 사용.
 *   - 이전엔 RPC 가 referee_bonus 를 안 돌려주면 3000P 하드코딩. 보너스 금액
 *     이 변하면 잘못된 안내. 이제 RPC 응답에 amount 가 없으면 toast 만 띄움.
 *   - "이미 사용한 코드" / "본인 코드 사용 불가" 등 RPC 오류는 silent.
 *   - 같은 페이지에서 두 번 마운트되더라도 redemption 은 1회 보장 (ref guard).
 */
export default function ReferralAutoRedeemer() {
  const supabase = createClient()
  const toast = useToast()
  // StrictMode / 같은 페이지 hot-mount 보호 — sessionStorage 로 burn 하지만
  // 비동기 시점 사이에 또 마운트되면 2번 RPC 가 갈 수 있음. 컴포넌트 인스턴스
  // 안에서 한 번만 실행되게 ref 가드.
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    let code: string | null = null
    try {
      code = sessionStorage.getItem('pending_referral')
    } catch {
      return
    }
    if (!code) return

    // Burn the key immediately so we don't retry on every remount
    // (dashboard can unmount/remount during tab switches).
    try {
      sessionStorage.removeItem('pending_referral')
    } catch {
      /* noop */
    }

    ;(async () => {
      // getSession — RPC 가 auth.uid() 검증해 spoof 안전.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase.rpc('redeem_referral_code', {
        input_code: code,
      })
      // 에러는 silent — "이미 사용한 코드", "본인 코드", "유효하지 않은 코드"
      // 같은 메시지를 노출해 좋을 게 없음. 사용자는 이미 가입한 상태.
      if (error) return
      const bonus =
        (data as { referee_bonus?: number } | null)?.referee_bonus ?? 0
      if (bonus > 0) {
        toast.success(
          `친구 초대 코드로 ${bonus.toLocaleString()}P가 적립됐어요!`,
        )
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
