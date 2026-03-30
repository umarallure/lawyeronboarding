import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LogoLoader from "@/components/LogoLoader";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Eye, FileText, RefreshCw, Save, Trash2, Upload, UserRound, X } from "lucide-react";

import { supabase, storageSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Role = "super_admin" | "admin" | "lawyer" | "agent";

type AppUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: Role | null;
  center_id: string | null;
  account_status?: string | null;
  created_at: string;
  updated_at: string;
};

type AttorneyProfileRow = Record<string, unknown> & {
  user_id?: string | null;
};

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

const renderValue = (value: unknown) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const startCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

type TabKey = "personal" | "capacity" | "status" | "limit" | "retainer";

const RETAINER_BUCKET = "retainer-contract-documents";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

type RetainerDoc = {
  id: string;
  user_id: string;
  state: string;
  document_path: string;
  document_name: string;
  document_mime_type: string;
  document_size_bytes: number;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const NON_EDITABLE_PROFILE_KEYS = new Set(["user_id", "id", "created_at", "updated_at"]);

const PERSONAL_FIELD_CANDIDATES = [
  "full_name",
  "display_name",
  "first_name",
  "last_name",
  "name",
  "primary_email",
  "email",
  "direct_phone",
  "phone_number",
  "primary_phone",
  "phone",
  "mobile_phone",
  "office_phone",
  "firm_name",
  "company",
  "street_address",
  "address",
  "city",
  "state",
  "zip_code",
  "website",
  "bar_number",
  "notes",
  "additional_notes",
  "bio",
  "profile_description",
];

const CAPACITY_FIELD_CANDIDATES = [
  "licensed_states",
  "jurisdictions",
  "jurisdiction",
  "practice_areas",
  "case_types",
  "availability_status",
  "availability",
  "accepting_new_cases",
  "capacity",
  "daily_capacity",
  "weekly_capacity",
  "monthly_capacity",
  "max_leads_per_day",
  "avg_time_to_close",
  "response_time",
  "time_zone",
];

const STATE_LIMIT_FIELD_CANDIDATES = [
  "order_limit",
  "state_limit",
  "order_state_limit",
  "max_states",
  "max_order_states",
  "state_order_limit",
];

const tryPickKey = (record: Record<string, unknown> | null | undefined, candidates: string[]) => {
  if (!record) return null;
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return key;
  }
  return null;
};

const normalizeAccountStatus = (value: string | null | undefined) => {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "active";
  if (v === "active" || v === "inactive") return v;
  return v;
};

