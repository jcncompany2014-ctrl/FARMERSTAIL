'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { userFacingError } from '@/lib/error-message'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { petName } from '@/lib/korean'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'
import { haptic } from '@/lib/haptic'
import { trackCheckinSubmitted } from '@/lib/analytics'
import { ArrowRightIcon, CheckIcon, XIcon } from '@/components/v3/dog/DogIcons'
import './checkin.css'

/**
 * /dogs/[id]/checkin?cycle=N&checkpoint=week_2|week_4
 *
 * 보호자가 cycle 의 week_2 / week_4 응답을 보내는 폼. cron 이 보낸 push /
 * email 의 deep link 가 이 페이지로 진입.
 *
 * # 디자인
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 S23-checkin-week2 · S24-checkin-week4 · S25-checkin-answered ·
 * S26-checkin-result) — 흰 바탕·먹 글자·모서리 4px. 질문마다 위 2px 먹선 + 제목 글꼴 24, 고른 칸 = 먹색 바탕.
 * '응답을 이미 받았어요'·결과 피드백 카드가 그 화면의 도장 그림자 한 곳. .ck-* 접두 (checkin).
 * 영어·전문용어(변 상태 (Bristol)·다음 cycle 알고리즘·AI 채점)는 뺐다(앱시안 결정 16·17·'영어·전문용어').
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

type Stool = 1 | 2 | 3 | 4 | 5 | 6 | 7
type Five = 1 | 2 | 3 | 4 | 5

/**
 * 점검 화면(/design-check/box/checkin) 전용 — 로그인 없이 예시 값으로 그린다. 실제 화면은 넘기지 않는다.
 * 넘기면 강아지·기존 응답 조회를 건너뛰고 이 값으로 시작한다(저장 버튼은 로그인이 없어 저장되지 않는다).
 */
export type CheckinPreview = {
  dogName: string
  /** 이미 받은 응답 — 있으면 읽기 전용(S25). */
  existing?: {
    stoolScore: number | null
    coatScore: number | null
    appetiteScore: number | null
    overallSatisfaction: number | null
    freeText: string | null
  } | null
  /** 고른 답(입력 중 모습). */
  answers?: {
    stool?: Stool | null
    coat?: Five | null
    appetite?: Five | null
    satisfaction?: Five | null
    freeText?: string
  }
  /** 보낸 뒤 맞춤 피드백 화면(S26). */
  result?: { notes: string[]; shouldReanalyze: boolean }
}

const STOOL_OPTIONS: Array<{
  v: Stool
  label: string
  hint: string
  tag: 'good' | 'warn' | 'bad'
}> = [
  // 2026-10-09: '경증' → '가벼운'(시안 S23 — 전문 어투). 저장·판정은 숫자(v)라 글자만 바뀐다.
  { v: 1, label: '딱딱한 알갱이', hint: '심한 변비', tag: 'bad' },
  { v: 2, label: '울퉁불퉁 굳음', hint: '가벼운 변비', tag: 'bad' },
  { v: 3, label: '겉이 갈라짐', hint: '경계', tag: 'warn' },
  { v: 4, label: '매끄러운 소시지', hint: '이상적', tag: 'good' },
  { v: 5, label: '부드러운 덩어리', hint: '경계', tag: 'warn' },
  { v: 6, label: '죽 같은 무름', hint: '가벼운 설사', tag: 'bad' },
  { v: 7, label: '액체에 가까움', hint: '심한 설사', tag: 'bad' },
]

const FIVE_LABELS = ['매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음']

