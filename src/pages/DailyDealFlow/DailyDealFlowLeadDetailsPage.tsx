import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Pencil, Save, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAttorneys } from "@/hooks/useAttorneys";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DailyDealFlowRecord = {
  id: string;
  submission_id: string;
  client_phone_number: string | null;
  lead_vendor: string | null;
  date: string | null;
  insured_name: string | null;
  buffer_agent: string | null;
  agent: string | null;
  licensed_agent_account: string | null;
  status: string | null;
  call_result: string | null;
  carrier: string | null;
  product_type: string | null;
  draft_date: string | null;
  monthly_premium: number | null;
  face_amount: number | null;
  from_callback: boolean | null;
  notes: string | null;
  policy_number: string | null;
  carrier_audit: string | null;
  product_type_carrier: string | null;
  level_or_gi: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_callback: boolean | null;
  is_retention_call: boolean | null;
  placement_status: string | null;
  ghl_location_id: string | null;
  ghl_opportunity_id: string | null;
  ghlcontactid: string | null;
  sync_status: string | null;
  accident_date: string | null;
  prior_attorney_involved: boolean | null;
  prior_attorney_details: string | null;
  medical_attention: string | null;
  police_attended: boolean | null;
  accident_location: string | null;
  accident_scenario: string | null;
  insured: boolean | null;
  injuries: string | null;
  vehicle_registration: string | null;
  insurance_company: string | null;
  third_party_vehicle_registration: string | null;
  other_party_admit_fault: boolean | null;
  passengers_count: number | null;
  contact_name: string | null;
  contact_number: string | null;
  contact_address: string | null;
  carrier_attempted_1: string | null;
  carrier_attempted_2: string | null;
  carrier_attempted_3: string | null;
  assigned_attorney_id: string | null;
};

const formatDateIfPresent = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM dd, yyyy");
};

const DailyDealFlowLeadDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [record, setRecord] = useState<DailyDealFlowRecord | null>(null);
  const [form, setForm] = useState<DailyDealFlowRecord | null>(null);
  const { attorneys, loading: attorneysLoading } = useAttorneys();

  useEffect(() => {
    const run = async () => {
      if (!id) {
        setLoading(false);
        toast({
          title: "Error",
          description: "Missing daily deal flow record ID",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("daily_deal_flow")
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

      const typed = data as unknown as DailyDealFlowRecord;
      setRecord(typed);
      setForm(typed);
      setIsEditing(false);
      setLoading(false);
    };

    run();
  }, [id, toast]);

  const headerTitle = useMemo(() => {
    if (!record) return "Lead Details";
    const name = record.insured_name?.trim() || "Lead";
    return `Lead Details - ${name}`;
  }, [record]);

  const setString = (key: keyof DailyDealFlowRecord, value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value.trim().length ? value : null,
      } as DailyDealFlowRecord;
    });
  };

  const setNumber = (key: keyof DailyDealFlowRecord, value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const trimmed = value.trim();
      if (!trimmed.length) {
        return { ...prev, [key]: null } as DailyDealFlowRecord;
      }
      const parsed = Number(trimmed);
      return { ...prev, [key]: Number.isFinite(parsed) ? parsed : null } as DailyDealFlowRecord;
    });
  };

  const setBool = (key: keyof DailyDealFlowRecord, value: boolean) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value } as DailyDealFlowRecord;
    });
  };

  const setAssignedAttorneyId = (value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        assigned_attorney_id: value === "__NONE__" ? null : value,
      };
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
      const updatePayload: Partial<DailyDealFlowRecord> = { ...form };
      delete (updatePayload as any).id;
      delete (updatePayload as any).created_at;
      delete (updatePayload as any).updated_at;

      const { data, error } = await supabase
        .from("daily_deal_flow")
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

      const typed = data as unknown as DailyDealFlowRecord;
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
      <div className="text-sm text-muted-foreground">{label}</div>
      {children}
    </div>
  );

  const inputCls = "h-9";

  return (
    <div className="space-y-4 px-4 md:px-6 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">{headerTitle}</div>
            {record?.submission_id && (
              <div className="text-sm text-muted-foreground truncate">
                Submission ID: {record.submission_id}
              </div>
            )}
          </div>
        </div>

        {record && form && (
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
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="policy">Policy</TabsTrigger>
              <TabsTrigger value="accident">Accident</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Date">
                    <Input
                      type="date"
                      className={inputCls}
                      value={form.date ?? ""}
                      onChange={(e) => setString("date", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Insured Name">
                    <Input
                      className={inputCls}
                      value={form.insured_name ?? ""}
                      onChange={(e) => setString("insured_name", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Client Phone Number">
                    <Input
                      className={inputCls}
                      value={form.client_phone_number ?? ""}
                      onChange={(e) => setString("client_phone_number", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Lead Vendor">
                    <Input
                      className={inputCls}
                      value={form.lead_vendor ?? ""}
                      onChange={(e) => setString("lead_vendor", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Status">
                    <Input
                      className={inputCls}
                      value={form.status ?? ""}
                      onChange={(e) => setString("status", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Call Result">
                    <Input
                      className={inputCls}
                      value={form.call_result ?? ""}
                      onChange={(e) => setString("call_result", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="From Callback">
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        checked={Boolean(form.from_callback)}
                        onCheckedChange={(v) => setBool("from_callback", v)}
                        disabled={disabled}
                      />
                      <span className="text-sm">{form.from_callback ? "Yes" : "No"}</span>
                    </div>
                  </Field>
                  <Field label="Callback">
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        checked={Boolean(form.is_callback)}
                        onCheckedChange={(v) => setBool("is_callback", v)}
                        disabled={disabled}
                      />
                      <span className="text-sm">{form.is_callback ? "Yes" : "No"}</span>
                    </div>
                  </Field>
                  <Field label="Retention Call">
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        checked={Boolean(form.is_retention_call)}
                        onCheckedChange={(v) => setBool("is_retention_call", v)}
                        disabled={disabled}
                      />
                      <span className="text-sm">{form.is_retention_call ? "Yes" : "No"}</span>
                    </div>
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Notes">
                    <Textarea
                      value={form.notes ?? ""}
                      onChange={(e) => setString("notes", e.target.value)}
                      disabled={disabled}
                      className="min-h-[120px]"
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

          <TabsContent value="agents">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Buffer Agent">
                    <Input
                      className={inputCls}
                      value={form.buffer_agent ?? ""}
                      onChange={(e) => setString("buffer_agent", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Agent">
                    <Input
                      className={inputCls}
                      value={form.agent ?? ""}
                      onChange={(e) => setString("agent", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Licensed Agent Account">
                    <Input
                      className={inputCls}
                      value={form.licensed_agent_account ?? ""}
                      onChange={(e) => setString("licensed_agent_account", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Assigned Attorney">
                    <Select
                      value={form.assigned_attorney_id || "__NONE__"}
                      onValueChange={setAssignedAttorneyId}
                      disabled={disabled}
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue placeholder={attorneysLoading ? "Loading attorneys…" : "Select attorney"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">Unassigned</SelectItem>
                        {attorneys.map((attorney) => {
                          const label =
                            attorney.full_name?.trim() ||
                            attorney.primary_email?.trim() ||
                            attorney.user_id;
                          return (
                            <SelectItem key={attorney.user_id} value={attorney.user_id}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policy">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Carrier">
                    <Input
                      className={inputCls}
                      value={form.carrier ?? ""}
                      onChange={(e) => setString("carrier", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Product Type">
                    <Input
                      className={inputCls}
                      value={form.product_type ?? ""}
                      onChange={(e) => setString("product_type", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Product Type Carrier">
                    <Input
                      className={inputCls}
                      value={form.product_type_carrier ?? ""}
                      onChange={(e) => setString("product_type_carrier", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Level or GI">
                    <Input
                      className={inputCls}
                      value={form.level_or_gi ?? ""}
                      onChange={(e) => setString("level_or_gi", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Draft Date">
                    <Input
                      type="date"
                      className={inputCls}
                      value={form.draft_date ?? ""}
                      onChange={(e) => setString("draft_date", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Monthly Premium">
                    <Input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={form.monthly_premium ?? ""}
                      onChange={(e) => setNumber("monthly_premium", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Face Amount">
                    <Input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={form.face_amount ?? ""}
                      onChange={(e) => setNumber("face_amount", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Policy Number">
                    <Input
                      className={inputCls}
                      value={form.policy_number ?? ""}
                      onChange={(e) => setString("policy_number", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Placement Status">
                    <Input
                      className={inputCls}
                      value={form.placement_status ?? ""}
                      onChange={(e) => setString("placement_status", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Carrier Audit">
                    <Textarea
                      value={form.carrier_audit ?? ""}
                      onChange={(e) => setString("carrier_audit", e.target.value)}
                      disabled={disabled}
                      className="min-h-[120px]"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accident">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Accident Date">
                    <Input
                      type="date"
                      className={inputCls}
                      value={form.accident_date ?? ""}
                      onChange={(e) => setString("accident_date", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Accident Location">
                    <Input
                      className={inputCls}
                      value={form.accident_location ?? ""}
                      onChange={(e) => setString("accident_location", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Police Attended">
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        checked={Boolean(form.police_attended)}
                        onCheckedChange={(v) => setBool("police_attended", v)}
                        disabled={disabled}
                      />
                      <span className="text-sm">{form.police_attended ? "Yes" : "No"}</span>
                    </div>
                  </Field>
                  <Field label="Insured">
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        checked={Boolean(form.insured)}
                        onCheckedChange={(v) => setBool("insured", v)}
                        disabled={disabled}
                      />
                      <span className="text-sm">{form.insured ? "Yes" : "No"}</span>
                    </div>
                  </Field>
                  <Field label="Passengers Count">
                    <Input
                      type="number"
                      className={inputCls}
                      value={form.passengers_count ?? ""}
                      onChange={(e) => setNumber("passengers_count", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Other Party Admit Fault">
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        checked={Boolean(form.other_party_admit_fault)}
                        onCheckedChange={(v) => setBool("other_party_admit_fault", v)}
                        disabled={disabled}
                      />
                      <span className="text-sm">{form.other_party_admit_fault ? "Yes" : "No"}</span>
                    </div>
                  </Field>
                  <Field label="Vehicle Registration">
                    <Input
                      className={inputCls}
                      value={form.vehicle_registration ?? ""}
                      onChange={(e) => setString("vehicle_registration", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Insurance Company">
                    <Input
                      className={inputCls}
                      value={form.insurance_company ?? ""}
                      onChange={(e) => setString("insurance_company", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Third Party Vehicle Registration">
                    <Input
                      className={inputCls}
                      value={form.third_party_vehicle_registration ?? ""}
                      onChange={(e) => setString("third_party_vehicle_registration", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Prior Attorney Involved">
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        checked={Boolean(form.prior_attorney_involved)}
                        onCheckedChange={(v) => setBool("prior_attorney_involved", v)}
                        disabled={disabled}
                      />
                      <span className="text-sm">{form.prior_attorney_involved ? "Yes" : "No"}</span>
                    </div>
                  </Field>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Accident Scenario">
                    <Textarea
                      value={form.accident_scenario ?? ""}
                      onChange={(e) => setString("accident_scenario", e.target.value)}
                      disabled={disabled}
                      className="min-h-[120px]"
                    />
                  </Field>
                  <Field label="Injuries">
                    <Textarea
                      value={form.injuries ?? ""}
                      onChange={(e) => setString("injuries", e.target.value)}
                      disabled={disabled}
                      className="min-h-[120px]"
                    />
                  </Field>
                  <Field label="Medical Attention">
                    <Textarea
                      value={form.medical_attention ?? ""}
                      onChange={(e) => setString("medical_attention", e.target.value)}
                      disabled={disabled}
                      className="min-h-[120px]"
                    />
                  </Field>
                  <Field label="Prior Attorney Details">
                    <Textarea
                      value={form.prior_attorney_details ?? ""}
                      onChange={(e) => setString("prior_attorney_details", e.target.value)}
                      disabled={disabled}
                      className="min-h-[120px]"
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Contact</div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Contact Name">
                      <Input
                        className={inputCls}
                        value={form.contact_name ?? ""}
                        onChange={(e) => setString("contact_name", e.target.value)}
                        disabled={disabled}
                      />
                    </Field>
                    <Field label="Contact Number">
                      <Input
                        className={inputCls}
                        value={form.contact_number ?? ""}
                        onChange={(e) => setString("contact_number", e.target.value)}
                        disabled={disabled}
                      />
                    </Field>
                    <Field label="Contact Address">
                      <Input
                        className={inputCls}
                        value={form.contact_address ?? ""}
                        onChange={(e) => setString("contact_address", e.target.value)}
                        disabled={disabled}
                      />
                    </Field>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="GHL Location ID">
                    <Input
                      className={inputCls}
                      value={form.ghl_location_id ?? ""}
                      onChange={(e) => setString("ghl_location_id", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="GHL Opportunity ID">
                    <Input
                      className={inputCls}
                      value={form.ghl_opportunity_id ?? ""}
                      onChange={(e) => setString("ghl_opportunity_id", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="GHL Contact ID">
                    <Input
                      className={inputCls}
                      value={form.ghlcontactid ?? ""}
                      onChange={(e) => setString("ghlcontactid", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Sync Status">
                    <Input
                      className={inputCls}
                      value={form.sync_status ?? ""}
                      onChange={(e) => setString("sync_status", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Carrier Attempted 1">
                    <Input
                      className={inputCls}
                      value={form.carrier_attempted_1 ?? ""}
                      onChange={(e) => setString("carrier_attempted_1", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Carrier Attempted 2">
                    <Input
                      className={inputCls}
                      value={form.carrier_attempted_2 ?? ""}
                      onChange={(e) => setString("carrier_attempted_2", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Carrier Attempted 3">
                    <Input
                      className={inputCls}
                      value={form.carrier_attempted_3 ?? ""}
                      onChange={(e) => setString("carrier_attempted_3", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default DailyDealFlowLeadDetailsPage;
