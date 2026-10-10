import { V3 } from '@/lib/design/tokens'

/**
 * 앱 홈 — 내 정보(dashboard_user_snapshot)를 못 불러왔을 때 (2026-09-26 출시 전 점검 7차).
 *
 * 예전엔 조회 실패를 '강아지 0마리'로 읽어 **구독 중인 고객에게** "첫 아이를 등록해주세요"를
 * 보였고, 카드 실패 배너도 사라졌다. 고객은 아이 정보가 지워진 줄 알거나 강아지를 새로
 * 등록했다(규칙1: 데이터 없음 ≠ 실패). 여기선 사실대로 말하고 다시 불러오게만 한다.
 *
 * 전체 새로고침(<a>) — 앱(Capacitor)엔 주소창·새로고침이 없어서 이 버튼이 유일한 길이다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 T06): 흰 카드 + 옅은 회색 테두리, 새로고침 아이콘,
 *   제목·한 줄, 테두리 버튼 "다시 불러오기".
 */
export default function HomeLoadFailed() {
  return (
    <section
      aria-labelledby="fail-title"
      style={{
        margin: '26px 20px 0',
        padding: '24px 20px 22px',
        border: `1.5px solid ${V3.rule}`,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        color: V3.ink,
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
        <path d="M4 3v5h5" />
        <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
        <path d="M20 21v-5h-5" />
      </svg>
      {/* 이 제목만 본문 글꼴 800(시안) — 앱 h2 기본은 제목 글꼴이라 직접 지정 */}
      <h2 id="fail-title" style={{ margin: '4px 0 0', fontSize: 21, fontWeight: 800, fontFamily: 'var(--font-sans)' }}>
        정보를 불러오지 못했어요
      </h2>
      <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: V3.inkSoft, wordBreak: 'keep-all' }}>
        잠시 연결이 매끄럽지 않아요. 아이 정보와 정기배송은 그대로 있어요.
      </p>
      {/* 전체 새로고침이 목적이라 Link 가 아니라 a */}
      <a
        href="/dashboard"
        style={{
          marginTop: 8,
          alignSelf: 'stretch',
          height: 56,
          borderRadius: 4,
          border: `1.5px solid ${V3.ink}`,
          background: '#FFFFFF',
          color: V3.ink,
          textDecoration: 'none',
          fontSize: 17,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        다시 불러오기
      </a>
    </section>
  )
}
