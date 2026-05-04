'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  Camera,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { haptic } from '@/lib/haptic'
import { trackCheckinSubmitted } from '@/lib/analytics'
import './checkin.css'

/**
 * /dogs/[id]/checkin?cycle=N&checkpoint=week_2|week_4
 *
 * 보호자가 cycle 의 week_2 / week_4 응답을 보내는 폼. cron 이 보낸 push /
 * email 의 deep link 가 이 페이지로 진입.
 *
 * # 디자인 (placeholder — 클로드 디자인 핸드오프 받으면 교체)
 * 토큰 (cream/ink/terracotta) 그대로. .ck-* 접두 (checkin).
 *
 * # 응답 항목
 *  - stoolScore     : Bristol 1-7 (4 = 이상)
 *  - coatScore      : 1-5
 *  - appetiteScore  : 1-5
 *  - overallSatisfaction : 1-5 (week_4 만)
 *  - freeText       : 자유 응답 (선택)
 *  - photoUrls      : 미래용 placeholder
 *
 * # 흐름
 *  1. URL 의 cycle + checkpoint 검증
 *  2. 기존 응답 조회 (있으면 read-only + "다시 답하기" 버튼)
 *  3. 사용자 입력 → POST /api/personalization/checkin
 *  4. 성공 → toast + analysis 페이지로 redirect
 */

type Checkpoint = 'week_2' | 'week_4'

const STOOL_OPTIONS: Array<{
  v: 1 | 2 | 3 | 4 | 5 | 6 | 7
  label: string
  hint: string
  tag: 'good' | 'warn' | 'bad'
}> = [
  { v: 1, label: '딱딱한 알갱이', hint: '심한 변비', tag: 'bad' },
  { v: 2, label: '울퉁불퉁 굳음', hint: '경증 변비', tag: 'bad' },
  { v: 3, label: '겉이 갈라짐', hint: '경계', tag: 'warn' },
  { v: 4, label: '매끄러운 소시지', hint: '이상적', tag: 'good' },
  { v: 5, label: '부드러운 덩어리', hint: '경계', tag: 'warn' },
  { v: 6, label: '죽 같은 무름', hint: '경증 설사', tag: 'bad' },
  { v: 7, label: '액체에 가까움', hint: '심한 설사', tag: 'bad' },
]

const FIVE_LABELS = ['매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음']

