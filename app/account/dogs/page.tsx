import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ChevronRight, Dog as DogIcon, Smartphone, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { isAppContextServer } from '@/lib/app-context'
import { Container, Display, Eyebrow } from '@/components/web/fd/ui'

/**
 * /account/dogs — 웹 사용자용 "우리 아이" 간략 목록.
 *
 * (main)/dogs 의 풀 케어 화면(기록·분석·복약·산책 등)은 AppChrome 폰프레임
 * 전용이라 웹엔 부적합. 웹에선 **읽기전용 간략 목록**만 — 사진·이름·견종·나이.
 * 상세 케어/관리는 앱 유도. /account 허브에서 진입.
 *
 * 라우트: '/account/dogs' 는 proxy 의 app-only '/dogs' prefix 와 매칭 안 됨
 * (startsWith('/dogs/') 만 차단) → 웹 진입 허용. /account 와 같은 패턴.
 *
 * 디자인(2026-06-27): /account 와 동일 FD 프리미티브(Container/Display/Eyebrow).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '우리 아이',
  description: '등록한 반려견 목록을 한눈에.',
  alternates: { canonical: '/account/dogs' },
  robots: { index: false, follow: false },
}

type DogRow = {
  id: string
  name: string
  breed: string | null
  photo_url: string | null
  age_value: number | null
  age_unit: string | null
}

function ageLabel(d: DogRow): string | null {
  if (d.age_value == null || !d.age_unit) return null
  return `${d.age_value}${d.age_unit === 'year' ? '살' : '개월'}`
}

export default async function AccountDogsPage() {
  const isApp = await isAppContextServer()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/account/dogs')
  }

  const { data } = await supabase
    .from('dogs')
    .select('id, name, breed, photo_url, age_value, age_unit')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const dogs = (data ?? []) as DogRow[]

  return (
    <AuthAwareShell>
      <main
        className="pb-16 md:pb-24"
        style={{ background: 'var(--fd-offwhite)', minHeight: '72vh' }}
      >
        <Container size="lg" className="pt-4 md:pt-6">
          {/* breadcrumb */}
          <nav
            aria-label="현재 위치"
            className="flex items-center gap-1 text-[11px] md:text-[12px]"
            style={{ color: 'var(--fd-muted)' }}
          >
            <Link href="/" className="hover:opacity-70 transition">
              홈
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
            <Link href="/account" className="hover:opacity-70 transition">
              내 계정
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
            <span style={{ color: 'var(--fd-pine)', fontWeight: 700 }}>우리 아이</span>
          </nav>

          {/* Hero */}
          <header className="pt-8 md:pt-14 pb-7 md:pb-10">
            <Eyebrow>Our Dogs · 우리 아이</Eyebrow>
            <Display as="h1" size="md" className="mt-3 md:mt-4" style={{ color: 'var(--fd-pine)' }}>
              함께하는 아이들
            </Display>
            <p
              className="mt-4 text-[12.5px] md:text-[14px]"
              style={{ color: 'var(--fd-muted)' }}
            >
              {dogs.length > 0
                ? `${dogs.length}마리 · 상세 케어·기록은 앱에서 도와드려요`
                : '아직 등록된 아이가 없어요'}
            </p>
          </header>

          {dogs.length === 0 ? (
            /* 빈 상태 — 설문으로 유도 */
            <div
              className="rounded-[14px] px-6 py-10 md:px-10 md:py-12 text-center"
              style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
            >
              <span
                className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-4"
                style={{ background: 'var(--fd-cream)' }}
              >
                <DogIcon className="w-6 h-6" strokeWidth={1.75} style={{ color: 'var(--fd-pine)' }} />
              </span>
              <Display as="h2" size="sm" style={{ color: 'var(--fd-pine)' }}>
                우리 아이를 등록해 주세요
              </Display>
              <p
                className="mt-3 text-[12.5px] md:text-[14px] leading-relaxed"
                style={{ color: 'var(--fd-muted)', maxWidth: 420, marginInline: 'auto' }}
              >
                2분 설문이면 우리 아이에게 맞는 식단을 설계해 드려요.
              </p>
              <Link
                href="/start"
                className="mt-6 inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13px] font-bold transition hover:brightness-[0.94] active:scale-[0.98]"
                style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
              >
                맞춤 플랜 시작하기
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-3.5">
                {dogs.map((d) => {
                  const age = ageLabel(d)
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-4 rounded-[12px] px-4 py-4 md:px-5 md:py-5"
                      style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                    >
                      {/* 사진 누끼 — 원형 */}
                      <span
                        className="relative w-16 h-16 md:w-[72px] md:h-[72px] rounded-full overflow-hidden shrink-0"
                        style={{ background: 'var(--fd-cream)' }}
                      >
                        {d.photo_url ? (
                          <Image
                            src={d.photo_url}
                            alt={d.name}
                            fill
                            sizes="72px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <DogIcon
                              className="w-7 h-7"
                              strokeWidth={1.5}
                              style={{ color: 'var(--fd-muted)' }}
                            />
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[16px] md:text-[18px] truncate"
                          style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}
                        >
                          {d.name}
                        </div>
                        <div
                          className="mt-1 text-[11.5px] md:text-[13px]"
                          style={{ color: 'var(--fd-muted)' }}
                        >
                          {[d.breed, age].filter(Boolean).join(' · ') || '정보 없음'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 앱 유도 — 상세 케어/기록 */}
              {!isApp && (
                <Link
                  href="/app-required"
                  className="mt-8 md:mt-10 flex items-center gap-3 rounded-[12px] px-5 py-4 transition hover:brightness-[1.02] active:scale-[0.99]"
                  style={{ background: 'var(--fd-pine)', color: '#FFFFFF' }}
                >
                  <Smartphone className="w-[18px] h-[18px] shrink-0" strokeWidth={2} color="var(--fd-green-soft)" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] md:text-[15px] font-bold">
                      일일 케어·체중·분석은 앱에서
                    </div>
                    <div className="text-[11px] md:text-[12px] mt-0.5" style={{ color: 'rgba(245,240,230,0.7)' }}>
                      기록, 산책, 영양 분석을 더 빠르게
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" strokeWidth={2} />
                </Link>
              )}
            </>
          )}
        </Container>
      </main>
    </AuthAwareShell>
  )
}
