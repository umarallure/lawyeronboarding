import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Download, Users, Phone, PhoneCall, UserCheck, TrendingUp, TrendingDown, FileSpreadsheet, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getAgentStats, getCallLogs } from "@/lib/callLogging";
import { supabase } from "@/integrations/supabase/client";

interface AgentStat {
  log_date: string;
  agent_id: string;
  agent_name: string;
  agent_type: 'buffer' | 'licensed';
  picked_up_calls: number;
  dropped_calls: number;
  not_submitted: number;
  submitted_sales: number;
  disconnected_calls: number;
  transferred_to_agent_calls: number;
  not_submitted_transfers: number;
  submitted_transfers_sales: number;
}

interface CallLog {
  id: string;
  submission_id: string;
  agent_id: string;
  agent_name: string;
  agent_type: 'buffer' | 'licensed';
  event_type: string;
  event_details: any;
  customer_name: string;
  lead_vendor: string;
  created_at: string;
}

export const AgentReportsAndLogs = () => {
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgentType, setSelectedAgentType] = useState<'all' | 'buffer' | 'licensed'>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [agents, setAgents] = useState<{ id: string; name: string; type: string }[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    loadAgents();
    loadData();
  }, []);

  useEffect(() => {
    if (agents.length > 0) {
      loadData();
    }
  }, [selectedAgentType, selectedAgentId, startDate, endDate]);

  const loadAgents = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      const { data: agentStatus } = await supabase
        .from('agent_status')
        .select('user_id, agent_type');

      if (profiles && agentStatus) {
        const agentsList = profiles
          .map(profile => {
            const status = agentStatus.find(s => s.user_id === profile.user_id);
            if (status) {
              return {
                id: profile.user_id,
                name: profile.display_name || 'Unknown',
                type: status.agent_type
              };
            }
            return null;
          })
          .filter(Boolean) as { id: string; name: string; type: string }[];

        setAgents(agentsList);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculate default date range in EST timezone if no dates are selected
      let defaultStartDate: string | undefined;
      let defaultEndDate: string | undefined;
      
      if (!startDate && !endDate) {
        // Use current EST date as default when no dates are selected
        const now = new Date();
        const isDST = now.getUTCMonth() >= 2 && now.getUTCMonth() <= 10;
        const estOffset = isDST ? -4 : -5;
        const nowEST = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
        const todayEST = new Date(Date.UTC(nowEST.getUTCFullYear(), nowEST.getUTCMonth(), nowEST.getUTCDate()));
        
        defaultStartDate = format(todayEST, 'yyyy-MM-dd');
        defaultEndDate = format(todayEST, 'yyyy-MM-dd');
      }

      // Load agent stats
      const stats = await getAgentStats(
        selectedAgentId === 'all' ? undefined : selectedAgentId,
        selectedAgentType === 'all' ? undefined : selectedAgentType,
        startDate ? format(startDate, 'yyyy-MM-dd') : defaultStartDate,
        endDate ? format(endDate, 'yyyy-MM-dd') : defaultEndDate
      );

      if (stats) {
        setAgentStats(stats);
      }

      // Load call logs
      const logs = await getCallLogs(
        undefined, // submissionId
        selectedAgentId === 'all' ? undefined : selectedAgentId,
        undefined, // eventType
        startDate ? format(startDate, 'yyyy-MM-dd') : defaultStartDate,
        endDate ? format(endDate, 'yyyy-MM-dd') : defaultEndDate
      );

      if (logs) {
        setCallLogs(logs);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load reports data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    loadData();
  };

  const exportData = (data: any[], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      Object.keys(data[0]).join(",") + "\n" +
      data.map(row => Object.values(row).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'verification_started': return 'bg-blue-100 text-blue-800';
      case 'call_picked_up': return 'bg-green-100 text-green-800';
      case 'call_claimed': return 'bg-purple-100 text-purple-800';
      case 'call_dropped': return 'bg-red-100 text-red-800';
      case 'call_disconnected': return 'bg-yellow-100 text-yellow-800';
      case 'transferred_to_la': return 'bg-indigo-100 text-indigo-800';
      case 'transferred_to_licensed_agent': return 'bg-cyan-100 text-cyan-800';
      case 'application_submitted': return 'bg-emerald-100 text-emerald-800';
      case 'application_not_submitted': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Calculate summary statistics
  const summaryStats = agentStats.reduce((acc, stat) => {
    if (stat.agent_type === 'licensed') {
      acc.la_picked_up += stat.picked_up_calls;
      acc.la_dropped += stat.dropped_calls;
      acc.la_not_submitted += stat.not_submitted;
      acc.la_submitted += stat.submitted_sales;
    } else {
      acc.buffer_picked_up += stat.picked_up_calls;
      acc.buffer_dropped += stat.dropped_calls;
      acc.buffer_disconnected += stat.disconnected_calls;
      acc.buffer_transferred += stat.transferred_to_agent_calls;
      acc.buffer_not_submitted += stat.not_submitted_transfers;
      acc.buffer_submitted += stat.submitted_transfers_sales;
    }
    return acc;
  }, {
    la_picked_up: 0, la_dropped: 0, la_not_submitted: 0, la_submitted: 0,
    buffer_picked_up: 0, buffer_dropped: 0, buffer_disconnected: 0, buffer_transferred: 0, 
    buffer_not_submitted: 0, buffer_submitted: 0
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Agent Reports & Call Logs</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export Data
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Export Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => exportData(agentStats, 'agent_stats')}>
              <Download className="mr-2 h-4 w-4" />
              Export Agent Stats
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportData(callLogs, 'call_logs')}>
              <Download className="mr-2 h-4 w-4" />
              Export Call Logs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <p className="text-sm text-muted-foreground">
            {!startDate && !endDate ? "Showing today's data in EST timezone by default" : "Custom date range selected"}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Agent Type</Label>
              <Select value={selectedAgentType} onValueChange={(value: 'all' | 'buffer' | 'licensed') => setSelectedAgentType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  <SelectItem value="buffer">Buffer Agents</SelectItem>
                  <SelectItem value="licensed">Licensed Agents</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Specific Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents
                    .filter(agent => selectedAgentType === 'all' || agent.type === selectedAgentType)
                    .map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.type})
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleFilterChange} disabled={loading}>
              {loading ? 'Loading...' : 'Apply Filters'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">LA Picked Up</p>
                <p className="text-2xl font-bold">{summaryStats.la_picked_up}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">LA Dropped</p>
                <p className="text-2xl font-bold">{summaryStats.la_dropped}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">LA Sales</p>
                <p className="text-2xl font-bold">{summaryStats.la_submitted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Buffer Picked Up</p>
                <p className="text-2xl font-bold">{summaryStats.buffer_picked_up}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Buffer Transferred</p>
                <p className="text-2xl font-bold">{summaryStats.buffer_transferred}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stats">Agent Statistics</TabsTrigger>
          <TabsTrigger value="logs">Call Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 p-2 text-left">Date</th>
                      <th className="border border-gray-300 p-2 text-left">Agent</th>
                      <th className="border border-gray-300 p-2 text-left">Type</th>
                      <th className="border border-gray-300 p-2 text-center">Picked Up</th>
                      <th className="border border-gray-300 p-2 text-center">Dropped/Disc.</th>
                      <th className="border border-gray-300 p-2 text-center">Transferred</th>
                      <th className="border border-gray-300 p-2 text-center">Not Submitted</th>
                      <th className="border border-gray-300 p-2 text-center">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map((stat, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">{format(new Date(stat.log_date), 'MMM dd, yyyy')}</td>
                        <td className="border border-gray-300 p-2">{stat.agent_name}</td>
                        <td className="border border-gray-300 p-2">
                          <Badge variant={stat.agent_type === 'licensed' ? 'default' : 'secondary'}>
                            {stat.agent_type}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 p-2 text-center">{stat.picked_up_calls}</td>
                        <td className="border border-gray-300 p-2 text-center">
                          {stat.agent_type === 'licensed' ? stat.dropped_calls : (stat.dropped_calls + stat.disconnected_calls)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {stat.agent_type === 'buffer' ? stat.transferred_to_agent_calls : '-'}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {stat.agent_type === 'licensed' ? stat.not_submitted : stat.not_submitted_transfers}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {stat.agent_type === 'licensed' ? stat.submitted_sales : stat.submitted_transfers_sales}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Call Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 p-2 text-left">Timestamp</th>
                      <th className="border border-gray-300 p-2 text-left">Agent</th>
                      <th className="border border-gray-300 p-2 text-left">Type</th>
                      <th className="border border-gray-300 p-2 text-left">Event</th>
                      <th className="border border-gray-300 p-2 text-left">Customer</th>
                      <th className="border border-gray-300 p-2 text-left">Lead Vendor</th>
                      <th className="border border-gray-300 p-2 text-left">Submission ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                        </td>
                        <td className="border border-gray-300 p-2">{log.agent_name}</td>
                        <td className="border border-gray-300 p-2">
                          <Badge variant={log.agent_type === 'licensed' ? 'default' : 'secondary'}>
                            {log.agent_type}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Badge className={getEventTypeColor(log.event_type)}>
                            {formatEventType(log.event_type)}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 p-2">{log.customer_name || '-'}</td>
                        <td className="border border-gray-300 p-2">{log.lead_vendor || '-'}</td>
                        <td className="border border-gray-300 p-2 text-sm">{log.submission_id}</td>
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
  );
};
