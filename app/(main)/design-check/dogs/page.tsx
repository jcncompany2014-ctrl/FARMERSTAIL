import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { V3 } from '@/lib/design/tokens'
import DogTabsNav from '@/components/dogs/DogTabsNav'
import DogsListView from '../../dogs/DogsListView'
import DogDetailClient from '../../dogs/[id]/DogDetailClient'
import DiaryClient from '../../dogs/[id]/diary/DiaryClient'
import HealthLogClient from '../../dogs/[id]/health/HealthLogClient'
import HealthCareClient from '../../dogs/[id]/health-care/HealthCareClient'
import NewDogClient from '../../dogs/new/NewDogClient'
import EditDogClient from '../../dogs/[id]/edit/EditDogClient'
import { ConfirmDemo, DiaryWriteDemo } from './DogsDemos'
import {
  AI_COMMENT,
  DIARY_ENTRIES,
  DIARY_PHOTOS,
  DOG,
  DOG_BORI,
  DOG_ID,
  DOG_LIST,
  EDIT_INITIAL,
  FORMULA,
  HEALTH_LOGS,
  INSIGHT,
  MEDICAL_PREVIEW,
  MEDICATIONS,
  REMINDERS,
  SCREENS,
  SUBSCRIPTIONS,
  VACCINATIONS,
  WEIGHT_LOGS,
} from './_fixtures'

/**
 * /design-check/dogs — 앱 새 디자인('A 포스터') 묶음 2A(우리 아이·기록·등록·건강 관리) 점검 화면 (2026-10-09).
 *
 * 실제 화면은 로그인해야 열려서, 실제와 같은 부품(DogsListView·DogDetailClient·…Client)에 예시 값을 넣어
 * 로그인 없이 시안(캔버스 T07·T08·AppDog·D01~D21)과 나란히 본다. **실제 사이트(Vercel production)에선 404.**
 * 손님 화면이 아니라 문구·데이터는 예시다 — 저장 버튼을 눌러도 로그인이 없어 저장되지 않는다.
 *
 * 윗줄 제목은 이 주소의 것(AppChrome)이라 실제 화면과 다르다. 강아지 위 탭(개요·기록·분석)은 실제 화면에선
 * [id]/layout 이 그리므로 여기서 같은 부품을 직접 얹는다(어느 칸이 켜질지는 previewPath 로).
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 우리 아이',
  robots: { index: false, follow: false },
}

export default async function DesignCheckDogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''

  const tabs = (sub: string) => <DogTabsNav dogId={DOG_ID} previewPath={`/dogs/${DOG_ID}${sub}`} />

  const detail = (opts: { bori?: boolean; grace?: boolean; deleteConfirm?: boolean; noSub?: boolean } = {}) => (
    <>
      {tabs('')}
      <DogDetailClient
        dog={opts.bori ? DOG_BORI : DOG}
        initialWeightLogs={opts.bori ? [] : WEIGHT_LOGS}
        currentFormula={opts.bori ? null : FORMULA}
        checkinStatus={{ week_2: false, week_4: false }}
        subscriptions={opts.bori || opts.noSub ? [] : SUBSCRIPTIONS}
        insight={INSIGHT}
        aiComment={opts.bori ? null : AI_COMMENT}
        gracePhase={opts.grace ? 'optional_nudge' : 'normal'}
        previewDeleteConfirm={opts.deleteConfirm}
      />
    </>
  )

  switch (s) {
    case 'list':
      return <DogsListView dogs={DOG_LIST} />
    case 'list-empty':
      return <DogsListView dogs={[]} />
    case 'dog':
    case 'dog-weight':
      return detail()
    case 'dog-grace':
      return detail({ grace: true })
    case 'dog-welcome':
      return detail({ bori: true })
    case 'dog-delete':
      return detail({ deleteConfirm: true })
    case 'dog-delete-free':
      return detail({ deleteConfirm: true, noSub: true })
    case 'diary':
    case 'diary-delete':
      return (
        <>
          {tabs('/diary')}
          <DiaryClient dogId={DOG_ID} dogName="땅콩" initialEntries={DIARY_ENTRIES} />
          {s === 'diary-delete' && <ConfirmDemo />}
        </>
      )
    case 'diary-write':
      return (
        <>
          {tabs('/diary')}
          <DiaryWriteDemo dogId={DOG_ID} dogName="땅콩" entries={DIARY_ENTRIES} photos={DIARY_PHOTOS} />
        </>
      )
    case 'diary-empty':
      return (
        <>
          {tabs('/diary')}
          <DiaryClient dogId={DOG_ID} dogName="땅콩" initialEntries={[]} />
        </>
      )
    case 'health':
      return (
        <>
          {tabs('/health')}
          <HealthLogClient dogId={DOG_ID} dogName="땅콩" initialLogs={HEALTH_LOGS} preview={{ openLogId: 'h1' }} />
        </>
      )
    case 'health-form':
      return (
        <>
          {tabs('/health')}
          <HealthLogClient
            dogId={DOG_ID}
            dogName="땅콩"
            initialLogs={HEALTH_LOGS.slice(1)}
            preview={{ form: { poop: 'good', count: '2', activity: 'normal', mood: 'happy' } }}
          />
        </>
      )
    case 'health-medical':
      return (
        <>
          {tabs('/health')}
          <HealthLogClient dogId={DOG_ID} dogName="땅콩" initialLogs={HEALTH_LOGS} preview={{ medical: MEDICAL_PREVIEW }} />
        </>
      )
    case 'health-empty':
      return (
        <>
          {tabs('/health')}
          <HealthLogClient dogId={DOG_ID} dogName="땅콩" initialLogs={[]} />
        </>
      )
    case 'care-meds':
    case 'care-med-add':
    case 'care-vaccines':
    case 'care-vaccine-add':
    case 'care-reminders':
    case 'care-reminder-add': {
      const tab = s.startsWith('care-med') ? 'medications' : s.startsWith('care-vaccine') ? 'vaccinations' : 'reminders'
      return (
        <>
          {tabs('/health-care')}
          <HealthCareClient
            dogId={DOG_ID}
            dogName="땅콩"
            initialReminders={REMINDERS}
            initialTab={tab}
            preview={{ medications: MEDICATIONS, vaccinations: VACCINATIONS, openAdd: s.endsWith('-add') }}
          />
        </>
      )
    }
    case 'new':
      // 강아지 등록은 [id] 밖이라 위 탭이 없다. 예시 사용자 id — 임시 저장(자동저장)은 이 미리보기 브라우저에만 남는다.
      return <NewDogClient userId="design-check-preview" />
    case 'edit':
      return (
        <>
          {tabs('/edit')}
          <EditDogClient initial={EDIT_INITIAL} />
        </>
      )
    default:
      return <Index />
  }
}

/** 열리는 창은 주소 뒤에 붙여 연다 — 체중 창 ?weight=open · 환영 창 ?welcome=1(실제 화면과 같은 신호). */
const EXTRA_QUERY: Record<string, string> = {
  'dog-weight': '&weight=open',
  'dog-welcome': '&welcome=1',
}

function Index() {
  return (
    <div style={{ padding: '20px 20px 32px' }}>
      <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>디자인 점검 · 우리 아이</h1>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: V3.inkMute, lineHeight: 1.5 }}>
        미리보기 전용 화면이에요. 실제 화면과 같은 부품에 예시 값을 넣었어요.
      </p>
      <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {SCREENS.map(([k, title, mock]) => (
          <li key={k}>
            <Link
              href={`/design-check/dogs?s=${k}${EXTRA_QUERY[k] ?? ''}`}
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
