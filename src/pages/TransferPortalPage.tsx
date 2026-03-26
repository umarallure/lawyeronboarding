import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useAuth } from "@/hooks/useAuth";
import { useMarketingTeamFilterAccess } from "@/hooks/useMarketingTeamFilterAccess";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeftRight, Calendar, Pencil, RefreshCw, Users, StickyNote, Plus, PhoneCall, SlidersHorizontal, X } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import { usePipelineStages, type PipelineStage } from "@/hooks/usePipelineStages";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";

type DateRange = "all_time" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";
type PresetDateRange = Exclude<DateRange, "all_time" | "custom">;

const getPresetRangeBounds = (range: PresetDateRange) => {
  const now = new Date();
  if (range === "this_week") {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return { start, end };
  }

  if (range === "last_week") {
    const ref = subWeeks(now, 1);
    const start = startOfWeek(ref, { weekStartsOn: 1 });
    const end = endOfWeek(ref, { weekStartsOn: 1 });
    return { start, end };
  }

  if (range === "this_month") {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return { start, end };
  }

  const ref = subMonths(now, 1);
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  return { start, end };
};

type UntypedSb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => {
        limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
      };
      in: (col: string, values: string[]) => Promise<{ data: unknown[] | null; error: unknown }>;
    };
    insert: (data: unknown) => Promise<{ error: unknown }>;
  };
};

export interface TransferPortalRow {
  id: string;
  ui_id?: string;
  submission_id: string;
  user_id?: string;
  assigned_user_id?: string | null;
  pipeline_name?: string;
  stage_id?: string;
  display_stage_key?: string;
  submission_date?: string;
  lawyer_full_name?: string;
  firm_name?: string;
  firm_address?: string;
  firm_phone_no?: string;
  profile_description?: string;
  phone_number?: string;
  email?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  additional_notes?: string;
  created_at?: string;
  updated_at?: string;
}

const TransferPortalPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    marketingTeam,
    canViewTeamAssigneeFilter,
    loading: marketingFilterAccessLoading,
  } = useMarketingTeamFilterAccess(user?.id);

  // --- Dynamic pipeline stages from DB ---
  const { stages: dbTransferStages, loading: transferStagesLoading } = usePipelineStages("cold_call_pipeline");
  const { stages: dbSubmissionStages } = usePipelineStages("lawyer_portal");

  const kanbanStages = useMemo(() => {
    return dbTransferStages.map((s) => ({ key: s.key, label: s.label }));
  }, [dbTransferStages]);

  const normalize = useCallback((value: string | null | undefined) => (value ?? "").trim().toLowerCase(), []);
  const fingerprint = useCallback(
    (value: string | null | undefined) => normalize(value).replace(/[^a-z0-9]+/g, ""),
    [normalize]
  );

  const stageKeySets = useMemo(() => {
    const contactedFingerprint = "contacted";

    const contacted = dbTransferStages
      .filter((s) => fingerprint(s.key) === contactedFingerprint || fingerprint(s.label) === contactedFingerprint)
      .map((s) => s.key);

    const scheduledForZoom = dbTransferStages
      .filter((s) => {
        const key = normalize(s.key);
        const label = normalize(s.label);
        return (key.includes("scheduled") && key.includes("zoom")) || (label.includes("scheduled") && label.includes("zoom"));
      })
      .map((s) => s.key);

    const scheduledForOnboarding = dbTransferStages
      .filter((s) => {
        const key = fingerprint(s.key);
        const label = fingerprint(s.label);
        return key.includes("scheduled") && key.includes("onboard")
          || label.includes("scheduled") && label.includes("onboard");
      })
      .map((s) => s.key);

    return {
      contacted,
      scheduledForZoom,
      scheduledForOnboarding,
    };
  }, [dbTransferStages, fingerprint, normalize]);

  const scheduledForOnboardingStageKey = useMemo(() => {
    return stageKeySets.scheduledForOnboarding[0] ?? null;
  }, [stageKeySets.scheduledForOnboarding]);

  const stageTheme = useMemo(() => {
    const theme: Record<string, { column: string }> = {};
    dbTransferStages.forEach((s) => {
      theme[s.key] = { column: s.column_class || "" };
    });
    return theme;
  }, [dbTransferStages]);


  const scheduledMarketingStage = useMemo(() => {
    return (
      dbTransferStages.find((stage) => {
        const key = (stage.key || "").trim().toLowerCase();
        const label = (stage.label || "").trim().toLowerCase();
        return (key.includes("scheduled") && key.includes("onboard")) ||
          (label.includes("scheduled") && label.includes("onboard"));
      }) ||
      dbTransferStages.find((stage) => {
        const key = (stage.key || "").trim().toLowerCase();
        const label = (stage.label || "").trim().toLowerCase();
        return (key.includes("scheduled") && key.includes("zoom")) ||
          (label.includes("scheduled") && label.includes("zoom"));
      }) ||
      dbTransferStages[dbTransferStages.length - 1] ||
      null
    );
  }, [dbTransferStages]);

  const readyToMoveForwardStageIds = useMemo(() => {
    const readyStages = dbSubmissionStages.filter((stage) => {
      const key = (stage.key || "").trim().toLowerCase();
      const label = (stage.label || "").trim().toLowerCase();
      return key === "ready_to_move_forward" || label === "ready to move forward";
    });

    return new Set(
      readyStages
        .flatMap((stage) => [stage.id, stage.key])
        .map((value) => (value || "").trim())
        .filter(Boolean)
    );
  }, [dbSubmissionStages]);

  const readyToMoveForwardStageKey = useMemo(() => {
    return (
      dbSubmissionStages.find((stage) => {
        const key = (stage.key || "").trim().toLowerCase();
        const label = (stage.label || "").trim().toLowerCase();
        return key === "ready_to_move_forward" || label === "ready to move forward";
      })?.key || 'ready_to_move_forward'
    );
  }, [dbSubmissionStages]);

  const resolveMarketingStageKey = useCallback(
    (value?: string | null): string | null => {
      const stageId = (value || '').trim();
      if (!stageId) return null;
      const asKey = dbTransferStages.find((s) => s.key === stageId);
      if (asKey?.key) return asKey.key;
      const legacy = dbTransferStages.find((s) => s.id === stageId);
      return legacy?.key ?? null;
    },
    [dbTransferStages]
  );

  const deriveStageKey = useCallback(
    (row: TransferPortalRow): string => {
      const stageId = (row.display_stage_key || row.stage_id || '').trim();
      if (!stageId) return kanbanStages[0]?.key ?? 'transfer_api';
      const asKey = dbTransferStages.find((s) => s.key === stageId);
      if (asKey?.key) return asKey.key;
      const legacy = dbTransferStages.find((s) => s.id === stageId);
      return legacy?.key ?? kanbanStages[0]?.key ?? 'transfer_api';
    },
    [dbTransferStages, kanbanStages]
  );

  const handleKanbanDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId) return;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const edgeThreshold = 96;
    const maxStep = 24;
    const pointerX = e.clientX - rect.left;

    if (pointerX < edgeThreshold) {
      const intensity = (edgeThreshold - pointerX) / edgeThreshold;
      container.scrollLeft -= Math.ceil(maxStep * intensity);
      return;
    }

    if (pointerX > rect.width - edgeThreshold) {
      const intensity = (pointerX - (rect.width - edgeThreshold)) / edgeThreshold;
      container.scrollLeft += Math.ceil(maxStep * intensity);
    }
  };

  const [data, setData] = useState<TransferPortalRow[]>([]);
  const [filteredData, setFilteredData] = useState<TransferPortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [selectedStage, setSelectedStage] = useState<"all" | string>("all");
  const [timeRange, setTimeRange] = useState<DateRange>("all_time");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showFilterRow, setShowFilterRow] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const kanbanPageSize = 25;
  const [columnPage, setColumnPage] = useState<Record<string, number>>({});
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});

  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [didInitAssigneeFilter, setDidInitAssigneeFilter] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editRow, setEditRow] = useState<TransferPortalRow | null>(null);
  const [editPipeline, setEditPipeline] = useState<string>("cold_call_pipeline");
  const [editStage, setEditStage] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editStageOpen, setEditStageOpen] = useState(false);

  const editPipelineStages = useMemo(() => {
    if (editPipeline === 'lawyer_portal') return dbSubmissionStages;
    return dbTransferStages;
  }, [editPipeline, dbTransferStages, dbSubmissionStages]);

  const editPipelineStageOptions = useMemo(() => {
    return Array.from(new Set(editPipelineStages.map((s) => s.label).map((l) => l.trim()).filter(Boolean)));
  }, [editPipelineStages]);

  // Remove duplicates based on lawyer_full_name and phone_number
  const removeDuplicates = useCallback((records: TransferPortalRow[]): TransferPortalRow[] => {
    const seen = new Map<string, TransferPortalRow>();
    
    records.forEach(record => {
      const key = `${record.lawyer_full_name || ''}|${record.phone_number || ''}`;
      
      // Keep the most recent record (first in our sorted array)
      if (!seen.has(key)) {
        seen.set(key, record);
      }
    });
    
    return Array.from(seen.values());
  }, []);

  // Apply filters and duplicate removal
  const applyFilters = useCallback((records: TransferPortalRow[]): TransferPortalRow[] => {
    let filtered = records;

    if (assigneeFilter !== 'all') {
      filtered = filtered.filter((record) => (record.assigned_user_id || '') === assigneeFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        (record.lawyer_full_name?.toLowerCase().includes(searchLower)) ||
        (record.phone_number?.toLowerCase().includes(searchLower)) ||
        (record.firm_name?.toLowerCase().includes(searchLower)) ||
        (record.email?.toLowerCase().includes(searchLower)) ||
        (record.submission_id?.toLowerCase().includes(searchLower))
      );
    }

    // Remove duplicates if enabled
    if (!showDuplicates) {
      filtered = removeDuplicates(filtered);
    }

    return filtered;
  }, [assigneeFilter, removeDuplicates, searchTerm, showDuplicates]);


  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;
    if (didInitAssigneeFilter) return;
    if (marketingFilterAccessLoading) return;
    if (!canViewTeamAssigneeFilter) {
      setAssigneeFilter(user.id);
    }
    setDidInitAssigneeFilter(true);
  }, [canViewTeamAssigneeFilter, didInitAssigneeFilter, marketingFilterAccessLoading, user?.id]);

  // Fetch data from Supabase
  const fetchData = useCallback(
    async (showRefreshToast = false) => {
      try {
        setRefreshing(true);

        type QueryRes = { data: unknown[] | null; error: { message?: string } | null };
        type LeadsQuery = PromiseLike<QueryRes> & {
          gte: (column: string, value: string) => LeadsQuery;
          lt: (column: string, value: string) => LeadsQuery;
          order: (column: string, opts: { ascending: boolean }) => LeadsQuery;
        };

        const sb = supabase as unknown as {
          from: (table: string) => {
            select: (columns: string) => {
              eq: (column: string, value: string) => LeadsQuery;
            };
          };
        };

        const resolveDateRange = (): { startIso: string; endExclusiveIso: string } | null => {
          if (timeRange === "all_time") return null;

          let start: Date;
          let end: Date;

          if (timeRange === "custom") {
            if (!customStartDate || !customEndDate) return null;
            start = startOfDay(parseISO(customStartDate));
            end = startOfDay(parseISO(customEndDate));
            if (end < start) end = start;
          } else {
            const bounds = getPresetRangeBounds(timeRange as PresetDateRange);
            start = bounds.start;
            end = bounds.end;
          }

          const startIso = start.toISOString();
          const endExclusiveIso = addDays(startOfDay(end), 1).toISOString();
          return { startIso, endExclusiveIso };
        };

        const range = resolveDateRange();

        let transfersQ = sb
          .from("lawyer_leads")
          .select("*")
          .eq("pipeline_name", "cold_call_pipeline");

        let portalQ = sb
          .from("lawyer_leads")
          .select("*")
          .eq("pipeline_name", "lawyer_portal");

        if (range) {
          transfersQ = transfersQ.gte("created_at", range.startIso).lt("created_at", range.endExclusiveIso);
          portalQ = portalQ.gte("created_at", range.startIso).lt("created_at", range.endExclusiveIso);
        }

        transfersQ = transfersQ.order("created_at", { ascending: false });

        portalQ = portalQ.order("created_at", { ascending: false });

        const [transfersRes, portalRes] = await Promise.all([transfersQ, portalQ]);

        if (transfersRes.error) {
          console.error("Error fetching contacts data:", transfersRes.error);
          toast({
            title: "Error",
            description: "Failed to fetch contacts data",
            variant: "destructive",
          });
          return;
        }

        const transferRows = ((transfersRes.data ?? []) as unknown as TransferPortalRow[]);

        const portalRows = ((portalRes.data ?? []) as unknown as TransferPortalRow[]);
        const overlayRows: TransferPortalRow[] =
          scheduledForOnboardingStageKey
            ? portalRows
                .filter((row) => readyToMoveForwardStageIds.has((row.stage_id || '').trim()))
                .map((row) => ({
                  ...row,
                  ui_id: `${row.id}:overlay:scheduled_onboarding`,
                  display_stage_key: scheduledForOnboardingStageKey,
                }))
            : [];

        const combinedRows = [...transferRows, ...overlayRows];

        setData(combinedRows);

        // Fetch aggregated note counts
        fetchNoteCounts(combinedRows);

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
    },
    [customEndDate, customStartDate, readyToMoveForwardStageIds, scheduledForOnboardingStageKey, timeRange, toast]
  );

  // Update filtered data whenever data or filters change
  useEffect(() => {
    setFilteredData(applyFilters(data));
    setCurrentPage(1); // Reset to first page when filters change
  }, [applyFilters, data]);

  // Pagination calculations
  const stageFilteredData = useMemo(() => {
    if (selectedStage === "all") return filteredData;
    return filteredData.filter((row) => deriveStageKey(row) === selectedStage);
  }, [filteredData, selectedStage, deriveStageKey]);

  const defaultAssigneeFilter = canViewTeamAssigneeFilter ? "all" : (user?.id || "all");
  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    selectedStage !== "all" ||
    assigneeFilter !== defaultAssigneeFilter ||
    timeRange !== "all_time" ||
    customStartDate.length > 0 ||
    customEndDate.length > 0;

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedStage("all");
    setAssigneeFilter(defaultAssigneeFilter);
    setTimeRange("all_time");
    setCustomStartDate("");
    setCustomEndDate("");
    setCurrentPage(1);
    setShowFilterRow(false);
  };

  const filteredLeadsByStage = useMemo(() => {
    const grouped = new Map<string, TransferPortalRow[]>();
    kanbanStages.forEach((stage) => grouped.set(stage.key, []));
    filteredData.forEach((row) => {
      const stageKey = deriveStageKey(row);
      grouped.get(stageKey)?.push(row);
    });
    return grouped;
  }, [filteredData, kanbanStages, deriveStageKey]);

  const marketingPipelineStats = useMemo(() => {
    const totalContacts = filteredData.length;
    const contactedCount = stageKeySets.contacted.reduce(
      (sum, stageKey) => sum + (filteredLeadsByStage.get(stageKey)?.length || 0),
      0
    );
    const scheduledForZoomCount = stageKeySets.scheduledForZoom.reduce(
      (sum, stageKey) => sum + (filteredLeadsByStage.get(stageKey)?.length || 0),
      0
    );
    const scheduledForOnboardingCount = stageKeySets.scheduledForOnboarding.reduce(
      (sum, stageKey) => sum + (filteredLeadsByStage.get(stageKey)?.length || 0),
      0
    );

    return {
      totalContacts,
      contactedCount,
      scheduledForZoomCount,
      scheduledForOnboardingCount,
    };
  }, [filteredData, filteredLeadsByStage, stageKeySets]);

  const totalPages = Math.max(1, Math.ceil(stageFilteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = stageFilteredData.slice(startIndex, endIndex);


  const handleOpenEdit = (row: TransferPortalRow) => {
    const pipeline = row.pipeline_name || 'cold_call_pipeline';
    setEditRow(row);
    setEditPipeline(pipeline);
    const currentStageId = row.display_stage_key || row.stage_id;
    const stagePool = pipeline === 'lawyer_portal' ? dbSubmissionStages : dbTransferStages;
    const currentStage = stagePool.find((s) => s.key === currentStageId) ?? stagePool.find((s) => s.id === currentStageId);
    setEditStage(currentStage?.label || '');
    setEditNotes('');
    setEditStageOpen(false);
    setEditOpen(true);
  };

  const handleView = (row: TransferPortalRow) => {
    if (!row?.id) return;
    navigate(`/lead-detail/${encodeURIComponent(row.id)}`, {
      state: { activeNav: '/transfer-portal' },
    });
  };

  const editStageMatches = useMemo(() => {
    const query = (editStage || '').trim().toLowerCase();
    if (!query) return editPipelineStageOptions;
    return editPipelineStageOptions.filter((label) => label.toLowerCase().includes(query));
  }, [editPipelineStageOptions, editStage]);

  const handleSaveEdit = async () => {
    if (!editRow) return;

    const nextStageLabel = normalizeSubmissionTransitionStatus((editStage || '').trim());
    if (!nextStageLabel) return;

    const nextStage = editPipelineStages.find(s => s.label === nextStageLabel);
    if (!nextStage) return;

    const previousStageId = editRow.display_stage_key || editRow.stage_id || '';
    const stageChanged = previousStageId !== nextStage.key || (editRow.pipeline_name || 'cold_call_pipeline') !== editPipeline;

    try {
      setEditSaving(true);

      const lawyerLeadsUpdate = supabase as unknown as {
        from: (table: string) => {
          update: (data: { stage_id?: string; additional_notes: string; pipeline_name?: string }) => {
            eq: (column: string, value: string) => Promise<{ error: unknown }>;
          };
        };
      };

      const updateData: {
        stage_id?: string;
        additional_notes: string;
        pipeline_name?: string;
      } = {
        stage_id: nextStage.key,
        additional_notes: editNotes,
        pipeline_name: editPipeline,
      };

      const { error } = await lawyerLeadsUpdate
          .from('lawyer_leads')
        .update(updateData)
        .eq('id', editRow.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update contact',
          variant: 'destructive',
        });
        return;
      }

      const notesText = (editNotes || '').trim() || 'No notes provided.';

      // Append note to lawyer_lead_notes when provided
      const trimmedNote = (editNotes || '').trim();
      if (trimmedNote.length > 0 && user?.id) {
        try {
          const nameClient = supabase as unknown as {
            from: (table: string) => {
              select: (cols: string) => {
                eq: (col: string, value: string) => {
                  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
                };
              };
            };
          };

          const { data: userRow, error: userErr } = await nameClient
            .from('app_users')
            .select('display_name,email')
            .eq('user_id', user.id)
            .maybeSingle();

          const typed = userRow as { display_name?: string | null; email?: string | null } | null;
          const createdByName = (typed?.display_name || '').trim() || typed?.email || null;

          if (userErr) {
            console.warn('Failed to resolve created_by_name', userErr);
          }

          const { error: insertErr } = await (supabase as unknown as UntypedSb).from('lawyer_lead_notes').insert({
            lead_id: editRow.id,
            note: trimmedNote,
            created_by: user.id,
            created_by_name: createdByName,
          });

          if (insertErr) {
            console.warn('Failed to insert lawyer_lead_notes row', insertErr);
          }
        } catch (e) {
          console.warn('Unexpected error inserting lawyer_lead_notes row', e);
        }
      }

      if (stageChanged || trimmedNote.length > 0) {
        try {
          const { error: slackError } = await supabase.functions.invoke('disposition-change-slack-alert', {
            body: {
              leadId: editRow.id,
              submissionId: editRow.submission_id ?? null,
              leadVendor: editRow.firm_name ?? '',
              insuredName: editRow.lawyer_full_name ?? null,
              clientPhoneNumber: editRow.phone_number ?? null,
              previousDisposition: previousStageId ?? null,
              newDisposition: nextStage.key,
              notes: notesText,
              noteOnly: !stageChanged,
            },
          });
          if (slackError) {
            console.warn('Slack alert invoke failed:', slackError);
          }
        } catch (e) {
          console.warn('Slack alert invoke threw:', e);
        }
      }

      setData((prev) =>
        prev.map((row) =>
          row.id === editRow.id
            ? {
                ...row,
                stage_id: nextStage.key,
                display_stage_key: nextStage.key,
                pipeline_name: editPipeline,
                additional_notes: editNotes,
              }
            : row
        )
      );

      setEditOpen(false);
      setEditRow(null);

      toast({
        title: 'Saved',
        description: 'Contact updated successfully',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const leadsByStage = useMemo(() => {
    const grouped = new Map<string, TransferPortalRow[]>();
    kanbanStages.forEach((stage) => grouped.set(stage.key, []));
    stageFilteredData.forEach((row) => {
      const stageKey = deriveStageKey(row);
      grouped.get(stageKey)?.push(row);
    });
    return grouped;
  }, [stageFilteredData, kanbanStages, deriveStageKey]);

  useEffect(() => {
    setColumnPage((prev) => {
      const next: Record<string, number> = { ...prev };
      kanbanStages.forEach((stage) => {
        const rows = leadsByStage.get(stage.key) || [];
        const totalPages = Math.max(1, Math.ceil(rows.length / kanbanPageSize));
        const current = Number(next[stage.key] ?? 1);
        next[stage.key] = Math.min(Math.max(1, current), totalPages);
      });
      return next;
    });
  }, [kanbanStages, leadsByStage]);

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
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const fetchNoteCounts = async (rows: TransferPortalRow[]) => {
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) {
      setNoteCounts({});
      return;
    }

    const submissionMap = new Map<string, string>();
    rows.forEach((r) => {
      const submissionId = r.submission_id;
      if (submissionId) submissionMap.set(submissionId, r.id);
    });

    const counts: Record<string, number> = {};
    ids.forEach((id) => {
      counts[id] = 0;
    });

    // lawyer_lead_notes counts
    try {
      const { data: leadNoteRows, error: leadNoteErr } = await (supabase as unknown as UntypedSb)
        .from('lawyer_lead_notes')
        .select('lead_id')
        .in('lead_id', ids);

      if (!leadNoteErr && Array.isArray(leadNoteRows)) {
        (leadNoteRows as Array<{ lead_id: string }>).forEach((row) => {
          if (row.lead_id) {
            counts[row.lead_id] = (counts[row.lead_id] || 0) + 1;
          }
        });
      }
    } catch (e) {
      console.warn('Failed to fetch lead note counts', e);
    }

    // Legacy notes on lawyer_leads.additional_notes
    rows.forEach((r) => {
      if ((r.additional_notes || '').trim()) {
        counts[r.id] = (counts[r.id] || 0) + 1;
      }
    });

    // Legacy notes on leads.additional_notes via submission_id (if needed)
    const submissionIds = Array.from(submissionMap.keys());
    if (submissionIds.length > 0) {
      try {
        const { data: leadRows, error: leadsErr } = await supabase
          .from('leads')
          .select('submission_id, additional_notes')
          .in('submission_id', submissionIds);

        if (!leadsErr && Array.isArray(leadRows)) {
          leadRows.forEach((row) => {
            const noteText = (row.additional_notes as string | null)?.trim();
            if (noteText) {
              const leadId = submissionMap.get(row.submission_id as string);
              if (leadId) {
                counts[leadId] = (counts[leadId] || 0) + 1;
              }
            }
          });
        }
      } catch (e) {
        console.warn('Failed to fetch legacy leads notes', e);
      }
    }

    setNoteCounts(counts);
  };

  const getStatusForStage = (stageKey: string): string => {
    const stage = kanbanStages.find((s) => s.key === stageKey);
    return (stage?.label || '').trim() || stageKey;
  };

  const normalizeSubmissionTransitionStatus = (status: string): string => {
    return (status || '').trim();
  };

  const handleDropToStage = async (rowId: string, stageKey: string) => {
    const stage = dbTransferStages.find(s => s.key === stageKey);
    if (!stage) return;

    const row = data.find((item) => item.id === rowId);
    const prev = data;
    const next = prev.map((r) =>
      r.id === rowId
        ? {
            ...r,
            stage_id:
              stage.display_order === Math.max(...dbTransferStages.map((s) => s.display_order))
                ? readyToMoveForwardStageKey
                : stage.key,
            display_stage_key: stage.key,
            pipeline_name:
              stage.display_order === Math.max(...dbTransferStages.map((s) => s.display_order))
                ? 'lawyer_portal'
                : 'cold_call_pipeline',
          }
        : r
    );
    setData(next);

    try {
      const isLastStage = dbTransferStages.length > 0 && 
                          stage.display_order === Math.max(...dbTransferStages.map(s => s.display_order));

      const lawyerLeadsUpdate = supabase as unknown as {
        from: (table: string) => {
          update: (data: { stage_id?: string; pipeline_name?: string }) => {
            eq: (column: string, value: string) => Promise<{ error: unknown }>;
          };
        };
      };

      if (isLastStage) {
        const { error } = await lawyerLeadsUpdate
          .from('lawyer_leads')
          .update({
            stage_id: readyToMoveForwardStageKey,
            pipeline_name: 'lawyer_portal',
          })
          .eq('id', rowId);

        if (error) throw error;

        toast({
          title: 'Status Updated',
          description: `Lead transitioned to Lawyer Portal - Ready to Move Forward`,
        });
        
        setTimeout(() => {
          fetchData(false);
        }, 500);
      } else {
        const { error } = await lawyerLeadsUpdate
          .from('lawyer_leads')
          .update({ stage_id: stage.key, pipeline_name: 'cold_call_pipeline' })
          .eq('id', rowId);

        if (error) throw error;

        toast({
          title: 'Status Updated',
          description: `Lead updated to "${stage.label}"`,
        });
      }
    } catch (e) {
      console.error('Error updating lead status:', e);
      setData(prev);
      toast({
        title: 'Error',
        description: 'Failed to update lead status',
        variant: 'destructive',
      });
    }
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
      'Lawyer Name',
      'Phone Number',
      'Email',
      'Firm Name',
      'Firm Address',
      'Stage',
      'Submission Date',
      'Created At'
    ];

    const csvContent = [
      headers.join(','),
      ...stageFilteredData.map(row => {
        const currentStageId = row.display_stage_key || row.stage_id;
        const currentStage = dbTransferStages.find((s) => s.key === currentStageId) ?? dbTransferStages.find((s) => s.id === currentStageId);
        return [
          row.submission_id,
          row.lawyer_full_name || '',
          row.phone_number || '',
          row.email || '',
          row.firm_name || '',
          row.firm_address || '',
          currentStage?.label || '',
          row.submission_date || '',
          row.created_at || ''
        ].map(field => `"${field}"`).join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Data exported to CSV successfully",
    });
  };

  if (loading) {
    return <LogoLoader page label="Loading marketing pipeline..." />;
  }

  return (
    <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Contacts</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-3xl font-semibold">{marketingPipelineStats.totalContacts}</div>
                <ArrowLeftRight className="h-10 w-10 text-primary" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Contacted</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-3xl font-semibold">{marketingPipelineStats.contactedCount}</div>
                <Users className="h-10 w-10 text-primary" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled for Zoom</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-3xl font-semibold">{marketingPipelineStats.scheduledForZoomCount}</div>
                <PhoneCall className="h-10 w-10 text-primary" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled for Onboarding</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-3xl font-semibold">{marketingPipelineStats.scheduledForOnboardingCount}</div>
                <Calendar className="h-10 w-10 text-primary" />
              </CardContent>
            </Card>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid flex-1 gap-3 xl:grid-cols-[minmax(300px,1fr)_auto_auto]">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Search</Label>
                  <Input
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search contacts..."
                    className="w-full"
                  />
                </div>
                <Button
                  type="button"
                  variant={showFilterRow ? "default" : "outline"}
                  className="gap-2 xl:self-end"
                  onClick={() => setShowFilterRow((prev) => !prev)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter
                </Button>
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2 xl:self-end"
                    onClick={handleClearFilters}
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                ) : (
                  <div className="hidden xl:block" />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="px-2.5 py-1 shrink-0">
                  {stageFilteredData.length} contacts
                </Badge>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  Export CSV
                </Button>
                <Button size="sm" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => navigate('/add-lead')} variant="default">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lawyer
                </Button>
              </div>
            </div>

            {showFilterRow && (
              <div className="mt-4 border-t pt-4">
                <div className="grid gap-3 xl:grid-cols-[repeat(3,minmax(180px,1fr))]">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Stage</Label>
                    <Select value={selectedStage} onValueChange={(value) => {
                      setSelectedStage(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-full">
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

                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Assignee</Label>
                    <Select
                      value={assigneeFilter}
                      onValueChange={(value) => {
                        setAssigneeFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Leads</SelectItem>
                          {user?.id ? <SelectItem value={user.id}>My Leads</SelectItem> : null}
                          {marketingTeam
                            .filter((m) => m.user_id !== user?.id)
                            .map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.display_name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Date</Label>
                    <Select
                      value={timeRange}
                      onValueChange={(v) => {
                        const next = v as DateRange;
                        if (next === "custom" && timeRange !== "custom") {
                          const seed: PresetDateRange = timeRange === "all_time" ? "this_month" : (timeRange as PresetDateRange);
                          const bounds = getPresetRangeBounds(seed);
                          setCustomStartDate(bounds.start.toISOString().slice(0, 10));
                          setCustomEndDate(bounds.end.toISOString().slice(0, 10));
                        }
                        setTimeRange(next);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all_time">All Time</SelectItem>
                          <SelectItem value="this_week">This Week</SelectItem>
                          <SelectItem value="last_week">Last Week</SelectItem>
                          <SelectItem value="this_month">This Month</SelectItem>
                          <SelectItem value="last_month">Last Month</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {timeRange === "custom" && (
                  <div className="mt-2 grid grid-cols-2 gap-4 max-w-[360px]">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Start Date</Label>
                      <Input
                        type="date"
                        className="w-full pr-10 tabular-nums"
                        value={customStartDate}
                        max={customEndDate || undefined}
                        onChange={(e) => {
                          setCustomStartDate(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">End Date</Label>
                      <Input
                        type="date"
                        className="w-full pr-10 tabular-nums"
                        value={customEndDate}
                        min={customStartDate || undefined}
                        onChange={(e) => {
                          setCustomEndDate(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex flex-col gap-3 border-t pt-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="inline-flex w-full rounded-lg border border-muted bg-background p-0.5 xl:w-auto">
                {["kanban", "list"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition xl:flex-none ${
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
            </div>
          </div>


          {viewMode === "kanban" ? (
            <div className="mt-4 min-h-0 flex-1 overflow-auto" onDragOver={handleKanbanDragOver}>
              <div className="flex min-h-0 min-w-[2200px] gap-3 pr-2">
                {kanbanStages.map((stage) => {
                  const rows = leadsByStage.get(stage.key) || [];
                  const current = Number(columnPage[stage.key] ?? 1);
                  const totalPages = Math.max(1, Math.ceil(rows.length / kanbanPageSize));
                  const startIndex = (current - 1) * kanbanPageSize;
                  const endIndex = startIndex + kanbanPageSize;
                  const pageRows = rows.slice(startIndex, endIndex);
                  return (
                    <Card
                      key={stage.key}
                      className={
                        `flex min-h-[560px] w-[26rem] flex-col bg-muted/20 ${stageTheme[stage.key].column}` +
                        (dragOverStage === stage.key ? ' ring-2 ring-primary/30' : '')
                      }
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => setDragOverStage(stage.key)}
                      onDragLeave={() => setDragOverStage((prev) => (prev === stage.key ? null : prev))}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedId = e.dataTransfer.getData('text/plain');
                        if (!droppedId) return;
                        handleDropToStage(droppedId, stage.key);
                        setDraggingId(null);
                        setDragOverStage(null);
                      }}
                    >
                      <CardHeader className="flex flex-row items-center justify-between border-b px-3 py-2">
                        <CardTitle className="text-sm font-semibold">
                          {stage.label}
                        </CardTitle>
                        <Badge variant="secondary">{rows.length}</Badge>
                      </CardHeader>
                      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                        {pageRows.length === 0 ? (
                          <div className="rounded-md border border-dashed border-muted-foreground/30 px-3 py-6 text-center text-xs text-muted-foreground">
                            No leads
                          </div>
                        ) : (
                          pageRows.map((row) => (
                            <Card
                              key={row.ui_id ?? row.id}
                              draggable
                              className="relative w-full cursor-pointer transition hover:shadow-md"
                              onClick={() => handleView(row)}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', row.id);
                                setDraggingId(row.id);
                              }}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setDragOverStage(null);
                              }}
                              style={draggingId === row.id ? { opacity: 0.7 } : undefined}
                            >
                              <CardContent className="p-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="absolute right-2 top-2 h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(row);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">{row.lawyer_full_name || "Unnamed"}</div>
                                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{row.phone_number || "N/A"}</span>
                                      <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                                        <StickyNote className="h-3.5 w-3.5" />
                                        <span>{noteCounts[row.id] ?? 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <Badge variant="secondary" className="text-xs">{row.firm_name || "No Firm"}</Badge>
                                  <div className="text-xs text-muted-foreground">{row.submission_date ? new Date(row.submission_date).toLocaleDateString() : ""}</div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </CardContent>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-xs">
                        <span className="text-muted-foreground">
                          Page {current} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setColumnPage((prev) => ({
                                ...prev,
                                [stage.key]: Math.max(1, current - 1),
                              }))
                            }
                            disabled={current === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setColumnPage((prev) => ({
                                ...prev,
                                [stage.key]: Math.min(totalPages, current + 1),
                              }))
                            }
                            disabled={current === totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-semibold">
                  Contacts ({stageFilteredData.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {stageFilteredData.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    No contact records found for the selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                          <th className="px-4 py-3">Lawyer Name</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Firm</th>
                          <th className="px-4 py-3">Stage</th>
                          <th className="px-4 py-3">Submission Date</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPageData.map((row) => {
                          const stageKey = deriveStageKey(row);
                          const currentStageId = row.display_stage_key || row.stage_id;
                          const currentStage = dbTransferStages.find(s => s.key === currentStageId) ?? dbTransferStages.find(s => s.id === currentStageId);
                          const stageLabel = currentStage?.label || kanbanStages.find((stage) => stage.key === stageKey)?.label;
                          return (
                            <tr key={row.ui_id ?? row.id} className="border-b last:border-0">
                              <td className="px-4 py-3">{row.lawyer_full_name || "Unnamed"}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span>{row.phone_number || "N/A"}</span>
                                  <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                                    <StickyNote className="h-3.5 w-3.5" />
                                    <span>{noteCounts[row.id] ?? 0}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">{row.firm_name || "No Firm"}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">{stageLabel}</Badge>
                              </td>
                              <td className="px-4 py-3">{row.submission_date ? new Date(row.submission_date).toLocaleDateString() : ""}</td>
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
                <DialogTitle>Edit Contact</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Pipeline</Label>
                  <Select
                    value={editPipeline}
                    onValueChange={(value) => {
                      setEditPipeline(value);
                      setEditStage('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cold_call_pipeline">Marketing Pipeline</SelectItem>
                      <SelectItem value="lawyer_portal">Lawyer Portal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Stage</Label>
                  <div className="relative">
                    <Input
                      value={editStage}
                      placeholder="Type stage..."
                      onFocus={() => setEditStageOpen(true)}
                      onChange={(e) => {
                        setEditStage(e.target.value);
                        setEditStageOpen(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setEditStageOpen(false), 150);
                      }}
                    />

                    {editStageOpen && (
                      <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                        {editStageMatches.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No matching found.</div>
                        ) : (
                          editStageMatches.map((label) => (
                            <button
                              key={label}
                              type="button"
                              className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setEditStage(label);
                                setEditStageOpen(false);
                              }}
                            >
                              {label}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
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
