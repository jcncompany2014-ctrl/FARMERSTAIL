'use client'

/**
 * Phase 5 (2026-05-20): /admin/cohort 의 Recharts 시각화 컴포넌트.
 *
 * Server 컴포넌트 (page.tsx) 가 데이터 fetch + 집계 → client 가 차트만 렌더.
 * Recharts 는 SSR 호환되지만 ResponsiveContainer 가 useLayoutEffect 사용 →
 * 'use client' 명시.
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'

// 디자인 토큰 색상 (palette.css 와 같은 톤).
const COLORS = [
  '#C76A4E', // terracotta
  '#8BA05A', // moss
  '#E0B341', // mustard
  '#7A99B3', // dust blue
  '#A87BA0', // mauve
  '#B0A18E', // taupe
]

// ──────────────────────────────────────────────────────────────────
// 1. 환불·해지 사유 Pie
// ──────────────────────────────────────────────────────────────────

export function CohortReasonPie({
  data,
}: {
  data: Array<{ name: string; value: number }>
}) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="40%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            paddingAngle={2}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: '1px solid #E5DBC9',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 10.5 }}
            layout="vertical"
            verticalAlign="middle"
            align="right"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// 2. SKU별 별점 Bar
// ──────────────────────────────────────────────────────────────────

export function CohortSkuRatingBar({
  data,
}: {
  data: Array<{ sku: string; avg: number; n: number }>
}) {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 32, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="2 4" stroke="#E5DBC9" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 5]}
            tick={{ fontSize: 10.5, fill: '#8E8779' }}
            stroke="#E5DBC9"
          />
          <YAxis
            type="category"
            dataKey="sku"
            tick={{ fontSize: 10.5, fill: '#3D2F22', fontFamily: 'monospace' }}
            stroke="#E5DBC9"
            width={80}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: '1px solid #E5DBC9',
            }}
            // formatter 시그니처 타입이 까다로워 default 사용 — avg 와 n 둘 다 자동 표시.
          />
          <Bar dataKey="avg" fill="#C76A4E" radius={[0, 4, 4, 0]} name="평균 별점" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// 3. 시계열 12주 outcome 추이 Line
// ──────────────────────────────────────────────────────────────────

export function CohortTrendLine({
  data,
}: {
  data: Array<{ week: string; count: number; rating: number; ratingN: number }>
}) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#E5DBC9" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10.5, fill: '#8E8779' }}
            stroke="#E5DBC9"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10.5, fill: '#8E8779' }}
            stroke="#E5DBC9"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 5]}
            tick={{ fontSize: 10.5, fill: '#8E8779' }}
            stroke="#E5DBC9"
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: '1px solid #E5DBC9',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10.5 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="count"
            name="outcome 건수"
            stroke="#8BA05A"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="rating"
            name="별점 평균"
            stroke="#C76A4E"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
