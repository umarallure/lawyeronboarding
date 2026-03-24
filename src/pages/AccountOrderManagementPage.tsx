import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, BriefcaseBusiness, Clock3, Package, RefreshCw, Search, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

type OrderStatus = "OPEN" | "FULFILLED" | "EXPIRED";

type OrderRow = {
  id: string;
  lawyer_id: string;
  target_states: string[];
  case_type: string;
  case_subtype: string | null;
  criteria: Record<string, unknown> | null;
  quota_total: number;
  quota_filled: number;
  status: OrderStatus;
  expires_at: string;
  created_at: string;
};

type AppUserRow = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type AttorneyProfileRow = {
  user_id: string;
  full_name: string | null;
  primary_email: string | null;
};

type StatusFilter = "all" | OrderStatus;

const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All Statuses", value: "all" },
  { label: "Open", value: "OPEN" },
  { label: "Fulfilled", value: "FULFILLED" },
  { label: "Expired", value: "EXPIRED" },
];

const formatDate = (value: string) => {
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

const startCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeCaseType = (value: string) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) return "";
  if (
    normalized === "motor vehicle accident" ||
    normalized === "consumer cases" ||
    normalized === "consumer case" ||
    normalized === "consumer cases (mva)"
  ) {
    return "consumer_cases";
  }
  if (normalized === "commercial cases" || normalized === "commercial case") {
    return "commercial_cases";
  }

  return normalized.replace(/\s+/g, "_");
};

const getCaseTypeLabel = (value: string) => {
  const normalized = normalizeCaseType(value);

  if (normalized === "consumer_cases") return "Consumer Cases";
  if (normalized === "commercial_cases") return "Commercial Cases";

  return startCase(value);
};

const clampPercent = (n: number) => Math.max(0, Math.min(100, n));

const getProgressPercent = (order: OrderRow) => {
  const total = Number(order.quota_total) || 0;
  const filled = Number(order.quota_filled) || 0;
  if (total <= 0) return 0;
  return clampPercent((filled / total) * 100);
};

const roundPercent = (n: number) => Math.round(n);

const getRemainingDemand = (order: OrderRow) => Math.max(0, (Number(order.quota_total) || 0) - (Number(order.quota_filled) || 0));

const getStatusBadgeClass = (status: OrderStatus) => {
  switch (status) {
    case "OPEN":
      return "bg-emerald-100 text-emerald-900 hover:bg-emerald-100";
    case "FULFILLED":
      return "bg-slate-900 text-white hover:bg-slate-900";
    case "EXPIRED":
      return "bg-rose-100 text-rose-900 hover:bg-rose-100";
    default:
      return "";
  }
};

const summarizeCriteria = (criteria: Record<string, unknown> | null | undefined) => {
  if (!criteria || typeof criteria !== "object") return [];

  return Object.entries(criteria)
    .filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "boolean") return value;
      return true;
    })
    .map(([key, value]) => {
      const label = startCase(key);
      if (Array.isArray(value)) return `${label}: ${value.map(String).join(", ")}`;
      if (typeof value === "object") return `${label}: Configured`;
      return `${label}: ${String(value)}`;
    });
};

