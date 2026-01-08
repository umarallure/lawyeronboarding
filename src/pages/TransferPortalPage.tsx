import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Download } from "lucide-react";

export interface TransferPortalRow {
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
  source_type?: string;
}

const TransferPortalPage = () => {
  const [data, setData] = useState<TransferPortalRow[]>([]);
  const [filteredData, setFilteredData] = useState<TransferPortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("__ALL__");
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Remove duplicates based on insured_name, client_phone_number, and lead_vendor
  const removeDuplicates = (records: TransferPortalRow[]): TransferPortalRow[] => {
    const seen = new Map<string, TransferPortalRow>();
    
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
  const applyFilters = (records: TransferPortalRow[]): TransferPortalRow[] => {
    let filtered = records;

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter(record => record.date === dateFilter);
    }

    // Apply source type filter
    if (sourceTypeFilter !== "__ALL__") {
      filtered = filtered.filter(record => record.source_type === sourceTypeFilter);
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

    return filtered;
  };

  const { toast } = useToast();

  // Fetch data from Supabase
  const fetchData = async (showRefreshToast = false) => {
    try {
      setRefreshing(true);

      // Query the view directly - TypeScript will complain but it works at runtime
      let query = (supabase as any)
        .from('transfer_portal')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply date filter if set - using direct date string to avoid timezone conversion issues
      if (dateFilter) {
        query = query.eq('date', dateFilter);
      }

      // Apply source type filter
      if (sourceTypeFilter !== "__ALL__") {
        query = query.eq('source_type', sourceTypeFilter);
      }

      const { data: portalData, error } = await query;

      if (error) {
        console.error("Error fetching transfer portal data:", error);
        toast({
          title: "Error",
          description: "Failed to fetch transfer portal data",
          variant: "destructive",
        });
        return;
      }

      setData((portalData as TransferPortalRow[]) || []);

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
  }, [data, dateFilter, sourceTypeFilter, showDuplicates, searchTerm]);

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
  }, []);

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
      'Status',
      'Call Result',
      'Carrier',
      'Product Type',
      'Draft Date',
      'Monthly Premium',
      'Face Amount',
      'From Callback',
      'Source Type',
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
        row.status || '',
        row.call_result || '',
        row.carrier || '',
        row.product_type || '',
        row.draft_date || '',
        row.monthly_premium || '',
        row.face_amount || '',
        row.from_callback ? 'Yes' : 'No',
        row.source_type || '',
        row.created_at || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer-portal-${new Date().toISOString().split('T')[0]}.csv`;
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
          <span>Loading transfer portal data...</span>
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
                <CardTitle className="text-sm font-medium">Completed Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredData.filter(row => row.status && row.status.trim() !== '').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Transfers with status set
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredData.length > 0
                    ? Math.round((filteredData.filter(row => row.status && row.status.trim() !== '').length / filteredData.length) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Of filtered transfers
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">
                Track all daily lead transfers from Zapier and callbacks
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <label className="block text-sm font-medium mb-2">Source Type</label>
                <select
                  value={sourceTypeFilter}
                  onChange={(e) => setSourceTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="__ALL__">All Sources</option>
                  <option value="zapier">Zapier</option>
                  <option value="callback">Callback</option>
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
                      <th className="text-left p-2">Lead Vendor</th>
                      <th className="text-left p-2">Insured Name</th>
                      
                      <th className="text-left p-2">Phone</th>
                      <th className="text-left p-2">Source</th>
                      <th className="text-left p-2">Status</th>
                
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageData.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        
                        <td className="p-2">{row.date}</td>
                        <td className="p-2">{row.lead_vendor}</td>
                        <td className="p-2">{row.insured_name}</td>
                        <td className="p-2">{row.client_phone_number}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            row.source_type === 'callback'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {row.source_type}
                          </span>
                        </td>
                        <td className="p-2">{row.status}</td>
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

export default TransferPortalPage;