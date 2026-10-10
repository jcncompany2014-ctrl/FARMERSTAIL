import type { Metadata } from 'next'
import Link from 'next/link'
import AppRequiredAutoRecover from '@/components/AppRequiredAutoRecover'
import StoreShell from '@/components/store/StoreShell'

export const metadata: Metadata = {
  title: '앱에서 사용 가능한 기능이에요',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ from?: string }>

/**
 * /app-required — 웹 사용자가 앱 전용 경로 (예: /dashboard, /dogs, /mypage/*)
 * 로 직접 진입했을 때 보이는 다운로드 유도 페이지.
 *
 * Middleware 가 ft_app 쿠키 없는 요청을 여기로 redirect 한다. `?from` 쿼리에
 * 원래 가려던 경로가 들어옴 — Universal Links / App Links 가 설정된 후엔 앱
 * 설치 + 첫 실행 시 이 경로로 deep-link 가능.
 *
 * 디자인: 웹 시안 WEB-A27(2026-10-10 웹 리뉴얼) — 새 웹 가게 틀, 강한 다운로드 CTA + 앱이 무엇을 주는지 짧게.
 */
/**
 * 스토어 URL — **두 앱 모두 출시됐으므로 코드에 박는다**(2026-09-08 사장님 제보:
 * "플레이스토어만 보이고 앱스토어가 없다").
 *
 * 예전엔 출시 전이라 env 로 두고 값이 없으면 배지를 숨겼는데, iOS 출시(9/5) 후
 * `NEXT_PUBLIC_IOS_APP_URL` 이 **프로덕션 env 에 없어서 앱스토어 배지만 계속
 * 빠져 있었다**. NEXT_PUBLIC_* 은 빌드 시점에 박히므로 env 를 넣어도 재배포
 * 전까지는 안 뜬다 — 출시된 앱의 주소는 바뀔 일이 없으니 이 의존을 없앤다.
 * env 가 있으면 그걸 우선(스테이징 등에서 덮어쓸 여지는 남김).
 */
const IOS_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL ?? 'https://apps.apple.com/kr/app/id6807279982'
const ANDROID_URL =
  process.env.NEXT_PUBLIC_ANDROID_APP_URL ??
  'https://play.google.com/store/apps/details?id=com.farmerstail.app'

