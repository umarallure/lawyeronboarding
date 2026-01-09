import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Phone, User, MapPin, ChevronDown, ChevronUp, FileText, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useCenterUser } from '@/hooks/useCenterUser';

type Lead = {
  id: string;
  submission_id: string;
  customer_full_name: string | null;
  phone_number: string | null;
  carrier: string | null;
  monthly_premium: number | null;
  coverage_amount: number | null;
  state: string | null;
  created_at: string;
  submission_date: string | null;
  lead_vendor: string | null;
};

type DailyDealFlowEntry = {
  id: string;
  submission_id: string;
  insured_name: string | null;
  client_phone_number: string | null;
  lead_vendor: string | null;
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
  policy_number: string | null;
  carrier_audit: string | null;
  notes: string | null;
  date: string | null;
  created_at: string;
  updated_at: string;
};

const requestTypeOptions = [
  { value: "new_application", label: "New Application" },
  { value: "updating_billing", label: "Updating Billing/Draft Date" },
  { value: "carrier_requirements", label: "Fulfilling Pending Carrier Requirements" }
];

const CallbackRequestPage = () => {
  const [searchParams] = useSearchParams();
  const submissionId = searchParams.get('submissionId');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { leadVendor, loading: centerLoading } = useCenterUser();

  console.log('[DEBUG CallbackRequestPage] Component rendering - URL params:', { submissionId });

  const [lead, setLead] = useState<Lead | null>(null);
  const [dealFlowEntries, setDealFlowEntries] = useState<DailyDealFlowEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});
  const [requestType, setRequestType] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    console.log('[DEBUG CallbackRequestPage] useEffect triggered - submissionId:', submissionId, 'leadVendor:', leadVendor, 'centerLoading:', centerLoading);
    
    // Wait for center data to load
    if (centerLoading) {
      console.log('[DEBUG CallbackRequestPage] Still loading center data, waiting...');
      return;
    }
    
    console.log('[DEBUG CallbackRequestPage] Center data loaded! Proceeding with checks...');
    
    if (!submissionId) {
      console.log('[DEBUG CallbackRequestPage] No submissionId, redirecting to portal');
      navigate('/center-lead-portal');
      return;
    }
    
    if (!leadVendor) {
      console.log('[DEBUG CallbackRequestPage] No leadVendor found after loading, user might not be a center user, redirecting to portal');
      navigate('/center-lead-portal');
      return;
    }
    
    console.log('[DEBUG CallbackRequestPage] All checks passed, fetching lead...');
    // Now we have both submissionId and leadVendor, fetch the lead
    fetchLead();
  }, [submissionId, leadVendor, centerLoading]);

  const fetchLead = async () => {
    if (!submissionId || !leadVendor) {
      console.log('[DEBUG CallbackRequestPage] Cannot fetch - missing submissionId or leadVendor:', { submissionId, leadVendor });
      return;
    }

    console.log('[DEBUG CallbackRequestPage] Fetching lead for submission:', submissionId, 'vendor:', leadVendor);

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('submission_id', submissionId)
        .eq('lead_vendor', leadVendor)
        .single();

      console.log('[DEBUG CallbackRequestPage] Fetch result:', { data, error });

      if (error) throw error;

      if (!data) {
        toast({
          title: "Lead Not Found",
          description: "Could not find the lead you're looking for",
          variant: "destructive",
        });
        navigate('/center-lead-portal');
        return;
      }

      setLead(data);
      console.log('[DEBUG CallbackRequestPage] Lead set successfully');
      
      // Fetch related daily deal flow entries
      await fetchDealFlowEntries(data);
    } catch (error) {
      console.error('Error fetching lead:', error);
      toast({
        title: "Error",
        description: "Failed to load lead details",
        variant: "destructive",
      });
      navigate('/center-lead-portal');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDealFlowEntries = async (leadData: Lead) => {
    try {
      console.log('[DEBUG CallbackRequestPage] Fetching deal flow entries...', {
        submissionId: leadData.submission_id,
        name: leadData.customer_full_name,
        phone: leadData.phone_number,
        vendor: leadVendor
      });
      
      // Strategy 1: Try exact match by full submission_id first
      let { data: dataByExactSubmission, error: errorByExactSubmission } = await supabase
        .from('daily_deal_flow')
        .select('*')
        .eq('submission_id', leadData.submission_id)
        .order('created_at', { ascending: false });

      console.log('[DEBUG CallbackRequestPage] Search by exact submission_id:', {
        submissionId: leadData.submission_id,
        found: dataByExactSubmission?.length || 0,
        error: errorByExactSubmission
      });

      // Strategy 2: If no exact match and we have name, phone, and vendor, search by those
      let dataByDetails: DailyDealFlowEntry[] = [];
      if (!dataByExactSubmission?.length && leadData.customer_full_name && leadData.phone_number && leadVendor) {
        const { data: detailsData, error: detailsError } = await supabase
          .from('daily_deal_flow')
          .select('*')
          .eq('insured_name', leadData.customer_full_name)
          .eq('client_phone_number', leadData.phone_number)
          .eq('lead_vendor', leadVendor)
          .order('created_at', { ascending: false });

        if (!detailsError && detailsData) {
          dataByDetails = detailsData;
          console.log('[DEBUG CallbackRequestPage] Search by exact name/phone/vendor found:', dataByDetails.length);
        } else {
          console.log('[DEBUG CallbackRequestPage] Error or no results for name/phone/vendor search:', detailsError);
        }
      }

      // Use exact submission match if found, otherwise use name/phone/vendor match
      const finalResults = dataByExactSubmission?.length 
        ? dataByExactSubmission 
        : dataByDetails;

      console.log('[DEBUG CallbackRequestPage] Final deal flow entries count:', finalResults.length);
      setDealFlowEntries(finalResults || []);
    } catch (error) {
      console.error('[DEBUG CallbackRequestPage] Exception fetching deal flow:', error);
      setDealFlowEntries([]);
    }
  };

  const toggleEntry = (entryId: string) => {
    setExpandedEntries(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lead || !leadVendor) return;

    if (!requestType) {
      toast({
        title: "Validation Error",
        description: "Please select a request type",
        variant: "destructive",
      });
      return;
    }

    if (!notes.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide notes for this callback request",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Save callback request to database
      const { data: callbackData, error: callbackError } = await supabase
        .from('callback_requests')
        .insert({
          submission_id: lead.submission_id,
          lead_vendor: leadVendor,
          request_type: requestType,
          notes: notes,
          customer_name: lead.customer_full_name,
          phone_number: lead.phone_number,
          status: 'pending',
          requested_by: user?.id,
          requested_at: new Date().toISOString()
        })
        .select()
        .single();

      if (callbackError) throw callbackError;

      // Send Slack notification with callback-notification edge function
      try {
        const requestTypeLabel = requestTypeOptions.find(opt => opt.value === requestType)?.label || requestType;
        
        const { error: slackError } = await supabase.functions.invoke('callback-notification', {
          body: {
            submission_id: lead.submission_id,
            customer_name: lead.customer_full_name || 'N/A',
            phone_number: lead.phone_number || 'N/A',
            lead_vendor: leadVendor,
            request_type: requestTypeLabel,
            notes: notes,
            carrier: lead.carrier || 'N/A',
            state: lead.state || 'N/A',
          }
        });

        if (slackError) {
          console.error('Slack notification error:', slackError);
          // Don't fail the entire process if Slack fails
        }
      } catch (slackError) {
        console.error('Failed to send Slack notification:', slackError);
      }

      toast({
        title: "Success",
        description: "Callback request submitted successfully. Agent has been notified.",
      });

      // Navigate back to portal
      navigate('/center-lead-portal');
    } catch (error) {
      console.error('Error submitting callback request:', error);
      toast({
        title: "Error",
        description: "Failed to submit callback request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate('/center-lead-portal');
  };

  if (centerLoading || isLoading) {
    console.log('[DEBUG CallbackRequestPage] Rendering loading screen - centerLoading:', centerLoading, 'isLoading:', isLoading);
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg font-semibold text-foreground">
            {centerLoading ? '⏳ Loading your information...' : '📋 Loading lead details...'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Submission ID: {submissionId}
          </p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={handleBack} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
          <h1 className="text-2xl font-bold text-foreground">BPO-Client Connection - Callback Request</h1>
          <p className="text-muted-foreground">Request a callback from an agent for this lead</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Complete Lead Information (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Customer Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Full Name</Label>
                    <p className="text-base font-semibold">{lead.customer_full_name || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Phone Number</Label>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <p className="text-base font-semibold">{lead.phone_number || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">State</Label>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p className="text-base font-semibold">{lead.state || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Submission ID</Label>
                    <p className="text-sm">{lead.submission_id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Call History from Daily Deal Flow */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Call History</span>
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">
                    {dealFlowEntries.length} {dealFlowEntries.length === 1 ? 'entry' : 'entries'} found
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dealFlowEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No call history found for this lead</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dealFlowEntries.map((entry, index) => (
                      <Collapsible
                        key={entry.id}
                        open={expandedEntries[entry.id]}
                        onOpenChange={() => toggleEntry(entry.id)}
                      >
                        <Card className="border-2">
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold">#{index + 1}</span>
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-sm">
                                        {entry.call_result || 'No Result'}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {entry.date ? format(new Date(entry.date), 'MMM dd, yyyy') : 'No date'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {entry.status && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                        {entry.status}
                                      </span>
                                    )}
                                    {entry.agent && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                                        Agent: {entry.agent}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {expandedEntries[entry.id] ? (
                                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="pt-0 px-4 pb-4">
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {entry.buffer_agent && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Buffer Agent</Label>
                                    <p className="font-medium">{entry.buffer_agent}</p>
                                  </div>
                                )}
                                {entry.licensed_agent_account && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Licensed Agent</Label>
                                    <p className="font-medium">{entry.licensed_agent_account}</p>
                                  </div>
                                )}
                                {entry.carrier && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Carrier</Label>
                                    <p className="font-medium">{entry.carrier}</p>
                                  </div>
                                )}
                                {entry.product_type && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Product Type</Label>
                                    <p className="font-medium">{entry.product_type}</p>
                                  </div>
                                )}
                                {entry.monthly_premium && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Monthly Premium</Label>
                                    <p className="font-medium">${entry.monthly_premium.toLocaleString()}</p>
                                  </div>
                                )}
                                {entry.face_amount && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Face Amount</Label>
                                    <p className="font-medium">${entry.face_amount.toLocaleString()}</p>
                                  </div>
                                )}
                                {entry.draft_date && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Draft Date</Label>
                                    <p className="font-medium">{format(new Date(entry.draft_date), 'MMM dd, yyyy')}</p>
                                  </div>
                                )}
                                {entry.policy_number && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Policy Number</Label>
                                    <p className="font-medium">{entry.policy_number}</p>
                                  </div>
                                )}
                                {entry.carrier_audit && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Carrier Audit</Label>
                                    <p className="font-medium">{entry.carrier_audit}</p>
                                  </div>
                                )}
                                {entry.notes && (
                                  <div className="col-span-2">
                                    <Label className="text-xs text-muted-foreground">Notes</Label>
                                    <p className="font-medium text-sm mt-1 p-2 bg-muted rounded">
                                      {entry.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  <Calendar className="h-3 w-3 inline mr-1" />
                                  Created: {format(new Date(entry.created_at), 'MMM dd, yyyy hh:mm a')}
                                </span>
                                {entry.updated_at !== entry.created_at && (
                                  <span>
                                    Updated: {format(new Date(entry.updated_at), 'MMM dd, yyyy hh:mm a')}
                                  </span>
                                )}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Callback Request Form (1 column) */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Request Type */}
                  <div className="space-y-2">
                    <Label htmlFor="request-type">
                      Request Type <span className="text-red-500">*</span>
                    </Label>
                    <Select value={requestType} onValueChange={setRequestType} disabled={isSubmitting}>
                      <SelectTrigger id="request-type">
                        <SelectValue placeholder="Select request type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {requestTypeOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose the type of callback you need
                    </p>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">
                      Notes <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Provide detailed notes about this callback request..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={12}
                      disabled={isSubmitting}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Please provide detailed information about the callback request
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 pt-4">
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Callback Request'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallbackRequestPage;