export default function CheckinClient({
  dogId,
  cycleNumber,
  checkpoint,
  preview,
}: {
  dogId: string
  cycleNumber: number
  checkpoint: Checkpoint
  preview?: CheckinPreview
}) {
  const router = useRouter()
  const supabase = createClient()
  const previewMode = preview !== undefined
  // 2주 피드백 해석 결과 — 제출 성공 시 맞춤 안내 + 재분석 권장 표시.
  const [result, setResult] = useState<{
    notes: string[]
    shouldReanalyze: boolean
  } | null>(preview?.result ?? null)
  const toast = useToast()

  const [dogName, setDogName] = useState(preview?.dogName ?? '')
  const [loading, setLoading] = useState(!previewMode)
  // 조회 실패를 "데이터 없음"으로 위장하지 않기 위한 상태(2026-08-05).
  const [loadError, setLoadError] = useState(false)
  const [existing, setExisting] = useState<null | {
    stoolScore: number | null
    coatScore: number | null
    appetiteScore: number | null
    overallSatisfaction: number | null
    freeText: string | null
  }>(preview?.existing ?? null)
  const [editMode, setEditMode] = useState(!preview?.existing)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // 응답 state
  const [stool, setStool] = useState<Stool | null>(preview?.answers?.stool ?? null)
  const [coat, setCoat] = useState<Five | null>(preview?.answers?.coat ?? null)
  const [appetite, setAppetite] = useState<Five | null>(preview?.answers?.appetite ?? null)
  const [satisfaction, setSatisfaction] = useState<Five | null>(
    preview?.answers?.satisfaction ?? null,
  )
  const [freeText, setFreeText] = useState(preview?.answers?.freeText ?? '')
  // 사진 — 변/털 첨부. v1.5+ Storage bucket dog_checkin_photos.
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoPreview, setPhotoPreview] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)

  // 강아지 정보 + 기존 응답 조회
  useEffect(() => {
    // 점검 화면은 예시 값으로 이미 시작했다 — 조회(로그인 필요)를 건너뛴다.
    if (previewMode) return
    let cancelled = false
    ;(async () => {
      // ★try/catch/finally 가 없으면 **무한 스피너**다(2026-08-05 감사).
      //   auth.getUser() 나 아래 두 조회 중 하나만 throw 해도(오프라인·5xx·
      //   타임아웃) setLoading(false) 에 도달하지 못해 "체크인 정보 불러오는
      //   중…" 에 영구히 갇힌다 — 재시도도, 오류 문구도, 탈출구도 없다.
      //   같은 버그를 AnalysisView 는 이미 고쳤다("무한 스피너 먹통이었음"
      //   주석까지 달려 있다). 2주 체크인은 구독 리텐션 루프의 핵심 화면이다.
      try {
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
      } catch (e) {
        console.error('checkin load', e)
        // 실패를 "데이터 없음"으로 위장하지 않는다 — 화면이 사유와 재시도를 준다.
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, cycleNumber, checkpoint, router, supabase, previewMode])

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
        // audit #69 일관성 — 원본 storage error message(내부 경로·정책 details) 노출 제거.
        console.error('[checkin] photo upload failed:', upErr.message)
        setErr('사진을 올리지 못했어요')
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
      setErr(userFacingError(e, '업로드를 마치지 못했어요'))
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
      setErr(userFacingError(e, '사진을 지우지 못했어요'))
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
        | {
            ok: true
            feedback?: { notes: string[]; shouldReanalyze: boolean }
          }
        | { ok?: false; code?: string; message?: string }
      if (!res.ok || !('ok' in json) || json.ok !== true) {
        const msg =
          ('message' in json && json.message) || '응답을 저장하지 못했어요'
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
      // 피드백 해석이 있으면 그 자리에서 맞춤 안내를 보여준다(즉시 redirect 대신).
      // "점점 똑똑해지는 AI 영양사" 경험 — 보호자가 답한 즉시 반응.
      const fb = 'feedback' in json ? json.feedback : undefined
      if (fb && fb.notes.length > 0) {
        setResult({ notes: fb.notes, shouldReanalyze: fb.shouldReanalyze })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        // 2026-10-09: 끝의 🐾 이모지는 뺐다(앱 새 디자인 — 이모지 쓰지 않음).
        toast.success(`${petName(dogName)}를 더 잘 챙길게요`)
        router.push(`/dogs/${dogId}/analysis`)
      }
    } catch (e) {
      setErr(userFacingError(e, '네트워크가 불안정해요. 다시 시도해 주세요'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="ck-page">
        <div className="ck-state">
          <Spinner size={18} />
          체크인 정보 불러오는 중...
        </div>
      </div>
    )
  }

  // 불러오기 실패 — 사유와 탈출구를 준다. 스피너에 갇히지 않는다.
  if (loadError) {
    return (
      <div className="ck-page">
        <div className="ck-state ck-state-error">
          <p>
            체크인 정보를 불러오지 못했어요.
            <br />
            잠시 후 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ck-retry"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  // 제출 후 — 2주 피드백 맞춤 안내 결과 화면.
  if (result) {
    return (
      <div className="ck-page">
        <section className="ck-hero">
          <span className="ck-kicker">
            맞춤 피드백
            <span className="ck-cycle">{cycleNumber}번째 박스</span>
          </span>
          <h1>
            {petName(dogName)}의 답변을<br />
            확인했어요
          </h1>
        </section>
        <Image
          src="/bowl-eating.jpg"
          alt="밥을 먹는 셸티"
          width={700}
          height={525}
          sizes="350px"
          loading="eager"
          className="ck-result-photo"
        />
        <section aria-label="피드백" className="ck-result-card">
          {result.notes.map((n, i) => (
            <div key={i} className="ck-result-note">
              <SparkleIcon />
              <span>{n}</span>
            </div>
          ))}
        </section>

        <div className="ck-result-actions">
          <button
            type="button"
            onClick={() => {
              haptic('tap')
              router.push(`/dogs/${dogId}/analysis`)
            }}
            className="ck-primary"
          >
            {result.shouldReanalyze ? '지금 다시 분석하기' : '분석 결과 보기'}
            <ArrowRightIcon size={20} strokeWidth={2.4} />
          </button>
          <Link href={`/dogs/${dogId}`} className="ck-text-link">
            {petName(dogName)} 페이지로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ck-page">
      <section className="ck-hero">
        <span className="ck-kicker">
          {checkpoint === 'week_2' ? '2주차 · 적응 체크' : '4주차 · 종합 평가'}
          <span className="ck-cycle">{cycleNumber}번째 박스</span>
        </span>
        <h1>
          {petName(dogName)}의<br />
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
                <span className="ft-num">{filled}</span> / <span className="ft-num">{total}</span> 항목
              </span>
            </div>
          )
        })()}
      </section>

      {existing && !editMode && (
        <div className="ck-existing" role="status">
          <span className="ck-existing-head">
            <CheckIcon size={20} color="#141414" style={{ marginTop: 2 }} />
            <span className="ck-existing-text">
              <strong>이번 박스 {checkpoint === 'week_2' ? '2주차' : '4주차'} 응답을 이미 받았어요.</strong>
              <span>아래 답변이 다음 박스 알고리즘에 반영돼요.</span>
            </span>
          </span>
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
        <legend className="ck-sect-lbl">
          <span className="ft-poster ck-sect-title">변 상태</span>
        </legend>
        <p className="ck-sect-hint">평소 변과 가장 비슷한 형태를 골라주세요.</p>
        <div className="ck-stool-grid">
          {STOOL_OPTIONS.map((s) => {
            const active = stool === s.v
            return (
              <button
                key={s.v}
                type="button"
                className={`ck-stool ${active ? 'on' : ''}`}
                onClick={() => setStool(s.v)}
                aria-pressed={active}
              >
                <span className="ft-num ck-stool-num">{s.v}</span>
                <span className="ck-stool-text">
                  <span className="ck-stool-lbl">{s.label}</span>
                  <span className="ck-stool-hint">
                    {s.tag === 'good' && <span className="ck-stool-dot" aria-hidden />}
                    {s.hint}
                  </span>
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className={`ck-skip ck-skip-cell ${stool === null ? 'on' : ''}`}
            onClick={() => setStool(null)}
            aria-pressed={stool === null}
          >
            {stool === null && <CheckIcon size={16} strokeWidth={3} />}
            잘 모르겠어요
          </button>
        </div>
      </fieldset>

      <fieldset className="ck-section" disabled={!editMode}>
        <legend className="ck-sect-lbl">
          <span className="ft-poster ck-sect-title">털 상태</span>
        </legend>
        <p className="ck-sect-hint">윤기 / 푸석함 정도.</p>
        <FiveScale value={coat} onChange={setCoat} />
      </fieldset>

      <fieldset className="ck-section" disabled={!editMode}>
        <legend className="ck-sect-lbl">
          <span className="ft-poster ck-sect-title">식욕</span>
        </legend>
        <p className="ck-sect-hint">잘 먹는 정도.</p>
        <FiveScale value={appetite} onChange={setAppetite} />
      </fieldset>

      {checkpoint === 'week_4' && (
        <fieldset className="ck-section" disabled={!editMode}>
          <legend className="ck-sect-lbl">
            <span className="ft-poster ck-sect-title">종합 만족도</span>
          </legend>
          <p className="ck-sect-hint">
            이번 박스 전체 평가예요. 1~2점이면 다음 박스를 크게 조정해요.
          </p>
          <FiveScale value={satisfaction} onChange={setSatisfaction} />
        </fieldset>
      )}

      <fieldset className="ck-section" disabled={!editMode}>
        <legend className="ck-sect-lbl">
          <span className="ft-poster ck-sect-title is-small">더 알려주실 게 있다면</span>{' '}
          <span className="ck-optional">선택</span>
        </legend>
        <textarea
          rows={4}
          maxLength={500}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          aria-label="자유 응답 (선택)"
          placeholder="자유롭게 적어주세요. 예: 평소보다 활발해 보여요 / 가끔 토해요"
          className="ck-textarea"
        />
        <div className="ck-charcount">{freeText.length} / 500</div>
      </fieldset>

      {editMode && (
        <fieldset className="ck-section ck-photo-section">
          <legend className="ck-sect-lbl">
            <span className="ck-photo-title">변·털 사진</span>{' '}
            <span className="ck-optional">선택</span>
          </legend>
          {/* 2026-10-09: "첨부하면 다음 cycle 에 AI 자동 채점이 더 정확해져요" 는 뺐다 — 안 쓰는 기능(앱시안 결정 17). */}
          <p className="ck-sect-hint ck-photo-hint">5MB 이하 사진.</p>
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
                      <XIcon size={12} color="#FFFFFF" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <label className={'ck-photo-btn' + (uploading ? ' busy' : '')}>
            <CameraIcon />
            <span>{uploading ? '업로드 중...' : '사진 추가'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={false}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadPhoto(f)
                e.target.value = '' // 같은 파일 재선택 가능
              }}
              style={{ display: 'none' }}
            />
          </label>
        </fieldset>
      )}
      {!editMode && photoUrls.length > 0 && (
        <fieldset className="ck-section ck-photo-section">
          <legend className="ck-sect-lbl">
            <span className="ck-photo-title">첨부된 사진</span>
          </legend>
          <div className="ck-photo-grid ck-photo-grid-ro">
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
        <div className="ck-err" role="alert">
          <AlertIcon />
          {err}
        </div>
      )}

      {editMode ? (
        <div className="ck-cta">
          <button
            type="button"
            className="ck-submit"
            onClick={submit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={18} strokeWidth={2.4} className="animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                응답 보내기
                <CheckIcon size={18} strokeWidth={2.8} color="#FFFFFF" />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="ck-end" aria-hidden />
      )}
    </div>
  )
}

function FiveScale({
  value,
  onChange,
}: {
  value: Five | null
  onChange: (v: Five | null) => void
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
              <span className="ft-num num">{v}</span>
              <span className="lbl">{FIVE_LABELS[v - 1]}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className={`ck-skip ${value === null ? 'on' : ''}`}
        onClick={() => onChange(null)}
        aria-pressed={value === null}
      >
        {value === null && <CheckIcon size={16} strokeWidth={3} />}
        잘 모르겠어요
      </button>
    </>
  )
}

/* ── 선 그림 — 시안 원본 HTML 의 SVG(24 격자) 그대로. 장식(aria-hidden). ── */

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16v.3" />
    </svg>
  )
}
