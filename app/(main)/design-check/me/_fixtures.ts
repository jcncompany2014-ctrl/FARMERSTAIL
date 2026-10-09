/**
 * /design-check/me 예시 값 — 묶음 ④ '내 정보' 화면(시안 T09·T10·M01~M22·I08·I12~I14·C01·C02)을 로그인 없이 그린다.
 *
 * 'use client' 파일이 아니라 일반 .ts 에 둔다 — 서버 페이지가 클라이언트 모듈의 배열을 가져오면 배열이 아니라
 * 참조가 온다(AGENT_BRIEF). 공개 캡처 규칙: 사람 이름 자리는 '보호자', 예시 강아지는 '땅콩'.
 */

import type { Address } from '@/lib/commerce/addresses'

/** [주소 키, 제목, 시안 보드] — 목록 화면과 촬영 이름표가 같이 쓴다. */
export const SCREENS: Array<[key: string, title: string, mock: string]> = [
  ['me', '내 정보', 'T09-MyInfo'],
  ['me-logout', '로그아웃 확인', 'T10-LogoutConfirm'],
  ['profile', '내 프로필', 'M01-Profile'],
  ['profile-social', '내 프로필 · 카카오 가입(비밀번호 카드 없음)', '—'],
  ['address-delete', '배송지 삭제 확인(공용 확인 창)', '—'],
  ['address-new', '새 배송지', 'M02-AddressNew'],
  ['address-edit', '배송지 수정', 'M03-AddressEdit'],
  ['address-search', '주소 검색 창', 'M04-AddressSearch'],
  ['membership', '멤버십', 'M05-Membership'],
  ['membership-pre', '멤버십 · 등급 전', 'I12-MembershipPre'],
  ['membership-tree', '멤버십 · 나무(등록증 입구)', '—'],
  ['certificate', '강아지 등록증', 'M06-Certificate'],
  ['alerts', '알림 · 받은 알림', 'M11-AlertsInbox'],
  ['alerts-settings', '알림 · 알림 설정', 'M12-AlertsSettings'],
  ['alerts-settings-fail', '알림 설정 · 불러오기 실패', 'I08-AlertsSettingsFail'],
  ['alerts-devices', '알림 설정 · 기기 목록(앱 + 웹)', '—'],
  ['alerts-consent', '알림 · 광고 수신', 'M13-AlertsConsent'],
  ['alerts-empty', '알림 · 비었을 때', 'M14-AlertsEmpty'],
  ['alerts-category-empty', '알림 · 고른 칸이 비었을 때', 'I13-AlertsCategoryEmpty'],
  ['privacy', '내 데이터', 'M15-Privacy'],
  ['delete', '회원 탈퇴', 'M16-Delete'],
  ['delete-ready', '회원 탈퇴 · 다 채움', 'M17-DeleteConfirm'],
  ['delete-open-order', '회원 탈퇴 · 진행 중 주문', '—'],
  ['cs', '1:1 문의', 'C01-CsThread'],
  ['cs-empty', '1:1 문의 · 비었을 때', 'C02-CsEmpty'],
]

/** 실제 공개 화면(로그인 없이 열림) — 점검 화면 대신 그 주소를 앱 쿠키로 그대로 찍는다. */
export const PUBLIC_SCREENS: Array<[path: string, title: string, mock: string]> = [
  ['/help', '고객센터', 'M18-Help'],
  ['/faq', '자주 묻는 질문', 'M19-Faq'],
  ['/business', '사업자 정보', 'M20-Business'],
  ['/legal', '약관 · 정책', 'M21-Legal'],
  ['/legal/terms', '이용약관', 'M22-Terms'],
]

// ── 내 정보(T09) · 프로필(M01) ──
export const ME_EMAIL = 'guardian@example.com'
export const ME_PROFILE = { name: '보호자', phone: '010-0000-0000', tier: 'sprout', stamp_count: 23 }
export const ME_ORDER_COUNT = 6
export const ME_SUB_COUNT = 2

export const ADDRESSES: Address[] = [
  {
    id: 'addr-home',
    label: '집',
    recipientName: '보호자',
    phone: '010-0000-0000',
    zip: '01234',
    address: '서울특별시 ○○구 ○○로 12',
    addressDetail: '○○아파트 101동 1001호',
    isDefault: true,
  },
  {
    id: 'addr-work',
    label: '회사',
    recipientName: '보호자',
    phone: '010-0000-0000',
    zip: '04567',
    address: '서울특별시 ○○구 ○○대로 34',
    addressDetail: '○○빌딩 5층',
    isDefault: false,
  },
]

// ── 멤버십(M05·I12) · 등록증(M06) ──
export const DOG_PHOTO = '/sheltie-snow-45.jpg'
export const DOG_ID = '3f9a1c2e-7b4d-4e21-9c55-0a1b2c3d4e5f'
export const MEMBERSHIP_DOGS = [{ id: DOG_ID, name: '땅콩', breed: '셰틀랜드 시프도그', photo_url: DOG_PHOTO }]
export const TIER_UPDATED_AT = '2026-09-12T01:00:00.000Z'
export const CERT_DOG = {
  id: DOG_ID,
  name: '땅콩',
  breed: '셰틀랜드 시프도그',
  birth_date: '2023-04-02',
  photo_url: DOG_PHOTO,
  created_at: '2026-02-02T03:00:00.000Z',
}
export const MEMBER_SINCE = '2026-02-02T03:00:00.000Z'

