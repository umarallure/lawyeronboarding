import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Pencil, StickyNote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAttorneys } from "@/hooks/useAttorneys";
import { usePipelineStages, type PipelineStage } from "@/hooks/usePipelineStages";
import { useAuth } from "@/hooks/useAuth";
import { useMarketingTeamFilterAccess } from "@/hooks/useMarketingTeamFilterAccess";
import {
  parseStageLabel,
  deriveParentStages,
  buildStatusLabel,
  deriveParentKey,
  type ParentStage,
} from "@/lib/stageUtils";

export interface SubmissionPortalRow {
  id: string;
  submission_id: string;
  pipeline_name?: string | null;
  display_stage_key?: string;
  marketing_source_stage?: string | null;
  date?: string;
  insured_name?: string;
  lead_vendor?: string;
  client_phone_number?: string;
  buffer_agent?: string;
  agent?: string;
  licensed_agent_account?: string;
  assigned_attorney_id?: string | null;
  stage_id?: string | null;
  assigned_user_id?: string | null;
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    marketingTeam,
    canViewTeamAssigneeFilter,
    loading: marketingFilterAccessLoading,
  } = useMarketingTeamFilterAccess(user?.id);

  // --- Dynamic pipeline stages from DB ---
  const { stages: dbSubmissionStages, loading: stagesLoading } = usePipelineStages("lawyer_portal");
  const { stages: dbMarketingStages, loading: marketingStagesLoading } = usePipelineStages("cold_call_pipeline");

  // --- Derive parent stages (kanban columns) from flat DB stages ---
  const parentStages = useMemo(() => deriveParentStages(dbSubmissionStages), [dbSubmissionStages]);

  const kanbanStages = useMemo(() => {
    return parentStages.map((s) => ({ key: s.key, label: s.label }));
  }, [parentStages]);

  const stageTheme = useMemo(() => {
    const theme: Record<string, { column: string; header: string }> = {};
    parentStages.forEach((s) => {
      theme[s.key] = { column: s.columnClass, header: s.headerClass };
    });
    return theme;
  }, [parentStages]);

  // Map of parent label → reasons for edit form
  const reasonsByParent = useMemo(() => {
    const map: Record<string, string[]> = {};
    parentStages.forEach((s) => {
      if (s.reasons.length > 0) map[s.label] = s.reasons;
    });
    return map;
  }, [parentStages]);

  const deriveStageKey = useCallback((row: SubmissionPortalRow): string => {
    const stageId = (row.display_stage_key || row.stage_id || '').trim();
    if (!stageId) return parentStages[0]?.key ?? '';

    const asKey = dbSubmissionStages.find((s) => s.key === stageId);
    if (asKey?.key) return asKey.key;

    const legacy = dbSubmissionStages.find((s) => s.id === stageId);
    if (legacy?.key) return legacy.key;

    if (parentStages.some((s) => s.key === stageId)) return stageId;
    return parentStages[0]?.key ?? '';
  }, [dbSubmissionStages, parentStages]);

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

  const getStatusForStage = (stageKey: string) => {
    return stageKey;
  };

  const buildAllowedStatuses = () => {
    // Include all full DB stage labels (with reasons) + parent-only labels
    const fullLabels = dbSubmissionStages.map((s) => s.label);
    const parentLabels = parentStages.map((s) => s.label);
    return Array.from(new Set([...fullLabels, ...parentLabels]));
  };

  const [data, setData] = useState<SubmissionPortalRow[]>([]);
  const [filteredData, setFilteredData] = useState<SubmissionPortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("__ALL__");
  const [leadVendorFilter, setLeadVendorFilter] = useState("__ALL__");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [dataCompletenessFilter, setDataCompletenessFilter] = useState("__ALL__");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [columnPage, setColumnPage] = useState<Record<string, number>>({});
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});

  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [didInitAssigneeFilter, setDidInitAssigneeFilter] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editRow, setEditRow] = useState<SubmissionPortalRow | null>(null);
  const [editStage, setEditStage] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStageOpen, setEditStageOpen] = useState(false);

  const { toast } = useToast();
  const { attorneys } = useAttorneys();

  const attorneyById = useMemo(() => {
    const map: Record<string, string> = {};
    (attorneys || []).forEach((a) => {
      if (!a.user_id) return;
      const label = (a.full_name || a.primary_email || "").trim();
      if (!label) return;
      map[a.user_id] = label;
    });
    return map;
  }, [attorneys]);

  // Remove duplicates based on insured_name, client_phone_number, and lead_vendor
  const removeDuplicates = useCallback((records: SubmissionPortalRow[]): SubmissionPortalRow[] => {
    const seen = new Map<string, SubmissionPortalRow>();
    
    records.forEach(record => {
      const key = `${record.insured_name || ''}|${record.client_phone_number || ''}|${record.lead_vendor || ''}`;
      
      // Keep the most recent record (first in our sorted array)
      if (!seen.has(key)) {
        seen.set(key, record);
      }
    });
    
    return Array.from(seen.values());
  }, []);

  // Apply filters and duplicate removal
  const applyFilters = useCallback((records: SubmissionPortalRow[]): SubmissionPortalRow[] => {
    let filtered = records;

    if (assigneeFilter !== '__ALL__' && assigneeFilter !== 'all') {
      filtered = filtered.filter((record) => (record.assigned_user_id || '') === assigneeFilter);
    }

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter(record => record.date === dateFilter);
    }

    // Apply status filter
    if (statusFilter !== "__ALL__") {
      filtered = filtered.filter((record) => (record.status || '') === statusFilter);
    }

    // Apply lead vendor filter
    if (leadVendorFilter !== "__ALL__") {
      filtered = filtered.filter((record) => (record.lead_vendor || '') === leadVendorFilter);
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
    if (!showDuplicates) filtered = removeDuplicates(filtered);

    // Apply data completeness filter
    // dataCompletenessFilter is based on the old merged submission_portal flow.
    // lawyer_leads rows do not include those fields, so keep behavior as a no-op.

    return filtered;
  }, [assigneeFilter, dateFilter, leadVendorFilter, removeDuplicates, searchTerm, showDuplicates, statusFilter]);

  useEffect(() => {
    if (!user?.id) return;
    if (didInitAssigneeFilter) return;
    if (marketingFilterAccessLoading) return;
    if (!canViewTeamAssigneeFilter) {
      setAssigneeFilter(user.id);
    }
    setDidInitAssigneeFilter(true);
  }, [canViewTeamAssigneeFilter, didInitAssigneeFilter, marketingFilterAccessLoading, user?.id]);

  const leadVendorOptions = useMemo(() => {
    const set = new Set<string>();
    (data || []).forEach((r) => {
      const v = (r.lead_vendor || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const readyToMoveForwardStage = useMemo(() => {
    return (
      dbSubmissionStages.find((s) => s.key === "ready_to_move_forward") ||
      dbSubmissionStages.find((s) => s.label.trim().toLowerCase() === "ready to move forward") ||
      dbSubmissionStages[0] ||
      null
    );
  }, [dbSubmissionStages]);

  const scheduledMarketingStageIds = useMemo(() => {
    const onboardingStages = dbMarketingStages.filter((stage) => {
      const key = (stage.key || "").trim().toLowerCase();
      const label = (stage.label || "").trim().toLowerCase();
      return key.includes("scheduled") && key.includes("onboard")
        || label.includes("scheduled") && label.includes("onboard");
    });

    const fallbackStages = onboardingStages.length > 0
      ? onboardingStages
      : dbMarketingStages.filter((stage) => {
          const key = (stage.key || "").trim().toLowerCase();
          const label = (stage.label || "").trim().toLowerCase();
          return key.includes("scheduled") && key.includes("zoom")
            || label.includes("scheduled") && label.includes("zoom");
        });

    return new Set(
      fallbackStages
        .flatMap((stage) => [stage.id, stage.key])
        .map((value) => (value || "").trim())
        .filter(Boolean)
    );
  }, [dbMarketingStages]);

  // Function to generate verification log summary showing complete call workflow
  const generateVerificationLogSummary = (logs: CallLog[], submission?: unknown): string => {
    if (!logs || logs.length === 0) {
      // Fallback to data from submission/call_results table if available
      const maybeSubmission = submission as {
        has_submission_data?: boolean;
        buffer_agent?: string | null;
        agent?: string | null;
        agent_who_took_call?: string | null;
        licensed_agent_account?: string | null;
      };
      if (maybeSubmission && maybeSubmission.has_submission_data) {
        const workflow = [];
        
        if (maybeSubmission.buffer_agent) {
          workflow.push(`🟡 Buffer: ${maybeSubmission.buffer_agent}`);
        }
        
        if (maybeSubmission.agent && maybeSubmission.agent !== maybeSubmission.buffer_agent) {
          workflow.push(`📞 Handled by: ${maybeSubmission.agent}`);
        }
        
        if (maybeSubmission.licensed_agent_account) {
          if (maybeSubmission.buffer_agent || maybeSubmission.agent_who_took_call) {
            workflow.push(`➡️ Transfer to Licensed`);
          }
          workflow.push(`🔵 Licensed: ${maybeSubmission.licensed_agent_account}`);
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

  // Fetch data from Supabase
  const fetchData = useCallback(async (showRefreshToast = false) => {
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

      const [lawyerPortalRes, marketingPipelineRes] = await Promise.all([
        lawyerLeadsQuery
          .from('lawyer_leads')
          .select('id,submission_id,lawyer_full_name,firm_name,phone_number,stage_id,submission_date,created_at,additional_notes,assigned_user_id,pipeline_name,marketing_source_stage')
          .eq('pipeline_name', 'lawyer_portal')
          .order('created_at', { ascending: false }),
        lawyerLeadsQuery
          .from('lawyer_leads')
          .select('id,submission_id,lawyer_full_name,firm_name,phone_number,stage_id,submission_date,created_at,additional_notes,assigned_user_id,pipeline_name,marketing_source_stage')
          .eq('pipeline_name', 'cold_call_pipeline')
          .order('created_at', { ascending: false }),
      ]);

      if (lawyerPortalRes.error) {
        console.error('Error fetching lawyer portal leads:', lawyerPortalRes.error);
        toast({
          title: 'Error',
          description: 'Failed to fetch lawyer portal data',
          variant: 'destructive',
        });
        return;
      }

      if (marketingPipelineRes.error) {
        console.error('Error fetching marketing pipeline leads for lawyer portal:', marketingPipelineRes.error);
        toast({
          title: 'Error',
          description: 'Failed to fetch lawyer portal data',
          variant: 'destructive',
        });
        return;
      }

      const leadsRaw = lawyerPortalRes.data;
      const marketingLeadsRaw = marketingPipelineRes.data;

      const leads = ((leadsRaw ?? []) as unknown as Array<{
        id: string;
        submission_id: string;
        pipeline_name?: string | null;
        lawyer_full_name: string | null;
        firm_name: string | null;
        phone_number: string | null;
        stage_id: string | null;
        marketing_source_stage?: string | null;
        submission_date: string | null;
        created_at: string | null;
        additional_notes: string | null;
        assigned_user_id?: string | null;
      }>);

      const eligibleLawyerPortalLeads = leads.filter((lead) => {
        const sourceStage = (lead.marketing_source_stage || '').trim();
        if (!sourceStage) return true;
        return scheduledMarketingStageIds.has(sourceStage);
      });

      const marketingLeads = ((marketingLeadsRaw ?? []) as unknown as Array<{
        id: string;
        submission_id: string;
        pipeline_name?: string | null;
        lawyer_full_name: string | null;
        firm_name: string | null;
        phone_number: string | null;
        stage_id: string | null;
        marketing_source_stage?: string | null;
        submission_date: string | null;
        created_at: string | null;
        additional_notes: string | null;
        assigned_user_id?: string | null;
      }>).filter((lead) => scheduledMarketingStageIds.has((lead.stage_id || "").trim()));

      const mapped: SubmissionPortalRow[] = eligibleLawyerPortalLeads.map((l) => {
        const lawyerStageLabel = dbSubmissionStages.find((s) => s.key === (l.stage_id || ''))?.label ||
          dbSubmissionStages.find((s) => s.id === (l.stage_id || ''))?.label ||
          undefined;

        return {
          id: l.id,
          submission_id: l.submission_id,
          pipeline_name: l.pipeline_name ?? 'lawyer_portal',
          marketing_source_stage: l.marketing_source_stage ?? null,
          insured_name: l.lawyer_full_name ?? undefined,
          client_phone_number: l.phone_number ?? undefined,
          lead_vendor: l.firm_name ?? undefined,
          stage_id: l.stage_id,
          assigned_user_id: l.assigned_user_id ?? null,
          status: lawyerStageLabel,
          submission_date: l.submission_date ?? undefined,
          created_at: l.created_at ?? undefined,
          notes: l.additional_notes ?? undefined,
          date: (l.submission_date || l.created_at || '').slice(0, 10) || undefined,
        };
      });

      const supplementalReadyRows: SubmissionPortalRow[] = marketingLeads.map((lead) => ({
        id: lead.id,
        submission_id: lead.submission_id,
        pipeline_name: lead.pipeline_name ?? 'cold_call_pipeline',
        display_stage_key: readyToMoveForwardStage?.key ?? 'ready_to_move_forward',
        marketing_source_stage: lead.marketing_source_stage ?? lead.stage_id ?? null,
        insured_name: lead.lawyer_full_name ?? undefined,
        client_phone_number: lead.phone_number ?? undefined,
        lead_vendor: lead.firm_name ?? undefined,
        stage_id: lead.stage_id,
        assigned_user_id: lead.assigned_user_id ?? null,
        status: readyToMoveForwardStage?.label ?? 'Ready to Move Forward',
        submission_date: lead.submission_date ?? undefined,
        created_at: lead.created_at ?? undefined,
        notes: lead.additional_notes ?? undefined,
        date: (lead.submission_date || lead.created_at || '').slice(0, 10) || undefined,
      }));

      const combined = [...mapped, ...supplementalReadyRows].sort((a, b) =>
        new Date(b.created_at || b.submission_date || 0).getTime() - new Date(a.created_at || a.submission_date || 0).getTime()
      );

      setData(combined);
      fetchNoteCounts(combined);

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
  }, [dbSubmissionStages, readyToMoveForwardStage, scheduledMarketingStageIds, toast]);

  // Update filtered data whenever data or filters change
  useEffect(() => {
    setFilteredData(applyFilters(data));
  }, [applyFilters, data]);

  useEffect(() => {
    if (stagesLoading || marketingStagesLoading) return;
    void fetchData();
  }, [fetchData, marketingStagesLoading, stagesLoading]);

  const handleRefresh = () => {
    void fetchData(true);
  };

  const fetchNoteCounts = async (rows: SubmissionPortalRow[] | null | undefined) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const leadIds = safeRows.map((r) => r.id).filter(Boolean);
    if (leadIds.length === 0) {
      setNoteCounts({});
      return;
    }

    const counts: Record<string, number> = {};
    leadIds.forEach((id) => {
      counts[id] = 0;
    });

    // lawyer_lead_notes
    try {
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (col: string, values: string[]) => Promise<{ data: unknown; error: { message?: string } | null }>;
          };
        };
      };

      const { data: noteRows, error: notesErr } = await client
        .from('lawyer_lead_notes')
        .select('lead_id')
        .in('lead_id', leadIds);

      if (!notesErr && Array.isArray(noteRows)) {
        (noteRows as Array<{ lead_id: string }>).forEach((row) => {
          if (!row?.lead_id) return;
          if (counts[row.lead_id] === undefined) return;
          counts[row.lead_id] = (counts[row.lead_id] || 0) + 1;
        });
      }
    } catch (e) {
      console.warn('Failed to fetch lead note counts', e);
    }

    // Legacy notes on lawyer_leads.additional_notes (mapped to row.notes)
    safeRows.forEach((r) => {
      if ((r.notes || '').trim()) {
        counts[r.id] = (counts[r.id] || 0) + 1;
      }
    });

    setNoteCounts(counts);
  };

  const handleDropToStage = async (rowId: string, stageKey: string) => {
    const prev = data;
    const row = prev.find((item) => item.id === rowId);
    const readyStageKey = readyToMoveForwardStage?.key ?? 'ready_to_move_forward';
    const shouldPromoteToLawyerPortal =
      row?.pipeline_name !== 'lawyer_portal' && stageKey !== readyStageKey;

    if (row?.pipeline_name !== 'lawyer_portal' && stageKey === readyStageKey) {
      return;
    }

    const next = prev.map((r) =>
      r.id === rowId
        ? {
            ...r,
            stage_id: stageKey,
            display_stage_key: undefined,
            status: dbSubmissionStages.find((s) => s.key === stageKey)?.label || r.status,
            marketing_source_stage: r.marketing_source_stage ?? r.stage_id ?? null,
            pipeline_name: shouldPromoteToLawyerPortal ? 'lawyer_portal' : r.pipeline_name,
          }
        : r
    );
    setData(next);

    try {
      const sb = supabase as unknown as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
          };
        };
      };

      const { error } = await sb
        .from('lawyer_leads')
        .update(
          shouldPromoteToLawyerPortal
            ? {
                stage_id: stageKey,
                pipeline_name: 'lawyer_portal',
                marketing_source_stage: row?.marketing_source_stage ?? row?.stage_id ?? null,
              }
            : { stage_id: stageKey }
        )
        .eq('id', rowId);

      if (error) throw error;

      const stageLabel = dbSubmissionStages.find((s) => s.key === stageKey)?.label || stageKey;

      toast({
        title: 'Status Updated',
        description: `Lead updated to "${stageLabel}"`,
      });
    } catch (e) {
      console.error('Error updating status:', e);
      setData(prev);
      toast({
        title: 'Error',
        description: 'Failed to update lead status',
        variant: 'destructive',
      });
    }
  };

  const leadsByStage = useMemo(() => {
    const grouped = new Map<string, SubmissionPortalRow[]>();
    kanbanStages.forEach((stage) => grouped.set(stage.key, []));
    filteredData.forEach((row) => {
      const stageKey = deriveStageKey(row);
      grouped.get(stageKey)?.push(row);
    });
    return grouped;
  }, [filteredData, kanbanStages, deriveStageKey]);

  useEffect(() => {
    setColumnPage((prev) => {
      const next: Record<string, number> = { ...prev };
      kanbanStages.forEach((stage) => {
        const rows = leadsByStage.get(stage.key) || [];
        const pageSize = 25;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        const current = Number(next[stage.key] ?? 1);
        next[stage.key] = Math.min(Math.max(1, current), totalPages);
      });
      return next;
    });
  }, [kanbanStages, leadsByStage]);

  const getStageDisplayLabel = (label: string) => label.replace(/^Stage\s+\d+\s*:\s*/i, "");

  const allParentStageLabels = useMemo(
    () => parentStages.map((s) => s.label),
    [parentStages]
  );

  const editStageMatches = useMemo(() => {
    const query = (editStage || '').trim().toLowerCase();
    if (!query) return allParentStageLabels;
    return allParentStageLabels.filter((label) => label.toLowerCase().includes(query));
  }, [allParentStageLabels, editStage]);

  // Available reasons for the currently selected parent in the edit form
  const editAvailableReasons = useMemo(() => {
    const parentLabel = (editStage || '').trim();
    return reasonsByParent[parentLabel] || [];
  }, [editStage, reasonsByParent]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading lawyer portal data...</span>
        </div>
      </div>
    );
  }

  const handleView = (row: SubmissionPortalRow) => {
    if (!row?.id) return;
    navigate(`/lead-detail/${encodeURIComponent(row.id)}`, {
      state: { activeNav: '/submission-portal' },
    });
  };

  const handleOpenEdit = (row: SubmissionPortalRow) => {
    setEditRow(row);
    const currentLabel =
      dbSubmissionStages.find((s) => s.key === (row.display_stage_key || row.stage_id || ''))?.label ||
      dbSubmissionStages.find((s) => s.id === (row.display_stage_key || row.stage_id || ''))?.label ||
      '';
    const { parent, reason } = parseStageLabel(currentLabel.trim());
    setEditStage(parent);
    setEditReason(reason || '');
    setEditNotes('');
    setEditStageOpen(false);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;
    const parentLabel = (editStage || '').trim();
    if (!parentLabel) return;

    // Build the full status: "Parent - Reason" or just "Parent"
    const reasons = reasonsByParent[parentLabel];
    const selectedReason = (editReason || '').trim();
    const nextStage = reasons && reasons.length > 0 && selectedReason
      ? buildStatusLabel(parentLabel, selectedReason)
      : parentLabel;

    const nextStageRow = dbSubmissionStages.find((s) => s.label === nextStage);
    if (!nextStageRow) return;

    const previousStage = (editRow.display_stage_key || editRow.stage_id || '').trim();
    const stageChanged = previousStage !== nextStageRow.key;

    try {
      setEditSaving(true);

      const sb = supabase as unknown as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
          };
          insert: (rows: unknown) => Promise<{ error: { message?: string } | null }>;
          select: (cols: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
            };
          };
        };
        auth: {
          getUser: () => Promise<{ data: { user: { id: string; email?: string | null } | null } | null; error: { message?: string } | null }>;
        };
      };

      const { error } = await sb
        .from('lawyer_leads')
        .update(
          editRow.pipeline_name !== 'lawyer_portal'
            ? stageChanged
              ? {
                  stage_id: nextStageRow.key,
                  additional_notes: editNotes,
                  pipeline_name: 'lawyer_portal',
                  marketing_source_stage: editRow.marketing_source_stage ?? editRow.stage_id ?? null,
                }
              : { additional_notes: editNotes }
            : { stage_id: nextStageRow.key, additional_notes: editNotes }
        )
        .eq('id', editRow.id);

      if (error) throw error;

      const notesText = (editNotes || '').trim() || 'No notes provided.';

      const trimmedNote = (editNotes || '').trim();
      if (trimmedNote.length > 0) {
        try {
          const { data: userData, error: userErr } = await sb.auth.getUser();
          const authUser = userData?.user;
          if (userErr || !authUser?.id) {
            console.warn('Failed to fetch auth user for note insert', userErr);
          } else {
            const { data: appUserRow, error: appUserErr } = await sb
              .from('app_users')
              .select('display_name,email')
              .eq('user_id', authUser.id)
              .maybeSingle();

            if (appUserErr) {
              console.warn('Failed to resolve created_by_name', appUserErr);
            }

            const typed = appUserRow as { display_name?: string | null; email?: string | null } | null;
            const createdByName = (typed?.display_name || '').trim() || typed?.email || authUser.email || null;

            const { error: insertErr } = await sb.from('lawyer_lead_notes').insert({
              lead_id: editRow.id,
              note: trimmedNote,
              created_by: authUser.id,
              created_by_name: createdByName,
            });

            if (insertErr) {
              console.warn('Failed to insert lawyer_lead_notes row', insertErr);
            }
          }
        } catch (e) {
          console.warn('Unexpected error inserting lead note', e);
        }
      }
      if (stageChanged || trimmedNote.length > 0) {
        try {
          const { error: slackError } = await supabase.functions.invoke('disposition-change-slack-alert', {
            body: {
              leadId: editRow.id,
              submissionId: editRow.submission_id ?? null,
              leadVendor: editRow.lead_vendor ?? '',
              insuredName: editRow.insured_name ?? null,
              clientPhoneNumber: editRow.client_phone_number ?? null,
              previousDisposition: editRow.status ?? null,
              newDisposition: nextStage,
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
        prev.map((r) =>
          r.id === editRow.id
            ? {
                ...r,
                stage_id:
                  editRow.pipeline_name !== 'lawyer_portal' && !stageChanged
                    ? r.stage_id
                    : nextStageRow.key,
                display_stage_key:
                  editRow.pipeline_name !== 'lawyer_portal'
                    ? (stageChanged ? undefined : r.display_stage_key)
                    : undefined,
                notes: editNotes,
                status: nextStage,
                marketing_source_stage: r.marketing_source_stage ?? editRow.marketing_source_stage ?? editRow.stage_id ?? null,
                pipeline_name: editRow.pipeline_name !== 'lawyer_portal' && stageChanged ? 'lawyer_portal' : r.pipeline_name,
              }
            : r
        )
      );
      setFilteredData((prev) =>
        prev.map((r) =>
          r.id === editRow.id
            ? {
                ...r,
                stage_id:
                  editRow.pipeline_name !== 'lawyer_portal' && !stageChanged
                    ? r.stage_id
                    : nextStageRow.key,
                display_stage_key:
                  editRow.pipeline_name !== 'lawyer_portal'
                    ? (stageChanged ? undefined : r.display_stage_key)
                    : undefined,
                notes: editNotes,
                status: nextStage,
                marketing_source_stage: r.marketing_source_stage ?? editRow.marketing_source_stage ?? editRow.stage_id ?? null,
                pipeline_name: editRow.pipeline_name !== 'lawyer_portal' && stageChanged ? 'lawyer_portal' : r.pipeline_name,
              }
            : r
        )
      );

      toast({
        title: 'Contact Updated',
        description: 'Stage and notes updated successfully.',
      });

      setEditOpen(false);
    } catch (e) {
      console.error('Error updating stage/notes:', e);
      toast({
        title: 'Error',
        description: 'Failed to update stage/notes',
        variant: 'destructive',
      });
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative w-full max-w-md" ref={searchDropdownRef}>
                <Input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSearchDropdownOpen(true);
                  }}
                  onFocus={() => setSearchDropdownOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setSearchDropdownOpen(false), 200);
                  }}
                  placeholder="Search by lawyer, law firm, phone..."
                  className="w-full"
                />

                {searchDropdownOpen && (() => {
                  const query = searchTerm.trim().toLowerCase();
                  const base = data;
                  const suggestions = (query ? base : base).filter((lead) => {
                    if (!query) return true;
                    const name = (lead.insured_name || "").toLowerCase();
                    const firm = (lead.lead_vendor || "").toLowerCase();
                    const phone = (lead.client_phone_number || "").toLowerCase();
                    return name.includes(query) || firm.includes(query) || phone.includes(query);
                  });

                  const displayItems = suggestions.slice(0, 50);
                  if (displayItems.length === 0) return null;

                  return (
                    <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                      {displayItems.map((lead) => {
                        const name = (lead.insured_name || "N/A").trim() || "N/A";
                        const firm = (lead.lead_vendor || "").trim();
                        const phone = (lead.client_phone_number || "").trim();
                        const sub = [firm, phone].filter(Boolean).join(" • ");
                        const nextTerm = (lead.insured_name || lead.lead_vendor || lead.client_phone_number || "").trim();

                        return (
                          <button
                            key={lead.id}
                            type="button"
                            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSearchTerm(nextTerm);
                              setSearchDropdownOpen(false);
                            }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate font-medium">{name}</span>
                              {sub ? <span className="truncate text-xs text-muted-foreground">{sub}</span> : null}
                            </div>
                          </button>
                        );
                      })}

                      {suggestions.length > 50 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                          {suggestions.length - 50} more results...
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <Select value={leadVendorFilter} onValueChange={(v) => setLeadVendorFilter(v)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All Firms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__ALL__">All Firms</SelectItem>
                    {leadVendorOptions.map((vendor) => (
                      <SelectItem key={vendor} value={vendor}>
                        {vendor}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__ALL__">All Statuses</SelectItem>
                    {dbSubmissionStages.map((s) => (
                      <SelectItem key={s.key} value={s.label}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={assigneeFilter}
                onValueChange={(v) => setAssigneeFilter(v)}
              >
                <SelectTrigger className="w-56">
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

              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-56" />
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">
                {filteredData.length} records
              </Badge>
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-auto" onDragOver={handleKanbanDragOver}>
            <div className="p-4">
              <div
                className="flex min-h-0 gap-3 pr-2"
                style={{ minWidth: `${kanbanStages.length * 18}rem` }}
              >
                {kanbanStages.map((stage) => {
                  const rows = leadsByStage.get(stage.key) || [];
                  const pageSize = 25;
                  const current = Number(columnPage[stage.key] ?? 1);
                  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
                  const startIndex = (current - 1) * pageSize;
                  const endIndex = startIndex + pageSize;
                  const pageRows = rows.slice(startIndex, endIndex);

                  return (
                    <Card
                      key={stage.key}
                      className={
                        "flex min-h-[560px] w-[26rem] flex-col bg-muted/20 " +
                        stageTheme[stage.key].column +
                        (dragOverStage === stage.key ? " ring-2 ring-primary/30" : "")
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
                      <CardHeader
                        className={
                          "flex flex-row items-center justify-between border-b px-3 py-2 " +
                          stageTheme[stage.key].header
                        }
                      >
                        <CardTitle className="text-sm font-semibold">{getStageDisplayLabel(stage.label)}</CardTitle>
                        <Badge variant="secondary">{rows.length}</Badge>
                      </CardHeader>
                      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                        {pageRows.length === 0 ? (
                          <div className="flex flex-1 h-full items-center justify-center rounded-md border border-dashed border-muted-foreground/30 px-3 py-6 text-center text-xs text-muted-foreground">
                            No leads
                          </div>
                        ) : (
                          pageRows.map((row) => {
                            const closer = row.licensed_agent_account || row.agent || row.buffer_agent || "-";
                            const attorney = row.assigned_attorney_id ? (attorneyById[row.assigned_attorney_id] || "-") : "-";

                            return (
                              <Card
                                key={row.id}
                                draggable
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
                                className={
                                  "w-full transition cursor-pointer " +
                                  (draggingId === row.id ? "opacity-70" : "")
                                }
                              >
                                <CardContent className="p-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold">{row.insured_name || '—'}</div>
                                      <div className="mt-0.5 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                          <span>{row.client_phone_number || '—'}</span>
                                          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                                            <StickyNote className="h-3.5 w-3.5" />
                                            <span>{noteCounts[row.id] ?? 0}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="shrink-0">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEdit(row);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <Badge variant="secondary" className="text-xs">{row.lead_vendor || '—'}</Badge>
                                    <div className="text-xs text-muted-foreground">{row.date || ''}</div>
                                  </div>

                                  {(() => {
                                    const { reason } = parseStageLabel((row.status || '').trim());
                                    return reason ? (
                                      <div className="mt-1.5">
                                        <Badge variant="outline" className="text-[11px] font-normal">{reason}</Badge>
                                      </div>
                                    ) : null;
                                  })()}

                                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                                    <div>
                                      <span className="font-medium">Onboarding Agent:</span> {closer}
                                    </div>
                                    <div>
                                      <span className="font-medium">Attorney:</span> {attorney}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </CardContent>
                      <div className="flex items-center justify-between border-t px-3 py-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setColumnPage((prev) => ({
                              ...prev,
                              [stage.key]: Math.max(1, (Number(prev[stage.key] ?? 1) - 1)),
                            }))
                          }
                          disabled={current <= 1}
                        >
                          Previous
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          Page {current} of {totalPages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setColumnPage((prev) => ({
                              ...prev,
                              [stage.key]: Math.min(totalPages, (Number(prev[stage.key] ?? 1) + 1)),
                            }))
                          }
                          disabled={current >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

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
                    setEditReason('');
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
                            setEditReason('');
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

            {editAvailableReasons.length > 0 && (
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={editReason} onValueChange={(v) => setEditReason(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {editAvailableReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}

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
  );
};

export default SubmissionPortalPage;
