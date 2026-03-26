import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X } from 'lucide-react';
import { format } from 'date-fns';

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
};

interface CallbackRequestFormProps {
  lead: Lead;
  leadVendor: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const requestTypeOptions = [
  { value: "new_application", label: "New Application" },
  { value: "updating_billing", label: "Updating Billing/Draft Date" },
  { value: "carrier_requirements", label: "Fulfilling Pending Carrier Requirements" }
];

export const CallbackRequestForm = ({ lead, leadVendor, open, onClose, onSuccess }: CallbackRequestFormProps) => {
  const [requestType, setRequestType] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

      // Send Slack notification
      try {
        const requestTypeLabel = requestTypeOptions.find(opt => opt.value === requestType)?.label || requestType;
        
        const { error: slackError } = await supabase.functions.invoke('send-slack-notification', {
          body: {
            type: 'callback_request',
            data: {
              submission_id: lead.submission_id,
              customer_name: lead.customer_full_name || 'N/A',
              phone_number: lead.phone_number || 'N/A',
              lead_vendor: leadVendor,
              request_type: requestTypeLabel,
              notes: notes,
              carrier: lead.carrier || 'N/A',
              coverage_amount: lead.coverage_amount || 0,
              monthly_premium: lead.monthly_premium || 0,
              state: lead.state || 'N/A',
              requested_at: new Date().toISOString()
            }
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
        description: "Callback request submitted successfully",
      });

      // Reset form
      setRequestType("");
      setNotes("");
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
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

  const handleClose = () => {
    if (!isSubmitting) {
      setRequestType("");
      setNotes("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>BPO-Client Connection - Callback Request</span>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={isSubmitting}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Side - Lead Information */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Lead Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Submission ID</Label>
                    <p className="text-sm font-medium">{lead.submission_id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Customer Name</Label>
                    <p className="text-sm font-medium">{lead.customer_full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone Number</Label>
                    <p className="text-sm font-medium">{lead.phone_number || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">State</Label>
                    <p className="text-sm font-medium">{lead.state || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Carrier</Label>
                    <p className="text-sm font-medium">{lead.carrier || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Coverage Amount</Label>
                    <p className="text-sm font-medium">${lead.coverage_amount?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Monthly Premium</Label>
                    <p className="text-sm font-medium">${lead.monthly_premium?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <p className="text-sm font-medium">
                      {lead.created_at ? format(new Date(lead.created_at), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Submission Date</Label>
                    <p className="text-sm font-medium">
                      {lead.submission_date ? format(new Date(lead.submission_date), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Lead Vendor</Label>
                    <p className="text-sm font-medium">{leadVendor}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Callback Request Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Callback Request Details</CardTitle>
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
                      rows={8}
                      disabled={isSubmitting}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Please provide detailed information about the callback request
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Request'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
