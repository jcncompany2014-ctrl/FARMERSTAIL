import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rowToAddress, type AddressRow } from '@/lib/commerce/addresses'
import AddressesClient from './AddressesClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '배송지 관리',
  robots: { index: false, follow: false },
}

/**
 * /mypage/addresses — 배송지 리스트.
 *
 * 톤: 다른 mypage 서브페이지(/wishlist, /orders 등) 와 동일.
 * - 상단에 "← 내 정보" 뒤로가기 + kicker + 한국어 제목
 * - 목록: 카드형, 기본 배송지는 상단 고정 + 배지
 * - 추가 CTA 는 리스트 맨 위에 (empty state 일 땐 중앙 empty 카드 안에)
 *
 * 상호작용(삭제/기본 설정/수정 이동) 은 client component 에 위임.
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
    <main className="pb-8">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 내 정보
        </Link>
        <span className="kicker mt-3 block">
          Addresses · 배송지 관리
        </span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          배송지 관리
        </h1>
        <p className="text-[11px] text-muted mt-1">
          {addresses.length > 0
            ? `${addresses.length}개 · 기본 배송지는 체크아웃에서 자동 선택됩니다`
            : '첫 배송지를 등록하면 체크아웃이 빨라져요'}
        </p>
      </section>

      {addresses.length === 0 ? (
        <section className="px-5 mt-6">
          <div
            className="rounded-2xl border px-6 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <MapPin
                className="w-6 h-6 text-terracotta"
                strokeWidth={1.5}
              />
            </div>
            <span className="kicker">Empty · 등록 없음</span>
            <h3
              className="font-serif mt-2"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              등록된 배송지가 없어요
            </h3>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              자주 쓰는 집·회사 주소를 저장해두면
              <br />
              체크아웃이 훨씬 빨라져요
            </p>
            <Link
              href="/mypage/addresses/new"
              className="mt-5 inline-flex items-center gap-1.5 px-6 py-2.5 text-[12px] font-bold rounded-full active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              배송지 추가
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="px-5 mt-3">
            <Link
              href="/mypage/addresses/new"
              className="flex items-center justify-center gap-1.5 py-3 w-full rounded-xl border text-[12.5px] font-bold active:scale-[0.99] transition"
              style={{
                background: 'var(--ink)',
                color: 'var(--bg)',
                borderColor: 'var(--ink)',
              }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              새 배송지 추가
            </Link>
          </section>
          <AddressesClient initial={addresses} />
        </>
      )}
    </main>
  )
}