const AccountLawyerProfileDetailPage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "true";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appUser, setAppUser] = useState<AppUserRow | null>(null);
  const [attorneyProfile, setAttorneyProfile] = useState<AttorneyProfileRow | null>(null);
  const [openOrderCount, setOpenOrderCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [editingTab, setEditingTab] = useState<TabKey | null>(null);

  const [personalDraft, setPersonalDraft] = useState<Record<string, string>>({});
  const [capacityDraft, setCapacityDraft] = useState<Record<string, string>>({});
  const [statusDraft, setStatusDraft] = useState<string>("active");
  const [stateLimitDraft, setStateLimitDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [retainerFiles, setRetainerFiles] = useState<RetainerDoc[]>([]);
  const [retainerLoading, setRetainerLoading] = useState(false);
  const [retainerError, setRetainerError] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<RetainerDoc | null>(null);
  const [showUploadCard, setShowUploadCard] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    try {
      const appUsersClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, v: string) => {
              maybeSingle: () => Promise<{ data: AppUserRow | null; error: { message?: string } | null }>;
            };
          };
        };
      };

      const { data: appUserRow, error: appUserError } = await appUsersClient
        .from("app_users")
        .select("user_id,email,display_name,role,center_id,account_status,created_at,updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (appUserError) {
        // Fallback: load via manage-users edge function (super_admin only)
        const { data, error: fnError } = await supabase.functions.invoke("manage-users", { method: "GET" });
        if (fnError) throw new Error(fnError.message || "Failed to load user");
        const users = (data?.users ?? []) as AppUserRow[];
        const found = users.find((u) => u.user_id === userId) ?? null;
        if (!found) throw new Error("User not found");
        setAppUser(found);
      } else {
        if (!appUserRow) throw new Error("User not found");
        setAppUser(appUserRow);
      }

      const profilesClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, v: string) => {
              maybeSingle: () => Promise<{ data: AttorneyProfileRow | null; error: { message?: string } | null }>;
            };
          };
        };
      };

      const { data: profileRow, error: profileError } = await profilesClient
        .from("attorney_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw new Error(profileError.message || "Failed to load attorney profile");
      setAttorneyProfile(profileRow);

      const ordersClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => {
            eq: (col: string, v: string) => {
              eq: (col2: string, v2: string) => Promise<{ count: number | null; error: { message?: string } | null }>;
            };
          };
        };
      };

      const { count, error: countError } = await ordersClient
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("lawyer_id", userId)
        .eq("status", "OPEN");

      if (countError) throw new Error(countError.message || "Failed to load open order count");
      setOpenOrderCount(count ?? 0);
    } catch (e) {
      setAppUser(null);
      setAttorneyProfile(null);
      setOpenOrderCount(0);
      setError(e instanceof Error ? e.message : "Unable to load lawyer profile.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!editMode) return;
    if (loading) return;
    if (editingTab) return;
    setActiveTab("personal");
    setEditingTab("personal");
  }, [editMode, editingTab, loading]);

  const personalKeys = useMemo(() => {
    const record = attorneyProfile ?? null;
    const limitKey = tryPickKey(record, STATE_LIMIT_FIELD_CANDIDATES);
    if (record) {
      const all = Object.keys(record)
        .filter((k) => !NON_EDITABLE_PROFILE_KEYS.has(k))
        .filter((k) => k !== limitKey)
        .sort((a, b) => a.localeCompare(b));

      const capacitySet = new Set(CAPACITY_FIELD_CANDIDATES);
      const personal = all.filter((k) => !capacitySet.has(k));
      return personal.length ? personal : all;
    }

    return ["full_name", "primary_email", "direct_phone", "firm_name", "state"];
  }, [attorneyProfile]);

  const capacityKeys = useMemo(() => {
    const record = attorneyProfile ?? null;
    const limitKey = tryPickKey(record, STATE_LIMIT_FIELD_CANDIDATES);
    if (record) {
      const all = Object.keys(record)
        .filter((k) => !NON_EDITABLE_PROFILE_KEYS.has(k))
        .filter((k) => k !== limitKey)
        .sort((a, b) => a.localeCompare(b));

      const capacitySet = new Set(CAPACITY_FIELD_CANDIDATES);
      const capacity = all.filter((k) => capacitySet.has(k));
      return capacity.length ? capacity : [];
    }

    return ["licensed_states", "practice_areas", "availability_status", "capacity"];
  }, [attorneyProfile]);

  const stateLimitKey = useMemo(() => {
    return tryPickKey(attorneyProfile ?? null, STATE_LIMIT_FIELD_CANDIDATES) ?? null;
  }, [attorneyProfile]);

  const hydrateDrafts = useCallback(() => {
    const profile = attorneyProfile ?? null;
    const nextPersonal: Record<string, string> = {};
    const nextCapacity: Record<string, string> = {};

    for (const key of personalKeys) {
      const v = profile ? profile[key] : null;
      nextPersonal[key] = v === null || v === undefined ? "" : String(v);
    }
    for (const key of capacityKeys) {
      const v = profile ? profile[key] : null;
      if (Array.isArray(v)) nextCapacity[key] = v.map(String).join(", ");
      else nextCapacity[key] = v === null || v === undefined ? "" : String(v);
    }

    setPersonalDraft(nextPersonal);
    setCapacityDraft(nextCapacity);
    setStatusDraft(normalizeAccountStatus(appUser?.account_status));
    const limitVal = stateLimitKey && profile ? profile[stateLimitKey] : null;
    setStateLimitDraft(limitVal === null || limitVal === undefined ? "" : String(limitVal));
  }, [appUser?.account_status, attorneyProfile, capacityKeys, personalKeys, stateLimitKey]);

  useEffect(() => {
    hydrateDrafts();
  }, [hydrateDrafts]);

  const beginEdit = (tab: TabKey) => {
    setActiveTab(tab);
    setEditingTab(tab);
    hydrateDrafts();
  };

  const cancelEdit = () => {
    setEditingTab(null);
    hydrateDrafts();
  };

  const savePersonal = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      const profile = attorneyProfile ?? null;
      for (const key of personalKeys) {
        const raw = personalDraft[key] ?? "";
        const trimmed = raw.trim();
        const current = profile ? profile[key] : null;

        if (Array.isArray(current)) {
          patch[key] = trimmed ? trimmed.split(",").map((s) => s.trim()).filter(Boolean) : [];
          continue;
        }
        if (typeof current === "number") {
          const n = Number(trimmed);
          patch[key] = trimmed && Number.isFinite(n) ? n : null;
          continue;
        }
        if (typeof current === "boolean") {
          const normalized = trimmed.toLowerCase();
          if (!normalized) patch[key] = null;
          else patch[key] = normalized === "true" || normalized === "yes" || normalized === "1";
          continue;
        }
        if (current && typeof current === "object") {
          if (!trimmed) {
            patch[key] = null;
          } else {
            try {
              patch[key] = JSON.parse(trimmed);
            } catch {
              throw new Error(`${startCase(key)} must be valid JSON.`);
            }
          }
          continue;
        }

        patch[key] = trimmed ? trimmed : null;
      }

      const profilesClient = supabase as unknown as {
        from: (table: string) => {
          update: (values: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<{ error: { message?: string } | null }>;
          };
          upsert: (values: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error: { message?: string } | null }>;
        };
      };

      const hasRow = Boolean(attorneyProfile);
      if (hasRow) {
        const { error: updateError } = await profilesClient.from("attorney_profiles").update(patch).eq("user_id", userId);
        if (updateError) throw new Error(updateError.message || "Failed to update attorney profile");
      } else {
        const { error: upsertError } = await profilesClient
          .from("attorney_profiles")
          .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
        if (upsertError) throw new Error(upsertError.message || "Failed to create attorney profile");
      }

      toast({ title: "Saved", description: "Personal information updated." });
      setEditingTab(null);
      await refresh();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unable to save changes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveCapacity = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      const profile = attorneyProfile ?? null;

      for (const key of capacityKeys) {
        const raw = (capacityDraft[key] ?? "").trim();
        const current = profile ? profile[key] : null;

        if (Array.isArray(current) || key === "licensed_states") {
          patch[key] = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
          continue;
        }
        if (typeof current === "number") {
          const n = Number(raw);
          patch[key] = Number.isFinite(n) ? n : null;
          continue;
        }
        if (typeof current === "boolean") {
          const normalized = raw.toLowerCase();
          if (!normalized) patch[key] = null;
          else patch[key] = normalized === "true" || normalized === "yes" || normalized === "1";
          continue;
        }
        if (current && typeof current === "object") {
          if (!raw) {
            patch[key] = null;
          } else {
            try {
              patch[key] = JSON.parse(raw);
            } catch {
              throw new Error(`${startCase(key)} must be valid JSON.`);
            }
          }
          continue;
        }

        patch[key] = raw ? raw : null;
      }

      const profilesClient = supabase as unknown as {
        from: (table: string) => {
          update: (values: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<{ error: { message?: string } | null }>;
          };
          upsert: (values: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error: { message?: string } | null }>;
        };
      };

      const hasRow = Boolean(attorneyProfile);
      if (hasRow) {
        const { error: updateError } = await profilesClient.from("attorney_profiles").update(patch).eq("user_id", userId);
        if (updateError) throw new Error(updateError.message || "Failed to update attorney profile");
      } else {
        const { error: upsertError } = await profilesClient
          .from("attorney_profiles")
          .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
        if (upsertError) throw new Error(upsertError.message || "Failed to create attorney profile");
      }

      toast({ title: "Saved", description: "Capacity and jurisdictions updated." });
      setEditingTab(null);
      await refresh();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unable to save changes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAccountStatus = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const normalized = normalizeAccountStatus(statusDraft);
      const { error: updateError } = await supabase
        .from("app_users")
        .update({ account_status: normalized })
        .eq("user_id", userId);

      if (updateError) throw new Error(updateError.message || "Failed to update account status");

      toast({ title: "Saved", description: "Account status updated." });
      setEditingTab(null);
      await refresh();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unable to save changes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveStateLimit = async () => {
    if (!userId) return;
    if (!stateLimitKey) {
      toast({
        title: "Missing field",
        description: "No state limit field exists in this attorney profile record.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const raw = stateLimitDraft.trim();
      const n = raw ? Number(raw) : null;
      if (raw && (n === null || !Number.isFinite(n) || n < 0)) {
        throw new Error("State limit must be a valid number (0 or more).");
      }

      const patch: Record<string, unknown> = {};
      patch[stateLimitKey] = raw ? n : null;

      const profilesClient = supabase as unknown as {
        from: (table: string) => {
          update: (values: Record<string, unknown>) => {
            eq: (col: string, v: string) => Promise<{ error: { message?: string } | null }>;
          };
        };
      };

      const { error: updateError } = await profilesClient.from("attorney_profiles").update(patch).eq("user_id", userId);
      if (updateError) throw new Error(updateError.message || "Failed to update state limit");

      toast({ title: "Saved", description: "Order state limit updated." });
      setEditingTab(null);
      await refresh();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unable to save changes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const loadRetainerFiles = useCallback(async () => {
    if (!userId) return;
    setRetainerLoading(true);
    setRetainerError(null);
    try {
      const docsClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, v: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: RetainerDoc[] | null; error: { message?: string } | null }>;
            };
          };
        };
      };
      const { data, error: listError } = await docsClient
        .from("retainer_contract_documents")
        .select("id,user_id,state,document_path,document_name,document_mime_type,document_size_bytes,notes,created_at,updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (listError) throw new Error(listError.message || "Failed to load documents");
      setRetainerFiles(data ?? []);
    } catch (e) {
      setRetainerError(e instanceof Error ? e.message : "Unable to load documents.");
    } finally {
      setRetainerLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab === "retainer") void loadRetainerFiles();
  }, [activeTab, loadRetainerFiles]);

  const downloadRetainerFile = async (doc: RetainerDoc) => {
    const { data, error: dlError } = await storageSupabase.storage
      .from(RETAINER_BUCKET)
      .createSignedUrl(doc.document_path, 60);
    if (dlError || !data?.signedUrl) {
      toast({ title: "Download failed", description: dlError?.message ?? "Unable to generate link.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const confirmDeleteRetainerFile = async () => {
    if (!docToDelete) return;
    const doc = docToDelete;
    setDocToDelete(null);
    await deleteRetainerFile(doc);
  };

  const deleteRetainerFile = async (doc: RetainerDoc) => {
    const docsClient = supabase as unknown as {
      from: (table: string) => {
        delete: () => {
          eq: (col: string, v: string) => Promise<{ error: { message?: string } | null }>;
        };
      };
    };
    const { error: delError } = await docsClient
      .from("retainer_contract_documents")
      .delete()
      .eq("id", doc.id);
    if (delError) {
      toast({ title: "Delete failed", description: delError.message, variant: "destructive" });
      return;
    }
    // Also remove from storage
    await storageSupabase.storage.from(RETAINER_BUCKET).remove([doc.document_path]);
    toast({ title: "Deleted", description: `${doc.document_name} removed.` });
    void loadRetainerFiles();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelUpload = () => {
    setShowUploadCard(false);
    setUploadFile(null);
    setUploadState("");
    setUploadNotes("");
  };

  const saveDocument = async () => {
    if (!uploadFile || !userId) return;
    if (!uploadState) {
      toast({ title: "State required", description: "Please select a state for this document.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const path = `${userId}/${uploadState}/${Date.now()}-${uploadFile.name}`;
      const { error: upError } = await storageSupabase.storage
        .from(RETAINER_BUCKET)
        .upload(path, uploadFile, { upsert: false });
      if (upError) throw new Error(upError.message);

      const docsClient = supabase as unknown as {
        from: (table: string) => {
          insert: (values: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
        };
      };
      const { error: insertError } = await docsClient.from("retainer_contract_documents").insert({
        user_id: userId,
        state: uploadState,
        document_path: path,
        document_name: uploadFile.name,
        document_mime_type: uploadFile.type || "application/octet-stream",
        document_size_bytes: uploadFile.size,
        notes: uploadNotes.trim() || null,
      });
      if (insertError) {
        await storageSupabase.storage.from(RETAINER_BUCKET).remove([path]);
        throw new Error(insertError.message);
      }
      toast({ title: "Saved", description: `${uploadFile.name} uploaded successfully.` });
      cancelUpload();
      void loadRetainerFiles();
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Unable to upload file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const tabActions = (tab: TabKey, onSave: () => void | Promise<void>) => {
    const isEditing = editingTab === tab;
    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => cancelEdit()} disabled={saving}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button size="sm" onClick={() => void onSave()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Done
          </Button>
        </div>
      );
    }

    return (
      <Button variant="outline" size="sm" onClick={() => beginEdit(tab)} disabled={Boolean(editingTab)}>
        Edit
      </Button>
    );
  };

  if (loading && !appUser) {
    return <LogoLoader page label="Loading profile..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/account-management/lawyer-profiles")}
            aria-label="Back to lawyer profiles"
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">Lawyer Profile</h2>
              {appUser?.role ? <Badge variant="secondary">{appUser.role}</Badge> : null}
              {editMode ? <Badge variant="outline">Edit</Badge> : null}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {appUser?.email ? appUser.email : userId ? `User ID: ${userId}` : "Loading..."}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{openOrderCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profile Status</CardTitle>
          </CardHeader>
          <CardContent>
            {attorneyProfile ? (
              <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Created</Badge>
            ) : (
              <Badge variant="secondary">Missing</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {appUser?.created_at ? formatDateTime(appUser.created_at) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Updated</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {appUser?.updated_at ? formatDateTime(appUser.updated_at) : "—"}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.75fr,1.25fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              App User
            </CardTitle>
            {appUser?.account_status ? (
              <Badge variant="outline">{normalizeAccountStatus(appUser.account_status)}</Badge>
            ) : (
              <Badge variant="outline">active</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3">
              <div className="grid grid-cols-[120px,1fr] items-center gap-3">
                <div className="text-muted-foreground">Name</div>
                <div className="font-medium truncate">{appUser?.display_name || "—"}</div>
              </div>
              <div className="grid grid-cols-[120px,1fr] items-center gap-3">
                <div className="text-muted-foreground">Email</div>
                <div className="font-medium truncate">{appUser?.email || "—"}</div>
              </div>
              <div className="grid grid-cols-[120px,1fr] items-center gap-3">
                <div className="text-muted-foreground">Status</div>
                <div className="font-medium">{normalizeAccountStatus(appUser?.account_status)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Attorney Profile</CardTitle>
              {attorneyProfile ? <Badge variant="secondary">Created</Badge> : <Badge variant="secondary">Missing</Badge>}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
              <div className="rounded-lg border bg-muted/20 p-2">
                <TabsList className="w-full justify-start bg-transparent p-0">
                  <TabsTrigger value="personal" disabled={Boolean(editingTab) && editingTab !== "personal"}>
                    Personal Info
                  </TabsTrigger>
                  <TabsTrigger value="capacity" disabled={Boolean(editingTab) && editingTab !== "capacity"}>
                    Capacity & Jurisdictions
                  </TabsTrigger>
                  <TabsTrigger value="status" disabled={Boolean(editingTab) && editingTab !== "status"}>
                    Account Status
                  </TabsTrigger>
                  <TabsTrigger value="limit" disabled={Boolean(editingTab) && editingTab !== "limit"}>
                    Order State Limit
                  </TabsTrigger>
                  <TabsTrigger value="retainer" disabled={Boolean(editingTab)}>
                    Retainer Contract
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="personal">
                <div className="flex items-start justify-between gap-3 mt-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Personal Information</div>
                    <div className="text-xs text-muted-foreground">Core profile fields used across the app.</div>
                  </div>
                  {tabActions("personal", savePersonal)}
                </div>

                {personalKeys.length === 0 ? (
                  <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No personal information fields found on this attorney profile record.
                  </div>
                ) : (
                  <div className="mt-4 divide-y rounded-lg border">
                    {personalKeys.map((key) => {
                      const value = personalDraft[key] ?? "";
                      const isEditing = editingTab === "personal";
                      const label = startCase(key);
                      const multiline = key.includes("notes") || key.includes("description") || key === "bio";
                      const viewValue = attorneyProfile ? attorneyProfile[key] : value;

                      return (
                        <div key={key} className="grid gap-2 p-4 sm:grid-cols-[240px,1fr] sm:items-start">
                          <div className="text-xs font-medium text-muted-foreground">{label}</div>
                          <div>
                            {isEditing ? (
                              multiline ? (
                                <Textarea
                                  value={value}
                                  onChange={(e) => setPersonalDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                                  className="min-h-[90px]"
                                />
                              ) : (
                                <Input
                                  value={value}
                                  onChange={(e) => setPersonalDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                                />
                              )
                            ) : (
                              <div className="rounded-md border bg-muted/10 px-3 py-2 text-sm break-words">
                                {renderValue(viewValue)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="capacity">
                <div className="flex items-start justify-between gap-3 mt-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Capacity & Jurisdictions</div>
                    <div className="text-xs text-muted-foreground">
                      Coverage, practice areas, availability, and capacity controls.
                    </div>
                  </div>
                  {tabActions("capacity", saveCapacity)}
                </div>

                {capacityKeys.length === 0 ? (
                  <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No capacity/jurisdiction fields found on this attorney profile record.
                  </div>
                ) : (
                  <div className="mt-4 divide-y rounded-lg border">
                    {capacityKeys.map((key) => {
                      const current = attorneyProfile ? attorneyProfile[key] : null;
                      const value = capacityDraft[key] ?? "";
                      const isEditing = editingTab === "capacity";
                      const label = startCase(key);
                      const isMulti =
                        Array.isArray(current) ||
                        key === "licensed_states" ||
                        key === "practice_areas" ||
                        key === "case_types";

                      return (
                        <div key={key} className="grid gap-2 p-4 sm:grid-cols-[240px,1fr] sm:items-start">
                          <div className="text-xs font-medium text-muted-foreground">{label}</div>
                          <div>
                            {isEditing ? (
                              <Input
                                value={value}
                                onChange={(e) => setCapacityDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                                placeholder={isMulti ? "Comma separated" : undefined}
                              />
                            ) : (
                              <div className="rounded-md border bg-muted/10 px-3 py-2 text-sm break-words">
                                {Array.isArray(current) ? current.map(String).join(", ") : renderValue(current)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="status">
                <div className="flex items-start justify-between gap-3 mt-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Account Status</div>
                    <div className="text-xs text-muted-foreground">Controls whether this lawyer is active or inactive.</div>
                  </div>
                  {tabActions("status", saveAccountStatus)}
                </div>

                <div className="mt-4 divide-y rounded-lg border">
                  <div className="grid gap-2 p-4 sm:grid-cols-[240px,1fr] sm:items-center">
                    <div className="text-xs font-medium text-muted-foreground">Status</div>
                    <div className="max-w-[320px]">
                      {editingTab === "status" ? (
                        <Select value={normalizeAccountStatus(statusDraft)} onValueChange={(v) => setStatusDraft(v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="inline-flex rounded-md border bg-muted/10 px-3 py-2 text-sm">
                          {normalizeAccountStatus(appUser?.account_status)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="limit">
                <div className="flex items-start justify-between gap-3 mt-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Order State Limit</div>
                    <div className="text-xs text-muted-foreground">
                      Limits how many states this lawyer can include when creating an order.
                    </div>
                  </div>
                  {tabActions("limit", saveStateLimit)}
                </div>

                {!stateLimitKey ? (
                  <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No state limit field found in the current `attorney_profiles` record. Add a numeric column (e.g.
                    `state_limit`) to enable this.
                  </div>
                ) : (
                  <div className="mt-4 divide-y rounded-lg border">
                    <div className="grid gap-2 p-4 sm:grid-cols-[240px,1fr] sm:items-center">
                      <div className="text-xs font-medium text-muted-foreground">{startCase(stateLimitKey)}</div>
                      <div className="max-w-[240px]">
                        {editingTab === "limit" ? (
                          <Input
                            inputMode="numeric"
                            value={stateLimitDraft}
                            onChange={(e) => setStateLimitDraft(e.target.value)}
                            placeholder="e.g. 5"
                          />
                        ) : (
                          <div className="rounded-md border bg-muted/10 px-3 py-2 text-sm">
                            {renderValue(attorneyProfile ? attorneyProfile[stateLimitKey] : null)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="retainer">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mt-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Retainer Contract Documents</div>
                    <div className="text-xs text-muted-foreground">Upload retainer agreement documents for different states.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadRetainerFiles()} disabled={retainerLoading}>
                      <RefreshCw className={retainerLoading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                      Refresh
                    </Button>
                    {!showUploadCard && (
                      <Button size="sm" onClick={() => setShowUploadCard(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Add Document
                      </Button>
                    )}
                  </div>
                </div>

                {/* Upload card */}
                {showUploadCard && (
                  <div className="mt-4 rounded-lg border bg-muted/10 p-4 space-y-4">
                    <div>
                      <div className="text-sm font-medium">Add New Document</div>
                      <div className="text-xs text-muted-foreground">Upload a state-specific retainer file and add notes in one clean step.</div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* File picker */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium">
                          Document <span className="text-destructive">*</span>
                        </div>
                        <div
                          className="flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploadFile ? (
                            <div className="text-center">
                              <FileText className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                              <div className="text-sm font-medium truncate max-w-[180px]">{uploadFile.name}</div>
                              <div className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(1)} KB</div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                              <div className="text-sm text-muted-foreground">Click to upload document</div>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">Accepted: PDF, DOC, DOCX. Max 10MB</div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileSelect}
                        />
                      </div>

                      {/* State selector */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium">
                          State <span className="text-destructive">*</span>
                        </div>
                        <Select value={uploadState} onValueChange={setUploadState}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((s) => (
                              <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium">Notes <span className="text-muted-foreground">(Optional)</span></div>
                      <Textarea
                        placeholder="Add any notes about this document..."
                        value={uploadNotes}
                        onChange={(e) => setUploadNotes(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">You can update notes or remove this document later from the list below.</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={cancelUpload} disabled={uploading}>Cancel</Button>
                        <Button size="sm" onClick={() => void saveDocument()} disabled={uploading || !uploadFile || !uploadState}>
                          <Save className="mr-2 h-4 w-4" />
                          {uploading ? "Saving…" : "Save Document"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Documents list */}
                {retainerError ? (
                  <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{retainerError}</div>
                ) : retainerLoading ? (
                  <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">Loading documents…</div>
                ) : retainerFiles.length === 0 ? (
                  <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">No retainer contract documents uploaded yet.</div>
                ) : (
                  <div className="mt-4 space-y-0 rounded-lg border divide-y">
                    <div className="flex items-center justify-between px-4 py-2">
                      <div className="text-xs font-medium text-muted-foreground">Uploaded Documents</div>
                      <div className="text-xs text-muted-foreground">{retainerFiles.length} document{retainerFiles.length !== 1 ? "s" : ""}</div>
                    </div>
                    {retainerFiles.map((doc) => {
                      const stateName = US_STATES.find((s) => s.code === doc.state)?.name ?? doc.state;
                      const sizeKb = `${(doc.document_size_bytes / 1024).toFixed(1)} KB`;
                      const uploadedAt = doc.created_at ? formatDateTime(doc.created_at) : null;
                      const ext = doc.document_name.split(".").pop()?.toUpperCase() ?? "";
                      return (
                        <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
                            {doc.state}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{doc.document_name}</span>
                              {ext && <Badge variant="outline" className="text-xs shrink-0 font-mono">{ext}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {[stateName, sizeKb, uploadedAt].filter(Boolean).join(" · ")}
                              {doc.notes && <span className="ml-1 italic">— {doc.notes}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void downloadRetainerFile(doc)} title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void downloadRetainerFile(doc)} title="Download">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDocToDelete(doc)} title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <AlertDialog open={Boolean(docToDelete)} onOpenChange={(open) => { if (!open) setDocToDelete(null); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Document</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete <span className="font-medium text-foreground">{docToDelete?.document_name}</span>?
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => void confirmDeleteRetainerFile()}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountLawyerProfileDetailPage;
