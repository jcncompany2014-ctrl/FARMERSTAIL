import { V3, V3FontWeight, V3FontSize } from '@/lib/design/tokens'

/**
 * 앱 홈 — 내 정보(dashboard_user_snapshot)를 못 불러왔을 때 (2026-09-26 출시 전 점검 7차).
 *
 * 예전엔 조회 실패를 '강아지 0마리'로 읽어 **구독 중인 고객에게** "첫 아이를 등록해주세요"를
 * 보였고, 카드 실패 배너도 사라졌다. 고객은 아이 정보가 지워진 줄 알거나 강아지를 새로
 * 등록했다(규칙1: 데이터 없음 ≠ 실패). 여기선 사실대로 말하고 다시 불러오게만 한다.
 *
 * 전체 새로고침(<a>) — 앱(Capacitor)엔 주소창·새로고침이 없어서 이 버튼이 유일한 길이다.
 */
export default function HomeLoadFailed() {
  return (
    <section style={{ padding: '0 20px 30px' }}>
      {/* 전체 새로고침이 목적이라 Link 가 아니라 a */}
      <a
        href="/dashboard"
        className="flex flex-col items-center text-center transition active:scale-[0.99]"
        style={{
          padding: '32px 20px',
          borderRadius: 4,
          border: `1.5px dashed ${V3.rule}`,
          textDecoration: 'none',
          color: V3.ink,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: V3FontSize.md,
            letterSpacing: '-0.02em',
            wordBreak: 'keep-all',
          }}
        >
          정보를 불러오지 못했어요
        </h2>
        <p
          style={{
            margin: '8px 0 16px',
            fontFamily: 'var(--font-sans)',
            fontSize: V3FontSize.base,
            color: V3.inkSoft,
            lineHeight: 1.5,
            maxWidth: 280,
            wordBreak: 'keep-all',
          }}
        >
          잠시 연결이 매끄럽지 않아요. 아이 정보와 정기배송은 그대로 있어요.
        </p>
        <span
          style={{
            background: V3.ink,
            color: V3.paperHi,
            borderRadius: 999,
            padding: '10px 18px',
            fontFamily: 'var(--font-sans)',
            fontSize: V3FontSize.sm,
            fontWeight: V3FontWeight.bold,
          }}
        >
          다시 불러오기
        </span>
      </a>
    </section>
  )
}
