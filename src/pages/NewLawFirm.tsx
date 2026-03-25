import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToEST } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { usePipelineStages } from "@/hooks/usePipelineStages";

const NewLawFirm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedPipeline, setSelectedPipeline] = useState<string>("cold_call_pipeline");
  const { stages: portalStages, loading: stagesLoading } = usePipelineStages(selectedPipeline);

  const [firmName, setFirmName] = useState("");
  const [firmAddress, setFirmAddress] = useState("");
  const [firmPhoneNo, setFirmPhoneNo] = useState("");
  const [firmEmail, setFirmEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [source, setSource] = useState("");
  const [campaignSoftware, setCampaignSoftware] = useState("");

  const generateSubmissionId = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `LL${timestamp}${random}`;
  };

  const activeStages = useMemo(
    () => portalStages.filter((stage) => stage.is_active),
    [portalStages]
  );

  useEffect(() => {
    if (activeStages.length === 0) return;

    const hasSelectedStage = Boolean(stageId);
    const stageStillValid = hasSelectedStage && activeStages.some((s) => s.key === stageId);

    if (!stageStillValid) {
      const defaultStage = activeStages[0];
      if (defaultStage?.key) setStageId(defaultStage.key);
    }
  }, [activeStages, stageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!firmName) {
        toast({
          title: "Validation Error",
          description: "Please fill in the required field (Law Firm Name).",
          variant: "destructive",
        });
        return;
      }

      const submissionId = generateSubmissionId();

      const leadData: {
        user_id: string | null;
        pipeline_name: string | null;
        stage_id: string | null;
        submission_id: string;
        submission_date: string | null;
        lawyer_full_name: string;
        firm_name: string | null;
        firm_address: string | null;
        firm_phone_no: string | null;
        email: string | null;
        profile_description: string | null;
        additional_notes: string | null;
        city: string | null;
        state: string | null;
        zip_code: string | null;
        phone_number: string | null;
        source: string | null;
        campaign_software: string | null;
        entity_type: string | null;
        profile_type: string | null;
      } = {
        user_id: user?.id ?? null,
        pipeline_name: selectedPipeline,
        stage_id: stageId || null,
        submission_id: submissionId,
        submission_date: formatDateToEST(new Date()),
        lawyer_full_name: firmName,
        firm_name: firmName || null,
        firm_address: firmAddress || null,
        firm_phone_no: firmPhoneNo || null,
        email: firmEmail || null,
        profile_description: profileDescription || null,
        additional_notes: additionalNotes || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        phone_number: firmPhoneNo || null,
        source: source || null,
        campaign_software: campaignSoftware || null,
        entity_type: "firm",
        profile_type: "law_firm",
      };

      // Insert into lawyer_leads table
      const supabaseLeads = supabase as unknown as {
        from: (table: string) => {
          insert: (data: typeof leadData[]) => Promise<{ error: unknown }>;
        };
      };

      const { error: insertError } = await supabaseLeads.from("lawyer_leads").insert([leadData]);

      if (insertError) {
        console.error("Error creating law firm:", insertError);
        toast({
          title: "Error",
          description: "Failed to create new law firm entry",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "New law firm created successfully",
      });

      navigate("/leads");
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/leads")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add Law Firm</h1>
            <p className="text-muted-foreground mt-1">Create a new law firm profile</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Law Firm Intake Card */}
          <Card>
            <CardHeader>
              <CardTitle>Law Firm Intake</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="firmName">Law Firm Name *</Label>
                  <Input
                    id="firmName"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder="Enter law firm name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="firmPhone">Firm Phone</Label>
                  <Input
                    id="firmPhone"
                    value={firmPhoneNo}
                    onChange={(e) => setFirmPhoneNo(e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </div>

                <div>
                  <Label htmlFor="firmEmail">Firm Email</Label>
                  <Input
                    id="firmEmail"
                    type="email"
                    value={firmEmail}
                    onChange={(e) => setFirmEmail(e.target.value)}
                    placeholder="firm@email.com"
                  />
                </div>

                <div>
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="12345"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="firmAddress">Firm Address</Label>
                  <Input
                    id="firmAddress"
                    value={firmAddress}
                    onChange={(e) => setFirmAddress(e.target.value)}
                    placeholder="Enter firm address"
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Card */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pipeline">Pipeline *</Label>
                  <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cold_call_pipeline">Marketing Pipeline</SelectItem>
                      <SelectItem value="lawyer_portal">Lawyer Portal</SelectItem>
                      <SelectItem value="submission_portal">Submission Portal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="stage">Stage</Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger>
                      <SelectValue placeholder={stagesLoading ? "Loading stages..." : "Select stage"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.key}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="source">Source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="Cold Call">Cold Call</SelectItem>
                      <SelectItem value="Networking">Networking</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="campaignSoftware">Campaign/Software</Label>
                  <Input
                    id="campaignSoftware"
                    value={campaignSoftware}
                    onChange={(e) => setCampaignSoftware(e.target.value)}
                    placeholder="e.g., FlowChat - Ben's Account"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Description Card */}
          <Card>
            <CardHeader>
              <CardTitle>Notes & Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="profileDescription">Profile Description</Label>
                  <Textarea
                    id="profileDescription"
                    value={profileDescription}
                    onChange={(e) => setProfileDescription(e.target.value)}
                    placeholder="Brief profile description..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="additionalNotes">Additional Notes</Label>
                  <Textarea
                    id="additionalNotes"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any additional notes or comments..."
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => navigate("/leads")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-44">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Add Law Firm
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewLawFirm;
