import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { BIO_COVER, BIO_MOMENTS } from '@/lib/links'
import { bannerWindow, isBannerVisible, type BannerWindow } from './status'

/**
 * /link 콘텐츠 로더 — DB(link_page_settings·link_banners)를 읽어 화면 모델로.
 *
 * 읽기는 service_role(쿠키 없음)로 — /link 는 공개 페이지라 ISR(revalidate)로
 * 굽고, 어드민이 저장할 때 revalidatePath('/link') 로 갱신한다.
 * 조회 실패·빈 DB 면 코드 기본값(lib/links.ts)으로 폴백 — 마케팅 링크가
 * 인스타 프로필에 걸려 있어 빈 화면은 곧 유입 손실이다. 실패는 이벤트로 남긴다.
 */

export type LinkBannerVariant = 'photo' | 'poster'

export type LinkBanner = {
  id: string
  variant: LinkBannerVariant
  badge: string
  notice: string
  title: string
  sub: string
  href: string
  imageUrl: string
  startsOn: string | null
  endsOn: string | null
  window: BannerWindow
}

export type LinkContent = {
  coverUrl: string
  momentUrls: string[]
  showStoreCard: boolean
  /** 화면에 그릴 배너만(active·ended_recent), sort_order 순. */
  banners: LinkBanner[]
  /** DB 를 못 읽어 코드 기본값으로 그렸으면 true(어드민 화면 경고용). */
  fallback: boolean
}

/** DB 가 없을 때의 기본값 — 시드 마이그레이션과 같은 내용. */
export const FALLBACK_CONTENT: Omit<LinkContent, 'banners' | 'fallback'> = {
  coverUrl: BIO_COVER,
  momentUrls: BIO_MOMENTS,
  showStoreCard: true,
}

function asVariant(v: string): LinkBannerVariant {
  return v === 'poster' ? 'poster' : 'photo'
}

export async function loadLinkContent(today: string): Promise<LinkContent> {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return { ...FALLBACK_CONTENT, banners: [], fallback: true }
  }

  const [settingsRes, bannersRes] = await Promise.all([
    supabase.from('link_page_settings').select('cover_url, moment_urls, show_store_card').eq('id', 1).maybeSingle(),
    supabase
      .from('link_banners')
      .select('id, variant, badge, notice, title, sub, href, image_url, starts_on, ends_on')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (settingsRes.error || bannersRes.error) {
    captureBusinessEvent('error', 'link_page.load_failed', {
      settingsError: settingsRes.error?.message ?? null,
      bannersError: bannersRes.error?.message ?? null,
      note: '/link 콘텐츠 조회 실패 — 코드 기본값으로 폴백(배너 없음). 어드민 저장 내용이 안 보인다.',
    })
    return { ...FALLBACK_CONTENT, banners: [], fallback: true }
  }

  const s = settingsRes.data
  const banners: LinkBanner[] = (bannersRes.data ?? [])
    .map((r) => ({
      id: r.id,
      variant: asVariant(r.variant),
      badge: r.badge,
      notice: r.notice,
      title: r.title,
      sub: r.sub,
      href: r.href,
      imageUrl: r.image_url,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      window: bannerWindow(today, r.starts_on, r.ends_on),
    }))
    .filter((b) => isBannerVisible(b.window))

  return {
    coverUrl: s?.cover_url || FALLBACK_CONTENT.coverUrl,
    momentUrls: s && s.moment_urls.length > 0 ? s.moment_urls : FALLBACK_CONTENT.momentUrls,
    showStoreCard: s?.show_store_card ?? true,
    banners,
    fallback: false,
  }
}
