'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AutomationSettings } from '@/lib/automation-settings'
import type { AutomationPreview } from './page'

/**
 * 운영 자동화 스위치 편집 UI. 기존 AlgorithmConfigClient 와 같은 방식으로
 * supabase client 가 automation_settings(싱글턴 id=1)를 직접 update.
 * RLS(admin write)가 실제 권한 게이트다.
 */
export default function AutomationClient({
  initial,
  preview,
  currentHourKst,
}: {
  initial: AutomationSettings
  preview: AutomationPreview
  currentHourKst: number
}) {
  // automation_settings 는 generated types 에 아직 없어(마이그레이션 후 재생성 전)
  // untyped 로 접근. lib/dog-records.ts 등 신규 테이블의 저장소 관례와 동일.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [enabled, setEnabled] = useState(initial.represcriptionEnabled)
  const [hour, setHour] = useState(initial.marketingPushHour)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // 저장 성공 시점의 값 — dirty 판정 기준(prop 은 수정 불가라 로컬로 둔다).
  const [saved, setSaved] = useState<AutomationSettings>(initial)

  const dirty =
    enabled !== saved.represcriptionEnabled || hour !== saved.marketingPushHour

  async function save() {
    setSaving(true)
    setMsg(null)
    const { error } = await supabase
      .from('automation_settings')
      .update({
        represcription_enabled: enabled,
        marketing_push_hour: hour,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    setSaving(false)
    if (error) {
      setMsg({ ok: false, text: '저장 실패 — ' + error.message })
      return
    }
    setSaved({ represcriptionEnabled: enabled, marketingPushHour: hour })
    setMsg({ ok: true, text: '저장됐어요. 다음 크론 실행부터 반영돼요.' })
  }

  const willSendNow = enabled && hour === currentHourKst

  return (
    <main className="px-1 py-2 max-w-2xl">
      <header className="mb-6">
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500">
          Automation
        </span>
        <h1 className="text-xl font-bold text-zinc-900 mt-1">운영 자동화</h1>
        <p className="text-[13px] text-zinc-500 mt-1">
          코드 배포 없이 조절해요. 재검토 주기(박스 3개)·승인 대기(5일)는 안전을 위해
          코드에 고정돼 있어요.
        </p>
      </header>

      {/* 재제안 kill switch */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-zinc-900">처방 재제안</h2>
            <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
              박스 3개마다 새 처방을 계산해 보호자에게 확인을 요청하는 자동화예요.
              끄면 <b>새 처방 생성·확인 요청·관련 알림이 전부 멈춰요.</b> 이미 적용된
              처방과 배송은 그대로예요. 문제가 생기면 여기서 즉시 끄세요.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`shrink-0 w-12 h-7 rounded-full transition-colors relative ${
              enabled ? 'bg-emerald-500' : 'bg-zinc-300'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                enabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
        {!enabled && (
          <p className="text-[12px] font-semibold text-amber-700 mt-3 bg-amber-50 rounded px-3 py-2">
            ⚠️ 재제안이 꺼져 있어요. 처방이 자동으로 갱신되지 않아요.
          </p>
        )}
      </section>

      {/* 마케팅 알림 발송 시각 */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 mb-4">
        <h2 className="text-[14px] font-bold text-zinc-900">마케팅 알림 발송 시각</h2>
        <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
          가입 다음 날 환영·D+7 분석 안내·D+30 구독 권유가 나가는 시각(KST)이에요.
          복약 알림처럼 사용자가 정한 시각에 가는 알림은 여기 영향을 받지 않아요.
        </p>
        <div className="flex items-center gap-3 mt-3">
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="border border-zinc-300 rounded-md px-3 py-2 text-[14px] font-semibold text-zinc-900 bg-white"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00 KST
              </option>
            ))}
          </select>
          <span className="text-[12px] text-zinc-500">
            {hour >= 22 || hour < 8
              ? '⚠️ 야간엔 조용시간(22–08시)에 걸려 상당수 미발송될 수 있어요.'
              : '적절한 시각이에요.'}
          </span>
        </div>
      </section>

      {/* 미리보기 */}
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 mb-4">
        <h2 className="text-[13px] font-bold text-zinc-700">
          지금 이 순간 기준 미리보기
        </h2>
        <p className="text-[11px] text-zinc-500 mt-0.5 mb-3">
          현재 KST {String(currentHourKst).padStart(2, '0')}시. 다음 크론이 지금 돈다면:
        </p>
        <ul className="space-y-2">
          <PreviewRow
            label="처방 재제안 후보"
            value={enabled ? preview.represcriptionCandidates : 0}
            unit="건 스캔"
            note={
              !enabled
                ? '재제안 꺼짐 → 0'
                : '실제 생성은 배송 3회 채운 것만 (더 적을 수 있어요)'
            }
          />
          <PreviewRow
            label="D+1 환영 알림"
            value={willSendNow ? preview.d1Welcome : 0}
            unit="명"
            note={
              willSendNow
                ? '지금 시각이 발송 시각이라 이번 실행에 나가요'
                : `발송 시각(${String(hour).padStart(2, '0')}시)이 아니라 이번엔 0`
            }
          />
          <PreviewRow
            label="온보딩 넛지 대상 (강아지 미등록)"
            value={willSendNow ? preview.onboardingStage1 : 0}
            unit="명"
            note={
              willSendNow
                ? '별도 크론이라 근사치예요'
                : `발송 시각이 아니라 이번엔 0`
            }
          />
        </ul>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className={`px-5 py-2.5 rounded-md text-[14px] font-bold transition-colors ${
            dirty && !saving
              ? 'bg-zinc-900 text-white hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
          }`}
        >
          {saving ? '저장 중…' : dirty ? '저장' : '변경 없음'}
        </button>
        {msg && (
          <span
            className={`text-[13px] font-semibold ${
              msg.ok ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </main>
  )
}

function PreviewRow({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: number
  unit: string
  note: string
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 bg-white rounded-md px-3 py-2 border border-zinc-200">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-zinc-800">{label}</div>
        <div className="text-[11px] text-zinc-400 mt-0.5">{note}</div>
      </div>
      <div className="shrink-0 text-right">
        <span className="text-lg font-bold text-zinc-900">
          {value.toLocaleString('ko-KR')}
        </span>
        <span className="text-[11px] text-zinc-500 ml-1">{unit}</span>
      </div>
    </li>
  )
}
