'use client'

import { useRef, useState } from 'react'
import {
  FileScan,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Camera,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { MedicalRecordExtract } from '@/lib/vision/parseMedicalRecord'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'

/**
 * 진료 영수증 / 처방전 OCR 진입 컴포넌트.
 *
 * # 흐름
 *  1) "진료 기록 사진 올리기" 버튼 → file input
 *  2) FileReader 로 base64 변환 (5MB 상한 — 서버와 동일)
 *  3) POST /api/health/ocr → MedicalRecordExtract
 *  4) 결과 미리보기 카드 표시. 사용자 확인 후 onConfirm callback.
 *
 * # voice-guidelines
 * - §1: 추출 결과는 "참고용" 으로 명시 — 자동 적용 X.
 * - §4: confidence 0.5 미만이면 "사진이 잘 안 읽혀요. 다시 찍어보실래요?"
 *      부드럽게 안내. 부정 표현 자제.
 * - §11: 옵션 — 안 올려도 무방.
 *
 * # 호출처
 *   <MedicalRecordOcr dogId={dog.id} onConfirm={(extract) => save(extract)} />
 *
 * onConfirm 은 호출처에서 별도 mutation 으로 dogs / health_records 에 반영.
 * 이 컴포넌트는 절대 자동 저장하지 않는다.
 */

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp'

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'success'; data: MedicalRecordExtract }
  | { kind: 'error'; message: string }

export default function MedicalRecordOcr({
  dogId,
  onConfirm,
}: {
  dogId?: string
  /** 사용자가 "이대로 반영" 클릭 시 호출. 호출처가 DB 반영 책임. */
  onConfirm?: (extract: MedicalRecordExtract) => void | Promise<void>
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  // 초기 단계 — 사용자 부담 ↓. default OFF.
  if (!isAdvancedUiEnabled('ocr')) return null

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      setStatus({ kind: 'error', message: '5MB 이하 이미지만 올릴 수 있어요' })
      return
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      setStatus({ kind: 'error', message: 'JPG/PNG/WebP 만 지원해요' })
      return
    }

    setStatus({ kind: 'uploading' })
    try {
      const dataUrl = await fileToDataUrl(file)
      const res = await fetch('/api/health/ocr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: dataUrl,
          dogId: dogId || undefined,
        }),
      })
      const json = (await res.json()) as
        | { ok: true; data: MedicalRecordExtract }
        | { ok: false; code: string; message: string }
      if (!res.ok || !('ok' in json) || !json.ok) {
        const msg =
          'message' in json && json.message ? json.message : 'OCR 에 실패했어요'
        setStatus({ kind: 'error', message: msg })
        return
      }
      setStatus({ kind: 'success', data: json.data })
    } catch {
      setStatus({ kind: 'error', message: '이미지를 읽지 못했어요' })
    }
  }

  function reset() {
    setStatus({ kind: 'idle' })
  }

  async function confirm() {
    if (status.kind !== 'success') return
    try {
      await onConfirm?.(status.data)
      toast.success('진료 기록을 참고 자료로 저장했어요')
      reset()
    } catch {
      toast.error('저장하지 못했어요. 잠시 후 다시 시도해주세요')
    }
  }

  return (
    <section
      className="rounded-2xl border px-5 py-4 bg-white"
      style={{ borderColor: 'var(--rule)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: 'color-mix(in srgb, var(--terracotta) 10%, white)',
            color: 'var(--terracotta)',
          }}
          aria-hidden
        >
          <FileScan className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="kicker" style={{ color: 'var(--terracotta)' }}>
            진료 기록 자동 인식
          </span>
          <p
            className="font-serif mt-1.5 leading-tight"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            영수증 사진으로 빠르게 등록
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-text/70">
            진단명·처방 약·체중 같은 정보를 자동으로 읽어 정리해드려요.
            <span className="text-muted"> 옵션이라 안 올려도 괜찮아요.</span>
          </p>

          {status.kind === 'idle' && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white transition active:scale-[0.99]"
              style={{ background: 'var(--terracotta)' }}
            >
              <Camera className="w-3.5 h-3.5" strokeWidth={2.2} />
              사진 올리기
            </button>
          )}

          {status.kind === 'uploading' && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              사진을 읽고 있어요...
            </div>
          )}

          {status.kind === 'error' && (
            <div className="mt-3 flex items-start gap-2 text-[12px] text-sale">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{status.message}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-1 text-[11px] font-bold text-muted hover:text-text underline"
                >
                  다시 시도
                </button>
              </div>
            </div>
          )}

          {status.kind === 'success' && (
            <Preview
              data={status.data}
              onConfirm={confirm}
              onCancel={reset}
            />
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handlePick}
        className="hidden"
      />
    </section>
  )
}

/**
 * 결과 미리보기 — confidence 낮으면 "다시 찍어볼까요?" 부드럽게 유도.
 */
function Preview({
  data,
  onConfirm,
  onCancel,
}: {
  data: MedicalRecordExtract
  onConfirm: () => void
  onCancel: () => void
}) {
  const lowConfidence = data.confidence < 0.5
  return (
    <div className="mt-3 rounded-xl border bg-bg/40 px-4 py-3 space-y-2 text-[12px]">
      {lowConfidence ? (
        <div className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--gold)' }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            사진이 잘 안 읽혔어요. 밝은 곳에서 다시 찍어보실래요?
            <span className="text-muted"> (그래도 일단 결과는 아래에)</span>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--moss)' }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>읽어왔어요. 맞는지 한번 확인해주세요</span>
        </div>
      )}
      <Field label="진료일" value={data.visitDate ?? '—'} />
      <Field
        label="체중"
        value={data.weightKg != null ? `${data.weightKg} kg` : '—'}
      />
      <Field
        label="진단"
        value={data.diagnosis.length > 0 ? data.diagnosis.join(', ') : '—'}
      />
      <Field
        label="처방"
        value={
          data.medications.length > 0
            ? data.medications
                .map(
                  (m) =>
                    `${m.name}${m.dosage ? ` (${m.dosage})` : ''}${m.frequency ? ` · ${m.frequency}` : ''}`,
                )
                .join(' / ')
            : '—'
        }
      />
      {data.vetNotes && <Field label="메모" value={data.vetNotes} />}
      <div className="pt-2 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-white transition active:scale-[0.99]"
          style={{ background: 'var(--terracotta)' }}
        >
          <CheckCircle2 className="w-3 h-3" strokeWidth={2.2} />
          이대로 저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rule bg-white text-[11.5px] font-bold text-muted hover:text-text transition"
        >
          <X className="w-3 h-3" strokeWidth={2.2} />
          취소
        </button>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="shrink-0 w-12 text-[10.5px] font-bold uppercase tracking-wider mt-0.5"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </span>
      <span
        className="flex-1 text-[12.5px] leading-relaxed"
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </span>
    </div>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}
