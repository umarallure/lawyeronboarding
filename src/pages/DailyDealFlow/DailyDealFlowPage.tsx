import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, MessageCircle, PhoneCall, Users, Search, Loader2 } from "lucide-react";
import { fetchInstantlyOverview, type InstantlyOverview } from "@/lib/instantly";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";

type OutreachMethod = "Email (Instantly)" | "DM (FlowChat)" | "Cold Call" | "Networking";

type DateRangeOption = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

const DATE_RANGE_LABELS: Record<DateRangeOption, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_week: "Last Week",
  this_month: "This Month",
  last_month: "Last Month",
  custom: "Custom",
};

const getDateBounds = (range: DateRangeOption, customStart?: string, customEnd?: string): { start: Date; end: Date } => {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const d = subDays(now, 1);
      return { start: startOfDay(d), end: endOfDay(d) };
    }
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_week": {
      const ref = subWeeks(now, 1);
      return { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) };
    }
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const ref = subMonths(now, 1);
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    }
    case "custom":
      if (customStart && customEnd) {
        return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)) };
      }
      return { start: startOfDay(now), end: endOfDay(now) };
  }
};

type StaticOutreachMetrics = {
  method: Exclude<OutreachMethod, "Email (Instantly)">;
  output: number;
  conversion: number;
  conversionLabel: string;
  goalOutput: number;
};

type MethodMeta = {
  icon: typeof Mail;
  accentClass: string;
  badgeClass: string;
};

const staticMetrics: StaticOutreachMetrics[] = [
  { method: "DM (FlowChat)", output: 0, conversion: 0, conversionLabel: "Green Flags", goalOutput: 120 },
  { method: "Cold Call", output: 0, conversion: 0, conversionLabel: "Connected", goalOutput: 80 },
  { method: "Networking", output: 0, conversion: 0, conversionLabel: "Green Flags", goalOutput: 10 },
];

