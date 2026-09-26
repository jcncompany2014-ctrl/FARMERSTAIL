import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 탈퇴(계정 삭제) 시 파기해야 하는 **유저 업로드 사진** 버킷.
 *
 * DB 는 /api/account/delete 가 hard-delete 하지만, 업로드 사진은 스토리지에 잔존해
 * 개인정보처리방침(§7 "복구·재생 불가 기술로 삭제" · §3/요약 "탈퇴 시 즉시 파기")과
 * 모순됐다(감사 #38). 이 목록의 버킷을 유저별로 파기한다.
 *
 * 4종 전부 경로 규칙이 **`{user_id}/…`** (owner RLS = `foldername(name)[1] = auth.uid()`):
 *   · dog-avatars          `{uid}/{dog}-{ts}.png` · 친구 업로드 `{uid}/photo-requests/{token}.{ext}`
 *   · dog-diary-photos     `{uid}/{dog}/{date}-{uuid}.webp`
 *   · dog_checkin_photos   `{uid}/{dog}/{cycle}-{cp}-{ts}.{ext}`
 *   · medical-records-images `{uid}/{dog}/{record}-{ext}`
 * (2026-09-26 이전 친구 업로드는 `photo-requests/{token}` — 탈퇴 라우트가 토큰으로 따로 지운다.)
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

const PAGE = 1000

/**
 * `${prefix}` 폴더 아래 **모든** 객체 경로를 재귀 수집.
 *
 * Supabase `list()` 는 한 단계만 반환하고 하위 폴더는 placeholder(id=null)로 온다.
 * diary/checkin/medical 은 `{uid}/{dog}/파일` 2단계라 폴더면 재귀해 파일까지 내려간다.
 * ★ 항상 넘겨받은 prefix 아래만 훑으므로 다른 유저 파일은 절대 못 만난다.
 *
 * ★2026-09-26 출시 전 점검 5차:
 *   · 목록 오류를 **던진다** — 예전엔 빈 배열로 접어 "지울 게 없음(성공)"이 됐고, 탈퇴한
 *     고객 사진이 통째로 남아도 부분 실패 경보(account.delete.storage_partial_failure)가 안 떴다.
 *   · 1,000개 넘는 폴더도 끝까지 — offset 으로 페이지를 넘긴다(예전엔 첫 1,000개만).
 */
async function collectPaths(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    const entries = data ?? []
    for (const entry of entries) {
      const full = `${prefix}/${entry.name}`
      if (entry.id === null) {
        // 폴더 → 재귀.
        out.push(...(await collectPaths(admin, bucket, full)))
      } else {
        out.push(full)
      }
    }
    if (entries.length < PAGE) break
  }
  return out
}

async function removePaths(
  admin: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<PurgeResult> {
  let removed = 0
  // remove()는 한 번에 여러 경로 가능하나 대량 방어로 배치.
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const { error } = await admin.storage.from(bucket).remove(batch)
    if (error) return { bucket, removed, error: error.message }
    removed += batch.length
  }
  return { bucket, removed }
}

/**
 * 한 버킷에서 prefix 아래 전부 파기. `filter` 로 파일 이름을 더 좁힐 수 있다
 * (예: dog-avatars 의 `{uid}/{dogId}-…` 만).
 */
export async function purgePrefix(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
  filter?: (path: string) => boolean,
): Promise<PurgeResult> {
  try {
    const all = await collectPaths(admin, bucket, prefix)
    return await removePaths(admin, bucket, filter ? all.filter(filter) : all)
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
    results.push(await purgePrefix(admin, bucket, userId))
  }
  return results
}

/**
 * 강아지 한 마리를 지운 뒤 그 강아지 사진을 파기 (2026-09-26 출시 전 점검 5차).
 * 예전엔 DB 행만 지워서 일기·체크인·진료기록 사진(진료 영수증엔 보호자 이름·연락처가
 * 찍힐 수 있다)과 프로필 사진이 탈퇴할 때까지 남았다.
 */
export async function purgeDogStorage(
  admin: SupabaseClient,
  userId: string,
  dogId: string,
): Promise<PurgeResult[]> {
  const results: PurgeResult[] = []
  // 프로필 사진: `{uid}/{dogId}-{ts}.{ext}` (폴더 아님)
  results.push(
    await purgePrefix(admin, 'dog-avatars', userId, (p) =>
      p.startsWith(`${userId}/${dogId}-`),
    ),
  )
  for (const bucket of ['dog-diary-photos', 'dog_checkin_photos', 'medical-records-images']) {
    results.push(await purgePrefix(admin, bucket, `${userId}/${dogId}`))
  }
  return results
}
