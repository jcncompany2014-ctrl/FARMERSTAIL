import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { POUCH, V3, V3Radius, V3Shadow } from '@/lib/design/tokens'
import HomeView from '@/components/v3/home/HomeView'
import { HOME_FIXTURES, SHEET_KEYS, type SheetKey } from './_fixtures'
import ToastDemo from './ToastDemo'
import SheetsDemo from './SheetsDemo'
import DashboardLoading from '../dashboard/loading'
import DogsLoading from '../dogs/loading'
import DogLoading from '../dogs/[id]/loading'
import MypageLoading from '../mypage/loading'
import MainLoading from '../loading'

/**
 * /design-check — 앱 새 디자인('A 포스터') 바탕 공사 점검용 화면 (2026-10-09, docs/APP_POSTER_REDESIGN_2026_10.md).
 *
 * 로그인 없이 앱 틀(윗줄·아래 탭)과 공통 색·글꼴·카드를 한눈에 본다 — 실제 화면은 로그인이 필요해서
 * 바탕 공사 결과를 먼저 여기서 확인한다. **실제 사이트(Vercel production)에선 404.**
 * 미리보기(preview)·로컬에서만 열린다. 손님 화면이 아니라 문구·데이터는 예시다.
 */
export const metadata: Metadata = {
  title: '디자인 점검',
  robots: { index: false, follow: false },
}

// 참고(2026-10-09 빌드 실측): 실제 사이트에선 404 화면이 나가지만 상태 코드는 200 이다 — (main)/loading.tsx
// 경계 안이라 응답이 먼저 시작된 뒤 notFound() 가 그려진다(force-dynamic 으로 바꿔도 같았다). 점검 내용은 안 나가고
// noindex 라 그대로 둔다. 진짜 404 가 필요해지면 (main) 밖으로 옮길 것.

/**
 * 화면 고르기 — ?s=<이름>. 홈 상태들은 실제 홈과 같은 HomeView 에 예시 값(_fixtures)을 넣어 그린다.
 * (2026-10-09 2단계 묶음① — 홈은 로그인해야 열려서, 로그인 없이 시안과 나란히 보려고.)
 */
export default async function DesignCheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''
  const fx = HOME_FIXTURES[s]
  if (fx) return <HomeView model={fx.model} />
  if (s === 'toast-done' || s === 'toast-fail')
    return (
      <>
        <HomeView model={HOME_FIXTURES['home-multi']!.model} />
        <ToastDemo kind={s === 'toast-done' ? 'done' : 'fail'} />
      </>
    )
  if ((SHEET_KEYS as readonly string[]).includes(s))
    return (
      <>
        <HomeView model={HOME_FIXTURES['home-one']!.model} />
        <SheetsDemo which={s as SheetKey} />
      </>
    )
  // 공통 화면(캔버스 B03·B05·B06~B08) — 실제 오류 경계·없는 주소·불러오는 중 뼈대를 그대로 띄운다.
  if (s === 'error') throw new Error('디자인 점검용 오류(미리보기 전용)')
  if (s === 'notfound') notFound()
  if (s === 'load-home') return <DashboardLoading />
  if (s === 'load-dogs') return <DogsLoading />
  if (s === 'load-dog') return <DogLoading />
  if (s === 'load-mypage') return <MypageLoading />
  if (s === 'load-common') return <MainLoading />
  if (s === 'parts') return <PartsDemo />
  return <DesignIndex />
}

