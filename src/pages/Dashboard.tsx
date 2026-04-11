import React, { useEffect, useState } from 'react';
import LogoLoader from '@/components/LogoLoader';
import { supabase } from '@/integrations/supabase/client';
import { fetchInstantlyOverview } from '@/lib/instantly';
import { fetchCalendlyStats } from '@/lib/calendly';
import KpiCard from '@/components/dashboard/KpiCard';
import AnalyticsTrendCard from '@/components/dashboard/AnalyticsTrendCard';
import DashboardFilterBar from '@/components/dashboard/DashboardFilterBar';
import {
  Send,
  UserCheck,
  CalendarCheck,
  Video,
  FileCheck2,
  Users,
  UserPlus,
  UserMinus,
} from 'lucide-react';
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
  inactiveLawyers: number;
};

const EMPTY_STATS: DashboardStats = {
  output: 0,
  interestedConnected: 0,
  opportunities: 0,
  scheduledMeetings: 0,
  ranMeeting: 0,
  signedAgreements: 0,
  activeLawyers: 0,
  inactiveLawyers: 0,
};

type StatCardKey = keyof DashboardStats;

const ALL_STAT_CARDS: { key: StatCardKey; label: string; subtitle?: string }[] = [
  { key: 'output', label: 'Output' },
  { key: 'interestedConnected', label: 'Interested/Connected' },
  { key: 'scheduledMeetings', label: 'Scheduled Meetings' },
  { key: 'ranMeeting', label: 'Ran Meeting' },
  { key: 'signedAgreements', label: 'Signed Agreements' },
  { key: 'opportunities', label: 'Onboardings' },
  { key: 'activeLawyers', label: 'Active Lawyers' },
  { key: 'inactiveLawyers', label: 'Inactive Lawyers' },
];

// Returns true for known test accounts based on email/name patterns
const isTestUser = (email: string | null, name: string | null): boolean => {
  const e = (email ?? '').trim().toLowerCase();
  const n = (name ?? '').trim().toLowerCase();
  if (e.startsWith('test@') || e.includes('+test') || e.includes('@example.com') || e === 'test@accidentpayments.com') return true;
  if (n.startsWith('test') || n.includes(' test ')) return true;
  return false;
};

const ALL_STAT_KEYS = ALL_STAT_CARDS.map((c) => c.key);

