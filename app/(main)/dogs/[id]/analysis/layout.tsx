import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { petName } from '@/lib/korean'

/**
 * /dogs/[id]/analysis 레이아웃 — server component 로 generateMetadata 제공.
 *
 * 카카오톡 / 페이스북 / Slack 등에서 분석 페이지 URL 공유 시 OG 메타가
 * 강아지 이름 + 분석 요약 노출. 신규 획득 funnel — 친구가 link 클릭 → 풍부한
 * preview → 클릭률 ↑.
 *
 * # 동적 fetch
 * dog.name 만 사용 (RLS 가 본인 dog 만 허용 — 비로그인 / 다른 사용자 공유는
 * 기본 메타로 fallback). 비용 적은 query 한 번.
 *
 * 2026-10-09 앱 새 디자인 — 공유 미리보기 문구도 고객 문구다(사장님 결정 목록: 분석 화면 전문용어 빼기).
 * 'NRC/AAFCO/FEDIAF 기반'·'매 cycle 알고리즘 자동 조정'(영어·약어, 실제 재제안은 박스 3개마다) → "국제 영양 기준에 맞춘".
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: dog } = await supabase
      .from('dogs')
      .select('name')
      .eq('id', id)
      .maybeSingle()
    const name = (dog as { name?: string } | null)?.name
    if (!name) {
      return DEFAULT_META
    }
    return {
      title: `${petName(name)} 맞춤 영양 분석 · 파머스테일`,
      description: `${petName(name)}를 위한 국제 영양 기준에 맞춘 맞춤 화식 박스. 단백질별 맞춤 레시피.`,
      openGraph: {
        title: `${petName(name)} 맞춤 영양 분석`,
        description: '국제 영양 기준에 맞춘 맞춤 화식 박스.',
        type: 'website',
        siteName: '파머스테일 · Farm to Tail',
        locale: 'ko_KR',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${petName(name)} 맞춤 영양 분석`,
      },
    }
  } catch {
    return DEFAULT_META
  }
}

const DEFAULT_META: Metadata = {
  title: '맞춤 영양 분석 · 파머스테일',
  description:
    '국제 영양 기준에 맞춘 강아지 맞춤 화식 박스. 단백질별 맞춤 레시피.',
  openGraph: {
    title: '파머스테일 · Farm to Tail',
    description: '국제 영양 기준에 맞춘 강아지 맞춤 화식 박스.',
    type: 'website',
    siteName: '파머스테일',
    locale: 'ko_KR',
  },
}

export default function AnalysisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
