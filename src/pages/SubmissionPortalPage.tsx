import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Download } from "lucide-react";

export interface SubmissionPortalRow {
  id: string;
  submission_id: string;
  date?: string;
  insured_name?: string;
  lead_vendor?: string;
  client_phone_number?: string;
  buffer_agent?: string;
  agent?: string;
  licensed_agent_account?: string;
  status?: string;
  call_result?: string;
  carrier?: string;
  product_type?: string;
  draft_date?: string;
  monthly_premium?: number;
  face_amount?: number;
  from_callback?: boolean;
  notes?: string;
  policy_number?: string;
  carrier_audit?: string;
  product_type_carrier?: string;
  level_or_gi?: string;
  created_at?: string;
  updated_at?: string;
  application_submitted?: boolean;
  sent_to_underwriting?: boolean;
  submission_date?: string;
  dq_reason?: string;
  call_source?: string;
  submission_source?: string;
  verification_logs?: string;
  has_submission_data?: boolean;
  source_type?: string;
}

interface CallLog {
  agent_type: string;
  agent_name: string;
  event_type: string;
  created_at: string;
}

const SubmissionPortalPage = () => {
  const [data, setData] = useState<SubmissionPortalRow[]>([]);
  const [filteredData, setFilteredData] = useState<SubmissionPortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("__ALL__");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [dataCompletenessFilter, setDataCompletenessFilter] = useState("__ALL__");
  const itemsPerPage = 50;

  const { toast } = useToast();

  // Remove duplicates based on insured_name, client_phone_number, and lead_vendor
  const removeDuplicates = (records: SubmissionPortalRow[]): SubmissionPortalRow[] => {
    const seen = new Map<string, SubmissionPortalRow>();
    
    records.forEach(record => {
      const key = `${record.insured_name || ''}|${record.client_phone_number || ''}|${record.lead_vendor || ''}`;
      
      // Keep the most recent record (first in our sorted array)
      if (!seen.has(key)) {
        seen.set(key, record);
      }
    });
    
    return Array.from(seen.values());
  };

  // Apply filters and duplicate removal
  const applyFilters = (records: SubmissionPortalRow[]): SubmissionPortalRow[] => {
    let filtered = records;

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter(record => record.date === dateFilter);
    }

    // Apply status filter
    if (statusFilter !== "__ALL__") {
      filtered = filtered.filter(record => record.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        (record.insured_name?.toLowerCase().includes(searchLower)) ||
        (record.client_phone_number?.toLowerCase().includes(searchLower)) ||
        (record.lead_vendor?.toLowerCase().includes(searchLower)) ||
        (record.agent?.toLowerCase().includes(searchLower)) ||
        (record.buffer_agent?.toLowerCase().includes(searchLower)) ||
        (record.licensed_agent_account?.toLowerCase().includes(searchLower)) ||
        (record.carrier?.toLowerCase().includes(searchLower)) ||
        (record.product_type?.toLowerCase().includes(searchLower))
      );
    }

    // Remove duplicates if enabled
    if (!showDuplicates) {
      filtered = removeDuplicates(filtered);
    }

    // Apply data completeness filter
    if (dataCompletenessFilter === "active_only") {
      filtered = filtered.filter(record => 
        record.has_submission_data && 
        record.status !== "Submitted"
      );
    } else if (dataCompletenessFilter === "missing_logs_only") {
      filtered = filtered.filter(record => 
        !record.has_submission_data
      );
    }

    return filtered;
  };

  // Function to generate verification log summary showing complete call workflow
  const generateVerificationLogSummary = (logs: CallLog[], submission?: any): string => {
    if (!logs || logs.length === 0) {
      // Fallback to data from submission/call_results table if available
      if (submission && submission.has_submission_data) {
        const workflow = [];
        
        if (submission.buffer_agent) {
          workflow.push(`🟡 Buffer: ${submission.buffer_agent}`);
        }
        
        if (submission.agent && submission.agent !== submission.buffer_agent) {
          workflow.push(`📞 Handled by: ${submission.agent}`);
        }
        
        if (submission.licensed_agent_account) {
          if (submission.buffer_agent || submission.agent_who_took_call) {
            workflow.push(`➡️ Transfer to Licensed`);
          }
          workflow.push(`🔵 Licensed: ${submission.licensed_agent_account}`);
        }
        
        if (workflow.length > 0) {
          return workflow.join(' → ');
        }
      }
      
      return "No call activity recorded";
    }

    const sortedLogs = logs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const workflow: string[] = [];
    let initialAgent: string | null = null;
    let currentAgent: string | null = null;
    let bufferAgent: string | null = null;
    let licensedAgent: string | null = null;
    let hasTransfer = false;
    
    for (const log of sortedLogs) {
      const agentName = log.agent_name || `${log.agent_type} agent`;
      
      switch (log.event_type) {
        case 'verification_started':
          if (!initialAgent) {
            initialAgent = agentName;
            currentAgent = agentName;
            
            if (log.agent_type === 'buffer') {
              bufferAgent = agentName;
              workflow.push(`� Buffer "${agentName}" picked up initially`);
            } else if (log.agent_type === 'licensed') {
              licensedAgent = agentName;
              workflow.push(`🔵 Licensed "${agentName}" picked up initially`);
            }
          }
          break;
          
        case 'call_picked_up':
          if (agentName !== currentAgent) {
            if (log.agent_type === 'buffer') {
              bufferAgent = agentName;
              workflow.push(`� Buffer "${agentName}" picked up`);
            } else {
              licensedAgent = agentName;
              workflow.push(`🔵 Licensed "${agentName}" picked up`);
            }
            currentAgent = agentName;
          }
          break;
          
        case 'call_claimed':
          if (log.agent_type === 'buffer') {
            bufferAgent = agentName;
            workflow.push(`� Buffer "${agentName}" claimed dropped call`);
          } else {
            licensedAgent = agentName;
            workflow.push(`🔵 Licensed "${agentName}" claimed dropped call`);
          }
          currentAgent = agentName;
          break;
          
        case 'transferred_to_la':
          hasTransfer = true;
          workflow.push(`➡️ Transferred to Licensed Agent`);
          break;
          
        case 'call_dropped':
          workflow.push(`❌ "${agentName}" dropped call`);
          break;
          
        case 'application_submitted':
          workflow.push(`✅ Application submitted by "${agentName}"`);
          break;
          
        case 'application_not_submitted':
          workflow.push(`❌ Application not submitted`);
          break;
          
        case 'call_disconnected':
          workflow.push(`📞 Call disconnected from "${agentName}"`);
          break;
      }
    }

    // If no workflow events, show basic structure
    if (workflow.length === 0) {
      return "No detailed workflow events recorded";
    }

    // Add summary at the end showing final state
    const summary = [];
    if (bufferAgent) summary.push(`Buffer: ${bufferAgent}`);
    if (hasTransfer || licensedAgent) summary.push(`Licensed: ${licensedAgent || 'TBD'}`);
    
    if (summary.length > 0) {
      workflow.push(`📋 Summary: ${summary.join(' → ')}`);
    }

    return workflow.join(" → ");
  };

  // Fetch data from Supabase - get all transfers and merge with submission data
  const fetchData = async (showRefreshToast = false) => {
    try {
      setRefreshing(true);

      // First, get all transfer portal entries
      let transferQuery = (supabase as any)
        .from('transfer_portal')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply date filter if set
      if (dateFilter) {
        transferQuery = transferQuery.eq('date', dateFilter);
      }

      const { data: transferData, error: transferError } = await transferQuery;

      if (transferError) {
        console.error("Error fetching transfer portal data:", transferError);
        toast({
          title: "Error",
          description: "Failed to fetch transfer portal data",
          variant: "destructive",
        });
        return;
      }

      // Get submission portal data for entries that exist
      let submissionQuery = (supabase as any)
        .from('submission_portal')
        .select('*');

      // Apply date filter if set
      if (dateFilter) {
        submissionQuery = submissionQuery.eq('date', dateFilter);
      }

      // Note: We don't apply status filter here to ensure all submission data is available
      // for merging with transfer data, regardless of current filter selection

      const { data: submissionData, error: submissionError } = await submissionQuery;

      if (submissionError) {
        console.warn("Error fetching submission portal data:", submissionError);
        // Continue with just transfer data
      }

      // Create a map of submission data by submission_id for quick lookup
      const submissionMap = new Map();
      if (submissionData) {
        submissionData.forEach((sub: any) => {
          submissionMap.set(sub.submission_id, sub);
        });
      }

      // Merge transfer data with submission data
      const mergedData = (transferData as SubmissionPortalRow[])?.map(transfer => {
        const submission = submissionMap.get(transfer.submission_id);
        
        if (submission) {
          // Merge submission data with transfer data
          return {
            ...transfer,
            ...submission,
            // Keep transfer data for fields that might be missing in submission
            insured_name: submission.insured_name || transfer.insured_name,
            client_phone_number: submission.client_phone_number || transfer.client_phone_number,
            lead_vendor: submission.lead_vendor || transfer.lead_vendor,
            buffer_agent: submission.buffer_agent || transfer.buffer_agent,
            agent: submission.agent || transfer.agent,
            licensed_agent_account: submission.licensed_agent_account || transfer.licensed_agent_account,
            carrier: submission.carrier || transfer.carrier,
            product_type: submission.product_type || transfer.product_type,
            monthly_premium: submission.monthly_premium || transfer.monthly_premium,
            face_amount: submission.face_amount || transfer.face_amount,
            // Mark as having submission data
            has_submission_data: true
          };
        } else {
          // No submission data - show transfer data with missing label
          return {
            ...transfer,
            // Mark as missing submission data
            has_submission_data: false,
            verification_logs: "Update log missing - No submission data found"
          };
        }
      }) || [];

      // Fetch call logs for ALL entries (not just those with submission data)
      const allSubmissionIds = mergedData.map(row => row.submission_id);
      
      let callLogsData: Record<string, CallLog[]> = {};
      
      if (allSubmissionIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from('call_update_logs')
          .select('submission_id, agent_type, agent_name, event_type, created_at')
          .in('submission_id', allSubmissionIds)
          .order('created_at', { ascending: true });

        if (logsError) {
          console.warn("Error fetching call logs:", logsError);
        } else {
          // Group logs by submission_id
          callLogsData = (logsData || []).reduce((acc, log) => {
            if (!acc[log.submission_id]) {
              acc[log.submission_id] = [];
            }
            acc[log.submission_id].push(log);
            return acc;
          }, {} as Record<string, CallLog[]>);
        }
      }

      // Add verification logs to each row
      const dataWithLogs = mergedData.map(row => {
        const logs = callLogsData[row.submission_id] || [];
        
        if (logs.length > 0) {
          // Generate verification logs for entries that have call logs
          return {
            ...row,
            verification_logs: generateVerificationLogSummary(logs, row)
          };
        } else if (row.has_submission_data) {
          // Fallback for entries with submission data but no call logs
          return {
            ...row,
            verification_logs: generateVerificationLogSummary([], row)
          };
        } else {
          // No call logs and no submission data
          return {
            ...row,
            verification_logs: "No call activity recorded"
          };
        }
      });

      setData(dataWithLogs);

      if (showRefreshToast) {
        toast({
          title: "Success",
          description: "Data refreshed successfully",
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

  // Update filtered data whenever data or filters change
  useEffect(() => {
    setFilteredData(applyFilters(data));
    setCurrentPage(1); // Reset to first page when filters change
  }, [data, dateFilter, statusFilter, showDuplicates, searchTerm, dataCompletenessFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter, statusFilter]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleExport = () => {
    // Simple CSV export
    if (filteredData.length === 0) {
      toast({
        title: "No Data",
        description: "No data to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      'Submission ID',
      'Date',
      'Insured Name',
      'Lead Vendor',
      'Phone Number',
      'Buffer Agent',
      'Agent',
      'Licensed Agent',
      'Data Status',
      'Status',
      'Call Result',
      'Product Type',
      'Face Amount',
      'Sent to Underwriting',
      'Submission Date',
      'Call Source',
      'Submission Source',
      'Verification Logs',
      'Created At'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => [
        row.submission_id,
        row.date || '',
        row.insured_name || '',
        row.lead_vendor || '',
        row.client_phone_number || '',
        row.buffer_agent || '',
        row.agent || '',
        row.licensed_agent_account || '',
        row.has_submission_data ? 'Complete' : 'Missing Update Log',
        row.status || '',
        row.call_result || '',
        row.product_type || '',
        row.face_amount || '',
        row.sent_to_underwriting ? 'Yes' : 'No',
        row.submission_date || '',
        row.call_source || '',
        row.submission_source || '',
        row.verification_logs || '',
        row.created_at || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submission-portal-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Data exported to CSV successfully",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading submission portal data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredData.length}</div>
                <p className="text-xs text-muted-foreground">
                  {dateFilter ? `For ${dateFilter}` : 'All time'}
                  {!showDuplicates && data.length !== filteredData.length && ' (duplicates removed)'}
                  {filteredData.length > itemsPerPage && (
                    <span className="block">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Transfers with Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredData.filter(row => 
                    row.verification_logs && 
                    !row.verification_logs.includes('No call activity recorded') &&
                    !row.verification_logs.includes('Update log missing')
                  ).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Transfers with call activity logs
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Missing Update Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredData.length > 0
                    ? Math.round((filteredData.filter(row => 
                        !row.verification_logs || 
                        row.verification_logs.includes('No call activity recorded') ||
                        row.verification_logs.includes('Update log missing')
                      ).length / filteredData.length) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Of filtered transfers missing logs
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">
                Track all transfers and their submission status - shows every entry from transfer portal
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, phone, vendor..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="__ALL__">All Statuses</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Underwriting">Underwriting</option>
                  <option value="Submitted">Submitted</option>
                  <option value="DQ'd Can't be sold">DQ'd Can't be sold</option>
                  <option value="Returned To Center - DQ">Returned To Center - DQ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data Completeness</label>
                <select
                  value={dataCompletenessFilter}
                  onChange={(e) => setDataCompletenessFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="__ALL__">All Records</option>
                  <option value="active_only">Active Only (Hide Missing Logs & Completed)</option>
                  <option value="missing_logs_only">Missing Update Log Only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Show Duplicates</label>
                <select
                  value={showDuplicates ? "true" : "false"}
                  onChange={(e) => setShowDuplicates(e.target.value === "true")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="true">Show All Records</option>
                  <option value="false">Remove Duplicates</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Transfer Records ({filteredData.length})
              {filteredData.length > itemsPerPage && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)}
                </span>
              )}
              {!showDuplicates && data.length !== filteredData.length && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({data.length - filteredData.length} duplicates removed)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transfer records found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Insured Name</th>
                      <th className="text-left p-2">Lead Vendor</th>
                      <th className="text-left p-2">Data Status</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Agent</th>
                      <th className="text-left p-2">Underwriting</th>
                      <th className="text-left p-2">Call Source</th>
                      <th className="text-left p-2 min-w-80">Verification Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageData.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        
                        <td className="p-2">{row.date}</td>
                        <td className="p-2">{row.insured_name}</td>
                        <td className="p-2">{row.lead_vendor}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            row.has_submission_data 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {row.has_submission_data ? 'Complete' : 'Missing Update Log'}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            row.status === 'Pending Approval'
                              ? 'bg-yellow-100 text-yellow-800'
                              : row.status === 'Underwriting'
                              ? 'bg-blue-100 text-blue-800'
                              : row.status === 'Submitted'
                              ? 'bg-green-100 text-green-800'
                              : row.status?.includes('DQ')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-2">{row.agent || row.buffer_agent}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            row.sent_to_underwriting ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {row.has_submission_data ? (row.sent_to_underwriting ? 'Yes' : 'No') : 'N/A'}
                          </span>
                        </td>
                        <td className="p-2">{row.call_source}</td>
                        <td className="p-2 min-w-80">
                          <div className="text-xs text-gray-700 leading-relaxed">
                            {row.verification_logs}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              {/* Page Numbers */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default SubmissionPortalPage;