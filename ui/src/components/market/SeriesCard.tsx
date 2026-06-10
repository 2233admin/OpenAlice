import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import type { MacroSeriesCard } from '../../api/reference'

/**
 * One reference-data series card: label, latest value, delta vs previous
 * observation, sparkline. Shared by the Macro board and the MarketPage
 * valuation strip — both speak the MacroSeriesCard contract shape.
 */
export function SeriesCard({ card, label, emptyText }: { card: MacroSeriesCard; label: string; emptyText: string }) {
  const empty = card.points.length === 0
  return (
    <div className="border border-border rounded-md bg-bg-secondary/40 px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-text-muted truncate" title={card.id}>{label}</span>
        <span className="text-[10px] text-text-muted/50 shrink-0">{card.latestDate ?? ''}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[20px] font-semibold text-text font-mono">{fmtSeriesValue(card, card.latest)}</span>
          {card.change != null && card.change !== 0 && (
            <span className={`text-[11px] font-mono ${card.change > 0 ? 'text-green' : 'text-red'}`}>
              {card.change > 0 ? '+' : ''}{card.unit === 'count' ? fmtCompactNum(card.change) : card.change.toFixed(2)}
            </span>
          )}
        </div>
        <div className="w-28 h-9">
          {!empty && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={card.points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Line type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={1.25} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {empty && <span className="text-[11px] text-text-muted/60">{emptyText}</span>}
    </div>
  )
}

export function fmtSeriesValue(card: MacroSeriesCard, v: number | null): string {
  if (v == null) return '—'
  switch (card.unit) {
    case 'percent': return `${v.toFixed(2)}%`
    case 'usd': return `$${v.toFixed(2)}`
    case 'count': return fmtCompactNum(v)
    case 'index': return v.toFixed(1)
  }
}

export function fmtCompactNum(x: number, prefix = ''): string {
  const abs = Math.abs(x)
  if (abs >= 1e12) return `${prefix}${(x / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${prefix}${(x / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${prefix}${(x / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${prefix}${(x / 1e3).toFixed(1)}K`
  return `${prefix}${x.toFixed(0)}`
}