export default async function AppRequiredPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { from } = await searchParams
  const fromLabel = from ? friendlyLabel(from) : null

  // 모양 = 웹 시안 WEB-A27(2026-10-10 웹 리뉴얼) — 새 웹 가게 틀. 검은 네모 표식 → 앱 전용 머리말(숲색 = 앱 세계) →
  //   큰 제목 → 숲색 띠(앱이 해 주는 일 세 줄 + 공식 스토어 배지) → 웹으로 계속하기.
  return (
    <StoreShell>
      {/* ★진짜 앱 사용자가 이 벽에 떨어진 경우(첫 실행·쿠키 만료) 자동 복구. 웹 사용자에겐 아무 일도 안 일어난다. */}
      <AppRequiredAutoRecover />
      <section style={{ padding: '40px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span aria-hidden style={{ width: 72, height: 72, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" />
          </svg>
        </span>
        <span style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#595959' }}>
          <span aria-hidden style={{ width: 8, height: 8, background: '#1D3B2F' }} />
          앱 전용 기능
        </span>
        <h1 className="d" style={{ margin: '10px 0 0', fontSize: 38, lineHeight: 1.15 }}>
          {fromLabel ? `${fromLabel}${eunNeun(fromLabel)}` : '이 기능은'}
          <br />
          앱에서 쓸 수 있어요
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
          매일의 케어 기록 · 정밀 영양 분석 · 건강 수첩 같은 도구는 파머스테일 앱에서만 제공돼요.
        </p>
        {/* 정기배송 관리는 웹 계정에서도 가능 (2026-06-27 /account/subscriptions 신설) —
            앱 설치 없이 해결하러 온 사용자를 막다른 길에 두지 않는다. */}
        {from?.startsWith('/mypage/subscriptions') && (
          <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.6, color: '#3D3D3D' }}>
            정기배송 관리는{' '}
            <Link href="/account/subscriptions" style={{ fontWeight: 800, color: '#141414', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              웹 계정에서도
            </Link>{' '}
            할 수 있어요.
          </p>
        )}
      </section>

      <section style={{ marginTop: 36, padding: '32px 20px 36px', background: '#1D3B2F', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: '1px solid rgba(255,255,255,0.25)', display: 'flex', flexDirection: 'column' }}>
          <Feature title="우리 아이 케어 기록" desc="식사·활동·체중을 한 번 입력하면 변화 그래프로 보여드려요." />
          <Feature title="배송일 자동 알림" desc="다음 정기배송이 출발하기 전에 알려드려요." />
          <Feature title="우리 아이 맞춤 매거진" desc="품종·나이에 맞는 영양 정보를 꾸준히 골라 드려요." />
        </ul>
        {/* ★공식 스토어 배지(2026-09-05 사장님: "공식 버튼 같은 걸로") — 가이드라인상 변형 금지, 이미지 그대로 링크만.
            구글 배지는 아트워크 안에 여백이 있어 같은 시각 높이가 되려면 애플보다 약 1.21배 높게(250/40 실측). */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <a href={IOS_URL} target="_blank" rel="noopener noreferrer" aria-label="App Store에서 받기" style={{ height: 60, borderRadius: 4, background: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badge-appstore-ko.svg" alt="App Store에서 다운로드" style={{ height: 40, width: 'auto', display: 'block' }} />
          </a>
          <a href={ANDROID_URL} target="_blank" rel="noopener noreferrer" aria-label="Google Play에서 받기" style={{ height: 60, borderRadius: 4, background: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badge-googleplay-ko.png" alt="Google Play에서 다운로드" style={{ height: 48, width: 'auto', display: 'block' }} />
          </a>
        </div>
      </section>

      {/* 웹으로 계속 — 앱 소개(/app) · 가게(웹은 단품 가게, 2026-10-10) */}
      <nav aria-label="웹에서 계속하기" style={{ padding: '28px 20px 64px', display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/app"
          style={{ minHeight: 60, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
        >
          앱이 뭘 하는지 미리 보기
          <Chevron />
        </Link>
        <Link
          href="/store"
          style={{ minHeight: 60, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, fontWeight: 700, color: '#3D3D3D', textDecoration: 'none' }}
        >
          웹에서 제품 둘러보기
          <Chevron />
        </Link>
      </nav>
    </StoreShell>
  )
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** 앱이 해 주는 일 한 줄(시안 A27) — 숲색 띠 위 흰 체크 · 굵은 이름 · 연한 설명. */
function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <li style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.25)', display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 10, alignItems: 'start' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A9C4B2" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 2 }}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ fontSize: 18, fontWeight: 800 }}>{title}</strong>
        <span style={{ fontSize: 16, lineHeight: 1.55, color: '#C9D6CD' }}>{desc}</span>
      </span>
    </li>
  )
}

/**
 * 한글 받침 유무로 "은/는" 조사 자동 결정. 한글이 아닌 단어로 끝나면 안전한
 * fallback "은" 반환. friendlyLabel 결과가 매번 다른 받침을 가지므로
 * "은(는)" 같은 양자 표기 대신 자연스러운 한 글자만 노출하는 데 사용.
 */
function eunNeun(word: string): '은' | '는' {
  if (!word) return '은'
  const code = word.charCodeAt(word.length - 1)
  // 한글 음절 범위 (가–힣) 밖이면 fallback
  if (code < 0xac00 || code > 0xd7a3) return '은'
  // (음절 - 가) % 28 === 0 → 받침 없음 → "는"
  return (code - 0xac00) % 28 === 0 ? '는' : '은'
}

function friendlyLabel(path: string): string | null {
  const clean = path.split('?')[0] ?? ''
  if (clean === '/dashboard') return '홈 대시보드'
  if (clean.startsWith('/dogs')) return '강아지 정보'
  if (clean === '/welcome') return '앱 시작 화면'
  if (clean.startsWith('/mypage/subscriptions')) return '정기배송 관리'
  if (clean.startsWith('/mypage/addresses')) return '배송지 관리'
  if (clean.startsWith('/mypage/notifications')) return '알림 설정'
  if (clean.startsWith('/mypage/consent')) return '동의 설정'
  if (clean.startsWith('/mypage/delete')) return '회원 탈퇴'
  return null
}
