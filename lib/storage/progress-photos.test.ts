import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROGRESS_PHOTOS_BUCKET,
  PROGRESS_PHOTOS_SIGNED_URL_TTL_SEC,
  makeProgressPhotoPath,
  signProgressPhotoUrl,
} from './progress-photos.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * B-66 / P20: 시계열 진행 사진 storage 헬퍼.
 *
 * medical-records 와 동일한 패턴이라 테스트 구조도 동일 — bucket 이름,
 * TTL, path 구조, signed URL 헬퍼.
 */

describe('makeProgressPhotoPath', () => {
  it('user_id / dog_id / photo_id 폴더 구조 + jpg ext default', () => {
    const path = makeProgressPhotoPath('u-1', 'd-2', 'p-3', 'image/jpeg')
    assert.equal(path, 'u-1/d-2/p-3.jpg')
  })

  it('image/png → png ext', () => {
    const path = makeProgressPhotoPath('u-1', 'd-2', 'p-3', 'image/png')
    assert.equal(path, 'u-1/d-2/p-3.png')
  })

  it('image/webp → webp ext', () => {
    const path = makeProgressPhotoPath('u-1', 'd-2', 'p-3', 'image/webp')
    assert.equal(path, 'u-1/d-2/p-3.webp')
  })

  it('unknown mime → jpg fallback', () => {
    const path = makeProgressPhotoPath('u-1', 'd-2', 'p-3', 'image/heic')
    assert.equal(path, 'u-1/d-2/p-3.jpg')
  })

  it('user_id 가 path 첫 segment — RLS 정책 호환', () => {
    // storage RLS: auth.uid()::text = (storage.foldername(name))[1]
    const path = makeProgressPhotoPath('owner-uuid', 'd', 'p', 'image/jpeg')
    const firstSegment = path.split('/')[0]
    assert.equal(firstSegment, 'owner-uuid')
  })
})

describe('PROGRESS_PHOTOS_BUCKET / TTL', () => {
  it('bucket 이름 일관성 — 마이그레이션 progress_photos', () => {
    assert.equal(PROGRESS_PHOTOS_BUCKET, 'progress_photos')
  })

  it('signed URL TTL = 5분 (300초) — PII 노출 윈도우 최소화', () => {
    assert.equal(PROGRESS_PHOTOS_SIGNED_URL_TTL_SEC, 300)
  })
})

function makeMockStorage(opts: {
  signedUrl?: string
  error?: { message: string } | null
}): SupabaseClient {
  return {
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: opts.signedUrl ? { signedUrl: opts.signedUrl } : null,
          error: opts.error ?? null,
        }),
      }),
    },
  } as unknown as SupabaseClient
}

describe('signProgressPhotoUrl', () => {
  it('성공 시 signed URL 반환', async () => {
    const sb = makeMockStorage({
      signedUrl: 'https://example.com/signed?token=abc',
    })
    const url = await signProgressPhotoUrl(sb, 'u/d/p.jpg')
    assert.equal(url, 'https://example.com/signed?token=abc')
  })

  it('에러 시 null 반환 (호출처가 fallback 처리)', async () => {
    const sb = makeMockStorage({ error: { message: 'expired token' } })
    const url = await signProgressPhotoUrl(sb, 'u/d/p.jpg')
    assert.equal(url, null)
  })

  it('data 없으면 null', async () => {
    const sb = makeMockStorage({})
    const url = await signProgressPhotoUrl(sb, 'u/d/p.jpg')
    assert.equal(url, null)
  })
})
