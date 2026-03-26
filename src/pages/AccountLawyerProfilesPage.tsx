import { useCallback, useEffect, useMemo, useState } from "react";
import LogoLoader from "@/components/LogoLoader";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, MoreHorizontal, RefreshCw, Search, Trash2, UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Role = "super_admin" | "admin" | "lawyer" | "agent";

type AppUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: Role | null;
  center_id: string | null;
  created_at: string;
  updated_at: string;
};

type AttorneyProfileRow = Record<string, unknown> & {
  user_id?: string | null;
};

type ProfileStatusFilter = "all" | "has_profile" | "missing_profile";

const formatDateTime = (value: string) => {
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
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

const pickFirstState = (record: Record<string, unknown> | null | undefined) => {
  if (!record) return null;

  const stringState = pickFirstString(record, ["state", "primary_state", "home_state"]);
  if (stringState) return stringState;

  const arrayState = record["licensed_states"];
  if (Array.isArray(arrayState) && arrayState.length > 0) {
    const first = arrayState[0];
    if (typeof first === "string" && first.trim()) return first.trim();
  }

  return null;
};

const isValidEmail = (value: string) => {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (!v.includes("@")) return false;
  const [, domain] = v.split("@");
  if (!domain || !domain.includes(".")) return false;
  return true;
};

const AccountLawyerProfilesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lawyers, setLawyers] = useState<AppUserRow[]>([]);
  const [profileByUserId, setProfileByUserId] = useState<Record<string, AttorneyProfileRow>>({});
  const [openOrdersByUserId, setOpenOrdersByUserId] = useState<Record<string, number>>({});

  const [query, setQuery] = useState("");
  const [profileStatus, setProfileStatus] = useState<ProfileStatusFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirm, setCreateConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lawyerToDelete, setLawyerToDelete] = useState<AppUserRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-users", {
        method: "GET",
      });

      if (fnError) throw new Error(fnError.message || "Failed to load users");

      const users = (data?.users ?? []) as AppUserRow[];
      const lawyerRows = users.filter((u) => u.role === "lawyer" && u.user_id);
      setLawyers(lawyerRows);

      const userIds = lawyerRows.map((u) => u.user_id);
      if (userIds.length === 0) {
        setProfileByUserId({});
        setOpenOrdersByUserId({});
        return;
      }

      const profilesClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (column: string, values: string[]) => Promise<{ data: AttorneyProfileRow[] | null; error: { message?: string } | null }>;
          };
        };
      };

      const { data: profileRows, error: profileError } = await profilesClient
        .from("attorney_profiles")
        .select("*")
        .in("user_id", userIds);

      if (profileError) throw new Error(profileError.message || "Failed to load attorney profiles");

      const nextProfileByUserId: Record<string, AttorneyProfileRow> = {};
      for (const row of profileRows ?? []) {
        const id = row?.user_id ? String(row.user_id) : "";
        if (id) nextProfileByUserId[id] = row;
      }
      setProfileByUserId(nextProfileByUserId);

      const ordersClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (column: string, values: string[]) => {
              eq: (column: string, value: string) => Promise<{ data: Array<{ lawyer_id: string | null }> | null; error: { message?: string } | null }>;
            };
          };
        };
      };

      const { data: openOrders, error: ordersError } = await ordersClient
        .from("orders")
        .select("lawyer_id")
        .in("lawyer_id", userIds)
        .eq("status", "OPEN");

      if (ordersError) throw new Error(ordersError.message || "Failed to load order counts");

      const counts: Record<string, number> = {};
      for (const row of openOrders ?? []) {
        const id = row?.lawyer_id ? String(row.lawyer_id) : "";
        if (!id) continue;
        counts[id] = (counts[id] ?? 0) + 1;
      }
      setOpenOrdersByUserId(counts);
    } catch (e) {
      setLawyers([]);
      setProfileByUserId({});
      setOpenOrdersByUserId({});
      setError(e instanceof Error ? e.message : "Unable to load lawyer profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const total = lawyers.length;
    const withProfile = lawyers.filter((l) => Boolean(profileByUserId[l.user_id])).length;
    const missingProfile = total - withProfile;
    const withOpenOrders = lawyers.filter((l) => (openOrdersByUserId[l.user_id] ?? 0) > 0).length;
    return { total, withProfile, missingProfile, withOpenOrders };
  }, [lawyers, openOrdersByUserId, profileByUserId]);

  const filteredLawyers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return lawyers.filter((l) => {
      const profile = profileByUserId[l.user_id];
      const hasProfile = Boolean(profile);
      if (profileStatus === "has_profile" && !hasProfile) return false;
      if (profileStatus === "missing_profile" && hasProfile) return false;

      if (!q) return true;

      const name = pickFirstString(profile, ["full_name", "display_name", "name"]) || l.display_name || "";
      const email = l.email || pickFirstString(profile, ["primary_email", "email"]) || "";
      const phone = pickFirstString(profile, ["direct_phone", "phone_number", "primary_phone", "phone"]) || "";
      const state = pickFirstState(profile) || "";

      const haystack = [name, email, phone, state, l.user_id].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [lawyers, profileByUserId, profileStatus, query]);

  const resetCreateForm = () => {
    setCreateEmail("");
    setCreatePassword("");
    setCreateConfirm("");
    setShowPassword(false);
    setShowConfirm(false);
  };

  const canCreate = useMemo(() => {
    if (!isValidEmail(createEmail)) return false;
    if (!createPassword) return false;
    if (createPassword !== createConfirm) return false;
    return true;
  }, [createConfirm, createEmail, createPassword]);

  const submitCreate = async () => {
    if (!canCreate) return;

    setCreating(true);
    try {
      const email = createEmail.trim().toLowerCase();
      const password = createPassword;

      const { data, error: fnError } = await supabase.functions.invoke("manage-users", {
        method: "POST",
        body: { email, password, role: "lawyer" },
      });

      if (fnError) throw new Error(fnError.message || "Unable to create user");
      if (!data?.user?.user_id) throw new Error("User was created but response was missing user id.");

      toast({
        title: "Lawyer created",
        description: `${email} is ready for profile setup.`,
      });

      setCreateOpen(false);
      resetCreateForm();
      await refresh();
      navigate(`/account-management/lawyer-profiles/${data.user.user_id}`);
    } catch (e) {
      toast({
        title: "Create failed",
        description: e instanceof Error ? e.message : "Unable to create lawyer profile.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const requestDelete = (lawyer: AppUserRow) => {
    setLawyerToDelete(lawyer);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!lawyerToDelete) return;

    setDeleting(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("manage-users", {
        method: "DELETE",
        body: { user_id: lawyerToDelete.user_id },
      });

      if (fnError) throw new Error(fnError.message || "Unable to delete user");

      toast({
        title: "Deleted",
        description: `${lawyerToDelete.email} has been deleted.`,
      });

      setDeleteOpen(false);
      setLawyerToDelete(null);
      await refresh();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unable to delete lawyer.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading && lawyers.length === 0) {
    return <LogoLoader page label="Loading lawyer profiles..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Lawyer Profile Management</h2>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Lawyers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profiles Created</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.withProfile}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Missing Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.missingProfile}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">With Open Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.withOpenOrders}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
              <div className="relative w-full md:w-[420px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email, phone, state..."
                  className="pl-9"
                />
              </div>

              <div className="w-full md:w-52">
                <Select
                  value={profileStatus}
                  onValueChange={(value) => setProfileStatus(value as ProfileStatusFilter)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="has_profile">Profile Created</SelectItem>
                    <SelectItem value="missing_profile">Missing Profile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="secondary">{filteredLawyers.length} lawyers</Badge>
              <Button onClick={() => setCreateOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Profile
              </Button>
              <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
                <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                Refresh
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Lawyer Name</TableHead>
                  <TableHead className="min-w-[220px]">Email</TableHead>
                  <TableHead className="min-w-[160px]">Phone</TableHead>
                  <TableHead className="min-w-[120px]">State</TableHead>
                  <TableHead className="min-w-[140px]">Profile</TableHead>
                  <TableHead className="min-w-[140px]">Open Orders</TableHead>
                  <TableHead className="min-w-[140px]">Created</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLawyers.map((l) => {
                  const profile = profileByUserId[l.user_id];
                  const name =
                    pickFirstString(profile, ["full_name", "display_name", "name"]) ||
                    l.display_name ||
                    "Unnamed lawyer";
                  const email = l.email || pickFirstString(profile, ["primary_email", "email"]) || "No email";
                  const phone =
                    pickFirstString(profile, ["direct_phone", "phone_number", "primary_phone", "phone"]) ||
                    "No phone";
                  const state = pickFirstState(profile);
                  const openOrders = openOrdersByUserId[l.user_id] ?? 0;

                  return (
                    <TableRow
                      key={l.user_id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => navigate(`/account-management/lawyer-profiles/${l.user_id}`)}
                    >
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{phone}</TableCell>
                      <TableCell>
                        {state ? (
                          <Badge variant="outline">{String(state).toUpperCase()}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile ? (
                          <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                            Created
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Missing</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {openOrders > 0 ? (
                          <Badge variant="outline">{openOrders}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(l.created_at)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/account-management/lawyer-profiles/${l.user_id}?edit=true`)}
                            >
                              Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => requestDelete(l)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Profile
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!loading && filteredLawyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No lawyers found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Lawyer Profile</DialogTitle>
            <DialogDescription>
              Creates a lawyer user (role: <span className="font-medium">lawyer</span>) and lets you fill their attorney profile after.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Email</div>
              <Input
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="lawyer@firm.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Password</div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Set password"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Confirm Password</div>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={createConfirm}
                  onChange={(e) => setCreateConfirm(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {createPassword && createConfirm && createPassword !== createConfirm ? (
                <div className="text-xs text-rose-600">Passwords do not match.</div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitCreate()}
              disabled={!canCreate || creating}
              className={!canCreate ? "opacity-60" : undefined}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setLawyerToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Profile</DialogTitle>
            <DialogDescription>
              This will delete the user and remove their app user profile. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="font-medium">{lawyerToDelete?.email || "Selected lawyer"}</div>
            {lawyerToDelete ? (
              <div className="mt-1 text-xs text-muted-foreground">User ID: {lawyerToDelete.user_id}</div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountLawyerProfilesPage;
