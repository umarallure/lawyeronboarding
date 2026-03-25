import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';

type DashboardStats = {
  output: number;
  interestedConnected: number;
  opportunities: number;
  scheduledMeetings: number;
  ranMeeting: number;
  signedAgreements: number;
  activeLawyers: number;
};

const EMPTY_STATS: DashboardStats = {
  output: 0,
  interestedConnected: 0,
  opportunities: 0,
  scheduledMeetings: 0,
  ranMeeting: 0,
  signedAgreements: 0,
  activeLawyers: 0,
};

type TimeRange = 'this_week' | 'last_week' | 'this_month' | 'last_month';
type PresetTimeRange = Exclude<TimeRange, 'custom'>;
type DashboardTimeRange = TimeRange | 'custom';

const getRangeLabel = (range: DashboardTimeRange) => {
  switch (range) {
    case 'this_week':
      return 'This Week';
    case 'last_week':
      return 'Last Week';
    case 'this_month':
      return 'This Month';
    case 'last_month':
      return 'Last Month';
    case 'custom':
      return 'Custom';
  }
};

const getPresetRangeBounds = (range: PresetTimeRange) => {
  const now = new Date();
  if (range === 'this_week') {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return { start, end };
  }

  if (range === 'last_week') {
    const ref = subWeeks(now, 1);
    const start = startOfWeek(ref, { weekStartsOn: 1 });
    const end = endOfWeek(ref, { weekStartsOn: 1 });
    return { start, end };
  }

  if (range === 'this_month') {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return { start, end };
  }

  const ref = subMonths(now, 1);
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  return { start, end };
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);

  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('this_week');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [dealFlowTrend, setDealFlowTrend] = useState<
    Array<{ day: string; total: number; marketing: number; portal: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      let start: Date;
      let end: Date;

      if (timeRange === 'custom') {
        if (!customStartDate || !customEndDate) {
          setDealFlowTrend([]);
          setStats(EMPTY_STATS);
          return;
        }

        start = startOfDay(parseISO(customStartDate));
        end = startOfDay(parseISO(customEndDate));
        if (end < start) end = start;
      } else {
        const bounds = getPresetRangeBounds(timeRange);
        start = bounds.start;
        end = bounds.end;
      }

      const startIso = start.toISOString();
      const endExclusiveIso = addDays(startOfDay(end), 1).toISOString();

      const days = eachDayOfInterval({ start, end });

      const sb = supabase as unknown as typeof supabase;

      const [stagesRes, dealFlowRowsRes] = await Promise.all([
        sb
          .from('portal_stages')
          .select('id,key,label,pipeline')
          .in('pipeline', ['cold_call_pipeline', 'lawyer_portal']),
        sb
          .from('lawyer_leads')
          .select('created_at,pipeline_name')
          .gte('created_at', startIso)
          .lt('created_at', endExclusiveIso)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;

      const stages = (stagesRes.data ?? []) as Array<{
        id: string;
        key: string;
        label: string;
        pipeline: string;
      }>;

      const countLawyerLeadsByStageIds = async (stageIds: string[]): Promise<number> => {
        if (!stageIds.length) return 0;

        const res = await sb
          .from('lawyer_leads')
          .select('id', { count: 'exact', head: true })
          .in('stage_id', stageIds)
          .gte('created_at', startIso)
          .lt('created_at', endExclusiveIso);

        return (res?.count ?? 0) as number;
      };

      const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
      const fingerprint = (value: string | null | undefined) =>
        normalize(value).replace(/[^a-z0-9]+/g, '');

      const stageIdsFor = (opts: {
        pipeline: string;
        keys?: string[];
        labels?: string[];
      }): string[] => {
        const keys = (opts.keys ?? []).map(fingerprint);
        const labels = (opts.labels ?? []).map(fingerprint);
        const matches = (candidate: string, tokens: string[]) =>
          tokens.some(
            (token) => token && (candidate === token || candidate.startsWith(token) || token.startsWith(candidate))
          );

        return stages
          .filter((s) => s.pipeline === opts.pipeline)
          .filter((s) => {
            const key = fingerprint(s.key);
            const label = fingerprint(s.label);
            if (keys.length && matches(key, keys)) return true;
            if (labels.length && matches(label, labels)) return true;
            return false;
          })
          .map((s) => s.id);
      };

      const outputStageIds = stageIdsFor({
        pipeline: 'cold_call_pipeline',
        keys: ['output_state', 'output'],
        labels: ['output state', 'output'],
      });

      const interestedConnectedStageIds = stageIdsFor({
        pipeline: 'cold_call_pipeline',
        keys: ['interested_connected', 'interestedconnected', 'interested/connected'],
        labels: ['interested/connected', 'interested connected'],
      });

      const scheduledStageIds = stages
        .filter((s) => s.pipeline === 'cold_call_pipeline')
        .filter((s) => s.key === 'scheduled_for_zoom')
        .map((s) => s.id);

      const ranMeetingStageIds = stageIdsFor({
        pipeline: 'cold_call_pipeline',
        keys: ['ran_meeting', 'meeting_ran', 'ran_zoom'],
        labels: ['ran meeting'],
      });

      const signedStageIds = stages
        .filter((s) => s.pipeline === 'lawyer_portal')
        .filter((s) => s.key === 'retainer_signed')
        .map((s) => s.id);

      const activeStageIds = stages
        .filter((s) => s.pipeline === 'lawyer_portal')
        .filter((s) => s.key.startsWith('active'))
        .map((s) => s.id);

      const [output, interestedConnected, scheduledMeetings, ranMeeting, signedAgreements] =
        await Promise.all([
          countLawyerLeadsByStageIds(outputStageIds),
          countLawyerLeadsByStageIds(interestedConnectedStageIds),
          countLawyerLeadsByStageIds(scheduledStageIds),
          countLawyerLeadsByStageIds(ranMeetingStageIds),
          countLawyerLeadsByStageIds(signedStageIds),
        ]);

      if (cancelled) return;

      // Onboarding stat: total leads in the lawyer leads table
      let opportunities = 0;
      try {
        const leadsRes = await sb
          .from('lawyer_leads')
          .select('id', { count: 'exact', head: true });
        opportunities = (leadsRes?.count ?? 0) as number;
      } catch (e) {
        console.warn('Failed to fetch lawyer_leads count', e);
      }

      // Active Lawyers: distinct lawyers who created orders in the selected range
      let activeLawyers = 0;
      try {
        const ordersRes = await sb
          .from('orders')
          .select('lawyer_id')
          .gte('created_at', startIso)
          .lt('created_at', endExclusiveIso);
        const orderRows = (ordersRes?.data ?? []) as Array<{ lawyer_id: string }>;
        const uniqueLawyers = new Set(orderRows.map((r) => r.lawyer_id).filter(Boolean));
        activeLawyers = uniqueLawyers.size;
      } catch (e) {
        console.warn('Failed to fetch active lawyers from orders', e);
      }

      setStats({
        output,
        interestedConnected,
        scheduledMeetings,
        ranMeeting,
        signedAgreements,
        activeLawyers,
        opportunities,
      });

      const rows = (dealFlowRowsRes.data ?? []) as Array<{
        created_at: string | null;
        pipeline_name: string | null;
      }>;

      const byDay = new Map<string, { total: number; marketing: number; portal: number }>();
      days.forEach((d) => {
        const key = format(d, 'yyyy-MM-dd');
        byDay.set(key, { total: 0, marketing: 0, portal: 0 });
      });

      rows.forEach((r) => {
        if (!r.created_at) return;
        const key = format(new Date(r.created_at), 'yyyy-MM-dd');
        const bucket = byDay.get(key);
        if (!bucket) return;
        bucket.total += 1;
        const pipeline = (r.pipeline_name || '').trim();
        if (pipeline === 'cold_call_pipeline') bucket.marketing += 1;
        if (pipeline === 'lawyer_portal') bucket.portal += 1;
      });

      const trend = Array.from(byDay.entries()).map(([key, v]) => ({
        day: format(new Date(key), 'MMM d'),
        total: v.total,
        marketing: v.marketing,
        portal: v.portal,
      }));

      setDealFlowTrend(trend);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [timeRange, customStartDate, customEndDate]);

  const chartConfig = useMemo(
    () =>
      ({
        total: {
          label: 'Total Opportunities',
          color: 'hsl(24 95% 50%)',
        },
        marketing: {
          label: 'Marketing Pipeline',
          color: 'hsl(210 100% 45%)',
        },
        portal: {
          label: 'Lawyer Portal Pipeline',
          color: 'hsl(142 72% 38%)',
        },
      }) satisfies ChartConfig,
    []
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Output</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.output}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Interested/Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.interestedConnected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Scheduled Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.scheduledMeetings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ran Meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.ranMeeting}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Signed Agreements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.signedAgreements}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.opportunities}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Lawyers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.activeLawyers}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm">Lawyer Onboarding Stats ({getRangeLabel(timeRange)})</CardTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Select
              value={timeRange}
              onValueChange={(v) => {
                const next = v as DashboardTimeRange;
                if (next === 'custom' && timeRange !== 'custom') {
                  const bounds = getPresetRangeBounds(timeRange as PresetTimeRange);
                  setCustomStartDate(format(bounds.start, 'yyyy-MM-dd'));
                  setCustomEndDate(format(bounds.end, 'yyyy-MM-dd'));
                }
                setTimeRange(next);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {timeRange === 'custom' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Start</span>
                  <Input
                    type="date"
                    className="w-40"
                    value={customStartDate}
                    max={customEndDate || undefined}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">End</span>
                  <Input
                    type="date"
                    className="w-40"
                    value={customEndDate}
                    min={customStartDate || undefined}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart data={dealFlowTrend} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="marketing" fill="var(--color-marketing)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="portal" fill="var(--color-portal)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
