/**
 * 자사몰 결제 막음 안내 — 사장님 2026-10-11: "심사 신청하기 전까지 결제 부분은 회색으로 칠하고, 위에 초록색으로 스마트스토어
 * 바로가기 — 아직 자사몰 결제 준비 중이다, 단품은 스마트스토어를 이용해 달라".
 * 켜고 끄는 건 서버의 storeSalesPaused()(lib/store/toss-widget) 한 곳 — 화면은 받은 값(paused)만 따른다(규칙177).
 * 초록 = 네이버 초록, 글자는 검정 — 흰 글자는 대비가 2.3:1 이라 읽기 어렵다(카카오 노랑 버튼과 같은 방식).
 */
import { SMARTSTORE_URL } from '@/lib/links'

export const NAVER_GREEN = '#03C75A'

/** 막힌 버튼 — 자리·크기·글자는 그대로 두고 회색으로 칠한다(누를 수 없게 하는 건 disabled). */
export const PAUSED_BTN = { background: '#E5E5E5', color: '#9A9A9A', border: 0, cursor: 'not-allowed' } as const

export function SmartStoreButton({ height = 54 }: { height?: number }) {
  return (
    <a
      href={SMARTSTORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="네이버 스마트스토어 바로가기 (새 창)"
      style={{ height, borderRadius: 4, background: NAVER_GREEN, color: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 800, textDecoration: 'none' }}
    >
      스마트스토어 바로가기
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 17L17 7M9 7h8v8" />
      </svg>
    </a>
  )
}

/** 막힌 버튼들 바로 위에 놓는 안내. trial: 체험팩은 스마트스토어에 없다(자사몰에서만) — 그 말을 앞에 붙인다. */
export function PayPausedNotice({ trial = false }: { trial?: boolean }) {
  return (
    <div role="note" style={{ padding: 16, borderRadius: 4, border: `2px solid ${NAVER_GREEN}`, background: '#EEFAF3', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <strong style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35, color: '#141414' }}>자사몰 결제는 아직 준비 중이에요</strong>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: '#3D3D3D' }}>
        {trial && '체험팩은 자사몰 결제가 열리면 살 수 있어요. '}단품 구매는 네이버 스마트스토어를 이용해 주세요.
      </p>
      <div style={{ marginTop: 6 }}>
        <SmartStoreButton />
      </div>
    </div>
  )
}
