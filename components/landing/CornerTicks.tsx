// Corner tick marks for image frames — reinforces the magazine/editorial feel.
// Pure presentation; no state. Safe to render from a server component.

export default function CornerTicks({
  color = 'rgba(61,43,31,0.35)',
}: {
  color?: string
}) {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: color,
    zIndex: 4,
  }
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          ...base,
          top: 6,
          left: 6,
          borderTop: '1px solid',
          borderLeft: '1px solid',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...base,
          top: 6,
          right: 6,
          borderTop: '1px solid',
          borderRight: '1px solid',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...base,
          bottom: 6,
          left: 6,
          borderBottom: '1px solid',
          borderLeft: '1px solid',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...base,
          bottom: 6,
          right: 6,
          borderBottom: '1px solid',
          borderRight: '1px solid',
        }}
      />
    </>
  )
}
