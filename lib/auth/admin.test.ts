import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  isAdminByJwt,
  isAdmin,
  requireAdmin,
  AdminAuthError,
} from './admin.ts'

/**
 * lib/auth/admin.ts — admin 권한 체크 (보안 critical).
 *
 * 회귀 가드:
 *  - audit #62 self-elevation: user_metadata.role 절대 신뢰 X (app_metadata 만)
 *  - JWT 1차 + profiles 2차 fallback (defense in depth)
 *  - DB 에러 시 fail closed (admin 아님)
 *  - requireAdmin throw 패턴 — UNAUTHORIZED / FORBIDDEN 분리
 */

function makeUser(opts: {
  appRole?: string
  userRole?: string
  id?: string
}): User {
  return {
    id: opts.id ?? 'user-1',
    app_metadata: opts.appRole ? { role: opts.appRole } : {},
    user_metadata: opts.userRole ? { role: opts.userRole } : {},
  } as unknown as User
}

function makeMockClient(profilesRole?: string | null): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({
        data: { user: null as User | null },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              profilesRole !== undefined
                ? { role: profilesRole }
                : null,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

function makeMockClientWithError(): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { message: 'rls denied' },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

function makeMockClientWithUser(user: User | null): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('isAdminByJwt — app_metadata 만 (audit #62 self-elevation 차단)', () => {
  it('app_metadata.role === "admin" → true', () => {
    const user = makeUser({ appRole: 'admin' })
    assert.equal(isAdminByJwt(user), true)
  })

  it('app_metadata 없으면 → false', () => {
    const user = makeUser({})
    assert.equal(isAdminByJwt(user), false)
  })

  it('audit #62 회귀 가드 — user_metadata.role 만 admin 이면 → false', () => {
    // 사용자가 supabase.auth.updateUser({ data: { role: 'admin' } }) 로
    // self-elevate 시도. user_metadata 만 admin 이지 app_metadata 는 없음.
    const user = makeUser({ userRole: 'admin' })
    assert.equal(isAdminByJwt(user), false, 'self-elevation 차단 실패')
  })

  it('app_metadata.role 이 다른 값 (e.g., "user") → false', () => {
    const user = makeUser({ appRole: 'user' })
    assert.equal(isAdminByJwt(user), false)
  })

  it('null / undefined user → false', () => {
    assert.equal(isAdminByJwt(null), false)
    assert.equal(isAdminByJwt(undefined), false)
  })
})

describe('isAdmin — JWT 1차 + profiles 2차 fallback', () => {
  it('JWT admin → true (DB 안 봄)', async () => {
    const user = makeUser({ appRole: 'admin' })
    const supabase = makeMockClient(null) // profiles 가 null 이어도
    assert.equal(await isAdmin(supabase, user), true)
  })

  it('JWT non-admin + profiles.role=admin → true (fallback 경로)', async () => {
    const user = makeUser({}) // app_metadata 없음
    const supabase = makeMockClient('admin')
    assert.equal(await isAdmin(supabase, user), true)
  })

  it('JWT non-admin + profiles.role=user → false', async () => {
    const user = makeUser({ appRole: 'user' })
    const supabase = makeMockClient('user')
    assert.equal(await isAdmin(supabase, user), false)
  })

  it('JWT non-admin + profiles row 없음 → false', async () => {
    const user = makeUser({})
    const supabase = makeMockClient(null)
    assert.equal(await isAdmin(supabase, user), false)
  })

  it('null user → false', async () => {
    const supabase = makeMockClient(null)
    assert.equal(await isAdmin(supabase, null), false)
    assert.equal(await isAdmin(supabase, undefined), false)
  })

  it('DB 에러 시 fail closed (admin 아님)', async () => {
    const user = makeUser({})
    const supabase = makeMockClientWithError()
    assert.equal(await isAdmin(supabase, user), false)
  })

  it('회귀 가드: user_metadata.role=admin + app_metadata 없음 + profiles 없음 → false', async () => {
    // self-elevation 시도가 어디서도 통하지 않음
    const user = makeUser({ userRole: 'admin' })
    const supabase = makeMockClient(null)
    assert.equal(await isAdmin(supabase, user), false)
  })
})

describe('requireAdmin — throw 가드 패턴', () => {
  it('admin user → user 반환', async () => {
    const user = makeUser({ appRole: 'admin' })
    const supabase = makeMockClientWithUser(user)
    const result = await requireAdmin(supabase)
    assert.equal(result.id, 'user-1')
  })

  it('미로그인 → AdminAuthError("UNAUTHORIZED")', async () => {
    const supabase = makeMockClientWithUser(null)
    try {
      await requireAdmin(supabase)
      assert.fail('should throw')
    } catch (err) {
      assert.ok(err instanceof AdminAuthError)
      assert.equal(err.reason, 'UNAUTHORIZED')
      assert.match(err.message, /로그인/)
    }
  })

  it('로그인 + non-admin → AdminAuthError("FORBIDDEN")', async () => {
    const user = makeUser({})
    // getUser 는 user 반환, profiles fallback 도 admin 아님
    const supabase = {
      auth: {
        getUser: async () => ({ data: { user }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { role: 'user' },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient
    try {
      await requireAdmin(supabase)
      assert.fail('should throw')
    } catch (err) {
      assert.ok(err instanceof AdminAuthError)
      assert.equal(err.reason, 'FORBIDDEN')
      assert.match(err.message, /관리자/)
    }
  })
})

describe('AdminAuthError', () => {
  it('name = "AdminAuthError"', () => {
    const e = new AdminAuthError('FORBIDDEN', 'msg')
    assert.equal(e.name, 'AdminAuthError')
  })

  it('reason + message 보존', () => {
    const e = new AdminAuthError('UNAUTHORIZED', '로그인 필요')
    assert.equal(e.reason, 'UNAUTHORIZED')
    assert.equal(e.message, '로그인 필요')
  })

  it('Error instanceof', () => {
    const e = new AdminAuthError('FORBIDDEN', 'msg')
    assert.ok(e instanceof Error)
  })
})
