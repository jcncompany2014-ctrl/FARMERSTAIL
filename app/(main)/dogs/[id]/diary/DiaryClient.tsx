'use client'

import { useState, useRef } from 'react'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import Image from 'next/image'
import {
  Camera,
  Plus,
  Heart,
  Trash2,
  ImageIcon,
  Frown,
  Annoyed,
  Meh,
  Smile,
  Laugh,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { useConfirm } from '@/components/v3'
import StampMoment from '@/components/v3/StampMoment'
import RecordSegments from '@/components/dogs/RecordSegments'
import { petName } from '@/lib/korean'

/**
 * 사진 일기 client view — list + 새 entry 모달.
 *
 * # 매일 사용 surface
 *  - 페이지 상단 새 entry CTA 큼직하게
 *  - 카드 list — 그리드 (사진 1장이면 single, 2장+ 면 2열, 3장+ 4장은 grid 4)
 *  - mood 1-5 emoji + 짧은 메모 + 작성일
 *
 * # 업로드
 *  - 파일 선택 → client side 에서 1024px max 로 resize (canvas) → supabase
 *    storage `dog-diary-photos` 버킷의 user_id/dog_id/yyyy-mm-dd-uuid.webp 경로
 *  - 최대 5장. 5MB / 장 (마이그레이션 limit)
 */

type Entry = {
  id: string
  photo_urls: string[]
  note: string | null
  mood: number | null
  created_at: string
}

/**
 * audit #44: 이전엔 mood 이모지 5개 (😢😟😐🙂😊) — Lucide canon 위반 + 플랫폼별
 * 렌더링 격차. Frown/Annoyed/Meh/Smile/Laugh 로 1:1 매핑.
 */
const MOODS: ReadonlyArray<{ Icon: LucideIcon; label: string }> = [
  { Icon: Frown, label: '많이 안 좋아요' },
  { Icon: Annoyed, label: '조금 안 좋아요' },
  { Icon: Meh, label: '평범해요' },
  { Icon: Smile, label: '좋아요' },
  { Icon: Laugh, label: '아주 좋아요' },
]
const MAX_PHOTOS = 5

export default function DiaryClient({
  dogId,
  dogName,
  initialEntries,
}: {
  dogId: string
  dogName: string
  initialEntries: Entry[]
}) {
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [showNew, setShowNew] = useState(false)
  const [draftFiles, setDraftFiles] = useState<File[]>([])
  const [draftNote, setDraftNote] = useState('')
  const [draftMood, setDraftMood] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // de-AI 시그니처: 저장 성공 시 '도장 쾅' 모먼트 재생(토스트 대체). token++ 로 트리거.
  const [stampToken, setStampToken] = useState(0)
  // 시각 도장은 aria-hidden 이라, 스크린리더엔 별도 라이브 리전으로 성공을 알린다.
  const [srMsg, setSrMsg] = useState('')
  // 도장 하단 날짜("7.9") — 오늘(KST) 월.일.
  const todayMd = (() => {
    const [, m, d] = todayKstIsoDate().split('-')
    return `${Number(m)}.${Number(d)}`
  })()
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
      const uploadedUrls: string[] = []
      for (const file of draftFiles) {
        const blob = await resizeImage(file)
        const filename = `${user.id}/${dogId}/${today}-${crypto.randomUUID()}.webp`
        const { error: upErr } = await supabase.storage
          .from('dog-diary-photos')
          .upload(filename, blob, { contentType: 'image/webp', upsert: false })
        if (upErr) throw upErr
        const { data: signed } = await supabase.storage
          .from('dog-diary-photos')
          .createSignedUrl(filename, 60 * 60 * 24 * 365) // 1년 — bucket 이 private 라 signed URL 필요
        if (signed?.signedUrl) uploadedUrls.push(signed.signedUrl)
      }

      // 2) entry insert
      const { data, error } = await supabase
        .from('dog_diary')
        .insert({
          dog_id: dogId,
          user_id: user.id,
          photo_urls: uploadedUrls,
          note: draftNote.trim() || null,
          mood: draftMood,
        })
        .select('id, photo_urls, note, mood, created_at')
        .single()
      if (error) throw error
      if (data) setEntries((prev) => [data as Entry, ...prev])

      // de-AI: 성공 토스트 대신 '도장 쾅' 모먼트 + 스크린리더 라이브 안내(이중 알림 X).
      setSrMsg('일기를 저장했어요')
      setStampToken((t) => t + 1)
      setShowNew(false)
      setDraftFiles([])
      setDraftNote('')
      setDraftMood(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장하지 못했어요')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  async function handleDelete(entryId: string) {
    const ok = await confirm({
      title: '이 일기를 삭제할까요?',
      body: '사진과 메모 모두 사라져요. 되돌릴 수 없어요.',
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

  return (
    <div className="pb-20 px-5 max-w-md mx-auto">
      {/* de-AI 시그니처: 저장 성공 '도장 쾅'(시각) + 스크린리더 라이브 안내(청각). */}
      <StampMoment token={stampToken} sub={todayMd} />
      <span className="sr-only" role="status" aria-live="polite">
        {srMsg}
      </span>
      {/* 기록 허브 토글 — 일상 ↔ 건강일지. 어디서 들어와도 한 허브처럼. */}
      <RecordSegments dogId={dogId} active="diary" className="pt-4 pb-1" />
      <section className="pt-6 pb-2">
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="kicker">Diary · 일상 기록</span>
            <h1
              className="font-sans mt-1.5"
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {petName(dogName)}의 일상
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-[12px] font-bold text-white"
            style={{ background: 'var(--terracotta)' }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            기록 남기기
          </button>
        </div>
        {/* B-66 진행 사진 진입점 — 보호자 선호 분리 위해 비활성. 코드는
            /dogs/[id]/photos 에 보존, 재활성 시 아래 Link 만 복원. */}
      </section>

      {entries.length === 0 ? (
        <section className="mt-6">
          <div
            className="text-center rounded border px-5 py-12"
            style={{
              background: 'var(--bg-3)',
              borderColor: 'var(--rule)',
              borderStyle: 'dashed',
              borderWidth: 1.5,
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule)',
              }}
            >
              <Camera className="w-6 h-6 text-muted" strokeWidth={1.5} />
            </div>
            <span className="kicker kicker-muted">First Page · 첫 장</span>
            <h3
              className="font-sans mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              오늘의 한 장
            </h3>
            <p className="text-[12px] text-muted mt-2 leading-relaxed max-w-[260px] mx-auto">
              산책 다녀온 모습, 입맛 좋은 날, 잠든 표정. 매일 한 장씩 남기면 1년이 책이 돼요.
            </p>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="mt-5 inline-flex items-center gap-1 px-6 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              첫 기록 남기기
            </button>
          </div>
        </section>
      ) : (
        <section className="mt-4 space-y-3">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="bg-bg-3 rounded border border-rule overflow-hidden"
            >
              {entry.photo_urls.length > 0 && <PhotoGrid urls={entry.photo_urls} />}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {entry.mood !== null && MOODS[entry.mood - 1] && (
                      <span
                        className="inline-flex items-center"
                        aria-label={`기분 ${MOODS[entry.mood - 1]?.label ?? entry.mood}`}
                      >
                        {(() => {
                          const M = MOODS[entry.mood - 1]
                          if (!M) return null
                          const Icon = M.Icon
                          return (
                            <Icon
                              className="w-5 h-5"
                              strokeWidth={1.8}
                              style={{ color: 'var(--terracotta)' }}
                            />
                          )
                        })()}
                      </span>
                    )}
                    <span className="text-[10.5px] text-muted font-mono">
                      {formatKoDate(entry.created_at)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="text-muted hover:text-sale transition"
                    aria-label="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                  </button>
                </div>
                {entry.note && (
                  <p className="text-[13.5px] text-text leading-relaxed whitespace-pre-line">
                    {entry.note}
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {/* 새 entry 모달 */}
      {showNew && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={() => !submitting && setShowNew(false)}
        >
          <div
            ref={newEntryRef}
            role="dialog"
            aria-modal="true"
            aria-label="새 일기"
            tabIndex={-1}
            className="w-full md:max-w-md bg-bg-3 rounded-t-md md:rounded-md p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="kicker">New</span>
              <button
                type="button"
                onClick={() => !submitting && setShowNew(false)}
                disabled={submitting}
                className="text-[12px] text-muted disabled:opacity-50"
              >
                닫기
              </button>
            </div>

            {/* 사진 선택 + 미리보기 */}
            <div className="mb-4">
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
              <div className="grid grid-cols-3 gap-2">
                {draftFiles.map((f, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-lg overflow-hidden border border-rule bg-bg-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeDraftFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 text-white flex items-center justify-center text-[10.5px]"
                      aria-label="제거"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {draftFiles.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={pickFiles}
                    aria-label="사진 추가"
                    className="aspect-square rounded-lg border-2 border-dashed border-rule-2 flex items-center justify-center text-muted hover:border-text transition"
                  >
                    <ImageIcon className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <p className="text-[10.5px] text-muted mt-1.5">
                최대 {MAX_PHOTOS}장 · 1장당 5MB
              </p>
            </div>

            {/* 메모 */}
            <div className="mb-4">
              <label className="text-[10.5px] font-bold text-text">메모</label>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value.slice(0, 200))}
                rows={3}
                aria-label="메모"
                placeholder="오늘 특별한 일이 있었나요?"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-rule bg-bg text-[13.5px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta resize-none"
              />
              <div className="text-right text-[10.5px] text-muted mt-1">
                {draftNote.length}/200
              </div>
            </div>

            {/* 기분 */}
            <div className="mb-5">
              <label className="text-[10.5px] font-bold text-text">오늘 기분</label>
              <div className="mt-2 flex gap-1.5">
                {MOODS.map(({ Icon, label }, i) => {
                  const score = i + 1
                  const active = draftMood === score
                  return (
                    <button
                      key={score}
                      type="button"
                      aria-label={label}
                      aria-pressed={active}
                      onClick={() => setDraftMood(active ? null : score)}
                      className={`flex-1 py-2.5 rounded-lg border flex items-center justify-center transition ${
                        active
                          ? 'border-terracotta bg-terracotta/8'
                          : 'border-rule bg-bg-3'
                      }`}
                    >
                      <Icon
                        className="w-6 h-6"
                        strokeWidth={1.8}
                        style={{
                          color: active ? 'var(--terracotta)' : 'var(--muted)',
                        }}
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
              className="w-full py-3 rounded-full text-[13.5px] font-bold transition active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 animate-pulse" /> 저장 중...
                </span>
              ) : (
                '저장하기'
              )}
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
  if (urls.length === 1) {
    return (
      <div className="relative aspect-[4/3] bg-bg-2">
        <Image
          src={urls[0]!}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
        />
      </div>
    )
  }
  if (urls.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-px bg-rule">
        {urls.map((u, i) => (
          <div key={i} className="relative aspect-square bg-bg-2">
            <Image
              src={u}
              alt=""
              fill
              sizes="(max-width: 768px) 50vw, 300px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-px bg-rule">
      {urls.slice(0, 3).map((u, i) => (
        <div key={i} className="relative aspect-square bg-bg-2">
          <Image
            src={u}
            alt=""
            fill
            sizes="(max-width: 768px) 33vw, 200px"
            className="object-cover"
          />
          {i === 2 && urls.length > 3 && (
            <div className="absolute inset-0 bg-ink/50 flex items-center justify-center text-white font-bold text-[13.5px]">
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
