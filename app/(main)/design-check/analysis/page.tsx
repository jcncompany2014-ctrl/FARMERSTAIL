import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { V3 } from '@/lib/design/tokens'
import AnalysisDemo from './AnalysisDemo'
import TourDemo from '../TourDemo'
import { ANALYSIS_FIXTURES } from './_fixtures'
import { FX_DOG_ID, HISTORY_ROWS, REPORTS, VET_REPORT, YEAR_REVIEW } from './_fixtures_more'
import AnalysesHistoryView from '../../dogs/[id]/analyses/AnalysesHistoryView'
import VetReportView from '../../dogs/[id]/vet-report/VetReportView'
import YearInReviewView, { YearTooEarlyView } from '../../dogs/[id]/year-in-review/YearInReviewView'
import ReportsView from '../../reports/ReportsView'
import ChatDemo from './ChatDemo'
import AccuracyIntro from '../../mypage/accuracy/AccuracyIntro'
import AccuracyBreakdown, { type AccuracyVar } from '@/components/dashboard/AccuracyBreakdown'
import CompareView from '@/app/compare/CompareView'

/** 분석 탭 밖 화면들 — [이름, 제목, 시안]. */
const OTHER_SCREENS: Array<[string, string, string]> = [
  ['analyses', '분석 기록', 'A06-analyses'],
  ['analyses-empty', '분석 기록 · 없음', '—'],
  ['vet-report', '수의사에게 보여주기 (진료 보고서)', 'D22-VetReport'],
  ['year', '연말 결산', 'A09-year-in-review'],
  ['year-early', '연말 결산 · 함께한 지 30일 미만', 'I11-YearTooEarly'],
  ['reports', '건강 리포트', 'A11-reports'],
  ['reports-nodog', '건강 리포트 · 강아지 없음', '—'],
  ['chat-empty', 'AI 영양 상담 · 처음', 'A13-chat-empty'],
  ['chat', 'AI 영양 상담 · 대화 중', 'A12-chat'],
  ['chat-limit', 'AI 상담 · 오늘 횟수 다 씀', 'I04-ChatLimit'],
  ['chat-fail', 'AI 상담 · 답변 실패', 'I05-ChatFail'],
  ['accuracy', '분석 맞춤도', 'A14-accuracy'],
  ['compare', '4종 비교', 'A10-compare'],
]

/** 분석 맞춤도 예시(시안 A14) — 체중 79 · 활동 50 · 급여 100. */
const ACCURACY_VARS: AccuracyVar[] = [
  { key: 'weight', label: '체중', score: 0.79, hint: '동물병원/디지털 체중계로 재면 정밀도가 올라가요' },
  { key: 'activity', label: '활동', score: 0.5, hint: '만보계나 스마트태그를 연동하면 정밀도가 올라가요' },
  { key: 'feed', label: '급여', score: 1, hint: '다음 박스부터 자동 추적이 시작돼요' },
]

/**
 * /design-check/analysis — 앱 새 디자인('A 포스터') 2단계 묶음 2B(분석·상담·리포트) 점검 화면.
 *
 * 실제 화면은 로그인해야 열려서, 같은 그리기 부품에 예시 값을 넣어 시안(캔버스 앱② p2b2)과 나란히 본다.
 * **실제 사이트(Vercel production)에선 404.** 미리보기·로컬에서만 열린다. 손님 화면이 아니라 문구·데이터는 예시다.
 * ?s=<이름> 으로 화면을 고른다. 이름이 없으면 목록.
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 분석',
  robots: { index: false, follow: false },
}

export default async function DesignCheckAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''
  // 결과 화면 둘러보기(캔버스 TR0·TR1·TR4) — &tour=start|plan|finish 로 그 단계를 띄운다(app/(main)/design-check/TourDemo).
  const tour = typeof sp.tour === 'string' ? sp.tour : ''
  if (ANALYSIS_FIXTURES[s])
    return (
      <>
        <AnalysisDemo which={s} />
        {(tour === 'start' || tour === 'plan' || tour === 'finish') && (
          <TourDemo place="result" step={tour} backHref={`/design-check/analysis?s=${s}&fromSurvey=1&tour=finish`} />
        )}
      </>
    )
  if (s === 'analyses')
    return <AnalysesHistoryView dogId={FX_DOG_ID} dogName="땅콩" analyses={HISTORY_ROWS} latestIsStale={false} />
  if (s === 'analyses-empty')
    return <AnalysesHistoryView dogId={FX_DOG_ID} dogName="땅콩" analyses={[]} latestIsStale={false} />
  if (s === 'vet-report') return <VetReportView data={VET_REPORT} />
  if (s === 'year') return <YearInReviewView data={YEAR_REVIEW} />
  if (s === 'year-early') return <YearTooEarlyView dogId={FX_DOG_ID} dogName="땅콩" daysIn={21} />
  if (s === 'reports') return <ReportsView {...REPORTS} />
  if (s === 'reports-nodog') return <ReportsView {...REPORTS} dogs={[]} />
  if (s === 'chat-empty' || s === 'chat' || s === 'chat-limit' || s === 'chat-fail') return <ChatDemo which={s} />
  if (s === 'accuracy')
    return (
      <div style={{ paddingBottom: 28, lineHeight: 'normal' }}>
        <AccuracyIntro silent={false} />
        <AccuracyBreakdown variables={ACCURACY_VARS} dogId={FX_DOG_ID} userBoost={0} userMethodLock={null} defaultOpen />
      </div>
    )
  if (s === 'compare') return <CompareView skus={['C01', 'D02', 'P04', 'B05']} isApp siteUrl="https://www.farmerstail.kr" />
  return <DesignIndex />
}

function DesignIndex() {
  const items: Array<[string, string, string, string]> = [
    ...Object.entries(ANALYSIS_FIXTURES).map(
      ([k, v]) =>
        [k, v.title, v.mock, v.fromSurveyQuery ? `?s=${k}&fromSurvey=1` : `?s=${k}`] as [string, string, string, string],
    ),
    ...OTHER_SCREENS.map(([k, t, m]) => [k, t, m, `?s=${k}`] as [string, string, string, string]),
  ]
  return (
    <div style={{ padding: '20px 20px 32px' }}>
      <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>디자인 점검 · 분석</h1>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: V3.inkMute, lineHeight: 1.5 }}>
        미리보기 전용 화면이에요. 실제 화면과 같은 부품에 예시 값을 넣었어요.
      </p>
      <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {items.map(([k, title, mock, q]) => (
          <li key={k}>
            <Link
              href={`/design-check/analysis${q}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                minHeight: 56,
                padding: '10px 14px',
                borderRadius: 4,
                background: V3.soft,
                color: V3.ink,
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
              <span style={{ fontSize: 13, color: V3.inkMute, flexShrink: 0 }}>{mock}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
