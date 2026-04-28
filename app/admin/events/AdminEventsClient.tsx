'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Trash2,
  Pencil,
  X,
  ExternalLink,
  Calendar,
  Ticket,
  ImageIcon,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * /admin/events — CRUD 클라이언트.
 *
 * 편집 가능한 필드는 events 테이블 스키마에 대응
 * (`20260424000007_events.sql`). 폼은 생성/수정 겸용 모달 하나 — 쿠폰 관리
 * 와 동일한 패턴. perks / terms 는 multi-line textarea 를 "한 줄 = 하나"
 * 규칙으로 파싱 (입력이 한결 수월). cta_secondary 는 label+href 두 칸.
 *
 * 쿠폰 드롭다운 — `cta_variant='coupon-claim'` 을 고르면 couponCode 입력이
 * 활성화된다. 오타 방지 위해 기존 활성 쿠폰 select + custom 입력 둘 다 허용
 * (아직 생성 안 된 쿠폰을 먼저 이벤트에 예약하고 싶을 수 있어서).
 */

export type AdminEventRow = {
  id: string
  slug: string
  kicker: string
  en_title: string
  ko_subtitle: string
  tagline: string
  highlight: string
  starts_at: string
  ends_at: string
  status_label: string
  palette: 'ink' | 'terracotta' | 'moss' | 'gold'
  kind: 'default' | 'welcome'
  cta_variant: 'coupon-claim' | 'benefit-auto'
  coupon_code: string | null
  detail_lede: string
  perks: unknown
  terms: unknown
  cta_secondary: { label: string; href: string } | null
  sort_priority: number
  is_active: boolean
  image_url: string | null
  image_alt: string | null
  created_at: string
  updated_at: string
}

type CouponOption = {
  code: string
  name: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  is_active: boolean
}

const PALETTE_OPTIONS: Array<{
  value: AdminEventRow['palette']
  label: string
  swatch: string
}> = [
  { value: 'ink', label: 'Ink (검정)', swatch: '#1E1A14' },
  { value: 'terracotta', label: 'Terracotta (적갈)', swatch: '#A0452E' },
  { value: 'moss', label: 'Moss (녹색)', swatch: '#556828' },
  { value: 'gold', label: 'Gold (황)', swatch: '#D4A94A' },
]

const STATUS_PRESETS = ['LIVE', 'LIVE · D-1', 'ONGOING', 'D-7', 'D-30', 'SOON']

/** jsonb 필드 안전 파싱 — string[] 형태만 인정. */
function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return (v as unknown[]).filter((x): x is string => typeof x === 'string')
}

