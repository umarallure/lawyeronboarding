import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type MarketingTeamMember = {
  user_id: string;
  display_name: string;
  email: string;
};

type AppUserRoleRow = {
  role?: string | null;
  is_super_admin?: boolean | null;
};

type UserRoleRow = {
  role?: string | null;
};

type QueryError = {
  message?: string;
} | null;

type AppUserIdentityRow = {
  user_id: string;
  email: string;
  display_name: string | null;
};

const PRIVILEGED_ROLES = ["admin", "super_admin"] as const;

const hasPrivilegedRole = (role: string | null | undefined) => {
  return Boolean(role && PRIVILEGED_ROLES.includes(role as (typeof PRIVILEGED_ROLES)[number]));
};

export const useMarketingTeamFilterAccess = (userId?: string) => {
  const [marketingTeam, setMarketingTeam] = useState<MarketingTeamMember[]>([]);
  const [canViewTeamAssigneeFilter, setCanViewTeamAssigneeFilter] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setMarketingTeam([]);
      setCanViewTeamAssigneeFilter(false);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const load = async () => {
      setLoading(true);

      try {
        const sb = supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              eq: (column: string, value: string) => {
                maybeSingle: () => Promise<{ data: unknown; error: QueryError }>;
                in: (column: string, values: string[]) => {
                  eq: (column: string, value: boolean) => {
                    limit: (count: number) => {
                      maybeSingle: () => Promise<{ data: unknown; error: QueryError }>;
                    };
                  };
                };
              };
              order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: QueryError }>;
              in: (column: string, values: string[]) => Promise<{ data: unknown; error: QueryError }>;
            };
          };
        };

        const leadsClient = supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => Promise<{ data: unknown; error: QueryError }>;
          };
        };

        const [appUserRes, teamRes, assignedUsersRes] = await Promise.all([
          sb.from("app_users").select("role,is_super_admin").eq("user_id", userId).maybeSingle(),
          sb.from("marketing_team").select("user_id,created_at").order("created_at", { ascending: false }),
          leadsClient.from("lawyer_leads").select("assigned_user_id"),
        ]);

        const appUser = (appUserRes.data as AppUserRoleRow | null) ?? null;
        let hasAccess = Boolean(appUser?.is_super_admin) || hasPrivilegedRole(appUser?.role);

        if (!hasAccess) {
          const userRoleRes = await sb
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .in("role", [...PRIVILEGED_ROLES])
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

          const userRole = (userRoleRes.data as UserRoleRow | null) ?? null;
          hasAccess = hasPrivilegedRole(userRole?.role);
        }

        if (teamRes.error) throw teamRes.error;
        if (assignedUsersRes.error) throw assignedUsersRes.error;

        const teamRows = (teamRes.data as Array<{ user_id: string }> | null) ?? [];
        const assignedRows = (assignedUsersRes.data as Array<{ assigned_user_id: string | null }> | null) ?? [];

        const ids = Array.from(
          new Set([
            ...teamRows.map((row) => row.user_id).filter(Boolean),
            ...assignedRows.map((row) => row.assigned_user_id || "").filter(Boolean),
          ])
        );

        let members: MarketingTeamMember[] = [];

        if (ids.length > 0) {
          const usersRes = await sb.from("app_users").select("user_id,email,display_name").in("user_id", ids);
          if (usersRes.error) throw usersRes.error;

          const users = (usersRes.data as AppUserIdentityRow[] | null) ?? [];
          const userById = new Map(users.map((row) => [row.user_id, row] as const));

          members = ids
            .map((id) => {
              const match = userById.get(id);
              if (!match) return null;

              return {
                user_id: id,
                email: match.email,
                display_name: (match.display_name || "").trim() || match.email,
              } satisfies MarketingTeamMember;
            })
            .filter(Boolean) as MarketingTeamMember[];

          members.sort((a, b) => a.display_name.localeCompare(b.display_name));
        }

        if (!isMounted) return;

        setCanViewTeamAssigneeFilter(hasAccess);
        setMarketingTeam(members);
      } catch (error) {
        console.warn("Failed to load marketing team filter access", error);
        if (!isMounted) return;

        setCanViewTeamAssigneeFilter(false);
        setMarketingTeam([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return {
    marketingTeam,
    canViewTeamAssigneeFilter,
    loading,
  };
};
