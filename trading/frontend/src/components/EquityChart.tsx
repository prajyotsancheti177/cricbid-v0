import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EquityPoint } from '../lib/api'
import { fmtDateTime, fmtInr, fmtInrCompact } from '../lib/format'

interface Props {
  data: EquityPoint[]
  height?: number
  /** Baseline for up/down coloring; defaults to the first point's equity. */
  baseline?: number
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value?: number | string }>
  label?: string | number
}) {
  if (!active || !payload || !payload.length) return null
  const v = Number(payload[0].value)
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400">{fmtDateTime(String(label))}</div>
      <div className="mt-0.5 font-semibold text-slate-100">{fmtInr(v)}</div>
    </div>
  )
}

export function EquityChart({ data, height = 260, baseline }: Props) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500"
        style={{ height }}
      >
        No equity data yet
      </div>
    )
  }
  const base = baseline ?? data[0].equity
  const up = data[data.length - 1].equity >= base
  const color = up ? '#34d399' : '#f87171' // emerald-400 / red-400

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="at"
          tickFormatter={fmtDateTime}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={60}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={fmtInrCompact}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: '#475569', strokeDasharray: '3 3' }}
        />
        <Line
          type="monotone"
          dataKey="equity"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: '#0f172a', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
