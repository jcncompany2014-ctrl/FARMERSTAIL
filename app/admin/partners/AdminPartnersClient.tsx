'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  Pencil,
  X,
  ImageIcon,
  Upload,
  MapPin,
  Award,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * /admin/partners — 산지/공급자 CRUD 클라이언트.
 */

export type AdminPartnerRow = {
  id: string
  region: string
  name: string
  ingredient: string
  body: string
  cert: string | null
  image_url: string | null
  is_published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export default function AdminPartnersClient({
  initialPartners,
}: {
  initialPartners: AdminPartnerRow[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminPartnerRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [region, setRegion] = useState('')
  const [name, setName] = useState('')
  const [ingredient, setIngredient] = useState('')
  const [body, setBody] = useState('')
  const [cert, setCert] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setRegion('')
    setName('')
    setIngredient('')
    setBody('')
    setCert('')
    setImageUrl('')
    setIsPublished(true)
    setSortOrder(0)
  }

  function openCreate() {
    setEditing(null)
    reset()
    setModalOpen(true)
  }

  function openEdit(p: AdminPartnerRow) {
    setEditing(p)
    setRegion(p.region)
    setName(p.name)
    setIngredient(p.ingredient)
    setBody(p.body)
    setCert(p.cert ?? '')
    setImageUrl(p.image_url ?? '')
    setIsPublished(p.is_published)
    setSortOrder(p.sort_order)
    setModalOpen(true)
  }

  async function handleFileSelect(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('slug', `partner-${name.trim() || 'untitled'}`.toLowerCase().replace(/\s+/g, '-'))
    setUploading(true)
    try {
      const res = await fetch('/api/admin/events/upload', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        alert('업로드 실패: ' + (json?.message ?? res.status))
        return
      }
      setImageUrl(json.url as string)
    } catch (err) {
      alert('업로드 오류: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!region.trim() || !name.trim() || !ingredient.trim() || !body.trim()) {
      alert('region / name / ingredient / body 는 필수입니다')
      return
    }

    const payload = {
      region: region.trim(),
      name: name.trim(),
      ingredient: ingredient.trim(),
      body: body.trim(),
      cert: cert.trim() || null,
      image_url: imageUrl.trim() || null,
      is_published: isPublished,
      sort_order: sortOrder,
    }

    setSaving(true)
    const { error } = editing
      ? await supabase.from('partners').update(payload).eq('id', editing.id)
      : await supabase.from('partners').insert(payload)
    setSaving(false)

    if (error) {
      alert((editing ? '수정' : '생성') + ' 실패: ' + error.message)
      return
    }
    setModalOpen(false)
    setEditing(null)
    router.refresh()
  }

  async function togglePublished(p: AdminPartnerRow) {
    const { error } = await supabase
      .from('partners')
      .update({ is_published: !p.is_published })
      .eq('id', p.id)
    if (error) {
      alert('공개 상태 변경 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  async function remove(p: AdminPartnerRow) {
    if (!confirm(`"${p.name}" 산지 정보를 삭제할까요?`)) return
    setDeleting(p.id)
    const { error } = await supabase.from('partners').delete().eq('id', p.id)
    setDeleting(null)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">PARTNERS</h1>
          <p className="text-sm text-muted mt-1">
            산지·공급자 정보 — /partners 페이지에 노출. 총 {initialPartners.length}개 등록.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-terracotta text-white text-sm font-semibold hover:bg-[#8A3822] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />새 산지
        </button>
      </div>

      {initialPartners.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-rule text-center">
          <p className="text-sm text-muted">등록된 산지가 없어요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initialPartners.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-white border border-rule p-4 flex gap-4"
            >
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt=""
                  className="w-20 h-24 rounded object-cover border border-rule shrink-0"
                />
              ) : (
                <div className="w-20 h-24 rounded border border-rule shrink-0 flex items-center justify-center bg-bg">
                  <ImageIcon className="w-5 h-5 text-muted" strokeWidth={1.5} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.is_published ? 'bg-moss text-white' : 'bg-rule text-text'
                    }`}
                  >
                    {p.is_published ? '공개' : '숨김'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                    <MapPin className="w-2.5 h-2.5" strokeWidth={2} />
                    {p.region}
                  </span>
                  <span className="text-[10px] text-muted font-mono">
                    order={p.sort_order}
                  </span>
                </div>
                <div className="font-semibold text-ink mt-1">{p.name}</div>
                <div className="text-[11px] text-terracotta mt-0.5">{p.ingredient}</div>
                {p.cert && (
                  <div className="inline-flex items-center gap-1 text-[10px] text-muted mt-1">
                    <Award className="w-2.5 h-2.5" strokeWidth={2} />
                    {p.cert}
                  </div>
                )}
                <p className="text-[11px] text-muted mt-1.5 line-clamp-2">{p.body}</p>
                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={() => togglePublished(p)}
                    className="px-2 py-1 rounded border border-rule text-[10px] hover:bg-bg transition"
                  >
                    {p.is_published ? '숨기기' : '공개'}
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded hover:bg-rule transition"
                  >
                    <Pencil className="w-3.5 h-3.5 text-ink" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => remove(p)}
                    disabled={deleting === p.id}
                    className="p-1.5 rounded hover:bg-sale/10 transition disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-sale" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 flex items-start justify-center p-6 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-bg rounded-2xl shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-rule sticky top-0 bg-bg rounded-t-2xl z-10">
              <h2 className="font-['Archivo_Black'] text-lg text-ink">
                {editing ? 'EDIT PARTNER' : 'NEW PARTNER'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded hover:bg-rule transition"
              >
                <X className="w-4 h-4 text-ink" strokeWidth={2} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="region (지역)">
                  <input
                    type="text"
                    value={region}
                    onChange={(ev) => setRegion(ev.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                    placeholder="강원 평창"
                  />
                </Field>
                <Field label="name (농가/조합명)">
                  <input
                    type="text"
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                    placeholder="평창 청옥 한우농가"
                  />
                </Field>
              </div>

              <Field label="ingredient (어떤 식재료)">
                <input
                  type="text"
                  value={ingredient}
                  onChange={(ev) => setIngredient(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                  placeholder="한우 안심 / 양지"
                />
              </Field>

              <Field label="body (소개 본문)">
                <textarea
                  value={body}
                  onChange={(ev) => setBody(ev.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm resize-none"
                  placeholder="해발 700m 이상 청정 목초지에서 방목·곡물 병행 사육..."
                />
              </Field>

              <Field label="cert (인증)" hint="예: 1++ / HACCP, 무농약 인증, 유기농 인증">
                <input
                  type="text"
                  value={cert}
                  onChange={(ev) => setCert(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                  placeholder="1++ / HACCP"
                />
              </Field>

              <Field label="이미지" hint="4:5 권장, 8MB 이하">
                <div className="flex gap-3 items-start">
                  <div className="w-24 h-30 rounded border border-rule bg-bg shrink-0 overflow-hidden flex items-center justify-center" style={{ aspectRatio: '4 / 5' }}>
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-xs font-semibold hover:bg-[#3A2F22] transition disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {uploading ? '업로드 중…' : imageUrl ? '교체' : '이미지 선택'}
                    </button>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(ev) => setImageUrl(ev.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-xs font-mono"
                      placeholder="또는 URL"
                    />
                  </div>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="sort_order" hint="낮을수록 먼저">
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(ev) => setSortOrder(parseInt(ev.target.value || '0', 10))}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                  />
                </Field>
                <Field label="공개 여부">
                  <label className="flex items-center gap-3 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(ev) => setIsPublished(ev.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-ink">{isPublished ? '공개' : '숨김'}</span>
                  </label>
                </Field>
              </div>
            </div>

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
                {saving ? '저장 중…' : editing ? '수정 저장' : '산지 생성'}
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