export default function CheckinPage() {
  const params = useParams()
  const search = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const dogId = params.id as string

  const cycleNumber = Number(search.get('cycle') ?? '1') || 1
  const checkpointParam = search.get('checkpoint')
  const checkpoint: Checkpoint =
    checkpointParam === 'week_4' ? 'week_4' : 'week_2'

  const [dogName, setDogName] = useState('')
  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState<null | {
    stoolScore: number | null
    coatScore: number | null
    appetiteScore: number | null
    overallSatisfaction: number | null
    freeText: string | null
  }>(null)
  const [editMode, setEditMode] = useState(true)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // 응답 state
  const [stool, setStool] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | null>(null)
  const [coat, setCoat] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [appetite, setAppetite] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [satisfaction, setSatisfaction] = useState<
    1 | 2 | 3 | 4 | 5 | null
  >(null)
  const [freeText, setFreeText] = useState('')
  // 사진 — 변/털 첨부. v1.5+ Storage bucket dog_checkin_photos.
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoPreview, setPhotoPreview] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)

  // 강아지 정보 + 기존 응답 조회
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push(
          `/login?next=${encodeURIComponent(
            `/dogs/${dogId}/checkin?cycle=${cycleNumber}&checkpoint=${checkpoint}`,
          )}`,
        )
        return
      }
      const [{ data: dog }, { data: prev }] = await Promise.all([
        supabase
          .from('dogs')
          .select('name')
          .eq('id', dogId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('dog_checkins')
          .select(
            'stool_score, coat_score, appetite_score, overall_satisfaction, free_text, photo_urls',
          )
          .eq('dog_id', dogId)
          .eq('cycle_number', cycleNumber)
          .eq('checkpoint', checkpoint)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (!dog) {
        router.push('/dogs')
        return
      }
      setDogName((dog as { name: string }).name)
      if (prev) {
        const p = prev as {
          stool_score: number | null
          coat_score: number | null
          appetite_score: number | null
          overall_satisfaction: number | null
          free_text: string | null
          photo_urls: string[] | null
        }
        setExisting({
          stoolScore: p.stool_score,
          coatScore: p.coat_score,
          appetiteScore: p.appetite_score,
          overallSatisfaction: p.overall_satisfaction,
          freeText: p.free_text,
        })
        // pre-fill but locked into read-only
        setStool(p.stool_score as typeof stool)
        setCoat(p.coat_score as typeof coat)
        setAppetite(p.appetite_score as typeof appetite)
        setSatisfaction(p.overall_satisfaction as typeof satisfaction)
        setFreeText(p.free_text ?? '')
        setEditMode(false)
        // 사진 — signed URL 미리보기 batch 발급.
        if (Array.isArray(p.photo_urls) && p.photo_urls.length > 0) {
          setPhotoUrls(p.photo_urls)
          const previews: Record<string, string> = {}
          await Promise.all(
            p.photo_urls.map(async (path) => {
              const { data } = await supabase.storage
                .from('dog_checkin_photos')
                .createSignedUrl(path, 60 * 60)
              if (data?.signedUrl) previews[path] = data.signedUrl
            }),
          )
          if (!cancelled) setPhotoPreview(previews)
        }
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, cycleNumber, checkpoint, router, supabase])

  async function uploadPhoto(file: File) {
    setUploading(true)
    setErr('')
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setErr('로그인이 필요해요')
        return
      }
      // 파일 크기 검증 — 5MB cap (Storage bucket 도 같은 cap).
      if (file.size > 5 * 1024 * 1024) {
        setErr('사진은 5MB 이하만 첨부 가능해요')
        return
      }
      // 폴더: {user.id}/{dog_id}/{cycle}-{checkpoint}-{timestamp}-{filename}
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${dogId}/${cycleNumber}-${checkpoint}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('dog_checkin_photos')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) {
        setErr(upErr.message || '사진 업로드 실패')
        return
      }
      // signed URL 발급 (1시간) — bucket private 라 public URL 안 됨.
      const { data: signed } = await supabase.storage
        .from('dog_checkin_photos')
        .createSignedUrl(path, 60 * 60)
      // 저장 시점에는 path 만 photo_urls 에 저장 — signed URL 은 만료. 갤러리
      // 표시용 미리보기로만 signed 사용.
      setPhotoUrls((prev) => [...prev, path])
      // signed URL 미리보기 캐시 — 컴포넌트 state 안에 저장 (Map 형태로 추가).
      if (signed?.signedUrl) {
        setPhotoPreview((prev) => ({ ...prev, [path]: signed.signedUrl }))
      }
      haptic('tap')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '업로드 오류')
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto(path: string) {
    setErr('')
    try {
      await supabase.storage.from('dog_checkin_photos').remove([path])
      setPhotoUrls((prev) => prev.filter((p) => p !== path))
      setPhotoPreview((prev) => {
        const next = { ...prev }
        delete next[path]
        return next
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제 오류')
    }
  }

  async function submit() {
    setErr('')
    setSaving(true)
    try {
      const res = await fetch('/api/personalization/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dogId,
          cycleNumber,
          checkpoint,
          stoolScore: stool,
          coatScore: coat,
          appetiteScore: appetite,
          overallSatisfaction: checkpoint === 'week_4' ? satisfaction : null,
          freeText: freeText.trim() || undefined,
          photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
        }),
      })
      const json = (await res.json()) as
        | { ok: true }
        | { ok?: false; code?: string; message?: string }
      if (!res.ok || !('ok' in json) || json.ok !== true) {
        const msg =
          ('message' in json && json.message) || '응답 저장에 실패했어요'
        setErr(msg)
        return
      }
      haptic('confirm')
      trackCheckinSubmitted({
        dogId,
        cycleNumber,
        checkpoint,
        hasPhoto: photoUrls.length > 0,
      })
      toast.success(`${dogName}이를 더 잘 챙길게요 🐾`)
      router.push(`/dogs/${dogId}/analysis`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="ck-page">
        <div className="ck-state">
          <Loader2
            size={18}
            strokeWidth={2}
            color="var(--terracotta)"
            className="animate-spin"
          />
          체크인 정보 불러오는 중...
        </div>
      </main>
    )
  }

  return (
    <main className="ck-page">
      <Link href={`/dogs/${dogId}`} className="ck-back" aria-label="돌아가기">
        <ChevronLeft size={16} strokeWidth={2.2} />
        {dogName}이의 페이지
      </Link>

      <header className="ck-hero">
        <div className="ck-kicker">
          {checkpoint === 'week_2' ? 'WEEK 2 · 적응 체크' : 'WEEK 4 · 종합 평가'}
          <span className="ck-cycle">CYCLE {cycleNumber}</span>
        </div>
        <h1>
          {dogName}이의<br />
          요즘 어때요?
        </h1>
        <p>
          {checkpoint === 'week_2'
            ? '박스 도착 후 2주가 지났어요. 위장 적응이 잘 되고 있는지 알려주세요.'
            : '이번 박스가 끝나가요. 다음 박스 비율 결정에 도움이 되는 신호 4가지만.'}
        </p>
        {/* 응답 진행 — 답한 항목 / 전체. null/미응답도 "잘 모르겠어요" 로
            의도된 응답이라 카운트. 사용자에게 "거의 다 왔어요" 시각 신호. */}
        {(() => {
          const answered = [
            stool !== null || existing?.stoolScore !== undefined,
            coat !== null || existing?.coatScore !== undefined,
            appetite !== null || existing?.appetiteScore !== undefined,
            ...(checkpoint === 'week_4'
              ? [satisfaction !== null || existing?.overallSatisfaction !== undefined]
              : []),
          ]
          const filled = answered.filter(Boolean).length
          const total = answered.length
          if (!editMode || total === 0) return null
          const pct = Math.round((filled / total) * 100)
          return (
            <div className="ck-progress" aria-label={`${filled}/${total} 항목 응답`}>
              <div className="ck-progress-bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="ck-progress-lbl">
                {filled} / {total} 항목
              </span>
            </div>
          )
        })()}
      </header>

      {existing && !editMode && (
        <div className="ck-existing">
          <Sparkles size={14} strokeWidth={2} color="var(--terracotta)" />
          <div>
            <strong>이번 cycle {checkpoint === 'week_2' ? '2주차' : '4주차'} 응답을 이미 받았어요.</strong>
            <br />
            아래 답변이 다음 박스 알고리즘에 반영돼요.
          </div>
          <button
            type="button"
            className="ck-edit-btn"
            onClick={() => setEditMode(true)}
          >
            다시 답하기
          </button>
        </div>
      )}

      <fieldset
        className="ck-section"
        disabled={!editMode}
      >
        <legend className="ck-sect-lbl">변 상태 (Bristol)</legend>
        <p className="ck-sect-hint">평소 변과 가장 비슷한 형태를 골라주세요.</p>
        <div className="ck-stool-grid">
          {STOOL_OPTIONS.map((s) => {
            const active = stool === s.v
            return (
              <button
                key={s.v}
                type="button"
                className={`ck-stool ${active ? 'on' : ''} ${s.tag}`}
                onClick={() => setStool(s.v)}
                aria-pressed={active}
              >
                <span className="ck-stool-num">#{s.v}</span>
                <span className="ck-stool-lbl">{s.label}</span>
                <span className="ck-stool-hint">{s.hint}</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className={`ck-skip ${stool === null ? 'on' : ''}`}
          onClick={() => setStool(null)}
        >
          {stool === null ? '✓ 잘 모르겠어요' : '잘 모르겠어요'}
        </button>
      </fieldset>

      <fieldset className="ck-section" disabled={!editMode}>
        <legend className="ck-sect-lbl">털 상태</legend>
        <p className="ck-sect-hint">윤기 / 푸석함 정도.</p>
        <FiveScale value={coat} onChange={setCoat} />
      </fieldset>

      <fieldset className="ck-section" disabled={!editMode}>
        <legend className="ck-sect-lbl">식욕</legend>
        <p className="ck-sect-hint">잘 먹는 정도.</p>
        <FiveScale value={appetite} onChange={setAppetite} />
      </fieldset>

      {checkpoint === 'week_4' && (
        <fieldset className="ck-section" disabled={!editMode}>
          <legend className="ck-sect-lbl">종합 만족도</legend>
          <p className="ck-sect-hint">
            이번 박스 전체 평가. 1-2 면 다음 cycle 알고리즘이 적극 조정해요.
          </p>
          <FiveScale value={satisfaction} onChange={setSatisfaction} />
        </fieldset>
      )}

      <fieldset className="ck-section" disabled={!editMode}>
        <legend className="ck-sect-lbl">더 알려주실 게 있다면 (선택)</legend>
        <textarea
          rows={4}
          maxLength={500}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="자유롭게 적어주세요. 예: 평소보다 활발해 보여요 / 가끔 토해요"
          className="ck-textarea"
        />
        <div className="ck-charcount">{freeText.length} / 500</div>
      </fieldset>

      {editMode && (
        <fieldset className="ck-section ck-photo-section">
          <legend className="ck-sect-lbl">변·털 사진 (선택)</legend>
          <p className="ck-sect-hint">
            첨부하면 다음 cycle 에 AI 자동 채점이 더 정확해져요. 5MB 이하 jpg/png.
          </p>
          {photoUrls.length > 0 && (
            <div className="ck-photo-grid">
              {photoUrls.map((path) => {
                const url = photoPreview[path]
                return (
                  <div key={path} className="ck-photo-thumb">
                    {url ? (
                      // Server-side signed URL 이라 next/image 대신 img.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt="체크인 사진"
                        loading="lazy"
                        className="ck-photo-img"
                      />
                    ) : (
                      <div className="ck-photo-loading">…</div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(path)}
                      className="ck-photo-del"
                      aria-label="사진 삭제"
                    >
                      <X size={11} strokeWidth={2.6} color="#fff" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <label className={'ck-photo-btn' + (uploading ? ' busy' : '')}>
            <Camera size={14} strokeWidth={2} />
            <span>{uploading ? '업로드 중...' : '사진 추가'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={false}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadPhoto(f)
                e.target.value = '' // 같은 파일 재선택 가능
              }}
              style={{ display: 'none' }}
            />
          </label>
        </fieldset>
      )}
      {!editMode && photoUrls.length > 0 && (
        <fieldset className="ck-section">
          <legend className="ck-sect-lbl">첨부된 사진</legend>
          <div className="ck-photo-grid">
            {photoUrls.map((path) => {
              const url = photoPreview[path]
              return (
                <div key={path} className="ck-photo-thumb">
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt="체크인 사진"
                      loading="lazy"
                      className="ck-photo-img"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>
      )}

      {err && (
        <div className="ck-err">
          <AlertCircle size={14} strokeWidth={2} />
          {err}
        </div>
      )}

      {editMode && (
        <div className="ck-cta">
          <button
            type="button"
            className="ck-submit"
            onClick={submit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                응답 보내기
                <Check size={14} strokeWidth={2.6} color="#fff" />
              </>
            )}
          </button>
        </div>
      )}
    </main>
  )
}

function FiveScale({
  value,
  onChange,
}: {
  value: 1 | 2 | 3 | 4 | 5 | null
  onChange: (v: 1 | 2 | 3 | 4 | 5 | null) => void
}) {
  return (
    <>
      <div className="ck-five">
        {([1, 2, 3, 4, 5] as const).map((v) => {
          const active = value === v
          return (
            <button
              key={v}
              type="button"
              className={`ck-five-btn ${active ? 'on' : ''}`}
              onClick={() => onChange(v)}
              aria-pressed={active}
            >
              <span className="num">{v}</span>
              <span className="lbl">{FIVE_LABELS[v - 1]}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className={`ck-skip ${value === null ? 'on' : ''}`}
        onClick={() => onChange(null)}
      >
        {value === null ? '✓ 잘 모르겠어요' : '잘 모르겠어요'}
      </button>
    </>
  )
}
