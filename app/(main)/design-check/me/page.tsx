import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { V3 } from '@/lib/design/tokens'
import MypageClient from '../../mypage/MypageClient'
import MembershipView from '../../mypage/membership/MembershipView'
import CertificateClient from '../../mypage/certificate/[dogId]/CertificateClient'
import ProfileAppView from '@/components/v3/me/ProfileAppView'
import AddressForm from '../../mypage/addresses/AddressForm'
import AlertsClient from '../../notifications/AlertsClient'
import PrivacyView from '../../mypage/privacy/PrivacyView'
import DeleteAppView from '../../../mypage/delete/DeleteAppView'
import CsThreadClient from '../../mypage/cs/CsThreadClient'
import { AddressSearchDemo } from './MeDemos'
import {
  ADDRESS_DRAFT,
  ADDRESSES,
  CERT_DOG,
  CONSENT,
  CS_MESSAGES,
  DELETE_COUNTS,
  ME_EMAIL,
  ME_ORDER_COUNT,
  ME_PROFILE,
  ME_SUB_COUNT,
  MEMBER_SINCE,
  MEMBERSHIP_DOGS,
  NATIVE_DEVICES,
  OPEN_ORDERS,
  PRIVACY_COUNTS,
  PUBLIC_SCREENS,
  SCREENS,
  TIER_UPDATED_AT,
  WEB_SUBS,
  inboxRows,
} from './_fixtures'

/**
 * /design-check/me — 앱 새 디자인('A 포스터') 묶음 ④ '내 정보' 점검 화면 (2026-10-09).
 *
 * 실제 화면은 로그인해야 열려서, 실제와 같은 부품(MypageClient·…View·…Client)에 예시 값을 넣어 로그인 없이
 * 시안(캔버스 T09·T10·M01~M17·I08·I12~I14·C01·C02)과 나란히 본다. **실제 사이트(Vercel production)에선 404.**
 * 손님 화면이 아니라 문구·데이터는 예시다 — 버튼을 눌러도 로그인이 없어 저장되지 않는다.
 * 고객센터·FAQ·사업자 정보·약관(M18~M22)은 로그인 없이 열리는 공개 화면이라 그 주소를 앱 쿠키로 그대로 찍는다.
 *
 * 윗줄 제목은 이 주소의 것(AppChrome)이라 실제 화면과 다르다.
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 내 정보',
  robots: { index: false, follow: false },
}

export default async function DesignCheckMePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const sp = await searchParams
  const s = typeof sp.s === 'string' ? sp.s : ''

  switch (s) {
    case 'me':
    case 'me-logout':
      return (
        <MypageClient
          email={ME_EMAIL}
          profile={ME_PROFILE}
          orderCount={ME_ORDER_COUNT}
          subCount={ME_SUB_COUNT}
          emailSignup
          previewLogoutOpen={s === 'me-logout'}
        />
      )
    case 'membership':
      return <MembershipView stampCount={23} tier="sprout" tierUpdatedAt={TIER_UPDATED_AT} dogs={MEMBERSHIP_DOGS} />
    case 'membership-pre':
      return <MembershipView stampCount={3} tier={null} tierUpdatedAt={null} dogs={MEMBERSHIP_DOGS} />
    case 'membership-tree':
      return <MembershipView stampCount={52} tier="mate" tierUpdatedAt={TIER_UPDATED_AT} dogs={MEMBERSHIP_DOGS} />
    case 'certificate':
      return <CertificateClient dog={CERT_DOG} ownerName={ME_PROFILE.name} memberSince={MEMBER_SINCE} />
    case 'profile':
    case 'profile-social':
    case 'address-delete':
      return (
        <ProfileAppView
          profile={ME_PROFILE}
          email={ME_EMAIL}
          addresses={ADDRESSES}
          canResetPassword={s !== 'profile-social'}
        />
      )
    case 'address-new':
      return <AddressForm mode="create" />
    case 'address-edit':
      return <AddressForm mode="edit" initial={ADDRESSES[0]} />
    case 'address-search':
      return <AddressSearchDemo initial={ADDRESS_DRAFT} />
    case 'alerts':
    case 'alerts-category-empty':
    case 'alerts-empty':
    case 'alerts-settings':
    case 'alerts-settings-fail':
    case 'alerts-devices':
    case 'alerts-consent': {
      const tab = s.startsWith('alerts-settings') || s === 'alerts-devices' ? 'push' : s === 'alerts-consent' ? 'consent' : 'inbox'
      const devices = s === 'alerts-devices'
      return (
        <AlertsClient
          initialTab={tab}
          inboxRows={s === 'alerts-empty' ? [] : inboxRows()}
          pushSubs={devices ? WEB_SUBS : []}
          nativeDevices={devices ? NATIVE_DEVICES : []}
          vapidPublicKey={null}
          consentInitial={CONSENT}
          previewSettings="on"
        />
      )
    }
    case 'privacy':
      return <PrivacyView counts={PRIVACY_COUNTS} consentLevel={1} />
    case 'delete':
    case 'delete-ready':
    case 'delete-open-order':
      return (
        <DeleteAppView
          hasOpen={s === 'delete-open-order'}
          openOrders={s === 'delete-open-order' ? OPEN_ORDERS : []}
          orderCount={DELETE_COUNTS.orderCount}
          dogCount={DELETE_COUNTS.dogCount}
          previewFilled={s === 'delete-ready'}
        />
      )
    case 'cs':
      return <CsThreadClient initial={CS_MESSAGES} />
    case 'cs-empty':
      return <CsThreadClient initial={[]} />
    default:
      return <Index />
  }
}

function Index() {
  return (
    <div style={{ padding: '20px 20px 32px' }}>
      <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>디자인 점검 · 내 정보</h1>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: V3.inkMute, lineHeight: 1.5 }}>
        미리보기 전용 화면이에요. 실제 화면과 같은 부품에 예시 값을 넣었어요.
      </p>
      <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {SCREENS.map(([k, title, mock]) => (
          <li key={k}>
            <Link
              href={`/design-check/me?s=${k}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
                border: `1.5px solid ${V3.ink}`,
                borderRadius: 4,
                color: V3.ink,
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              <span>{title}</span>
              <span style={{ color: V3.inkMute, fontWeight: 500, fontSize: 14 }}>{mock}</span>
            </Link>
          </li>
        ))}
        {PUBLIC_SCREENS.map(([path, title, mock]) => (
          <li key={path}>
            <Link
              href={path}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
                border: `1.5px dashed ${V3.ink}`,
                borderRadius: 4,
                color: V3.ink,
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              <span>{title} (실제 화면)</span>
              <span style={{ color: V3.inkMute, fontWeight: 500, fontSize: 14 }}>{mock}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
