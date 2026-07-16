import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { tierFromStamps } from '@/lib/tiers'
import CertificateClient from './CertificateClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '파머스테일 강아지 등록증',
  robots: { index: false, follow: false },
}

/**
 * /mypage/certificate/[dogId] — 단짝(mate) 등급 사용자 전용 강아지 등록증.
 *
 * 발급 조건
 * ────────
 *  - 나무(mate) 등급 — **스탬프 개수 파생 정본**(tierFromStamps). profiles.tier(stale
 *    캐시)를 쓰면 멤버십 페이지(정본)와 갈라져, 스탬프상 나무인데 등록증만 막히는
 *    (혹은 반대) 불일치가 났다(2026-07-17 정합).
 *  - dog 의 user_id === 본인
 *  → 두 조건 모두 충족해야 등록증 페이지 진입. 어긋나면 /mypage/membership.
 *
 * 일련번호
 * ───────
 * `FT-YYYY-XXXXXXXX` 형식. dogId 의 첫 8자리 hex 를 대문자로 + 연도 prefix.
 * 변경되지 않는 결정론적 값이라 사용자가 SNS 공유해도 위조 흔적 검증 가능.
 *
 * 저장
 * ────
 * 사용자가 "PDF / 이미지 저장" 버튼 누르면 브라우저 print dialog 또는
 * html2canvas 로 PNG 다운로드. 별도 PDF 라이브러리 의존 X.
 */
export default async function CertificatePage({
  params,
}: {
  params: Promise<{ dogId: string }>
}) {
  const { dogId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/mypage/certificate/${dogId}`)

  // 본인 강아지 + 본인 등급 동시 fetch.
  const [{ data: dog }, { data: profile }] = await Promise.all([
    supabase
      .from('dogs')
      .select('id, name, breed, birth_date, photo_url, created_at')
      .eq('id', dogId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('stamp_count, name, created_at')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (!dog) redirect('/dogs')

  // 나무 등급 아니면 멤버십 페이지로 (안내 자연스럽게). 스탬프 개수 파생 정본.
  if (tierFromStamps(profile?.stamp_count ?? 0) !== 'mate') {
    redirect('/mypage/membership')
  }

  return (
    <CertificateClient
      dog={dog}
      ownerName={profile?.name ?? '보호자'}
      memberSince={profile?.created_at ?? null}
    />
  )
}
