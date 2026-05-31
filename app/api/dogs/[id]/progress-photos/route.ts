import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { dbError } from '@/lib/api/errors'
import { signProgressPhotoUrl } from '@/lib/storage/progress-photos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /api/dogs/[id]/progress-photos — 시계열 진행 사진 (B-66 / P20).
 *
 * # POST — 사진 메타 등록
 *  body: { photoUrl, takenAt?, view?, note? }
 *  - photoUrl: storage path ({user_id}/{dog_id}/{photo_id}.{ext})
 *    클라이언트가 supabase.storage.upload 직접 후 path 만 보냄.
 *  - 서버는 dog ownership 검증 + dog_progress_photos insert.
 *
 * # GET — 시계열 목록 (최근 100건)
 *  signed URL 5분 첨부해서 반환.
 *  쿼리 파라미터 없음 (path id 사용).
 */

type Params = { params: Promise<{ id: string }> }

const zPhotoCreate = z.object({
  photoUrl: z.string().min(1).max(500),
  takenAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  view: z.enum(['side', 'front', 'top']).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export async function POST(req: Request, { params }: Params) {
  const { id: dogId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  const parsed = await parseRequest(req, zPhotoCreate)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  // dog 소유 검증 — RLS 도 통과시키지만 명시적.
  const { data: dog } = await supabase
    .from('dogs')
    .select('id')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '강아지를 찾을 수 없어요' },
      { status: 404 },
    )
  }

  // R98-C (D7): photoUrl(스토리지 path)이 본인 폴더 prefix 로 시작하는지 검증.
  // 이전엔 클라가 보낸 path 를 그대로 insert → 타인 폴더 path 를 자기 row 에
  // 기록해 갤러리 무결성 오염 + 향후 버킷 public 화/admin signing 시 IDOR 로
  // 승격 가능. 스토리지 RLS 가 read 를 막지만 write 무결성은 별개.
  if (!data.photoUrl.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { code: 'INVALID_PATH', message: '잘못된 사진 경로예요' },
      { status: 400 },
    )
  }

  const { data: inserted, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (r: Record<string, unknown>) => {
          select: (c: string) => {
            single: () => Promise<{ data: { id: string } | null; error: unknown }>
          }
        }
      }
    }
  )
    .from('dog_progress_photos')
    .insert({
      dog_id: dogId,
      user_id: user.id,
      photo_url: data.photoUrl,
      taken_at: data.takenAt ?? null,
      view: data.view ?? null,
      note: data.note ?? null,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return dbError(
      error as { message?: string },
      'progress_photos_create',
      '사진을 저장하지 못했어요',
    )
  }

  return NextResponse.json({ ok: true, id: inserted.id })
}

type PhotoRow = {
  id: string
  photo_url: string
  taken_at: string | null
  view: 'side' | 'front' | 'top' | null
  note: string | null
  created_at: string
}

export async function GET(_req: Request, { params }: Params) {
  const { id: dogId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            c: string,
            v: string,
          ) => {
            eq: (
              c: string,
              v: string,
            ) => {
              order: (
                c: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: PhotoRow[] | null
                  error: unknown
                }>
              }
            }
          }
        }
      }
    }
  )
    .from('dog_progress_photos')
    .select('id, photo_url, taken_at, view, note, created_at')
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('taken_at', { ascending: false })
    .limit(100)

  if (error) {
    return dbError(
      error as { message?: string },
      'progress_photos_list',
      '사진 목록을 불러오지 못했어요',
    )
  }

  // photo_url 이 storage path 이면 signed URL 로 변환. http(s):// 면 그대로
  // (외부 URL 케이스 호환 — 현재 X 지만 future-proof).
  const rows = data ?? []
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const isPath = !/^https?:\/\//.test(row.photo_url)
      const signedUrl = isPath
        ? await signProgressPhotoUrl(supabase, row.photo_url)
        : row.photo_url
      return {
        ...row,
        signed_url: signedUrl,
      }
    }),
  )

  return NextResponse.json({ ok: true, photos: enriched })
}
