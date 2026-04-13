import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";

import LogoLoader from "@/components/LogoLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AppUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  account_status?: string | null;
  created_at: string;
  updated_at: string;
};

type AttorneyProfileRow = Record<string, unknown> & {
  user_id?: string | null;
};

type LawyerListItem = AppUserRow & {
  profile: AttorneyProfileRow | null;
  openOrders: number;
};

const DASH_INPUT_CLASS =
  "h-10 border-[var(--dash-border)] bg-background/80 text-[13px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]/55 backdrop-blur-sm focus:border-[#AE4010]/45 focus:ring-[#AE4010]/30";
const DASH_SCROLLBAR_CLASS = "dash-scrollbar";

function SectionCard({
  icon,
  title,
  description,
  children,
  className,
  bodyClassName,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-[#AE4010]/50 bg-[var(--dash-surface)] shadow-[var(--dash-shadow)] backdrop-blur-[var(--dash-blur)] transition-all duration-300 hover:border-[#AE4010]/65 hover:shadow-[0_14px_30px_rgba(174,64,16,0.14)] focus-within:border-[#AE4010]/75 focus-within:shadow-[0_16px_34px_rgba(174,64,16,0.18)]",
        className
      )}
    >
      <div className="relative flex items-start gap-3 border-b border-[#AE4010]/12 bg-[linear-gradient(90deg,rgba(174,64,16,0.18)_0%,rgba(174,64,16,0.1)_28%,rgba(174,64,16,0.04)_54%,rgba(174,64,16,0)_84%)] px-5 py-3.5">
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#AE4010] via-[#AE4010]/50 to-transparent" />
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#AE4010]/45 bg-[#AE4010]/10 text-[#AE4010]">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-[var(--dash-text)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-5 text-[var(--dash-text-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return "N/A";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const pickFirstString = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
};

const pickStates = (record: Record<string, unknown> | null | undefined) => {
  if (!record) return [];

  const value = record["licensed_states"];
  if (!Array.isArray(value)) return [];

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
};

const normalizeAccountStatus = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "active";
  return normalized;
};

