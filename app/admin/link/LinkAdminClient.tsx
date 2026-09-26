'use client'

/**
 * /admin/link 편집 화면 — 커버 · 하루 사진 · 스토어 카드 · 배너(기간).
 * 저장은 /api/admin/link/{settings,banners,upload}. 상태 라벨은 /link 와 같은
 * 판정 함수(bannerWindow)를 써서 어드민이 보는 상태 = 고객이 보는 상태.
 */
import { useState } from 'react'
import { AdminCard, AdminButton, Badge, SectionTitle } from '@/components/admin/ui'
import { bannerWindow, ENDED_GRACE_DAYS, type BannerWindow } from '@/lib/link-content/status'

export type LinkSettings = {
  cover_url: string
  moment_urls: string[]
  show_store_card: boolean
}

export type BannerRow = {
  id: string
  sort_order: number
  enabled: boolean
  variant: 'photo' | 'poster'
  badge: string
  notice: string
  title: string
  sub: string
  href: string
  image_url: string
  starts_on: string | null
  ends_on: string | null
  window: BannerWindow
}

type BannerForm = {
  id?: string
  variant: 'photo' | 'poster'
  badge: string
  notice: string
  title: string
  sub: string
  href: string
  image_url: string
  starts_on: string
  ends_on: string
  enabled: boolean
}

const EMPTY_FORM: BannerForm = {
  variant: 'poster',
  badge: '',
  notice: '',
  title: '',
  sub: '',
  href: '',
  image_url: '',
  starts_on: '',
  ends_on: '',
  enabled: true,
}

function statusBadge(b: BannerRow) {
  if (!b.enabled) return <Badge tone="neutral">표시 안 함</Badge>
  switch (b.window) {
    case 'active':
      return <Badge tone="green">진행 중</Badge>
    case 'upcoming':
      return <Badge tone="blue">예정 · {b.starts_on}부터</Badge>
    case 'ended_recent':
      return <Badge tone="amber">종료 · 회색으로 표시 중</Badge>
    case 'expired':
      return <Badge tone="neutral">종료 {ENDED_GRACE_DAYS}일 지남 · 숨김</Badge>
  }
}

async function uploadImage(file: File, kind: 'cover' | 'moment' | 'banner'): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('kind', kind)
  const r = await fetch('/api/admin/link/upload', { method: 'POST', body: fd })
  const j = await r.json()
  if (!r.ok || !j.ok) throw new Error(j.message ?? '업로드에 실패했어요')
  return j.url as string
}

const inputCls =
  'w-full rounded border border-[color:var(--adminui-line)] bg-[color:var(--adminui-bg)] px-3 py-2 text-[14px]'
const labelCls = 'block text-[12px] font-bold text-[color:var(--adminui-mute)] mb-1'