const metaByMethod: Record<OutreachMethod, MethodMeta> = {
  "Email (Instantly)": { icon: Mail, accentClass: "bg-blue-500", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  "DM (FlowChat)": { icon: MessageCircle, accentClass: "bg-violet-500", badgeClass: "bg-violet-50 text-violet-700 border-violet-200" },
  "Cold Call": { icon: PhoneCall, accentClass: "bg-amber-500", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  "Networking": { icon: Users, accentClass: "bg-emerald-500", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

// ── Instantly Email Card ──────────────────────────────────────────────────────

type InstantlyCardProps = {
  data: InstantlyOverview | null;
  loading: boolean;
  dateLabel: string;
};

const GOAL_SENT = 300;

const StatPill = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="rounded-lg border bg-card p-3 flex flex-col gap-0.5">
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="text-2xl font-semibold tracking-tight">{value}</div>
    {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
  </div>
);

const pct = (num: number, denom: number) =>
  denom > 0 ? ((num / denom) * 100).toFixed(1) + "%" : "—";

const InstantlyEmailCard = ({ data, loading, dateLabel }: InstantlyCardProps) => {
  const meta = metaByMethod["Email (Instantly)"];
  const Icon = meta.icon;

  const sent = data?.emails_sent_count ?? 0;
  const replies = data?.reply_count_unique ?? 0;
  const opens = data?.open_count_unique ?? 0;
  const interested = data?.total_interested ?? 0;
  const meetingsBooked = data?.total_meeting_booked ?? 0;
  const bounces = data?.bounced_count ?? 0;

  const goalPct = GOAL_SENT > 0 ? Math.min(100, (sent / GOAL_SENT) * 100) : 0;
  const remaining = Math.max(0, GOAL_SENT - sent);

  const replyRatePct = pct(replies, sent);
  const openRatePct = pct(opens, sent);

  return (
    <Card className="overflow-hidden">
      <div className={`h-1.5 w-full ${meta.accentClass}`} />
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
              <Icon className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold">Email (Instantly)</div>
              <div className="text-xs text-muted-foreground">{dateLabel} scorecard</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Badge variant="outline" className={meta.badgeClass}>
              {goalPct.toFixed(0)}% to goal
            </Badge>
          </div>
        </div>

        {/* Primary: Sent + Reply side by side */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">Emails Sent</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">
              {loading ? "—" : sent.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Goal {GOAL_SENT} • Remaining {remaining}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">Unique Replies</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">
              {loading ? "—" : replies}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Reply rate {loading ? "—" : replyRatePct}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>Progress</span>
            <span>{sent}/{GOAL_SENT}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${goalPct}%` }} />
          </div>
        </div>

        {/* Secondary stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border bg-card p-2.5">
            <div className="text-[10px] text-muted-foreground">Opens</div>
            <div className="mt-0.5 text-lg font-semibold">{loading ? "—" : opens}</div>
            <div className="text-[10px] text-muted-foreground">{loading ? "—" : openRatePct}</div>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <div className="text-[10px] text-muted-foreground">Interested</div>
            <div className="mt-0.5 text-lg font-semibold">{loading ? "—" : interested}</div>
            <div className="text-[10px] text-muted-foreground">In CRM</div>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <div className="text-[10px] text-muted-foreground">Meetings</div>
            <div className="mt-0.5 text-lg font-semibold">{loading ? "—" : meetingsBooked}</div>
            <div className="text-[10px] text-muted-foreground">Booked</div>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[11px]">
            {remaining === 0 ? "Goal hit" : `${remaining} left`}
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {!data ? "No data" :
              parseFloat(replyRatePct) >= 5 ? "Strong rate" :
              parseFloat(replyRatePct) >= 2 ? "Healthy rate" : "Needs lift"}
          </Badge>
          {bounces > 10 && (
            <Badge variant="secondary" className="text-[11px] text-amber-700 border-amber-300 bg-amber-50">
              ⚠ Check bounces
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Static outreach card (DM / Cold Call / Networking) ───────────────────────

type StaticCardProps = { m: StaticOutreachMetrics };

const StaticOutreachCard = ({ m }: StaticCardProps) => {
  const meta = metaByMethod[m.method];
  const Icon = meta.icon;
  const conversionRate = m.output > 0 ? (m.conversion / m.output) * 100 : 0;
  const remaining = Math.max(0, m.goalOutput - m.output);
  const goalPct = m.goalOutput > 0 ? Math.min(100, (m.output / m.goalOutput) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <div className={`h-1.5 w-full ${meta.accentClass}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
              <Icon className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold">{m.method}</div>
              <div className="text-xs text-muted-foreground">Daily scorecard</div>
            </div>
          </div>
          <Badge variant="outline" className={meta.badgeClass}>
            {goalPct.toFixed(0)}% to goal
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">Output</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{m.output}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Goal {m.goalOutput} • Remaining {remaining}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">{m.conversionLabel}</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{m.conversion}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Rate {conversionRate.toFixed(1)}%</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Progress</span>
            <span>{m.output}/{m.goalOutput}</span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${meta.accentClass}`} style={{ width: `${goalPct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[11px]">
              {remaining === 0 ? "Goal hit" : `${remaining} left`}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              {conversionRate >= 15 ? "Strong rate" : conversionRate >= 8 ? "Healthy rate" : "Needs lift"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

const DailyDealFlowPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeOption>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [instantlyData, setInstantlyData] = useState<InstantlyOverview | null>(null);
  const [instantlyLoading, setInstantlyLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setInstantlyLoading(true);
      const { start, end } = getDateBounds(dateRange, customStart, customEnd);
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");
      const result = await fetchInstantlyOverview(startStr, endStr);
      if (!cancelled) {
        setInstantlyData(result);
        setInstantlyLoading(false);
      }
    };
    if (dateRange !== "custom" || (customStart && customEnd)) {
      run();
    }
    return () => { cancelled = true; };
  }, [dateRange, customStart, customEnd]);

  const allMethods: OutreachMethod[] = ["Email (Instantly)", "DM (FlowChat)", "Cold Call", "Networking"];

  const showEmail = useMemo(() => {
    if (platformFilter !== "all" && platformFilter !== "Email (Instantly)") return false;
    if (searchTerm.trim() && !"email (instantly)".includes(searchTerm.trim().toLowerCase())) return false;
    return true;
  }, [platformFilter, searchTerm]);

  const filteredStatic = useMemo(() => {
    let filtered = staticMetrics;
    if (platformFilter !== "all") {
      filtered = filtered.filter((m) => m.method === platformFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((m) => m.method.toLowerCase().includes(q));
    }
    return filtered;
  }, [searchTerm, platformFilter]);

  const dateLabel = DATE_RANGE_LABELS[dateRange];

  return (
    <div className="space-y-5 px-4 md:px-6 pt-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search outreach methods..."
            className="pl-9"
          />
        </div>

        {/* Platform filter */}
        <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Platforms</SelectItem>
              {allMethods.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Date range filter */}
        <Select
          value={dateRange}
          onValueChange={(v) => {
            const next = v as DateRangeOption;
            if (next === "custom" && dateRange !== "custom") {
              const { start, end } = getDateBounds(dateRange);
              setCustomStart(format(start, "yyyy-MM-dd"));
              setCustomEnd(format(end, "yyyy-MM-dd"));
            }
            setDateRange(next);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Custom date inputs */}
        {dateRange === "custom" && (
          <>
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              className="w-36"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="date"
              className="w-36"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showEmail && (
          <InstantlyEmailCard
            data={instantlyData}
            loading={instantlyLoading}
            dateLabel={dateLabel}
          />
        )}
        {filteredStatic.map((m) => (
          <StaticOutreachCard key={m.method} m={m} />
        ))}
      </div>
    </div>
  );
};

export default DailyDealFlowPage;
