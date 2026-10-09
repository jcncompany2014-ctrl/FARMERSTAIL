// 알림 통합 페이지(2026-07-16) — 받은 알림 + 알림 설정 + 광고 수신을 탭 하나로.
// 세 화면의 서버 prefetch 를 여기서 모아 AlertsClient(탭) 에 넘긴다.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AlertsClient from './AlertsClient'
import { type Row } from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/notifications')
  }

  // 변경 이력(consent_log)은 화면에서 뺐다(사장님 2026-07-31) — 조회도 안 한다.
  // 기록은 set_marketing_consent RPC 가 계속 남긴다: 법정 보관 자료이고,
  // 고객은 /mypage/privacy 의 개인정보 다운로드(§35 열람권)로 받아볼 수 있다.
  const [inboxRes, pushSubsRes, profileRes, nativeRes] =
    await Promise.all([
      // 받은 알림 (인박스)
      supabase
        .from('push_log')
        .select('id, title, body, url, category, sent_count, read_at, sent_at')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(100),
      // 알림 설정 — 등록된 기기
      supabase
        .from('push_subscriptions')
        .select('id, endpoint, user_agent, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      // 광고 수신 — 동의 현황
      supabase
        .from('profiles')
        .select(
          'agree_email, agree_sms, agree_email_at, agree_sms_at, marketing_policy_version',
        )
        .eq('id', user.id)
        .maybeSingle(),
      /**
       * 알림 설정 — 등록된 **앱(네이티브) 기기** (2026-10-09 앱시안 결정 · 읽기 조회만 추가).
       *
       * 위 push_subscriptions 는 **웹 푸시** 구독뿐이다. 앱스토어로 설치한 사람의 기기는 APNs/FCM 토큰으로
       * native_push_tokens 에 따로 남는다(app/api/push/native-register 가 쓰는 표 · lib/push.ts 가 발송 때 읽는 표).
       * 그래서 앱 사용자는 알림이 켜져 있어도 '기기' 목록이 "아직 등록된 기기가 없어요"로 떴다.
       * 본인 행만 읽는다(.eq user_id — 이 표는 본인만 SELECT 하는 RLS, native-register GET 이 같은 방식).
       * 토큰 값은 화면에 필요 없어 고르지 않는다. 저장·삭제·발송 로직은 그대로다.
       */
      supabase
        .from('native_push_tokens')
        .select('id, platform, device_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

  const profile = profileRes.data

  return (
    <AlertsClient
      initialTab={tab}
      inboxRows={((inboxRes.data ?? []) as unknown) as Row[]}
      pushSubs={pushSubsRes.data ?? []}
      // ★조회 실패는 null 로 넘긴다(규칙1) — 빈 배열로 뭉개면 "아직 등록된 기기가 없어요"라는 거짓 안내가 된다.
      //   이 목록은 보여 주기만 하고, 켜짐/꺼짐 판정은 기기에서 따로 한다(NotificationSettingsClient).
      nativeDevices={nativeRes.error ? null : (nativeRes.data ?? [])}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      // ★ 조회 실패는 null 로 넘긴다 — Boolean(undefined)=false 로 뭉개면
      //   수신 중인 사람에게 '현재 미동의' 가 뜬다(규칙1, AlertsClient 주석 참고).
      consentInitial={
        profileRes.error
          ? null
          : {
              agree_email: Boolean(profile?.agree_email),
              agree_sms: Boolean(profile?.agree_sms),
              agree_email_at: profile?.agree_email_at ?? null,
              agree_sms_at: profile?.agree_sms_at ?? null,
              marketing_policy_version:
                profile?.marketing_policy_version ?? null,
            }
      }
    />
  )
}
