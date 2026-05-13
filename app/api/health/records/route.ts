import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/health/records — 의료 기록 추가.
 *
 * 입력 (zRecord):
 *   { dogId, visitDate?, diagnosis[], medications[], vetNotes?,
 *     weightKg?, source: 'manual'|'ocr', ocrConfidence? }
 *
 * MedicalRecordOcr 의 onConfirm 콜백이 source='ocr' 로 호출.
 * health 페이지의 수동 입력 폼이 source='manual' 로 호출.
 *
 * GET /api/health/records?dogId=... — 시계열 조회 (최근 50건).
 */

const zMedication = z.object({
  name: z.string().min(1).max(80),
  dosage: z.string().max(80).nullable().optional(),
  frequency: z.string().max(80).nullable().optional(),
})

const zRecord = z.object({
  dogId: z.string().uuid(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  diagnosis: z.array(z.string().max(120)).max(20).default([]),
  medications: z.array(zMedication).max(20).default([]),
  vetNotes: z.string().max(2000).nullable().optional(),
  weightKg: z
    .number()
    .min(0)
    .max(200)
    .nullable()
    .optional(),
  source: z.enum(['manual', 'ocr']).default('manual'),
  ocrConfidence: z.number().min(0).max(1).nullable().optional(),
})

export async function POST(req: Request) {
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

  const parsed = await parseRequest(req, zRecord)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  // 소유 검증 — RLS 도 통과시켜 주지만 명시적
  const { data: dog } = await supabase
    .from('dogs')
    .select('id')
    .eq('id', data.dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '강아지를 찾을 수 없어요' },
      { status: 404 },
    )
  }

  const { data: inserted, error } = await supabase
    .from('medical_records')
    .insert({
      dog_id: data.dogId,
      user_id: user.id,
      visit_date: data.visitDate ?? null,
      diagnosis: data.diagnosis,
      medications: data.medications,
      vet_notes: data.vetNotes ?? null,
      weight_kg: data.weightKg ?? null,
      source: data.source,
      ocr_confidence: data.ocrConfidence ?? null,
    })
    .select('id, created_at')
    .single()

  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, id: inserted.id })
}

export async function GET(req: Request) {
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

  const url = new URL(req.url)
  const dogId = url.searchParams.get('dogId')
  if (!dogId) {
    return NextResponse.json(
      { code: 'MISSING_DOG_ID', message: 'dogId 가 필요해요' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('medical_records')
    .select('*')
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, records: data ?? [] })
}
