/**
 * ProductLongDesc — PDP 하단의 긴 상세정보 섹션 (서버 컴포넌트).
 *
 * 마켓컬리식 "전체 상세" 패널 — 보관 / 원재료 / 알레르기 / 권장 급여량 / FAQ.
 * MVP 는 product.description 본문 + 정형화 표 (보관·재료·급여량) 로 구성.
 * 추후 admin 에 markdown long_description 컬럼이 도입되면 여기서 렌더 분기.
 */

import { Snowflake, Leaf, AlertTriangle, Scale } from 'lucide-react'

type Spec = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  value: string
}

export default function ProductLongDesc({
  description,
  category,
}: {
  description: string | null
  category: string | null
}) {
  // 카테고리별 default 표 데이터 — 추후 product 테이블에 컬럼 추가되면 prop 으로.
  const specs: Spec[] = [
    {
      icon: Snowflake,
      label: '보관 방법',
      value:
        category === '체험팩'
          ? '냉동 보관 · 해동 후 24시간 내 급여'
          : category === '간식'
            ? '실온 보관 · 개봉 후 30일 내'
            : '냉동 보관 · 해동 후 48시간 내 급여',
    },
    {
      icon: Leaf,
      label: '주재료',
      value: '국내산 농가 직송 · 사람 등급(human-grade) 재료만 사용',
    },
    {
      icon: AlertTriangle,
      label: '알레르기 안내',
      value: '알레르기가 있는 반려견은 원재료 표를 확인 후 급여해 주세요.',
    },
    {
      icon: Scale,
      label: '권장 급여량',
      value: '체중·연령에 따라 다르며, 자세한 가이드는 마이페이지에서.',
    },
  ]

  return (
    <section
      id="detail"
      className="ft-anchor-under-chrome px-5 md:px-6 mt-10 md:mt-14"
    >
      <div
        className="rounded-2xl px-5 py-6 md:px-8 md:py-10"
        style={{
          background: 'var(--bg-2)',
          boxShadow: 'inset 0 0 0 1px var(--rule)',
        }}
      >
        <div className="flex items-center gap-2 mb-5 md:mb-7">
          <span
            className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] uppercase"
            style={{ color: 'var(--muted)' }}
          >
            Detail · 상세정보
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>

        {/* 본문 */}
        {description && (
          <div
            className="text-[13px] md:text-[15px] leading-[1.85] whitespace-pre-line"
            style={{ color: 'var(--text)' }}
          >
            {description}
          </div>
        )}

        {/* 정형 spec 표 */}
        <dl className="mt-6 md:mt-10 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {specs.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="rounded-xl p-4 md:p-5 flex items-start gap-3 md:gap-4"
                style={{
                  background: 'var(--bg)',
                  boxShadow: 'inset 0 0 0 1px var(--rule)',
                }}
              >
                <span
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: 'var(--bg-2)',
                  }}
                >
                  <Icon
                    className="w-4 h-4 md:w-[18px] md:h-[18px]"
                    strokeWidth={1.8}
                  />
                </span>
                <div className="min-w-0">
                  <dt
                    className="font-mono text-[9.5px] md:text-[10.5px] tracking-[0.18em] uppercase mb-1"
                    style={{ color: 'var(--terracotta)' }}
                  >
                    {s.label}
                  </dt>
                  <dd
                    className="text-[12px] md:text-[14px] leading-relaxed"
                    style={{ color: 'var(--text)' }}
                  >
                    {s.value}
                  </dd>
                </div>
              </div>
            )
          })}
        </dl>

        <p
          className="mt-5 md:mt-7 text-[10.5px] md:text-[12px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          * 본 제품의 상세 영양 정보는 패키지 또는 마이페이지 → 정기배송 식단표에서
          확인할 수 있어요. 주재료의 정확한 원산지 / 농가는 시즌별로 변경될 수
          있으며, 항상 사람 등급 기준을 유지합니다.
        </p>
      </div>
    </section>
  )
}
