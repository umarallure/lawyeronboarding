import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeftRight, Loader2, Pencil, RefreshCw, Users } from "lucide-react";

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

const kanbanStages = [
  { key: "transfer_api", label: "Transfer API" },
  { key: "incomplete_transfer", label: "Incomplete Transfer" },
  { key: "returned_to_center_dq", label: "Returned To Center - DQ" },
  { key: "previously_sold_bpo", label: "Previously Sold BPO" },
  { key: "needs_bpo_callback", label: "Needs BPO Callback" },
  { key: "application_withdrawn", label: "Application Withdrawn" },
  { key: "pending_information", label: "Pending Information" },
  { key: "pending_approval", label: "Pending Approval" },
] as const;

type StageKey = (typeof kanbanStages)[number]["key"];

const stageSlugMap: Record<string, StageKey> = {
  transfer_api: "transfer_api",
  transferapi: "transfer_api",
  incomplete_transfer: "incomplete_transfer",
  incompletetransfer: "incomplete_transfer",
  returned_to_center_dq: "returned_to_center_dq",
  returned_to_center___dq: "returned_to_center_dq",
  returned_to_center: "returned_to_center_dq",
  previously_sold_bpo: "previously_sold_bpo",
  previouslysoldbpo: "previously_sold_bpo",
  needs_bpo_callback: "needs_bpo_callback",
  needsbpocallback: "needs_bpo_callback",
  application_withdrawn: "application_withdrawn",
  applicationwithdrawn: "application_withdrawn",
  pending_information: "pending_information",
  pendinginformation: "pending_information",
  pending_info: "pending_information",
  pending_approval: "pending_approval",
  pendingapproval: "pending_approval",
};

const submissionPortalStages = [
  "Information Verification",
  "Attorney Submission",
  "Insurance Verification",
  "Retainer Process (Email)",
  "Retainer Process (Postal Mail)",
  "Retainer Signed Pending",
  "Retainer Signed",
  "Attorney Decision",
] as const;

const allStageOptions = [
  ...kanbanStages.map((s) => s.label),
  ...submissionPortalStages,
] as const;

const deriveStageKey = (row: TransferPortalRow): StageKey => {
  const source = (row.status || row.call_result || "transfer_api").toLowerCase();
  const slug = source
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");

  return stageSlugMap[slug] ?? "transfer_api";
};

