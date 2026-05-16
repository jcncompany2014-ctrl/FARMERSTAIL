import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MEDICAL_RECORDS_BUCKET,
  MEDICAL_RECORDS_SIGNED_URL_TTL_SEC,
  makeMedicalRecordPath,
  signMedicalRecordUrl,
} from './medical-records.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * audit #72: medical-records storage helper 테스트.
 */

describe('makeMedicalRecordPath', () => {
  it('user_id / dog_id / record_id 폴더 구조 + jpg ext default', () => {
    const path = makeMedicalRecordPath('u-1', 'd-2', 'r-3', 'image/jpeg')
    assert.equal(path, 'u-1/d-2/r-3.jpg')
  })

  it('image/png → png ext', () => {
    const path = makeMedicalRecordPath('u-1', 'd-2', 'r-3', 'image/png')
    assert.equal(path, 'u-1/d-2/r-3.png')
  })

  it('image/webp → webp ext', () => {
    const path = makeMedicalRecordPath('u-1', 'd-2', 'r-3', 'image/webp')
    assert.equal(path, 'u-1/d-2/r-3.webp')
  })

  it('unknown mime → jpg fallback', () => {
    const path = makeMedicalRecordPath('u-1', 'd-2', 'r-3', 'image/heic')
    assert.equal(path, 'u-1/d-2/r-3.jpg')
  })

  it('user_id 가 path 첫 segment — RLS 정책 호환', () => {
    // storage RLS: auth.uid()::text = (storage.foldername(name))[1]
    const path = makeMedicalRecordPath('owner-uuid', 'd', 'r', 'image/jpeg')
    const firstSegment = path.split('/')[0]
    assert.equal(firstSegment, 'owner-uuid')
  })
})

describe('MEDICAL_RECORDS_BUCKET / TTL', () => {
  it('bucket 이름 일관성', () => {
    assert.equal(MEDICAL_RECORDS_BUCKET, 'medical-records-images')
  })

  it('signed URL TTL = 5분 (300초)', () => {
    assert.equal(MEDICAL_RECORDS_SIGNED_URL_TTL_SEC, 300)
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

describe('signMedicalRecordUrl', () => {
  it('성공 시 signed URL 반환', async () => {
    const sb = makeMockStorage({
      signedUrl: 'https://example.com/signed?token=abc',
    })
    const url = await signMedicalRecordUrl(sb, 'u/d/r.jpg')
    assert.equal(url, 'https://example.com/signed?token=abc')
  })

  it('에러 시 null 반환 (호출처가 fallback 처리)', async () => {
    const sb = makeMockStorage({ error: { message: 'expired token' } })
    const url = await signMedicalRecordUrl(sb, 'u/d/r.jpg')
    assert.equal(url, null)
  })

  it('data 없으면 null', async () => {
    const sb = makeMockStorage({})
    const url = await signMedicalRecordUrl(sb, 'u/d/r.jpg')
    assert.equal(url, null)
  })
})
