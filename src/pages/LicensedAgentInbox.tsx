import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Clock, Inbox, Eye, Search, Filter, FileEdit, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fetchBoardItems, isMondayApiConfigured, type ParsedPolicyItem } from "@/lib/mondayApi";

interface AppFixTask {
  id: string;
  submission_id: string;
  customer_name: string | null;
  fix_type: string;
  status: string;
  created_by_name: string | null;
  assigned_to_name: string | null;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
}

const LicensedAgentInbox = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AppFixTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTaskType, setFilterTaskType] = useState<string>("all");
  const [filterCreatedBy, setFilterCreatedBy] = useState<string>("all");
  
  // Monday.com policy placements state
  const [policyPlacements, setPolicyPlacements] = useState<ParsedPolicyItem[]>([]);
  const [filteredPolicyPlacements, setFilteredPolicyPlacements] = useState<ParsedPolicyItem[]>([]);
  const [policyPlacementsLoading, setPolicyPlacementsLoading] = useState(false);
  const [policySearchTerm, setPolicySearchTerm] = useState("");
  const [policyCurrentPage, setPolicyCurrentPage] = useState(1);
  const [policyItemsPerPage] = useState(100);
  
  const { toast } = useToast();

  // Helper function to get column value by ID from Monday.com
  const getColumnValue = (item: ParsedPolicyItem, columnId: string): string => {
    const column = item.column_values?.find(col => col.id === columnId);
    return column?.text || '';
  };

  // Map user email to sales agent name for filtering
  const getSalesAgentName = async (): Promise<string | undefined> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return undefined;
      
      const emailToAgentMap: Record<string, string> = {
        'isaac.r@heritageinsurance.io': 'Isaac Reed',
        'benjamin.w@unlimitedinsurance.io': 'Benjamin Wunder',
        'lydia.s@unlimitedinsurance.io': 'Lydia Sutton',
        'noah@unlimitedinsurance.io': 'Noah Brock',
        'tatumn.s@heritageinsurance.io': 'Trinity Queen'
      };
      
      return emailToAgentMap[user.email.toLowerCase()];
    } catch (error) {
      console.error('Error getting sales agent name:', error);
      return undefined;
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);

      const { data: tasksData, error } = await supabase
        .from('app_fix_tasks' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching tasks:", error);
        toast({
          title: "Error",
          description: "Failed to fetch tasks",
          variant: "destructive",
        });
        return;
      }

      setTasks((tasksData as any) || []);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicyPlacements = async () => {
    setPolicyPlacementsLoading(true);

    try {
      // Check if Monday.com API is configured
      if (!isMondayApiConfigured()) {
        console.warn('Monday.com API token not configured');
        toast({
          title: "Configuration Required",
          description: "Monday.com API token is not configured. Please add VITE_MONDAY_API_TOKEN to your environment variables.",
          variant: "default",
        });
        setPolicyPlacements([]);
        return;
      }

      // Get sales agent name based on logged-in user's email
      const salesAgentName = await getSalesAgentName();
      console.log(`[Licensed Agent Inbox] Fetching policy placements${salesAgentName ? ` for agent: ${salesAgentName}` : ''}...`);
      
      // Fetch items from Monday.com board - filter by agent if mapped
      const items = await fetchBoardItems(salesAgentName);
      console.log(`[Licensed Agent Inbox] Fetched ${items.length} policy items`);

      // Show all items (no status filtering)
      setPolicyPlacements(items);
      setFilteredPolicyPlacements(items);
      
      if (items.length > 0) {
        toast({
          title: "Policy Placements Loaded",
          description: `Loaded ${items.length} policies from Monday.com`,
        });
      }
    } catch (error) {
      console.error('Error fetching Monday.com placements:', error);
      toast({
        title: "Error fetching placements",
        description: "Unable to load policy placements from Monday.com. Please try again.",
        variant: "destructive",
      });
      setPolicyPlacements([]);
    } finally {
      setPolicyPlacementsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchPolicyPlacements();
  }, []);

  // Apply policy placement filters
  useEffect(() => {
    let filtered = policyPlacements;

    // Search filter (by client name)
    if (policySearchTerm) {
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(policySearchTerm.toLowerCase())
      );
    }

    setFilteredPolicyPlacements(filtered);
    setPolicyCurrentPage(1); // Reset to first page when filters change
  }, [policyPlacements, policySearchTerm]);

  // Pagination functions for policy placements
  const getPaginatedPolicies = () => {
    const startIndex = (policyCurrentPage - 1) * policyItemsPerPage;
    const endIndex = startIndex + policyItemsPerPage;
    return filteredPolicyPlacements.slice(startIndex, endIndex);
  };

  const getPolicyTotalPages = () => {
    return Math.ceil(filteredPolicyPlacements.length / policyItemsPerPage);
  };

  const handlePolicyPageChange = (page: number) => {
    const total = getPolicyTotalPages();
    if (page < 1) page = 1;
    if (page > total) page = total;
    setPolicyCurrentPage(page);
  };

  const handleViewDetails = (task: AppFixTask) => {
    navigate(`/task/${task.id}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          In Progress
        </Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFixTypeLabel = (fixType: string) => {
    switch (fixType) {
      case 'banking_info':
        return 'Banking Info';
      case 'carrier_requirement':
        return 'Carrier Requirement';
      case 'updated_banking_info': // Legacy support
        return 'Banking Update';
      default:
        return fixType;
    }
  };

  // Filter tasks based on search and filters
  const filterTasks = (taskList: AppFixTask[]) => {
    return taskList.filter(task => {
      // Search filter (customer name or submission ID)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        task.customer_name?.toLowerCase().includes(searchLower) ||
        task.submission_id.toLowerCase().includes(searchLower);

      // Task type filter
      const matchesTaskType = filterTaskType === 'all' || task.fix_type === filterTaskType;

      // Created by filter
      const matchesCreatedBy = filterCreatedBy === 'all' || 
        task.created_by_name?.toLowerCase() === filterCreatedBy.toLowerCase();

      return matchesSearch && matchesTaskType && matchesCreatedBy;
    });
  };

  // Get unique creator names for filter dropdown
  const uniqueCreators = Array.from(new Set(
    tasks.map(t => t.created_by_name).filter(Boolean)
  )).sort();

  const pendingTasks = filterTasks(tasks.filter(t => t.status === 'pending' || t.status === 'in_progress'));
  const completedTasks = filterTasks(tasks.filter(t => t.status === 'completed'));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading Inbox...</span>
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
                Manage app fix tasks assigned to you
              </p>
            </div>
            <Button variant="outline" onClick={fetchTasks}>
              <Loader2 className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Customer name or Submission ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Task Type Filter */}
                <div className="space-y-2">
                  <Label htmlFor="taskType">Task Type</Label>
                  <Select value={filterTaskType} onValueChange={setFilterTaskType}>
                    <SelectTrigger id="taskType">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="banking_info">Banking Info</SelectItem>
                      <SelectItem value="carrier_requirement">Carrier Requirement</SelectItem>
                      <SelectItem value="updated_banking_info">Banking Update (Legacy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Created By Filter */}
                <div className="space-y-2">
                  <Label htmlFor="createdBy">Created By</Label>
                  <Select value={filterCreatedBy} onValueChange={setFilterCreatedBy}>
                    <SelectTrigger id="createdBy">
                      <SelectValue placeholder="All agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {uniqueCreators.map((creator) => (
                        <SelectItem key={creator} value={creator || 'unknown'}>
                          {creator || 'Unknown Agent'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters */}
              {(searchTerm || filterTaskType !== 'all' || filterCreatedBy !== 'all') && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterTaskType("all");
                      setFilterCreatedBy("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-3xl grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Immediate Pending Task ({pendingTasks.length})
              </TabsTrigger>
              <TabsTrigger value="policy-fix" className="flex items-center gap-2">
                <FileEdit className="h-4 w-4" />
                Pending Policy Fix ({filteredPolicyPlacements.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Completed ({completedTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground text-lg">No pending tasks</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        All caught up!
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Submission ID</TableHead>
                            <TableHead>Task Type</TableHead>
                            <TableHead>Assigned By</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingTasks.map((task) => (
                            <TableRow key={task.id}>
                              <TableCell className="font-medium">
                                {task.customer_name || 'N/A'}
                              </TableCell>
                              <TableCell>{task.submission_id}</TableCell>
                              <TableCell>{getFixTypeLabel(task.fix_type)}</TableCell>
                              <TableCell>{task.created_by_name || 'N/A'}</TableCell>
                              <TableCell>
                                {format(new Date(task.created_at), 'MM/dd/yyyy HH:mm')}
                              </TableCell>
                              <TableCell>{getStatusBadge(task.status)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDetails(task)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View & Complete
                                  </Button>
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
            </TabsContent>

            <TabsContent value="policy-fix" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Pending Policy Fixes (Monday.com)</span>
                    <Button variant="outline" size="sm" onClick={fetchPolicyPlacements}>
                      <Loader2 className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Policy Filters */}
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="policySearch">Search Client Name</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="policySearch"
                          placeholder="Search by client name..."
                          value={policySearchTerm}
                          onChange={(e) => setPolicySearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>

                  {policyPlacementsLoading ? (
                    <div className="text-center py-12">
                      <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-3" />
                      <p className="text-muted-foreground text-lg">Loading policy placements...</p>
                    </div>
                  ) : !isMondayApiConfigured() ? (
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-3" />
                      <p className="text-muted-foreground text-lg">Monday.com API not configured</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Please add VITE_MONDAY_API_TOKEN to environment variables
                      </p>
                    </div>
                  ) : filteredPolicyPlacements.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                      <p className="text-muted-foreground text-lg">No policies need fixing</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        All policies are in good standing!
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Client Name</TableHead>
                              <TableHead>Sales Agent</TableHead>
                              <TableHead>Carrier</TableHead>
                              <TableHead>Premium</TableHead>
                              <TableHead>Issue Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Issue Type</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getPaginatedPolicies().map((item) => {
                            const salesAgent = getColumnValue(item, 'color_mkq0rkaw');
                            const carrier = getColumnValue(item, 'text_mkq0ro7j');
                            const premium = getColumnValue(item, 'numbers');
                            const issueDate = getColumnValue(item, 'date_mkq1d86z');
                            const status = getColumnValue(item, 'status');
                            const issueType = getColumnValue(item, 'text');

                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.name || 'N/A'}
                                </TableCell>
                                <TableCell>{salesAgent || 'N/A'}</TableCell>
                                <TableCell>{carrier || 'N/A'}</TableCell>
                                <TableCell>
                                  {premium ? `$${premium}` : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  {issueDate ? format(new Date(issueDate), 'MM/dd/yyyy') : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-muted-foreground">
                                    {issueType || 'Not specified'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      // Open Monday.com item in new tab
                                      const boardId = import.meta.env.VITE_MONDAY_BOARD_ID || '18027763264';
                                      window.open(`https://unlimitedinsuranceagencyinc.monday.com/boards/${boardId}/pulses/${item.id}`, '_blank');
                                    }}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View in Monday.com
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination Controls */}
                    {getPolicyTotalPages() > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {((policyCurrentPage - 1) * policyItemsPerPage) + 1} to {Math.min(policyCurrentPage * policyItemsPerPage, filteredPolicyPlacements.length)} of {filteredPolicyPlacements.length} policies
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePolicyPageChange(1)}
                            disabled={policyCurrentPage === 1}
                          >
                            First
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePolicyPageChange(policyCurrentPage - 1)}
                            disabled={policyCurrentPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm">
                            Page {policyCurrentPage} of {getPolicyTotalPages()}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePolicyPageChange(policyCurrentPage + 1)}
                            disabled={policyCurrentPage === getPolicyTotalPages()}
                          >
                            Next
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePolicyPageChange(getPolicyTotalPages())}
                            disabled={policyCurrentPage === getPolicyTotalPages()}
                          >
                            Last
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Completed Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  {completedTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground text-lg">No completed tasks</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Submission ID</TableHead>
                            <TableHead>Task Type</TableHead>
                            <TableHead>Assigned By</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {completedTasks.map((task) => (
                            <TableRow key={task.id}>
                              <TableCell className="font-medium">
                                {task.customer_name || 'N/A'}
                              </TableCell>
                              <TableCell>{task.submission_id}</TableCell>
                              <TableCell>{getFixTypeLabel(task.fix_type)}</TableCell>
                              <TableCell>{task.created_by_name || 'N/A'}</TableCell>
                              <TableCell>
                                {task.completed_at 
                                  ? format(new Date(task.completed_at), 'MM/dd/yyyy HH:mm')
                                  : 'N/A'}
                              </TableCell>
                              <TableCell>{getStatusBadge(task.status)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(task)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default LicensedAgentInbox;
