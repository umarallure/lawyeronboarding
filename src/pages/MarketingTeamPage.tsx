import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";

type UntypedClient = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      in: (col: string, values: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      eq: (col: string, v: string) => {
        maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
    insert: (data: unknown) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

type AppUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string | null;
  is_super_admin: boolean;
};

type MarketingTeamMemberRow = {
  user_id: string;
  display_name: string;
  email: string;
  created_at: string;
};

const MarketingTeamPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  const [team, setTeam] = useState<MarketingTeamMemberRow[]>([]);
  const [allUsers, setAllUsers] = useState<AppUserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [teamRowCount, setTeamRowCount] = useState(0);

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
    setLoadError("");
    try {
      const sb = supabase as unknown as UntypedClient;

      const [teamRowsRes, usersRes] = await Promise.all([
        sb.from("marketing_team").select("user_id,created_at").order("created_at", { ascending: false }),
        sb.from("app_users").select("user_id,email,display_name,role,is_super_admin").order("email", { ascending: true }),
      ]);

      if (teamRowsRes.error) throw teamRowsRes.error;
      if (usersRes.error) throw usersRes.error;

      const teamRows = ((teamRowsRes.data ?? []) as unknown as Array<{ user_id: string; created_at: string }>) || [];
      const users = ((usersRes.data ?? []) as unknown as AppUserRow[]) || [];
      const userById = new Map(users.map((u) => [u.user_id, u] as const));

      setTeamRowCount(teamRows.length);

      const composedTeam: MarketingTeamMemberRow[] = teamRows
        .map((t) => {
          const u = userById.get(t.user_id);
          if (!u) {
            return {
              user_id: t.user_id,
              email: "",
              display_name: t.user_id,
              created_at: t.created_at,
            };
          }
          return {
            user_id: t.user_id,
            email: u.email,
            display_name: (u.display_name || "").trim() || u.email,
            created_at: t.created_at,
          };
        });

      setTeam(composedTeam);
      setAllUsers(users);
    } catch (e) {
      console.error(e);
      const msg = (e as { message?: string } | null)?.message || "Failed to load marketing team";
      setLoadError(msg);
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
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

  const selectableUsers = useMemo(() => {
    const inTeam = new Set(team.map((t) => t.user_id));
    return allUsers.filter((u) => !inTeam.has(u.user_id));
  }, [allUsers, team]);

  const addToTeam = useCallback(async () => {
    if (!selectedUserId) return;

    setSaving(true);
    try {
      const sb = supabase as unknown as UntypedClient;
      const res = await sb.from("marketing_team").insert({ user_id: selectedUserId });
      if (res.error) throw res.error;

      toast({ title: "Added", description: "User added to marketing team" });
      setSelectedUserId("");
      await load();
    } catch (e: unknown) {
      const msg = (e as { message?: string } | null)?.message || "Failed to add user";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [load, selectedUserId, toast]);

  const removeFromTeam = useCallback(
    async (userId: string) => {
      setSaving(true);
      try {
        const sb = supabase as unknown as UntypedClient;
        const res = await sb.from("marketing_team").delete().eq("user_id", userId);
        if (res.error) throw res.error;

        toast({ title: "Removed", description: "User removed from marketing team" });
        await load();
      } catch (e: unknown) {
        const msg = (e as { message?: string } | null)?.message || "Failed to remove user";
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    },
    [load, toast]
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
          <CardTitle>Marketing Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={saving || loading}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading users..." : "Select user"} />
                </SelectTrigger>
                <SelectContent>
                  {selectableUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.display_name?.trim() || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addToTeam} disabled={!selectedUserId || saving || loading} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>

          {loadError ? (
            <div className="text-sm text-destructive">{loadError}</div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Users loaded: {allUsers.length} • Marketing team rows: {teamRowCount}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading team…
            </div>
          ) : team.length === 0 ? (
            <div className="text-sm text-muted-foreground">No marketing team members yet.</div>
          ) : (
            <div className="divide-y rounded-md border">
              {team.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.display_name}</div>
                    <div className="text-sm text-muted-foreground truncate">{m.email || m.user_id}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => void removeFromTeam(m.user_id)}
                    className="text-destructive hover:text-destructive"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingTeamPage;
