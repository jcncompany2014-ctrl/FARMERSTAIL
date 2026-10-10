/**
 * MeIcons — '내 정보' 화면 묶음(시안 T09·T10·M01~M22·I08·I12~I14·C01·C02)의 선 그림.
 *
 * 2026-10-09 앱 새 디자인('A 포스터'): 시안 원본 HTML 의 SVG 선(24 격자)을 그대로 옮겼다 — lucide 는 모양·굵기가
 * 시안과 조금씩 달라 나란히 비교하면 티가 난다(우리 아이 묶음의 DogIcons 와 같은 이유). 전부 장식(aria-hidden) —
 * 뜻은 옆 글자나 버튼의 aria-label 이 말한다. 훅이 없어 서버·클라이언트 어디서든 그려진다.
 */

import type { CSSProperties, ReactNode } from 'react'

export interface MeIconProps {
  size?: number
  /** 선 색 — 기본 currentColor(부모 글자색). */
  color?: string
  /** 선 굵기 — 시안마다 1.8~2.8. */
  strokeWidth?: number
  style?: CSSProperties
}

function Line({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  children,
}: MeIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      {children}
    </svg>
  )
}

/** 상자 — 정기배송·주문(T09 메뉴, 받은 알림 '주문'). */
export function BoxIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </Line>
  )
}

/** 꺾은선 — 건강 리포트. */
export function ChartIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15l4-4 3 3 5-6" />
    </Line>
  )
}

/** 왕관 — 멤버십 등급. */
export function CrownIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 17h16l1-10-5 4-4-6-4 6-5-4z" />
    </Line>
  )
}

/** 종 — 알림. */
export function BellIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 21h4" />
    </Line>
  )
}

/** 사선 그은 종 — 알림 끄기. */
export function BellOffIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M6 16.5V11a6 6 0 0 1 9.5-4.9M18 11v5.5l1.5 1.5H8M10 21h4M3 3l18 18" />
    </Line>
  )
}

/** 물음표 원 — 고객센터(T09). */
export function HelpIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01" />
    </Line>
  )
}

/** 물음표 원 — 자주 묻는 질문(M18·M21 의 조금 다른 선). */
export function QuestionIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6M12 17h.01" />
    </Line>
  )
}

/** 접힌 종이 — 자주 묻는 질문(T09 메뉴). */
export function DocIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </Line>
  )
}

/** 접힌 종이 — 이용약관(M18·M21). */
export function TermsIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h7" />
    </Line>
  )
}

/** 받침 위 아래 화살표 — 내 데이터(T09 메뉴). */
export function DataDownIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </Line>
  )
}

/** 아래 화살표 + 받침 — 이미지 저장·파일로 받기(M06·M15). */
export function SaveIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Line>
  )
}

/** 공유(점 셋). */
export function ShareIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" />
    </Line>
  )
}

/** 꺾쇠 › . */
export function ChevronRightIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M9 6l6 6-6 6" />
    </Line>
  )
}

/** 체크. */
export function CheckIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Line>
  )
}

/** 자물쇠 — 아직 못 오른 등급. */
export function LockIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Line>
  )
}

/** X — 닫기. */
export function XIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Line>
  )
}

/** 더하기 — 접힌 질문. */
export function PlusIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M12 5v14M5 12h14" />
    </Line>
  )
}

/** 빼기 — 펼친 질문. */
export function MinusIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M5 12h14" />
    </Line>
  )
}

/** 돋보기 — 주소 검색(M02). */
export function SearchIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Line>
  )
}

/** 연필 — 배송지 수정. */
export function PencilIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </Line>
  )
}

/** 휴지통 — 배송지 삭제(M01). */
export function TrashIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Line>
  )
}

/** 열쇠 — 비밀번호 재설정 메일. */
export function KeyIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2" />
    </Line>
  )
}

/** 하트 — 건강 알림·분기 리포트 혜택. */
export function HeartIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </Line>
  )
}

/** 잎 — 씨앗 혜택(시안 없음 · 같은 선 굵기로 그림). */
export function LeafIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <path d="M5 19l8-8" />
    </Line>
  )
}

/** 선물 — 열매 혜택(시안 없음). */
export function GiftIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
      <path d="M12 7c-1.5-3-5-3-5-1s3 1 5 1zM12 7c1.5-3 5-3 5-1s-3 1-5 1z" />
    </Line>
  )
}

/** 상장 — 등록증 혜택(시안 없음). */
export function AwardIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" />
    </Line>
  )
}

/** 표 — 할인 혜택(시안 없음). */
export function TicketIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z" />
      <path d="M14 6v12" />
    </Line>
  )
}

/** 확성기 — 받은 알림 '광고'(시안 없음). */
export function MegaphoneIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 10v4h3l6 4V6l-6 4z" />
      <path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />
    </Line>
  )
}

/** 종이비행기 — 테스트 알림·보내기. */
export function SendIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />
    </Line>
  )
}

/** 달 — 방해 금지 시간. */
export function MoonIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </Line>
  )
}

/** 휴대폰 — 등록된 기기(시안 없음). */
export function DeviceIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </Line>
  )
}

/** 돌아가는 화살표 — 다시 불러오기(I08). */
export function RefreshIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4.5h-4.5" />
    </Line>
  )
}

/** 봉투 — 이메일. */
export function MailIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3.5 6l8.5 7 8.5-7" />
    </Line>
  )
}

/** 네모 말풍선 — SMS·카카오톡(M13). */
export function ChatSquareIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 5h16v11H9l-5 4z" />
    </Line>
  )
}

/** 둥근 말풍선 — 카카오톡 문의(M18·M19). */
export function TalkIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M12 4C7 4 3 7.2 3 11.1c0 2.5 1.6 4.6 4 5.9L6.2 20.5l4.1-2.6c.6.1 1.1.1 1.7.1 5 0 9-3.2 9-7S17 4 12 4z" />
    </Line>
  )
}

/** 말풍선 — 1:1 문의 비었을 때(C02). */
export function ChatBubbleIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z" />
    </Line>
  )
}

/** 상자에서 나가는 화살표 — 앱 밖으로 열려요. */
export function ExternalIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Line>
  )
}

/** 수화기 — 전화 문의. */
export function PhoneIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
    </Line>
  )
}

/** 건물 — 사업자 정보. */
export function BuildingIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 20V5h10v15M14 9h6v11M7 8h4M7 12h4M7 16h4M2 20h20" />
    </Line>
  )
}

/** 방패 — 개인정보처리방침. */
export function ShieldIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
    </Line>
  )
}

/** 되돌리는 화살표 — 환불 정책. */
export function RefundIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" />
    </Line>
  )
}

/** 받은 편지함 — 받은 알림 비었을 때(M14). */
export function InboxIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M3 13l3-8h12l3 8v6H3z" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
    </Line>
  )
}

/** 세모 느낌표 — 회원 탈퇴 경고(M16). */
export function WarnIcon(p: MeIconProps) {
  return (
    <Line {...p}>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4.5M12 17.5v.5" />
    </Line>
  )
}

/** 채운 발바닥 — 강아지 사진이 없을 때(이모지 🐾 대신). 우리 아이 묶음과 같은 그림을 그대로 쓴다. */
export { PawFillIcon } from '../dog/DogIcons'
