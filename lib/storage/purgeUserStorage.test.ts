import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { purgeUserStorage, USER_UPLOAD_BUCKETS } from './purgeUserStorage.ts'

/**
 * 계정 삭제 시 사진 파기 — **안전 핵심**은 "오직 {userId}/ 아래만 지운다"이다.
 * 남의 파일이 지워지면 재앙이라 mock 스토리지로 그 경계를 박제한다.
 */

type Store = Record<string, string[]>

function makeMockAdmin(store: Store) {
  const removed: Store = {}
  const listedPrefixes: string[] = []
  const storage = {
    from(bucket: string) {
      return {
        async list(prefix: string) {
          listedPrefixes.push(`${bucket}:${prefix}`)
          const all = store[bucket] ?? []
          const base = prefix ? `${prefix}/` : ''
          // 한 단계 children 만 — 폴더는 id=null placeholder, 파일은 id 존재(Supabase 동일).
          const seen = new Map<string, { name: string; id: string | null }>()
          for (const p of all) {
            if (!p.startsWith(base)) continue
            const rest = p.slice(base.length)
            const slash = rest.indexOf('/')
            if (slash === -1) seen.set(rest, { name: rest, id: `file-${rest}` })
            else {
              const folder = rest.slice(0, slash)
              if (!seen.has(folder)) seen.set(folder, { name: folder, id: null })
            }
          }
          return { data: [...seen.values()], error: null }
        },
        async remove(paths: string[]) {
          removed[bucket] = (removed[bucket] ?? []).concat(paths)
          store[bucket] = (store[bucket] ?? []).filter((p) => !paths.includes(p))
          return { error: null }
        },
      }
    },
  }
  return { admin: { storage } as unknown as SupabaseClient, removed, listedPrefixes }
}

const UID_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const UID_B = 'bbbbbbbb-0000-0000-0000-000000000002'

describe('purgeUserStorage — 탈퇴 사진 파기', () => {
  it('★{userId}/ 아래만 지우고 다른 유저 파일은 절대 안 건드린다', async () => {
    const store: Store = {
      'dog-avatars': [`${UID_A}/dog1-1.png`, `${UID_B}/dog9-1.png`],
      'dog-diary-photos': [
        `${UID_A}/dog1/2026-01-01-x.webp`,
        `${UID_A}/dog2/2026-02-02-y.webp`,
        `${UID_B}/dog9/2026-03-03-z.webp`,
      ],
      'dog_checkin_photos': [`${UID_A}/dog1/1-week_2-1.jpg`, `${UID_B}/dog9/1-week_2-9.jpg`],
      'medical-records-images': [`${UID_B}/dog9/rec-9.pdf`],
    }
    const { admin, removed } = makeMockAdmin(store)

    const results = await purgeUserStorage(admin, UID_A)

    // A 의 파일은 전부 제거(중첩 2단계 포함), B 는 하나도 안 지워짐.
    const allRemoved = Object.values(removed).flat()
    assert.deepEqual(
      allRemoved.sort(),
      [
        `${UID_A}/dog1-1.png`,
        `${UID_A}/dog1/1-week_2-1.jpg`,
        `${UID_A}/dog1/2026-01-01-x.webp`,
        `${UID_A}/dog2/2026-02-02-y.webp`,
      ].sort(),
    )
    // B 파일은 store 에 그대로 남아 있어야 한다.
    assert.ok(store['dog-avatars']!.includes(`${UID_B}/dog9-1.png`))
    assert.ok(store['dog_checkin_photos']!.includes(`${UID_B}/dog9/1-week_2-9.jpg`))
    assert.ok(store['medical-records-images']!.includes(`${UID_B}/dog9/rec-9.pdf`))
    // 결과 요약: A 가 파일 없는 버킷(medical)은 removed 0.
    const medical = results.find((r) => r.bucket === 'medical-records-images')
    assert.equal(medical?.removed, 0)
  })

  it('파일이 없으면 조용히 0건(에러 아님)', async () => {
    const { admin } = makeMockAdmin({})
    const results = await purgeUserStorage(admin, UID_A)
    assert.equal(results.length, USER_UPLOAD_BUCKETS.length)
    assert.ok(results.every((r) => r.removed === 0 && !r.error))
  })

  it('remove 실패는 던지지 않고 결과 error 로 보고', async () => {
    const store: Store = { 'dog-avatars': [`${UID_A}/dog1-1.png`] }
    const { admin } = makeMockAdmin(store)
    // dog-avatars remove 를 실패로 덮어쓰기.
    const origFrom = admin.storage.from.bind(admin.storage)
    ;(admin.storage as unknown as { from: unknown }).from = (bucket: string) => {
      const real = origFrom(bucket)
      if (bucket === 'dog-avatars') {
        return {
          ...real,
          async remove() {
            return { error: { message: 'boom' } }
          },
        }
      }
      return real
    }
    const results = await purgeUserStorage(admin, UID_A)
    const avatars = results.find((r) => r.bucket === 'dog-avatars')
    assert.equal(avatars?.error, 'boom')
  })
})
