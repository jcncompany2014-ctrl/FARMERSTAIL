'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Trash2,
  Pencil,
  X,
  ExternalLink,
  ImageIcon,
  Upload,
  ArrowUp,
  ArrowDown,
  Package,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * /admin/collections — CRUD 클라이언트.
 *
 * 두 가지 모드의 UI 가 한 화면에 있다:
 *   1. 컬렉션 자체의 메타 (slug / title / palette / 이미지) 편집 — 큰 모달.
 *   2. 컬렉션 안 제품 묶음 관리 — 인라인 패널 (행을 펼치면 보여짐).
 *
 * 분리한 이유: 메타 편집은 이미지 업로드까지 들어가서 무거운 폼이고,
 * 제품 묶음 작업은 add/remove/reorder 만 해서 즉시 인라인이 빠르다.
 */

export type AdminCollectionRow = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  curator_note: string | null
  hero_image_url: string | null
  card_image_url: string | null
  palette: 'ink' | 'terracotta' | 'moss' | 'gold' | string | null
  is_published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type CollectionItemRow = {
  collection_id: string
  product_id: string
  position: number
}

export type ProductOption = {
  id: string
  slug: string
  name: string
  image_url: string | null
  is_active: boolean
}

const PALETTE_OPTIONS: Array<{
  value: NonNullable<AdminCollectionRow['palette']>
  label: string
  swatch: string
}> = [
  { value: 'ink', label: 'Ink (검정)', swatch: '#1E1A14' },
  { value: 'terracotta', label: 'Terracotta (적갈)', swatch: '#A0452E' },
  { value: 'moss', label: 'Moss (녹색)', swatch: '#556828' },
  { value: 'gold', label: 'Gold (황)', swatch: '#D4A94A' },
]

