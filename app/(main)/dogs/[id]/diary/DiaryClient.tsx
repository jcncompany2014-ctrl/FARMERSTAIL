'use client'

import { useState, useRef } from 'react'
import { userFacingError } from '@/lib/error-message'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { useConfirm } from '@/components/v3'
import RecordSegments from '@/components/dogs/RecordSegments'
import { petName } from '@/lib/korean'
import { V3, V3Radius } from '@/lib/design/tokens'
import { CameraIcon, MoodFaceIcon, PlusIcon, TrashIcon, XIcon } from '@/components/v3/dog/DogIcons'
import {
  Grabber,
  SHEET_PANEL,
  SHEET_SCRIM,
  TextArea,
  primaryButtonStyle,
} from '@/components/v3/dog/DogFormParts'

/**
 * 사진 일기 client view — list + 새 entry 모달.
 *
 * # 매일 사용 surface
 *  - 페이지 상단 새 entry CTA 큼직하게
 *  - 카드 list — 사진 1장이면 넓게, 2장이면 2열, 3장+ 이면 3열(+N)
 *  - mood 1-5 얼굴 + 짧은 메모 + 작성일
 *
 * # 업로드
 *  - 파일 선택 → client side 에서 1024px max 로 resize (canvas) → supabase
 *    storage `dog-diary-photos` 버킷의 user_id/dog_id/yyyy-mm-dd-uuid.webp 경로
 *  - 최대 5장. 5MB / 장 (마이그레이션 limit)
 *
 * # 2026-10-09 앱 새 디자인('A 포스터', 시안 D01 일상 · D02 일기 쓰기 창 · D03 삭제 확인 · D04 빈 상태)
 *  - 머리줄: 회색 머리말 '일상 기록' + 제목(제목 글꼴 32) · 오른쪽 '기록 남기기'(먹색, 비었을 땐 먹선).
 *  - 일기 한 편 = 위 2px 먹선 + 사진(모서리 4) + 기분 칸(회색 면 · 얼굴 + 말) · 시각 · 휴지통 + 메모(17px).
 *  - 빈 상태 문구: "매일 한 장씩 남기면 1년이 책이 돼요"는 없는 기능(책 만들기)처럼 읽혀(사장님 결정 목록)
 *    시안 D04 문구 "매일 한 장씩 모으면 {이름}의 1년이 쌓여요"로 바꿨다.
 *  - 쓰기 창: 사진 칸 3열(빼기 단추 32) + 점선 '사진 추가' · 메모 칸 · 기분 5칸(고른 칸 = 먹선 2 + 회색 면).
 *    시트 안 오류는 지금처럼 토스트다 — 이 창은 <dialog> 가 아닌 화면 위 층이라 토스트가 가려지지 않는다.
 */

type Entry = {
  id: string
  photo_urls: string[]
  note: string | null
  mood: number | null
  created_at: string
}

/**
 * audit #44: 이전엔 mood 이모지 5개 (😢😟😐🙂😊) — 플랫폼별 렌더링 격차.
 * 2026-10-09: 얼굴 그림은 시안 선 그림(MoodFaceIcon, 1~5)으로.
 */
const MOODS: ReadonlyArray<{ label: string }> = [
  { label: '많이 안 좋아요' },
  { label: '조금 안 좋아요' },
  { label: '평범해요' },
  { label: '좋아요' },
  { label: '아주 좋아요' },
]
const MAX_PHOTOS = 5

/** 점검 화면(/design-check/dogs) 전용 — 쓰기 창을 연 채로 시작. 실제 화면은 넘기지 않는다. */
export type DiaryPreviewDraft = { files?: File[]; note?: string; mood?: number | null }

