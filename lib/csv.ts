/**
 * Tiny RFC-4180 CSV writer.
 *
 * Excel (특히 한국 Windows 환경) 은 UTF-8 BOM 이 없으면 한글 cell 을 cp949 로
 * 해석해 깨진다. 그래서 파일 bytes 맨 앞에 0xEF 0xBB 0xBF 를 붙여서 반환.
 *
 * 왜 직접 작성하나
 * ─────────────
 *   - papaparse / fast-csv 는 번들 크기가 크거나 Node-only 모듈
 *   - 우리 시나리오는 수백 건 레벨의 admin export 뿐이라 streaming 불필요
 *   - 쉼표 · 따옴표 · 개행만 escape 하면 끝
 */

export type CsvRow = Record<string, unknown>

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : String(value)
  // RFC 4180 §2: 필드가 ", CR, LF, , 를 포함하면 쌍따옴표로 감싸고 " → "" 로.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(rows: CsvRow[], columns: string[]): string {
  const header = columns.map(escapeCell).join(',')
  const body = rows
    .map((row) => columns.map((col) => escapeCell(row[col])).join(','))
    .join('\r\n')
  return rows.length > 0 ? `${header}\r\n${body}` : header
}

/** Excel-safe UTF-8 — prepends BOM so 한글 doesn't corrupt on open. */
export function toCsvWithBom(rows: CsvRow[], columns: string[]): string {
  // \uFEFF is the Unicode BOM; when the browser/edge runtime encodes the
  // string as UTF-8, it emits the 3-byte EF BB BF sequence Excel needs.
  return `\uFEFF${toCsv(rows, columns)}`
}

/**
 * @deprecated Use {@link toCsvWithBom} + wrap in a Blob. Uint8Array return
 * tripped up `new Blob([...])` typings in strict TS (ArrayBufferLike vs
 * ArrayBuffer). Kept as re-export alias for existing callers.
 */
export function toCsvBuffer(rows: CsvRow[], columns: string[]): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(toCsvWithBom(rows, columns))
}
