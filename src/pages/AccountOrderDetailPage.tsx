import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, Clock3, MapPinned, Phone, RefreshCw, UserRound } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

type AttorneyProfileRow = Record<string, unknown> & {
  user_id?: string | null;
};

const clampPercent = (n: number) => Math.max(0, Math.min(100, n));

const getProgressPercent = (order: OrderRow) => {
  const total = Number(order.quota_total) || 0;
  const filled = Number(order.quota_filled) || 0;
  if (total <= 0) return 0;
  return clampPercent((filled / total) * 100);
};

const roundPercent = (n: number) => Math.round(n);

const getRemainingDemand = (order: OrderRow) =>
  Math.max(0, (Number(order.quota_total) || 0) - (Number(order.quota_filled) || 0));

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

const pickFirstString = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
};

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

const AccountOrderDetailPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [lawyer, setLawyer] = useState<AppUserRow | null>(null);
  const [attorneyProfile, setAttorneyProfile] = useState<AttorneyProfileRow | null>(null);

  const refresh = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      const ordersClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: OrderRow | null; error: { message?: string } | null }>;
            };
          };
        };
      };

      const { data: orderRow, error: orderError } = await ordersClient
        .from("orders")
        .select("id,lawyer_id,target_states,case_type,case_subtype,criteria,quota_total,quota_filled,status,expires_at,created_at")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError) throw new Error(orderError.message || "Failed to load order");
      if (!orderRow) throw new Error("Order not found");

      setOrder(orderRow);

      const usersClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: AppUserRow | null; error: { message?: string } | null }>;
            };
          };
        };
      };

      const { data: userRow, error: userError } = await usersClient
        .from("app_users")
        .select("user_id,display_name,email,role")
        .eq("user_id", orderRow.lawyer_id)
        .maybeSingle();

      if (userError) throw new Error(userError.message || "Failed to load lawyer info");

      setLawyer(userRow);

      const profilesClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: AttorneyProfileRow | null; error: { message?: string } | null }>;
            };
          };
        };
      };

      const { data: profileRow, error: profileError } = await profilesClient
        .from("attorney_profiles")
        .select("*")
        .eq("user_id", orderRow.lawyer_id)
        .maybeSingle();

      if (profileError) throw new Error(profileError.message || "Failed to load attorney profile");

      setAttorneyProfile(profileRow);
    } catch (err) {
      setOrder(null);
      setLawyer(null);
      setAttorneyProfile(null);
      setError(err instanceof Error ? err.message : "Something went wrong while loading the order.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const criteriaSummary = useMemo(() => summarizeCriteria(order?.criteria), [order?.criteria]);
  const progress = order ? getProgressPercent(order) : 0;
  const roundedProgress = roundPercent(progress);
  const attorneyProfileName = pickFirstString(attorneyProfile, ["full_name", "display_name", "name", "attorney_name"]);
  const attorneyPhone = pickFirstString(attorneyProfile, [
    "phone_number",
    "primary_phone",
    "phone",
    "mobile_phone",
    "office_phone",
    "cell_phone",
    "contact_phone",
    "mobile",
    "cell",
  ]);
  const attorneyEmail = lawyer?.email || pickFirstString(attorneyProfile, ["primary_email", "email"]);
  const lawyerDisplayName =
    ((lawyer?.display_name || "").trim() || attorneyProfileName || attorneyEmail || "Unknown lawyer");
  const showAttorneyName = Boolean(
    attorneyProfileName && attorneyProfileName.toLowerCase() !== lawyerDisplayName.toLowerCase()
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/account-management/orders">Account Management</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Order Detail</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {order ? getCaseTypeLabel(order.case_type) : "Order Detail"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Review the lawyer account, targeting, criteria, and fulfillment health for this order.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => navigate("/account-management/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : null}

      {order ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getStatusBadgeClass(order.status)}>{order.status}</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Quota Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold">{roundedProgress}%</div>
                <Progress value={roundedProgress} />
                <div className="text-sm text-muted-foreground">
                  {order.quota_filled}/{order.quota_total} filled
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Demand</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-2xl font-semibold">{getRemainingDemand(order)}</div>
                <BriefcaseBusiness className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expires</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-lg font-semibold">{formatDate(order.expires_at)}</div>
                <Clock3 className="h-8 w-8 text-amber-600" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Order Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Case Type</div>
                    <div className="text-base font-medium">{getCaseTypeLabel(order.case_type)}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Case Subtype</div>
                    <div className="text-base font-medium">{order.case_subtype ? startCase(order.case_subtype) : "No subtype"}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Created</div>
                    <div className="text-base font-medium">{formatDate(order.created_at)}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Target States</div>
                    <div className="flex flex-wrap gap-1.5">
                      {order.target_states.map((state) => (
                        <Badge key={state} variant="outline">
                          {String(state).toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">Criteria</div>
                  {criteriaSummary.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {criteriaSummary.map((item) => (
                        <Badge key={item} variant="outline" className="py-1">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No criteria configured.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lawyer Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="text-base font-medium">{lawyerDisplayName}</div>
                      {showAttorneyName ? (
                        <div className="text-sm text-muted-foreground">{attorneyProfileName}</div>
                      ) : null}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>{attorneyEmail || "No email available"}</div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{attorneyPhone || "No phone available"}</span>
                      </div>
                    </div>
                    {lawyer?.role ? <Badge variant="outline">{startCase(lawyer.role)}</Badge> : null}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPinned className="h-4 w-4 text-primary" />
                    Coverage Summary
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    This order is currently targeting {order.target_states.length} state{order.target_states.length === 1 ? "" : "s"} with{" "}
                    {getRemainingDemand(order)} remaining slot{getRemainingDemand(order) === 1 ? "" : "s"} to fill.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AccountOrderDetailPage;
