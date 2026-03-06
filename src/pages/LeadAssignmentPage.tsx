import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type UntypedClient = {
  from: (table: string) => {
    select: (cols: string, options?: { count?: "exact" }) => {
      order: (col: string, opts: { ascending: boolean }) => {
        range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: { message: string } | null; count?: number | null }>;
      };
      in?: (col: string, values: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
    update: (data: unknown) => {
      eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

type MarketingTeamMemberRow = {
  user_id: string;
  display_name: string;
  email: string;
};

type LeadRow = {
  id: string;
  submission_id: string;
  lawyer_full_name: string | null;
  firm_name: string | null;
  created_at: string | null;
  assigned_user_id: string | null;
};

type AssignmentFilter = "all" | "assigned" | "unassigned";

const LeadAssignmentPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);

  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const [team, setTeam] = useState<MarketingTeamMemberRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSelectedMemberIds, setBulkSelectedMemberIds] = useState<Set<string>>(new Set());
  const [bulkEvenlyAssign, setBulkEvenlyAssign] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!user?.id) return;

    setCheckingAccess(true);
    try {
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, v: string) => {
              maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
            };
          };
        };
      };

      const { data, error } = await client
        .from("app_users")
        .select("role,is_super_admin")
        .eq("user_id", user.id)
        .maybeSingle();

      const typed = data as { role?: string | null; is_super_admin?: boolean } | null;
      if (error) throw error;
      const allowed = Boolean(typed?.is_super_admin) || typed?.role === "super_admin";
      setIsSuperAdmin(allowed);
      if (!allowed) navigate("/leads", { replace: true });
    } catch {
      setIsSuperAdmin(false);
      navigate("/leads", { replace: true });
    } finally {
      setCheckingAccess(false);
    }
  }, [navigate, user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sb = supabase as unknown as UntypedClient;

      const [teamRowsRes, leadsRes] = await Promise.all([
        (supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
            };
          };
        })
          .from("marketing_team")
          .select("user_id,created_at")
          .order("created_at", { ascending: false }),
        sb
          .from("lawyer_leads")
          .select("id,submission_id,lawyer_full_name,firm_name,created_at,assigned_user_id", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(0, 4999),
      ]);

      if (teamRowsRes.error) throw teamRowsRes.error;
      if (leadsRes.error) throw leadsRes.error;

      const teamRows = ((teamRowsRes.data ?? []) as unknown as Array<{ user_id: string }>) || [];
      const teamUserIds = teamRows.map((r) => r.user_id).filter(Boolean);

      let composedTeam: MarketingTeamMemberRow[] = [];
      if (teamUserIds.length > 0) {
        const usersRes = await (supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              in: (col: string, values: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
            };
          };
        })
          .from("app_users")
          .select("user_id,email,display_name")
          .in("user_id", teamUserIds);

        if (usersRes.error) throw usersRes.error;

        const users = ((usersRes.data ?? []) as unknown as Array<{ user_id: string; email: string; display_name: string | null }>) || [];
        const userById = new Map(users.map((u) => [u.user_id, u] as const));
        composedTeam = teamUserIds
          .map((id) => {
            const u = userById.get(id);
            if (!u) return null;
            return {
              user_id: id,
              email: u.email,
              display_name: (u.display_name || "").trim() || u.email,
            };
          })
          .filter(Boolean) as MarketingTeamMemberRow[];

        composedTeam.sort((a, b) => a.display_name.localeCompare(b.display_name));
      }

      setTeam(composedTeam);
      setLeads(((leadsRes.data ?? []) as unknown as LeadRow[]) || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load leads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (!checkingAccess && isSuperAdmin) void load();
  }, [checkingAccess, isSuperAdmin, load]);

  const teamLabelById = useMemo(() => {
    const map = new Map<string, string>();
    team.forEach((m) => map.set(m.user_id, m.display_name || m.email));
    return map;
  }, [team]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (assignmentFilter === "assigned" && !l.assigned_user_id) return false;
      if (assignmentFilter === "unassigned" && l.assigned_user_id) return false;
      if (assigneeFilter !== "all" && (l.assigned_user_id || "") !== assigneeFilter) return false;
      return true;
    });
  }, [leads, assignmentFilter, assigneeFilter]);

  const filteredLeadIds = useMemo(() => filteredLeads.map((l) => l.id), [filteredLeads]);

  const selectedCount = useMemo(() => selectedLeadIds.size, [selectedLeadIds]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredLeadIds.length === 0) return false;
    return filteredLeadIds.every((id) => selectedLeadIds.has(id));
  }, [filteredLeadIds, selectedLeadIds]);

  const toggleLeadSelected = useCallback((leadId: string, checked: boolean) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(leadId);
      else next.delete(leadId);
      return next;
    });
  }, []);

  const toggleSelectAllFiltered = useCallback(
    (checked: boolean) => {
      setSelectedLeadIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          filteredLeadIds.forEach((id) => next.add(id));
        } else {
          filteredLeadIds.forEach((id) => next.delete(id));
        }
        return next;
      });
    },
    [filteredLeadIds]
  );

  const toggleBulkMember = useCallback((userId: string, checked: boolean) => {
    setBulkSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);

  const runBulkAssign = useCallback(async () => {
    const leadIds = Array.from(selectedLeadIds);
    const memberIds = Array.from(bulkSelectedMemberIds);

    if (leadIds.length === 0) {
      toast({ title: "Select leads", description: "Select at least one lead to bulk assign", variant: "destructive" });
      return;
    }

    if (memberIds.length === 0) {
      toast({ title: "Select team members", description: "Select at least one marketing team member", variant: "destructive" });
      return;
    }

    setBulkSaving(true);
    try {
      const sb = supabase as unknown as UntypedClient;

      const leadOrder = new Map(filteredLeads.map((l, idx) => [l.id, idx] as const));
      leadIds.sort((a, b) => (leadOrder.get(a) ?? 0) - (leadOrder.get(b) ?? 0));

      const assignments: Array<{ leadId: string; assignedUserId: string }> = [];
      if (bulkEvenlyAssign) {
        leadIds.forEach((leadId, idx) => {
          assignments.push({ leadId, assignedUserId: memberIds[idx % memberIds.length] });
        });
      } else {
        const assignedUserId = memberIds[0];
        leadIds.forEach((leadId) => assignments.push({ leadId, assignedUserId }));
      }

      const chunkSize = 25;
      for (let i = 0; i < assignments.length; i += chunkSize) {
        const chunk = assignments.slice(i, i + chunkSize);
        const results = await Promise.all(
          chunk.map((a) => sb.from("lawyer_leads").update({ assigned_user_id: a.assignedUserId }).eq("id", a.leadId))
        );
        const firstError = results.find((r) => r.error)?.error;
        if (firstError) throw firstError;
      }

      setLeads((prev) => {
        const map = new Map(assignments.map((a) => [a.leadId, a.assignedUserId] as const));
        return prev.map((l) => {
          const assigned = map.get(l.id);
          if (!assigned) return l;
          return { ...l, assigned_user_id: assigned };
        });
      });

      toast({ title: "Bulk assigned", description: `Assigned ${assignments.length} lead(s)` });
      setBulkDialogOpen(false);
      setSelectedLeadIds(new Set());
      setBulkSelectedMemberIds(new Set());
    } catch (e: unknown) {
      const msg = (e as { message?: string } | null)?.message || "Bulk assignment failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setBulkSaving(false);
    }
  }, [bulkEvenlyAssign, bulkSelectedMemberIds, filteredLeads, selectedLeadIds, toast]);

  const updateAssignment = useCallback(
    async (leadId: string, assignedUserId: string | null) => {
      setSavingLeadId(leadId);
      try {
        const sb = supabase as unknown as UntypedClient;
        const res = await sb.from("lawyer_leads").update({ assigned_user_id: assignedUserId }).eq("id", leadId);
        if (res.error) throw res.error;

        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, assigned_user_id: assignedUserId } : l)));
        toast({ title: "Updated", description: "Lead assignment updated" });
      } catch (e: unknown) {
        const msg = (e as { message?: string } | null)?.message || "Failed to update assignment";
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setSavingLeadId(null);
      }
    },
    [toast]
  );

  if (checkingAccess) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking access…
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lead Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Assigned Status</div>
              <Select value={assignmentFilter} onValueChange={(v) => setAssignmentFilter(v as AssignmentFilter)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Assignee</div>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {team.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" disabled={loading || selectedCount === 0}>
                      Bulk Assign{selectedCount ? ` (${selectedCount})` : ""}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bulk Assign Leads</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">Selected leads: {selectedCount}</div>

                      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">Evenly assign</div>
                          <div className="text-xs text-muted-foreground">Round-robin across selected members</div>
                        </div>
                        <Switch checked={bulkEvenlyAssign} onCheckedChange={setBulkEvenlyAssign} />
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Marketing team members</div>
                        {team.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No marketing team members available.</div>
                        ) : (
                          <div className="max-h-64 overflow-auto rounded-md border">
                            {team.map((m) => {
                              const checked = bulkSelectedMemberIds.has(m.user_id);
                              return (
                                <label key={m.user_id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => toggleBulkMember(m.user_id, Boolean(v))}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{m.display_name || m.email}</div>
                                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkSaving}>
                        Cancel
                      </Button>
                      <Button onClick={() => void runBulkAssign()} disabled={bulkSaving}>
                        {bulkSaving ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Assigning…
                          </span>
                        ) : (
                          "Assign"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" onClick={() => void load()} disabled={loading}>
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-sm text-muted-foreground">No leads found.</div>
          ) : (
            <div className="divide-y rounded-md border">
              <div className="flex items-center justify-between gap-3 p-3 bg-muted/30">
                <label className="flex items-center gap-3">
                  <Checkbox checked={isAllFilteredSelected} onCheckedChange={(v) => toggleSelectAllFiltered(Boolean(v))} />
                  <span className="text-sm font-medium">Select all in current view</span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLeadIds(new Set())}
                  disabled={selectedCount === 0}
                >
                  Clear
                </Button>
              </div>
              {filteredLeads.map((l) => {
                const current = l.assigned_user_id || "__UNASSIGNED__";
                const checked = selectedLeadIds.has(l.id);
                return (
                  <div key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleLeadSelected(l.id, Boolean(v))}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {(l.lawyer_full_name || "N/A") + (l.firm_name ? ` — ${l.firm_name}` : "")}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            Submission: {l.submission_id}{" "}
                            {l.assigned_user_id
                              ? `• Assigned to ${teamLabelById.get(l.assigned_user_id) || l.assigned_user_id}`
                              : "• Unassigned"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full sm:w-72">
                      <Select
                        value={current}
                        onValueChange={(value) =>
                          void updateAssignment(l.id, value === "__UNASSIGNED__" ? null : value)
                        }
                        disabled={savingLeadId === l.id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Assign" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__UNASSIGNED__">Unassigned</SelectItem>
                          {team.map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.display_name || m.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {savingLeadId === l.id && (
                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Saving…
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadAssignmentPage;
