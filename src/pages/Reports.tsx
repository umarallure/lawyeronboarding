import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { Download, Users, Phone, PhoneCall, UserCheck, TrendingUp, TrendingDown, FileSpreadsheet, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AgentStats {
  agent_name: string;
  agent_type: 'buffer' | 'licensed' | 'retention';
  picked_up_calls: number;
  dropped_calls: number;
  submitted_calls: number;
  not_submitted_calls: number;
  transferred_calls: number;
  notes_count: number;
  success_rate: number;
  transfer_rate: number;
}

interface TeamStats {
  total_calls: number;
  total_transfers: number;
  total_submissions: number;
  total_drops: number;
  transfer_rate: number;
  submission_rate: number;
  active_agents: number;
}

export const ReportsPage = () => {
  const [bufferStats, setBufferStats] = useState<AgentStats[]>([]);
  const [licensedStats, setLicensedStats] = useState<AgentStats[]>([]);
  const [retentionStats, setRetentionStats] = useState<AgentStats[]>([]);
  const [bufferTeamStats, setBufferTeamStats] = useState<TeamStats | null>(null);
  const [licensedTeamStats, setLicensedTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>(undefined);
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>(undefined);

  const { toast } = useToast();

  // Fetch agent stats from the simplified agent_stats_daily table
  const fetchAgentStats = async (showRefreshToast = false) => {
    try {
      setRefreshing(true);

      // Build query for agent_stats_daily table
      let query = supabase
        .from('agent_stats_daily')
        .select('*')
        .order('log_date', { ascending: false });

      // Apply date filters
      if (dateFilter) {
        query = query.eq('log_date', format(dateFilter, 'yyyy-MM-dd'));
      }
      if (dateFromFilter) {
        query = query.gte('log_date', format(dateFromFilter, 'yyyy-MM-dd'));
      }
      if (dateToFilter) {
        query = query.lte('log_date', format(dateToFilter, 'yyyy-MM-dd'));
      }

      const { data: statsData, error } = await query;

      if (error) {
        console.error("Error fetching agent stats:", error);
        toast({
          title: "Error",
          description: "Failed to fetch agent statistics",
          variant: "destructive",
        });
        return;
      }

      // Group data by agent type
      const bufferAgents: AgentStats[] = [];
      const licensedAgents: AgentStats[] = [];
      const retentionAgents: AgentStats[] = [];

      // Aggregate stats by agent (across all dates in the filter)
      const agentMap = new Map<string, AgentStats>();

      (statsData || []).forEach(stat => {
        const key = `${stat.agent_name}-${stat.agent_type}`;
        if (!agentMap.has(key)) {
          agentMap.set(key, {
            agent_name: stat.agent_name,
            agent_type: stat.agent_type as 'buffer' | 'licensed' | 'retention',
            picked_up_calls: 0,
            dropped_calls: 0,
            submitted_calls: 0,
            not_submitted_calls: 0,
            transferred_calls: 0,
            notes_count: 0,
            success_rate: 0,
            transfer_rate: 0
          });
        }

        const agent = agentMap.get(key)!;
        agent.picked_up_calls += stat.picked_up_calls || 0;
        agent.dropped_calls += stat.dropped_calls || 0;
        agent.submitted_calls += stat.submitted_calls || 0;
        agent.not_submitted_calls += stat.not_submitted_calls || 0;
        agent.transferred_calls += stat.transferred_calls || 0;
      });

      // Calculate rates and categorize agents
      agentMap.forEach(agent => {
        const totalCalls = agent.picked_up_calls;
        agent.success_rate = totalCalls > 0 ? (agent.submitted_calls / totalCalls) * 100 : 0;
        agent.transfer_rate = totalCalls > 0 ? (agent.transferred_calls / totalCalls) * 100 : 0;

        switch (agent.agent_type) {
          case 'buffer':
            bufferAgents.push(agent);
            break;
          case 'licensed':
            licensedAgents.push(agent);
            break;
          case 'retention':
            retentionAgents.push(agent);
            break;
        }
      });

      // Calculate team stats
      const bufferTeam: TeamStats = {
        total_calls: bufferAgents.reduce((sum, agent) => sum + agent.picked_up_calls, 0),
        total_transfers: bufferAgents.reduce((sum, agent) => sum + agent.transferred_calls, 0),
        total_submissions: bufferAgents.reduce((sum, agent) => sum + agent.submitted_calls, 0),
        total_drops: bufferAgents.reduce((sum, agent) => sum + agent.dropped_calls, 0),
        transfer_rate: 0,
        submission_rate: 0,
        active_agents: bufferAgents.length
      };

      const licensedTeam: TeamStats = {
        total_calls: licensedAgents.reduce((sum, agent) => sum + agent.picked_up_calls, 0),
        total_transfers: 0, // Licensed agents don't transfer
        total_submissions: licensedAgents.reduce((sum, agent) => sum + agent.submitted_calls, 0),
        total_drops: licensedAgents.reduce((sum, agent) => sum + agent.dropped_calls, 0),
        transfer_rate: 0,
        submission_rate: 0,
        active_agents: licensedAgents.length
      };

      const retentionTeam: TeamStats = {
        total_calls: retentionAgents.reduce((sum, agent) => sum + agent.picked_up_calls, 0),
        total_transfers: retentionAgents.reduce((sum, agent) => sum + agent.transferred_calls, 0),
        total_submissions: retentionAgents.reduce((sum, agent) => sum + agent.submitted_calls, 0),
        total_drops: retentionAgents.reduce((sum, agent) => sum + agent.dropped_calls, 0),
        transfer_rate: 0,
        submission_rate: 0,
        active_agents: retentionAgents.length
      };

      // Calculate team rates
      bufferTeam.transfer_rate = bufferTeam.total_calls > 0 ? (bufferTeam.total_transfers / bufferTeam.total_calls) * 100 : 0;
      bufferTeam.submission_rate = bufferTeam.total_calls > 0 ? (bufferTeam.total_submissions / bufferTeam.total_calls) * 100 : 0;

      licensedTeam.submission_rate = licensedTeam.total_calls > 0 ? (licensedTeam.total_submissions / licensedTeam.total_calls) * 100 : 0;

      retentionTeam.transfer_rate = retentionTeam.total_calls > 0 ? (retentionTeam.total_transfers / retentionTeam.total_calls) * 100 : 0;
      retentionTeam.submission_rate = retentionTeam.total_calls > 0 ? (retentionTeam.total_submissions / retentionTeam.total_calls) * 100 : 0;

      // Sort agents by picked up calls
      bufferAgents.sort((a, b) => b.picked_up_calls - a.picked_up_calls);
      licensedAgents.sort((a, b) => b.picked_up_calls - a.picked_up_calls);
      retentionAgents.sort((a, b) => b.picked_up_calls - a.picked_up_calls);

      setBufferStats(bufferAgents);
      setLicensedStats(licensedAgents);
      setRetentionStats(retentionAgents);
      setBufferTeamStats(bufferTeam);
      setLicensedTeamStats(licensedTeam);

      if (showRefreshToast) {
        toast({
          title: "Success",
          description: "Reports data refreshed successfully",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Analyze agent performance from submission portal data
  const analyzeAgentPerformance = (transfers: any[], submissions: any[], callLogs: any[]) => {
    // Agent lists for validation
    const licensedAccountOptions = [
      "Claudia",
      "Lydia",
      "Isaac",
      "Benjamin",
      "Tatumn",
      "Trinity",
      "Noah",
      "Erica",
      "N/A"
    ];

    const bufferAgentOptions = [
      "N/A",
      "Ira",
      "Syed Kazmi",
      "Angy",
      "Kyla",
      "Bryan",
      "Justine",
      "Isaac",
      "Juan",
      "Kaye",
      "Laiza Batain",
      "Juan Buffer",  // Alternative name
      "Angy Camacho", // Alternative name
      "Tatumn"        // From logs
    ];

    const bufferAgents: { [key: string]: AgentStats } = {};
    const licensedAgents: { [key: string]: AgentStats } = {};
    const retentionAgents: { [key: string]: AgentStats } = {};

    // Helper functions to check agent types
    const isBufferAgent = (name: string) => bufferAgentOptions.includes(name);
    const isLicensedAgent = (name: string) => licensedAccountOptions.includes(name);

    // Process each submission with verification logs
    submissions.forEach(submission => {
      const verificationLog = submission.verification_logs || '';
      const status = submission.status || '';
      const isSubmitted = status === 'Complete' || status === 'Pending Approval';

      // Parse the verification log using the exact logic
      let bufferAgent = '';
      let handledAgent = '';
      let licensedAgent = '';
      let transferred = false;

      // Extract buffer agent - handle multiple formats
      const bufferMatch1 = verificationLog.match(/🟡 Buffer: ([^\s→]+)/); // Original format
      const bufferMatch2 = verificationLog.match(/� Buffer "([^"]+)"/); // New format
      const bufferMatch3 = verificationLog.match(/Buffer: ([^\s→,]+)/); // Summary format
      if (bufferMatch1) {
        bufferAgent = bufferMatch1[1];
      } else if (bufferMatch2) {
        bufferAgent = bufferMatch2[1];
      } else if (bufferMatch3) {
        bufferAgent = bufferMatch3[1];
      }

      // Extract handled by agent - handle multiple formats
      const handledMatch1 = verificationLog.match(/📞 Handled by: ([^\s→]+)/); // Original format
      if (handledMatch1) {
        handledAgent = handledMatch1[1];
      }

      // Check for transfer - handle multiple formats
      if (verificationLog.includes('➡️ Transfer to Licensed') ||
          verificationLog.includes('claimed dropped call') ||
          verificationLog.includes('Summary:')) {
        transferred = true;
      }

      // Extract licensed agent - handle multiple formats
      const licensedMatch1 = verificationLog.match(/🔵 Licensed: ([^\s]+)/); // Original format
      const licensedMatch2 = verificationLog.match(/🔵 Licensed "([^"]+)"/); // New format
      const licensedMatch3 = verificationLog.match(/Licensed: ([^\s→,]+)/); // Summary format
      if (licensedMatch1) {
        licensedAgent = licensedMatch1[1];
      } else if (licensedMatch2) {
        licensedAgent = licensedMatch2[1];
      } else if (licensedMatch3) {
        licensedAgent = licensedMatch3[1];
      }

      // Check for dropped calls
      const dropped = verificationLog.includes('dropped call');

      // Apply the exact logic from user's examples
      if (bufferAgent && isBufferAgent(bufferAgent)) {
        // Buffer agent involved
        if (!bufferAgents[bufferAgent]) {
          bufferAgents[bufferAgent] = {
            agent_name: bufferAgent,
            agent_type: 'buffer',
            picked_up_calls: 0,
            dropped_calls: 0,
            submitted_calls: 0,
            not_submitted_calls: 0,
            transferred_calls: 0,
            notes_count: 0,
            success_rate: 0,
            transfer_rate: 0
          };
        }
        bufferAgents[bufferAgent].picked_up_calls++;
        if (transferred) {
          bufferAgents[bufferAgent].transferred_calls++;
        }
        if (dropped) {
          bufferAgents[bufferAgent].dropped_calls++;
        }
        if (isSubmitted) {
          bufferAgents[bufferAgent].submitted_calls++;
        } else {
          bufferAgents[bufferAgent].not_submitted_calls++;
        }

        // If transferred (claimed by licensed), also count for licensed agent
        if (transferred && licensedAgent && isLicensedAgent(licensedAgent)) {
          if (!licensedAgents[licensedAgent]) {
            licensedAgents[licensedAgent] = {
              agent_name: licensedAgent,
              agent_type: 'licensed',
              picked_up_calls: 0,
              dropped_calls: 0,
              submitted_calls: 0,
              not_submitted_calls: 0,
              transferred_calls: 0,
              notes_count: 0,
              success_rate: 0,
              transfer_rate: 0
            };
          }
          licensedAgents[licensedAgent].picked_up_calls++;
          if (isSubmitted) {
            licensedAgents[licensedAgent].submitted_calls++;
          } else {
            licensedAgents[licensedAgent].not_submitted_calls++;
          }
        }
      } else if (licensedAgent && isLicensedAgent(licensedAgent)) {
        // Direct licensed agent pickup (no buffer involved)
        if (!licensedAgents[licensedAgent]) {
          licensedAgents[licensedAgent] = {
            agent_name: licensedAgent,
            agent_type: 'licensed',
            picked_up_calls: 0,
            dropped_calls: 0,
            submitted_calls: 0,
            not_submitted_calls: 0,
            transferred_calls: 0,
            notes_count: 0,
            success_rate: 0,
            transfer_rate: 0
          };
        }
        licensedAgents[licensedAgent].picked_up_calls++;
        if (dropped) {
          licensedAgents[licensedAgent].dropped_calls++;
        }
        if (isSubmitted) {
          licensedAgents[licensedAgent].submitted_calls++;
        } else {
          licensedAgents[licensedAgent].not_submitted_calls++;
        }
      }
    });

    // Calculate rates for all agent types
    Object.values(bufferAgents).forEach(agent => {
      const totalCalls = agent.picked_up_calls;
      agent.success_rate = totalCalls > 0 ? (agent.submitted_calls / totalCalls) * 100 : 0;
      agent.transfer_rate = totalCalls > 0 ? (agent.transferred_calls / totalCalls) * 100 : 0;
    });

    Object.values(licensedAgents).forEach(agent => {
      const totalCalls = agent.picked_up_calls;
      agent.success_rate = totalCalls > 0 ? (agent.submitted_calls / totalCalls) * 100 : 0;
    });

    Object.values(retentionAgents).forEach(agent => {
      const totalCalls = agent.picked_up_calls;
      agent.success_rate = totalCalls > 0 ? (agent.submitted_calls / totalCalls) * 100 : 0;
      agent.transfer_rate = totalCalls > 0 ? (agent.transferred_calls / totalCalls) * 100 : 0;
    });

    // Calculate team stats
    const bufferTeam: TeamStats = {
      total_calls: Object.values(bufferAgents).reduce((sum, agent) => sum + agent.picked_up_calls, 0),
      total_transfers: Object.values(bufferAgents).reduce((sum, agent) => sum + agent.transferred_calls, 0),
      total_submissions: Object.values(bufferAgents).reduce((sum, agent) => sum + agent.submitted_calls, 0),
      total_drops: Object.values(bufferAgents).reduce((sum, agent) => sum + agent.dropped_calls, 0),
      transfer_rate: 0,
      submission_rate: 0,
      active_agents: Object.keys(bufferAgents).length
    };

    const licensedTeam: TeamStats = {
      total_calls: Object.values(licensedAgents).reduce((sum, agent) => sum + agent.picked_up_calls, 0),
      total_transfers: 0, // Licensed agents don't transfer
      total_submissions: Object.values(licensedAgents).reduce((sum, agent) => sum + agent.submitted_calls, 0),
      total_drops: Object.values(licensedAgents).reduce((sum, agent) => sum + agent.dropped_calls, 0),
      transfer_rate: 0,
      submission_rate: 0,
      active_agents: Object.keys(licensedAgents).length
    };

    const retentionTeam: TeamStats = {
      total_calls: Object.values(retentionAgents).reduce((sum, agent) => sum + agent.picked_up_calls, 0),
      total_transfers: Object.values(retentionAgents).reduce((sum, agent) => sum + agent.transferred_calls, 0),
      total_submissions: Object.values(retentionAgents).reduce((sum, agent) => sum + agent.submitted_calls, 0),
      total_drops: Object.values(retentionAgents).reduce((sum, agent) => sum + agent.dropped_calls, 0),
      transfer_rate: 0,
      submission_rate: 0,
      active_agents: Object.keys(retentionAgents).length
    };

    bufferTeam.transfer_rate = bufferTeam.total_calls > 0 ? (bufferTeam.total_transfers / bufferTeam.total_calls) * 100 : 0;
    bufferTeam.submission_rate = bufferTeam.total_calls > 0 ? (bufferTeam.total_submissions / bufferTeam.total_calls) * 100 : 0;

    licensedTeam.submission_rate = licensedTeam.total_calls > 0 ? (licensedTeam.total_submissions / licensedTeam.total_calls) * 100 : 0;

    retentionTeam.transfer_rate = retentionTeam.total_calls > 0 ? (retentionTeam.total_transfers / retentionTeam.total_calls) * 100 : 0;
    retentionTeam.submission_rate = retentionTeam.total_calls > 0 ? (retentionTeam.total_submissions / retentionTeam.total_calls) * 100 : 0;

    const result = {
      bufferAgents: Object.values(bufferAgents).sort((a, b) => b.picked_up_calls - a.picked_up_calls),
      licensedAgents: Object.values(licensedAgents).sort((a, b) => b.picked_up_calls - a.picked_up_calls),
      retentionAgents: Object.values(retentionAgents).sort((a, b) => b.picked_up_calls - a.picked_up_calls),
      bufferTeam,
      licensedTeam,
      retentionTeam
    };

    return result;
  };

  useEffect(() => {
    fetchAgentStats();
  }, [dateFilter, dateFromFilter, dateToFilter]);

  const handleRefresh = () => {
    fetchAgentStats(true);
  };

  const handleDateFilterChange = (date: Date | undefined) => {
    setDateFilter(date);
    if (date) {
      setDateFromFilter(undefined);
      setDateToFilter(undefined);
    }
  };

  const handleDateFromFilterChange = (date: Date | undefined) => {
    setDateFromFilter(date);
    if (date || dateToFilter) {
      setDateFilter(undefined);
    }
  };

  const handleDateToFilterChange = (date: Date | undefined) => {
    setDateToFilter(date);
    if (date || dateFromFilter) {
      setDateFilter(undefined);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading Reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">
                Comprehensive performance analytics for Buffer and Licensed Agent teams
              </p>
            </div>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Date Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Date Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="single-date">Specific Date</Label>
                  <DatePicker
                    date={dateFilter}
                    onDateChange={handleDateFilterChange}
                    placeholder="Pick a date"
                  />
                </div>

                <div>
                  <Label htmlFor="date-from">Date From</Label>
                  <DatePicker
                    date={dateFromFilter}
                    onDateChange={handleDateFromFilterChange}
                    placeholder="Pick start date"
                  />
                </div>

                <div>
                  <Label htmlFor="date-to">Date To</Label>
                  <DatePicker
                    date={dateToFilter}
                    onDateChange={handleDateToFilterChange}
                    placeholder="Pick end date"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Buffer Team Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Buffer Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{bufferTeamStats?.total_calls || 0}</div>
                    <div className="text-sm text-muted-foreground">Picked Up</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{bufferTeamStats?.total_transfers || 0}</div>
                    <div className="text-sm text-muted-foreground">Transferred</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{bufferTeamStats?.total_submissions || 0}</div>
                    <div className="text-sm text-muted-foreground">Submitted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{bufferTeamStats?.total_drops || 0}</div>
                    <div className="text-sm text-muted-foreground">Dropped</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Transfer Rate:</span>
                    <Badge variant="secondary">{bufferTeamStats?.transfer_rate.toFixed(1) || 0}%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <Badge variant="secondary">{bufferTeamStats?.submission_rate.toFixed(1) || 0}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Licensed Team Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-green-500" />
                  Licensed Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{licensedTeamStats?.total_calls || 0}</div>
                    <div className="text-sm text-muted-foreground">Picked Up</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{licensedTeamStats?.total_submissions || 0}</div>
                    <div className="text-sm text-muted-foreground">Submitted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{licensedTeamStats?.total_drops || 0}</div>
                    <div className="text-sm text-muted-foreground">Dropped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{licensedTeamStats?.active_agents || 0}</div>
                    <div className="text-sm text-muted-foreground">Active Agents</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <Badge variant="secondary">{licensedTeamStats?.submission_rate.toFixed(1) || 0}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Retention Team Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PhoneCall className="h-5 w-5 text-orange-500" />
                  Retention Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{retentionStats.length || 0}</div>
                    <div className="text-sm text-muted-foreground">Active Agents</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {retentionStats.reduce((sum, agent) => sum + agent.picked_up_calls, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Calls</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {retentionStats.reduce((sum, agent) => sum + agent.transferred_calls, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Transferred</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {retentionStats.reduce((sum, agent) => sum + agent.submitted_calls, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Submitted</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Agent Stats */}
          <Tabs defaultValue="buffer" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="buffer">Buffer Agents</TabsTrigger>
              <TabsTrigger value="licensed">Licensed Agents</TabsTrigger>
              <TabsTrigger value="retention">Retention Agents</TabsTrigger>
            </TabsList>

            <TabsContent value="buffer" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Buffer Agent Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Agent</th>
                          <th className="text-center p-2">Picked Up</th>
                          <th className="text-center p-2">Dropped</th>
                          <th className="text-center p-2">Submitted</th>
                          <th className="text-center p-2">Not Submitted</th>
                          <th className="text-center p-2">Transferred</th>
                          <th className="text-center p-2">Notes</th>
                          <th className="text-center p-2">Success Rate</th>
                          <th className="text-center p-2">Transfer Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bufferStats.map((agent) => (
                          <tr key={agent.agent_name} className="border-b">
                            <td className="p-2 font-medium">{agent.agent_name}</td>
                            <td className="text-center p-2">{agent.picked_up_calls}</td>
                            <td className="text-center p-2">{agent.dropped_calls}</td>
                            <td className="text-center p-2">{agent.submitted_calls}</td>
                            <td className="text-center p-2">{agent.not_submitted_calls}</td>
                            <td className="text-center p-2">{agent.transferred_calls}</td>
                            <td className="text-center p-2">{agent.notes_count}</td>
                            <td className="text-center p-2">
                              <Badge variant={agent.success_rate > 50 ? "default" : "secondary"}>
                                {agent.success_rate.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="text-center p-2">
                              <Badge variant={agent.transfer_rate > 70 ? "default" : "secondary"}>
                                {agent.transfer_rate.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="licensed" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Licensed Agent Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Agent</th>
                          <th className="text-center p-2">Picked Up</th>
                          <th className="text-center p-2">Dropped</th>
                          <th className="text-center p-2">Submitted</th>
                          <th className="text-center p-2">Not Submitted</th>
                          <th className="text-center p-2">Success Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {licensedStats.map((agent) => (
                          <tr key={agent.agent_name} className="border-b">
                            <td className="p-2 font-medium">{agent.agent_name}</td>
                            <td className="text-center p-2">{agent.picked_up_calls}</td>
                            <td className="text-center p-2">{agent.dropped_calls}</td>
                            <td className="text-center p-2">{agent.submitted_calls}</td>
                            <td className="text-center p-2">{agent.not_submitted_calls}</td>
                            <td className="text-center p-2">
                              <Badge variant={agent.success_rate > 60 ? "default" : "secondary"}>
                                {agent.success_rate.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retention" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Retention Agent Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Agent</th>
                          <th className="text-center p-2">Picked Up</th>
                          <th className="text-center p-2">Dropped</th>
                          <th className="text-center p-2">Submitted</th>
                          <th className="text-center p-2">Not Submitted</th>
                          <th className="text-center p-2">Transferred</th>
                          <th className="text-center p-2">Notes</th>
                          <th className="text-center p-2">Success Rate</th>
                          <th className="text-center p-2">Transfer Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retentionStats.map((agent) => (
                          <tr key={agent.agent_name} className="border-b">
                            <td className="p-2 font-medium">{agent.agent_name}</td>
                            <td className="text-center p-2">{agent.picked_up_calls}</td>
                            <td className="text-center p-2">{agent.dropped_calls}</td>
                            <td className="text-center p-2">{agent.submitted_calls}</td>
                            <td className="text-center p-2">{agent.not_submitted_calls}</td>
                            <td className="text-center p-2">{agent.transferred_calls}</td>
                            <td className="text-center p-2">{agent.notes_count}</td>
                            <td className="text-center p-2">
                              <Badge variant={agent.success_rate > 50 ? "default" : "secondary"}>
                                {agent.success_rate.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="text-center p-2">
                              <Badge variant={agent.transfer_rate > 70 ? "default" : "secondary"}>
                                {agent.transfer_rate.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;