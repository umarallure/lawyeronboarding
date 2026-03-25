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
import { ArrowLeftRight, Calendar, Loader2, Pencil, RefreshCw, Users, StickyNote, Plus, PhoneCall } from "lucide-react";
import { usePipelineStages, type PipelineStage } from "@/hooks/usePipelineStages";

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
  submission_id: string;
  user_id?: string;
  assigned_user_id?: string | null;
  pipeline_name?: string;
  stage_id?: string;
  display_stage_key?: string;
  marketing_source_stage?: string | null;
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
        const key = normalize(s.key);
        const label = normalize(s.label);
        return (key.includes("scheduled") && key.includes("onboard")) || (label.includes("scheduled") && label.includes("onboard"));
      })
      .map((s) => s.key);

    return { contacted, scheduledForZoom, scheduledForOnboarding };
  }, [dbTransferStages, fingerprint, normalize]);

  const stageTheme = useMemo(() => {
    const theme: Record<string, { column: string }> = {};
    dbTransferStages.forEach((s) => {
      theme[s.key] = { column: s.column_class || "" };
    });
    return theme;
  }, [dbTransferStages]);

  const allStageOptions = useMemo(() => {
    return Array.from(new Set(kanbanStages.map((s) => s.label).map((label) => label.trim()).filter(Boolean)));
  }, [kanbanStages]);

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
  const [editStage, setEditStage] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editStageOpen, setEditStageOpen] = useState(false);

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

        const lawyerLeadsQuery = supabase as unknown as {
          from: (table: string) => {
            select: (columns: string) => {
              eq: (column: string, value: string) => {
                order: (column: string, options: { ascending: boolean }) => Promise<QueryRes>;
              };
            };
          };
        };

        const [transfersRes, lawyerPortalRes] = await Promise.all([
          lawyerLeadsQuery
            .from('lawyer_leads')
            .select('*')
            .eq('pipeline_name', 'cold_call_pipeline')
            .order('created_at', { ascending: false }),
          lawyerLeadsQuery
            .from('lawyer_leads')
            .select('*')
            .eq('pipeline_name', 'lawyer_portal')
            .order('created_at', { ascending: false }),
        ]);

        if (transfersRes.error) {
          console.error("Error fetching contacts data:", transfersRes.error);
          toast({
            title: "Error",
            description: "Failed to fetch contacts data",
            variant: "destructive",
          });
          return;
        }

        if (lawyerPortalRes.error) {
          console.error("Error fetching lawyer portal overlay data:", lawyerPortalRes.error);
          toast({
            title: "Error",
            description: "Failed to fetch contacts data",
            variant: "destructive",
          });
          return;
        }

        const transferRows = ((transfersRes.data ?? []) as unknown as TransferPortalRow[]);
        const lawyerPortalRows = ((lawyerPortalRes.data ?? []) as unknown as TransferPortalRow[]);
        const overlayRows = lawyerPortalRows
          .filter((row) => {
            const marketingStageKey = resolveMarketingStageKey(row.marketing_source_stage);
            return Boolean(marketingStageKey) || readyToMoveForwardStageIds.has((row.stage_id || '').trim());
          })
          .map((row) => ({
            ...row,
            display_stage_key: resolveMarketingStageKey(row.marketing_source_stage) || scheduledMarketingStage?.key,
          }));
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
    [readyToMoveForwardStageIds, resolveMarketingStageKey, scheduledMarketingStage?.key, toast]
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

  const marketingPipelineStats = useMemo(() => {
    const totalContacts = filteredData.length;
    const contactedCount = filteredData.filter((row) => stageKeySets.contacted.includes(deriveStageKey(row))).length;
    const scheduledForZoomCount = filteredData.filter((row) =>
      stageKeySets.scheduledForZoom.includes(deriveStageKey(row))
    ).length;
    const scheduledForOnboardingCount = filteredData.filter((row) =>
      stageKeySets.scheduledForOnboarding.includes(deriveStageKey(row))
    ).length;

    return {
      totalContacts,
      contactedCount,
      scheduledForZoomCount,
      scheduledForOnboardingCount,
    };
  }, [filteredData, deriveStageKey, stageKeySets]);

  const totalPages = Math.max(1, Math.ceil(stageFilteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = stageFilteredData.slice(startIndex, endIndex);


  const handleOpenEdit = (row: TransferPortalRow) => {
    setEditRow(row);
    const currentStageId = row.display_stage_key || row.stage_id;
    const currentStage = dbTransferStages.find((s) => s.key === currentStageId) ?? dbTransferStages.find((s) => s.id === currentStageId);
    setEditStage(currentStage?.label || kanbanStages[0].label);
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
    if (!query) return allStageOptions;
    return allStageOptions.filter((label) => label.toLowerCase().includes(query));
  }, [allStageOptions, editStage]);

  const handleSaveEdit = async () => {
    if (!editRow) return;

    const nextStageLabel = normalizeSubmissionTransitionStatus((editStage || '').trim());
    if (!nextStageLabel) return;

    const nextStage = dbTransferStages.find(s => s.label === nextStageLabel);
    if (!nextStage) return;

    const previousStageId = editRow.display_stage_key || editRow.marketing_source_stage || editRow.stage_id || '';
    const stageChanged = previousStageId !== nextStage.key;

    try {
      setEditSaving(true);

      const isLawyerPortalRow = editRow.pipeline_name === 'lawyer_portal';
      const isLastStage = dbTransferStages.length > 0 && 
                          nextStage.display_order === Math.max(...dbTransferStages.map(s => s.display_order));

      const lawyerLeadsUpdate = supabase as unknown as {
        from: (table: string) => {
          update: (data: { stage_id?: string; additional_notes: string; pipeline_name?: string; marketing_source_stage?: string | null }) => {
            eq: (column: string, value: string) => Promise<{ error: unknown }>;
          };
        };
      };

      const updateData: {
        stage_id?: string;
        additional_notes: string;
        pipeline_name?: string;
        marketing_source_stage?: string | null;
      } = isLawyerPortalRow
        ? isLastStage
          ? {
              additional_notes: editNotes,
              marketing_source_stage: nextStage.key,
            }
          : {
              stage_id: nextStage.key,
              additional_notes: editNotes,
              pipeline_name: 'cold_call_pipeline',
              marketing_source_stage: null,
            }
        : {
            stage_id: isLastStage ? readyToMoveForwardStageKey : nextStage.key,
            additional_notes: editNotes,
            marketing_source_stage: nextStage.key,
            ...(isLastStage ? { pipeline_name: 'lawyer_portal' } : {}),
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

      if (!isLawyerPortalRow && isLastStage) {
        setEditOpen(false);
        setEditRow(null);

        toast({
          title: 'Saved',
          description: 'Lead transitioned to Lawyer Portal - Ready to Move Forward',
        });

        setTimeout(() => {
          fetchData(false);
        }, 500);
      } else if (isLawyerPortalRow && !isLastStage) {
        setEditOpen(false);
        setEditRow(null);

        toast({
          title: 'Saved',
          description: 'Lead moved back to the marketing pipeline',
        });

        setTimeout(() => {
          fetchData(false);
        }, 500);
      } else {
        setData((prev) =>
          prev.map((row) =>
            row.id === editRow.id
              ? {
                  ...row,
                  stage_id: isLawyerPortalRow ? row.stage_id : nextStage.key,
                  display_stage_key: nextStage.key,
                  marketing_source_stage: isLawyerPortalRow ? nextStage.key : nextStage.key,
                  additional_notes: editNotes,
                }
              : row
          )
        );

        setEditOpen(false);
        setEditRow(null);

        toast({
          title: 'Saved',
          description: isLawyerPortalRow
            ? 'Marketing column updated successfully'
            : 'Contact updated successfully',
        });
      }
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
            stage_id: row?.pipeline_name === 'lawyer_portal'
              ? r.stage_id
              : (stage.display_order === Math.max(...dbTransferStages.map(s => s.display_order))
                  ? readyToMoveForwardStageKey
                  : stage.key),
            display_stage_key: stage.key,
            marketing_source_stage: stage.key,
            pipeline_name: row?.pipeline_name === 'lawyer_portal'
              ? r.pipeline_name
              : (stage.display_order === Math.max(...dbTransferStages.map(s => s.display_order))
                  ? 'lawyer_portal'
                  : r.pipeline_name),
          }
        : r
    );
    setData(next);

    try {
      const isLastStage = dbTransferStages.length > 0 && 
                          stage.display_order === Math.max(...dbTransferStages.map(s => s.display_order));

      const lawyerLeadsUpdate = supabase as unknown as {
        from: (table: string) => {
          update: (data: { stage_id?: string; pipeline_name?: string; marketing_source_stage?: string | null }) => {
            eq: (column: string, value: string) => Promise<{ error: unknown }>;
          };
        };
      };

      if (row?.pipeline_name === 'lawyer_portal' && !isLastStage) {
        const { error } = await lawyerLeadsUpdate
          .from('lawyer_leads')
          .update({
            stage_id: stage.key,
            pipeline_name: 'cold_call_pipeline',
            marketing_source_stage: null,
          })
          .eq('id', rowId);

        if (error) throw error;

        toast({
          title: 'Status Updated',
          description: 'Lead moved back to the marketing pipeline',
        });

        setTimeout(() => {
          fetchData(false);
        }, 500);
      } else if (row?.pipeline_name === 'lawyer_portal') {
        const { error } = await lawyerLeadsUpdate
          .from('lawyer_leads')
          .update({ marketing_source_stage: stage.key })
          .eq('id', rowId);

        if (error) throw error;

        toast({
          title: 'Status Updated',
          description: `Lead remains visible in "${stage.label}" on the marketing pipeline`,
        });
      } else if (isLastStage) {
        const updatePayload = supabase as unknown as {
          from: (table: string) => {
            update: (data: { stage_id: string; pipeline_name: string; marketing_source_stage: string }) => {
              eq: (column: string, value: string) => Promise<{ error: unknown }>;
            };
          };
        };

        const { error } = await updatePayload
          .from('lawyer_leads')
          .update({ 
            stage_id: readyToMoveForwardStageKey,
            pipeline_name: 'lawyer_portal',
            marketing_source_stage: stage.key,
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
          .update({ stage_id: stage.key, marketing_source_stage: stage.key })
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading marketing pipeline data...</span>
        </div>
      </div>
    );
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

          <div className="overflow-x-auto">
            <div className="flex flex-nowrap items-center justify-between gap-3 min-w-[1120px]">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contacts..."
                className="w-56"
              />

              <Select value={selectedStage} onValueChange={(value) => {
                setSelectedStage(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-44">
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

              <Select
                value={assigneeFilter}
                onValueChange={(value) => {
                  setAssigneeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-44">
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
              <div className="inline-flex rounded-lg border border-muted bg-background p-0.5 shrink-0">
                {["kanban", "list"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
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
                              key={row.id}
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
                            <tr key={row.id} className="border-b last:border-0">
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