export default function DiaryClient({
  dogId,
  dogName,
  initialEntries,
  previewDraft,
}: {
  dogId: string
  dogName: string
  initialEntries: Entry[]
  previewDraft?: DiaryPreviewDraft
}) {
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [showNew, setShowNew] = useState(previewDraft !== undefined)
  const [draftFiles, setDraftFiles] = useState<File[]>(previewDraft?.files ?? [])
  const [draftNote, setDraftNote] = useState(previewDraft?.note ?? '')
  const [draftMood, setDraftMood] = useState<number | null>(previewDraft?.mood ?? null)
  const [submitting, setSubmitting] = useState(false)
  // 동기 가드 — disabled={submitting} 은 리렌더 후 적용이라 서브프레임 더블탭이
  // 빠져나가 일기가 중복 저장(사진 중복 업로드 + 중복 entry)될 수 있다. ref 는
  // 동기라 차단 (dogs/new·AddressForm·HealthLog·Reminders 패턴).
  const submittingRef = useRef(false)
  const newEntryRef = useRef<HTMLDivElement>(null)

  // 모달 a11y — focus trap / Esc / scroll lock. submitting 중엔 Esc 무시.
  useModalA11y({
    open: showNew,
    onClose: () => !submitting && setShowNew(false),
    containerRef: newEntryRef,
    preventEscape: submitting,
  })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function pickFiles() {
    fileInputRef.current?.click()
  }

  function onFilesPicked(files: FileList | null) {
    if (!files) return
    const arr = Array.from(files).slice(0, MAX_PHOTOS - draftFiles.length)
    setDraftFiles((prev) => [...prev, ...arr].slice(0, MAX_PHOTOS))
  }

  function removeDraftFile(idx: number) {
    setDraftFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  /**
   * Canvas resize — 모바일에서 4MB+ 사진을 그대로 올리면 5MB limit 걸림 + 업로드
   * 시간 길어짐. max 1280px 로 줄이고 webp 0.85 quality.
   */
  async function resizeImage(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file)
    const max = 1280
    const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * ratio)
    const h = Math.round(bitmap.height * ratio)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas ctx not available')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('blob failed'))),
        'image/webp',
        0.85,
      )
    })
  }

  async function handleSubmit() {
    if (draftFiles.length === 0 && !draftNote.trim()) {
      toast.error('사진이나 메모 중 하나는 입력해 주세요')
      return
    }
    if (submittingRef.current) return // 더블탭 중복 저장(사진+entry) 방지
    submittingRef.current = true
    setSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요해요')

      // 1) 각 사진 resize + upload
      const today = todayKstIsoDate()
      // ★DB 엔 **스토리지 경로**만 저장한다 (2026-08-19 5라운드 감사). 예전엔
      //   1년 signed URL 을 박제해 1년 뒤 사진이 통째로 깨졌다. 조회 시점에
      //   page.tsx 가 재서명한다(체크인 사진과 같은 패턴). 방금 올린 사진의
      //   즉시 표시용으로만 짧은 signed URL 을 따로 만들어 낙관적 갱신에 쓴다.
      const uploadedPaths: string[] = []
      const displayUrls: string[] = []
      for (const file of draftFiles) {
        const blob = await resizeImage(file)
        const filename = `${user.id}/${dogId}/${today}-${crypto.randomUUID()}.webp`
        const { error: upErr } = await supabase.storage
          .from('dog-diary-photos')
          .upload(filename, blob, { contentType: 'image/webp', upsert: false })
        if (upErr) throw upErr
        uploadedPaths.push(filename)
        const { data: signed } = await supabase.storage
          .from('dog-diary-photos')
          .createSignedUrl(filename, 60 * 60) // 표시용 짧은 TTL (DB 엔 경로 저장)
        if (signed?.signedUrl) displayUrls.push(signed.signedUrl)
      }

      // 2) entry insert — photo_urls 엔 경로를 저장한다.
      const { data, error } = await supabase
        .from('dog_diary')
        .insert({
          dog_id: dogId,
          user_id: user.id,
          photo_urls: uploadedPaths,
          note: draftNote.trim() || null,
          mood: draftMood,
        })
        .select('id, photo_urls, note, mood, created_at')
        .single()
      if (error) throw error
      // 낙관적 갱신은 표시용 signed URL 로 (DB 의 photo_urls 는 경로라 그대로
      // 렌더하면 안 열린다). 다음 페이지 로드부터는 page.tsx 가 재서명한다.
      if (data)
        setEntries((prev) => [
          { ...(data as Entry), photo_urls: displayUrls },
          ...prev,
        ])

      toast.success('일기를 저장했어요')
      setShowNew(false)
      setDraftFiles([])
      setDraftNote('')
      setDraftMood(null)
    } catch (err) {
      toast.error(userFacingError(err, '저장하지 못했어요'))
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  async function handleDelete(entryId: string) {
    const ok = await confirm({
      title: '이 일기를 삭제할까요?',
      // 시안 D03 문구.
      body: (
        <>
          사진과 메모가 모두 사라져요.
          <br />
          삭제하면 되돌릴 수 없어요.
        </>
      ),
      confirmLabel: '삭제',
      tone: 'destructive',
    })
    if (!ok) return
    const { error } = await supabase
      .from('dog_diary')
      .delete()
      .eq('id', entryId)
    if (error) {
      toast.error('삭제하지 못했어요')
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
    toast.success('삭제했어요')
  }

  const empty = entries.length === 0
  const moodLabel = draftMood !== null ? MOODS[draftMood - 1]?.label : undefined

  return (
    // 줄 높이 normal — 시안은 줄 높이를 안 준 글자가 글꼴 기본값이다(앱 전역 1.5 로 두면 칸마다 커진다).
    <div style={{ paddingBottom: 32, lineHeight: 'normal' }}>
      {/* 기록 허브 토글 — 일상 ↔ 건강일지. 어디서 들어와도 한 허브처럼. */}
      <RecordSegments dogId={dogId} active="diary" />

      <section
        style={{
          padding: '24px 20px 0',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>일상 기록</span>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, wordBreak: 'keep-all' }}>
            {petName(dogName)}의 일상
          </h1>
        </span>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          style={{
            flexShrink: 0,
            height: 48,
            padding: '0 16px',
            boxSizing: 'border-box',
            borderRadius: V3Radius.sm,
            // 비었을 땐 아래 빈 칸의 '첫 기록 남기기'가 주 버튼 — 여기는 먹선(시안 D04).
            border: empty ? `1.5px solid ${V3.ink}` : 0,
            background: empty ? '#FFFFFF' : V3.ink,
            color: empty ? V3.ink : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <PlusIcon size={18} />
          기록 남기기
        </button>
      </section>

      {empty ? (
        <section
          aria-label="아직 일기가 없어요"
          style={{
            margin: '22px 20px 0',
            padding: '40px 22px 32px',
            border: '1.5px dashed #9A9A9A',
            borderRadius: V3Radius.sm,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: V3.soft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: V3.inkSoft,
            }}
          >
            <CameraIcon size={34} strokeWidth={1.8} />
          </span>
          <span style={{ marginTop: 18, fontSize: 14, fontWeight: 700, color: V3.inkMute }}>첫 장</span>
          <h2 style={{ margin: '6px 0 0', fontSize: 28, lineHeight: 1.15 }}>오늘의 한 장</h2>
          <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
            산책 다녀온 모습, 입맛 좋은 날,
            <br />
            잠든 표정. 매일 한 장씩 모으면
            <br />
            {petName(dogName)}의 1년이 쌓여요.
          </p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            style={{ ...primaryButtonStyle(58), marginTop: 24, alignSelf: 'stretch' }}
          >
            첫 기록 남기기
          </button>
        </section>
      ) : (
        entries.map((entry, i) => {
          const mood = entry.mood !== null ? MOODS[entry.mood - 1] : undefined
          return (
            <article
              key={entry.id}
              style={{
                margin: `${i === 0 ? 22 : 26}px 20px 0`,
                borderTop: `2px solid ${V3.ink}`,
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {entry.photo_urls.length > 0 && <PhotoGrid urls={entry.photo_urls} />}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {mood && entry.mood !== null && (
                    <span
                      aria-label={`기분 ${mood.label}`}
                      style={{
                        height: 32,
                        padding: '0 10px 0 7px',
                        borderRadius: V3Radius.sm,
                        background: V3.soft,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 14,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      <MoodFaceIcon score={entry.mood} size={20} color={V3.ink} />
                      {mood.label}
                    </span>
                  )}
                  <span style={{ fontSize: 15, color: V3.inkMute }}>{formatKoDate(entry.created_at)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  aria-label="삭제"
                  style={{
                    width: 48,
                    height: 48,
                    marginRight: -12,
                    border: 0,
                    background: 'transparent',
                    color: V3.inkMute,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <TrashIcon size={22} />
                </button>
              </div>
              {entry.note && (
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{entry.note}</p>
              )}
            </article>
          )
        })
      )}

      {/* 새 일기 쓰기 창 (시안 D02) */}
      {showNew && (
        <div style={SHEET_SCRIM} onClick={() => !submitting && setShowNew(false)}>
          <div
            ref={newEntryRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-diary-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={SHEET_PANEL}
          >
            <Grabber />
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2
                id="new-diary-title"
                style={{ margin: 0, fontFamily: 'inherit', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}
              >
                새 일기
              </h2>
              <button
                type="button"
                onClick={() => !submitting && setShowNew(false)}
                disabled={submitting}
                style={{
                  height: 48,
                  padding: '0 4px',
                  border: 0,
                  background: 'transparent',
                  color: V3.ink,
                  fontFamily: 'inherit',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                닫기
              </button>
            </div>

            {/* 사진 선택 + 미리보기 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onFilesPicked(e.target.files)
                e.target.value = ''
              }}
            />
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {draftFiles.map((f, i) => (
                <span key={i} style={{ position: 'relative', display: 'block', aspectRatio: '1 / 1' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    style={{ width: '100%', height: '100%', borderRadius: V3Radius.sm, objectFit: 'cover', display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeDraftFile(i)}
                    aria-label="사진 빼기"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 32,
                      height: 32,
                      border: 0,
                      borderRadius: 16,
                      background: 'rgba(20, 20, 20, 0.72)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <XIcon size={14} strokeWidth={3} />
                  </button>
                </span>
              ))}
              {draftFiles.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={pickFiles}
                  aria-label="사진 추가"
                  style={{
                    aspectRatio: '1 / 1',
                    border: '1.5px dashed #9A9A9A',
                    borderRadius: V3Radius.sm,
                    background: '#FFFFFF',
                    color: V3.inkSoft,
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <CameraIcon size={26} />
                  <span style={{ fontSize: 14, fontWeight: 800 }}>사진 추가</span>
                </button>
              )}
            </div>
            <span style={{ marginTop: 8, fontSize: 14, color: V3.inkMute }}>
              사진은 {MAX_PHOTOS}장까지 올릴 수 있어요 · 1장에 5MB까지
            </span>

            {/* 메모 */}
            <label style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>메모</span>
              <TextArea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value.slice(0, 200))}
                rows={2}
                placeholder="오늘 특별한 일이 있었나요?"
                minHeight={92}
                style={{ lineHeight: 1.55 }}
              />
            </label>
            <span style={{ marginTop: 6, alignSelf: 'flex-end', fontSize: 13, color: V3.inkMute }}>
              {draftNote.length}/200
            </span>

            {/* 기분 */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span id="new-diary-mood" style={{ fontSize: 16, fontWeight: 800 }}>
                오늘 기분
                {moodLabel && <span style={{ fontWeight: 600, color: V3.inkMute }}> · {moodLabel}</span>}
              </span>
              <div
                role="group"
                aria-labelledby="new-diary-mood"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}
              >
                {MOODS.map(({ label }, i) => {
                  const score = i + 1
                  const active = draftMood === score
                  return (
                    <button
                      key={score}
                      type="button"
                      aria-label={label}
                      aria-pressed={active}
                      onClick={() => setDraftMood(active ? null : score)}
                      style={{
                        height: 56,
                        border: active ? `2px solid ${V3.ink}` : `1.5px solid ${V3.rule}`,
                        borderRadius: V3Radius.sm,
                        background: active ? V3.soft : '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <MoodFaceIcon
                        score={score}
                        size={28}
                        color={active ? V3.ink : '#9A9A9A'}
                        strokeWidth={active ? 2 : 1.8}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              aria-busy={submitting || undefined}
              style={{ ...primaryButtonStyle(58), marginTop: 22, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotoGrid({ urls }: { urls: string[] }) {
  // audit #102: raw <img> → next/image. supabase storage URL 은
  // next.config.ts remotePatterns 에 등록되어 자동 AVIF/WebP 변환.
  // 2026-10-09: 사진마다 모서리 4, 사이 4px(시안 D01) — 1장은 4:3 넓게, 2장은 정사각 2열, 3장 이상은 3열.
  if (urls.length === 1) {
    return (
      <div style={{ position: 'relative', aspectRatio: '350 / 262', borderRadius: V3Radius.sm, overflow: 'hidden', background: V3.soft }}>
        <Image src={urls[0]!} alt="" fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
      </div>
    )
  }
  const cols = urls.length === 2 ? 2 : 3
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 4 }}>
      {urls.slice(0, cols).map((u, i) => (
        <div
          key={i}
          style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: V3Radius.sm, overflow: 'hidden', background: V3.soft }}
        >
          <Image
            src={u}
            alt=""
            fill
            sizes={cols === 2 ? '(max-width: 768px) 50vw, 300px' : '(max-width: 768px) 33vw, 200px'}
            className="object-cover"
          />
          {i === 2 && urls.length > 3 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(20, 20, 20, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              +{urls.length - 3}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatKoDate(iso: string): string {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}