/** 주소 검색 창(M04) 뒤의 폼 — 별칭·받는 분·연락처만 채운 새 배송지. */
export const ADDRESS_DRAFT: Address = {
  id: 'addr-draft',
  label: '집',
  recipientName: '보호자',
  phone: '010-0000-0000',
  zip: '',
  address: '',
  addressDetail: '',
  isDefault: false,
}

// ── 알림(M11~M14·I08·I13) ──
type InboxRow = {
  id: string
  title: string
  body: string
  url: string | null
  category: string | null
  sent_count: number
  read_at: string | null
  sent_at: string
}

/** 받은 알림 6건(시안 M11 — 어제 1 · 이전 5). '어제'는 부르는 시각 기준으로 만든다(25시간 전). */
export function inboxRows(): InboxRow[] {
  const yesterday = new Date(Date.now() - 25 * 3_600_000).toISOString()
  const read = '2026-10-01T00:00:00.000Z'
  return [
    {
      id: 'n1',
      title: '땅콩이의 다음 영양 분석 시기예요',
      body: '지난 분석 후 6개월이 지났어요. 체중·활동량이 달라졌을 수 있어 다시 분석해 보시면 좋아요.',
      url: `/dogs/${DOG_ID}/analysis`,
      category: 'health',
      sent_count: 1,
      read_at: null,
      sent_at: yesterday,
    },
    {
      id: 'n2',
      title: '배송이 완료됐어요',
      body: '주문이 도착했어요. 맛있게 드시길 바라요!',
      url: '/mypage/orders',
      category: 'order',
      sent_count: 1,
      read_at: null,
      sent_at: '2026-09-30T03:00:00.000Z',
    },
    {
      id: 'n3',
      title: '배송이 시작됐어요',
      body: 'CJ대한통운 · 6012-3456-7890',
      url: '/mypage/orders',
      category: 'order',
      sent_count: 1,
      read_at: read,
      sent_at: '2026-09-29T03:00:00.000Z',
    },
    {
      id: 'n4',
      title: '배송이 시작됐어요',
      body: 'CJ대한통운 · 6012-3456-7891',
      url: '/mypage/orders',
      category: 'order',
      sent_count: 1,
      read_at: read,
      sent_at: '2026-09-29T02:00:00.000Z',
    },
    {
      id: 'n5',
      title: '결제가 완료됐어요',
      body: '77,800원 · 곧 박스를 준비할게요',
      url: '/mypage/orders',
      category: 'order',
      sent_count: 1,
      read_at: read,
      sent_at: '2026-09-26T03:00:00.000Z',
    },
    {
      id: 'n6',
      title: '결제가 완료됐어요',
      body: '36,400원 · 곧 박스를 준비할게요',
      url: '/mypage/orders',
      category: 'order',
      sent_count: 1,
      read_at: read,
      sent_at: '2026-09-26T02:00:00.000Z',
    },
  ]
}

export const CONSENT = {
  agree_email: true,
  agree_sms: false,
  agree_email_at: '2026-02-02T03:00:00.000Z',
  agree_sms_at: null,
  marketing_policy_version: '2026-01',
}

/** 기기 목록 예시 — 앱(아이폰) + 웹(크롬). */
export const NATIVE_DEVICES = [
  { id: 'nd1', platform: 'ios', device_id: 'device-preview', created_at: '2026-09-20T03:00:00.000Z' },
]
export const WEB_SUBS = [
  {
    id: 'ws1',
    endpoint: 'https://example.invalid/push/preview',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
    created_at: '2026-08-14T03:00:00.000Z',
  },
]

// ── 내 데이터(M15) ──
export const PRIVACY_COUNTS = [
  { label: 'dogs', count: 2 },
  { label: 'surveys', count: 2 },
  { label: 'analyses', count: 3 },
  { label: 'weight_logs', count: 18 },
  { label: 'health_logs', count: 41 },
  { label: 'dog_reminders', count: 3 },
  { label: 'addresses', count: 2 },
  { label: 'orders', count: 23 },
  { label: 'subscriptions', count: 2 },
  { label: 'consent_log', count: 1 },
]

// ── 회원 탈퇴(M16·M17) ──
export const DELETE_COUNTS = { orderCount: 23, dogCount: 2 }
export const OPEN_ORDERS = [{ id: 'o1', order_number: 'FT-20261006-0012', order_status: 'shipping' }]

// ── 1:1 문의(C01·C02) ──
export const CS_MESSAGES: Array<{ id: string; sender: 'admin' | 'user'; body: string; read_at: string | null; created_at: string }> = [
  {
    id: 'c1',
    sender: 'admin',
    body: '안녕하세요 보호자님, 파머스테일이에요. 땅콩이는 첫 박스 잘 먹고 있나요? 불편한 점이 있으면 편하게 답장 주세요.',
    read_at: '2026-10-06T05:20:00.000Z',
    created_at: '2026-10-06T05:10:00.000Z',
  },
  {
    id: 'c2',
    sender: 'user',
    body: '네, 잘 먹어요! 다음 박스는 언제 보내주시나요?',
    read_at: null,
    created_at: '2026-10-06T06:02:00.000Z',
  },
  {
    id: 'c3',
    sender: 'admin',
    body: '다음 박스는 10월 13일(화)에 보내드려요. 받으시는 날은 보통 발송 후 1~2일이에요.',
    read_at: '2026-10-06T06:20:00.000Z',
    created_at: '2026-10-06T06:15:00.000Z',
  },
]
