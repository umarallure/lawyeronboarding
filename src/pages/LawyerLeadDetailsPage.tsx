import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Pencil, Save, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePipelineStages } from "@/hooks/usePipelineStages";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LawyerLead = {
  id: string;
  submission_id: string;
  user_id: string | null;
  pipeline_name: string | null;
  stage_id: string | null;
  submission_date: string | null;
  lawyer_full_name: string | null;
  firm_name: string | null;
  firm_address: string | null;
  firm_phone_no: string | null;
  profile_description: string | null;
  phone_number: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  additional_notes: string | null;
  source: string | null;
  campaign_software: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type LawyerLeadNote = {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
};

const formatDateIfPresent = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM dd, yyyy");
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <div className="text-sm font-medium text-muted-foreground">{label}</div>
    {children}
  </div>
);

const LawyerLeadDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [record, setRecord] = useState<LawyerLead | null>(null);
  const [form, setForm] = useState<LawyerLead | null>(null);

  const [notes, setNotes] = useState<LawyerLeadNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [addNoteText, setAddNoteText] = useState("");
  const [addNoteSaving, setAddNoteSaving] = useState(false);

  const pipelineName = form?.pipeline_name || record?.pipeline_name || "cold_call_pipeline";
  const { stages, loading: stagesLoading } = usePipelineStages(pipelineName);

  const { stages: coldCallStages } = usePipelineStages("cold_call_pipeline");
  const { stages: lawyerPortalStages } = usePipelineStages("lawyer_portal");
  const { stages: submissionPortalStages } = usePipelineStages("submission_portal");

  const stageLabelByAnyId = useMemo(() => {
    const map = new Map<string, string>();
    const all = [...coldCallStages, ...lawyerPortalStages, ...submissionPortalStages];
    all.forEach((s) => {
      map.set(s.id, s.label);
      map.set(s.key, s.label);
    });
    return map;
  }, [coldCallStages, lawyerPortalStages, submissionPortalStages]);

  const prevPipelineRef = useRef<string>(pipelineName);

  useEffect(() => {
    if (!form) return;
    if (stagesLoading) return;

    const prevPipeline = prevPipelineRef.current;
    const pipelineChanged = prevPipeline !== pipelineName;
    prevPipelineRef.current = pipelineName;

    if (!pipelineChanged) return;

    const firstStageKey = stages[0]?.key ?? null;
    setForm((prev) => {
      if (!prev) return prev;

      const currentStageId = (prev.stage_id || '').trim();
      const hasValidStage =
        Boolean(currentStageId) &&
        stages.some((s) => s.key === currentStageId || s.id === currentStageId);

      // Only default the stage if it's empty or invalid for the selected pipeline.
      if (hasValidStage) return prev;

      return {
        ...prev,
        stage_id: firstStageKey,
      };
    });
  }, [pipelineName, stages, stagesLoading, form]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) return;
      try {
        const appUsersQuery = supabase as unknown as {
          from: (table: string) => {
            select: (columns: string) => {
              eq: (column: string, value: string) => {
                maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
              };
            };
          };
        };

        const { data, error } = await appUsersQuery
          .from("app_users")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const typed = data as { role?: string } | null;
        if (!error && typed?.role && ["admin", "super_admin"].includes(typed.role)) {
          setIsAdmin(true);
        }
      } catch (e) {
        console.warn('Failed to check admin role', e);
      }
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    const run = async () => {
      if (!id) {
        setLoading(false);
        toast({
          title: "Error",
          description: "Missing lead ID",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);
      
      const lawyerLeadsQuery = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
            };
          };
        };
      };

      const { data, error } = await lawyerLeadsQuery
        .from("lawyer_leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        toast({
          title: "Failed to load record",
          description: error.message,
          variant: "destructive",
        });
        setRecord(null);
        setForm(null);
        setLoading(false);
        return;
      }

      if (!data) {
        toast({
          title: "Not found",
          description: "No record found for this ID",
          variant: "destructive",
        });
        setRecord(null);
        setForm(null);
        setLoading(false);
        return;
      }

      const typed = data as LawyerLead;
      setRecord(typed);
      setForm(typed);
      setIsEditing(false);
      setLoading(false);
    };

    run();
  }, [id, toast]);

  const fetchNotes = async (leadId: string) => {
    setNotesLoading(true);
    try {
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, value: string) => {
              order: (col2: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        };
      };

      const { data, error } = await client
        .from("lawyer_lead_notes")
        .select("id, lead_id, note, created_at, created_by, created_by_name")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(((data as LawyerLeadNote[]) || []).filter(Boolean));
    } catch (e) {
      console.warn("Failed to fetch lead notes", e);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    if (!record?.id) return;
    void fetchNotes(record.id);
  }, [record?.id]);

  const resolveCurrentUserName = async () => {
    if (!user?.id) return null;
    try {
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, value: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        };
      };

      const { data, error } = await client
        .from("app_users")
        .select("display_name,email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const typed = data as { display_name?: string | null; email?: string | null } | null;
      const name = (typed?.display_name || "").trim();
      return name || (typed?.email || null);
    } catch (e) {
      console.warn("Failed to resolve current user name", e);
      return null;
    }
  };

  const handleAddNote = async () => {
    if (!record?.id) return;
    if (!user?.id) {
      toast({
        title: "Not signed in",
        description: "Please sign in again to add a note.",
        variant: "destructive",
      });
      return;
    }

    const note = addNoteText.trim();
    if (!note) return;

    setAddNoteSaving(true);
    try {
      const createdByName = await resolveCurrentUserName();

      const client = supabase as unknown as {
        from: (table: string) => {
          insert: (rows: unknown) => {
            select: (cols: string) => {
              single: () => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        };
      };

      const { data, error } = await client
        .from("lawyer_lead_notes")
        .insert({
          lead_id: record.id,
          note,
          created_by: user.id,
          created_by_name: createdByName,
        })
        .select("id, lead_id, note, created_at, created_by, created_by_name")
        .single();

      if (error) throw error;

      const typed = data as LawyerLeadNote;
      setNotes((prev) => [typed, ...prev]);
      setAddNoteText("");
      setAddNoteOpen(false);
      toast({ title: "Note added" });
    } catch (e) {
      console.warn("Failed to add note", e);
      toast({
        title: "Failed to add note",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddNoteSaving(false);
    }
  };

  const setString = (key: keyof LawyerLead, value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value.trim().length ? value : null,
      } as LawyerLead;
    });
  };

  const handleCancel = () => {
    setForm(record);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!form || !record) return;

    setSaving(true);
    try {
      const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updatePayload } = form;

      const lawyerLeadsUpdate = supabase as unknown as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (column: string, value: string) => {
              select: (columns: string) => {
                single: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
              };
            };
          };
        };
      };

      const { data, error } = await lawyerLeadsUpdate
        .from("lawyer_leads")
        .update(updatePayload)
        .eq("id", record.id)
        .select("*")
        .single();

      if (error) {
        toast({
          title: "Failed to save changes",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const typed = data as LawyerLead;
      setRecord(typed);
      setForm(typed);
      setIsEditing(false);
      toast({
        title: "Saved",
        description: "Changes have been saved successfully",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const disabled = !isEditing || saving;

  const inputCls = "h-9";

  const currentStage = stages.find((s) => s.key === form?.stage_id) ?? stages.find((s) => s.id === form?.stage_id);
  const stageSelectValue = currentStage?.key ?? (form?.stage_id || "__NONE__");
  const currentStageLabel = stageLabelByAnyId.get(form?.stage_id || "") || form?.stage_id || "";
  const isCurrentStageInOptions = Boolean(currentStage) || stages.some((s) => s.key === form?.stage_id || s.id === form?.stage_id);

  return (
    <div className="space-y-4 px-4 md:px-6 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">
              {record?.lawyer_full_name || "Lead Details"}
            </div>
          </div>
        </div>

          {isAdmin && record && form && (
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save changes
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : !record || !form ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This record could not be loaded.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="w-full">
          <div className="overflow-x-auto">
            <TabsList className="justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="firm">Firm Information</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline & Stage</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Lawyer Full Name *">
                    <Input
                      className={inputCls}
                      value={form.lawyer_full_name ?? ""}
                      onChange={(e) => setString("lawyer_full_name", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Phone Number *">
                    <Input
                      className={inputCls}
                      value={form.phone_number ?? ""}
                      onChange={(e) => setString("phone_number", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      className={inputCls}
                      value={form.email ?? ""}
                      onChange={(e) => setString("email", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Street Address">
                    <Input
                      className={inputCls}
                      value={form.street_address ?? ""}
                      onChange={(e) => setString("street_address", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="City">
                    <Input
                      className={inputCls}
                      value={form.city ?? ""}
                      onChange={(e) => setString("city", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="State">
                    <Input
                      className={inputCls}
                      value={form.state ?? ""}
                      onChange={(e) => setString("state", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="ZIP Code">
                    <Input
                      className={inputCls}
                      value={form.zip_code ?? ""}
                      onChange={(e) => setString("zip_code", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Created At">
                    <Input
                      className={inputCls}
                      value={formatDateIfPresent(record.created_at)}
                      disabled
                    />
                  </Field>
                  <Field label="Updated At">
                    <Input
                      className={inputCls}
                      value={formatDateIfPresent(record.updated_at)}
                      disabled
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="firm">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Firm Name">
                    <Input
                      className={inputCls}
                      value={form.firm_name ?? ""}
                      onChange={(e) => setString("firm_name", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Firm Phone">
                    <Input
                      className={inputCls}
                      value={form.firm_phone_no ?? ""}
                      onChange={(e) => setString("firm_phone_no", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Firm Address">
                    <Input
                      className={inputCls}
                      value={form.firm_address ?? ""}
                      onChange={(e) => setString("firm_address", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Profile Description">
                    <Textarea
                      value={form.profile_description ?? ""}
                      onChange={(e) => setString("profile_description", e.target.value)}
                      disabled={disabled}
                      className="min-h-[120px]"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Pipeline">
                    {disabled ? (
                      <div className="flex items-center h-9">
                        <Badge variant="secondary" className="text-sm">
                          {form.pipeline_name === "cold_call_pipeline" ? "Marketing Pipeline" :
                            form.pipeline_name === "lawyer_portal" ? "Lawyer Portal" :
                            form.pipeline_name === "submission_portal" ? "Submission Portal" :
                            form.pipeline_name || "Unknown"}
                        </Badge>
                      </div>
                    ) : (
                      <Select
                        value={form.pipeline_name || "cold_call_pipeline"}
                        onValueChange={(value) => setString("pipeline_name", value)}
                        disabled={saving}
                      >
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder="Select pipeline" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cold_call_pipeline">Marketing Pipeline</SelectItem>
                          <SelectItem value="lawyer_portal">Lawyer Portal</SelectItem>
                          <SelectItem value="submission_portal">Submission Portal</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field label="Stage">
                    <Select
                      value={stageSelectValue}
                      onValueChange={(value) => setString("stage_id", value === "__NONE__" ? "" : value)}
                      disabled={disabled || stagesLoading}
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue placeholder={stagesLoading ? "Loading stages..." : "Select stage"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">Unassigned</SelectItem>
                        {!stagesLoading && form?.stage_id && !isCurrentStageInOptions && (
                          <SelectItem value={form.stage_id}>{currentStageLabel}</SelectItem>
                        )}
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.key}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Submission Date">
                    <Input
                      className={inputCls}
                      value={formatDateIfPresent(form.submission_date)}
                      disabled
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card>
              <CardContent className="pt-6">
                <Field label="Additional Notes">
                  <Textarea
                    value={form.additional_notes ?? ""}
                    onChange={(e) => setString("additional_notes", e.target.value)}
                    disabled={disabled}
                    className="min-h-[200px]"
                  />
                </Field>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">Notes</div>
                  <Button
                    size="sm"
                    onClick={() => setAddNoteOpen(true)}
                    disabled={!user?.id}
                  >
                    Add Note
                  </Button>
                </div>

                {notesLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading notes…
                  </div>
                ) : notes.length === 0 ? (
                  <div className="mt-3 text-sm text-muted-foreground">No notes yet.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {notes.map((n) => {
                      const author = (n.created_by_name || "").trim() || n.created_by || "Unknown";
                      const dateText = n.created_at ? format(new Date(n.created_at), "PPpp") : "";
                      return (
                        <div key={n.id} className="rounded-md border p-3">
                          <div className="text-sm text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">{author}</span>
                            {dateText ? (
                              <>
                                <span className="mx-1">•</span>
                                <span>{dateText}</span>
                              </>
                            ) : null}
                          </div>
                          <div className="whitespace-pre-wrap text-sm text-foreground">{n.note}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add note</DialogTitle>
                      <DialogDescription>
                        Add a note to this lead. It will be saved with your name.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Textarea
                        value={addNoteText}
                        onChange={(e) => setAddNoteText(e.target.value)}
                        className="min-h-[120px]"
                        placeholder="Write your note..."
                        disabled={addNoteSaving}
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setAddNoteOpen(false)}
                        disabled={addNoteSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => void handleAddNote()}
                        disabled={addNoteSaving || addNoteText.trim().length === 0}
                      >
                        {addNoteSaving ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving…
                          </span>
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default LawyerLeadDetailsPage;
