import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Pencil, Save, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePipelineStages } from "@/hooks/usePipelineStages";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  created_at: string | null;
  updated_at: string | null;
};

const formatDateIfPresent = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM dd, yyyy");
};

const LawyerLeadDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [record, setRecord] = useState<LawyerLead | null>(null);
  const [form, setForm] = useState<LawyerLead | null>(null);

  const pipelineName = record?.pipeline_name || "cold_call_pipeline";
  const { stages, loading: stagesLoading } = usePipelineStages(pipelineName);

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
              maybeSingle: () => Promise<{ data: any | null; error: any }>;
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
          update: (data: any) => {
            eq: (column: string, value: string) => {
              select: (columns: string) => {
                single: () => Promise<{ data: any | null; error: any }>;
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

  const inputCls = "h-9";

  const currentStage = stages.find(s => s.id === form?.stage_id);

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

        {/* {record && form && (
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
        )} */}
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
                    <div className="flex items-center h-9">
                      <Badge variant="secondary" className="text-sm">
                        {form.pipeline_name === "cold_call_pipeline" ? "Cold Call Pipeline" : 
                         form.pipeline_name === "submission_portal" ? "Submission Portal" : 
                         form.pipeline_name || "Unknown"}
                      </Badge>
                    </div>
                  </Field>
                  <Field label="Stage">
                    <Select
                      value={form.stage_id || "__NONE__"}
                      onValueChange={(value) => setString("stage_id", value === "__NONE__" ? "" : value)}
                      disabled={disabled || stagesLoading}
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue placeholder={stagesLoading ? "Loading stages..." : "Select stage"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">Unassigned</SelectItem>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default LawyerLeadDetailsPage;
