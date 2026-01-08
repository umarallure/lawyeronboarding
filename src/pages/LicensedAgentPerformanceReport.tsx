import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Download, TrendingUp, UserCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dateObjectToESTString } from "@/lib/dateUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LicensedAgentStats {
  agent: string;
  total_calls: number;
  status_breakdown: Record<string, number>;
}

const LicensedAgentPerformanceReport = () => {
  const [data, setData] = useState<LicensedAgentStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  
  // Set default date range to last one month
  const getDefaultFromDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  };
  
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>(getDefaultFromDate());
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>(new Date());
  
  const { toast } = useToast();

  const fetchLicensedAgentPerformance = async (showRefreshToast = false) => {
    try {
      setRefreshing(true);

      // Build query to fetch all daily_deal_flow records with licensed agents
      let query = supabase
        .from('daily_deal_flow')
        .select('agent, status, call_result', { count: 'exact' })
        .not('agent', 'is', null)
        .not('agent', 'eq', '')
        .not('agent', 'eq', 'N/A');

      // Apply date range filter if set
      if (dateFromFilter) {
        const dateFromStr = dateObjectToESTString(dateFromFilter);
        query = query.gte('date', dateFromStr);
      }

      if (dateToFilter) {
        const dateToStr = dateObjectToESTString(dateToFilter);
        query = query.lte('date', dateToStr);
      }

      // Apply agent filter if specific agent is selected
      if (selectedAgent !== "all") {
        query = query.eq('agent', selectedAgent);
      }

      const { data: flowData, error, count } = await query;

      if (error) {
        console.error("Error fetching licensed agent performance data:", error);
        toast({
          title: "Error",
          description: "Failed to fetch licensed agent performance data",
          variant: "destructive",
        });
        return;
      }

      if (!flowData || flowData.length === 0) {
        setData([]);
        if (showRefreshToast) {
          toast({
            title: "No Data",
            description: "No licensed agent data found for the selected date range",
          });
        }
        return;
      }

      // Process data to calculate stats per licensed agent
      const agentMap = new Map<string, LicensedAgentStats>();

      flowData.forEach((row) => {
        const agent = row.agent;
        if (!agent) return;

        if (!agentMap.has(agent)) {
          agentMap.set(agent, {
            agent: agent,
            total_calls: 0,
            status_breakdown: {},
          });
        }

        const stats = agentMap.get(agent)!;
        stats.total_calls++;

        // Track status breakdown
        const status = row.status || 'No Status';
        if (!stats.status_breakdown[status]) {
          stats.status_breakdown[status] = 0;
        }
        stats.status_breakdown[status]++;
      });

      // Convert to array
      const agentStats: LicensedAgentStats[] = Array.from(agentMap.values());

      // Sort by total calls (highest first)
      agentStats.sort((a, b) => b.total_calls - a.total_calls);

      setData(agentStats);

      if (showRefreshToast) {
        toast({
          title: "Success",
          description: `Loaded performance data for ${agentStats.length} licensed agents (${count || flowData.length} total records)`,
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

  const fetchAvailableAgents = async () => {
    try {
      // Predefined list of licensed agents
      const predefinedAgents = [
        'Lydia',
        'Isaac',
        'Tatumn',
        'Noah',
        'Zack',
        'Benjamin',
        'Claudia',
        'Angy',
        'Erica',
        'Juan'
      ];
      
      setAvailableAgents(predefinedAgents.sort());
    } catch (error) {
      console.error("Error:", error);
    }
  };

  useEffect(() => {
    fetchAvailableAgents();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLicensedAgentPerformance();
  }, [dateFromFilter, dateToFilter, selectedAgent]);

  const handleRefresh = () => {
    fetchLicensedAgentPerformance(true);
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast({
        title: "No Data",
        description: "No data to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV headers
    const allStatuses = new Set<string>();
    data.forEach(agent => {
      Object.keys(agent.status_breakdown).forEach(status => allStatuses.add(status));
    });
    const statusColumns = Array.from(allStatuses).sort();

    const headers = [
      'Licensed Agent',
      'Total Call Updates',
      ...statusColumns,
    ];

    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(agent => [
        agent.agent,
        agent.total_calls,
        ...statusColumns.map(status => agent.status_breakdown[status] || 0),
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    let filename = `licensed-agent-performance-${new Date().toISOString().split('T')[0]}`;
    if (dateFromFilter || dateToFilter) {
      filename += '-range';
    }
    filename += '.csv';
    
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Successfully exported performance data for ${data.length} licensed agents`,
    });
  };

  const getTotalCalls = () => data.reduce((sum, agent) => sum + agent.total_calls, 0);

  if (loading && data.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading Licensed Agent Performance Report...</span>
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
                Analyze licensed agent performance with status breakdowns
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleExportCSV}
                disabled={data.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date-from">From Date</Label>
                  <DatePicker
                    date={dateFromFilter}
                    onDateChange={setDateFromFilter}
                    placeholder="Select start date"
                  />
                </div>
                <div>
                  <Label htmlFor="date-to">To Date</Label>
                  <DatePicker
                    date={dateToFilter}
                    onDateChange={setDateToFilter}
                    placeholder="Select end date"
                  />
                </div>
                <div>
                  <Label htmlFor="agent-filter">Licensed Agent</Label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {availableAgents.map((agent) => (
                        <SelectItem key={agent} value={agent}>
                          {agent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-500" />
                  Active Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.length}</div>
                <p className="text-xs text-muted-foreground">
                  Licensed agents with activity
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Total Call Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getTotalCalls()}</div>
                <p className="text-xs text-muted-foreground">
                  Across all licensed agents
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Licensed Agent Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {data.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg">No data found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your date range filter
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Licensed Agent</TableHead>
                        <TableHead className="text-center">Total Call Updates</TableHead>
                        <TableHead>Status Breakdown</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((agent) => (
                        <TableRow key={agent.agent}>
                          <TableCell className="font-medium">{agent.agent}</TableCell>
                          <TableCell className="text-center">{agent.total_calls}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(agent.status_breakdown)
                                .sort((a, b) => b[1] - a[1])
                                .map(([status, count]) => (
                                  <Badge 
                                    key={status} 
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {status}: {count}
                                  </Badge>
                                ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LicensedAgentPerformanceReport;
