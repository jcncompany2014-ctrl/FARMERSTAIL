import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { diaryPhotoPath } from './diary-photo.ts'

/**
 * 사진 일기 저장값 → 스토리지 경로 추출 (2026-08-19 5라운드 감사).
 * 신규(경로)·레거시(1년 signed URL) 둘 다 같은 경로를 내야 읽기 경로가 재서명한다.
 */
describe('diaryPhotoPath', () => {
  const path =
    'a5737a47-171b-47d9-aca0-591116b0b0e5/d237d513-5129-45c9-bbcd-b7ad3e906cdb/2026-07-23-9609b31f.webp'

  it('신규 저장값(경로)은 그대로 반환', () => {
    assert.equal(diaryPhotoPath(path), path)
  })

  it('★레거시 signed URL 에서 경로를 추출(토큰·쿼리 제거)', () => {
    const legacy =
      'https://adynmnrzffidoilnxutg.supabase.co/storage/v1/object/sign/dog-diary-photos/' +
      path +
      '?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def'
    assert.equal(diaryPhotoPath(legacy), path)
  })

  it('쿼리스트링 없는 URL 도 경로만', () => {
    const noQuery =
      'https://x.supabase.co/storage/v1/object/sign/dog-diary-photos/' + path
    assert.equal(diaryPhotoPath(noQuery), path)
  })

  it('빈 값·마커 없는 값은 입력 그대로(안전)', () => {
    assert.equal(diaryPhotoPath(''), '')
    assert.equal(diaryPhotoPath('weird-value'), 'weird-value')
  })
})