function DesignIndex() {
  const items: Array<[string, string, string]> = [
    ['parts', '기본 부품 (색·글꼴·버튼·카드)', '1단계'],
    ...Object.entries(HOME_FIXTURES).map(([k, v]) => [k, v.title, v.mock] as [string, string, string]),
    ['toast-done', '짧은 알림 · 완료', 'B10-ToastDone'],
    ['toast-fail', '짧은 알림 · 실패', 'B11-ToastFail'],
    ['sheet-health', '기록 · 건강·식사', 'T12-SheetHealth'],
    ['sheet-weight', '기록 · 체중', 'T13-SheetWeight'],
    ['sheet-memo', '기록 · 일기 한 줄', 'T14-SheetMemo'],
    ['sheet-photo', '기록 · 사진', 'T15-SheetPhoto'],
    ['sheet-walk', '홈 칸 · 산책', 'T16-SheetWalk'],
    ['sheet-meal', '홈 칸 · 식사', 'T17-SheetMeal'],
    ['error', '화면 오류 (앱 안)', 'B03-ErrorInApp'],
    ['notfound', '없는 주소', 'B05-NotFound'],
    ['load-home', '불러오는 중 · 홈', 'B06-LoadHome'],
    ['load-dogs', '불러오는 중 · 우리 아이', 'B07-LoadDogs'],
    ['load-mypage', '불러오는 중 · 내 정보', 'B08-LoadMyInfo'],
    ['load-dog', '불러오는 중 · 강아지 화면', '—'],
    ['load-common', '불러오는 중 · 그 외', 'B09-LoadCommon'],
  ]
  return (
    <div style={{ padding: '20px 20px 32px' }}>
      <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>디자인 점검</h1>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: V3.inkMute, lineHeight: 1.5 }}>
        미리보기 전용 화면이에요. 실제 화면과 같은 부품에 예시 값을 넣었어요.
      </p>
      <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {items.map(([k, title, mock]) => (
          <li key={k}>
            <Link
              href={`/design-check?s=${k}`}
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

function PartsDemo() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <section style={{ padding: '24px 20px 0' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: V3.inkMute }}>
          <span aria-hidden style={{ width: 8, height: 8, background: V3.mustard }} />
          10월 9일 목요일
        </span>
        <h1 style={{ margin: '10px 0 0', fontSize: 34, lineHeight: 1.15 }}>
          좋은 저녁이에요,
          <br />
          보호자님
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 17, color: V3.inkSoft }}>
          오늘도 건강한 한 끼를{' '}
          <strong style={{ fontWeight: 800, color: V3.ink, borderBottom: `4px solid ${V3.mustard}` }}>정성스럽게.</strong>
        </p>
      </section>

      {/* 핵심 카드 — 두 가지 레시피 박스(닭고기 바탕 + 흑돼지 테두리·그림자) */}
      <section
        aria-label="이번 박스"
        style={{
          margin: '22px 20px 0',
          padding: '18px 18px 16px',
          border: `3px solid ${POUCH.pork}`,
          boxShadow: `5px 5px 0 ${POUCH.pork}`,
          borderRadius: V3Radius.sm,
          background: POUCH.chicken,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>이번 박스</span>
            <span className="ft-poster" style={{ fontSize: 23, lineHeight: 1.2 }}>
              땅콩이 박스를
              <br />
              준비하고 있어요
            </span>
          </span>
          <span
            style={{
              flexShrink: 0,
              height: 30,
              padding: '0 10px',
              borderRadius: V3Radius.sm,
              background: V3.ink,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            발송 준비
          </span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700 }}>닭고기 · 흑돼지 화식</span>
      </section>

      {/* 숫자 카드 — 레시피 없는 핵심 카드(머스타드) 예시는 한 화면 한 곳 원칙 때문에 테두리만 */}
      <section style={{ margin: '24px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 14, borderRadius: V3Radius.sm, background: V3.creamSoft }}>
          <span style={{ fontSize: 13, color: V3.inkMute }}>오늘 화식</span>
          <span style={{ display: 'block', whiteSpace: 'nowrap' }}>
            <span className="ft-num" style={{ fontSize: 30 }}>
              120
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}> g</span>
          </span>
        </div>
        <div style={{ padding: 14, borderRadius: V3Radius.sm, background: V3.cream }}>
          <span style={{ fontSize: 13, color: V3.inkMute }}>다음 결제</span>
          <span style={{ display: 'block', whiteSpace: 'nowrap' }}>
            <span className="ft-num" style={{ fontSize: 30 }}>
              77,800
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>원</span>
          </span>
        </div>
      </section>

      {/* 보조 카드 — 회색 면 + 왼쪽 6px 색 띠 */}
      <section style={{ margin: '24px 20px 0', display: 'grid', gap: 10 }}>
        {[
          ['2주 미루기', '10/27 발송으로', V3.mustard],
          ['일시정지', '다시 시작할 때까지', '#2F8F8B'],
        ].map(([t, sub, band]) => (
          <div
            key={t}
            style={{ padding: '14px 16px', borderRadius: V3Radius.sm, background: V3.soft, borderLeft: `6px solid ${band}` }}
          >
            <span style={{ display: 'block', fontSize: 18, fontWeight: 800 }}>{t}</span>
            <span style={{ fontSize: 14, color: V3.inkMute }}>{sub}</span>
          </div>
        ))}
      </section>

      {/* 버튼 — 주 버튼 먹색, 보조 버튼 먹선 */}
      <section style={{ margin: '24px 20px 0', display: 'grid', gap: 8 }}>
        <button
          type="button"
          style={{ height: 58, border: 0, borderRadius: V3Radius.sm, background: V3.ink, color: '#FFFFFF', fontSize: 17, fontWeight: 800 }}
        >
          정기배송 시작하기
        </button>
        <button
          type="button"
          style={{
            height: 56,
            border: `1.5px solid ${V3.ink}`,
            borderRadius: V3Radius.sm,
            background: '#FFFFFF',
            color: V3.ink,
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          레시피 고르기
        </button>
      </section>

      {/* 도장 그림자 카드(화면당 한 곳) — 흰 바탕 버전 */}
      <section
        style={{
          margin: '24px 20px 0',
          padding: 18,
          border: `2px solid ${V3.ink}`,
          boxShadow: V3Shadow.stamp,
          borderRadius: V3Radius.sm,
          background: V3.cream,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24 }}>도장판</h2>
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.55 }}>
          정기배송 결제 한 번에 도장 하나. 10칸을 채우면 보상을 드려요.
        </p>
      </section>

      {/* 오류 글자 */}
      <p style={{ margin: '20px 20px 0', fontSize: 15, fontWeight: 700, color: V3.sale }}>카드 번호를 다시 확인해 주세요</p>
    </div>
  )
}
