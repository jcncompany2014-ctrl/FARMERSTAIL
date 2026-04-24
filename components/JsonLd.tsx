/**
 * 단일 JSON-LD `<script>` 를 안전하게 주입.
 *
 * App Router / RSC 환경에서는 next/script 가 없어도 `<script type="application/ld+json">`
 * 은 HTML 에 바로 직렬화된다. React 는 기본적으로 script 자식 텍스트를 이스케이프
 * 하므로 dangerouslySetInnerHTML 로 넣는다. 단, 값이 JSON-safe 인지 보장하기 위해
 * JSON.stringify 로만 직렬화 (Date 등 예외 객체는 사전에 string 화 필요).
 *
 * 보안: `</script` substring 을 `<\/script` 로 치환해 HTML injection 차단.
 */
export default function JsonLd({
  data,
  id,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown>>
  id?: string
}) {
  const json = JSON.stringify(data).replace(/<\/script/gi, '<\\/script')
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
