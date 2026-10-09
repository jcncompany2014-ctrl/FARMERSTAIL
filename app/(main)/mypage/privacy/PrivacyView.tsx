/**
 * PrivacyView — /mypage/privacy(내 데이터) 의 그리는 부분 (2026-10-09 앱 새 디자인 'A 포스터', 시안 M15).
 *
 * 조회(항목별 개수·동의 단계)와 로그인 확인은 page.tsx 가 그대로 하고, 여기는 받은 값으로 그리기만 한다 —
 * 점검 화면(/design-check/me)이 예시 값으로 같은 화면을 그리려고 뺐다(로직 변경 없음).
 *
 * 개인정보보호법 제35조(열람) · 제36조(정정·삭제) · 제37조(처리정지) 화면 구성은 그대로:
 *   데이터 동의 단계 → 가지고 있는 내 정보(이 화면의 도장 그림자 한 곳 · 머스타드 면) → 전체 내려받기 →
 *   고치기·지우기 → 처리 멈추기·탈퇴 → 개인정보 보호책임자.
 */

import Link from 'next/link'
import { business } from '@/lib/business'
import ConsentLevelCard from '@/components/ConsentLevelCard'
import { V3, V3Radius } from '@/lib/design/tokens'
import { PlainTitle, SCREEN_ROOT, STAMP_CARD, SectionTitle, outlineButton } from '@/components/v3/me/MeParts'
import { SaveIcon } from '@/components/v3/me/MeIcons'

/** 항목 이름 — 표 이름 → 손님 말. */
export const TABLE_LABEL: Record<string, string> = {
  dogs: '반려견 프로필',
  surveys: '설문 응답',
  analyses: '영양 분석',
  weight_logs: '체중 기록',
  health_logs: '건강 기록',
  dog_reminders: '리마인더',
  addresses: '저장된 주소',
  orders: '주문 내역',
  subscriptions: '정기배송',
  reviews: '작성한 리뷰',
  consent_log: '광고 동의 이력',
}

const EDIT_LINKS = [
  // 견주 생일 입력은 폐기됐다(2026-06-27) — 프로필에서 고칠 수 있는 건 이름·전화·이메일.
  { href: '/account/profile', label: '프로필 수정 (이름·전화·이메일)' },
  { href: '/mypage/addresses', label: '저장된 배송지 관리' },
  { href: '/dogs', label: '반려견 정보 수정 / 삭제' },
  { href: '/mypage/consent', label: '광고 수신 동의 변경' },
  { href: '/mypage/notifications', label: '알림 설정 (푸시·이메일)' },
] as const

export default function PrivacyView({
  counts,
  consentLevel,
}: {
  counts: Array<{ label: string; count: number }>
  consentLevel: 1 | 2 | 3 | 4
}) {
  const totalRows = counts.reduce((s, c) => s + c.count, 0)

  return (
    <div style={SCREEN_ROOT}>
      <p style={{ margin: '20px 20px 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
        개인정보보호법 제35조에 따라 내 개인정보가 어떻게 쓰이는지 보고, 내려받고, 고치거나 지울 수 있어요.
      </p>

      {/* P13 — 단계적 동의 4단계 UI (B-92, B-94) */}
      <ConsentLevelCard initialLevel={consentLevel} />

      {/* 보유 항목 카운트 */}
      <section
        aria-labelledby="pv-have"
        style={{
          ...STAMP_CARD,
          margin: '30px 20px 0',
          padding: '16px 18px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: V3.mustard,
        }}
      >
        <PlainTitle id="pv-have" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span>가지고 있는 내 정보</span>
          <span style={{ whiteSpace: 'nowrap' }}>
            <span className="ft-num" style={{ fontSize: 30, lineHeight: 1 }}>
              {totalRows.toLocaleString()}
            </span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>건</span>
          </span>
        </PlainTitle>
        <ul
          style={{
            margin: 0,
            padding: '12px 0 0',
            borderTop: '1px solid rgba(20,20,20,0.2)',
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '8px 20px',
          }}
        >
          {counts.map((c) => (
            <li key={c.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 15 }}>
              <span>{TABLE_LABEL[c.label] ?? c.label}</span>
              <span style={{ fontWeight: 800 }}>{c.count}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 전체 내려받기 */}
      <section aria-labelledby="pv-dl" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionTitle id="pv-dl">전체 데이터 내려받기</SectionTitle>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
          내 정보를 파일 하나로 내려받을 수 있어요. 결제 토큰 같은 보안 항목은 자동으로 빠져요.
        </p>
        <a href="/api/privacy/export" download style={{ ...outlineButton(54, 16), marginTop: 2 }}>
          <SaveIcon size={18} strokeWidth={2.2} />
          파일로 받기
        </a>
        <span style={{ fontSize: 14, color: V3.inkMute }}>내려받기는 1분에 한 번만 할 수 있어요.</span>
      </section>

      {/* 정정 · 삭제 — 정보 편집 직링크 */}
      <section aria-labelledby="pv-fix" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle id="pv-fix">
          고치기·지우기 <Article>제36조</Article>
        </SectionTitle>
        <nav aria-label="내 정보 고치기" style={{ marginTop: 12, borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
            {EDIT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  minHeight: 56,
                  boxSizing: 'content-box',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: 16,
                  fontWeight: 800,
                  color: V3.ink,
                  textDecoration: 'none',
                }}
              >
                {link.label}
                <span aria-hidden>›</span>
              </Link>
            ))}
        </nav>
      </section>

      {/* 처리정지 / 탈퇴 */}
      <section aria-labelledby="pv-stop" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionTitle id="pv-stop">
          처리 멈추기·탈퇴 <Article>제37조</Article>
        </SectionTitle>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
          모든 데이터 처리를 멈추고 탈퇴하는 것까지 한 번에 할 수 있어요. 전자상거래법 제6조에 따라 거래 기록은 5년간
          보관돼요.
        </p>
        <Link
          href="/mypage/delete"
          style={{ ...outlineButton(54, 16), marginTop: 2, border: `1.5px solid ${V3.sale}`, color: V3.sale }}
        >
          탈퇴 절차로 이동
        </Link>
      </section>

      {/* 개인정보 보호책임자 */}
      <section
        aria-labelledby="pv-dpo"
        style={{
          margin: '32px 20px 0',
          padding: '16px 18px',
          borderRadius: V3Radius.sm,
          background: V3.soft,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <PlainTitle id="pv-dpo" size={16}>
          개인정보 보호책임자
        </PlainTitle>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          {business.privacyOfficer}
          <br />
          <a href={`mailto:${business.privacyOfficerEmail}`} style={{ fontWeight: 800, color: V3.ink, textDecoration: 'underline' }}>
            {business.privacyOfficerEmail}
          </a>
          {business.phone ? (
            <>
              {' · '}
              <span style={{ whiteSpace: 'nowrap' }}>{business.phone}</span>
            </>
          ) : null}
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: V3.inkMute }}>
          이 화면에서 해결되지 않는 요청(제3자 제공 내역, 가족이 세상을 떠났을 때의 처리, 분쟁 조정 등)은 책임자에게 바로
          연락해 주세요.
        </p>
      </section>
    </div>
  )
}

/** 섹션 제목 옆 조항 번호 — 본문 글꼴 15 회색(시안). */
function Article({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-sans), 'Pretendard Variable', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: V3.inkMute, letterSpacing: '-0.02em' }}>
      {children}
    </span>
  )
}
