import Link from 'next/link'
import { AlertTriangle, CalendarCheck, ChevronRight } from 'lucide-react'
import type { TodoDay, TodoItem, TodoTone, WeeklyTodo } from '@/lib/admin/weekly-todo'

/**
 * '이번 주 할 일' — 어드민 홈 맨 위 (2026-10-14 어드민 B2, 규칙249).
 *
 * 요일별(토 결제 → 월 포장 → 화 발송 → 늘 확인) 칸에 항목마다 숫자·한 줄·이름·'처리하러 가기'. 오늘 칸이 맨 앞.
 * 숫자는 lib/admin/weekly-todo 한 곳에서 나온다 — 아침 브리핑 푸시와 같은 함수(두 화면이 다른 말을 하지 않게).
 * 못 센 칸은 '못 셈'으로 빨갛게 — 0 으로 보이지 않는다(규칙1). 서버 컴포넌트(클라이언트 JS 없음 — 폰에서도 가볍게).
 *
 * 2026-10-24 어드민 2묶음(2-1): 홈의 '오늘 할 일' 덩어리. 오늘 칸만 펼치고, 할 게 없는 줄(0건·정상)은 숨기고, 할 게 없는
 * 요일 칸은 통째로 숨긴다. 다른 요일 칸은 접어 두되 손볼 것(빨강·노랑)이 있으면 펼친다 — 열두 덩어리를 매일 훑던 홈을 줄였다.
 * 색은 adminui 토큰(--adm-*)만 — bg-muted 금지(어드민에서 검은 점으로 렌더된다).
 */

const TONE_DOT: Record<TodoTone, string> = {
  ok: 'bg-emerald-500',
  info: 'bg-blue-500',
  warn: 'bg-amber-500',
  bad: 'bg-destructive',
}

const TONE_COUNT: Record<TodoTone, string> = {
  ok: 'text-muted-foreground',
  info: 'text-foreground',
  warn: 'text-amber-700',
  bad: 'text-destructive',
}

function mdOf(iso: string | null): string {
  if (!iso) return ''
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
}

/** 할 게 없는 줄 — 0건이고 정상이고 못 센 것도 아니다. 숨긴다(못 셈·0건 경고는 남긴다). */
function isIdle(it: TodoItem): boolean {
  return it.count === 0 && it.tone === 'ok' && !it.error
}

export default function WeeklyTodoPanel({ todo }: { todo: WeeklyTodo }) {
  // 오늘 칸을 맨 앞에(그다음은 원래 순서). '늘'은 언제나 마지막. 할 게 없는 줄은 빼고, 빈 요일 칸은 숨긴다(오늘 칸은 남긴다).
  const ordered: TodoDay[] = [
    ...todo.days.filter((d) => d.isToday),
    ...todo.days.filter((d) => !d.isToday && d.key !== 'always'),
    ...todo.days.filter((d) => d.key === 'always'),
  ]
    .map((d) => ({ ...d, items: d.items.filter((it) => !isIdle(it)) }))
    .filter((d) => d.isToday || d.items.length > 0)
  const attention = todo.days.flatMap((d) => d.items).filter((it) => it.tone === 'bad' || it.tone === 'warn').length

  return (
    <section aria-labelledby="weekly-todo-title" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="weekly-todo-title" className="flex items-center gap-1.5 text-[16px] font-bold">
            <CalendarCheck className="size-4 text-primary" strokeWidth={2.2} />
            오늘 할 일
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            이번 주 {mdOf(todo.saturday)}(토) 결제 → {mdOf(todo.monday)}(월) 포장 → {mdOf(todo.shipIso)}(화) 발송 · 아침 브리핑과 같은 숫자
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${
            attention > 0 ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {attention > 0 ? `손볼 것 ${attention}` : '급한 일 없음'}
        </span>
      </div>

      {todo.failures.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-destructive">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2.2} />
            {todo.failures.length}개 항목을 못 셌어요 — 0이어도 &lsquo;없음&rsquo;이 아닐 수 있어요
          </p>
          <ul className="mt-1 pl-[22px] text-[12px] leading-relaxed text-muted-foreground">
            {todo.failures.slice(0, 5).map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {ordered.map((day) => (
          <DayCard key={day.key} day={day} />
        ))}
      </div>
    </section>
  )
}

function DayCard({ day }: { day: TodoDay }) {
  const urgent = day.items.some((it) => it.tone === 'bad' || it.tone === 'warn' || it.count === null)
  return (
    <details
      open={day.isToday || urgent}
      className={`overflow-hidden rounded-xl border bg-card shadow-sm ${
        day.isToday ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border'
      }`}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
        <p className="text-[13px] font-bold">
          {day.label}
          {day.dateIso && <span className="ml-1.5 font-semibold text-muted-foreground">{mdOf(day.dateIso)}</span>}
        </p>
        {day.isToday ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[12px] font-bold text-primary-foreground">오늘</span>
        ) : (
          <span className="text-[12px] font-semibold text-muted-foreground">{day.items.length}가지</span>
        )}
      </summary>
      {day.items.length === 0 ? (
        <p className="px-4 py-3 text-[14px] text-muted-foreground">오늘은 할 일이 없어요.</p>
      ) : (
        <ul className="divide-y divide-border">
          {day.items.map((it) => (
            <TodoRow key={it.key} it={it} />
          ))}
        </ul>
      )}
    </details>
  )
}

function TodoRow({ it }: { it: TodoItem }) {
  const shown = it.lines.slice(0, 4)
  const more = it.lines.slice(4)
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_DOT[it.tone]}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[14px] font-bold leading-snug">{it.title}</p>
            <p className={`shrink-0 text-[18px] font-extrabold tabular-nums leading-none ${TONE_COUNT[it.tone]}`}>
              {it.count === null ? (
                <span className="text-[12px] font-bold text-destructive">못 셈</span>
              ) : (
                <>
                  {it.count}
                  <span className="ml-0.5 text-[12px] font-semibold text-muted-foreground">{it.unit}</span>
                </>
              )}
            </p>
          </div>
          {it.summary && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{it.summary}</p>}
          {it.error && <p className="mt-0.5 break-all text-[12px] text-destructive">불러오지 못했어요: {it.error}</p>}
          {shown.length > 0 && (
            <ul className="mt-1.5 grid gap-0.5">
              {shown.map((l, i) => (
                <LineRow key={`${l.text}-${i}`} text={l.text} href={l.href} />
              ))}
            </ul>
          )}
          {more.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[12px] font-semibold text-muted-foreground">{more.length}개 더 보기</summary>
              <ul className="mt-1 grid gap-0.5">
                {more.map((l, i) => (
                  <LineRow key={`${l.text}-m${i}`} text={l.text} href={l.href} />
                ))}
              </ul>
            </details>
          )}
          <Link
            href={it.href}
            className="mt-2 inline-flex min-h-9 items-center gap-0.5 rounded-md border border-border bg-card px-2.5 text-[13px] font-bold text-primary transition hover:bg-secondary"
          >
            {it.hrefLabel}
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </li>
  )
}

function LineRow({ text, href }: { text: string; href?: string }) {
  return (
    <li className="text-[13px] leading-snug">
      {href ? (
        <Link href={href} className="text-foreground underline decoration-border underline-offset-2 hover:decoration-primary">
          {text}
        </Link>
      ) : (
        <span className="text-foreground">{text}</span>
      )}
    </li>
  )
}
