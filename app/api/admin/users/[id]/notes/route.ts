import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { requireAdminUser, isUuid } from '../../_guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /api/admin/users/[id]/notes — 고객별 문의 기록(카톡·전화) 쓰기 (2026-10-14 C2, 규칙254).
 *
 *   POST   { body, notedOn?, followUpOn?, channel? }        — 새 기록
 *   PATCH  { noteId, body?, followUpOn?, done? }             — 고치기 · 처리 표시 · 다시 볼 날 바꾸기
 *   DELETE { noteId }                                         — 잘못 적은 기록 지우기
 *
 * admin_customer_notes 는 고객이 읽지도 쓰지도 못하는 표다(마이그 20261014220000). 쓰기는 관리자 확인 뒤 service_role 로,
 * 범위는 경로의 고객 id(`.eq('user_id', id)`)로 코드가 묶는다 — 다른 고객의 기록 id 를 넣어도 0행.
 * 어드민 홈 '할 일'이 follow_up_on <= 오늘 and not done 을 읽는다.
 */

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD')
const CHANNEL = z.enum(['kakao', 'phone', 'instagram', 'email', 'other'])

const zCreate = z.object({
  body: z.string().trim().min(1, '내용을 적어 주세요').max(2000),
  notedOn: DATE.optional(),
  followUpOn: DATE.nullable().optional(),
  channel: CHANNEL.optional(),
})

const zPatch = z
  .object({
    noteId: z.string().uuid(),
    body: z.string().trim().min(1).max(2000).optional(),
    followUpOn: DATE.nullable().optional(),
    done: z.boolean().optional(),
  })
  .refine((v) => v.body !== undefined || v.followUpOn !== undefined || v.done !== undefined, {
    message: '바꿀 내용이 없어요',
  })

const zDelete = z.object({ noteId: z.string().uuid() })

const NOTE_COLS = 'id, user_id, noted_on, channel, body, follow_up_on, done, done_at, created_at, updated_at'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ code: 'INVALID_USER' }, { status: 400 })
  const gate = await requireAdminUser()
  if (!gate.ok) return gate.response
  const parsed = await parseRequest(req, zCreate)
  if (!parsed.ok) return parsed.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_customer_notes')
    .insert({
      user_id: id,
      body: parsed.data.body,
      ...(parsed.data.notedOn ? { noted_on: parsed.data.notedOn } : {}),
      follow_up_on: parsed.data.followUpOn ?? null,
      channel: parsed.data.channel ?? 'kakao',
      created_by: gate.user.id,
    })
    .select(NOTE_COLS)
    .single()
  if (error || !data) {
    console.error('[admin/notes] 저장 실패', error?.message)
    return NextResponse.json({ code: 'DB_ERROR', message: '기록을 저장하지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, note: data })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ code: 'INVALID_USER' }, { status: 400 })
  const gate = await requireAdminUser()
  if (!gate.ok) return gate.response
  const parsed = await parseRequest(req, zPatch)
  if (!parsed.ok) return parsed.response

  const { noteId, body, followUpOn, done } = parsed.data
  const update: { body?: string; follow_up_on?: string | null; done?: boolean; done_at?: string | null } = {}
  if (body !== undefined) update.body = body
  if (followUpOn !== undefined) update.follow_up_on = followUpOn
  if (done !== undefined) {
    update.done = done
    update.done_at = done ? new Date().toISOString() : null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_customer_notes')
    .update(update)
    .eq('id', noteId)
    .eq('user_id', id)
    .select(NOTE_COLS)
  // 0행 = 이 고객의 기록이 아님(또는 이미 지워짐) — 오류와 가른다(규칙1).
  if (error) {
    console.error('[admin/notes] 수정 실패', error.message)
    return NextResponse.json({ code: 'DB_ERROR', message: '기록을 고치지 못했어요' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ code: 'NOT_FOUND', message: '이 고객의 기록을 찾지 못했어요' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, note: data[0] })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ code: 'INVALID_USER' }, { status: 400 })
  const gate = await requireAdminUser()
  if (!gate.ok) return gate.response
  const parsed = await parseRequest(req, zDelete)
  if (!parsed.ok) return parsed.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_customer_notes')
    .delete()
    .eq('id', parsed.data.noteId)
    .eq('user_id', id)
    .select('id')
  if (error) {
    console.error('[admin/notes] 삭제 실패', error.message)
    return NextResponse.json({ code: 'DB_ERROR', message: '기록을 지우지 못했어요' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ code: 'NOT_FOUND', message: '이 고객의 기록을 찾지 못했어요' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
