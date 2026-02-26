import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';

type DashboardStats = {
  onboarding: number;
  scheduledMeetings: number;
  signedAgreements: number;
  activeLawyers: number;
};

type TimeRange = 'this_week' | 'last_week' | 'this_month' | 'last_month';

const getRangeLabel = (range: TimeRange) => {
  switch (range) {
    case 'this_week':
      return 'This Week';
    case 'last_week':
      return 'Last Week';
    case 'this_month':
      return 'This Month';
    case 'last_month':
      return 'Last Month';
  }
};

const getRangeBounds = (range: TimeRange) => {
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
  const [stats, setStats] = useState<DashboardStats>({
    onboarding: 0,
    scheduledMeetings: 0,
    signedAgreements: 0,
    activeLawyers: 0,
  });

  const [timeRange, setTimeRange] = useState<TimeRange>('this_week');

  const [dealFlowTrend, setDealFlowTrend] = useState<
    Array<{ day: string; total: number; pending: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { start, end } = getRangeBounds(timeRange);
      const startIso = start.toISOString();
      const endExclusiveIso = addDays(startOfDay(end), 1).toISOString();

      const days = eachDayOfInterval({ start, end });

      const sb: any = supabase;

      const [stagesRes, dealFlowRowsRes] = await Promise.all([
        sb
          .from('portal_stages')
          .select('id,key,label,pipeline')
          .in('pipeline', ['cold_call_pipeline', 'lawyer_portal']),
        sb
          .from('daily_deal_flow')
          .select('created_at,status')
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
          .in('stage_id', stageIds);

        return (res?.count ?? 0) as number;
      };

      const scheduledStageIds = stages
        .filter((s) => s.pipeline === 'cold_call_pipeline')
        .filter((s) => s.key === 'scheduled_for_zoom')
        .map((s) => s.id);

      const signedStageIds = stages
        .filter((s) => s.pipeline === 'lawyer_portal')
        .filter((s) => s.key === 'retainer_signed')
        .map((s) => s.id);

      const activeStageIds = stages
        .filter((s) => s.pipeline === 'lawyer_portal')
        .filter((s) => s.key.startsWith('active'))
        .map((s) => s.id);

      const [scheduledMeetings, signedAgreements] = await Promise.all([
        countLawyerLeadsByStageIds(scheduledStageIds),
        countLawyerLeadsByStageIds(signedStageIds),
      ]);

      if (cancelled) return;

      // Onboarding stat: total lawyers created in the lawyer portal (app_users table)
      let onboarding = 0;
      try {
        const appUsersRes = await sb
          .from('app_users')
          .select('user_id', { count: 'exact', head: true });
        onboarding = (appUsersRes?.count ?? 0) as number;
      } catch (e) {
        console.warn('Failed to fetch app_users count', e);
      }

      // Active Lawyers: distinct lawyers who created orders in the last 30 days
      let activeLawyers = 0;
      try {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
        const ordersRes = await sb
          .from('orders')
          .select('lawyer_id')
          .gte('created_at', thirtyDaysAgo);
        const orderRows = (ordersRes?.data ?? []) as Array<{ lawyer_id: string }>;
        const uniqueLawyers = new Set(orderRows.map((r) => r.lawyer_id).filter(Boolean));
        activeLawyers = uniqueLawyers.size;
      } catch (e) {
        console.warn('Failed to fetch active lawyers from orders', e);
      }

      setStats({
        scheduledMeetings,
        signedAgreements,
        activeLawyers,
        onboarding,
      });

      const rows = (dealFlowRowsRes.data ?? []) as Array<{
        created_at: string | null;
        status: string | null;
      }>;

      const byDay = new Map<string, { total: number; pending: number }>();
      days.forEach((d) => {
        const key = format(d, 'yyyy-MM-dd');
        byDay.set(key, { total: 0, pending: 0 });
      });

      rows.forEach((r) => {
        if (!r.created_at) return;
        const key = format(new Date(r.created_at), 'yyyy-MM-dd');
        const bucket = byDay.get(key);
        if (!bucket) return;
        bucket.total += 1;
        if ((r.status || '').trim() === 'Pending Approval') bucket.pending += 1;
      });

      const trend = Array.from(byDay.entries()).map(([key, v]) => ({
        day: format(new Date(key), 'MMM d'),
        total: v.total,
        pending: v.pending,
      }));

      setDealFlowTrend(trend);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  const chartConfig = useMemo(
    () =>
      ({
        total: {
          label: 'Total Deal Flow',
          color: 'hsl(var(--primary))',
        },
        pending: {
          label: 'Pending Approval',
          color: 'hsl(var(--muted-foreground))',
        },
      }) satisfies ChartConfig,
    []
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm">Signed Agreements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.signedAgreements}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.onboarding}</div>
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
          <CardTitle className="text-sm">Acquisition Stats ({getRangeLabel(timeRange)})</CardTitle>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
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
              <Bar dataKey="pending" fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
