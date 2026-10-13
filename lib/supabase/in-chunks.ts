/**
 * id 목록 조회(`.in('칸', ids)`)를 200개씩 나눠 묻는 공용 도우미 — 2026-10-13 점검(규칙190).
 *
 * # 왜
 * PostgREST 는 `.in()` 의 id 를 **주소(URL)에 그대로** 싣는다. uuid 하나가 36자라 id 가 약 390개를
 * 넘으면 요청 머리가 16KB 를 넘어 서버가 요청을 거절한다. 그때 오는 건 오류라서, 호출부가 오류를
 * '없음'으로 접으면(예: 포장 목록이 결제 주문을 못 찾음) 결제된 박스가 '보내지 마세요'로 뜬다.
 * 고객이 늘면 어느 날 갑자기 생기는 실패라 미리 나눈다.
 *
 * # 쓰는 법
 *   const r = await selectInChunks(ids, (chunk) =>
 *     admin.from('orders').select('id, subscription_id').in('subscription_id', chunk))
 *   if (r.error) ... // 한 묶음이라도 실패하면 전체를 실패로 돌려준다(부분 결과로 판정하지 않게).
 *
 * 묶음마다 정렬은 따로 된다 — 같은 키(예: subscription_id)로 나누면 한 키의 행은 한 묶음 안에만 있으므로
 * '키마다 첫 행' 같은 판정은 그대로 맞다. 전체 정렬이 필요하면 호출부가 합친 뒤 다시 정렬한다.
 *
 * `@/` 값 import 없음 — node 테스트(lib/supabase/in-chunks.test.ts)가 그대로 읽는다.
 */

/** 한 번에 묻는 id 수 — uuid 200개 ≈ 7.4KB 로 머리 한도(16KB)의 절반 아래. */
export const IN_CHUNK_SIZE = 200

/** 순서를 지키며 size 개씩 나눈다. 중복·빈 값은 호출부 몫(여기서 바꾸지 않는다). */
export function chunkIds<T>(ids: readonly T[], size: number = IN_CHUNK_SIZE): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new Error(`chunkIds: size 는 1 이상 정수여야 해요 (${size})`)
  const out: T[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

type ChunkResult<Row> = { data: Row[] | null; error: { message: string } | null }

/**
 * 묶음마다 `run(chunk)` 를 차례로 부르고 행을 합친다. 한 묶음이라도 오류면 `{ data: null, error }`.
 * id 가 없으면 조회 없이 빈 배열(오류 아님) — `.in('x', [])` 를 서버에 보내지 않는다.
 */
export async function selectInChunks<T, Row>(
  ids: readonly T[],
  run: (chunk: T[]) => PromiseLike<ChunkResult<Row>>,
  size: number = IN_CHUNK_SIZE,
): Promise<{ data: Row[]; error: null } | { data: null; error: { message: string } }> {
  const rows: Row[] = []
  for (const chunk of chunkIds(ids, size)) {
    const { data, error } = await run(chunk)
    if (error) return { data: null, error }
    if (data) rows.push(...data)
  }
  return { data: rows, error: null }
}