export default function AdminCollectionsClient({
  initialCollections,
  initialItems,
  products,
}: {
  initialCollections: AdminCollectionRow[]
  initialItems: CollectionItemRow[]
  products: ProductOption[]
}) {
  const router = useRouter()
  const supabase = createClient()

  // 컬렉션 메타 모달
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminCollectionRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // 제품 묶음 패널 — 펼친 컬렉션 id (한 번에 하나만)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // form state
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [curatorNote, setCuratorNote] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [cardImageUrl, setCardImageUrl] = useState('')
  const [palette, setPalette] =
    useState<NonNullable<AdminCollectionRow['palette']>>('ink')
  const [isPublished, setIsPublished] = useState(false)
  const [sortOrder, setSortOrder] = useState(0)

  // 이미지 업로드는 admin/products 의 generic upload endpoint 가 있으면 그걸 쓰지만,
  // 여기서는 URL 직접 입력으로 한정 (운영은 cdn / blob 콘솔에서 url 복사).
  // → 이벤트 업로드 endpoint 를 재사용 가능하지만 버킷이 events 전용이라 새 버킷이
  //   필요. 1차는 URL 입력.
  const fileHeroRef = useRef<HTMLInputElement>(null)
  const fileCardRef = useRef<HTMLInputElement>(null)
  const [uploadingKey, setUploadingKey] = useState<'hero' | 'card' | null>(null)

  // 제품 묶음 in-memory state — DB 쓰기 후 refresh 가 들어올 때까지 임시 갱신.
  const [items, setItems] = useState<CollectionItemRow[]>(initialItems)
  const itemsByCollection = useMemo(() => {
    const map = new Map<string, CollectionItemRow[]>()
    for (const it of items) {
      const arr = map.get(it.collection_id) ?? []
      arr.push(it)
      map.set(it.collection_id, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.position - b.position)
    }
    return map
  }, [items])

  const productById = useMemo(() => {
    const m = new Map<string, ProductOption>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  function resetForm() {
    setSlug('')
    setTitle('')
    setSubtitle('')
    setCuratorNote('')
    setHeroImageUrl('')
    setCardImageUrl('')
    setPalette('ink')
    setIsPublished(false)
    setSortOrder(0)
  }

  function openCreate() {
    setEditing(null)
    resetForm()
    setModalOpen(true)
  }

  function openEdit(c: AdminCollectionRow) {
    setEditing(c)
    setSlug(c.slug)
    setTitle(c.title)
    setSubtitle(c.subtitle ?? '')
    setCuratorNote(c.curator_note ?? '')
    setHeroImageUrl(c.hero_image_url ?? '')
    setCardImageUrl(c.card_image_url ?? '')
    setPalette((c.palette ?? 'ink') as NonNullable<AdminCollectionRow['palette']>)
    setIsPublished(c.is_published)
    setSortOrder(c.sort_order)
    setModalOpen(true)
  }

  /**
   * 이벤트 업로드 endpoint 를 그대로 재사용. 버킷은 'event-images' 지만 admin
   * 이미지 호스팅 용도로 함께 써도 무방 — 카드/히어로 이미지가 결국 같은 publication.
   * 별도 버킷이 필요해지면 /api/admin/collections/upload 를 새로 추가하면 된다.
   */
  async function handleFileSelect(
    ev: React.ChangeEvent<HTMLInputElement>,
    target: 'hero' | 'card',
  ) {
    const file = ev.target.files?.[0]
    if (!file) return
    const slugForPath = `collection-${slug.trim() || 'untitled'}-${target}`
    const fd = new FormData()
    fd.append('file', file)
    fd.append('slug', slugForPath)
    setUploadingKey(target)
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
      if (target === 'hero') setHeroImageUrl(json.url as string)
      else setCardImageUrl(json.url as string)
    } catch (err) {
      alert(
        '이미지 업로드 오류: ' +
          (err instanceof Error ? err.message : String(err)),
      )
    } finally {
      setUploadingKey(null)
      const ref = target === 'hero' ? fileHeroRef : fileCardRef
      if (ref.current) ref.current.value = ''
    }
  }

  async function save() {
    if (!slug.trim() || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug.trim())) {
      alert('slug 는 소문자/숫자/하이픈만 허용 (예: first-meal)')
      return
    }
    if (!title.trim()) {
      alert('title 은 필수입니다')
      return
    }

    const payload = {
      slug: slug.trim(),
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      curator_note: curatorNote.trim() || null,
      hero_image_url: heroImageUrl.trim() || null,
      card_image_url: cardImageUrl.trim() || null,
      palette,
      is_published: isPublished,
      sort_order: sortOrder,
    }

    setSaving(true)
    const { error } = editing
      ? await supabase.from('collections').update(payload).eq('id', editing.id)
      : await supabase.from('collections').insert(payload)
    setSaving(false)

    if (error) {
      alert(
        (editing ? '수정' : '생성') +
          ' 실패: ' +
          error.message +
          (error.message.includes('duplicate') ? ' (slug 중복?)' : ''),
      )
      return
    }

    setModalOpen(false)
    setEditing(null)
    router.refresh()
  }

  async function togglePublished(c: AdminCollectionRow) {
    const { error } = await supabase
      .from('collections')
      .update({ is_published: !c.is_published })
      .eq('id', c.id)
    if (error) {
      alert('공개 상태 변경 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  async function remove(c: AdminCollectionRow) {
    if (
      !confirm(
        `"${c.title}" 컬렉션을 삭제할까요?\n묶인 제품은 자동으로 cascade 삭제됩니다.`,
      )
    )
      return
    setDeleting(c.id)
    const { error } = await supabase.from('collections').delete().eq('id', c.id)
    setDeleting(null)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  // ── collection_items 조작 ────────────────────────────
  async function addItem(collectionId: string, productId: string) {
    if (!productId) return
    const existing = itemsByCollection.get(collectionId) ?? []
    if (existing.some((it) => it.product_id === productId)) {
      alert('이미 이 컬렉션에 포함된 제품입니다')
      return
    }
    // 다음 position = 마지막 position + 10 (10 단위로 띄워 reorder 여유).
    const lastPos = existing.reduce((m, x) => Math.max(m, x.position), 0)
    const nextPos = lastPos + 10
    const { error } = await supabase
      .from('collection_items')
      .insert({ collection_id: collectionId, product_id: productId, position: nextPos })
    if (error) {
      alert('추가 실패: ' + error.message)
      return
    }
    setItems((s) => [...s, { collection_id: collectionId, product_id: productId, position: nextPos }])
  }

  async function removeItem(collectionId: string, productId: string) {
    if (!confirm('이 컬렉션에서 제품을 빼시겠어요?')) return
    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('product_id', productId)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    setItems((s) =>
      s.filter(
        (it) => !(it.collection_id === collectionId && it.product_id === productId),
      ),
    )
  }

  async function moveItem(
    collectionId: string,
    productId: string,
    direction: 'up' | 'down',
  ) {
    const list = (itemsByCollection.get(collectionId) ?? []).slice()
    const idx = list.findIndex((it) => it.product_id === productId)
    if (idx < 0) return
    const swapWith = direction === 'up' ? idx - 1 : idx + 1
    if (swapWith < 0 || swapWith >= list.length) return

    const a = list[idx]
    const b = list[swapWith]

    // position 두 행을 swap. 동시 update 가 안 되니 sequential 로 처리.
    const { error: e1 } = await supabase
      .from('collection_items')
      .update({ position: b.position })
      .eq('collection_id', collectionId)
      .eq('product_id', a.product_id)
    if (e1) {
      alert('정렬 실패: ' + e1.message)
      return
    }
    const { error: e2 } = await supabase
      .from('collection_items')
      .update({ position: a.position })
      .eq('collection_id', collectionId)
      .eq('product_id', b.product_id)
    if (e2) {
      alert('정렬 실패: ' + e2.message)
      return
    }

    setItems((s) =>
      s.map((it) => {
        if (it.collection_id !== collectionId) return it
        if (it.product_id === a.product_id) return { ...it, position: b.position }
        if (it.product_id === b.product_id) return { ...it, position: a.position }
        return it
      }),
    )
  }

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">COLLECTIONS</h1>
          <p className="text-sm text-muted mt-1">
            큐레이션 묶음 — /collections 인덱스 + /collections/[slug] 노출. 총{' '}
            {initialCollections.length}개 등록.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-terracotta text-white text-sm font-semibold hover:bg-[#8A3822] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />새 컬렉션
        </button>
      </div>

      {/* ── 리스트 ── */}
      {initialCollections.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-rule text-center">
          <p className="text-sm text-muted">
            아직 등록된 컬렉션이 없어요. 우측 상단 &ldquo;새 컬렉션&rdquo; 으로 시작하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {initialCollections.map((c) => {
            const expanded = expandedId === c.id
            const cItems = itemsByCollection.get(c.id) ?? []
            const swatch =
              PALETTE_OPTIONS.find((p) => p.value === c.palette)?.swatch ?? '#000'
            return (
              <div
                key={c.id}
                className="rounded-2xl bg-white border border-rule overflow-hidden"
              >
                {/* 메인 행 */}
                <div className="flex gap-4 items-center p-4">
                  {c.card_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.card_image_url}
                      alt=""
                      className="w-16 h-20 rounded object-cover border border-rule shrink-0"
                    />
                  ) : (
                    <div
                      className="w-16 h-20 rounded border border-rule shrink-0 flex items-center justify-center"
                      style={{ background: swatch }}
                    >
                      <ImageIcon
                        className="w-4 h-4 text-white/60"
                        strokeWidth={1.5}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.is_published
                            ? 'bg-moss text-white'
                            : 'bg-rule text-text'
                        }`}
                      >
                        {c.is_published ? '공개' : '숨김'}
                      </span>
                      <span
                        className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full"
                        style={{ background: swatch + '22', color: swatch }}
                      >
                        {c.palette ?? 'ink'}
                      </span>
                      <span className="text-[10px] text-muted font-mono">
                        order={c.sort_order}
                      </span>
                    </div>
                    <div className="font-semibold text-ink mt-1">{c.title}</div>
                    <div className="text-[11px] text-muted mt-0.5 line-clamp-1">
                      {c.subtitle ?? '—'}
                    </div>
                    <Link
                      href={`/collections/${c.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-terracotta hover:underline mt-1"
                    >
                      /collections/{c.slug}
                      <ExternalLink className="w-2.5 h-2.5" strokeWidth={2} />
                    </Link>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                      className="px-3 py-1.5 rounded-lg border border-rule text-[11px] hover:bg-bg transition inline-flex items-center gap-1.5"
                      title="이 컬렉션의 제품 묶음 편집"
                    >
                      <Package className="w-3 h-3" strokeWidth={2} />
                      제품 {cItems.length}
                      {expanded ? ' ▲' : ' ▼'}
                    </button>
                    <button
                      onClick={() => togglePublished(c)}
                      className="px-3 py-1.5 rounded-lg border border-rule text-[11px] hover:bg-bg transition"
                    >
                      {c.is_published ? '숨기기' : '공개'}
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded hover:bg-rule transition"
                      title="편집"
                    >
                      <Pencil className="w-3.5 h-3.5 text-ink" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => remove(c)}
                      disabled={deleting === c.id}
                      className="p-1.5 rounded hover:bg-sale/10 transition disabled:opacity-40"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-sale" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* 묶음 패널 */}
                {expanded && (
                  <ItemsPanel
                    collection={c}
                    items={cItems}
                    products={products}
                    productById={productById}
                    onAdd={(productId) => addItem(c.id, productId)}
                    onRemove={(productId) => removeItem(c.id, productId)}
                    onMove={(productId, dir) => moveItem(c.id, productId, dir)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 안내 ── */}
      <div className="mt-6 p-4 rounded-xl bg-bg border border-rule text-[11px] text-muted leading-relaxed">
        <p>
          <strong className="text-ink">제품 묶음 순서</strong>는 위/아래 버튼으로
          조정합니다. position 값은 10 단위 step 이라 중간 삽입 시 자동으로
          간격이 유지돼요.
        </p>
        <p className="mt-1">
          <strong className="text-ink">이미지</strong>는 4:5 비율 권장 (카드/히어로 모두). 8MB 이하.
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-rule sticky top-0 bg-bg rounded-t-2xl z-10">
              <h2 className="font-['Archivo_Black'] text-lg text-ink">
                {editing ? 'EDIT COLLECTION' : 'NEW COLLECTION'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded hover:bg-rule transition"
              >
                <X className="w-4 h-4 text-ink" strokeWidth={2} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <Field label="slug (URL 조각)" hint="소문자/숫자/하이픈. 예: first-meal">
                <input
                  type="text"
                  value={slug}
                  onChange={(ev) => setSlug(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                  placeholder="first-meal"
                />
              </Field>

              <Field label="title (큰 제목)">
                <input
                  type="text"
                  value={title}
                  onChange={(ev) => setTitle(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-serif font-bold"
                  placeholder="첫 화식 입문"
                />
              </Field>

              <Field label="subtitle (한 줄 요약)">
                <input
                  type="text"
                  value={subtitle}
                  onChange={(ev) => setSubtitle(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                  placeholder="사료에서 화식으로 처음 넘어가는 한 주"
                />
              </Field>

              <Field label="curator note (큐레이터 코멘트)">
                <textarea
                  value={curatorNote}
                  onChange={(ev) => setCuratorNote(ev.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm resize-none"
                  placeholder="갑자기 식단을 바꾸면 장이 놀랄 수 있어요..."
                />
              </Field>

              {/* 카드 이미지 */}
              <Field label="card 이미지 (인덱스 카드 배경)" hint="4:5, 8MB 이하">
                <div className="flex gap-3 items-start">
                  <div className="w-24 h-30 rounded border border-rule bg-bg shrink-0 overflow-hidden flex items-center justify-center" style={{ aspectRatio: '4 / 5' }}>
                    {cardImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cardImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      ref={fileCardRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      onChange={(e) => handleFileSelect(e, 'card')}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileCardRef.current?.click()}
                      disabled={uploadingKey === 'card'}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-xs font-semibold hover:bg-[#3A2F22] transition disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {uploadingKey === 'card' ? '업로드 중…' : cardImageUrl ? '교체' : '이미지 선택'}
                    </button>
                    <input
                      type="text"
                      value={cardImageUrl}
                      onChange={(ev) => setCardImageUrl(ev.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-xs font-mono"
                      placeholder="또는 URL 직접 입력"
                    />
                  </div>
                </div>
              </Field>

              {/* 히어로 이미지 */}
              <Field label="hero 이미지 (상세 페이지 큰 배너)" hint="16:9 또는 21:9 권장. 8MB 이하">
                <div className="flex gap-3 items-start">
                  <div className="w-32 h-18 rounded border border-rule bg-bg shrink-0 overflow-hidden flex items-center justify-center" style={{ aspectRatio: '16 / 9' }}>
                    {heroImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={heroImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      ref={fileHeroRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      onChange={(e) => handleFileSelect(e, 'hero')}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileHeroRef.current?.click()}
                      disabled={uploadingKey === 'hero'}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-ink text-white text-xs font-semibold hover:bg-[#3A2F22] transition disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {uploadingKey === 'hero' ? '업로드 중…' : heroImageUrl ? '교체' : '이미지 선택'}
                    </button>
                    <input
                      type="text"
                      value={heroImageUrl}
                      onChange={(ev) => setHeroImageUrl(ev.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-xs font-mono"
                      placeholder="또는 URL 직접 입력"
                    />
                  </div>
                </div>
              </Field>

              <div className="grid grid-cols-3 gap-4">
                <Field label="palette">
                  <select
                    value={palette}
                    onChange={(ev) =>
                      setPalette(
                        ev.target.value as NonNullable<AdminCollectionRow['palette']>,
                      )
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
                        PALETTE_OPTIONS.find((p) => p.value === palette)?.swatch ?? '#000',
                    }}
                  />
                </Field>
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
                    <span className="text-sm text-ink">
                      {isPublished ? '공개' : '숨김'}
                    </span>
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
                {saving ? '저장 중…' : editing ? '수정 저장' : '컬렉션 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemsPanel({
  collection,
  items,
  products,
  productById,
  onAdd,
  onRemove,
  onMove,
}: {
  collection: AdminCollectionRow
  items: CollectionItemRow[]
  products: ProductOption[]
  productById: Map<string, ProductOption>
  onAdd: (productId: string) => void
  onRemove: (productId: string) => void
  onMove: (productId: string, dir: 'up' | 'down') => void
}) {
  const [pickerValue, setPickerValue] = useState('')
  const usedIds = new Set(items.map((it) => it.product_id))
  const available = products.filter((p) => !usedIds.has(p.id))

  return (
    <div className="border-t border-rule p-4 bg-bg/40">
      <div className="flex items-end gap-2 mb-3">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
            제품 추가
          </label>
          <select
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
          >
            <option value="">제품 선택…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.is_active ? '' : '[숨김] '}
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            if (!pickerValue) return
            onAdd(pickerValue)
            setPickerValue('')
          }}
          disabled={!pickerValue}
          className="px-4 py-2 rounded-lg bg-ink text-white text-xs font-semibold hover:bg-[#3A2F22] transition disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-[12px] text-muted py-4 text-center">
          이 컬렉션에 묶인 제품이 없어요. 위에서 추가해주세요.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((it, idx) => {
            const p = productById.get(it.product_id)
            return (
              <li
                key={it.product_id}
                className="flex items-center gap-3 p-2 rounded-lg bg-white border border-rule"
              >
                <span className="text-[10px] font-mono text-muted w-8 shrink-0 text-center">
                  #{idx + 1}
                </span>
                {p?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    className="w-10 h-10 rounded object-cover border border-rule shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-bg border border-rule shrink-0 flex items-center justify-center">
                    <ImageIcon className="w-3 h-3 text-muted" strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-ink truncate">
                    {p?.name ?? `(삭제된 제품 — ${it.product_id})`}
                  </div>
                  <div className="text-[10px] font-mono text-muted">
                    pos={it.position}
                    {p && (
                      <>
                        {' · '}
                        <Link
                          href={`/products/${p.slug}`}
                          target="_blank"
                          className="text-terracotta hover:underline"
                        >
                          /products/{p.slug}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onMove(it.product_id, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 rounded hover:bg-bg transition disabled:opacity-30"
                  title="위로"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-ink" strokeWidth={2} />
                </button>
                <button
                  onClick={() => onMove(it.product_id, 'down')}
                  disabled={idx === items.length - 1}
                  className="p-1.5 rounded hover:bg-bg transition disabled:opacity-30"
                  title="아래로"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-ink" strokeWidth={2} />
                </button>
                <button
                  onClick={() => onRemove(it.product_id)}
                  className="p-1.5 rounded hover:bg-sale/10 transition"
                  title="제거"
                >
                  <Trash2 className="w-3.5 h-3.5 text-sale" strokeWidth={2} />
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <p className="text-[10px] text-muted mt-3 font-mono">
        collection_id: {collection.id}
      </p>
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
