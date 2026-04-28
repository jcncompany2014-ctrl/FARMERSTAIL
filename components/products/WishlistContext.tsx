'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * WishlistContext — 페이지당 1회만 wishlists 를 fetch 해서 모든 ProductCard 가
 * 공유하도록 하는 provider.
 *
 * 이전: 각 WishlistButton 이 mount 시 auth.getUser() + wishlists SELECT 를
 *      개별 호출 → N+1 (12개 카드 = 24 req).
 * 지금: provider 가 단 한 번 user.id 가져오고, 한 번의 wishlists IN(...) 으로
 *      전체 set 을 받아 cache. 카드는 set.has(productId) 로 동기 read.
 *
 * 비로그인일 때는 skip (set 은 빈 채). 첫 toggle 시 /login 으로 redirect.
 */

type WishlistState = {
  ready: boolean
  /** 현재 wished 인 product_id set. 비로그인 / 미로드 상태에선 빈 set. */
  wishedIds: Set<string>
  /** 단일 product 의 wished 상태 토글. busy 중이면 noop. */
  toggle: (productId: string, productSlug: string) => Promise<void>
  /** 어떤 product 가 현재 toggle 진행 중인지 — disable 표시용. */
  isBusy: (productId: string) => boolean
}

const Ctx = createContext<WishlistState | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const [ready, setReady] = useState(false)
  const [wishedIds, setWishedIds] = useState<Set<string>>(new Set())
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const fetchedRef = useRef(false)

  // 1회만 fetch — 페이지 navigate 후에도 같은 provider 가 유지되면 재사용.
  // (provider 는 layout 위치에 두지 않고 WebChrome 안에 두면 navigation 동안
  //  자연스럽게 살아남음.)
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    let mounted = true
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) {
        setReady(true)
        return
      }
      const { data } = await supabase
        .from('wishlists')
        .select('product_id')
        .eq('user_id', user.id)
      if (!mounted) return
      setWishedIds(
        new Set(
          (data ?? []).map((r) => (r as { product_id: string }).product_id),
        ),
      )
      setReady(true)
    })()
    return () => {
      mounted = false
    }
  }, [])

  const isBusy = useCallback((id: string) => busyIds.has(id), [busyIds])

  const toggle = useCallback(
    async (productId: string, productSlug: string) => {
      if (busyIds.has(productId)) return
      const wasWished = wishedIds.has(productId)

      // Optimistic — 즉시 heart fill 반영. 실패 시 롤백.
      setWishedIds((s) => {
        const next = new Set(s)
        if (wasWished) next.delete(productId)
        else next.add(productId)
        return next
      })
      setBusyIds((s) => new Set(s).add(productId))

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          // 비로그인 — 낙관 적용 롤백 후 /login redirect.
          setWishedIds((s) => {
            const next = new Set(s)
            if (wasWished) next.add(productId)
            else next.delete(productId)
            return next
          })
          router.push(
            `/login?next=${encodeURIComponent(pathname || `/products/${productSlug}`)}`,
          )
          return
        }
        if (wasWished) {
          const { error } = await supabase
            .from('wishlists')
            .delete()
            .eq('user_id', user.id)
            .eq('product_id', productId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('wishlists')
            .insert({ user_id: user.id, product_id: productId })
          if (error) throw error
        }
      } catch {
        // 네트워크 / RLS 오류 시 롤백.
        setWishedIds((s) => {
          const next = new Set(s)
          if (wasWished) next.add(productId)
          else next.delete(productId)
          return next
        })
      } finally {
        setBusyIds((s) => {
          const next = new Set(s)
          next.delete(productId)
          return next
        })
      }
    },
    [busyIds, wishedIds, router, pathname],
  )

  const value = useMemo<WishlistState>(
    () => ({ ready, wishedIds, toggle, isBusy }),
    [ready, wishedIds, toggle, isBusy],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** WishlistButton / 다른 카드가 사용. provider 밖에서 호출하면 no-op state. */
export function useWishlist(): WishlistState {
  const v = useContext(Ctx)
  if (v) return v
  // Provider 가 없는 환경 (e.g. /admin) 에선 안전한 stub 반환.
  return {
    ready: true,
    wishedIds: new Set(),
    toggle: async () => {},
    isBusy: () => false,
  }
}
