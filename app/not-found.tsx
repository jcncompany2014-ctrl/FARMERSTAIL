import type { Metadata } from 'next'
import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'
import AppChrome from '@/components/AppChrome'
import AppNotFoundScreen from '@/components/v3/system/AppNotFoundScreen'
import { isAppContextServer } from '@/lib/app-context'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: { index: false, follow: false },
}

/**
 * 404 — 라우트 미일치 (farm v6 = FD 톤, 2026-06-13 회차9).
 *
 * 공유 ErrorScreen(components/ui/** — 직접 수정 금지) 의존을 떼고, FD 프리미티브로
 * 자체 구성한 chrome 비의존 중앙정렬 화면. app/web 양쪽에서 동일하게 동작하도록
 * WebChrome/AppChrome 을 강제하지 않음. CTA 는 설문 퍼널(/start)·홈(/), 커머스
 * 링크 제거. 큰 "404" 숫자 + 그린 eyebrow + 파인 헤드라인 + 코랄 pill.
 *
 * ★2026-10-09 앱 갈래 (앱 새 디자인 'A 포스터', 시안 B05) — 위 설명은 이제 **웹** 화면 얘기다.
 * 앱(네이티브·설치형 PWA)으로 온 요청이면 앱 틀(AppChrome: 윗줄 ← + 아래 탭) 안에 앱의 '없는 주소'
 * 화면(components/v3/system/AppNotFoundScreen — (main)/not-found 와 같은 화면)을 그린다. 예전엔 앱에서도
 * 이 웹 화면이 떴다 — 큰 404·영어 머리말에, 로그인한 앱 사용자를 비로그인 설문 퍼널(/start)로 보내는
 * CTA 까지((main)/not-found 주석의 바로 그 실수). 판정은 정본 isAppContextServer(쿠키·UA 표식).
 * 요청 헤더를 읽으므로 이 화면은 요청마다 그려진다. 2026-10-10 웹 리뉴얼: 웹 갈래 = 웹 시안 WEB-A29(새 웹 가게 틀, 길 안내는 가게로).
 */
export default async function NotFound() {
  if (await isAppContextServer()) {
    return (
      <AppChrome>
        <AppNotFoundScreen />
      </AppChrome>
    )
  }

  // 웹 = 웹 시안 WEB-A29(2026-10-10 웹 리뉴얼) — 새 웹 가게 틀. 길 안내는 가게로(웹 설문은 앱으로 옮겼다 — 기획서 D1).
  return (
    <StoreShell>
      <section style={{ padding: '48px 20px 72px', display: 'flex', flexDirection: 'column' }}>
        <span
          aria-hidden
          className="d"
          style={{ width: 72, height: 72, background: '#141414', color: '#FFFFFF', fontSize: 46, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ?
        </span>
        <h1 className="d" style={{ margin: '26px 0 0', fontSize: 42, lineHeight: 1.1 }}>
          길을 잃으셨나요?
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>주소가 바뀌었거나 사라진 페이지일 수 있어요. 아래에서 다시 시작해 보세요.</p>
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link
            href="/store"
            style={{ height: 60, borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 18, fontWeight: 800, textDecoration: 'none' }}
          >
            레시피 고르기
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link
            href="/"
            style={{ height: 58, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            홈으로
          </Link>
        </div>
        <p style={{ margin: '22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, color: '#595959' }}>
          다른 도움이 필요하신가요?
          <Link
            href="/contact"
            style={{ minHeight: 48, padding: '0 4px', display: 'flex', alignItems: 'center', fontWeight: 800, color: '#141414', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            고객센터 문의
          </Link>
        </p>
      </section>
    </StoreShell>
  )
}
