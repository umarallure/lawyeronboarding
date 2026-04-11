import { type ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, Calendar, SlidersHorizontal } from 'lucide-react';

export interface FilterBarProps {
  /** Current time range value */
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  /** Custom date range fields */
  showCustomDates: boolean;
  customStartDate: string;
  customEndDate: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  /** Stat picker */
  statPickerOpen: boolean;
  onStatPickerOpenChange: (open: boolean) => void;
  statPickerLabel: string;
  statCards: { key: string; label: string }[];
  visibleStats: string[];
  onToggleStat: (key: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
}

export default function DashboardFilterBar({
  timeRange,
  onTimeRangeChange,
  showCustomDates,
  customStartDate,
  customEndDate,
  onCustomStartChange,
  onCustomEndChange,
  statPickerOpen,
  onStatPickerOpenChange,
  statPickerLabel,
  statCards,
  visibleStats,
  onToggleStat,
  onSelectAll,
  allSelected,
}: FilterBarProps) {
  return (
    <div
      className="dash-animate-in flex flex-wrap items-center gap-3 rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3 backdrop-blur-[var(--dash-blur)]"
      style={{ boxShadow: 'var(--dash-shadow)' }}
    >
      {/* Date range selector */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#AE4010]/10">
          <Calendar className="h-3.5 w-3.5 text-[#AE4010]" />
        </div>
        <Select value={timeRange} onValueChange={onTimeRangeChange}>
          <SelectTrigger className="h-8 w-40 border-[var(--dash-border)] bg-transparent text-xs text-[var(--dash-text)] hover:border-[var(--dash-border-hover)] focus:ring-[#AE4010]/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[var(--dash-border)] bg-[#1A1A1A] text-[var(--dash-text)]">
            <SelectGroup>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {showCustomDates && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--dash-text-muted)]">
              From
            </span>
            <Input
              type="date"
              className="h-8 w-36 border-[var(--dash-border)] bg-transparent text-xs text-[var(--dash-text)] focus:ring-[#AE4010]/30"
              value={customStartDate}
              max={customEndDate || undefined}
              onChange={(e) => onCustomStartChange(e.target.value)}
            />
            <span className="text-[10px] uppercase tracking-wider text-[var(--dash-text-muted)]">
              To
            </span>
            <Input
              type="date"
              className="h-8 w-36 border-[var(--dash-border)] bg-transparent text-xs text-[var(--dash-text)] focus:ring-[#AE4010]/30"
              value={customEndDate}
              min={customStartDate || undefined}
              onChange={(e) => onCustomEndChange(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="hidden h-6 w-px bg-[var(--dash-border)] sm:block" />

      {/* Stat card picker */}
      <Popover open={statPickerOpen} onOpenChange={onStatPickerOpenChange}>
        <PopoverTrigger asChild>
          <button className="flex h-8 items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-transparent px-3 text-xs text-[var(--dash-text)] transition-colors hover:border-[var(--dash-border-hover)] hover:bg-white/[0.03]">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
            {statPickerLabel}
            <ChevronDown className="h-3 w-3 text-[var(--dash-text-muted)]" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 border-[var(--dash-border)] bg-[#1A1A1A] p-2 shadow-lg"
          align="start"
        >
          <div className="space-y-0.5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--dash-border)] px-2 pb-2 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--dash-text-muted)]">
                Visible Cards
              </span>
              <button
                className="text-[10px] font-medium text-[#AE4010] transition-colors hover:text-[#E8622A]"
                onClick={onSelectAll}
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            {/* Card toggles */}
            {statCards.map((card) => (
              <label
                key={card.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
              >
                <Checkbox
                  checked={visibleStats.includes(card.key)}
                  onCheckedChange={() => onToggleStat(card.key)}
                  className="border-[var(--dash-border)] data-[state=checked]:border-[#AE4010] data-[state=checked]:bg-[#AE4010]"
                />
                <span className="text-[12px] text-[var(--dash-text)]">
                  {card.label}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
