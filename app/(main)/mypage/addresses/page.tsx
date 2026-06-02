import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rowToAddress, type AddressRow } from '@/lib/commerce/addresses'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'
import AddressesClient from './AddressesClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '배송지 관리',
  robots: { index: false, follow: false },
}

/**
 * /mypage/addresses — 배송지 리스트 (v3 reskin, 2026-05-22 R9-5).
 *
 * - 헤더: Mono kicker + sans 800 헤딩 + 카운트 hint
 * - 목록: AddressesClient (낙관적 update + 삭제/기본 설정)
 * - empty state: dashed 카드 + ink CTA
 */
export default async function AddressesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/addresses')

  const { data: rows } = await supabase
    .from('addresses')
    .select(
      'id, user_id, label, recipient_name, phone, zip, address, address_detail, is_default, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  const addresses = ((rows ?? []) as AddressRow[]).map(rowToAddress)

  return (
    <div style={{ paddingBottom: 32 }}>
      <section style={{ padding: '24px 20px 8px' }}>
        <Link
          href="/mypage"
          style={{
            fontSize: 10.5,
            fontWeight: V3FontWeight.semibold,
            color: V3.inkMute,
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 14,
          }}
        >
          ← 내 정보
        </Link>
        <Mono color="inkMute" size="xs" weight={500}>
          Addresses · 배송지
        </Mono>
        <h1
          style={{
            margin: '6px 0 0',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 28,
            lineHeight: 1,
            color: V3.ink,
            letterSpacing: V3LetterSpacing.heading,
          }}
        >
          배송지 관리
        </h1>
        <p
          style={{
            fontSize: 12,
            color: V3.inkMute,
            marginTop: 6,
          }}
        >
          {addresses.length > 0
            ? `${addresses.length}개 · 기본 배송지는 체크아웃에서 자동 선택됩니다`
            : '첫 배송지를 등록하면 체크아웃이 빨라져요'}
        </p>
      </section>

      {addresses.length === 0 ? (
        <section style={{ padding: '20px 20px 0' }}>
          <div
            className="text-center"
            style={{
              borderRadius: V3Radius.sm,
              border: `1.5px dashed ${V3.rule}`,
              padding: '48px 24px',
              background: V3.paperHi,
            }}
          >
            <div
              className="mx-auto flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                marginBottom: 14,
              }}
            >
              <MapPin size={24} color={V3.accent} strokeWidth={1.5} />
            </div>
            <Mono color="accent" size="xxs" weight={600}>
              Empty
            </Mono>
            <h3
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 18,
                color: V3.ink,
                letterSpacing: '-0.02em',
              }}
            >
              등록된 배송지가 없어요
            </h3>
            <p
              style={{
                fontSize: 12,
                color: V3.inkMute,
                marginTop: 8,
                lineHeight: 1.55,
              }}
            >
              자주 쓰는 집·회사 주소를 저장해두면
              <br />
              체크아웃이 훨씬 빨라져요
            </p>
            <Link
              href="/mypage/addresses/new"
              className="inline-flex items-center active:scale-[0.98] transition"
              style={{
                marginTop: 20,
                gap: 6,
                padding: '12px 22px',
                fontSize: 12,
                fontWeight: V3FontWeight.bold,
                borderRadius: V3Radius.pill,
                background: V3.ink,
                color: V3.paperHi,
                textDecoration: 'none',
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              배송지 추가
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section style={{ padding: '12px 20px 0' }}>
            <Link
              href="/mypage/addresses/new"
              className="flex items-center justify-center w-full active:scale-[0.98] transition"
              style={{
                gap: 6,
                padding: '12px 0',
                borderRadius: V3Radius.sm,
                border: `1px solid ${V3.ink}`,
                background: V3.ink,
                color: V3.paperHi,
                fontSize: 12,
                fontWeight: V3FontWeight.bold,
                textDecoration: 'none',
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              새 배송지 추가
            </Link>
          </section>
          <AddressesClient initial={addresses} />
        </>
      )}
    </div>
  )
}