/** 기간 라벨 — 리스트용 짧은 포맷 'YY.MM.DD – MM.DD'. */
function formatPeriod(startsAt: string, endsAt: string) {
  const s = new Date(startsAt)
  const e = new Date(endsAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const yy = (d: Date) => String(d.getFullYear()).slice(2)
  if (s.getFullYear() === e.getFullYear()) {
    return `${yy(s)}.${pad(s.getMonth() + 1)}.${pad(s.getDate())} – ${pad(e.getMonth() + 1)}.${pad(e.getDate())}`
  }
  return `${yy(s)}.${pad(s.getMonth() + 1)}.${pad(s.getDate())} – ${yy(e)}.${pad(e.getMonth() + 1)}.${pad(e.getDate())}`
}

/** <input type="datetime-local"> 용. timestamptz → 'YYYY-MM-DDTHH:MM'. */
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 반대 변환 — local string → ISO. 브라우저 로컬 타임존 기준으로 파싱. */
function fromLocalInput(local: string) {
  if (!local) return null
  const d = new Date(local)
  return d.toISOString()
}

export default function AdminEventsClient({
  initialEvents,
  coupons,
}: {
  initialEvents: AdminEventRow[]
  coupons: CouponOption[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminEventRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state — 편집 모달 열 때 editing 값으로 초기화.
  const [slug, setSlug] = useState('')
  const [kicker, setKicker] = useState('')
  const [enTitle, setEnTitle] = useState('')
  const [koSubtitle, setKoSubtitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [highlight, setHighlight] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [statusLabel, setStatusLabel] = useState('ONGOING')
  const [palette, setPalette] = useState<AdminEventRow['palette']>('ink')
  const [kind, setKind] = useState<AdminEventRow['kind']>('default')
  const [ctaVariant, setCtaVariant] =
    useState<AdminEventRow['cta_variant']>('coupon-claim')
  const [couponCode, setCouponCode] = useState('')
  const [detailLede, setDetailLede] = useState('')
  const [perksText, setPerksText] = useState('')
  const [termsText, setTermsText] = useState('')
  const [ctaSecondaryLabel, setCtaSecondaryLabel] = useState('')
  const [ctaSecondaryHref, setCtaSecondaryHref] = useState('')
  const [sortPriority, setSortPriority] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeCoupons = useMemo(
    () => coupons.filter((c) => c.is_active),
    [coupons]
  )

  function resetForm() {
    setSlug('')
    setKicker('')
    setEnTitle('')
    setKoSubtitle('')
    setTagline('')
    setHighlight('')
    setStartsAt('')
    setEndsAt('')
    setStatusLabel('ONGOING')
    setPalette('ink')
    setKind('default')
    setCtaVariant('coupon-claim')
    setCouponCode('')
    setDetailLede('')
    setPerksText('')
    setTermsText('')
    setCtaSecondaryLabel('')
    setCtaSecondaryHref('')
    setSortPriority(0)
    setIsActive(true)
    setImageUrl('')
    setImageAlt('')
  }

  function openCreate() {
    setEditing(null)
    resetForm()
    setModalOpen(true)
  }

  function openEdit(e: AdminEventRow) {
    setEditing(e)
    setSlug(e.slug)
    setKicker(e.kicker)
    setEnTitle(e.en_title)
    setKoSubtitle(e.ko_subtitle)
    setTagline(e.tagline)
    setHighlight(e.highlight)
    setStartsAt(toLocalInput(e.starts_at))
    setEndsAt(toLocalInput(e.ends_at))
    setStatusLabel(e.status_label)
    setPalette(e.palette)
    setKind(e.kind)
    setCtaVariant(e.cta_variant)
    setCouponCode(e.coupon_code ?? '')
    setDetailLede(e.detail_lede)
    setPerksText(toStringArray(e.perks).join('\n'))
    setTermsText(toStringArray(e.terms).join('\n'))
    setCtaSecondaryLabel(e.cta_secondary?.label ?? '')
    setCtaSecondaryHref(e.cta_secondary?.href ?? '')
    setSortPriority(e.sort_priority)
    setIsActive(e.is_active)
    setImageUrl(e.image_url ?? '')
    setImageAlt(e.image_alt ?? '')
    setModalOpen(true)
  }

  /**
   * 이미지 업로드 — 파일 선택 즉시 `/api/admin/events/upload` 로 전송.
   * 응답에서 받은 public URL 을 imageUrl state 에 반영. 업로드 결과를
   * 바로 프리뷰로 보여주기 위해 low-latency 로 동작하도록 저장/알림은
   * 최소화.
   */
  async function handleFileSelect(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file) return

    // slug 를 폴더 프리픽스로 넘기면 버킷 안이 이벤트별로 정리됨. 신규
    // 생성 중이라 slug 가 비어 있으면 'untitled' 로 fallback.
    const slugForPath = slug.trim() || 'untitled'

    const fd = new FormData()
    fd.append('file', file)
    fd.append('slug', slugForPath)

    setUploading(true)
    try {
      const res = await fetch('/api/admin/events/upload', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        alert('이미지 업로드 실패: ' + (json?.message ?? res.status))
        return
      }
      setImageUrl(json.url as string)
    } catch (err) {
      alert(
        '이미지 업로드 중 오류: ' +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setUploading(false)
      // 같은 파일을 다시 선택해도 change 이벤트가 발화하도록 input 초기화.
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function save() {
    // Client-side validation — DB CHECK 제약과 중복되지만 UX 위해 먼저.
    if (!slug.trim() || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug.trim())) {
      alert('slug 는 소문자/숫자/하이픈만 허용 (예: black-friday)')
      return
    }
    if (!kicker.trim() || !enTitle.trim() || !koSubtitle.trim()) {
      alert('kicker / enTitle / koSubtitle 은 필수입니다')
      return
    }
    if (!startsAt || !endsAt) {
      alert('시작/종료 일시를 입력해주세요')
      return
    }
    const startsIso = fromLocalInput(startsAt)
    const endsIso = fromLocalInput(endsAt)
    if (!startsIso || !endsIso || new Date(endsIso) <= new Date(startsIso)) {
      alert('종료 일시는 시작 일시보다 뒤여야 합니다')
      return
    }

    const perks = perksText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const terms = termsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    // 보조 CTA 는 둘 다 있을 때만 저장. 한쪽만 채우면 null 처리.
    const ctaSecondary =
      ctaSecondaryLabel.trim() && ctaSecondaryHref.trim()
        ? { label: ctaSecondaryLabel.trim(), href: ctaSecondaryHref.trim() }
        : null

    // coupon-claim 이 아닌 경우 coupon_code 는 무조건 NULL — 데이터 일관성
    // 유지. benefit-auto 이벤트에 쿠폰 코드가 남아있으면 혼란스럽다.
    const payload = {
      slug: slug.trim(),
      kicker: kicker.trim(),
      en_title: enTitle.trim(),
      ko_subtitle: koSubtitle.trim(),
      tagline: tagline.trim(),
      highlight: highlight.trim(),
      starts_at: startsIso,
      ends_at: endsIso,
      status_label: statusLabel.trim() || 'ONGOING',
      palette,
      kind,
      cta_variant: ctaVariant,
      coupon_code:
        ctaVariant === 'coupon-claim' && couponCode.trim()
          ? couponCode.trim().toUpperCase()
          : null,
      detail_lede: detailLede.trim(),
      perks,
      terms,
      cta_secondary: ctaSecondary,
      sort_priority: sortPriority,
      is_active: isActive,
      image_url: imageUrl.trim() || null,
      image_alt: imageAlt.trim() || null,
    }

    setSaving(true)
    const { error } = editing
      ? await supabase.from('events').update(payload).eq('id', editing.id)
      : await supabase.from('events').insert(payload)
    setSaving(false)

    if (error) {
      alert(
        (editing ? '수정' : '생성') +
          ' 실패: ' +
          error.message +
          (error.message.includes('duplicate') ? ' (slug 중복?)' : '')
      )
      return
    }

    setModalOpen(false)
    setEditing(null)
    router.refresh()
  }

  async function toggleActive(e: AdminEventRow) {
    const { error } = await supabase
      .from('events')
      .update({ is_active: !e.is_active })
      .eq('id', e.id)
    if (error) {
      alert('활성화 상태 변경 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  async function remove(e: AdminEventRow) {
    if (
      !confirm(
        `"${e.en_title}" 이벤트를 삭제할까요?\n(되돌릴 수 없습니다. 일시 중지만 원하면 활성 토글을 쓰세요.)`
      )
    )
      return
    setDeleting(e.id)
    const { error } = await supabase.from('events').delete().eq('id', e.id)
    setDeleting(null)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  // ── 리스트 상태 요약 — 오늘 기준 "진행중/예정/종료/비활성" 뱃지.
  const now = new Date()
  function statusOf(e: AdminEventRow): {
    label: string
    color: string
  } {
    if (!e.is_active) return { label: '비활성', color: 'bg-rule text-text' }
    const s = new Date(e.starts_at)
    const en = new Date(e.ends_at)
    if (now < s) return { label: '예정', color: 'bg-gold/20 text-gold' }
    if (now > en) return { label: '종료', color: 'bg-rule text-muted' }
    return { label: '진행중', color: 'bg-moss text-white' }
  }

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">EVENTS</h1>
          <p className="text-sm text-muted mt-1">
            랜딩 · 대시보드 · /events 페이지에 공개되는 프로모션. 총{' '}
            {initialEvents.length}개 등록.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-terracotta text-white text-sm font-semibold hover:bg-[#8A3822] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />새 이벤트
        </button>
      </div>

      {/* ── 리스트 ── */}
      {initialEvents.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-rule text-center">
          <p className="text-sm text-muted">
            아직 등록된 이벤트가 없어요. 우측 상단 &ldquo;새 이벤트&rdquo; 로 시작하세요.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted border-b border-rule bg-bg">
                <th className="text-left py-3 px-4 font-medium">상태</th>
                <th className="text-left py-3 px-4 font-medium">타이틀</th>
                <th className="text-left py-3 px-4 font-medium">기간</th>
                <th className="text-left py-3 px-4 font-medium">혜택</th>
                <th className="text-left py-3 px-4 font-medium">쿠폰</th>
                <th className="text-right py-3 px-4 font-medium">우선순위</th>
                <th className="text-right py-3 px-4 font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {initialEvents.map((e) => {
                const st = statusOf(e)
                return (
                  <tr
                    key={e.id}
                    className="border-b border-bg last:border-b-0 hover:bg-bg/60 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${st.color}`}
                        >
                          {st.label}
                        </span>
                        <button
                          onClick={() => toggleActive(e)}
                          className="text-[10px] text-muted hover:text-terracotta underline underline-offset-2 w-fit"
                        >
                          {e.is_active ? '일시중지' : '재활성화'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-3 items-start">
                        {/* 미니 썸네일 — 이미지 있으면 표시, 없으면 palette
                            swatch 폴백으로 편집 효율 업. */}
                        {e.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.image_url}
                            alt=""
                            className="w-10 h-12 rounded object-cover border border-rule shrink-0"
                          />
                        ) : (
                          <div
                            className="w-10 h-12 rounded border border-rule shrink-0 flex items-center justify-center"
                            style={{
                              background:
                                PALETTE_OPTIONS.find(
                                  (p) => p.value === e.palette
                                )?.swatch ?? '#000',
                            }}
                          >
                            <ImageIcon
                              className="w-3 h-3 text-white/60"
                              strokeWidth={1.5}
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-ink">
                            {e.en_title}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5">
                            {e.ko_subtitle}
                          </div>
                          <Link
                            href={`/events/${e.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-terracotta hover:underline mt-1"
                          >
                            /events/{e.slug}
                            <ExternalLink
                              className="w-2.5 h-2.5"
                              strokeWidth={2}
                            />
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px] font-mono tabular-nums text-ink">
                      <div className="flex items-center gap-1.5">
                        <Calendar
                          className="w-3 h-3 text-muted"
                          strokeWidth={2}
                        />
                        {formatPeriod(e.starts_at, e.ends_at)}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5 pl-4">
                        {e.status_label}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-ink font-semibold">
                      {e.highlight}
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {e.cta_variant === 'coupon-claim' && e.coupon_code ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta font-mono">
                          <Ticket className="w-3 h-3" strokeWidth={2} />
                          {e.coupon_code}
                        </span>
                      ) : e.cta_variant === 'benefit-auto' ? (
                        <span className="text-muted">자동 혜택</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-[11px] font-mono tabular-nums text-ink">
                      {e.sort_priority}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          className="p-1.5 rounded hover:bg-rule transition"
                          title="편집"
                        >
                          <Pencil
                            className="w-3.5 h-3.5 text-ink"
                            strokeWidth={2}
                          />
                        </button>
                        <button
                          onClick={() => remove(e)}
                          disabled={deleting === e.id}
                          className="p-1.5 rounded hover:bg-sale/10 transition disabled:opacity-40"
                          title="삭제"
                        >
                          <Trash2
                            className="w-3.5 h-3.5 text-sale"
                            strokeWidth={2}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 안내 ── */}
      <div className="mt-6 p-4 rounded-xl bg-bg border border-rule text-[11px] text-muted leading-relaxed">
        <p>
          <strong className="text-ink">상태 배지</strong>는 시스템이 자동
          계산해요 — 활성 토글이 켜져있고 오늘이 기간 안이면 &ldquo;진행중&rdquo;. 공개
          노출은 상태=진행중 + is_active=true 일 때만.
        </p>
        <p className="mt-1">
          <strong className="text-ink">우선순위</strong>는 높을수록 먼저
          노출됩니다. 대시보드는 상위 3개만 보여요.
        </p>
      </div>

      {/* ── 모달 ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 flex items-start justify-center p-6 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-bg rounded-2xl shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rule sticky top-0 bg-bg rounded-t-2xl z-10">
              <h2 className="font-['Archivo_Black'] text-lg text-ink">
                {editing ? 'EDIT EVENT' : 'NEW EVENT'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded hover:bg-rule transition"
              >
                <X className="w-4 h-4 text-ink" strokeWidth={2} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 기본 식별자 */}
              <Field label="slug (URL 조각)" hint="소문자/숫자/하이픈만. 예: black-friday">
                <input
                  type="text"
                  value={slug}
                  onChange={(ev) => setSlug(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                  placeholder="black-friday"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="kicker (상단 라벨)">
                  <input
                    type="text"
                    value={kicker}
                    onChange={(ev) => setKicker(ev.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                    placeholder="Limited · 블랙 프라이데이"
                  />
                </Field>
                <Field label="highlight (숫자 강조)">
                  <input
                    type="text"
                    value={highlight}
                    onChange={(ev) => setHighlight(ev.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                    placeholder="최대 50% OFF"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="enTitle (대형 영문)">
                  <input
                    type="text"
                    value={enTitle}
                    onChange={(ev) => setEnTitle(ev.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-serif font-bold"
                    placeholder="BLACK FRIDAY"
                  />
                </Field>
                <Field label="koSubtitle (한글 서브)">
                  <input
                    type="text"
                    value={koSubtitle}
                    onChange={(ev) => setKoSubtitle(ev.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                    placeholder="연중 최대 혜택"
                  />
                </Field>
              </div>

              {/* 대표 이미지 — 카드 / 상세 hero 양쪽에 공통 사용 */}
              <Field
                label="대표 이미지"
                hint="카드 배경 + 상세 hero backdrop 에 동일 이미지. 4:5 비율 권장 (최소 1080×1350). 최대 8MB."
              >
                <div className="flex gap-4 items-start">
                  {/* 프리뷰 */}
                  <div
                    className="w-32 h-40 rounded-lg border border-rule bg-bg shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ aspectRatio: '4 / 5' }}
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted">
                        <ImageIcon className="w-6 h-6" strokeWidth={1.5} />
                        <span className="text-[10px]">이미지 없음</span>
                      </div>
                    )}
                  </div>

                  {/* 컨트롤 */}
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-xs font-semibold hover:bg-[#3A2F22] transition disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {uploading
                        ? '업로드 중…'
                        : imageUrl
                          ? '다른 이미지로 교체'
                          : '이미지 선택'}
                    </button>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageUrl('')
                          setImageAlt('')
                        }}
                        className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-rule text-[11px] text-sale hover:bg-sale/10 transition"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={2} />
                        이미지 제거
                      </button>
                    )}
                    <input
                      type="text"
                      value={imageAlt}
                      onChange={(ev) => setImageAlt(ev.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-xs"
                      placeholder="alt 텍스트 (선택)"
                    />
                    {imageUrl && (
                      <p className="text-[10px] font-mono text-muted truncate">
                        {imageUrl}
                      </p>
                    )}
                  </div>
                </div>
              </Field>

              <Field label="tagline (요약 1~2줄)">
                <textarea
                  value={tagline}
                  onChange={(ev) => setTagline(ev.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm resize-none"
                  placeholder="단 4일. 재고 소진 시 조기 마감."
                />
              </Field>

              {/* 기간 */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="시작 일시">
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(ev) => setStartsAt(ev.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                  />
                </Field>
                <Field label="종료 일시">
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(ev) => setEndsAt(ev.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                  />
                </Field>
              </div>

              <Field label="상태 라벨 (카드 우상단 chip)">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={statusLabel}
                    onChange={(ev) => setStatusLabel(ev.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                    placeholder="ONGOING"
                  />
                  <select
                    onChange={(ev) => {
                      if (ev.target.value) setStatusLabel(ev.target.value)
                      ev.target.value = ''
                    }}
                    className="px-2 py-2 rounded-lg border border-rule bg-white text-xs"
                  >
                    <option value="">프리셋</option>
                    {STATUS_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              {/* 시각 / 분기 */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="palette">
                  <select
                    value={palette}
                    onChange={(ev) =>
                      setPalette(ev.target.value as AdminEventRow['palette'])
                    }
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                  >
                    {PALETTE_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <div
                    className="mt-2 h-3 rounded"
                    style={{
                      background:
                        PALETTE_OPTIONS.find((p) => p.value === palette)
                          ?.swatch ?? '#000',
                    }}
                  />
                </Field>
                <Field label="kind">
                  <select
                    value={kind}
                    onChange={(ev) =>
                      setKind(ev.target.value as AdminEventRow['kind'])
                    }
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                  >
                    <option value="default">default (일반)</option>
                    <option value="welcome">welcome (첫가입)</option>
                  </select>
                </Field>
                <Field label="CTA 성격">
                  <select
                    value={ctaVariant}
                    onChange={(ev) =>
                      setCtaVariant(
                        ev.target.value as AdminEventRow['cta_variant']
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                  >
                    <option value="coupon-claim">쿠폰 받기</option>
                    <option value="benefit-auto">자동 혜택</option>
                  </select>
                </Field>
              </div>

              {/* 쿠폰 코드 — coupon-claim 때만 활성 */}
              {ctaVariant === 'coupon-claim' && (
                <Field
                  label="쿠폰 코드"
                  hint="체크아웃에서 입력될 코드. 기존 쿠폰 선택 또는 직접 입력."
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(ev) =>
                        setCouponCode(ev.target.value.toUpperCase())
                      }
                      className="flex-1 px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                      placeholder="BF2026"
                    />
                    <select
                      value=""
                      onChange={(ev) => {
                        if (ev.target.value) setCouponCode(ev.target.value)
                      }}
                      className="px-2 py-2 rounded-lg border border-rule bg-white text-xs min-w-[140px]"
                    >
                      <option value="">기존 쿠폰에서…</option>
                      {activeCoupons.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} · {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {couponCode &&
                    !activeCoupons.find((c) => c.code === couponCode) && (
                      <p className="mt-1 text-[10px] text-gold">
                        ※ 이 코드의 쿠폰이 아직 없거나 비활성. 체크아웃 전에{' '}
                        <Link
                          href="/admin/coupons"
                          className="underline text-terracotta"
                        >
                          쿠폰 관리
                        </Link>{' '}
                        에서 생성해주세요.
                      </p>
                    )}
                </Field>
              )}

              {/* 상세 본문 */}
              <Field label="detailLede (상세 hero 아래 intro)">
                <textarea
                  value={detailLede}
                  onChange={(ev) => setDetailLede(ev.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm resize-none"
                  placeholder="연간 가장 큰 폭으로 가격이 움직이는 단 4일. ..."
                />
              </Field>

              <Field
                label="perks (혜택, 한 줄에 하나)"
                hint="3~5개 권장. 빈 줄은 무시됩니다."
              >
                <textarea
                  value={perksText}
                  onChange={(ev) => setPerksText(ev.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm resize-none"
                  placeholder="전 라인 최대 50% 할인&#10;₩70,000 이상 무료배송&#10;정기배송 가입 추가 10%"
                />
              </Field>

              <Field
                label="terms (유의사항, 한 줄에 하나)"
                hint="2~4개 권장."
              >
                <textarea
                  value={termsText}
                  onChange={(ev) => setTermsText(ev.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm resize-none"
                  placeholder="기간 한정&#10;재고 소진 시 마감&#10;1인 1회 사용"
                />
              </Field>

              {/* 보조 CTA */}
              <Field
                label="보조 CTA (옵션)"
                hint="상세 페이지 하단 링크. 둘 다 비우면 없음."
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ctaSecondaryLabel}
                    onChange={(ev) => setCtaSecondaryLabel(ev.target.value)}
                    className="px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                    placeholder="세일 상품 보러 가기"
                  />
                  <input
                    type="text"
                    value={ctaSecondaryHref}
                    onChange={(ev) => setCtaSecondaryHref(ev.target.value)}
                    className="px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                    placeholder="/products?event=black-friday"
                  />
                </div>
              </Field>

              {/* 정렬 + 공개 */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="우선순위"
                  hint="높을수록 먼저. 같으면 시작일 최신 순."
                >
                  <input
                    type="number"
                    value={sortPriority}
                    onChange={(ev) =>
                      setSortPriority(parseInt(ev.target.value || '0', 10))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                  />
                </Field>
                <Field label="공개 여부">
                  <label className="flex items-center gap-3 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(ev) => setIsActive(ev.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-ink">
                      {isActive ? '공개 중' : '숨김'}
                    </span>
                  </label>
                </Field>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rule sticky bottom-0 bg-bg rounded-b-2xl">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-ink hover:bg-rule transition"
              >
                취소
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-terracotta text-white text-sm font-semibold hover:bg-[#8A3822] transition disabled:opacity-50"
              >
                {saving ? '저장 중…' : editing ? '수정 저장' : '이벤트 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
    </div>
  )
}
