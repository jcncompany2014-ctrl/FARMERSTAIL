import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { getAutomationSettings } from '@/lib/automation-settings'
import { todayKstIsoDate, addDaysKst, currentKstHour } from '@/lib/datetime-kst'
import { MIN_DAYS_BEFORE_DUE } from '@/lib/personalization/cycle'
import AutomationClient from './AutomationClient'

export const dynamic = 'force-dynamic'

/**
 * /admin/automation — 운영 자동화 스위치 (2026-07-17, 사장님).
 *
 * 조절 대상은 automation_settings 의 두 값뿐:
 *   · 처방 재제안 ON/OFF (kill switch)
 *   · 마케팅 알림 발송 시각 (KST)
 * 박스 개수·승인 대기 기간은 코드 고정(임상 정합성 — lib/personalization/cycle).
 *
 * 저장 전 판단을 돕기 위해 **미리보기**를 함께 낸다: "지금 이 순간 기준으로
 * 재제안 대상 몇 마리 / 마케팅 알림 대상 대략 몇 명" 을 서버에서 실제로 센다.
 */
export default async function AdminAutomationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/automation')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const settings = await getAutomationSettings(supabase)

  // ── 미리보기 카운트 (service-role — RLS 우회, 크론과 같은 시야) ──
  const admin = createAdminClient()
  const preview = await computePreview(admin)

  return (
    <AutomationClient
      initial={settings}
      preview={preview}
      currentHourKst={currentKstHour()}
    />
  )
}

export type AutomationPreview = {
  /** 지금 재제안 후보로 스캔될 처방 수 (배송 회차 만기는 크론이 최종 판정). */
  represcriptionCandidates: number
  /** 어제(KST) 가입자 — D+1 환영 대상 대략치. */
  d1Welcome: number
  /** 강아지 미등록 신규 — 온보딩 1단계 대상 대략치. */
  onboardingStage1: number
}

async function computePreview(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<AutomationPreview> {
  const today = todayKstIsoDate()
  const prefilterBefore = addDaysKst(today, -MIN_DAYS_BEFORE_DUE)
  const yesterday = addDaysKst(today, -1)

  const [rep, d1, stage1] = await Promise.all([
    // 재제안 후보: progression 의 프리필터와 같은 조건.
    admin
      .from('dog_formulas')
      .select('id', { count: 'exact', head: true })
      .or(
        `applied_from.lte.${prefilterBefore},and(applied_from.is.null,created_at.lt.${prefilterBefore}T00:00:00Z)`,
      ),
    // D+1: 어제(KST) 가입 + 마케팅 동의.
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('agree_email', true)
      .is('deleted_at', null)
      .gte('created_at', `${yesterday}T00:00:00+09:00`)
      .lt('created_at', `${today}T00:00:00+09:00`),
    // 온보딩 1단계: 마케팅 동의 + 가입 1~7일 전 (강아지 유무는 크론이 개별 확인).
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('agree_email', true)
      .is('deleted_at', null)
      .lte('created_at', `${addDaysKst(today, -1)}T23:59:59+09:00`)
      .gt('created_at', `${addDaysKst(today, -7)}T00:00:00+09:00`),
  ])

  return {
    represcriptionCandidates: rep.count ?? 0,
    d1Welcome: d1.count ?? 0,
    onboardingStage1: stage1.count ?? 0,
  }
}