const getDaysUntil = (value: string) => {
  const ms = new Date(value).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const AccountOrderManagementPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [lawyerById, setLawyerById] = useState<Record<string, AppUserRow>>({});
  const [attorneyById, setAttorneyById] = useState<Record<string, AttorneyProfileRow>>({});

  const [query, setQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [selectedCaseType, setSelectedCaseType] = useState<string>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const ordersClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            order: (
              column: string,
              opts: { ascending: boolean }
            ) => Promise<{ data: OrderRow[] | null; error: { message?: string } | null }>;
          };
        };
      };

      const { data: orderRows, error: ordersError } = await ordersClient
        .from("orders")
        .select("id,lawyer_id,target_states,case_type,case_subtype,criteria,quota_total,quota_filled,status,expires_at,created_at")
        .order("created_at", { ascending: false });

      if (ordersError) {
        throw new Error(ordersError.message || "Failed to load orders");
      }

      const safeOrders = (orderRows ?? []) as OrderRow[];
      setOrders(safeOrders);

      const lawyerIds = Array.from(new Set(safeOrders.map((order) => order.lawyer_id).filter(Boolean)));
      if (lawyerIds.length === 0) {
        setLawyerById({});
        setAttorneyById({});
        return;
      }

      const usersClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (
              column: string,
              values: string[]
            ) => Promise<{ data: AppUserRow[] | null; error: { message?: string } | null }>;
          };
        };
      };

      const { data: lawyerRows, error: usersError } = await usersClient
        .from("app_users")
        .select("user_id,display_name,email,role")
        .in("user_id", lawyerIds);

      if (usersError) {
        throw new Error(usersError.message || "Failed to load lawyer accounts");
      }

      const nextLawyerById: Record<string, AppUserRow> = {};
      for (const row of lawyerRows ?? []) {
        nextLawyerById[row.user_id] = row;
      }
      setLawyerById(nextLawyerById);

      const attorneysClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (
              column: string,
              values: string[]
            ) => Promise<{ data: AttorneyProfileRow[] | null; error: { message?: string } | null }>;
          };
        };
      };

      const { data: attorneyRows, error: attorneysError } = await attorneysClient
        .from("attorney_profiles")
        .select("user_id,full_name,primary_email")
        .in("user_id", lawyerIds);

      if (attorneysError) {
        throw new Error(attorneysError.message || "Failed to load attorney profiles");
      }

      const nextAttorneyById: Record<string, AttorneyProfileRow> = {};
      for (const row of attorneyRows ?? []) {
        nextAttorneyById[row.user_id] = row;
      }
      setAttorneyById(nextAttorneyById);
    } catch (err) {
      setOrders([]);
      setLawyerById({});
      setAttorneyById({});
      setError(err instanceof Error ? err.message : "Something went wrong while loading account orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const caseTypeOptions = useMemo(() => {
    return Array.from(new Set(orders.map((order) => normalizeCaseType(order.case_type)).filter(Boolean))).sort(
      (a, b) => getCaseTypeLabel(a).localeCompare(getCaseTypeLabel(b))
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      if (selectedStatus !== "all" && order.status !== selectedStatus) return false;
      if (selectedCaseType !== "all" && normalizeCaseType(order.case_type) !== selectedCaseType) return false;

      if (!normalizedQuery) return true;

      const lawyer = lawyerById[order.lawyer_id];
      const attorney = attorneyById[order.lawyer_id];
      const criteriaText = summarizeCriteria(order.criteria).join(" ");
      const haystack = [
        order.id,
        order.lawyer_id,
        attorney?.full_name || "",
        attorney?.primary_email || "",
        lawyer?.display_name || "",
        lawyer?.email || "",
        lawyer?.role || "",
        order.case_type,
        getCaseTypeLabel(order.case_type),
        order.case_subtype || "",
        (order.target_states || []).join(" "),
        criteriaText,
        order.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [attorneyById, lawyerById, orders, query, selectedCaseType, selectedStatus]);

  const stats = useMemo(() => {
    const openOrders = orders.filter((order) => order.status === "OPEN");
    const expiringSoon = openOrders.filter((order) => {
      const daysUntil = getDaysUntil(order.expires_at);
      return daysUntil >= 0 && daysUntil <= 7;
    }).length;

    return {
      total: orders.length,
      open: openOrders.length,
      lawyerAccounts: new Set(orders.map((order) => order.lawyer_id)).size,
      remainingDemand: openOrders.reduce((sum, order) => sum + getRemainingDemand(order), 0),
      expiringSoon,
    };
  }, [orders]);

  const openOrderDetail = useCallback(
    (orderId: string) => {
      navigate(`/account-management/orders/${orderId}`);
    },
    [navigate]
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge variant="outline" className="w-fit">
            Account Management
          </Badge>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Order Management</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Review every order in one place, see which lawyer account owns it, monitor fulfillment health,
              and catch expiring demand before it slips.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="px-3 py-1">
            {filteredOrders.length} visible orders
          </Badge>
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.total}</div>
            <Package className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Orders</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.open}</div>
            <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">OPEN</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lawyer Accounts</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.lawyerAccounts}</div>
            <Users className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Demand</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.remainingDemand}</div>
            <BriefcaseBusiness className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring In 7 Days</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.expiringSoon}</div>
            <Clock3 className="h-8 w-8 text-amber-600" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
              <div className="relative w-full md:w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search order, lawyer, email, state, case type..."
                  className="pl-9"
                />
              </div>

              <div className="w-full md:w-52">
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as StatusFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-52">
                <Select value={selectedCaseType} onValueChange={setSelectedCaseType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Case Type" />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Case Types</SelectItem>
                    {caseTypeOptions.map((caseType) => (
                      <SelectItem key={caseType} value={caseType}>
                        {getCaseTypeLabel(caseType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Ordered newest first so recent account activity stays front and center.
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Lawyer Account</TableHead>
                  <TableHead className="min-w-[250px]">Order Details</TableHead>
                  <TableHead className="min-w-[180px]">Target States</TableHead>
                  <TableHead className="min-w-[220px]">Quota Health</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const lawyer = lawyerById[order.lawyer_id];
                  const attorney = attorneyById[order.lawyer_id];
                  const criteriaSummary = summarizeCriteria(order.criteria);
                  const progress = getProgressPercent(order);
                  const roundedProgress = roundPercent(progress);
                  const filled = Number(order.quota_filled) || 0;
                  const total = Number(order.quota_total) || 0;
                  const remaining = getRemainingDemand(order);
                  const daysUntilExpiry = getDaysUntil(order.expires_at);
                  const lawyerName = (attorney?.full_name || "").trim() || (lawyer?.display_name || "").trim() || "Unnamed lawyer";
                  const lawyerEmail = lawyer?.email || attorney?.primary_email || "No email on file";

                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => openOrderDetail(order.id)}
                    >
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="font-medium">{lawyerName}</div>
                          <div className="text-sm text-muted-foreground">{lawyerEmail}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            {lawyer?.role ? (
                              <Badge variant="outline">{startCase(lawyer.role)}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <div>
                            <div className="font-medium">{getCaseTypeLabel(order.case_type)}</div>
                            <div className="text-sm text-muted-foreground">
                              {order.case_subtype ? startCase(order.case_subtype) : "No subtype"}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {criteriaSummary.slice(0, 2).map((item) => (
                              <Badge key={`${order.id}-${item}`} variant="outline" className="max-w-[220px] truncate">
                                {item}
                              </Badge>
                            ))}
                            {criteriaSummary.length > 2 ? (
                              <Badge variant="outline">+{criteriaSummary.length - 2} more</Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {(order.target_states || []).map((state) => (
                            <Badge key={`${order.id}-${state}`} variant="outline">
                              {String(state).toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {filled}/{total} filled
                            </span>
                            <span className="text-muted-foreground">{remaining} left</span>
                          </div>
                          <Progress value={roundedProgress} />
                          <div className="text-xs text-muted-foreground">{roundedProgress}% complete</div>
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <Badge className={getStatusBadgeClass(order.status)}>{order.status}</Badge>
                      </TableCell>

                      <TableCell className="align-top text-sm text-muted-foreground">
                        {formatDate(order.created_at)}
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <div className="text-muted-foreground">{formatDate(order.expires_at)}</div>
                          {order.status === "OPEN" && daysUntilExpiry >= 0 && daysUntilExpiry <= 7 ? (
                            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                              {daysUntilExpiry === 0 ? "Expires today" : `${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"} left`}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>

                    </TableRow>
                  );
                })}

                {!loading && filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">No orders match these filters</div>
                        <div className="text-sm text-muted-foreground">
                          Try a different status, case type, or search term.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountOrderManagementPage;
