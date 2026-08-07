import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/personalization-approval-timeout
 *
 * 매일 1회 실행 — pending_approval 상태이면서 proposed_at 이 5일 이상 지난
 * dog_formulas row 를 자동 'declined' 로 전환. 이전 cycle 의 applied_until
 * 을 +28일 연장 (declined 시 이전 처방 유지).
 *
 * # 흐름
 *  1. pending_approval AND proposed_at < now() - 5d 인 row 조회
 *  2. 각 row 마다:
 *     a. status='declined', approved_at=now()
 *     b. cycle_number-1 의 row 의 applied_until 을 +28d 연장
 *     c. (선택) push 알림 — "이전 비율 유지하기로 결정" — 보호자 confirmation
 *  3. 결과 카운트 반환
 *
 * # 보안
 *  - Vercel cron secret (CRON_SECRET) 검증
 *  - admin client (service_role) 사용 — RLS bypass
 *
 * # 일정
 *  매일 08:40 KST (UTC 23:40). 2026-07-30 에 03:00 → 08:40 으로 옮겼다.
 *  이 크론은 보호자에게 "이전 비율 유지하기로 결정" 푸시를 보내는데, 조용시간
 *  기본값(22–08)에 걸려 있어 그 알림이 영구히 안 나갔다. 08시 종료 직후로 옮겨
 *  **subscription-charge(09:10) 보다 먼저**라는 기존 순서도 유지한다.
 */
