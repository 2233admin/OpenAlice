import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { EquityCurvePoint } from '../../api'

const RANGES = [
  { label: '1H', ms: 60 * 60 * 1000 },
  { label: '6H', ms: 6 * 60 * 60 * 1000 },
  { label: '24H', ms: 24 * 60 * 60 * 1000 },
  { label: '7D', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30D', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: 'All', ms: 0 },
] as const

interface EquityCurveProps {
  points: EquityCurvePoint[]
  accounts: Array<{ id: string; label: string }>
  selectedAccountId: string | 'all'
  onAccountChange: (id: string | 'all') => void
  onPointClick?: (point: EquityCurvePoint) => void
  selectedTimestamp?: string | null
}

export function EquityCurve({
  points, accounts, selectedAccountId, onAccountChange,
  onPointClick, selectedTimestamp,
}: EquityCurveProps) {
  const [range, setRange] = useState('24H')

  const filtered = useMemo(() => {
    const r = RANGES.find(r => r.label === range)
    if (!r || r.ms === 0) return points
    const cutoff = Date.now() - r.ms
    return points.filter(p => new Date(p.timestamp).getTime() >= cutoff)
  }, [points, range])

  const chartData = useMemo(() =>
    filtered.map(p => ({
      ...p,
      time: new Date(p.timestamp).getTime(),
      equityNum: Number(p.equity),
    })),
  [filtered])

  if (chartData.length === 0) return null

  const isAllView = selectedAccountId === 'all'

  return (
    <div className="border border-border rounded-lg bg-bg-secondary p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wide">
          Equity Curve
        </h3>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                range === r.label
                  ? 'bg-accent/20 text-accent font-medium'
                  : 'text-text-muted hover:text-text hover:bg-bg-tertiary'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {accounts.length > 1 && (
        <div className="flex gap-1 mb-3">
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => onAccountChange(a.id)}
              className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
                selectedAccountId === a.id
                  ? 'border-accent/40 bg-accent/10 text-accent font-medium'
                  : 'border-border text-text-muted hover:text-text hover:bg-bg-tertiary'
              }`}
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => onAccountChange('all')}
            className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
              isAllView
                ? 'border-accent/40 bg-accent/10 text-accent font-medium'
                : 'border-border text-text-muted hover:text-text hover:bg-bg-tertiary'
            }`}
          >
            All
          </button>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={chartData}
          onClick={(e: any) => {
            if (e?.activePayload?.[0]?.payload && onPointClick) {
              onPointClick(e.activePayload[0].payload as EquityCurvePoint)
            }
          }}
        >
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={70}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip isAllView={isAllView} accounts={accounts} />} />
          <Area
            type="monotone"
            dataKey="equityNum"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            fill="url(#equityGradient)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-accent)', stroke: 'var(--color-bg-secondary)', strokeWidth: 2 }}
          />
          {selectedTimestamp && (
            <ReferenceLine
              x={new Date(selectedTimestamp).getTime()}
              stroke="var(--color-accent)"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function CustomTooltip({ active, payload, isAllView, accounts }: any) {
  if (!active || !payload?.[0]) return null
  const data = payload[0].payload as EquityCurvePoint & { time: number }
  const accountMap = new Map((accounts as Array<{ id: string; label: string }>).map(a => [a.id, a.label]))

  return (
    <div className="bg-bg-secondary border border-border rounded-md px-3 py-2 shadow-lg text-[12px]">
      <p className="text-text-muted mb-1">
        {new Date(data.time).toLocaleString()}
      </p>
      <p className="text-text font-semibold tabular-nums">
        ${Number(data.equity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      {isAllView && data.accounts && Object.keys(data.accounts).length > 1 && (
        <div className="mt-1.5 pt-1.5 border-t border-border space-y-0.5">
          {Object.entries(data.accounts).map(([id, val]) => (
            <div key={id} className="flex justify-between gap-4">
              <span className="text-text-muted">{accountMap.get(id) ?? id}</span>
              <span className="text-text tabular-nums">
                ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toFixed(0)}`
}