export default function LinkAdminClient({
  today,
  settings: initialSettings,
  banners: initialBanners,
}: {
  today: string
  settings: LinkSettings
  banners: BannerRow[]
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [banners, setBanners] = useState(initialBanners)
  const [form, setForm] = useState<BannerForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg(`${label} — 저장했어요. /link 에 바로 반영돼요.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '실패했어요')
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(patch: Partial<LinkSettings>) {
    const r = await fetch('/api/admin/link/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.message ?? '저장에 실패했어요')
    setSettings((s) => ({ ...s, ...patch }))
  }

  async function refreshBanners() {
    const r = await fetch('/api/admin/link/banners')
    const j = await r.json()
    if (j.ok) setBanners(j.banners)
  }

  // ── 커버 ────────────────────────────────────────────────────────────
  function onCoverFile(file: File | null) {
    if (!file) return
    void run('커버 사진', async () => {
      const url = await uploadImage(file, 'cover')
      await saveSettings({ cover_url: url })
    })
  }

  // ── 하루 사진 ────────────────────────────────────────────────────────
  function onMomentFile(file: File | null) {
    if (!file) return
    void run('하루 사진 추가', async () => {
      const url = await uploadImage(file, 'moment')
      await saveSettings({ moment_urls: [...settings.moment_urls, url] })
    })
  }
  function removeMoment(i: number) {
    if (!window.confirm('이 사진을 목록에서 뺄까요?')) return
    void run('하루 사진', () => saveSettings({ moment_urls: settings.moment_urls.filter((_, k) => k !== i) }))
  }
  function moveMoment(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= settings.moment_urls.length) return
    const arr = [...settings.moment_urls]
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
    void run('하루 사진 순서', () => saveSettings({ moment_urls: arr }))
  }

  // ── 배너 ────────────────────────────────────────────────────────────
  function startNew() {
    setForm({ ...EMPTY_FORM })
  }
  function startEdit(b: BannerRow) {
    setForm({
      id: b.id,
      variant: b.variant,
      badge: b.badge,
      notice: b.notice,
      title: b.title,
      sub: b.sub,
      href: b.href,
      image_url: b.image_url,
      starts_on: b.starts_on ?? '',
      ends_on: b.ends_on ?? '',
      enabled: b.enabled,
    })
  }
  function onBannerFile(file: File | null) {
    if (!file || !form) return
    void run('배너 이미지', async () => {
      const url = await uploadImage(file, 'banner')
      setForm((f) => (f ? { ...f, image_url: url } : f))
    })
  }
  function submitBanner() {
    if (!form) return
    if (!form.title.trim()) return setMsg('제목을 적어 주세요')
    if (!form.image_url) return setMsg('이미지를 올려 주세요')
    if (!form.href.trim()) return setMsg('링크를 적어 주세요')
    const payload = {
      variant: form.variant,
      badge: form.badge,
      notice: form.notice,
      title: form.title,
      sub: form.sub,
      href: form.href.trim(),
      image_url: form.image_url,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      enabled: form.enabled,
    }
    void run(form.id ? '배너 수정' : '배너 추가', async () => {
      const r = await fetch('/api/admin/link/banners', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form.id ? { id: form.id, patch: payload } : payload),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message ?? '저장에 실패했어요')
      setForm(null)
      await refreshBanners()
    })
  }
  function deleteBanner(b: BannerRow) {
    if (!window.confirm(`"${b.title}" 배너를 삭제할까요? 되돌릴 수 없어요.`)) return
    void run('배너 삭제', async () => {
      const r = await fetch('/api/admin/link/banners', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: b.id }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message ?? '삭제에 실패했어요')
      await refreshBanners()
    })
  }
  function moveBanner(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= banners.length) return
    const arr = [...banners]
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
    void run('배너 순서', async () => {
      const r = await fetch('/api/admin/link/banners', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order: arr.map((b) => b.id) }),
      })
      const jj = await r.json()
      if (!r.ok) throw new Error(jj.message ?? '순서 저장에 실패했어요')
      await refreshBanners()
    })
  }

  const previewWindow = form ? bannerWindow(today, form.starts_on || null, form.ends_on || null) : null

  return (
    <div className="grid gap-4">
      {msg && (
        <p className="rounded border border-[color:var(--adminui-line)] bg-[color:var(--adminui-bg)] px-3 py-2 text-[13px]">
          {msg}
        </p>
      )}

      {/* ── 커버 ─────────────────────────────────────────────────── */}
      <AdminCard>
        <SectionTitle title="맨 위 커버 사진" />
        <p className="text-[13px] text-[color:var(--adminui-mute)]">
          링크 페이지 맨 위에 꽉 차게 들어가는 사진이에요. 가로가 긴 실물 사진이 잘 어울려요.
        </p>
        <div className="mt-3 overflow-hidden rounded border border-[color:var(--adminui-line)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={settings.cover_url} alt="" className="h-44 w-full object-cover" />
        </div>
        <label className="mt-3 inline-block">
          <span className="sr-only">커버 사진 파일</span>
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => onCoverFile(e.target.files?.[0] ?? null)}
            className="text-[13px]"
          />
        </label>
      </AdminCard>

      {/* ── 배너 ─────────────────────────────────────────────────── */}
      <AdminCard>
        <div className="flex items-center justify-between gap-2">
          <SectionTitle title={`이벤트 · 모집 배너 ${banners.length}개`} />
          <AdminButton onClick={startNew} disabled={busy}>
            새 배너
          </AdminButton>
        </div>
        <p className="text-[13px] text-[color:var(--adminui-mute)]">
          위에서부터 번호 ① ② 순서로 보여요. 기간이 끝나면 {ENDED_GRACE_DAYS}일 동안 회색 &quot;기간 종료&quot;로
          남았다가 자동으로 사라져요. 오늘: {today}
        </p>

        {form && (
          <div className="mt-4 grid gap-3 rounded border border-[color:var(--adminui-line)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>종류</label>
                <select
                  value={form.variant}
                  onChange={(e) => setForm({ ...form, variant: e.target.value as 'photo' | 'poster' })}
                  className={inputCls}
                >
                  <option value="poster">포스터(세로 이미지, 글자는 아래에)</option>
                  <option value="photo">사진(가로 이미지 위에 제목)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>배지 (예: 모집 / 이벤트)</label>
                <input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className={inputCls} maxLength={20} />
              </div>
            </div>
            <div>
              <label className={labelCls}>번호 옆 한 줄 공지 (예: 서포터즈 1기를 모집하고 있어요)</label>
              <input value={form.notice} onChange={(e) => setForm({ ...form, notice: e.target.value })} className={inputCls} maxLength={80} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>제목</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} maxLength={60} />
              </div>
              <div>
                <label className={labelCls}>부제</label>
                <input value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })} className={inputCls} maxLength={80} />
              </div>
            </div>
            <div>
              <label className={labelCls}>누르면 가는 링크 (인스타 게시물 주소 등)</label>
              <input value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} className={inputCls} placeholder="https://www.instagram.com/p/..." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>시작일 (비우면 바로)</label>
                <input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>종료일 (비우면 계속)</label>
                <input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>이미지 {form.variant === 'poster' ? '(세로 4:5 권장)' : '(가로 16:10 권장)'}</label>
              {form.image_url && (
                <div className="mb-2 w-40 overflow-hidden rounded border border-[color:var(--adminui-line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.image_url} alt="" className="w-full object-cover" />
                </div>
              )}
              <input type="file" accept="image/*" disabled={busy} onChange={(e) => onBannerFile(e.target.files?.[0] ?? null)} className="text-[13px]" />
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              링크 페이지에 표시
            </label>
            {previewWindow && (
              <p className="text-[12px] text-[color:var(--adminui-mute)]">
                오늘 기준 상태:{' '}
                {previewWindow === 'active'
                  ? '진행 중으로 보여요'
                  : previewWindow === 'upcoming'
                    ? '시작일 전이라 아직 안 보여요'
                    : previewWindow === 'ended_recent'
                      ? '회색 "기간 종료"로 보여요'
                      : `종료 ${ENDED_GRACE_DAYS}일이 지나 안 보여요`}
              </p>
            )}
            <div className="flex gap-2">
              <AdminButton onClick={submitBanner} disabled={busy}>
                {form.id ? '수정 저장' : '배너 추가'}
              </AdminButton>
              <AdminButton onClick={() => setForm(null)} disabled={busy}>
                취소
              </AdminButton>
            </div>
          </div>
        )}

        {banners.length === 0 ? (
          <p className="mt-3 text-[13px] text-[color:var(--adminui-mute)]">아직 배너가 없어요. &quot;새 배너&quot;로 만들어 주세요.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {banners.map((b, i) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded border border-[color:var(--adminui-line)] px-3 py-2">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-[color:var(--adminui-bg)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.image_url} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">
                    {i + 1}. {b.title}
                  </p>
                  <p className="truncate text-[12px] text-[color:var(--adminui-mute)]">
                    {b.starts_on ?? '바로'} ~ {b.ends_on ?? '계속'} · {b.variant === 'poster' ? '포스터' : '사진'}
                  </p>
                </div>
                {statusBadge(b)}
                <span className="flex gap-1">
                  <AdminButton onClick={() => moveBanner(i, -1)} disabled={busy || i === 0}>
                    ↑
                  </AdminButton>
                  <AdminButton onClick={() => moveBanner(i, 1)} disabled={busy || i === banners.length - 1}>
                    ↓
                  </AdminButton>
                  <AdminButton onClick={() => startEdit(b)} disabled={busy}>
                    편집
                  </AdminButton>
                  <AdminButton onClick={() => deleteBanner(b)} disabled={busy}>
                    삭제
                  </AdminButton>
                </span>
              </li>
            ))}
          </ul>
        )}

        <label className="mt-4 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={settings.show_store_card}
            disabled={busy}
            onChange={(e) => void run('스마트스토어 카드', () => saveSettings({ show_store_card: e.target.checked }))}
          />
          배너 목록 맨 아래에 스마트스토어 카드(파우치 4종) 보이기
        </label>
      </AdminCard>

      {/* ── 하루 사진 ─────────────────────────────────────────────── */}
      <AdminCard>
        <SectionTitle title={`파머스테일의 하루 사진 ${settings.moment_urls.length}장`} />
        <p className="text-[13px] text-[color:var(--adminui-mute)]">
          옆으로 넘겨 보는 세로 사진 줄이에요. 실물 사진만 올려 주세요(최대 12장).
        </p>
        {settings.moment_urls.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-3">
            {settings.moment_urls.map((u, i) => (
              <li key={u + i} className="w-28">
                <div className="aspect-[4/5] overflow-hidden rounded border border-[color:var(--adminui-line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="mt-1 flex justify-between gap-1">
                  <AdminButton onClick={() => moveMoment(i, -1)} disabled={busy || i === 0}>
                    ←
                  </AdminButton>
                  <AdminButton onClick={() => removeMoment(i)} disabled={busy}>
                    빼기
                  </AdminButton>
                  <AdminButton onClick={() => moveMoment(i, 1)} disabled={busy || i === settings.moment_urls.length - 1}>
                    →
                  </AdminButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-3 inline-block">
          <span className="sr-only">하루 사진 추가</span>
          <input
            type="file"
            accept="image/*"
            disabled={busy || settings.moment_urls.length >= 12}
            onChange={(e) => onMomentFile(e.target.files?.[0] ?? null)}
            className="text-[13px]"
          />
        </label>
      </AdminCard>
    </div>
  )
}