type TimeRange = 'this_week' | 'last_week' | 'this_month' | 'last_month';
type PresetTimeRange = TimeRange;
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
  const [statsLoading, setStatsLoading] = useState(true);

  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [visibleStats, setVisibleStats] = useState<StatCardKey[]>(ALL_STAT_KEYS);
  const [statPickerOpen, setStatPickerOpen] = useState(false);

  const [dealFlowTrend, setDealFlowTrend] = useState<
    Array<{ day: string; total: number; marketing: number; portal: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStatsLoading(true);

      let start: Date;
      let end: Date;

      if (timeRange === 'custom') {
        if (!customStartDate || !customEndDate) {
          setDealFlowTrend([]);
          setStats(EMPTY_STATS);
          setStatsLoading(false);
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
      const startDateStr = format(start, 'yyyy-MM-dd');
      const endDateStr = format(end, 'yyyy-MM-dd');

      const days = eachDayOfInterval({ start, end });

      const sb = supabase as unknown as typeof supabase;

      const [stagesRes, dealFlowRowsRes, appUsersRes, ordersInRangeRes, instantlyOverview, calendlyStats] = await Promise.all([
        sb
          .from('portal_stages')
          .select('id,key,label,pipeline')
          .in('pipeline', ['cold_call_pipeline', 'lawyer_portal']),
        sb
          .from('lawyer_leads')
          .select('created_at,pipeline_name')
          .gte('created_at', startIso)
          .lt('created_at', endExclusiveIso)
          .or('email.is.null,email.not.ilike.test@%')
          .or('email.is.null,email.not.ilike.%@example.com')
          .or('email.is.null,email.neq.test@accidentpayments.com')
          .order('created_at', { ascending: true }),
        sb
          .from('app_users')
          .select('user_id,email,display_name')
          .eq('role', 'lawyer'),
        sb
          .from('orders')
          .select('lawyer_id')
          .gte('created_at', startIso)
          .lt('created_at', endExclusiveIso),
        // Instantly AI: campaign analytics overview for Output + Interested/Connected stats
        fetchInstantlyOverview(startDateStr, endDateStr),
        // Calendly: scheduled (future) and ran (past) meeting counts
        fetchCalendlyStats(startDateStr, endDateStr),
      ]);

      if (cancelled) return;

      if (stagesRes.error) {
        // eslint-disable-next-line no-console
        console.error('[manager-dashboard] portal_stages query error', stagesRes.error);
      }
      if (dealFlowRowsRes.error) {
        // eslint-disable-next-line no-console
        console.error('[manager-dashboard] lawyer_leads trend query error', dealFlowRowsRes.error);
      }

      const stages = (stagesRes.data ?? []) as Array<{
        id: string;
        key: string;
        label: string;
        pipeline: string;
      }>;

      const countLawyerLeadsByStageTokens = async (stageTokens: string[]): Promise<number> => {
        if (!stageTokens.length) return 0;

        const res = await sb
          .from('lawyer_leads')
          .select('id', { count: 'exact', head: true })
          .in('stage_id', stageTokens)
          .gte('created_at', startIso)
          .lt('created_at', endExclusiveIso)
          .or('email.is.null,email.not.ilike.test@%')
          .or('email.is.null,email.not.ilike.%@example.com')
          .or('email.is.null,email.neq.test@accidentpayments.com');

        return (res?.count ?? 0) as number;
      };

      const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
      const fingerprint = (value: string | null | undefined) =>
        normalize(value).replace(/[^a-z0-9]+/g, '');

      const stageTokensFor = (opts: {
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
          .flatMap((s) => [s.id, s.key])
          .filter(Boolean);
      };

      // Output and Interested/Connected come from Instantly AI (see below)

      const scheduledStageTokens = stageTokensFor({
        pipeline: 'cold_call_pipeline',
        keys: ['scheduled_for_zoom'],
        labels: ['scheduled for zoom'],
      });

      const ranMeetingStageTokens = stageTokensFor({
        pipeline: 'cold_call_pipeline',
        keys: ['ran_meeting', 'meeting_ran', 'ran_zoom'],
        labels: ['ran meeting'],
      });

      const signedStageTokens = stageTokensFor({
        pipeline: 'lawyer_portal',
        keys: ['retainer_signed'],
        labels: ['retainer signed'],
      });

      // Output = unique human replies from Instantly; Interested/Connected = leads marked interested
      const output = instantlyOverview?.reply_count_unique ?? 0;
      const interestedConnected = instantlyOverview?.total_interested ?? 0;

      // Scheduled meetings and ran meeting now come from Calendly
      const scheduledMeetings = calendlyStats?.scheduled ?? 0;
      const ranMeeting = calendlyStats?.ran ?? 0;

      const signedStageKeys = signedStageTokens.filter((t) => !t.includes('-'));
      let signedAgreements = 0;
      if (signedStageKeys.length > 0) {
        const signedRes = await sb
          .from('lawyer_leads')
          .select('id', { count: 'exact', head: true })
          .eq('pipeline_name', 'lawyer_portal')
          .in('stage_id', signedStageKeys)
          .gte('updated_at', startIso)
          .lt('updated_at', endExclusiveIso)
          .or('email.is.null,email.not.ilike.test@%')
          .or('email.is.null,email.not.ilike.%@example.com')
          .or('email.is.null,email.neq.test@accidentpayments.com');
        signedAgreements = (signedRes?.count ?? 0) as number;
      }

      if (cancelled) return;

      let opportunities = 0;
      try {
        const leadsRes = await sb
          .from('lawyer_leads')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startIso)
          .lt('created_at', endExclusiveIso)
          .or('email.is.null,email.not.ilike.test@%')
          .or('email.is.null,email.not.ilike.%@example.com')
          .or('email.is.null,email.neq.test@accidentpayments.com');
        opportunities = (leadsRes?.count ?? 0) as number;
      } catch (e) {
        console.warn('Failed to fetch lawyer_leads count', e);
      }

      // Build test/real lawyer ID sets from app_users for active + inactive calculations
      const lawyerUsers = (appUsersRes?.data ?? []) as unknown as Array<{
        user_id: string;
        email: string | null;
        display_name: string | null;
      }>;
      const testLawyerIds = new Set(
        lawyerUsers.filter((u) => isTestUser(u.email, u.display_name)).map((u) => u.user_id).filter(Boolean)
      );
      const realLawyerIds = new Set(
        lawyerUsers.filter((u) => !isTestUser(u.email, u.display_name)).map((u) => u.user_id).filter(Boolean)
      );

      // Active lawyers: placed at least one order in the selected date range (excluding test accounts)
      const orderRows = (ordersInRangeRes?.data ?? []) as unknown as Array<{ lawyer_id: string }>;
      const activeInRangeIds = new Set(
        orderRows.map((r) => r.lawyer_id).filter((id) => id && !testLawyerIds.has(id))
      );
      const activeLawyers = activeInRangeIds.size;

      // Inactive lawyers: real lawyers with an account who placed NO order in the selected date range
      const inactiveLawyers = Array.from(realLawyerIds).filter((id) => !activeInRangeIds.has(id)).length;

      setStats({
        output,
        interestedConnected,
        scheduledMeetings,
        ranMeeting,
        signedAgreements,
        activeLawyers,
        inactiveLawyers,
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
      setStatsLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [timeRange, customStartDate, customEndDate]);

  const toggleStat = (key: StatCardKey) => {
    setVisibleStats((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const visibleCards = ALL_STAT_CARDS.filter((c) => visibleStats.includes(c.key));

  const statPickerLabel =
    visibleStats.length === ALL_STAT_KEYS.length
      ? 'All Stats'
      : visibleStats.length === 0
        ? 'No Stats'
        : `${visibleStats.length} Stats`;

  /* ── Icon + accent mapping for each KPI card ── */
  const CARD_META: Record<
    StatCardKey,
    { icon: React.ReactNode; accent: import('@/components/dashboard/KpiCard').AccentColor }
  > = {
    output: { icon: <Send className="h-5 w-5" />, accent: 'orange' },
    interestedConnected: { icon: <UserCheck className="h-5 w-5" />, accent: 'green' },
    scheduledMeetings: { icon: <CalendarCheck className="h-5 w-5" />, accent: 'blue' },
    ranMeeting: { icon: <Video className="h-5 w-5" />, accent: 'darkGreen' },
    signedAgreements: { icon: <FileCheck2 className="h-5 w-5" />, accent: 'purple' },
    opportunities: { icon: <Users className="h-5 w-5" />, accent: 'darkBlue' },
    activeLawyers: { icon: <UserPlus className="h-5 w-5" />, accent: 'darkOrange' },
    inactiveLawyers: { icon: <UserMinus className="h-5 w-5" />, accent: 'red' },
  };

  if (statsLoading) {
    return <LogoLoader page label="Loading dashboard..." />;
  }

  return (
    <div className="dashboard-premium min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-5">
        {/* ── Filter Bar ── */}
        <DashboardFilterBar
          timeRange={timeRange}
          onTimeRangeChange={(v) => {
            const next = v as DashboardTimeRange;
            if (next === 'custom' && timeRange !== 'custom') {
              const bounds = getPresetRangeBounds(timeRange as PresetTimeRange);
              setCustomStartDate(format(bounds.start, 'yyyy-MM-dd'));
              setCustomEndDate(format(bounds.end, 'yyyy-MM-dd'));
            }
            setTimeRange(next);
          }}
          showCustomDates={timeRange === 'custom'}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomStartChange={setCustomStartDate}
          onCustomEndChange={setCustomEndDate}
          statPickerOpen={statPickerOpen}
          onStatPickerOpenChange={setStatPickerOpen}
          statPickerLabel={statPickerLabel}
          statCards={ALL_STAT_CARDS}
          visibleStats={visibleStats}
          onToggleStat={(key) => toggleStat(key as StatCardKey)}
          onSelectAll={() =>
            setVisibleStats(
              visibleStats.length === ALL_STAT_KEYS.length ? [] : [...ALL_STAT_KEYS]
            )
          }
          allSelected={visibleStats.length === ALL_STAT_KEYS.length}
        />

        {/* ── KPI Cards: 2-col mobile, 4-col desktop ── */}
        {visibleCards.length > 0 && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {visibleCards.map((card, idx) => {
              const meta = CARD_META[card.key];
              return (
                <KpiCard
                  key={card.key}
                  label={card.label}
                  value={stats[card.key]}
                  icon={meta.icon}
                  accent={meta.accent}
                  animationDelay={60 * idx}
                />
              );
            })}
          </div>
        )}

        {/* ── Analytics Trend Card ── */}
        <AnalyticsTrendCard
          data={dealFlowTrend}
          title={`Onboarding Trends \u2014 ${getRangeLabel(timeRange)}`}
          subtitle="Daily opportunity flow across all pipelines"
          animationDelay={visibleCards.length * 60 + 80}
        />
      </div>
    </div>
  );
};

export default Dashboard;