const TransferPortalPage = () => {
  const [data, setData] = useState<TransferPortalRow[]>([]);
  const [filteredData, setFilteredData] = useState<TransferPortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allTimeTransfers, setAllTimeTransfers] = useState(0);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("__ALL__");
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [selectedStage, setSelectedStage] = useState<"all" | StageKey>("all");

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editRow, setEditRow] = useState<TransferPortalRow | null>(null);
  const [editStage, setEditStage] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

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

      let transfersQuery = supabase
        .from('daily_deal_flow')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (dateFilter) {
        transfersQuery = transfersQuery.eq('date', dateFilter);
      }

      const [transfersRes, transfersCountRes] = await Promise.all([
        transfersQuery,
        supabase
          .from('daily_deal_flow')
          .select('*', { count: 'exact', head: true }),
      ]);

      if (transfersRes.error) {
        console.error("Error fetching transfer portal data:", transfersRes.error);
        toast({
          title: "Error",
          description: "Failed to fetch transfer portal data",
          variant: "destructive",
        });
        return;
      }

      setAllTimeTransfers(transfersCountRes.count ?? 0);

      const transferRows = ((transfersRes.data ?? []) as unknown as TransferPortalRow[]).map((row) => {
        const isCallback = Boolean((row as any).from_callback) || Boolean((row as any).is_callback);
        return {
          ...row,
          source_type: isCallback ? 'callback' : 'zapier',
        };
      });

      setData(transferRows);

      if (sourceTypeFilter !== "__ALL__") {
        setData(transferRows.filter((row) => row.source_type === sourceTypeFilter));
      }

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
  const stageFilteredData = useMemo(() => {
    if (selectedStage === "all") return filteredData;
    return filteredData.filter((row) => deriveStageKey(row) === selectedStage);
  }, [filteredData, selectedStage]);

  const totalPages = Math.max(1, Math.ceil(stageFilteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = stageFilteredData.slice(startIndex, endIndex);

  const zapierTransfers = useMemo(
    () => stageFilteredData.filter((row) => row.source_type === 'zapier').length,
    [stageFilteredData]
  );

  const callbackTransfers = useMemo(
    () => stageFilteredData.filter((row) => row.source_type === 'callback').length,
    [stageFilteredData]
  );

  const handleOpenEdit = (row: TransferPortalRow) => {
    setEditRow(row);
    setEditStage((row.status || '').trim() || kanbanStages[0].label);
    setEditNotes(row.notes || '');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;

    const nextStage = (editStage || '').trim();
    if (!nextStage) return;

    try {
      setEditSaving(true);

      const { error } = await supabase
        .from('daily_deal_flow')
        .update({ status: nextStage, notes: editNotes })
        .eq('id', editRow.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update transfer',
          variant: 'destructive',
        });
        return;
      }

      setData((prev) =>
        prev.map((row) =>
          row.id === editRow.id
            ? {
                ...row,
                status: nextStage,
                notes: editNotes,
              }
            : row
        )
      );

      setEditOpen(false);
      setEditRow(null);

      toast({
        title: 'Saved',
        description: 'Transfer updated successfully',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const leadsByStage = useMemo(() => {
    const grouped = new Map<StageKey, TransferPortalRow[]>();
    kanbanStages.forEach((stage) => grouped.set(stage.key, []));
    stageFilteredData.forEach((row) => {
      const stageKey = deriveStageKey(row);
      grouped.get(stageKey)?.push(row);
    });
    return grouped;
  }, [stageFilteredData]);

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
    if (stageFilteredData.length === 0) {
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
      'Customer Name',
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
      ...stageFilteredData.map(row => [
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Transfers
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-3xl font-semibold">{allTimeTransfers}</div>
                <ArrowLeftRight className="h-10 w-10 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Zapier Transfers
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-3xl font-semibold">{zapierTransfers}</div>
                <Users className="h-10 w-10 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Callback Transfers
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-3xl font-semibold">{callbackTransfers}</div>
                <Users className="h-10 w-10 text-primary" />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search transfers..."
                className="w-64"
              />
              <Select value={selectedStage} onValueChange={(value) => {
                setSelectedStage(value as "all" | StageKey);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All Stages</SelectItem>
                    {kanbanStages.map((stage) => (
                      <SelectItem key={stage.key} value={stage.key}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-lg border border-muted bg-background p-0.5">
                {["kanban", "list"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                      viewMode === mode
                        ? "bg-primary text-white shadow"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setViewMode(mode as "kanban" | "list")}
                  >
                    {mode === "kanban" ? "Kanban View" : "List View"}
                  </button>
                ))}
              </div>
              <Badge variant="secondary" className="px-3 py-1">
                {allTimeTransfers} transfers
              </Badge>
              <Button variant="outline" onClick={handleExport}>
                Export CSV
              </Button>
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Track all daily lead transfers from Zapier and callbacks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">
                    Date
                  </label>
                  <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">
                    Source Type
                  </label>
                  <Select value={sourceTypeFilter} onValueChange={(value) => setSourceTypeFilter(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__ALL__">All Sources</SelectItem>
                        <SelectItem value="zapier">Zapier</SelectItem>
                        <SelectItem value="callback">Callback</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">
                    Show Duplicates
                  </label>
                  <Select
                    value={showDuplicates ? "true" : "false"}
                    onValueChange={(value) => setShowDuplicates(value === "true")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="true">Show All Records</SelectItem>
                        <SelectItem value="false">Remove Duplicates</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {viewMode === "kanban" ? (
            <div className="mt-4 min-h-0 flex-1 overflow-auto">
              <div className="flex min-h-0 min-w-[2200px] gap-3 pr-2">
                {kanbanStages.map((stage) => {
                  const rows = leadsByStage.get(stage.key) || [];
                  return (
                    <Card key={stage.key} className="flex min-h-[560px] w-[26rem] flex-col bg-muted/20">
                      <CardHeader className="flex flex-row items-center justify-between border-b px-3 py-2">
                        <CardTitle className="text-sm font-semibold">
                          {stage.label}
                        </CardTitle>
                        <Badge variant="secondary">{rows.length}</Badge>
                      </CardHeader>
                      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                        {rows.length === 0 ? (
                          <div className="rounded-md border border-dashed border-muted-foreground/30 px-3 py-6 text-center text-xs text-muted-foreground">
                            No leads
                          </div>
                        ) : (
                          rows.map((row) => (
                            <Card key={row.id} className="relative w-full" >
                              <CardContent className="p-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="absolute right-2 top-2 h-7 w-7"
                                  onClick={() => handleOpenEdit(row)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">{row.insured_name || "Unnamed"}</div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                      {row.client_phone_number || "N/A"}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <Badge variant="secondary" className="text-xs">{row.lead_vendor || "Unknown"}</Badge>
                                  <div className="text-xs text-muted-foreground">{row.date || ""}</div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-semibold">
                  Transfers ({stageFilteredData.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {stageFilteredData.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    No transfer records found for the selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                          <th className="px-4 py-3">Client</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Stage</th>
                          <th className="px-4 py-3">Publisher</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPageData.map((row) => {
                          const stageKey = deriveStageKey(row);
                          const stageLabel = (row.status || '').trim() || kanbanStages.find((stage) => stage.key === stageKey)?.label;
                          return (
                            <tr key={row.id} className="border-b last:border-0">
                              <td className="px-4 py-3">{row.insured_name || "Unnamed"}</td>
                              <td className="px-4 py-3">{row.client_phone_number || "N/A"}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">{stageLabel}</Badge>
                              </td>
                              <td className="px-4 py-3">{row.lead_vendor || "Unknown"}</td>
                              <td className="px-4 py-3">{row.date || ""}</td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleOpenEdit(row)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {stageFilteredData.length > itemsPerPage && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                    <span>
                      Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, stageFilteredData.length)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                        Previous
                      </Button>
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
              </CardContent>
            </Card>
          )}

          <Dialog
            open={editOpen}
            onOpenChange={(open) => {
              setEditOpen(open);
              if (!open) {
                setEditRow(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Edit Transfer</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={editStage} onValueChange={(v) => setEditStage(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {allStageOptions.map((label) => (
                          <SelectItem key={label} value={label}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={5} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveEdit} disabled={editSaving || !editStage}>
                  {editSaving ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default TransferPortalPage;