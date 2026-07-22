import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 탈퇴(계정 삭제) 시 파기해야 하는 **유저 업로드 사진** 버킷.
 *
 * DB 는 /api/account/delete 가 hard-delete 하지만, 업로드 사진은 스토리지에 잔존해
 * 개인정보처리방침(§7 "복구·재생 불가 기술로 삭제" · §3/요약 "탈퇴 시 즉시 파기")과
 * 모순됐다(감사 #38). 이 목록의 버킷을 유저별로 파기한다.
 *
 * 4종 전부 경로 규칙이 **`{user_id}/…`** (owner RLS = `foldername(name)[1] = auth.uid()`):
 *   · dog-avatars          `{uid}/{dog}-{ts}.png`
 *   · dog-diary-photos     `{uid}/{dog}/{date}-{uuid}.webp`
 *   · dog_checkin_photos   `{uid}/{dog}/{cycle}-{cp}-{ts}.{ext}`
 *   · medical-records-images `{uid}/{dog}/{record}-{ext}`
 *
 * blog-covers·event-images·products 는 어드민 콘텐츠(유저 PII 아님) → 제외.
 * review-photos 는 리뷰가 보존 콘텐츠라 함께 두는 게 일관 → 제외(현재 리뷰 기능 축소).
 */
export const USER_UPLOAD_BUCKETS = [
  'dog-avatars',
  'dog-diary-photos',
  'dog_checkin_photos',
  'medical-records-images',
] as const

export type PurgeResult = { bucket: string; removed: number; error?: string }

/**
 * `${prefix}` 폴더 아래 **모든** 객체 경로를 재귀 수집.
 *
 * Supabase `list()` 는 한 단계만 반환하고 하위 폴더는 placeholder(id=null)로 온다.
 * diary/checkin/medical 은 `{uid}/{dog}/파일` 2단계라 폴더면 재귀해 파일까지 내려간다.
 * ★ 항상 넘겨받은 prefix(=`{userId}`) 아래만 훑으므로 다른 유저 파일은 절대 못 만난다.
 */
async function collectPaths(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const { data, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 })
  if (error || !data) return []
  const out: string[] = []
  for (const entry of data) {
    const full = `${prefix}/${entry.name}`
    if (entry.id === null) {
      // 폴더 → 재귀.
      out.push(...(await collectPaths(admin, bucket, full)))
    } else {
      out.push(full)
    }
  }
  return out
}

async function purgeBucket(
  admin: SupabaseClient,
  bucket: string,
  userId: string,
): Promise<PurgeResult> {
  try {
    const paths = await collectPaths(admin, bucket, userId)
    let removed = 0
    // remove()는 한 번에 여러 경로 가능하나 대량 방어로 배치.
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100)
      const { error } = await admin.storage.from(bucket).remove(batch)
      if (error) return { bucket, removed, error: error.message }
      removed += batch.length
    }
    return { bucket, removed }
  } catch (e) {
    return {
      bucket,
      removed: 0,
      error: e instanceof Error ? e.message : 'unknown',
    }
  }
}

/**
 * 한 유저의 업로드 사진을 전 버킷에서 파기(PIPA 즉시파기). 계정 삭제 라우트에서 호출.
 *
 * - service_role(admin) 클라이언트 필요.
 * - **던지지 않는다** — 버킷별 결과(제거 수·에러)를 반환해 호출부가 부분 실패를 로깅·후속.
 *   (DB 삭제와 마찬가지로 침묵 유실 방지.)
 * - 오직 `{userId}/` prefix 아래만 삭제 → 남의 파일 파기 불가능.
 */
export async function purgeUserStorage(
  admin: SupabaseClient,
  userId: string,
): Promise<PurgeResult[]> {
  const results: PurgeResult[] = []
  for (const bucket of USER_UPLOAD_BUCKETS) {
    results.push(await purgeBucket(admin, bucket, userId))
  }
  return results
}
