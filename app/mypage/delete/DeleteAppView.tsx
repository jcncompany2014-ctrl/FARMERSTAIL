/**
 * DeleteAppView — /mypage/delete(회원 탈퇴)의 **앱** 화면 (2026-10-09 앱 새 디자인 'A 포스터', 시안 M16 · M17).
 *
 * /mypage/delete 는 웹·앱이 같이 쓰는 주소다(개인정보처리방침이 이 경로로 링크한다 — page.tsx 머리말).
 * 웹 마크업은 page.tsx 에 그대로 두고(한 픽셀도 안 바뀜), 앱일 때만 이 화면을 그린다(AGENTS.md R14).
 * 조회(진행 중 주문·주문 수·강아지 수)는 page.tsx 가 그대로 하고 여기는 그리기만 한다.
 *
 * '탈퇴하면 이렇게 처리돼요' 카드(이 화면의 도장 그림자 한 곳)에 **'해지' 줄**을 더했다(앱시안 결정):
 * 탈퇴 API(app/api/account/delete)가 실제로 이 사람의 정기배송을 모두 status='cancelled' 로 바꾸고 카드 토큰
 * (billing_key)·다음 배송일을 지운다 — 돈을 먼저 멈춘 뒤 데이터를 지우는 순서(그 파일 2026-07-30 주석). 그래서
 * "진행 중인 정기배송도 함께 해지돼요"는 사실이다.
 * 없는 기능('찜'·'초대 코드'·'적립금'·'리뷰')은 지운다고 약속하지 않는다(2026-07-16 — 웹 마크업 주석과 같은 원칙).
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import DeleteAccountForm from './DeleteAccountForm'
import { V3, V3Radius } from '@/lib/design/tokens'
import { MeCss, PlainTitle, SCREEN_ROOT, STAMP_CARD, outlineButton } from '@/components/v3/me/MeParts'
import { WarnIcon } from '@/components/v3/me/MeIcons'

export default function DeleteAppView({
  hasOpen,
  openOrders,
  orderCount,
  dogCount,
  previewFilled,
}: {
  /** 진행 중 주문이 있나(조회 실패도 true — 모르면 막는다, page.tsx 규칙1 주석). */
  hasOpen: boolean
  openOrders: Array<{ id: string; order_number: string; order_status: string }>
  orderCount: number
  dogCount: number
  /** 점검 화면 전용 — 폼을 채운 상태로(시안 M17). */
  previewFilled?: boolean
}) {
  return (
    <div style={SCREEN_ROOT}>
      <MeCss />
      <p style={{ margin: '20px 20px 0', display: 'flex', gap: 10, fontSize: 16, lineHeight: 1.6, color: V3.ink }}>
        <WarnIcon size={22} color={V3.sale} strokeWidth={2.2} style={{ marginTop: 1 }} />
        <span>
          <strong style={{ fontWeight: 800 }}>탈퇴하면 계정을 되살릴 수 없어요.</strong> 아래 내용을 꼭 확인해 주세요.
        </span>
      </p>

      {/* 진행 중 주문이 있으면 차단 */}
      {hasOpen && (
        <section
          aria-labelledby="del-open"
          style={{
            margin: '20px 20px 0',
            padding: '16px 18px',
            borderRadius: V3Radius.sm,
            border: `1.5px solid ${V3.sale}`,
            background: 'rgba(198,61,42,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <PlainTitle id="del-open" style={{ color: V3.sale }}>
            진행 중인 주문이 있어요
          </PlainTitle>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
            배송이 진행 중인 주문이 있으면 탈퇴할 수 없어요. 배송 완료 후 다시 시도해 주세요.
          </p>
          {openOrders.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {openOrders.map((o) => (
                <li key={o.id} style={{ fontSize: 15 }}>
                  {o.order_number} ·{' '}
                  <span style={{ color: V3.inkMute }}>{o.order_status === 'preparing' ? '준비중' : '배송중'}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/mypage/orders" style={{ fontSize: 15, fontWeight: 800, color: V3.ink }}>
            주문 내역 보기 →
          </Link>
        </section>
      )}

      {/* 탈퇴 후 처리 안내 */}
      <section
        aria-labelledby="del-what"
        style={{
          ...STAMP_CARD,
          margin: '20px 20px 0',
          padding: '16px 18px 6px',
          display: 'flex',
          flexDirection: 'column',
          background: V3.mustard,
        }}
      >
        <PlainTitle id="del-what" style={{ margin: '0 0 6px' }}>
          탈퇴하면 이렇게 처리돼요
        </PlainTitle>
        <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
          <Row tag="삭제" dark>
            이름·연락처·주소, 반려견 프로필 <strong style={{ fontWeight: 800 }}>{dogCount}건</strong>, 알림 구독, 건강 일지·분석 기록
          </Row>
          <Row tag="보관">
            주문 내역 <strong style={{ fontWeight: 800 }}>{orderCount}건</strong>은 전자상거래법에 따라 5년 동안 이름 없이 보관돼요
          </Row>
          <Row tag="차단">같은 계정으로 로그인할 수 없어요. 다시 가입하면 새 계정이 만들어져요.</Row>
          <Row tag="해지">
            진행 중인 <strong style={{ fontWeight: 800 }}>정기배송도 함께 해지돼요</strong>
          </Row>
        </dl>
      </section>

      {!hasOpen && <DeleteAccountForm variant="app" previewFilled={previewFilled} />}

      {hasOpen && (
        <div style={{ margin: '32px 20px 0' }}>
          <Link href="/mypage" style={{ ...outlineButton(56, 17), width: '100%' }}>
            돌아가기
          </Link>
        </div>
      )}
    </div>
  )
}

function Row({ tag, dark, children }: { tag: string; dark?: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        padding: '12px 0',
        borderTop: '1px solid rgba(20,20,20,0.2)',
        display: 'grid',
        gridTemplateColumns: '52px 1fr',
        columnGap: 10,
      }}
    >
      <dt>
        <span
          style={{
            height: 26,
            padding: '0 8px',
            borderRadius: V3Radius.sm,
            background: dark ? V3.ink : 'rgba(255,255,255,0.5)',
            color: dark ? '#FFFFFF' : V3.ink,
            fontSize: 13,
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {tag}
        </span>
      </dt>
      <dd style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{children}</dd>
    </div>
  )
}
