/**
 * XL-12 (#50) — Locale 쿠키 helper.
 *
 * 사용자가 명시적으로 선택한 locale 을 cookie 에 저장. 브라우저 헤더보다
 * 우선 적용. 30일 만료.
 */
import { cookies } from 'next/headers'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from './dictionaries'

const COOKIE_KEY = 'ft_locale'

export async function readLocaleCookie(): Promise<Locale> {
  const jar = await cookies()
  const raw = jar.get(COOKIE_KEY)?.value
  if (raw && SUPPORTED_LOCALES.includes(raw as Locale)) {
    return raw as Locale
  }
  // Accept-Language 헤더는 별도 layer 에서 fallback.
  return DEFAULT_LOCALE
}

export async function writeLocaleCookie(locale: Locale): Promise<void> {
  const jar = await cookies()
  jar.set({
    name: COOKIE_KEY,
    value: locale,
    httpOnly: false, // 클라이언트에서도 읽을 수 있게
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86_400,
  })
}
