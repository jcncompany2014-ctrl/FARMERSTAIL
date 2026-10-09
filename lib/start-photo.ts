/**
 * 새 첫 화면 사진 단계(앱시안 결정 22번 · 2026-10-09 캔버스 Y5b·Y5c) — 가입 **전에** 고른 강아지 사진을 폰에 잠깐
 * 들고 있다가, 가입 뒤 강아지가 만들어지는 순간(createDogFromDraft) 올린다.
 *
 * # 왜 폰에(localStorage) 들고 있나
 * 가입 전이라 올릴 계정·강아지가 없다. 그리고 카카오·애플 가입은 다른 화면으로 나갔다 돌아오므로(OAuth)
 * 화면 메모리에 두면 사라진다 — 강아지 정보 초안(lib/autosignup-draft)과 같은 곳에 둔다.
 * 큰 원본을 그대로 담으면 저장 한도(약 5MB)를 넘을 수 있어, 긴 변 1080px · JPEG 로 줄여서 담는다(보통 200KB 안팎).
 *
 * # 실패해도 가입·강아지 생성은 막지 않는다
 * 사진은 건너뛸 수 있는 단계이고(결정 22) 가입 뒤 '정보 수정'에서 다시 올릴 수 있어, 저장·올리기 실패는 조용히
 * 넘기고 로그만 남긴다. 사진이 없는 강아지는 발바닥 자리로 보인다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadDogPhoto } from './dogPhotos'

const KEY = 'ft_start_photo'
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 강아지 정보 초안과 같은 7일
const MAX_SIDE = 1080
const QUALITY = 0.85

type Held = { v: 1; dataUrl: string; savedAt: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image-load-failed'))
    img.src = src
  })
}

/** 고른 파일 → 긴 변 1080px JPEG data URL. 그림이 아니면 던진다. */
export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image')
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no-canvas')
    // 투명 PNG 도 흰 바탕으로(JPEG 는 투명이 없다 — 검게 나오지 않게).
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', QUALITY)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 줄인 사진을 폰에 들고 있는다. 저장소가 꽉 찼거나 못 쓰면 false(화면엔 그대로 보이지만 가입 뒤 못 올린다). */
export function holdStartPhoto(dataUrl: string): boolean {
  try {
    const held: Held = { v: 1, dataUrl, savedAt: Date.now() }
    window.localStorage.setItem(KEY, JSON.stringify(held))
    return true
  } catch {
    return false
  }
}

/** 들고 있는 사진(7일 지난 건 버린다). */
export function readHeldStartPhoto(now: number = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<Held>
    if (v.v !== 1 || typeof v.dataUrl !== 'string' || !v.dataUrl.startsWith('data:image/') || typeof v.savedAt !== 'number') {
      window.localStorage.removeItem(KEY)
      return null
    }
    if (now - v.savedAt > TTL_MS) {
      window.localStorage.removeItem(KEY)
      return null
    }
    return v.dataUrl
  } catch {
    return null
  }
}

export function clearHeldStartPhoto(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',', 2)
  const mime = /data:([^;]+);base64/.exec(head ?? '')?.[1] ?? 'image/jpeg'
  const bin = atob(b64 ?? '')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type: mime })
}

/**
 * 가입 뒤 — 들고 있던 사진을 그 강아지 사진으로 올린다. 이미 사진이 있는 강아지는 덮지 않는다.
 * 성공·실패와 상관없이 들고 있던 사진은 지운다(같은 사진이 다른 강아지에 붙지 않게). 실패는 false + 로그.
 */
export async function uploadHeldStartPhoto(supabase: SupabaseClient, userId: string, dogId: string): Promise<boolean> {
  const dataUrl = readHeldStartPhoto()
  if (!dataUrl) return false
  clearHeldStartPhoto()
  try {
    const file = dataUrlToFile(dataUrl, 'start-photo.jpg')
    const { url } = await uploadDogPhoto(supabase, userId, dogId, file)
    const { error } = await supabase
      .from('dogs')
      .update({ photo_url: url })
      .eq('id', dogId)
      .eq('user_id', userId)
      .is('photo_url', null)
    if (error) {
      console.error('[start-photo] 사진 주소 저장 실패', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[start-photo] 사진 올리기 실패', e)
    return false
  }
}