export async function GET(req: Request) {
  // 모든 환경에서 cron secret 강제 (timing-safe 비교).
  // dev 환경 우회는 위험 — production 만 거나는 게 더 안전.
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('personalization-approval-timeout', async () => {
    const supabase = createAdminClient()
    const fiveDaysAgo = new Date(
    Date.now() - 5 * 24 * 60 * 60 * 1000,
  ).toISOString()
  // 금액이 바뀌는 제안(몸무게·알레르기·건강, 구독페이지 모달)은 3일 안에 응답
  // 없으면 미동의(=이전 유지)로. 금액 변동 없는 일반 승인은 종전대로 5일.
  // (사장님 2026-07-23)
  const threeDaysAgo = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const now = new Date().toISOString()

  type PendingRow = {
    id: string
    dog_id: string
    user_id: string
    cycle_number: number
    proposed_at: string
    formula: {
      priceChange?: { from: number; to: number; forced: boolean }
    } | null
  }

  // 3일 경과분을 넓게 잡고, row 별 마감(강제 3일 / 일반 5일)으로 판정.
  const { data: pending, error: pendErr } = await supabase
    .from('dog_formulas')
    .select('id, dog_id, user_id, cycle_number, proposed_at, formula')
    .eq('approval_status', 'pending_approval')
    .lt('proposed_at', threeDaysAgo)
    .limit(200)

  if (pendErr) {
    console.error('[approval-timeout] fetch failed', pendErr)
    return NextResponse.json(
      { ok: false, error: pendErr.message },
      { status: 500 },
    )
  }

  const rows = (pending ?? []) as unknown as PendingRow[]
  let declined = 0
  let extended = 0
  let extendFailed = 0
  // 이번 회차에 손대지 않고 다음 실행으로 넘긴 건 — 안 세면 조용히 사라진다.
  let deferred = 0
  let failed = 0

  for (const row of rows) {
    try {
      // row 별 마감: 금액변경 제안(priceChange 표식·모달)=3일, 일반=5일. 3일
      // 경과분을 다 가져왔으니 모달건은 전부 대상, 일반은 5일 지난 것만 처리.
      const isModal = !!row.formula?.priceChange
      if (!isModal && row.proposed_at >= fiveDaysAgo) continue
      // ★최종감사 #5 (2026-07-29): 상담 필요 건은 타임아웃 처리하지 않는다.
      //   이 크론의 마감 처리 = "이전 식단 그대로 유지" 인데, 알레르기 누출
      //   케이스에선 이전 식단도 새로 선언된 알레르겐을 포함할 수 있다.
      //   게다가 고객에겐 이미 "결제 멈춰둘게요 · 상담" 푸시가 나갔는데 5일 뒤
      //   "이전 식단 유지할게요" 푸시가 겹치면 정면 모순이다. 구독은 누출 감지
      //   시점에 일시정지됐으므로 pending 으로 놔둬도 결제·배송은 안 나간다 —
      //   상담에서 사람이 풀어야 하는 건이다.
      if (
        (row.formula as { needsConsultation?: boolean } | null)
          ?.needsConsultation === true
      )
        continue
      // ★직전 회차를 **전환 전에** 읽는다(2026-08-07 재감사).
      //   전에는 declined 로 바꾼 뒤에 읽고, 실패하면 continue 했다. 그런데
      //   그 시점엔 이미 approval_status 가 'declined' 라 다음 실행의
      //   'pending_approval' 필터에 안 걸린다 → 일시적 DB 오류 한 번이면
      //   **직전 회차 +28일 연장이 영영 누락**되고(활성 처방 공백) 고객 푸시
      //   ("이전 식단 그대로 유지할게요")까지 건너뛴다. 수정 전에는 최소한
      //   푸시는 나갔으니, 어제 넣은 그 가드가 **새 유실을 만든 것**이었다.
      //   전환 전에 읽으면 실패해도 row 가 그대로라 다음 실행이 이어받는다.
      let prevRow: { id: string; applied_until: string | null } | null = null
      if (row.cycle_number > 1) {
        const { data: prev, error: prevErr } = await supabase
          .from('dog_formulas')
          .select('id, applied_until')
          .eq('dog_id', row.dog_id)
          .eq('cycle_number', row.cycle_number - 1)
          .maybeSingle()
        if (prevErr) {
          console.error(
            '[personalization-approval-timeout] 직전 회차 조회 실패 — 이번 회차 보류:',
            prevErr.message,
          )
          deferred += 1
          continue
        }
        prevRow = prev as unknown as { id: string; applied_until: string | null } | null
      }

      // 1) 본 row 를 declined 로 전환.
      //
      // ★CAS — pending_approval 인 행만 (2026-08-08 동시성 감사).
      //  이 크론(08:40)과 고객의 아침 승인 탭이 같은 시간대다. CAS 없이는
      //  고객이 **방금 승인한** 행을 여기가 declined 로 덮어, 새 금액과
      //  옛 레시피가 공존했다. 0행이면 고객이 이겼다 — 건너뛴다.
      const { data: declinedRows, error: updErr } = await supabase
        .from('dog_formulas')
        .update({
          approval_status: 'declined',
          approved_at: now,
        })
        .eq('id', row.id)
        .eq('approval_status', 'pending_approval')
        .select('id')
      if (updErr) throw updErr
      if (!declinedRows || declinedRows.length === 0) {
        // 그 사이 고객이 응답했다 — 마감할 것이 없다.
        continue
      }
      declined += 1

      // 2) 이전 cycle 의 applied_until 을 +28d 연장 (위에서 미리 읽어 둔 값).
      if (prevRow && prevRow.applied_until) {
        const newUntil = new Date(prevRow.applied_until)
        newUntil.setDate(newUntil.getDate() + 28)
        // ★error 를 받는다 (2026-08-08). 예전엔 안 받고 extended 를 올렸다 —
        //  본 row 는 이미 declined 라 다음 실행의 pending 필터에 안 걸리므로,
        //  연장이 실패하면 **영구 누락**(활성 처방 공백)인데 지표는 초록이었다.
        const { error: extErr } = await supabase
          .from('dog_formulas')
          .update({ applied_until: newUntil.toISOString().slice(0, 10) })
          .eq('id', prevRow.id)
        if (extErr) {
          console.error(
            '[approval-timeout] 이전 회차 연장 실패 — 활성 처방 공백 위험:',
            row.id,
            extErr.message,
          )
          extendFailed += 1
        } else {
          extended += 1
        }
      }

      // 3) push 알림 — "5일 무응답으로 이전 비율 유지" — 보호자 알림.
      try {
        const { pushToUser } = await import('@/lib/push')
        await pushToUser(
          row.user_id,
          {
            title: '이전 식단 그대로 유지할게요',
            body:
              // 금액변경 모달 건은 3일 마감이라고 안내했으므로 푸시도 3일로
              // 말해야 한다(최종감사 #33 — "3일이라더니 5일?" 신뢰 흠집 방지).
              `${isModal ? '3일' : '5일'} 동안 응답이 없어 지난번과 같은 맞춤 식단을 그대로 다음 박스에 적용해요. 알림 센터에서 확인할 수 있어요.`,
            url: `/dogs/${row.dog_id}/formulas`,
          },
          { category: 'order' },
        )
      } catch {
        // push 실패는 cron 흐름에 영향 X.
      }
    } catch (e) {
      console.error('[approval-timeout] row failed', row.id, e)
      failed += 1
    }
  }

    // 연장 실패는 활성 처방 공백 위험 — 5xx 로 올려 trackCron 이 error 로
    // 기록하고 사람이 본다(조용한 200 이면 영구 누락이 초록으로 위장한다).
    if (extendFailed > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'EXTEND_FAILED',
          message: `이전 회차 연장 실패 ${extendFailed}건 — 활성 처방 공백 위험`,
          pending: rows.length,
          declined,
          deferred,
          extended,
          extendFailed,
          failed,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      pending: rows.length,
      declined,
      deferred,
      extended,
      failed,
    })
  })
}
