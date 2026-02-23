import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToEST } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { usePipelineStages } from "@/hooks/usePipelineStages";

const NewCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("cold_call_pipeline");
  const { stages: portalStages, loading: stagesLoading } = usePipelineStages(selectedPipeline);

  // Form state
  const [lawyerFullName, setLawyerFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [firmName, setFirmName] = useState("");
  const [firmAddress, setFirmAddress] = useState("");
  const [firmPhoneNo, setFirmPhoneNo] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [source, setSource] = useState("");
  const [campaignSoftware, setCampaignSoftware] = useState("");
  
  // Generate unique submission ID
  const generateSubmissionId = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `LL${timestamp}${random}`;
  };

  const activeStages = portalStages.filter((stage) => stage.is_active);

  useEffect(() => {
    if (activeStages.length > 0) {
      const defaultStage = activeStages[0];
      if (defaultStage?.id) {
        setStageId(defaultStage.id);
      }
    }
  }, [activeStages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!lawyerFullName || !phoneNumber) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields (Name, Phone)",
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
        profile_description: string | null;
        phone_number: string;
        email: string | null;
        street_address: string | null;
        city: string | null;
        state: string | null;
        zip_code: string | null;
        additional_notes: string | null;
        source: string | null;
        campaign_software: string | null;
      } = {
        user_id: user?.id ?? null,
        pipeline_name: selectedPipeline,
        stage_id: stageId || null,
        submission_id: submissionId,
        submission_date: formatDateToEST(new Date()),
        lawyer_full_name: lawyerFullName,
        firm_name: firmName || null,
        firm_address: firmAddress || null,
        firm_phone_no: firmPhoneNo || null,
        profile_description: profileDescription || null,
        phone_number: phoneNumber,
        email: email || null,
        street_address: streetAddress || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        additional_notes: additionalNotes || null,
        source: source || null,
        campaign_software: campaignSoftware || null,
      };

      // Insert into lawyer_leads table
      const supabaseLeads = supabase as unknown as {
        from: (table: string) => {
          insert: (
            data: typeof leadData[]
          ) => Promise<{ error: unknown }>;
        };
      };

      const { error: insertError } = await supabaseLeads
        .from("lawyer_leads")
        .insert([leadData]);

      if (insertError) {
        console.error("Error creating lead:", insertError);
        toast({
          title: "Error",
          description: "Failed to create new lead entry",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "New lead created successfully",
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
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Lawyer</h1>
            <p className="text-muted-foreground mt-1">
              Add a new lawyer manually
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Firm Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Firm Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firmName">Firm Name</Label>
                  <Input
                    id="firmName"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder="Enter firm name"
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

                <div className="md:col-span-2">
                  <Label htmlFor="firmAddress">Firm Address</Label>
                  <Input
                    id="firmAddress"
                    value={firmAddress}
                    onChange={(e) => setFirmAddress(e.target.value)}
                    placeholder="Enter firm address"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lawyerFullName">Lawyer Full Name *</Label>
                  <Input
                    id="lawyerFullName"
                    value={lawyerFullName}
                    onChange={(e) => setLawyerFullName(e.target.value)}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phoneNumber">Phone Number *</Label>
                  <Input
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lawyer@email.com"
                  />
                </div>

                <div>
                  <Label htmlFor="streetAddress">Street Address</Label>
                  <Input
                    id="streetAddress"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="123 Main St"
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

                <div>
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="12345"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline & Source Tracking Card */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline & Source Tracking</CardTitle>
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
                        <SelectItem key={stage.id} value={stage.id}>
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
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate("/leads")}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="min-w-32"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Lead"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCallback;
