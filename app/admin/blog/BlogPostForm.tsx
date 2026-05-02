'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Eye,
  Pencil,
  Upload,
  X,
  Loader2,
  Bold,
  Italic,
  Heading2,
  List,
  Quote,
  Link2,
  Image as ImageIcon,
  Code as CodeIcon,
  Minus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { renderMarkdown } from '@/lib/markdown'

type Category = {
  id: string
  name: string
  slug: string
}

type PostData = {
  id?: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  cover_url: string | null
  category_id: string | null
  is_published: boolean
  published_at: string | null
}

const EMPTY: PostData = {
  slug: '',
  title: '',
  excerpt: '',
  content: '',
  cover_url: null,
  category_id: null,
  is_published: false,
  published_at: null,
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'error'; message: string }

export default function BlogPostForm({
  mode,
  categories,
  initialData,
}: {
  mode: 'create' | 'edit'
  categories: Category[]
  initialData?: PostData
}) {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState<PostData>(initialData ?? EMPTY)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(false)
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' })
  const fileRef = useRef<HTMLInputElement | null>(null)
  // 본문 textarea ref — 툴바 버튼이 cursor 위치에 markdown 삽입할 때 사용.
  const contentRef = useRef<HTMLTextAreaElement | null>(null)
  // 본문에 인라인 이미지 업로드용 별도 input
  const inlineImgRef = useRef<HTMLInputElement | null>(null)
  const [inlineUpload, setInlineUpload] = useState<UploadState>({
    status: 'idle',
  })

  /**
   * 현재 textarea 의 selection 을 양 옆으로 wrap. selection 이 없으면 placeholder
   * 를 가운데 끼움. cursor 는 wrap 후 끝쪽으로 이동.
   */
  function wrapSelection(before: string, after: string, placeholder = '') {
    const ta = contentRef.current
    if (!ta) return
    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? 0
    const selected = form.content.slice(start, end) || placeholder
    const next =
      form.content.slice(0, start) +
      before +
      selected +
      after +
      form.content.slice(end)
    update('content', next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + before.length + selected.length
      ta.setSelectionRange(pos, pos)
    })
  }

  function insertAtLineStart(prefix: string) {
    const ta = contentRef.current
    if (!ta) return
    const start = ta.selectionStart ?? 0
    const before = form.content.slice(0, start)
    // 현재 줄의 시작 위치
    const lineStart = before.lastIndexOf('\n') + 1
    const next =
      form.content.slice(0, lineStart) + prefix + form.content.slice(lineStart)
    update('content', next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + prefix.length
      ta.setSelectionRange(pos, pos)
    })
  }

  function insertAtCursor(text: string) {
    const ta = contentRef.current
    if (!ta) return
    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? 0
    const next =
      form.content.slice(0, start) + text + form.content.slice(end)
    update('content', next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + text.length
      ta.setSelectionRange(pos, pos)
    })
  }

  async function handleInlineImage(file: File) {
    setInlineUpload({ status: 'uploading' })
    const fd = new FormData()
    fd.append('file', file)
    fd.append('slug', `inline-${form.slug || 'post'}`)
    const res = await fetch('/api/admin/blog/upload', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        message?: string
      } | null
      setInlineUpload({
        status: 'error',
        message: err?.message ?? '업로드 실패',
      })
      return
    }
    const data = (await res.json()) as { url: string }
    insertAtCursor(`\n\n![](${data.url})\n\n`)
    setInlineUpload({ status: 'idle' })
  }

  function update<K extends keyof PostData>(key: K, value: PostData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function autoSlug() {
    if (form.slug) return
    const s = form.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s가-힣-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60)
    if (s) update('slug', s)
  }

  async function handleCover(file: File) {
    setUpload({ status: 'uploading' })
    const fd = new FormData()
    fd.append('file', file)
    fd.append('slug', form.slug || 'post')
    const res = await fetch('/api/admin/blog/upload', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        message?: string
      } | null
      setUpload({
        status: 'error',
        message: err?.message ?? '업로드에 실패했어요',
      })
      return
    }
    const data = (await res.json()) as { url: string }
    update('cover_url', data.url)
    setUpload({ status: 'idle' })
  }

  async function handleSubmit(e: React.FormEvent, publishOverride?: boolean) {
    e.preventDefault()

    if (!form.title.trim() || !form.slug.trim()) {
      alert('제목과 slug는 필수예요')
      return
    }
    if (!form.content.trim()) {
      alert('본문을 작성해 주세요')
      return
    }

    setLoading(true)

    const shouldPublish = publishOverride ?? form.is_published
    // First publish — stamp published_at; unpublish does NOT clear it so we
    // can show "last published" history. Re-publishing after edit keeps the
    // original timestamp to avoid reshuffling feed ordering.
    let publishedAt = form.published_at
    if (shouldPublish && !publishedAt) {
      publishedAt = new Date().toISOString()
    }

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt?.trim() || null,
      content: form.content,
      cover_url: form.cover_url?.trim() || null,
      category_id: form.category_id || null,
      is_published: shouldPublish,
      published_at: publishedAt,
    }

    if (mode === 'create') {
      const { data, error } = await supabase
        .from('blog_posts')
        .insert(payload)
        .select('id')
        .single()

      setLoading(false)
      if (error) {
        alert('저장 실패: ' + error.message)
        return
      }
      router.push(`/admin/blog/${data.id}`)
      router.refresh()
    } else {
      const { error } = await supabase
        .from('blog_posts')
        .update(payload)
        .eq('id', form.id!)

      setLoading(false)
      if (error) {
        alert('저장 실패: ' + error.message)
        return
      }
      setForm((prev) => ({
        ...prev,
        is_published: shouldPublish,
        published_at: publishedAt,
      }))
      router.refresh()
    }
  }

  async function handleDelete() {
    if (mode !== 'edit' || !form.id) return
    if (!confirm('정말 삭제할까요? 되돌릴 수 없어요.')) return

    setLoading(true)
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', form.id)
    setLoading(false)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    router.push('/admin/blog')
    router.refresh()
  }

  return (
    <form
      onSubmit={(e) => handleSubmit(e)}
      className="grid grid-cols-3 gap-6"
    >
      {/* 왼쪽: 본문 */}
      <div className="col-span-2 space-y-4">
        <Section title="기본 정보">
          <Field label="제목 *">
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              onBlur={autoSlug}
              className={inputClass}
              placeholder="예: 반려견 체중 관리, 어떻게 시작하지?"
            />
          </Field>
          <Field label="Slug * (URL에 쓰임)">
            <input
              type="text"
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              className={`${inputClass} font-mono text-xs`}
              placeholder="weight-management-diet"
            />
            <p className="mt-1 text-[10px] text-muted">
              /blog/<span className="font-mono">{form.slug || '...'}</span>
            </p>
          </Field>
          <Field label="요약 (리스트·OG 카드에 쓰여요)">
            <textarea
              value={form.excerpt ?? ''}
              onChange={(e) => update('excerpt', e.target.value)}
              rows={2}
              className={`${inputClass} text-xs leading-relaxed`}
              placeholder="글의 핵심을 2-3문장으로"
            />
          </Field>
        </Section>

        <Section title="본문 (마크다운 지원)">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            {/* 마크다운 툴바 */}
            <div className="flex items-center gap-0.5 flex-wrap">
              <ToolBtn
                onClick={() => wrapSelection('**', '**', '강조')}
                title="굵게"
              >
                <Bold className="w-3 h-3" strokeWidth={2.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => wrapSelection('*', '*', '기울임')}
                title="기울임"
              >
                <Italic className="w-3 h-3" strokeWidth={2.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => insertAtLineStart('## ')}
                title="제목"
              >
                <Heading2 className="w-3 h-3" strokeWidth={2.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => insertAtLineStart('- ')}
                title="목록"
              >
                <List className="w-3 h-3" strokeWidth={2.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => insertAtLineStart('> ')}
                title="인용"
              >
                <Quote className="w-3 h-3" strokeWidth={2.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => wrapSelection('`', '`', '코드')}
                title="인라인 코드"
              >
                <CodeIcon className="w-3 h-3" strokeWidth={2.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => insertAtCursor('\n\n---\n\n')}
                title="구분선"
              >
                <Minus className="w-3 h-3" strokeWidth={2.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => {
                  const url = window.prompt('링크 URL', 'https://')
                  if (!url) return
                  wrapSelection('[', `](${url})`, '링크 텍스트')
                }}
                title="링크"
              >
                <Link2 className="w-3 h-3" strokeWidth={2.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => inlineImgRef.current?.click()}
                title="이미지 삽입"
                disabled={inlineUpload.status === 'uploading'}
              >
                {inlineUpload.status === 'uploading' ? (
                  <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} />
                ) : (
                  <ImageIcon className="w-3 h-3" strokeWidth={2.5} />
                )}
              </ToolBtn>
              <input
                ref={inlineImgRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleInlineImage(f)
                  e.target.value = ''
                }}
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreview(false)}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded ${
                  !preview
                    ? 'bg-text text-white'
                    : 'text-muted hover:bg-bg'
                } transition font-bold`}
              >
                <Pencil className="w-3 h-3" strokeWidth={2.25} />
                편집
              </button>
              <button
                type="button"
                onClick={() => setPreview(true)}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded ${
                  preview
                    ? 'bg-text text-white'
                    : 'text-muted hover:bg-bg'
                } transition font-bold`}
              >
                <Eye className="w-3 h-3" strokeWidth={2.25} />
                미리보기
              </button>
            </div>
          </div>
          {preview ? (
            <div className="min-h-[400px] bg-bg rounded-lg p-4">
              {form.content.trim() ? (
                <article
                  className="ft-md text-[14px] text-text leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }}
                />
              ) : (
                <p className="text-[11px] text-muted italic">
                  본문이 비어 있어요
                </p>
              )}
            </div>
          ) : (
            <textarea
              ref={contentRef}
              value={form.content}
              onChange={(e) => update('content', e.target.value)}
              rows={20}
              className={`${inputClass} text-[13px] leading-relaxed font-mono`}
              placeholder={`본문을 마크다운으로 작성하세요.\n\n# 큰 제목\n## 부제\n**굵게** *기울임* \`코드\`\n\n- 목록 1\n- 목록 2\n\n[링크](https://example.com)\n![이미지 alt](https://...)\n`}
            />
          )}
          {inlineUpload.status === 'error' && (
            <p className="mt-1 text-[11px] text-sale font-bold">
              {inlineUpload.message}
            </p>
          )}
          <p className="mt-1 text-[10px] text-muted">
            {form.content.length.toLocaleString()}자 · 마크다운: **굵게** *기울임* # 제목 - 목록 [링크](url) ![alt](img)
          </p>
        </Section>
      </div>

      {/* 오른쪽: 메타 + 발행 */}
      <div className="col-span-1 space-y-4">
        <Section title="발행">
          <div className="space-y-2">
            <div
              className={`text-[11px] font-bold px-3 py-2 rounded-lg ${
                form.is_published
                  ? 'bg-moss/10 text-moss'
                  : 'bg-rule text-muted'
              }`}
            >
              현재 상태 ·{' '}
              {form.is_published ? '게시됨' : '임시저장 (비공개)'}
            </div>

            {form.is_published && form.published_at && (
              <p className="text-[10px] text-muted">
                최초 발행 ·{' '}
                {new Date(form.published_at).toLocaleString('ko-KR')}
              </p>
            )}

            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-terracotta text-white text-sm font-semibold hover:bg-[#8A3822] transition disabled:opacity-50"
            >
              {form.is_published ? '저장 & 계속 게시' : '저장 & 바로 게시'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-white text-text border border-rule text-xs font-semibold hover:border-terracotta hover:text-terracotta transition disabled:opacity-50"
            >
              임시저장
            </button>
            {mode === 'edit' && form.is_published && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, false)}
                disabled={loading}
                className="w-full py-2 text-[11px] text-muted hover:text-sale transition"
              >
                게시 내리기 (비공개로 전환)
              </button>
            )}
          </div>
        </Section>

        <Section title="커버 이미지">
          {form.cover_url ? (
            <div className="relative group aspect-[16/9] rounded-lg bg-bg overflow-hidden border border-rule">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.cover_url}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => update('cover_url', null)}
                className="absolute top-2 right-2 w-7 h-7 bg-sale text-white rounded-full flex items-center justify-center hover:bg-[#8A2A1E] transition"
                aria-label="커버 제거"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.status === 'uploading'}
              className="w-full aspect-[16/9] rounded-lg bg-bg border border-dashed border-rule-2 flex flex-col items-center justify-center text-muted hover:border-terracotta hover:text-terracotta transition disabled:opacity-50"
            >
              {upload.status === 'uploading' ? (
                <Loader2 className="w-6 h-6 animate-spin" strokeWidth={1.5} />
              ) : (
                <>
                  <Upload className="w-6 h-6 mb-1" strokeWidth={1.5} />
                  <span className="text-[11px] font-bold">커버 업로드</span>
                </>
              )}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleCover(f)
              e.target.value = ''
            }}
          />
          {upload.status === 'error' && (
            <p className="mt-1 text-[11px] text-sale font-bold">
              {upload.message}
            </p>
          )}
        </Section>

        <Section title="분류">
          <Field label="카테고리">
            <select
              value={form.category_id ?? ''}
              onChange={(e) => update('category_id', e.target.value || null)}
              className={inputClass}
            >
              <option value="">선택 안 함</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Link
            href="/admin/blog/categories"
            className="text-[10px] text-terracotta hover:underline"
          >
            카테고리 관리 →
          </Link>
        </Section>

        {mode === 'edit' && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-white text-sale border border-sale/40 text-xs font-semibold hover:border-sale transition disabled:opacity-50"
          >
            삭제
          </button>
        )}
      </div>
    </form>
  )
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-bg text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="p-5 rounded-2xl bg-white border border-rule">
      <h2 className="text-sm font-bold text-ink mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-text mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

function ToolBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="inline-flex items-center justify-center w-7 h-7 rounded text-text hover:bg-bg hover:text-terracotta transition disabled:opacity-40"
    >
      {children}
    </button>
  )
}
