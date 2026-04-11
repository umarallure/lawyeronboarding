import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

export interface TrendDataPoint {
  day: string;
  total: number;
  marketing: number;
  portal: number;
}

export interface AnalyticsTrendCardProps {
  data: TrendDataPoint[];
  title?: string;
  subtitle?: string;
  animationDelay?: number;
}

/* ── Custom tooltip ── */

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const SERIES_META: Record<string, { label: string; color: string }> = {
    total: { label: 'Total Opportunities', color: '#AE4010' },
    marketing: { label: 'Marketing Pipeline', color: '#4A90D9' },
    portal: { label: 'Lawyer Portal Pipeline', color: '#3A9D5C' },
  };

  return (
    <div className="rounded-lg border border-[var(--dash-border)] bg-[#1A1A1A] px-3 py-2.5 shadow-lg backdrop-blur-md">
      <p className="mb-1.5 text-[11px] font-medium text-[var(--dash-text-muted)]">
        {label}
      </p>
      {payload.map((entry) => {
        const meta = SERIES_META[entry.dataKey as string];
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: meta?.color ?? entry.color }}
            />
            <span className="text-[11px] text-[var(--dash-text-muted)]">
              {meta?.label ?? entry.dataKey}
            </span>
            <span className="ml-auto pl-3 text-[12px] font-semibold text-[var(--dash-text)]">
              {entry.value?.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsTrendCard({
  data,
  title = 'Onboarding Trends',
  subtitle = 'Daily opportunity flow by pipeline',
  animationDelay = 0,
}: AnalyticsTrendCardProps) {
  /* Compute growth badge: compare last half to first half */
  const growth = useMemo(() => {
    if (data.length < 2) return null;
    const mid = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, mid).reduce((s, d) => s + d.total, 0) || 1;
    const secondHalf = data.slice(mid).reduce((s, d) => s + d.total, 0);
    const pct = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
    return pct;
  }, [data]);

  return (
    <div
      className="dash-animate-in flex flex-col overflow-hidden rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] backdrop-blur-[var(--dash-blur)]"
      style={{
        boxShadow: 'var(--dash-shadow)',
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[var(--dash-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#AE4010]/10">
            <BarChart3 className="h-4 w-4 text-[#AE4010]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--dash-text)]">
              {title}
            </h3>
            <p className="text-[11px] text-[var(--dash-text-muted)]">{subtitle}</p>
          </div>
        </div>

        {growth !== null && (
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              growth >= 0
                ? 'bg-[#3A9D5C]/12 text-[#3A9D5C]'
                : 'bg-red-500/12 text-red-400'
            }`}
          >
            {growth >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{growth >= 0 ? '+' : ''}{growth}%</span>
            <span className="font-normal text-[var(--dash-text-muted)]">
              vs prior
            </span>
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="px-4 py-4" style={{ minHeight: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#AE4010" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#AE4010" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradMarketing" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4A90D9" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#4A90D9" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradPortal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3A9D5C" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#3A9D5C" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255,255,255,0.04)"
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8a8580', fontSize: 10 }}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8a8580', fontSize: 10 }}
              tickMargin={4}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#AE4010"
              strokeWidth={2}
              fill="url(#gradTotal)"
              dot={false}
              activeDot={{ r: 4, fill: '#AE4010', stroke: '#202020', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="marketing"
              stroke="#4A90D9"
              strokeWidth={1.5}
              fill="url(#gradMarketing)"
              dot={false}
              activeDot={{ r: 3, fill: '#4A90D9', stroke: '#202020', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="portal"
              stroke="#3A9D5C"
              strokeWidth={1.5}
              fill="url(#gradPortal)"
              dot={false}
              activeDot={{ r: 3, fill: '#3A9D5C', stroke: '#202020', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend at bottom */}
      <div className="flex flex-wrap items-center justify-center gap-5 border-t border-[var(--dash-border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#AE4010]" />
          <span className="text-[11px] font-medium text-[var(--dash-text-muted)]">
            Total Opportunities
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4A90D9]" />
          <span className="text-[11px] font-medium text-[var(--dash-text-muted)]">
            Marketing Pipeline
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3A9D5C]" />
          <span className="text-[11px] font-medium text-[var(--dash-text-muted)]">
            Lawyer Portal Pipeline
          </span>
        </div>
      </div>
    </div>
  );
}
