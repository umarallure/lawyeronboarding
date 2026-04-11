import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

export type AccentColor =
  | 'orange'
  | 'green'
  | 'blue'
  | 'darkGreen'
  | 'purple'
  | 'darkBlue'
  | 'darkOrange'
  | 'red';

interface ColorTokens {
  hex: string;
  text: string;
  iconBg: string;
  iconBgHover: string;
  borderColor: string;
}

const ACCENT_MAP: Record<AccentColor, ColorTokens> = {
  orange:    { hex: '#E8622A', text: 'text-[#E8622A]', iconBg: 'bg-[#E8622A]/10', iconBgHover: 'group-hover:bg-[#E8622A]/20', borderColor: '#E8622A' },
  green:     { hex: '#3A9D5C', text: 'text-[#3A9D5C]', iconBg: 'bg-[#3A9D5C]/10', iconBgHover: 'group-hover:bg-[#3A9D5C]/20', borderColor: '#3A9D5C' },
  blue:      { hex: '#4A90D9', text: 'text-[#4A90D9]', iconBg: 'bg-[#4A90D9]/10', iconBgHover: 'group-hover:bg-[#4A90D9]/20', borderColor: '#4A90D9' },
  darkGreen: { hex: '#1B7A3D', text: 'text-[#1B7A3D]', iconBg: 'bg-[#1B7A3D]/10', iconBgHover: 'group-hover:bg-[#1B7A3D]/20', borderColor: '#1B7A3D' },
  purple:    { hex: '#8B5CF6', text: 'text-[#8B5CF6]', iconBg: 'bg-[#8B5CF6]/10', iconBgHover: 'group-hover:bg-[#8B5CF6]/20', borderColor: '#8B5CF6' },
  darkBlue:  { hex: '#2E5EAA', text: 'text-[#2E5EAA]', iconBg: 'bg-[#2E5EAA]/10', iconBgHover: 'group-hover:bg-[#2E5EAA]/20', borderColor: '#2E5EAA' },
  darkOrange:{ hex: '#C4501A', text: 'text-[#C4501A]', iconBg: 'bg-[#C4501A]/10', iconBgHover: 'group-hover:bg-[#C4501A]/20', borderColor: '#C4501A' },
  red:       { hex: '#DC2626', text: 'text-[#DC2626]', iconBg: 'bg-[#DC2626]/10', iconBgHover: 'group-hover:bg-[#DC2626]/20', borderColor: '#DC2626' },
};

export interface KpiCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: AccentColor;
  ctaText?: string;
  progress?: { label: string; value: number };
  animationDelay?: number;
}

export default function KpiCard({
  label,
  value,
  icon,
  accent = 'orange',
  ctaText,
  progress,
  animationDelay = 0,
}: KpiCardProps) {
  const colors = ACCENT_MAP[accent];

  return (
    <div
      className="dash-animate-in group relative flex flex-col overflow-hidden rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] backdrop-blur-[var(--dash-blur)] transition-all duration-300 hover:shadow-[var(--dash-shadow-hover)]"
      style={{
        boxShadow: 'var(--dash-shadow)',
        animationDelay: `${animationDelay}ms`,
        borderColor: undefined, // managed by CSS var by default
      }}
    >
      {/* Fading accent gradient from top to bottom */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${colors.hex}14 0%, ${colors.hex}08 40%, transparent 100%)`,
        }}
      />

      {/* Hover: highlighted thin border with the card's accent color */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[var(--dash-radius)] border-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ borderColor: colors.hex }}
      />

      {/* Card body */}
      <div className="relative flex flex-1 flex-col p-4 lg:p-5">
        {/* Top row: label + icon */}
        <div className="flex items-start justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--dash-text-muted)]">
            {label}
          </span>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.iconBg} ${colors.iconBgHover} transition-colors duration-300`}
          >
            <span className={colors.text}>{icon}</span>
          </div>
        </div>

        {/* Metric value */}
        <div
          className={`mt-2 text-[32px] font-bold leading-none tabular-nums ${colors.text}`}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      </div>

      {/* Footer: CTA */}
      {ctaText && (
        <div className="relative border-t border-[var(--dash-border)] px-4 py-2.5 lg:px-5">
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--dash-text-muted)] transition-colors group-hover:text-[var(--dash-text)]">
            {ctaText}
            <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      )}

      {/* Footer: Progress */}
      {progress && (
        <div className="relative border-t border-[var(--dash-border)] px-4 py-2.5 lg:px-5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--dash-text-muted)]">{progress.label}</span>
            <span className={`font-semibold ${colors.text}`}>
              {progress.value}%
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress.value, 100)}%`, backgroundColor: `${colors.hex}80` }}
            />
          </div>
        </div>
      )}

      {/* Bottom accent strip */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: colors.hex }}
      />
    </div>
  );
}
