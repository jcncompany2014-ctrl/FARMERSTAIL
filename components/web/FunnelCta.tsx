'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { planHref } from '@/lib/funnel-cta'
import { Button } from '@/components/web/fd/ui'

/**
 * 마케팅 페이지의 퍼널 CTA — **로그인 여부를 클라이언트에서** 판정한다.
 *
 * # 왜 만들었나 (2026-08-12 4라운드 감사) — 두 문제를 한 번에 없앤다
 *
 * ① **앱 설치 벽으로 튕기던 버그.** 마케팅 5개 페이지(plans·science·why-fresh·
 *    brand·why-app)가 `user ? '/dogs/new' : '/start'` 라는 옛 삼항을 그대로
 *    갖고 있었다. `/dogs/*` 는 **앱 전용 경로**라(proxy APP_ONLY_PREFIXES),
 *    웹으로 가입한 고객이 "2분 설문 시작하기" 를 누르면 설문 대신 `/app-required`
 *    설치 벽이 뜬다. lib/funnel-cta 의 planHref 가 이미 이걸 고친 정본인데,
 *    그 docstring 이 나열한 수정 목록에서 이 5개가 빠져 있었다.
 *
 * ② **ISR 이 죽어 있던 원인.** 이 삼항 하나 때문에 페이지가 서버에서
 *    `auth.getUser()` 를 불렀고, 그래서 14개 마케팅 페이지가 전부 dynamic 이
 *    되어(프리렌더 0개) 인스타 클릭마다 SSR 이 돌았다. DB 를 하나도 안 읽는
 *    페이지들이다 — CTA 링크 한 줄이 CDN 캐시를 막고 있었다.
 *
 * # 왜 클라이언트 판정이 안전한가
 * 이미 이 저장소의 정본 패턴이다 — components/WebChrome.tsx 가 헤더·푸터·
 * 스크롤 pill CTA 를 같은 방식(useState + getSession + planHref)으로 그린다.
 * 즉 모든 마케팅 페이지의 **헤더 CTA 는 이미 클라이언트에서** 계산되고 있었고,
 * 본문 CTA 만 서버 auth 를 중복 호출하고 있었다.
 *
 * 판정 전(isAuthed === null)에는 `/start` 를 가리킨다 — 비로그인이 다수이고,
 * 로그인 사용자가 눌러도 `/start` 는 막다른 길이 아니다(퍼널이 이어받는다).
 */
export default function FunnelCta({
  children,
  tone,
  size,
  full,
  className,
}: {
  children: ReactNode
  tone?: 'coral' | 'pine' | 'green' | 'cream' | 'outline' | 'outlineLight'
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  className?: string
}) {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    const supabase = createClient()
    // getSession() = 쿠키 로컬 read (WebChrome 과 같은 선택 — getUser RTT 회피).
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive) setIsAuthed(!!session?.user)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <Button
      href={planHref(!!isAuthed, false)}
      tone={tone}
      size={size}
      full={full}
      className={className}
    >
      {children}
    </Button>
  )
}