const formatAccountStatusLabel = (value: string | null | undefined) => {
  return normalizeAccountStatus(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatAccountTypeLabel = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "Not set";

  if (normalized === "broker_lawyer") return "Broker Lawyer";
  if (normalized === "internal_lawyer") return "Internal Lawyer";

  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getAccountStatusBadgeClass = (value: string | null | undefined) => {
  const status = normalizeAccountStatus(value);

  if (status === "active") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "inactive" || status === "disabled") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  return "border-border bg-muted/60 text-muted-foreground";
};

const isAccountActive = (value: string | null | undefined) => normalizeAccountStatus(value) === "active";

const LawyerManagementPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const attorneyPortalUrl = import.meta.env.VITE_ATTORNEY_PORTAL_URL?.trim() || undefined;
  const locationState = location.state as { selectedUserId?: string } | null;
  const initialSelectedUserId =
    typeof locationState?.selectedUserId === "string" && locationState.selectedUserId.trim()
      ? locationState.selectedUserId.trim()
      : null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [launchingUserId, setLaunchingUserId] = useState<string | null>(null);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lawyers, setLawyers] = useState<LawyerListItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadLawyers = useCallback(async () => {
    setError(null);

    try {
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              order: (
                column: string,
                options?: { ascending?: boolean; nullsFirst?: boolean }
              ) => Promise<{ data: AppUserRow[] | null; error: { message?: string } | null }>;
            };
            in?: never;
          };
        };
      };

      const { data: appUsers, error: appUsersError } = await client
        .from("app_users")
        .select("user_id,email,display_name,role,account_status,created_at,updated_at")
        .eq("role", "lawyer")
        .order("created_at", { ascending: false });

      if (appUsersError) {
        throw new Error(appUsersError.message || "Failed to load lawyer accounts");
      }

      const lawyerRows = (appUsers ?? []).filter((row) => row.user_id);
      const userIds = lawyerRows.map((row) => row.user_id);

      if (userIds.length === 0) {
        setLawyers([]);
        setSelectedUserId(null);
        return;
      }

      const profilesClient = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            in: (
              column: string,
              values: string[]
            ) => Promise<{ data: AttorneyProfileRow[] | null; error: { message?: string } | null }>;
          };
        };
      };

      const { data: profileRows, error: profileError } = await profilesClient
        .from("attorney_profiles")
        .select("*")
        .in("user_id", userIds);

      if (profileError) {
        throw new Error(profileError.message || "Failed to load attorney profiles");
      }

      const profileByUserId = new Map<string, AttorneyProfileRow>();
      for (const row of profileRows ?? []) {
        const userId = typeof row.user_id === "string" ? row.user_id : "";
        if (userId) profileByUserId.set(userId, row);
      }

      const ordersClient = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            in: (column: string, values: string[]) => {
              eq: (
                column: string,
                value: string
              ) => Promise<{ data: Array<{ lawyer_id: string | null }> | null; error: { message?: string } | null }>;
            };
          };
        };
      };

      const { data: openOrders, error: ordersError } = await ordersClient
        .from("orders")
        .select("lawyer_id")
        .in("lawyer_id", userIds)
        .eq("status", "OPEN");

      if (ordersError) {
        throw new Error(ordersError.message || "Failed to load open order counts");
      }

      const openOrderCounts = new Map<string, number>();
      for (const row of openOrders ?? []) {
        const userId = typeof row.lawyer_id === "string" ? row.lawyer_id : "";
        if (!userId) continue;
        openOrderCounts.set(userId, (openOrderCounts.get(userId) ?? 0) + 1);
      }

      const merged = lawyerRows.map((row) => ({
        ...row,
        profile: profileByUserId.get(row.user_id) ?? null,
        openOrders: openOrderCounts.get(row.user_id) ?? 0,
      }));

      setLawyers(merged);
      setSelectedUserId((current) => {
        if (current && merged.some((lawyer) => lawyer.user_id === current)) return current;
        if (initialSelectedUserId && merged.some((lawyer) => lawyer.user_id === initialSelectedUserId)) {
          return initialSelectedUserId;
        }
        return merged[0]?.user_id ?? null;
      });
    } catch (loadError) {
      setLawyers([]);
      setSelectedUserId(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load lawyer accounts.");
    }
  }, [initialSelectedUserId]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      await loadLawyers();
      if (mounted) setLoading(false);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [loadLawyers]);

  const handleRefresh = useCallback(async (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (refreshing) return;

    setRefreshing(true);
    try {
      await loadLawyers();
    } finally {
      setRefreshing(false);
    }
  }, [loadLawyers, refreshing]);

  const filteredLawyers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return lawyers;

    return lawyers.filter((lawyer) => {
      const profile = lawyer.profile;
      const fullName =
        pickFirstString(profile, ["full_name", "display_name", "name"]) ??
        lawyer.display_name ??
        "";
      const firmName = pickFirstString(profile, ["firm_name", "company"]) ?? "";
      const email = lawyer.email ?? pickFirstString(profile, ["primary_email", "email"]) ?? "";
      const state = pickFirstString(profile, ["primary_city", "state"]) ?? pickStates(profile).join(" ");
      const haystack = [fullName, firmName, email, state, lawyer.user_id].join(" ").toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [lawyers, query]);

  useEffect(() => {
    if (filteredLawyers.length === 0) return;
    if (selectedUserId && filteredLawyers.some((lawyer) => lawyer.user_id === selectedUserId)) return;
    setSelectedUserId(filteredLawyers[0].user_id);
  }, [filteredLawyers, selectedUserId]);

  const selectedLawyer = useMemo(
    () => lawyers.find((lawyer) => lawyer.user_id === selectedUserId) ?? null,
    [lawyers, selectedUserId]
  );
  const selectedLawyerIsActive = selectedLawyer ? isAccountActive(selectedLawyer.account_status) : false;
  const isUpdatingSelectedLawyerStatus = selectedLawyer ? statusUpdatingUserId === selectedLawyer.user_id : false;

  const handleAccountStatusToggle = useCallback(
    async (checked: boolean) => {
      if (!selectedLawyer) return;

      const nextStatus = checked ? "active" : "inactive";
      const previousStatus = selectedLawyer.account_status ?? null;
      const previousUpdatedAt = selectedLawyer.updated_at;

      setStatusUpdatingUserId(selectedLawyer.user_id);
      setLawyers((current) =>
        current.map((lawyer) =>
          lawyer.user_id === selectedLawyer.user_id
            ? { ...lawyer, account_status: nextStatus, updated_at: new Date().toISOString() }
            : lawyer
        )
      );

      try {
        const { error: updateError } = await supabase
          .from("app_users")
          .update({ account_status: nextStatus })
          .eq("user_id", selectedLawyer.user_id);

        if (updateError) {
          throw new Error(updateError.message || "Failed to update lawyer account status");
        }

        toast({
          title: checked ? "Lawyer activated" : "Lawyer deactivated",
          description: checked
            ? "This lawyer can access the portal again."
            : "This lawyer will be blocked from launching the portal until reactivated.",
        });
      } catch (statusError) {
        setLawyers((current) =>
          current.map((lawyer) =>
            lawyer.user_id === selectedLawyer.user_id
              ? { ...lawyer, account_status: previousStatus, updated_at: previousUpdatedAt }
              : lawyer
          )
        );

        toast({
          title: "Status update failed",
          description:
            statusError instanceof Error ? statusError.message : "Unable to update the lawyer account status.",
          variant: "destructive",
        });
      } finally {
        setStatusUpdatingUserId(null);
      }
    },
    [selectedLawyer, toast]
  );

  const handleOpenPortal = useCallback(async () => {
    if (!selectedLawyer) return;

    const popup = window.open("", "_blank");
    if (!popup) {
      toast({
        title: "Popup blocked",
        description: "Allow popups for this site so we can open the lawyer portal in a new window.",
        variant: "destructive",
      });
      return;
    }

    try {
      popup.opener = null;
      popup.document.title = "Opening Lawyer Portal...";
      popup.document.body.style.margin = "0";
      popup.document.body.innerHTML =
        "<div style=\"font-family:Inter,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f8f7f4;color:#3b2a1f;\">Launching lawyer portal...</div>";
    } catch {
      // If the blank popup DOM is not available, we can still redirect it later.
    }

    setLaunchingUserId(selectedLawyer.user_id);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-lawyer-portal-launch", {
        method: "POST",
        body: {
          lawyer_user_id: selectedLawyer.user_id,
          requested_path: "/dashboard",
          attorney_portal_url: attorneyPortalUrl,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || "Failed to create lawyer portal launch");
      }

      if (!data?.actionLink || typeof data.actionLink !== "string") {
        throw new Error("Launch link was not returned by the server");
      }

      popup.location.replace(data.actionLink);

      toast({
        title: "Lawyer portal opened",
        description: `${pickFirstString(selectedLawyer.profile, ["full_name"]) ?? selectedLawyer.email ?? "Selected lawyer"} opened in a new lawyer portal window.`,
      });
    } catch (launchError) {
      popup.close();
      toast({
        title: "Unable to open lawyer portal",
        description:
          launchError instanceof Error
            ? launchError.message
            : "The lawyer portal launch could not be created.",
        variant: "destructive",
      });
    } finally {
      setLaunchingUserId(null);
    }
  }, [selectedLawyer, attorneyPortalUrl, toast]);

  return (
    <div className="dashboard-premium min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-[var(--dash-text)]">Lawyer Management</h1>
          <p className="text-[12px] text-[var(--dash-text-muted)] mt-0.5">
            Search a lawyer and open their portal instantly. This keeps the workflow fast while your onboarding session stays in place.
          </p>
        </div>

        <SectionCard
          icon={<Search className="h-3.5 w-3.5" />}
          title="Find Lawyer"
          description="Search by lawyer name, firm, email, state, or user ID."
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-text-muted)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={loading}
                placeholder="Search lawyer accounts..."
                className={cn(DASH_INPUT_CLASS, "pl-9")}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={(event) => {
                void handleRefresh(event);
              }}
              disabled={refreshing || loading}
              className="h-10 border-[var(--dash-border)] bg-background/70 text-[var(--dash-text-muted)] hover:bg-white/[0.03] hover:text-[var(--dash-text)]"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </SectionCard>

        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <SectionCard
            icon={<UserRound className="h-3.5 w-3.5" />}
            title="Lawyer Accounts"
            description={`${filteredLawyers.length} result${filteredLawyers.length === 1 ? "" : "s"}`}
            bodyClassName="p-3"
          >
            {loading ? (
              <div className="px-2 py-10">
                <LogoLoader label="Loading lawyer accounts..." />
              </div>
            ) : filteredLawyers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--dash-border)] bg-white/[0.02] px-4 py-12 text-center">
                <p className="text-[12px] text-[var(--dash-text-muted)]">No lawyer accounts matched your search.</p>
              </div>
            ) : (
              <div className={cn("max-h-[640px] space-y-2 overflow-auto pr-1", DASH_SCROLLBAR_CLASS)}>
                {filteredLawyers.map((lawyer) => {
                  const fullName =
                    pickFirstString(lawyer.profile, ["full_name", "display_name", "name"]) ||
                    lawyer.display_name ||
                    lawyer.email ||
                    "Unnamed lawyer";
                  const firmName = pickFirstString(lawyer.profile, ["firm_name", "company"]);
                  const isSelected = lawyer.user_id === selectedUserId;

                  return (
                    <button
                      key={lawyer.user_id}
                      type="button"
                      onClick={() => setSelectedUserId(lawyer.user_id)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-all",
                        isSelected
                          ? "border-[#AE4010]/45 bg-[#AE4010]/8 shadow-[0_12px_26px_rgba(174,64,16,0.12)]"
                          : "border-[var(--dash-border)] bg-white/[0.02] hover:border-[#AE4010]/28 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-[var(--dash-text)]">{fullName}</div>
                          <div className="mt-0.5 truncate text-[11px] text-[var(--dash-text-muted)]">
                            {lawyer.email || "No email available"}
                          </div>
                          {firmName ? (
                            <div className="mt-0.5 truncate text-[11px] text-[var(--dash-text-muted)]">{firmName}</div>
                          ) : null}
                        </div>

                        <Badge
                          variant="outline"
                          className={cn("shrink-0 text-[10px]", getAccountStatusBadgeClass(lawyer.account_status))}
                        >
                          {formatAccountStatusLabel(lawyer.account_status)}
                        </Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--dash-text-muted)]">
                        <span>{lawyer.openOrders} open orders</span>
                        {pickStates(lawyer.profile)
                          .slice(0, 2)
                          .map((state) => (
                            <Badge
                              key={`${lawyer.user_id}-${state}`}
                              variant="outline"
                              className="border-[var(--dash-border)] bg-background/80 text-[10px] text-[var(--dash-text-muted)]"
                            >
                              {state}
                            </Badge>
                          ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<Building2 className="h-3.5 w-3.5" />}
            title="Lawyer Details"
            description="Review the account and open the lawyer portal."
          >
            {loading ? (
              <div className="rounded-2xl border border-dashed border-[var(--dash-border)] bg-white/[0.02] px-6 py-16 text-center">
                <LogoLoader label="Preparing lawyer details..." />
              </div>
            ) : selectedLawyer ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#AE4010]/50 bg-[linear-gradient(135deg,rgba(174,64,16,0.12)_0%,rgba(174,64,16,0.05)_42%,rgba(174,64,16,0)_100%)] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#AE4010]/25 bg-[#AE4010]/10 text-[#AE4010]">
                          <UserRound className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <div className="text-lg font-semibold text-[var(--dash-text)]">
                              {pickFirstString(selectedLawyer.profile, ["full_name", "display_name", "name"]) ||
                                selectedLawyer.display_name ||
                                selectedLawyer.email ||
                                "Unnamed lawyer"}
                            </div>
                            {pickFirstString(selectedLawyer.profile, ["direct_phone"]) ? (
                              <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--dash-text-muted)]">
                                <Phone className="h-3.5 w-3.5" />
                                {pickFirstString(selectedLawyer.profile, ["direct_phone"])}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-[12px] text-[var(--dash-text-muted)]">
                            {pickFirstString(selectedLawyer.profile, ["firm_name", "company"]) || "No firm name on file"}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={getAccountStatusBadgeClass(selectedLawyer.account_status)}>
                          {formatAccountStatusLabel(selectedLawyer.account_status)}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/account-management/lawyer-profiles/${selectedLawyer.user_id}`)}
                        className="border-[var(--dash-border)] bg-background/70 text-[var(--dash-text-muted)] hover:bg-white/[0.03] hover:text-[var(--dash-text)]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Profile
                      </Button>
                      <Button
                        onClick={handleOpenPortal}
                        disabled={
                          launchingUserId === selectedLawyer.user_id ||
                          isUpdatingSelectedLawyerStatus ||
                          !selectedLawyerIsActive
                        }
                        className="bg-[#AE4010] text-white hover:bg-[#7c2c0a] disabled:opacity-50"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        {launchingUserId === selectedLawyer.user_id
                          ? "Opening..."
                          : selectedLawyerIsActive
                            ? "Open Lawyer Portal"
                            : "Activate To Open"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[#AE4010]/50 bg-[linear-gradient(135deg,rgba(174,64,16,0.08)_0%,rgba(174,64,16,0.03)_46%,rgba(174,64,16,0)_100%)] p-4">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dash-text)]">
                      Account
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 h-4 w-4 text-[var(--dash-text-muted)]" />
                        <div>
                          <div className="text-[12px] font-medium text-[var(--dash-text)]">Primary Email</div>
                          <div className="text-[12px] text-[var(--dash-text-muted)]">
                            {selectedLawyer.email ||
                              pickFirstString(selectedLawyer.profile, ["primary_email", "email"]) ||
                              "No email available"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <UserRound className="mt-0.5 h-4 w-4 text-[var(--dash-text-muted)]" />
                        <div>
                          <div className="text-[12px] font-medium text-[var(--dash-text)]">Account Type</div>
                          <div className="mt-1 text-[13px] text-[var(--dash-text-muted)]">
                            {formatAccountTypeLabel(pickFirstString(selectedLawyer.profile, ["account_type"]))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 h-4 w-4 text-[var(--dash-text-muted)]" />
                        <div>
                          <div className="text-[12px] font-medium text-[var(--dash-text)]">Licensed States</div>
                          <div className="text-[12px] text-[var(--dash-text-muted)]">
                            {pickStates(selectedLawyer.profile).length > 0
                              ? pickStates(selectedLawyer.profile).join(", ")
                              : "No licensed states recorded"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Building2 className="mt-0.5 h-4 w-4 text-[var(--dash-text-muted)]" />
                        <div>
                          <div className="text-[12px] font-medium text-[var(--dash-text)]">Primary Location</div>
                          <div className="text-[12px] text-[var(--dash-text-muted)]">
                            {pickFirstString(selectedLawyer.profile, ["primary_city", "state"]) || "Not set"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex h-full flex-col rounded-xl border border-[#AE4010]/50 bg-[linear-gradient(135deg,rgba(174,64,16,0.08)_0%,rgba(174,64,16,0.03)_46%,rgba(174,64,16,0)_100%)] p-4">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dash-text)]">
                      Snapshot
                    </div>
                    <div className="flex flex-1 flex-col space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <BriefcaseBusiness className="mt-0.5 h-4 w-4 text-[var(--dash-text-muted)]" />
                        <div>
                          <div className="text-[12px] font-medium text-[var(--dash-text)]">Open Orders</div>
                          <div className="text-[12px] text-[var(--dash-text-muted)]">
                            {selectedLawyer.openOrders} active orders currently assigned
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <UserRound className="mt-0.5 h-4 w-4 text-[var(--dash-text-muted)]" />
                        <div>
                          <div className="text-[12px] font-medium text-[var(--dash-text)]">Last Updated</div>
                          <div className="text-[12px] text-[var(--dash-text-muted)]">
                            {formatDate(selectedLawyer.updated_at)}
                          </div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "mt-auto rounded-lg px-3 py-3",
                          selectedLawyerIsActive
                            ? "border border-rose-500/40 bg-[linear-gradient(135deg,rgba(244,63,94,0.14)_0%,rgba(244,63,94,0.08)_46%,rgba(244,63,94,0.03)_100%)]"
                            : "border border-emerald-500/40 bg-[linear-gradient(135deg,rgba(16,185,129,0.14)_0%,rgba(16,185,129,0.08)_46%,rgba(16,185,129,0.03)_100%)]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-[12px] font-medium text-[var(--dash-text)]">
                              {selectedLawyerIsActive ? "Deactivate" : "Activate"}
                            </div>
                            <div className="mt-1 text-[11px] text-[var(--dash-text-muted)]">
                              {selectedLawyerIsActive
                                ? "Turn off portal access for this lawyer."
                                : "Restore portal access for this lawyer."}
                            </div>
                          </div>

                          <Switch
                            checked={selectedLawyerIsActive}
                            onCheckedChange={(checked) => {
                              void handleAccountStatusToggle(checked);
                            }}
                            disabled={isUpdatingSelectedLawyerStatus}
                            aria-label={selectedLawyerIsActive ? "Deactivate lawyer account" : "Activate lawyer account"}
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--dash-border)] bg-white/[0.02] px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#AE4010]/20 bg-[#AE4010]/10 text-[#AE4010]">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="text-[13px] font-medium text-[var(--dash-text)]">Select a lawyer account</div>
                <div className="mt-1 text-[12px] text-[var(--dash-text-muted)]">
                  Choose an attorney from the list to review the account and open the portal.
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default LawyerManagementPage;
